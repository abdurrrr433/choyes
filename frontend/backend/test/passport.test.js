import test from 'node:test';
import assert from 'node:assert/strict';
import { coercePassportData, detectImageMime } from '../src/routes/passport.js';

test('detects supported images from file bytes when browsers omit MIME metadata', () => {
  assert.equal(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, ...new Array(9).fill(0)])), 'image/jpeg');
  assert.equal(detectImageMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])), 'image/png');
  assert.equal(detectImageMime(Buffer.from('RIFF0000WEBP')), 'image/webp');
  assert.equal(detectImageMime(Buffer.from('%PDF-1.7 test')), '');
});

test('coerces passport fields and portrait bounds without returning National ID', () => {
  const result = coercePassportData({
    passport_number: ' a 123 ',
    national_id: 'must-not-be-returned',
    portrait_box: [101.2, 52.7, 680.8, 399.4],
    confidence: 'HIGH',
  });

  assert.equal(result.passport_number, 'A123');
  assert.equal(Object.hasOwn(result, 'national_id'), false);
  assert.deepEqual(result.portrait_box, [101, 53, 681, 399]);
  assert.equal(result.confidence, 'high');
});

test('rejects invalid portrait bounds and ignores non-passport IDs', () => {
  const result = coercePassportData({
    passport_number: 'AB123',
    portrait_box: [100, 100, 110, 110],
  });

  assert.equal(Object.hasOwn(result, 'national_id'), false);
  assert.deepEqual(result.portrait_box, []);
});
