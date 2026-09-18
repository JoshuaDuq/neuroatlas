import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { VIEW_DIRECTIONS, cameraConstraints, fitDistance, frameBounds, upFor } from './camera-views.js';

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

test('elongated bounds permit close approach based on cross-section', () => {
  const cord = new Box3(new Vector3(-0.006, -0.5, 0.02), new Vector3(0.006, 0, 0.04));
  const { minDistance, near, far } = cameraConstraints(cord);
  assert.ok(minDistance < 0.015, 'the camera must approach within 15 mm of the cord');
  assert.ok(near < minDistance, 'near clipping plane sits ahead of the minimum distance');
  assert.equal(Math.round(far / near), 10000);
});

test('camera maxDistance allows zooming out to view the full central nervous system', () => {
  const { maxDistance } = cameraConstraints(brain);
  assert.ok(maxDistance >= 2.0, 'maxDistance must provide zoom-out headroom for the full CNS');
});

test('framing spinal cord maintains scale-invariant precision and proper approach limits', () => {
  const cord = new Box3(new Vector3(-0.006, -0.72, -0.015), new Vector3(0.006, -0.047, 0.015));
  const constraints = cameraConstraints(cord);
  assert.ok(constraints.minDistance <= 0.015, 'allows close inspection of spinal tracts');
  assert.ok(constraints.maxDistance >= 2.0, 'allows zooming out to full view');
  assert.equal(Math.round(constraints.far / constraints.near), 10000, 'depth ratio is preserved');
});


test('fitting the silhouette never crops what fitting the box kept', () => {
  // The point fit is an optimisation, and the one thing it must not do is
  // pull the camera in past anatomy. Every point given to it lies inside the
  // box, so its distance can only be shorter.
  const camera = new PerspectiveCamera(50, 1.6, 0.01, 100);
  const bounds = new Box3(new Vector3(-0.06, -0.05, -0.09), new Vector3(0.06, 0.07, 0.09));
  const rng = (seed => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)(7);
  const points = [];
  const centre = bounds.getCenter(new Vector3());
  const half = bounds.getSize(new Vector3()).multiplyScalar(0.5);
  for (let i = 0; i < 4000; i++) {
    // An ellipsoid inscribed in the box: the shape a brain actually has, and
    // the shape whose corners the box invents.
    const u = rng() * 2 - 1, v = rng() * 2 - 1, w = rng() * 2 - 1;
    const length = Math.hypot(u, v, w) || 1;
    points.push(
      centre.x + half.x * u / length,
      centre.y + half.y * v / length,
      centre.z + half.z * w / length,
    );
  }
  const cloud = new Float32Array(points);
  for (const direction of Object.values(VIEW_DIRECTIONS)) {
    const box = fitDistance(camera, bounds, direction);
    const hull = fitDistance(camera, bounds, direction, {}, cloud);
    assert.ok(hull <= box + 1e-9, `silhouette fit exceeded the box fit on ${direction.toArray()}`);
    assert.ok(hull > 0);
  }
});

test('handed the box its own corners, the two fits agree', () => {
  const camera = new PerspectiveCamera(50, 1.6, 0.01, 100);
  const bounds = new Box3(new Vector3(-0.06, -0.05, -0.09), new Vector3(0.06, 0.07, 0.09));
  const corners = [];
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) corners.push(x, y, z);
    }
  }
  for (const direction of Object.values(VIEW_DIRECTIONS)) {
    const box = fitDistance(camera, bounds, direction);
    const points = fitDistance(camera, bounds, direction, {}, new Float32Array(corners));
    // Points arrive as float32, so they agree to that precision and no further.
    assert.ok(Math.abs(points - box) < box * 1e-6);
  }
});

test('an inscribed shape is framed closer than the box around it', () => {
  // What the change is for: the oblique view opens on a corner the anatomy
  // never reaches, and stands the camera off far enough to clear it.
  const camera = new PerspectiveCamera(50, 1.6, 0.01, 100);
  const bounds = new Box3(new Vector3(-0.06, -0.05, -0.09), new Vector3(0.06, 0.07, 0.09));
  const centre = bounds.getCenter(new Vector3());
  const half = bounds.getSize(new Vector3()).multiplyScalar(0.5);
  const points = [];
  for (let i = 0; i < 2000; i++) {
    const u = Math.cos(i) * Math.sin(i * 0.7);
    const v = Math.sin(i * 1.3);
    const w = Math.cos(i * 0.31);
    const length = Math.hypot(u, v, w) || 1;
    points.push(
      centre.x + half.x * u / length,
      centre.y + half.y * v / length,
      centre.z + half.z * w / length,
    );
  }
  const cloud = new Float32Array(points);
  const box = fitDistance(camera, bounds, VIEW_DIRECTIONS.oblique);
  const hull = fitDistance(camera, bounds, VIEW_DIRECTIONS.oblique, {}, cloud);
  assert.ok(hull < box * 0.95, `expected a closer fit, got ${hull} against ${box}`);
});
