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

/** mulberry32: a seeded PRNG, so every run draws the same tracts. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded tractography: 1 to 40 lines of 2 to 40 points in [-120, 120] mm. */
function seededTract(random: () => number) {
  const offsets = [0];
  for (let line = 1 + Math.floor(random() * 40); line > 0; line--) {
    offsets.push(offsets.at(-1)! + 2 + Math.floor(random() * 39));
  }
  const points = new Float32Array(offsets.at(-1)! * 3).map(() => random() * 240 - 120);
  return { points, offsets: new Uint32Array(offsets) };
}

test('DIFF-01 on 25 seeded tracts every length is the sum of its segments, and the summary keeps those at or above the minimum', () => {
  const random = mulberry32(0xe6);
  for (let trial = 0; trial < 25; trial++) {
    const { points, offsets } = seededTract(random);
    const lengths = streamlineLengths(points, offsets);
    assert.equal(lengths.length, offsets.length - 1);
    for (let line = 0; line < lengths.length; line++) {
      let sum = 0;
      for (let point = offsets[line]!; point < offsets[line + 1]! - 1; point++) {
        sum += Math.sqrt(
          (points[point * 3 + 3]! - points[point * 3]!) ** 2 +
            (points[point * 3 + 4]! - points[point * 3 + 1]!) ** 2 +
            (points[point * 3 + 5]! - points[point * 3 + 2]!) ** 2,
        );
      }
      assert.ok(Math.abs(lengths[line]! - sum) < 1e-9, `line ${line}: ${lengths[line]} ≠ ${sum}`);
    }
    for (const minimum of [0, 1, 15, 25, 100, 500]) {
      const kept = Array.from(lengths).filter((length) => length >= minimum);
      const summary = summarizeLengths(lengths, minimum);
      assert.equal(summary.total, lengths.length);
      assert.equal(summary.shown, kept.length);
      assert.equal(summary.min, kept.length ? Math.min(...kept) : null);
      assert.equal(summary.max, kept.length ? Math.max(...kept) : null);
    }
  }
});

test('DIFF-02 a streamline file that is empty, has a partial triple or breaks the offsets is refused with the streamlines code', () => {
  const messages: [Float32Array, number[], RegExp][] = [
    [new Float32Array(), [0, 1], /Invalid streamline points or offsets/],
    [new Float32Array([0, 0, 0, 1]), [0, 2], /Invalid streamline points or offsets/],
    [new Float32Array([0, 0, 0, 1, 1, 1]), [1, 2], /Invalid streamline points or offsets/],
    [new Float32Array([0, 0, 0, 1, 1, 1]), [0, 3], /Invalid streamline points or offsets/],
    [new Float32Array([0, 0, 0, 1, 1, 1]), [0], /Invalid streamline points or offsets/],
    [
      new Float32Array([0, 0, 0, 1, 1, 1]),
      [0, 2, 1],
      /Invalid streamline points or offsets|at least two points/,
    ],
    [
      new Float32Array([0, 0, 0, 1, 1, 1]),
      [0, 1, 2],
      /Invalid streamline points or offsets|at least two points/,
    ],
    [new Float32Array([0, 0, NaN, 1, 1, 1]), [0, 2], /Streamline coordinates must be finite/],
    [new Float32Array([1, 1, 1, 1, 1, 1]), [0, 2], /nonzero length/],
  ];
  for (const [points, offsets, message] of messages) {
    assert.throws(
      () => streamlineLengths(points, new Uint32Array(offsets)),
      (error: unknown) =>
        error instanceof DiffusionInputError &&
        (error.code as string) === 'streamlines' &&
        message.test(error.message),
    );
  }
});

test('DIFF-03 a streamline exactly as long as the minimum is shown, and a minimum that is not a number or is negative is refused', () => {
  const lengths = new Float64Array([17, Math.sqrt(3)]);
  assert.equal(summarizeLengths(lengths, 17).shown, 1);
  assert.equal(summarizeLengths(lengths, 0).shown, 2);
  for (const minimum of [-1, NaN, Infinity]) {
    assert.throws(() => summarizeLengths(lengths, minimum), {
      name: 'RangeError',
      message: 'Invalid minimum length.',
    });
  }
});
