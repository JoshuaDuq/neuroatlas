import assert from 'node:assert/strict';
import { test } from 'vitest';
import { overlapArea, overlapShare } from './comparison-format.ts';
import { withUnit } from './format.ts';
import { t } from './i18n/index.ts';

test('positive overlaps below display precision never appear as zero', () => {
  assert.equal(overlapArea(0.0003), '<0.1');
  assert.equal(overlapShare(0.000001), '<0.1');
  assert.equal(overlapShare(0.000001, 'fr'), '<0,1');
  assert.equal(overlapArea(0.08), '<0.1');
  assert.equal(overlapShare(0.0008), '<0.1');
});

test('0.1 is the first figure shown as itself', () => {
  assert.equal(overlapArea(0.1), '0.1');
  assert.equal(overlapShare(0.001), '0.1');
});

test('zero and finite shares retain locale notation and one decimal, without units', () => {
  assert.equal(overlapArea(0), '0.0');
  assert.equal(overlapArea(25.36, 'fr'), '25,4');
  assert.equal(overlapShare(0.1536), '15.4');
  assert.equal(overlapShare(0.1536, 'fr'), '15,4');
  assert.equal(overlapShare(0), '0.0');
});

test('comparison row names include the visible area and share with localized units', () => {
  for (const [lang, expected] of [
    ['en', 'Highlight overlap with Area 44, 25.4 mm², 15.4% of this region'],
    ['fr', 'Tracer le recouvrement avec Area 44, 25,4 mm², 15,4 % de cette région'],
  ] as const) {
    const area = withUnit(overlapArea(25.36, lang), 'mm²', lang);
    const share = withUnit(overlapShare(0.1536, lang), '%', lang);
    assert.equal(t(lang, 'comparison').highlight('Area 44', area, share), expected);
  }
});

test('INSP-27: edge figures round to one decimal and only a positive part below 0.1 is "<0.1"', () => {
  for (const [area, expected] of [
    [-0, '0.0'],
    [0.05, '<0.1'],
    [0.0500001, '<0.1'],
    [0.0999999, '<0.1'],
    [Number.MIN_VALUE, '<0.1'],
    [0.95, '0.9'],
    [1, '1.0'],
    [99.95, '100.0'],
    [100, '100.0'],
    [-1, '−1.0'],
  ] as const) {
    assert.equal(overlapArea(area), expected, `area ${area}`);
  }
  assert.equal(overlapShare(Number.MIN_VALUE / 100), '0.0');
});
