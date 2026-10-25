import assert from 'node:assert/strict';
import { test } from 'vitest';
import { DiffusionInputError } from '../../core/diffusion/validation.ts';
import { streamlineLengths, summarizeLengths } from './streamlines.ts';

test('measures actual polyline length rather than distance between endpoints', () => {
  const points = new Float32Array([0, 0, 0, 3, 4, 0, 3, 4, 12, 0, 0, 0, 1, 1, 1]);
  const lengths = streamlineLengths(points, new Uint32Array([0, 3, 5]));
  assert.equal(lengths[0], 17);
  assert.equal(lengths[1], Math.sqrt(3));
  const summary = summarizeLengths(lengths, 2);
  assert.equal(summary.total, 2);
  assert.equal(summary.shown, 1);
  assert.equal(summary.mean, 17);
  assert.equal(summary.min, 17);
  assert.equal(summary.max, 17);
  assert.deepEqual(summarizeLengths(lengths, 20), {
    total: 2,
    shown: 0,
    mean: null,
    min: null,
    max: null,
  });
});

test('rejects malformed or nonfinite streamlines and invalid filter thresholds', () => {
  const points = new Float32Array([0, 0, 0, 1, 1, 1]);
  for (const offsets of [[1, 2], [0, 1, 2], [0, 3], [0], [0, 2, 1]]) {
    assert.throws(() => streamlineLengths(points, new Uint32Array(offsets)), DiffusionInputError);
  }
  assert.throws(
    () => streamlineLengths(new Float32Array([0, 0, NaN, 1, 1, 1]), new Uint32Array([0, 2])),
    /finite/,
  );
  assert.throws(
    () => streamlineLengths(new Float32Array([1, 1, 1, 1, 1, 1]), new Uint32Array([0, 2])),
    /nonzero/,
  );
  assert.throws(() => summarizeLengths(new Float64Array([1]), -1), /length/);
});
