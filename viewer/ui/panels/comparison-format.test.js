import assert from 'node:assert/strict';
import test from 'node:test';
import { overlapArea, overlapShare } from './comparison-format.js';

test('positive overlaps below display precision never appear as zero', () => {
  assert.equal(overlapArea(0.0003), '<0.1\u2009mm²');
  assert.equal(overlapShare(0.000001), '<0.1%');
  assert.equal(overlapShare(0.000001, 'fr'), '<0,1\u202f%');
  assert.equal(overlapArea(0.08), '<0.1\u2009mm²');
  assert.equal(overlapShare(0.0008), '<0.1%');
});

test('zero and finite shares retain locale notation and one decimal', () => {
  assert.equal(overlapArea(0), '0.0\u2009mm²');
  assert.equal(overlapArea(25.36, 'fr'), '25,4\u2009mm²');
  assert.equal(overlapShare(0.1536), '15.4%');
  assert.equal(overlapShare(0.1536, 'fr'), '15,4\u202f%');
  assert.equal(overlapShare(0), '0.0%');
});
