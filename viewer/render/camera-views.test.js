import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { VIEW_DIRECTIONS, cameraConstraints, frameBounds, upFor } from './camera-views.js';

test('fits all anatomical bounds inside landscape and portrait viewports', () => {
  const bounds = new Box3(new Vector3(-0.08, -0.07, -0.1), new Vector3(0.08, 0.11, 0.1));
  for (const aspect of [1.7, 0.6]) {
    const camera = new PerspectiveCamera(35, aspect, 0.001, 10);
    const center = frameBounds(camera, bounds, new Vector3(-1, 0.3, -0.45).normalize());
    const [cx, cy, cz] = center.toArray();
    assert.ok(Math.abs(cx) < 1e-6 && Math.abs(cy - 0.02) < 1e-6 && Math.abs(cz) < 1e-6);
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          const projected = new Vector3(x, y, z).project(camera);
          assert.ok(Math.abs(projected.x) <= 0.93);
          assert.ok(Math.abs(projected.y) <= 0.93);
        }
      }
    }
  }
});


const brain = new Box3(new Vector3(-0.08, -0.07, -0.1), new Vector3(0.08, 0.11, 0.1));
const region = new Box3(new Vector3(-0.01, 0.02, -0.01), new Vector3(0.01, 0.04, 0.01));

test('every named view has a direction, and the polar views correct their up', () => {
  assert.deepEqual(Object.keys(VIEW_DIRECTIONS).sort(),
    ['anterior', 'inferior', 'left', 'oblique', 'posterior', 'right', 'superior']);
  assert.deepEqual(upFor('superior').toArray(), [0, 0, -1]);
  assert.deepEqual(upFor('inferior').toArray(), [0, 0, 1]);
  assert.deepEqual(upFor('left').toArray(), [0, 1, 0]);
});

test('camera constraints are derived from the bounds being framed', () => {
  const whole = cameraConstraints(brain);
  const part = cameraConstraints(region);
  assert.ok(part.near < whole.near, 'a small region must allow a nearer plane');
  assert.ok(part.minDistance < whole.minDistance, 'and a closer approach');
  assert.ok(part.far < whole.far, 'and must not keep the far plane of the whole brain');
});

test('the depth ratio is scale invariant, so precision never degrades', () => {
  for (const bounds of [brain, region]) {
    const { near, far } = cameraConstraints(bounds);
    assert.equal(Math.round(far / near), 10000);
  }
});

test('returning to the whole brain restores the constraints focusing changed', () => {
  // The bug this replaces: focusSelection set minDistance and near directly and
  // nothing ever put them back, so one Focus click degraded the whole session.
  const before = cameraConstraints(brain);
  cameraConstraints(region);
  assert.deepEqual(cameraConstraints(brain), before);
});
