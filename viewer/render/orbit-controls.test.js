import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera, Plane, Sphere, Vector2, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VIEW_DIRECTIONS, upFor } from './camera-views.js';
import { followCameraUp, stayOutside, zoomAbout, zoomAboutSurface } from './orbit-controls.js';

const target = new Vector3(0.002, -0.011, 0.004);
const DISTANCE = 0.42;
const LIMITS = { minDistance: 0.025, maxDistance: 2.5 };

/** Controls settled on a named view, as scene.moveTo leaves them; `adapt` wraps them first. */
function settledOn(view, adapt = () => {}) {
  const camera = new PerspectiveCamera(35, 1.4, 0.001, 10);
  const controls = new OrbitControls(camera);
  Object.assign(controls, LIMITS);
  adapt(controls);
  camera.up.copy(upFor(view));
  camera.position.copy(target).addScaledVector(VIEW_DIRECTIONS[view], DISTANCE);
  controls.target.copy(target);
  controls.update();
  camera.updateMatrixWorld();
  return { camera, controls };
}

test('every drag turns the superior and inferior views, where the stock controls sat on a pole', () => {
  for (const view of ['superior', 'inferior']) {
    const stock = settledOn(view);
    const before = stock.camera.quaternion.clone();
    stock.controls.rotateLeft(0.3);
    assert.ok(stock.camera.quaternion.angleTo(before) < 1e-6, `${view}: a sideways drag did nothing`);

    for (const [turn, angle] of [['rotateLeft', 0.3], ['rotateLeft', -0.3], ['rotateUp', 0.3], ['rotateUp', -0.3]]) {
      const { camera, controls } = settledOn(view, followCameraUp);
      const start = camera.position.clone();
      controls[turn](angle);
      assert.ok(camera.position.distanceTo(start) > 0.1, `${view}: ${turn}(${angle}) moves the camera`);
      assert.ok(Math.abs(camera.position.distanceTo(target) - DISTANCE) < 1e-9, `${view}: ${turn} keeps the distance`);
    }
  }
});

test('from above, a sideways drag rolls the brain about its anterior–posterior axis', () => {
  const { camera, controls } = settledOn('superior', followCameraUp);
  controls.rotateLeft(Math.PI / 2);
  // A quarter turn lands on a lateral view, still level along the anterior–posterior axis.
  const offset = camera.position.clone().sub(target).normalize();
  assert.ok(Math.abs(Math.abs(offset.x) - 1) < 1e-6, 'the camera faces a hemisphere');
  assert.ok(camera.up.distanceTo(upFor('superior')) < 1e-12, 'anterior stays at the top of the screen');
});

test('views with a superior up orbit exactly as the stock controls do', () => {
  for (const view of ['oblique', 'left', 'anterior']) {
    const stock = settledOn(view);
    const adapted = settledOn(view, followCameraUp);
    for (const { controls } of [stock, adapted]) {
      controls.rotateLeft(0.4);
      controls.rotateUp(-0.2);
    }
    assert.deepEqual(adapted.camera.position.toArray(), stock.camera.position.toArray(), view);
  }
});

// A flat surface between the camera and the target, facing the camera on the left view. Like the
// anatomy's, it is single-sided and is met only within the raycaster's reach.
const SURFACE_X = -0.06;
const surface = new Plane(new Vector3(-1, 0, 0), SURFACE_X);
const singleSided = plane => raycaster => {
  const { ray } = raycaster;
  if (ray.direction.dot(plane.normal) >= 0) return null;
  const point = ray.intersectPlane(plane, new Vector3());
  if (!point || point.distanceTo(ray.origin) > raycaster.far) return null;
  return { point };
};
const hitSurface = singleSided(surface);

function zoomAt(controls, ndc, scale) {
  // What the wheel and a pinch record before they dolly.
  controls._mouse.copy(ndc);
  controls._performCursorZoom = true;
  controls.dollyIn(scale);
}

test('zooming onto a surface approaches it but never passes through it', () => {
  const { camera, controls } = settledOn('left', c => zoomAboutSurface(c, hitSurface));
  const ndc = new Vector2(0.3, -0.2);
  let gap = Infinity;
  for (let i = 0; i < 200; i += 1) {
    zoomAt(controls, ndc, 0.8);
    const now = SURFACE_X - camera.position.x;
    assert.ok(now > 0, `still in front of the surface after ${i + 1} steps`);
    assert.ok(now <= gap, 'the gap only shrinks');
    gap = now;
  }
  assert.ok(Math.abs(camera.position.distanceTo(controls.target) - LIMITS.minDistance) < 1e-9,
    'it comes to rest at the orbit limit');
});

