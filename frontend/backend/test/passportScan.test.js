import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { detectImageMime, normalizePassportData } from '../src/routes/passportScan.js';
import { passportScanRouter } from '../src/routes/passportScan.js';

test('detectImageMime validates bytes rather than browser metadata', () => {
  assert.equal(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, ...new Array(9).fill(0)])), 'image/jpeg');
  assert.equal(detectImageMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])), 'image/png');
  assert.equal(detectImageMime(Buffer.from('RIFF0000WEBP')), 'image/webp');
  assert.equal(detectImageMime(Buffer.from('%PDF-1.7 passport')), '');
});

test('normalizePassportData sanitizes OCR fields and invalid dates', () => {
  assert.deepEqual(normalizePassportData({
    passport_number: ' ab 123 ', first_name: 'Jane', last_name: 'Doe',
    date_of_birth: '1991-02-29', passport_expiration_date: '2032-03-04',
    sex: 'F', nationality_code: 'bgd', country_code: 'bd',
    issuing_country: 'Bangladesh', confidence: 'HIGH',
  }), {
    passport_number: 'AB123', first_name: 'JANE', last_name: 'DOE',
    date_of_birth: '', passport_expiration_date: '2032-03-04', sex: '',
    nationality_code: 'BGD', country_code: 'BD', issuing_country: 'BANGLADESH',
    confidence: 'high',
  });
});

test('upload route returns a useful configuration error when the server key is missing', async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const app = express();
  app.use('/api/passport-scan', passportScanRouter);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0);
  try {
    const address = server.address();
    const form = new FormData();
    form.append('file', new Blob([Uint8Array.from([0xff, 0xd8, 0xff, ...new Array(9).fill(0)])]), 'passport.jpg');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/passport-scan`, { method: 'POST', body: form });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { message: 'Passport auto-fill is not configured on the server' });
  } finally {
    server.close();
    if (previousKey) process.env.GEMINI_API_KEY = previousKey;
  }
});
