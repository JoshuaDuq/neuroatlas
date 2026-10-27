import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  configureNavigationTract,
  scannerVoxel,
  sourceVoxelPoint,
  type NavigationTract,
} from './navigation-data.ts';

const header = {
  dims: [3, 256, 256, 150],
  affine: [
    [1, 0, 0, -120.5538330078125],
    [0, 1, 0, -104.4605712890625],
    [0, 0, 1, -28.359909057617188],
    [0, 0, 0, 1],
  ],
};

test('MRI navigation uses zero-based source voxels and the published scanner RAS affine', () => {
  assert.deepEqual(
    sourceVoxelPoint([128, 104, 75], header),
    [7.4461669921875, -0.4605712890625, 46.64009094238281],
  );
  for (const voxel of [
    [256, 0, 0],
    [0, -1, 0],
    [0, 0, 150],
    [1.5, 0, 0],
    [NaN, 0, 0],
    [0, 0],
  ]) {
    assert.throws(() => sourceVoxelPoint(voxel, header), /source voxel/);
  }
});

test('an atlas point maps to its nearest source voxel, and a point beyond the cropped scan to none', () => {
  assert.deepEqual(
    scannerVoxel([7.4461669921875, -0.4605712890625, 46.64009094238281], header),
    [128, 104, 75],
  );
  assert.deepEqual(scannerVoxel([7.9, -0.9, 46.2], header), [128, 104, 75]);
  assert.deepEqual(scannerVoxel(sourceVoxelPoint([255, 0, 149], header), header), [255, 0, 149]);
  assert.equal(scannerVoxel([7.4, -0.5, -30], header), null);
  assert.equal(scannerVoxel([7.4, -0.5, 121.2], header), null);
  assert.throws(() => scannerVoxel([0, NaN, 0], header), /finite/);
});

test('MRI tract navigation retains full-precision source lengths and deterministic lines', () => {
  const mesh = {
    pts: new Float32Array([0, 0, 0, 3, 4, 0, 3, 4, 12]),
    offsetPt0: new Uint32Array([0, 3]),
  } as NavigationTract;
  configureNavigationTract(mesh, 16);
  assert.ok(mesh.fiberLengths instanceof Float64Array);
  assert.equal(mesh.fiberLengths[0], 17);
  assert.equal(mesh.fiberLength, 16);
  assert.equal(mesh.fiberRadius, 0);
  assert.equal(mesh.fiberDither, 0);
  assert.equal(mesh.fiberDecimationStride, 1);
  assert.equal(mesh.fiberColor, 'Local');
  assert.throws(() => configureNavigationTract(mesh, -1), /length/);
  assert.throws(() => configureNavigationTract(mesh, 0), /at least 1 mm/);
});

test('DIFF-29 a point half a voxel from a voxel centre rounds up', () => {
  const origin = header.affine.map((row) => row[3]!);
  const voxelX = (offset: number) =>
    scannerVoxel([origin[0]! + offset, origin[1]!, origin[2]!], header)![0]! + 0;
  assert.deepEqual([-0.5, -0.49, 0.49, 0.5, 0.51].map(voxelX), [0, 0, 0, 1, 1]);
  for (const point of [
    [Infinity, 0, 0],
    [0, 0],
  ]) {
    assert.throws(() => scannerVoxel(point, header), /three finite RAS values/);
  }
});

test('DIFF-28 a voxel and its scanner point are inverse on an oblique grid, for 500 seeded voxels', () => {
  const oblique = {
    dims: [3, 40, 50, 60],
    affine: [
      [0.8, 0.1, -0.2, -30.5],
      [-0.1, 0.9, 0.05, -40.25],
      [0.2, 0, 1.1, -20],
      [0, 0, 0, 1],
    ],
  };
  let state = 0xe6;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let trial = 0; trial < 500; trial++) {
    const voxel = [random() * 40, random() * 50, random() * 60].map(Math.floor);
    const found = scannerVoxel(sourceVoxelPoint(voxel, oblique), oblique)!.map(
      (value) => value + 0,
    );
    assert.deepEqual(found, voxel);
  }
});
