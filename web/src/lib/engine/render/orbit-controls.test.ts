import assert from 'node:assert/strict';
import { test } from 'vitest';
import { PerspectiveCamera, Plane, type Raycaster, Sphere, Vector2, Vector3 } from 'three';
import type { ViewName } from '../../types/index.ts';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VIEW_DIRECTIONS, upFor } from './camera-views.ts';
import {
  type Home,
  type Intersect,
  homeward,
  levelOnOrbit,
  stayOutside,
  zoomAbout,
  zoomAboutSurface,
} from './orbit-controls.ts';

type Adapt = (controls: OrbitControls) => void;

/** The controls' private state the tests drive. */
type DrivenControls = OrbitControls & {
  _mouse: Vector2;
  _performCursorZoom: boolean;
  _panOffset: Vector3;
};

const target = new Vector3(0.002, -0.011, 0.004);
const DISTANCE = 0.42;
const LIMITS = { minDistance: 0.025, maxDistance: 2.5 };

/** Controls settled on a named view, as scene.moveTo leaves them; `adapt` wraps them first. */
function settledOn(view: ViewName, adapt: Adapt = () => {}) {
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

/** Where the screen's top points, in world space. */
const screenUp = (camera: PerspectiveCamera) =>
  new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

/** The roll between the screen's top and superior as seen along the line of sight, in radians. */
function roll(camera: PerspectiveCamera, about: Vector3): number {
  const sight = about.clone().sub(camera.position).normalize();
  const level = new Vector3(0, 1, 0).addScaledVector(sight, -sight.y).normalize();
  return screenUp(camera).angleTo(level);
}

test('a turn from the superior or inferior view spins the picture it showed, where the stock controls sat still', () => {
  for (const view of ['superior', 'inferior'] as const) {
    const stock = settledOn(view);
    const before = stock.camera.quaternion.clone();
    stock.controls.rotateLeft(0.3);
    assert.ok(
      stock.camera.quaternion.angleTo(before) < 1e-6,
      `${view}: a sideways drag did nothing`,
    );

    const { camera, controls } = settledOn(view, levelOnOrbit);
    const shown = camera.quaternion.clone();
    controls.rotateLeft(0.3);
    // A jump to the other side of the axis would add half a turn; any roll would add its own angle.
    assert.ok(
      Math.abs(camera.quaternion.angleTo(shown) - 0.3) < 1e-3,
      `${view}: the view turns by the drag and nothing more`,
    );
    assert.ok(
      Math.abs(camera.position.distanceTo(target) - DISTANCE) < 1e-9,
      `${view}: the distance is kept`,
    );
    assert.ok(camera.up.equals(new Vector3(0, 1, 0)), `${view}: the turntable is superior up`);
  }
});

test('leaving the superior or inferior view, the brain stands superior up', () => {
  // Off the axis, superior can read as the top of the screen; the old frame laid the brain on its side.
  for (const [view, tilt] of [
    ['superior', -0.6],
    ['inferior', 0.6],
  ] as const) {
    const { camera, controls } = settledOn(view, levelOnOrbit);
    controls.rotateLeft(Math.PI / 2);
    controls.rotateUp(tilt);
    assert.ok(roll(camera, target) < 1e-9, `${view}: level`);
    assert.ok(screenUp(camera).y > 0, `${view}: superior at the top, not the bottom`);
  }
});

test('a rolled camera rights itself over a few frames of a turn, not in one snap', () => {
  // A faced cut or a grab mid-move can leave the camera rolled a quarter turn.
  const camera = new PerspectiveCamera(35, 1.4, 0.001, 10);
  const controls = new OrbitControls(camera);
  levelOnOrbit(controls);
  camera.up.set(0, 0, -1);
  camera.position.copy(target).addScaledVector(VIEW_DIRECTIONS.left, DISTANCE);
  controls.target.copy(target);
  controls.update();
  assert.ok(Math.abs(roll(camera, target) - Math.PI / 2) < 1e-9, 'it starts rolled');

  controls.update();
  assert.ok(Math.abs(roll(camera, target) - Math.PI / 2) < 1e-9, 'at rest it keeps its roll');

  controls.rotateLeft(0.01);
  const first = roll(camera, target);
  assert.ok(first > Math.PI / 4 && first < Math.PI / 2 - 0.1, `one frame eases it: ${first}`);
  for (let i = 0; i < 60; i += 1) controls.update();
  assert.ok(roll(camera, target) < 1e-9, 'it ends level');
  assert.ok(camera.up.equals(new Vector3(0, 1, 0)));
});

test('a framing that writes its own up mid-levelling keeps it', () => {
  const { camera, controls } = settledOn('left', levelOnOrbit);
  camera.up.set(0, 0, -1);
  controls.rotateLeft(0.01);
  // A faced cut arrives with the cut's own up.
  camera.up.set(0, 0, 1);
  for (let i = 0; i < 10; i += 1) controls.update();
  assert.ok(camera.up.equals(new Vector3(0, 0, 1)));
});

test('views with a superior up orbit exactly as the stock controls do', () => {
  for (const view of ['oblique', 'left', 'anterior'] as const) {
    const stock = settledOn(view);
    const adapted = settledOn(view, levelOnOrbit);
    for (const { controls } of [stock, adapted]) {
      controls.rotateLeft(0.4);
      controls.rotateUp(-0.2);
    }
    assert.deepEqual(adapted.camera.position.toArray(), stock.camera.position.toArray(), view);
    assert.deepEqual(adapted.camera.quaternion.toArray(), stock.camera.quaternion.toArray(), view);
  }
});

// A flat surface between the camera and the target, facing the camera on the left view. Like the
// anatomy's, it is single-sided and is met only within the raycaster's reach.
const SURFACE_X = -0.06;
const surface = new Plane(new Vector3(-1, 0, 0), SURFACE_X);
const singleSided =
  (plane: Plane): Intersect =>
  (raycaster) => {
    const { ray } = raycaster;
    if (ray.direction.dot(plane.normal) >= 0) return null;
    const point = ray.intersectPlane(plane, new Vector3());
    if (!point || point.distanceTo(ray.origin) > raycaster.far) return null;
    return { point };
  };
const hitSurface = singleSided(surface);
/** The framing the settled views were placed by: centred on the target, filling the stage at DISTANCE. */
const framedAtTarget: Home = () => ({ center: target.clone(), distance: DISTANCE });

function zoomAt(controls: OrbitControls, ndc: Vector2, scale: number) {
  const driven = controls as unknown as DrivenControls;
  // What the wheel and a pinch record before they dolly.
  driven._mouse.copy(ndc);
  driven._performCursorZoom = true;
  controls.dollyIn(scale);
}

test('zooming onto a surface approaches it but never passes through it', () => {
  const { camera, controls } = settledOn('left', (c) =>
    zoomAboutSurface(c, hitSurface, framedAtTarget),
  );
  const ndc = new Vector2(0.3, -0.2);
  let gap = Infinity;
  for (let i = 0; i < 200; i += 1) {
    zoomAt(controls, ndc, 0.8);
    const now = SURFACE_X - camera.position.x;
    assert.ok(now > 0, `still in front of the surface after ${i + 1} steps`);
    assert.ok(now <= gap, 'the gap only shrinks');
    gap = now;
  }
  assert.ok(
    Math.abs(camera.position.distanceTo(controls.target) - LIMITS.minDistance) < 1e-9,
    'it comes to rest at the orbit limit',
  );
});

test('the surface point under the pointer stays under it', () => {
  const { camera, controls } = settledOn('left', (c) =>
    zoomAboutSurface(c, hitSurface, framedAtTarget),
  );
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
  const { camera, controls } = settledOn('left', (c) =>
    zoomAboutSurface(c, hitSurface, framedAtTarget),
  );
  const heading = controls.target.clone().sub(camera.position).normalize();
  for (let i = 0; i < 100; i += 1) controls.dollyIn(1 / 1.1);
  assert.ok(camera.position.x < SURFACE_X, 'the camera stays outside the surface');
  assert.ok(
    controls.target.clone().sub(camera.position).normalize().distanceTo(heading) < 1e-9,
    'the heading is unchanged',
  );
});

test('over empty stage a zoom scales the distance to the target, as before', () => {
  const { camera, controls } = settledOn('left', (c) =>
    zoomAboutSurface(c, () => null, framedAtTarget),
  );
  controls.dollyIn(1 / 1.1);
  assert.ok(Math.abs(camera.position.distanceTo(controls.target) - DISTANCE / 1.1) < 1e-9);
  assert.ok(controls.target.distanceTo(target) < 1e-9, 'a centred zoom keeps the target');
  controls.dollyIn(1.1);
  assert.ok(
    Math.abs(camera.position.distanceTo(controls.target) - DISTANCE) < 1e-9,
    'and returns exactly',
  );
});

test('zooming back out leads the target home, most of the way by the framed distance', () => {
  const { camera, controls } = settledOn('left', (c) =>
    zoomAboutSurface(c, hitSurface, framedAtTarget),
  );
  for (let i = 0; i < 12; i += 1) zoomAt(controls, new Vector2(0.6, 0.4), 1 / 1.1);
  const strayed = controls.target.distanceTo(target);
  assert.ok(strayed > 0.01, `zooming in follows the pointer off centre: ${strayed}`);
  const heading = camera.position.clone().sub(controls.target).normalize();

  // Out again over another spot: the pointer no longer steers, and each step leads the target back.
  let gap = strayed;
  while (camera.position.distanceTo(controls.target) < DISTANCE - 1e-9) {
    zoomAt(controls, new Vector2(-0.5, -0.3), 1.1);
    const now = controls.target.distanceTo(target);
    assert.ok(now < gap, 'the target only nears home');
    gap = now;
  }
  assert.ok(gap < strayed * 0.1, `nearly home once the framing fills the stage: ${gap / strayed}`);
  for (let i = 0; i < 20; i += 1) zoomAt(controls, new Vector2(-0.5, -0.3), 1.1);
  assert.ok(controls.target.distanceTo(target) < strayed * 1e-3, 'and home further out');
  assert.ok(
    camera.position.clone().sub(controls.target).normalize().distanceTo(heading) < 1e-9,
    'the heading is unchanged',
  );
});

test('homeward compounds toward the whole way, and never jumps', () => {
  let left = 1;
  for (let distance = 0.04; distance < 0.4; distance *= 1.07) {
    left *= 1 - homeward(distance, Math.min(distance * 1.07, 0.4), 0.4);
  }
  assert.ok(left < 0.1, `${left} of the way still to go at the framed distance`);
  // A pan made at the framed distance, then a notch of zoom out: a share, not the whole way.
  assert.ok(homeward(0.399, 0.399 * 1.1, 0.4) < 0.3);
  assert.equal(homeward(0.3, 0.3, 0.4), 0, 'a zoom held at its limit leaves the target');
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
function closeIn(adapt: Adapt) {
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

  const { camera, controls } = closeIn((c) => stayOutside(c, hitSurface));
  const start = camera.position.clone();
  const facing = camera.quaternion.clone();
  controls.rotateLeft(1.2);
  assert.ok(camera.position.x < start.x, 'the camera backs away, outside the surface');
  assert.ok(camera.quaternion.angleTo(facing) < 1e-9, 'still looking where it did');
  assert.ok(
    Math.abs(camera.position.y) < 1e-12 && Math.abs(camera.position.z) < 1e-12,
    'along its line to the target',
  );
});

test('a turn that skims a curved surface backs off to its clearance along the line of sight', () => {
  // A convex surface curving round the pivot, as a gyrus does under a close-in orbit: every step of
  // the turn runs parallel to it, so only the line of sight shows how close the camera has come.
  const { camera, controls } = settledOn('left');
  const bulge = new Sphere(new Vector3(), 0.03);
  const skim: Intersect = (raycaster: Raycaster) => {
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
  assert.ok(
    gap >= LIMITS.minDistance / 4 - 1e-12,
    `${(gap * 1000).toFixed(2)} mm from the surface`,
  );
});

test('once the turn is free again, the camera returns to the distance the reader chose', () => {
  const { camera, controls } = closeIn((c) => stayOutside(c, hitSurface));
  const start = camera.position.clone();
  controls.rotateLeft(1.2);
  assert.ok(camera.position.distanceTo(controls.target) > 0.05 + 0.01, 'it backed away');
  // Refused, the turn left the camera on its line; turning away and back again is free.
  controls.rotateLeft(-0.6);
  controls.rotateLeft(0.6);
  assert.ok(camera.position.distanceTo(start) < 1e-9, 'and it comes back to where it was');
});

test('a zoom sets the distance the camera returns to', () => {
  const { camera, controls } = closeIn((c) => {
    stayOutside(c, hitSurface);
    zoomAboutSurface(c, hitSurface, framedAtTarget);
  });
  controls.dollyIn(1.5);
  const zoomed = camera.position.distanceTo(controls.target);
  controls.rotateLeft(1.2);
  assert.ok(camera.position.distanceTo(controls.target) > zoomed + 0.01, 'it backed away');
  controls.rotateLeft(-0.6);
  assert.ok(Math.abs(camera.position.distanceTo(controls.target) - zoomed) < 1e-9);
});

test('a turn that stays clear of every surface is left alone, however close in', () => {
  const stock = closeIn(() => {});
  const { camera, controls } = closeIn((c) => stayOutside(c, hitSurface));
  for (const each of [stock.controls, controls]) each.rotateLeft(-0.3);
  assert.deepEqual(camera.position.toArray(), stock.camera.position.toArray());
});

test('panning close in cannot carry the camera through a surface either', () => {
  const { camera, controls } = closeIn((c) => stayOutside(c, hitSurface));
  // What a pan queues for the next update: camera and target slide together, 40 mm toward the surface.
  const [position, pivot] = [camera.position.clone(), controls.target.clone()];
  (controls as unknown as DrivenControls)._panOffset.set(0.04, 0, 0);
  controls.update();
  assert.ok(camera.position.x < position.x, 'the camera backs away instead');
  assert.deepEqual(controls.target.toArray(), pivot.toArray(), 'and the target stays where it was');
});

test('a camera outside every surface is left where the orbit put it', () => {
  const stock = settledOn('left');
  const { camera, controls } = settledOn('left', (c) => stayOutside(c, hitSurface));
  for (const { controls: each } of [stock, { controls }]) each.rotateLeft(0.5);
  assert.deepEqual(camera.position.toArray(), stock.camera.position.toArray());
});

test('a move that leaves a structure is never held back', () => {
  // Facing away from the camera, this surface has the camera on its inside; turning carries it out.
  const EXIT_X = SURFACE_X - 0.01;
  const exit = singleSided(new Plane(new Vector3(1, 0, 0), -EXIT_X));
  const stock = closeIn(() => {});
  const { camera, controls } = closeIn((c) => stayOutside(c, exit));
  for (const each of [stock.controls, controls]) each.rotateLeft(1.2);
  assert.ok(stock.camera.position.x > EXIT_X, 'the turn does cross it');
  assert.deepEqual(camera.position.toArray(), stock.camera.position.toArray());
});

test('a framing move that places the camera is not taken for a crossing', () => {
  const { camera, controls } = closeIn((c) => stayOutside(c, hitSurface));
  // Straight through the surface, as a move to the opposite view would jump, then announced.
  camera.position.set(SURFACE_X + 0.07, 0, 0);
  controls.update();
  assert.ok(Math.abs(camera.position.x - (SURFACE_X + 0.07)) < 1e-12);
});

test('in the app’s order, zooming in still reaches the closest zoom rather than backing off', () => {
  const both: Adapt = (c) => {
    stayOutside(c, hitSurface);
    zoomAboutSurface(c, hitSurface, framedAtTarget);
  };
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
