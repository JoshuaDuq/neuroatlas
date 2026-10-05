import assert from 'node:assert/strict';
import test from 'node:test';
import { validateVolume } from './validation.js';
import { streamlineLengths, summarizeLengths } from './streamlines.js';

const volume = () => ({
  hdr: {
    dims: [3, 2, 2, 2, 1, 1, 1, 1],
    pixDims: [1, 1, 1, 1, 0, 0, 0, 0],
    datatypeCode: 16, xyzt_units: 2, sform_code: 1, qform_code: 0,
    affine: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]],
  },
  img: new Float32Array(8),
});

test('accepts spatially defined scalar maps and rejects raw diffusion acquisitions', () => {
  assert.doesNotThrow(() => validateVolume(volume()));
  const raw = volume();
  raw.hdr.dims[0] = 4;
  raw.hdr.dims[4] = 64;
  assert.throws(() => validateVolume(raw), /three-dimensional/);
  const vector = volume();
  vector.hdr.datatypeCode = 128;
  assert.throws(() => validateVolume(vector), /scalar/);
});

test('requires explicit usable spatial metadata rather than guessing coordinates', () => {
  for (const change of [
    hdr => { hdr.xyzt_units = 0; },
    hdr => { hdr.sform_code = 0; },
    hdr => { hdr.affine[0][0] = NaN; },
    hdr => { hdr.affine[0][0] = 0; },
    hdr => { hdr.pixDims[2] = 0; },
    hdr => { hdr.dims[2] = -1; },
  ]) {
    const invalid = volume();
    change(invalid.hdr);
    assert.throws(() => validateVolume(invalid));
  }
});

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
  assert.deepEqual(summarizeLengths(lengths, 20),
    { total: 2, shown: 0, mean: null, min: null, max: null });
});

test('rejects malformed or nonfinite streamlines and invalid filter thresholds', () => {
  const points = new Float32Array([0, 0, 0, 1, 1, 1]);
  for (const offsets of [[1, 2], [0, 1, 2], [0, 3], [0], [0, 2, 1]]) {
    assert.throws(() => streamlineLengths(points, new Uint32Array(offsets)));
  }
  assert.throws(() => streamlineLengths(new Float32Array([0, 0, NaN, 1, 1, 1]),
    new Uint32Array([0, 2])), /finite/);
  assert.throws(() => summarizeLengths(new Float64Array([1]), -1), /length/);
});