test('the surface point under the pointer stays under it', () => {
  const { camera, controls } = settledOn('left', c => zoomAboutSurface(c, hitSurface));
  const ndc = new Vector2(-0.45, 0.3);
  zoomAt(controls, ndc, 0.7);
  camera.updateMatrixWorld();
  const projected = new Vector3(SURFACE_X, 0, 0);
  // The hit point for that pointer, recovered from where the camera now looks through it.
  const ray = new Vector3(ndc.x, ndc.y, 0.5).unproject(camera).sub(camera.position).normalize();
  const t = (SURFACE_X - camera.position.x) / ray.x;
  projected.copy(camera.position).addScaledVector(ray, t).project(camera);
  assert.ok(Math.abs(projected.x - ndc.x) < 1e-9 && Math.abs(projected.y - ndc.y) < 1e-9);
});

test('a zoom key moves toward the surface in the middle of the view and stops short of it', () => {
  const { camera, controls } = settledOn('left', c => zoomAboutSurface(c, hitSurface));
  const heading = controls.target.clone().sub(camera.position).normalize();
  for (let i = 0; i < 100; i += 1) controls.dollyIn(1 / 1.1);
  assert.ok(camera.position.x < SURFACE_X, 'the camera stays outside the surface');
  assert.ok(controls.target.clone().sub(camera.position).normalize().distanceTo(heading) < 1e-9, 'the heading is unchanged');
});

test('over empty stage a zoom scales the distance to the target, as before', () => {
  const { camera, controls } = settledOn('left', c => zoomAboutSurface(c, () => null));
  controls.dollyIn(1 / 1.1);
  assert.ok(Math.abs(camera.position.distanceTo(controls.target) - DISTANCE / 1.1) < 1e-9);
  assert.ok(controls.target.distanceTo(target) < 1e-9, 'a centred zoom keeps the target');
  controls.dollyIn(1.1);
  assert.ok(Math.abs(camera.position.distanceTo(controls.target) - DISTANCE) < 1e-9, 'and returns exactly');
});

test('zoomAbout holds the distance to the target within the orbit limits', () => {
  const position = new Vector3(0, 0, 1);
  const point = new Vector3(0, 0, 0.5);
  const near = zoomAbout(position, new Vector3(), point, 0.001, { min: 0.2, max: 4 });
  assert.ok(Math.abs(near.position.distanceTo(near.target) - 0.2) < 1e-12);
  const far = zoomAbout(position, new Vector3(), point, 1000, { min: 0.2, max: 4 });
  assert.ok(Math.abs(far.position.distanceTo(far.target) - 4) < 1e-12);
});

/** Close in on the left view: the target 20 mm beneath the surface, the camera 30 mm outside it. */
function closeIn(adapt) {
  const { camera, controls } = settledOn('left', adapt);
  controls.target.set(SURFACE_X + 0.02, 0, 0);
  camera.position.set(SURFACE_X - 0.03, 0, 0);
  controls.update();
  return { camera, controls };
}

test('turning close in backs away from the surface instead of swinging beneath it', () => {
  const stock = closeIn(() => {});
  stock.controls.rotateLeft(1.2);
  assert.ok(stock.camera.position.x > SURFACE_X, 'the stock controls went under it');

  const { camera, controls } = closeIn(c => stayOutside(c, hitSurface));
  const start = camera.position.clone();
  const facing = camera.quaternion.clone();
  controls.rotateLeft(1.2);
  assert.ok(camera.position.x < start.x, 'the camera backs away, outside the surface');
  assert.ok(camera.quaternion.angleTo(facing) < 1e-9, 'still looking where it did');
  assert.ok(Math.abs(camera.position.y) < 1e-12 && Math.abs(camera.position.z) < 1e-12, 'along its line to the target');
});

test('a turn that skims a curved surface backs off to its clearance along the line of sight', () => {
  // A convex surface curving round the pivot, as a gyrus does under a close-in orbit: every step of
  // the turn runs parallel to it, so only the line of sight shows how close the camera has come.
  const { camera, controls } = settledOn('left');
  const bulge = new Sphere(new Vector3(), 0.03);
  const skim = raycaster => {
    const { ray } = raycaster;
    if (bulge.containsPoint(ray.origin)) return null;
    const point = ray.intersectSphere(bulge, new Vector3());
    return point && point.distanceTo(ray.origin) <= raycaster.far ? { point } : null;
  };
  stayOutside(controls, skim);
  controls.target.set(0, 0, 0);
  camera.position.set(-0.034, 0, 0);
  controls.update();
  for (let i = 0; i < 100; i += 1) controls.rotateLeft(0.02);
  const gap = camera.position.length() - bulge.radius;
  assert.ok(gap >= LIMITS.minDistance / 4 - 1e-12, `${(gap * 1000).toFixed(2)} mm from the surface`);
});

