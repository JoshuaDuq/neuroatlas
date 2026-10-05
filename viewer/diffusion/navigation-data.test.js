import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceVoxelPoint, configureNavigationTract } from './navigation-data.js';

const header = {
  dims: [3, 256, 256, 150],
  affine: [[1, 0, 0, -120.5538330078125], [0, 1, 0, -104.4605712890625],
    [0, 0, 1, -28.359909057617188], [0, 0, 0, 1]],
};

test('MRI navigation uses zero-based source voxels and the published scanner RAS affine', () => {
  assert.deepEqual(sourceVoxelPoint([128, 104, 75], header),
    [7.4461669921875, -0.4605712890625, 46.64009094238281]);
  for (const voxel of [[256, 0, 0], [0, -1, 0], [0, 0, 150], [1.5, 0, 0], [NaN, 0, 0], [0, 0]]) {
    assert.throws(() => sourceVoxelPoint(voxel, header), /source voxel/);
  }
});

test('MRI tract navigation retains full-precision source lengths and deterministic lines', () => {
  const mesh = { pts: new Float32Array([0, 0, 0, 3, 4, 0, 3, 4, 12]),
    offsetPt0: new Uint32Array([0, 3]) };
  configureNavigationTract(mesh, 16);
  assert.ok(mesh.fiberLengths instanceof Float64Array);
  assert.equal(mesh.fiberLengths[0], 17);
  assert.equal(mesh.fiberLength, 16);
  assert.equal(mesh.fiberRadius, 0);
  assert.equal(mesh.fiberDither, 0);
  assert.equal(mesh.fiberDecimationStride, 1);
  assert.equal(mesh.fiberColor, 'Local');
  assert.throws(() => configureNavigationTract(mesh, -1), /length/);
});
