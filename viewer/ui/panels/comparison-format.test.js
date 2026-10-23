import assert from 'node:assert/strict';
import test from 'node:test';
import { t } from '../../i18n/translations.js';
import { withUnit } from '../format.js';
import { overlapArea, overlapShare } from './comparison-format.js';

test('positive overlaps below display precision never appear as zero', () => {
  assert.equal(overlapArea(0.0003), '<0.1');
  assert.equal(overlapShare(0.000001), '<0.1');
  assert.equal(overlapShare(0.000001, 'fr'), '<0,1');
  assert.equal(overlapArea(0.08), '<0.1');
  assert.equal(overlapShare(0.0008), '<0.1');
});

test('zero and finite shares retain locale notation and one decimal, without units', () => {
  assert.equal(overlapArea(0), '0.0');
  assert.equal(overlapArea(25.36, 'fr'), '25,4');
  assert.equal(overlapShare(0.1536), '15.4');
  assert.equal(overlapShare(0.1536, 'fr'), '15,4');
  assert.equal(overlapShare(0), '0.0');
});

test('comparison row announcements include the visible area and share with localized units', () => {
  for (const [lang, expected] of [
    ['en', 'Highlight overlap with Area 44, 25.4\u202fmm², 15.4% of this region'],
    ['fr', 'Tracer le recouvrement avec Area 44, 25,4\u202fmm², 15,4\u202f% de cette région'],
  ]) {
    const area = withUnit(overlapArea(25.36, lang), 'mm²', lang);
    const share = withUnit(overlapShare(0.1536, lang), '%', lang);
    assert.equal(t(lang, 'comparison').highlight('Area 44', area, share), expected);
  }
});
