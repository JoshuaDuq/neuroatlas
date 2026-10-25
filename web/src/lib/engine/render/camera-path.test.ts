import assert from 'node:assert/strict';
import { test } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VIEW_DIRECTIONS, upFor } from './camera-views.ts';
import { orbitPath } from './camera-path.ts';
import type { ViewName } from '../../types/index.ts';

const target = new Vector3(0.002, -0.011, 0.004);
const DISTANCE = 0.42;

/** A camera and its controls settled on a named view, as scene.moveTo leaves them. */
function settledOn(view: ViewName) {
  const camera = new PerspectiveCamera(35, 1.4, 0.001, 10);
  const controls = new OrbitControls(camera);
  camera.up.copy(upFor(view));
  camera.position.copy(target).addScaledVector(VIEW_DIRECTIONS[view], DISTANCE);
  controls.target.copy(target);
  controls.update();
  return { camera, controls };
}

const destination = (view: ViewName) => ({
  position: target.clone().addScaledVector(VIEW_DIRECTIONS[view], DISTANCE),
  target: target.clone(),
  up: upFor(view),
});

const drawn = ({ camera, controls }: { camera: PerspectiveCamera; controls: OrbitControls }) => ({
  quaternion: camera.quaternion,
  position: camera.position,
  target: controls.target,
});

test('an animated move ends on the very pose an immediate one gives, bit for bit', () => {
  for (const [from, to] of [
    ['left', 'right'],
    ['anterior', 'superior'],
    ['oblique', 'inferior'],
    ['posterior', 'left'],
  ] as const) {
    const immediate = settledOn(from);
    const plan = destination(to);
    immediate.camera.up.copy(plan.up);
    immediate.camera.position.copy(plan.position);
    immediate.controls.target.copy(plan.target);
    immediate.controls.update();

    const animated = settledOn(from);
    const pose = orbitPath(drawn(animated), plan)(1);
    animated.camera.position.copy(pose.position);
    animated.controls.target.copy(pose.target);
    animated.camera.up.copy(pose.up);
    animated.controls.update();

    for (const key of ['position', 'quaternion', 'up'] as const) {
      assert.deepEqual(
        animated.camera[key].toArray(),
        immediate.camera[key].toArray(),
        `${from} → ${to}: ${key}`,
      );
    }
    assert.deepEqual(animated.controls.target.toArray(), immediate.controls.target.toArray());
  }
});

test('opposite views orbit round the anatomy at a constant distance, never through it', () => {
  const path = orbitPath(drawn(settledOn('left')), destination('right'));
  for (let step = 0; step <= 20; step += 1) {
    const pose = path(step / 20);
    assert.ok(
      Math.abs(pose.position.distanceTo(pose.target) - DISTANCE) < 1e-9,
      `distance at ${step / 20}`,
    );
    // Left to right turns about the superior axis: the eye stays level with the target.
    assert.ok(Math.abs(pose.position.y - target.y) < 1e-9, `height at ${step / 20}`);
  }
});

test('the roll turns with the orbit instead of jumping on the first frame', () => {
  const path = orbitPath(drawn(settledOn('anterior')), destination('superior'));
  const first = path(0.03);
  // Three per cent of the way, the frame is still almost upright, as the anterior view was.
  assert.ok(first.up.dot(new Vector3(0, 1, 0)) > 0.99);
  let previous = path(0).up;
  for (let step = 1; step <= 20; step += 1) {
    const up = path(step / 20).up;
    assert.ok(up.angleTo(previous) < Math.PI / 10, `continuous at ${step / 20}`);
    previous = up;
  }
});

test('a move that also travels interpolates the target and the distance', () => {
  const from = settledOn('oblique');
  const to = {
    position: new Vector3(0.1, 0, 0.3),
    target: new Vector3(0.1, 0, 0.2),
    up: new Vector3(0, 1, 0),
  };
  const path = orbitPath(drawn(from), to);
  // The scene moves this very camera along the path, which must not move the path's start.
  from.camera.position.set(1, 1, 1);
  from.controls.target.set(1, 1, 1);
  from.camera.quaternion.set(0, 0, 0, 1);
  const pose = path(0.5);
  assert.ok(pose.target.distanceTo(target.clone().lerp(to.target, 0.5)) < 1e-12);
  assert.ok(Math.abs(pose.position.distanceTo(pose.target) - (DISTANCE + 0.1) / 2) < 1e-9);
});

test('the path starts where the camera is drawn', () => {
  const from = settledOn('posterior');
  const pose = orbitPath(drawn(from), destination('anterior'))(0);
  assert.ok(pose.position.distanceTo(from.camera.position) < 1e-12);
  assert.ok(pose.quaternion.angleTo(from.camera.quaternion) < 1e-9);
});
