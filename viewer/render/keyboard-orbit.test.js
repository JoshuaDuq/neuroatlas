import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import {
  DOLLY_KEYS,
  ORBIT_KEYS,
  ORBIT_STEP,
  dolliedPosition,
  orbitedPosition,
} from './keyboard-orbit.js';

const target = new Vector3(0, 0, 0);
const up = new Vector3(0, 1, 0);
const at = (x, y, z) => new Vector3(x, y, z);

test('an orbit step keeps the camera the same distance from what it looks at', () => {
  const start = at(0, 0, 0.2);
  for (const key of Object.keys(ORBIT_KEYS)) {
    const moved = orbitedPosition(start, target, up, ORBIT_KEYS[key]);
    assert.ok(Math.abs(moved.distanceTo(target) - 0.2) < 1e-9, key);
  }
});

test('left and right turn opposite ways, and by the declared step', () => {
  const start = at(0, 0, 0.2);
  const left = orbitedPosition(start, target, up, ORBIT_KEYS.ArrowLeft);
  const right = orbitedPosition(start, target, up, ORBIT_KEYS.ArrowRight);
  // Dragging right swings the camera toward the subject's left, so the right
  // arrow does too; what matters is that the two land on opposite sides.
  assert.ok(Math.sign(left.x) === -Math.sign(right.x), 'the arrows move apart');
  assert.ok(Math.abs(left.x) > 1e-6, 'and actually move');
  for (const moved of [left, right]) {
    const swept = moved.clone().sub(target).angleTo(start.clone().sub(target));
    assert.ok(Math.abs(swept - ORBIT_STEP) < 1e-9);
  }
});

test('four right turns are one left turn, back where it started', () => {
  const start = at(0, 0, 0.2);
  let here = start;
  for (let i = 0; i < 4; i++) here = orbitedPosition(here, target, up, ORBIT_KEYS.ArrowRight);
  const back = orbitedPosition(here, target, up, { azimuth: 4 * ORBIT_STEP });
  assert.ok(back.distanceTo(start) < 1e-9);
});

test('the model follows the arrow, the way it follows a drag', () => {
  // One rule covers both inputs: the anatomy turns the way the arrow points,
  // which is what dragging already does. Pressing up tips the model up and
  // brings its underside into view, exactly as dragging up does.
  const start = at(0, 0, 0.2);
  assert.ok(orbitedPosition(start, target, up, ORBIT_KEYS.ArrowUp).y < 0);
  assert.ok(orbitedPosition(start, target, up, ORBIT_KEYS.ArrowDown).y > 0);
});

test('the horizon never flips, however long an arrow is held', () => {
  // Crossing a pole turns the anatomy upside down, and a reader who got there
  // by feel cannot tell which press undoes it.
  let here = at(0, 0, 0.2);
  for (let i = 0; i < 200; i++) here = orbitedPosition(here, target, up, ORBIT_KEYS.ArrowUp);
  assert.ok(here.y < 0 && Math.abs(here.distanceTo(target) - 0.2) < 1e-9);
  let down = at(0, 0, 0.2);
  for (let i = 0; i < 200; i++) down = orbitedPosition(down, target, up, ORBIT_KEYS.ArrowDown);
  assert.ok(down.y > 0 && Math.abs(down.distanceTo(target) - 0.2) < 1e-9);
});

test('a view looking straight down still orbits around its own up axis', () => {
  // Superior and inferior views set `up` off the Y axis; a Y-up-only rotation
  // would send the camera somewhere unrelated to the arrow pressed.
  const start = at(0, 0.2, 0);
  const superiorUp = new Vector3(0, 0, -1);
  const moved = orbitedPosition(start, target, superiorUp, ORBIT_KEYS.ArrowLeft);
  assert.ok(Math.abs(moved.distanceTo(target) - 0.2) < 1e-9);
  assert.ok(moved.distanceTo(start) > 1e-6, 'the camera actually moved');
});

test('zoom steps in and out proportionally and returns exactly', () => {
  const start = at(0, 0, 0.2);
  const closer = dolliedPosition(start, target, DOLLY_KEYS['+']);
  const further = dolliedPosition(start, target, DOLLY_KEYS['-']);
  assert.ok(closer.distanceTo(target) < 0.2);
  assert.ok(further.distanceTo(target) > 0.2);
  const back = dolliedPosition(closer, target, DOLLY_KEYS['-']);
  assert.ok(Math.abs(back.distanceTo(target) - 0.2) < 1e-9);
  assert.equal(DOLLY_KEYS['='], DOLLY_KEYS['+'], 'the unshifted key zooms in too');
});

test('zoom respects the limits the orbit already enforces', () => {
  const start = at(0, 0, 0.2);
  let near = start;
  for (let i = 0; i < 100; i++) {
    near = dolliedPosition(near, target, DOLLY_KEYS['+'], { min: 0.05, max: 1 });
  }
  assert.ok(Math.abs(near.distanceTo(target) - 0.05) < 1e-9);
  let far = start;
  for (let i = 0; i < 100; i++) {
    far = dolliedPosition(far, target, DOLLY_KEYS['-'], { min: 0.05, max: 1 });
  }
  assert.ok(Math.abs(far.distanceTo(target) - 1) < 1e-9);
});

test('a camera sitting on its own target is left alone rather than made NaN', () => {
  const start = at(0, 0, 0);
  assert.ok(orbitedPosition(start, target, up, ORBIT_KEYS.ArrowLeft).equals(start));
  assert.ok(dolliedPosition(start, target, DOLLY_KEYS['+']).equals(start));
});

test('every arrow and zoom key is bound, and nothing else is', () => {
  assert.deepEqual(Object.keys(ORBIT_KEYS).sort(),
    ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp']);
  assert.deepEqual(Object.keys(DOLLY_KEYS).sort(), ['+', '-', '=']);
});
