import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { CutMode } from '../../types/index.ts';
import {
  centeredFrame,
  clippingPlane,
  createFrame,
  offsetThrough,
  pointOnFrame,
  rasToWorld,
  worldToRas,
  worldToVoxelMatrix,
} from './coordinates.ts';
import { Vector3 } from 'three';

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);

test('source RAS millimeters round trip and preserve right/anterior/superior', () => {
  const world = rasToWorld([21, 37, 49]);
  assert.deepEqual(world.toArray(), [0.021, 0.049, -0.037]);
  assert.deepEqual(worldToRas(world), [21, 37, 49]);
});

test('a cut through a point uses that axis and stays inside the volume', () => {
  const range = [-128, 128] as const;
  assert.equal(offsetThrough([30, -10, 20], { x: 1, y: 0, z: 0 }, range), 30);
  assert.equal(offsetThrough([30, -10, 20], { x: 0, y: 1, z: 0 }, range), -10);
  assert.equal(offsetThrough([200, 0, 0], { x: 1, y: 0, z: 0 }, range), 128);
  assert.equal(offsetThrough([-200, 0, 0], { x: 1, y: 0, z: 0 }, range), -128);
});

test('standard sections pass through requested RAS point with correct normal', () => {
  for (const [mode, normal] of [
    ['sagittal', [1, 0, 0]],
    ['coronal', [0, 1, 0]],
    ['axial', [0, 0, 1]],
  ] as const) {
    const frame = createFrame(mode, [12, 23, 34]);
    assert.deepEqual(frame.normal.toArray(), normal);
    assert.deepEqual(frame.center.toArray(), [12, 23, 34]);
    close(frame.u.dot(frame.v), 0);
    close(frame.normal.dot(frame.u), 0);
    const plane = clippingPlane(frame, false);
    close(plane.distanceToPoint(rasToWorld([12, 23, 34])), 0);
    const removed = frame.center.clone().add(frame.normal).toArray();
    assert.ok(plane.distanceToPoint(rasToWorld(removed)) < 0);
    assert.ok(clippingPlane(frame, true).distanceToPoint(rasToWorld(removed)) > 0);
  }
});

test('oblique frame is orthonormal and remains anchored to the crosshair', () => {
  const frame = createFrame('oblique', [8, -12, 18], { tilt: 38, azimuth: 71 });
  for (const axis of [frame.u, frame.v, frame.normal]) close(axis.length(), 1);
  close(frame.u.dot(frame.v), 0);
  close(frame.v.dot(frame.normal), 0);
  close(frame.u.dot(frame.normal), 0);
  close(clippingPlane(frame, false).distanceToPoint(rasToWorld([8, -12, 18])), 0);
  assert.throws(() => createFrame('banana' as CutMode, [0, 0, 0]), /plane/i);
  assert.throws(() => createFrame('axial', [NaN, 0, 0]), /coordinate/i);
});

test('names inherited from Object are not section planes', () => {
  for (const name of ['constructor', 'toString', '__proto__']) {
    assert.throws(() => createFrame(name as CutMode, [0, 0, 0]), /plane/i, name);
  }
});

test('RENDER-39 standard frames have fixed in-plane axes and edge letters', () => {
  const at = [10, 20, 30] as const;
  const sagittal = createFrame('sagittal', at);
  assert.deepEqual(sagittal.u.toArray(), [0, -1, 0]);
  assert.deepEqual(sagittal.v.toArray(), [0, 0, 1]);
  assert.deepEqual(sagittal.edges, ['S', 'P', 'I', 'A']);
  const coronal = createFrame('coronal', at);
  assert.deepEqual(coronal.u.toArray(), [1, 0, 0]);
  assert.deepEqual(coronal.v.toArray(), [0, 0, 1]);
  assert.deepEqual(coronal.edges, ['S', 'R', 'I', 'L']);
  const axial = createFrame('axial', at);
  assert.deepEqual(axial.u.toArray(), [1, 0, 0]);
  assert.deepEqual(axial.v.toArray(), [0, 1, 0]);
  assert.deepEqual(axial.edges, ['A', 'R', 'P', 'L']);
});

