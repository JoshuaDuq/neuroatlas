import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DOLLY_KEYS, ORBIT_KEYS, ORBIT_STEP, turnFromKeyboard } from './keyboard-orbit.js';
import { followCameraUp } from './orbit-controls.js';

const target = new Vector3(0, 0, 0);

/** Damped controls, as the scene builds them, with the camera at `position` and `up`. */
function controlsAt(position, up = new Vector3(0, 1, 0)) {
  const camera = new PerspectiveCamera(35, 1.4, 0.001, 10);
  const controls = new OrbitControls(camera);
  controls.enableDamping = true;
  followCameraUp(controls);
  camera.up.copy(up);
  camera.position.copy(position);
  controls.target.copy(target);
  controls.update();
  return { camera, controls };
}

const press = (key, position, up) => {
  const { camera, controls } = controlsAt(position, up);
  turnFromKeyboard(controls, ORBIT_KEYS[key]);
  return { position: camera.position.clone(), controls };
};

test('an orbit step keeps the camera the same distance from what it looks at', () => {
  for (const key of Object.keys(ORBIT_KEYS)) {
    const { position } = press(key, new Vector3(0, 0, 0.2));
    assert.ok(Math.abs(position.distanceTo(target) - 0.2) < 1e-9, key);
  }
});

test('a press lands at once, by the whole declared step, and leaves the damping on', () => {
  const start = new Vector3(0, 0, 0.2);
  for (const key of Object.keys(ORBIT_KEYS)) {
    const { position, controls } = press(key, start);
    const swept = position.clone().sub(target).angleTo(start.clone().sub(target));
    assert.ok(Math.abs(swept - ORBIT_STEP) < 1e-9, key);
    assert.equal(controls.enableDamping, true);
  }
});

test('left and right turn opposite ways', () => {
  const start = new Vector3(0, 0, 0.2);
  const left = press('ArrowLeft', start).position;
  const right = press('ArrowRight', start).position;
  assert.ok(Math.sign(left.x) === -Math.sign(right.x) && Math.abs(left.x) > 1e-6);
});

test('the model follows the arrow, the way it follows a drag', () => {
  // Pressing up tips the model up and brings its underside into view, exactly as dragging up
  // does: OrbitControls turns a drag up into a negative rotateUp.
  const start = new Vector3(0, 0, 0.2);
  const dragged = controlsAt(start);
  dragged.controls.enableDamping = false;
  dragged.controls.rotateUp(-ORBIT_STEP);
  assert.ok(press('ArrowUp', start).position.distanceTo(dragged.camera.position) < 1e-12);
  assert.ok(press('ArrowUp', start).position.y < 0);
  assert.ok(press('ArrowDown', start).position.y > 0);
});

test('the horizon never flips, however long an arrow is held', () => {
  // Crossing a pole turns the anatomy upside down, and a reader who got there
  // by feel cannot tell which press undoes it.
  for (const [key, side] of [['ArrowUp', -1], ['ArrowDown', 1]]) {
    const { camera, controls } = controlsAt(new Vector3(0, 0, 0.2));
    for (let i = 0; i < 200; i++) turnFromKeyboard(controls, ORBIT_KEYS[key]);
    assert.ok(Math.sign(camera.position.y) === side, key);
    assert.ok(Math.abs(camera.position.distanceTo(target) - 0.2) < 1e-9, key);
  }
});

test('a view looking straight down still orbits around its own up axis', () => {
  // Superior and inferior views set `up` off the Y axis; a Y-up-only rotation
  // would leave the camera stuck on the pole.
  const { position } = press('ArrowLeft', new Vector3(0, 0.2, 0), new Vector3(0, 0, -1));
  assert.ok(Math.abs(position.distanceTo(target) - 0.2) < 1e-9);
  assert.ok(position.distanceTo(new Vector3(0, 0.2, 0)) > 0.01, 'the camera actually moved');
});

test('every arrow and zoom key is bound, and nothing else is', () => {
  assert.deepEqual(Object.keys(ORBIT_KEYS).sort(),
    ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp']);
  assert.deepEqual(Object.keys(DOLLY_KEYS).sort(), ['+', '-', '=']);
});
