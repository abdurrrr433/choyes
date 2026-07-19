import { Router } from 'express';
import multer from 'multer';

const router = Router();
const MAX_PASSPORT_BYTES = 8 * 1024 * 1024;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: MAX_PASSPORT_BYTES },
});

const PASSPORT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    passport_number: { type: 'STRING' },
    first_name: { type: 'STRING' },
    last_name: { type: 'STRING' },
    date_of_birth: { type: 'STRING' },
    passport_expiration_date: { type: 'STRING' },
    sex: { type: 'STRING', enum: ['male', 'female', ''] },
    nationality_code: { type: 'STRING' },
    country_code: { type: 'STRING' },
    issuing_country: { type: 'STRING' },
    confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
  },
  required: [
    'passport_number', 'first_name', 'last_name', 'date_of_birth',
    'passport_expiration_date', 'sex', 'nationality_code', 'country_code',
    'issuing_country', 'confidence',
  ],
};

const PROMPT = `Extract the identity fields from this passport data-page image.
Prefer the MRZ when it conflicts with printed text. Return names in uppercase Latin
characters, passport number uppercase without spaces, sex as male or female,
nationality as ISO alpha-3, country as ISO alpha-2, and dates as YYYY-MM-DD.
Use an empty string for any unreadable field and never invent a value.`;

export function detectImageMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return '';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return '';
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function normalizePassportData(input = {}) {
  const text = (key, upper = false) => {
    const value = typeof input[key] === 'string' ? input[key].trim() : '';
    return upper ? value.toUpperCase() : value;
  };
  const dateOfBirth = text('date_of_birth');
  const expiration = text('passport_expiration_date');
  const sex = text('sex').toLowerCase();
  const confidence = text('confidence').toLowerCase();
  return {
    passport_number: text('passport_number', true).replace(/\s+/g, ''),
    first_name: text('first_name', true),
    last_name: text('last_name', true),
    date_of_birth: isIsoDate(dateOfBirth) ? dateOfBirth : '',
    passport_expiration_date: isIsoDate(expiration) ? expiration : '',
    sex: sex === 'male' || sex === 'female' ? sex : '',
    nationality_code: text('nationality_code', true),
    country_code: text('country_code', true),
    issuing_country: text('issuing_country', true),
    confidence: ['high', 'medium', 'low'].includes(confidence) ? confidence : 'low',
  };
}

function extractResponseText(payload) {
  return payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || '')
    .join('')
    .trim() || '';
}

async function scanWithGemini(buffer, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error('Passport auto-fill is not configured on the server');
    error.statusCode = 503;
    throw error;
  }

  let response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [
            { inlineData: { mimeType, data: buffer.toString('base64') } },
            { text: PROMPT },
          ] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: PASSPORT_SCHEMA,
            temperature: 0,
          },
        }),
        signal: AbortSignal.timeout(60_000),
      },
    );
  } catch {
    throw Object.assign(new Error('Passport recognition service could not be reached'), { statusCode: 502 });
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error('Passport recognition service rejected the image');
    error.statusCode = 502;
    error.cause = payload?.error?.message;
    throw error;
  }
  const raw = extractResponseText(payload);
  if (!raw) throw Object.assign(new Error('Passport recognition returned no data'), { statusCode: 502 });
  try {
    return normalizePassportData(JSON.parse(raw));
  } catch {
    throw Object.assign(new Error('Passport recognition returned invalid data'), { statusCode: 502 });
  }
}

router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file?.buffer?.length) return res.status(400).json({ message: 'Choose a passport image to upload.' });
    const mimeType = detectImageMime(req.file.buffer);
    if (!mimeType) return res.status(415).json({ message: 'Use a valid JPEG, PNG or WEBP passport photo.' });
    const data = await scanWithGemini(req.file.buffer, mimeType);
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
});

router.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'Passport image is too large (maximum 8 MB).' });
  }
  return next(error);
});

export { router as passportScanRouter };