test('RENDER-39 an oblique frame takes its normal from tilt and azimuth, with no edge letters', () => {
  const defaults = createFrame('oblique', [0, 0, 0]);
  assert.deepEqual(
    defaults.normal.toArray().map((value) => Number(value.toFixed(4))),
    [0.433, 0.25, 0.866],
  );
  assert.deepEqual(defaults.edges, []);
  // tilt 90 at azimuth 0 lies along +x, with u along +y and v = n x u along +z.
  const flat = createFrame('oblique', [0, 0, 0], { tilt: 90, azimuth: 0 });
  assert.ok(flat.normal.distanceTo(new Vector3(1, 0, 0)) < 1e-12);
  assert.ok(flat.u.distanceTo(new Vector3(0, 1, 0)) < 1e-12);
  assert.ok(flat.v.distanceTo(new Vector3(0, 0, 1)) < 1e-12);
});

test('RENDER-39 oblique angles outside tilt 0..90 and azimuth -180..180 are a RangeError', () => {
  for (const angles of [{ tilt: -1 }, { tilt: 91 }, { azimuth: 181 }, { azimuth: -181 }]) {
    assert.throws(
      () => createFrame('oblique', [0, 0, 0], angles),
      new RangeError('Oblique angles are out of range.'),
    );
  }
  createFrame('oblique', [0, 0, 0], { tilt: 90, azimuth: -180 });
});

test('RENDER-40 a fractional offset is kept exactly in the clipping plane', () => {
  const plane = clippingPlane(createFrame('coronal', [0, 0.5, 0]), false);
  assert.ok(Math.abs(plane.distanceToPoint(new Vector3(0, 0, -0.0005))) < 1e-12);
});

test('RENDER-41 a cut through a point refuses non-finite coordinates or ranges', () => {
  const message = 'A cut through a point needs finite coordinates and a finite range.';
  const x = { x: 1, y: 0, z: 0 };
  assert.throws(() => offsetThrough([Infinity, 0, 0], x, [-128, 128]), new Error(message));
  assert.throws(() => offsetThrough([0, 0, 0], x, [NaN, 128]), new Error(message));
  assert.throws(() => offsetThrough([0, 0, 0], x, [-128, NaN]), new Error(message));
});

test('RENDER-42 "off" and a two-value point do not make a frame', () => {
  assert.throws(() => createFrame('off', [0, 0, 0]), new Error('Unknown section plane: off'));
  assert.throws(
    () => createFrame('axial', [0, 0] as unknown as [number, number, number]),
    new Error('Slice coordinates must be three finite RAS values.'),
  );
});

test('RENDER-43 a canvas fraction maps to the centre plus the frame axes over the field of view', () => {
  const axial = createFrame('axial', [10, 20, 30]);
  assert.deepEqual(pointOnFrame(axial, 0, 0, 256), [-118, 148, 30]);
  assert.deepEqual(pointOnFrame(axial, 0.5, 0.5, 256), [10, 20, 30]);
});

test('RENDER-43 a centred frame moves the centre onto the normal line at the same offset', () => {
  assert.deepEqual(centeredFrame('axial', [10, 20, 30]).center.toArray(), [0, 0, 30]);
  assert.deepEqual(centeredFrame('sagittal', [10, 20, 30]).center.toArray(), [10, 0, 0]);
});

test('RENDER-43 the world-to-voxel matrix composes the inverse affine with world to RAS millimetres', () => {
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const world = new Vector3(0.021, 0.049, -0.037);
  const source = world.clone().applyMatrix4(worldToVoxelMatrix({ inverse: identity }));
  assert.ok(source.distanceTo(new Vector3(21, 37, 49)) < 1e-9);
  // An inverse that shifts x by +10 (column-major translation) shifts the voxel by 10.
  const shifted = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 0, 1];
  const moved = world.clone().applyMatrix4(worldToVoxelMatrix({ inverse: shifted }));
  assert.ok(moved.distanceTo(new Vector3(31, 37, 49)) < 1e-9);
});