test('once the turn is free again, the camera returns to the distance the reader chose', () => {
  const { camera, controls } = closeIn(c => stayOutside(c, hitSurface));
  const start = camera.position.clone();
  controls.rotateLeft(1.2);
  assert.ok(camera.position.distanceTo(controls.target) > 0.05 + 0.01, 'it backed away');
  // Refused, the turn left the camera on its line; turning away and back again is free.
  controls.rotateLeft(-0.6);
  controls.rotateLeft(0.6);
  assert.ok(camera.position.distanceTo(start) < 1e-9, 'and it comes back to where it was');
});

test('a zoom sets the distance the camera returns to', () => {
  const { camera, controls } = closeIn(c => { stayOutside(c, hitSurface); zoomAboutSurface(c, hitSurface); });
  controls.dollyIn(1.5);
  const zoomed = camera.position.distanceTo(controls.target);
  controls.rotateLeft(1.2);
  assert.ok(camera.position.distanceTo(controls.target) > zoomed + 0.01, 'it backed away');
  controls.rotateLeft(-0.6);
  assert.ok(Math.abs(camera.position.distanceTo(controls.target) - zoomed) < 1e-9);
});

test('a turn that stays clear of every surface is left alone, however close in', () => {
  const stock = closeIn(() => {});
  const { camera, controls } = closeIn(c => stayOutside(c, hitSurface));
  for (const each of [stock.controls, controls]) each.rotateLeft(-0.3);
  assert.deepEqual(camera.position.toArray(), stock.camera.position.toArray());
});

test('panning close in cannot carry the camera through a surface either', () => {
  const { camera, controls } = closeIn(c => stayOutside(c, hitSurface));
  // What a pan queues for the next update: camera and target slide together, 40 mm toward the surface.
  const [position, pivot] = [camera.position.clone(), controls.target.clone()];
  controls._panOffset.set(0.04, 0, 0);
  controls.update();
  assert.ok(camera.position.x < position.x, 'the camera backs away instead');
  assert.deepEqual(controls.target.toArray(), pivot.toArray(), 'and the target stays where it was');
});

test('a camera outside every surface is left where the orbit put it', () => {
  const stock = settledOn('left');
  const { camera, controls } = settledOn('left', c => stayOutside(c, hitSurface));
  for (const { controls: each } of [stock, { controls }]) each.rotateLeft(0.5);
  assert.deepEqual(camera.position.toArray(), stock.camera.position.toArray());
});

test('a move that leaves a structure is never held back', () => {
  // Facing away from the camera, this surface has the camera on its inside; turning carries it out.
  const EXIT_X = SURFACE_X - 0.01;
  const exit = singleSided(new Plane(new Vector3(1, 0, 0), -EXIT_X));
  const stock = closeIn(() => {});
  const { camera, controls } = closeIn(c => stayOutside(c, exit));
  for (const each of [stock.controls, controls]) each.rotateLeft(1.2);
  assert.ok(stock.camera.position.x > EXIT_X, 'the turn does cross it');
  assert.deepEqual(camera.position.toArray(), stock.camera.position.toArray());
});

test('a framing move that places the camera is not taken for a crossing', () => {
  const { camera, controls } = closeIn(c => stayOutside(c, hitSurface));
  // Straight through the surface, as a move to the opposite view would jump, then announced.
  camera.position.set(SURFACE_X + 0.07, 0, 0);
  controls.update();
  assert.ok(Math.abs(camera.position.x - (SURFACE_X + 0.07)) < 1e-12);
});

test('in the app’s order, zooming in still reaches the closest zoom rather than backing off', () => {
  const both = c => { stayOutside(c, hitSurface); zoomAboutSurface(c, hitSurface); };
  const { camera, controls } = settledOn('left', both);
  // A deep pivot: at the closest zoom the surface is nearer than the clearance a turn keeps.
  controls.target.set(0.1, 0, 0);
  camera.position.set(SURFACE_X - 0.04, 0, 0);
  controls.update();
  for (let i = 0; i < 100; i += 1) controls.dollyIn(1 / 1.1);
  assert.ok(Math.abs(camera.position.distanceTo(controls.target) - LIMITS.minDistance) < 1e-9);
  // Camera and target close on the surface together, so the gap keeps its 40 : 200 share of the distance.
  const gap = SURFACE_X - camera.position.x;
  assert.ok(Math.abs(gap - LIMITS.minDistance * 0.2) < 1e-9, 'the zoom’s own approach, untouched');
  assert.ok(gap < LIMITS.minDistance / 4, 'closer than a turn may come');
});
