/** R2 parity: the comparison figures against legacy `viewer/ui/panels/comparison-format.js`. */
import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  overlapArea as legacyArea,
  overlapShare as legacyShare,
} from '../../viewer/ui/panels/comparison-format.js';
import { overlapArea, overlapShare } from '../src/lib/core/comparison-format.ts';

const EDGES = [0, -0, 0.05, 0.0999999, 0.1, 0.0500001, 0.95, 1, 99.95, 100, -1, Number.MIN_VALUE];

test('area and share text match legacy over a sweep, edge values and a seeded random set', () => {
  let seed = 20260126;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 200;
  const values = [...EDGES, ...Array.from({ length: 2000 }, (_, i) => i * 0.001)];
  for (let i = 0; i < 2000; i++) values.push(random());
  for (const lang of ['en', 'fr'] as const) {
    for (const value of values) {
      assert.equal(overlapArea(value, lang), legacyArea(value, lang), `area ${value} ${lang}`);
      assert.equal(
        overlapShare(value / 100, lang),
        legacyShare(value / 100, lang),
        `share ${value} ${lang}`,
      );
    }
  }
  assert.equal(overlapArea(12.34), legacyArea(12.34));
});
