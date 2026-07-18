import { Router } from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';

const router = Router();

// ── Config ────────────────────────────────────────────────────────────────
const GEMINI_MODEL = 'gemini-2.5-flash';
const ACCEPTED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
});

const SYSTEM_PROMPT = `You are a passport data extractor. You receive a single passport image and return ONLY a JSON object (no markdown, no prose, no code fences) with the fields listed below. If you cannot read a field reliably, use an empty string ""; do NOT invent data.

Return this exact schema:
{
  "passport_number": "string (uppercase, alphanumeric only, e.g. BC1234567)",
  "first_name": "string (given names in UPPERCASE, English/Latin only; if there is no dedicated last-name field, put ALL names here)",
  "last_name": "string (surname in UPPERCASE, English/Latin only; empty string if not separately printed)",
  "date_of_birth": "ISO date YYYY-MM-DD",
  "passport_expiration_date": "ISO date YYYY-MM-DD",
  "sex": "male | female (lowercase; do not use M/F, do not translate)",
  "nationality_code": "3-letter ISO code, uppercase (BGD, SAU, IND, PAK, EGY, ...)",
  "country_code": "2-letter ISO code, uppercase (BD, SA, IN, PK, EG, ...)",
  "issuing_country": "country name in UPPERCASE English (BANGLADESH, SAUDI ARABIA, ...)",
  "confidence": "high | medium | low (your own honest self-rating of the extraction quality)"
}

Rules:
- The MRZ (2 lines at the bottom of the passport photo page) is usually the most reliable source -- prefer it when it disagrees with the visual page.
- Dates in the MRZ are YYMMDD; convert them to YYYY-MM-DD. For birth dates, if the 2-digit year is >= current YY, treat it as 19YY; otherwise 20YY. For expiration dates, always treat as 20YY.
- "SEX" field in the MRZ is M or F -- convert to "male" or "female".
- Do NOT return markdown or code fences. Return the JSON object and nothing else.`;

const EMPTY_RESULT = Object.freeze({
  passport_number: '',
  first_name: '',
  last_name: '',
  date_of_birth: '',
  passport_expiration_date: '',
  sex: '',
  nationality_code: '',
  country_code: '',
  issuing_country: '',
  confidence: 'low',
  raw: '',
});

let genAiClient = null;
function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY is not configured on the backend.');
    err.statusCode = 502;
    throw err;
  }
  if (!genAiClient) genAiClient = new GoogleGenAI({ apiKey });
  return genAiClient;
}

function parseJsonBlock(text) {
  if (!text) return null;
  let stripped = text.trim();
  if (stripped.startsWith('```')) {
    stripped = stripped.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  try {
    return JSON.parse(stripped);
  } catch {
    // fall through to brace extraction
  }
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function coerce(data) {
  const s = (key, upper = false) => {
    const v = data?.[key];
    if (v === null || v === undefined) return '';
    const out = String(v).trim();
    return upper ? out.toUpperCase() : out;
  };
  const out = {
    passport_number: s('passport_number', true).replace(/\s+/g, ''),
    first_name: s('first_name', true),
    last_name: s('last_name', true),
    date_of_birth: s('date_of_birth'),
    passport_expiration_date: s('passport_expiration_date'),
    sex: s('sex').toLowerCase(),
    nationality_code: s('nationality_code', true),
    country_code: s('country_code', true),
    issuing_country: s('issuing_country', true),
    confidence: s('confidence').toLowerCase() || 'low',
  };
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDate.test(out.date_of_birth)) out.date_of_birth = '';
  if (!isoDate.test(out.passport_expiration_date)) out.passport_expiration_date = '';
  if (out.sex !== 'male' && out.sex !== 'female') out.sex = '';
  if (!['high', 'medium', 'low'].includes(out.confidence)) out.confidence = 'low';
  return out;
}

router.post('/passport-scan', upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      const err = new Error('No file uploaded. Send the passport image under the "file" field.');
      err.statusCode = 400;
      throw err;
    }
    const mime = (file.mimetype || '').toLowerCase();
    if (!ACCEPTED_MIME.has(mime)) {
      const err = new Error(`Unsupported file type '${mime}'. Please upload a JPEG, PNG or WEBP passport photo.`);
      err.statusCode = 415;
      throw err;
    }

    const client = getClient();
    const base64Data = file.buffer.toString('base64');

    let response;
    try {
      response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { data: base64Data, mimeType: mime } },
              { text: 'Extract the passport fields from this image and return the JSON object only.' },
            ],
          },
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0,
        },
      });
    } catch (geminiErr) {
      const err = new Error('Passport auto-fill service is temporarily unavailable. Please enter your details manually.');
      err.statusCode = 502;
      err.details = geminiErr?.message;
      throw err;
    }

    const rawText = response?.text || '';
    const parsed = parseJsonBlock(rawText);
    const data = parsed ? coerce(parsed) : { ...EMPTY_RESULT };
    data.raw = rawText.slice(0, 4000);

    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
});

// Multer errors (e.g. file too large) don't carry statusCode by default.
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(statusCode).json({ message: err.message });
  }
  next(err);
});

export { router as passportRouter };
