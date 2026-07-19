import test from 'node:test';
import assert from 'node:assert/strict';
import { coercePassportData } from '../src/routes/passport.js';

test('coerces a separately printed national ID and portrait bounds', () => {
  const result = coercePassportData({
    passport_number: ' a 123 ',
    national_id: ' 1987 654 321 ',
    portrait_box: [101.2, 52.7, 680.8, 399.4],
    confidence: 'HIGH',
  });

  assert.equal(result.passport_number, 'A123');
  assert.equal(result.national_id, '1987654321');
  assert.deepEqual(result.portrait_box, [101, 53, 681, 399]);
  assert.equal(result.confidence, 'high');
});

test('rejects invalid portrait bounds without inventing a national ID', () => {
  const result = coercePassportData({
    passport_number: 'AB123',
    portrait_box: [100, 100, 110, 110],
  });

  assert.equal(result.national_id, '');
  assert.deepEqual(result.portrait_box, []);
});
