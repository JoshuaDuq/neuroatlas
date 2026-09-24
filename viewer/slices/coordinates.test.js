import assert from 'node:assert/strict';
import test from 'node:test';
import { createFrame, offsetThrough, rasToWorld, worldToRas, clippingPlane } from './coordinates.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);

test('source RAS millimeters round trip and preserve right/anterior/superior', () => {
  const world = rasToWorld([21, 37, 49]);
  assert.deepEqual(world.toArray(), [.021, .049, -.037]);
  assert.deepEqual(worldToRas(world), [21, 37, 49]);
});

test('a cut through a point uses that axis and stays inside the volume', () => {
  const range = [-128, 128];
  assert.equal(offsetThrough([30, -10, 20], { x: 1, y: 0, z: 0 }, range), 30);
  assert.equal(offsetThrough([30, -10, 20], { x: 0, y: 1, z: 0 }, range), -10);
  assert.equal(offsetThrough([200, 0, 0], { x: 1, y: 0, z: 0 }, range), 128);
  assert.equal(offsetThrough([-200, 0, 0], { x: 1, y: 0, z: 0 }, range), -128);
});

test('standard sections pass through requested RAS point with correct normal', () => {
  for (const [mode, normal] of [['sagittal', [1,0,0]], ['coronal', [0,1,0]], ['axial', [0,0,1]]]) {
    const frame = createFrame(mode, [12, 23, 34]);
    assert.deepEqual(frame.normal.toArray(), normal);
    assert.deepEqual(frame.center.toArray(), [12,23,34]);
    close(frame.u.dot(frame.v), 0);
    close(frame.normal.dot(frame.u), 0);
    const plane = clippingPlane(frame, false);
    close(plane.distanceToPoint(rasToWorld([12,23,34])), 0);
    const removed = frame.center.clone().add(frame.normal).toArray();
    assert.ok(plane.distanceToPoint(rasToWorld(removed)) < 0);
    assert.ok(clippingPlane(frame, true).distanceToPoint(rasToWorld(removed)) > 0);
  }
});

test('oblique frame is orthonormal and remains anchored to the crosshair', () => {
  const frame = createFrame('oblique', [8,-12,18], { tilt: 38, azimuth: 71 });
  for (const axis of [frame.u, frame.v, frame.normal]) close(axis.length(), 1);
  close(frame.u.dot(frame.v), 0);
  close(frame.v.dot(frame.normal), 0);
  close(frame.u.dot(frame.normal), 0);
  close(clippingPlane(frame, false).distanceToPoint(rasToWorld([8,-12,18])), 0);
  assert.throws(() => createFrame('banana', [0,0,0]), /plane/i);
  assert.throws(() => createFrame('axial', [NaN,0,0]), /coordinate/i);
});
