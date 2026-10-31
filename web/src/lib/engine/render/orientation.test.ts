import assert from 'node:assert/strict';
import { test } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { cameraBasis, edgeLabels, localizeEdges, projectAxes } from './orientation.ts';

// manifest coordinate_system: x = right, y = superior, z = posterior.
const VIEWS = {
  left: [-1, 0, 0],
  right: [1, 0, 0],
  anterior: [0, 0, -1],
  posterior: [0, 0, 1],
  superior: [0, 1, 0],
  inferior: [0, -1, 0],
};

/** Place a camera exactly as the viewer does for a named view. */
function cameraFor(view: keyof typeof VIEWS) {
  const camera = new PerspectiveCamera(35, 1.6, 0.001, 10);
  camera.up.set(0, 1, 0);
  if (view === 'superior') camera.up.set(0, 0, -1);
  if (view === 'inferior') camera.up.set(0, 0, 1);
  camera.position.copy(new Vector3(...VIEWS[view]).normalize().multiplyScalar(0.5));
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  return camera;
}

test('the six canonical views label their edges by anatomical convention', () => {
  assert.deepEqual(edgeLabels(cameraFor('left')), { right: 'P', left: 'A', top: 'S', bottom: 'I' });
  assert.deepEqual(edgeLabels(cameraFor('right')), {
    right: 'A',
    left: 'P',
    top: 'S',
    bottom: 'I',
  });
  // Facing the subject, their left is on the viewer's right.
  assert.deepEqual(edgeLabels(cameraFor('anterior')), {
    right: 'L',
    left: 'R',
    top: 'S',
    bottom: 'I',
  });
  assert.deepEqual(edgeLabels(cameraFor('posterior')), {
    right: 'R',
    left: 'L',
    top: 'S',
    bottom: 'I',
  });
  assert.deepEqual(edgeLabels(cameraFor('superior')), {
    right: 'R',
    left: 'L',
    top: 'A',
    bottom: 'P',
  });
  assert.deepEqual(edgeLabels(cameraFor('inferior')), {
    right: 'R',
    left: 'L',
    top: 'P',
    bottom: 'A',
  });
});

test('left and right are never both on the same side', () => {
  for (const view of Object.keys(VIEWS) as (keyof typeof VIEWS)[]) {
    const { left, right } = edgeLabels(cameraFor(view));
    assert.notEqual(left, right, `${view} put the same letter on both sides`);
  }
});

test('opposing edges always carry opposing anatomical directions', () => {
  const opposite: Record<string, string> = { L: 'R', R: 'L', S: 'I', I: 'S', A: 'P', P: 'A' };
  const camera = new PerspectiveCamera(35, 1.6, 0.001, 10);
  camera.position.copy(new Vector3(-1, 0.3, -0.45).normalize().multiplyScalar(0.5));
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const edges = edgeLabels(camera);
  assert.equal(edges.left, opposite[edges.right]);
  assert.equal(edges.bottom, opposite[edges.top]);
  assert.equal(new Set(Object.values(edges)).size, 4);
});

test('the oblique default view keeps superior at the top', () => {
  const camera = new PerspectiveCamera(35, 1.6, 0.001, 10);
  camera.position.copy(new Vector3(-1, 0.3, -0.45).normalize().multiplyScalar(0.5));
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  assert.equal(edgeLabels(camera).top, 'S');
});

test('letters follow the camera inside its own change event, before anything redraws', async () => {
  // OrbitControls fires 'change' after lookAt has turned the camera but before
  // its world matrix is recomputed; reading that matrix left the previous view's letters on screen.
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  const camera = cameraFor('left');
  const controls = new OrbitControls(camera);
  controls.update();
  let seen = null;
  controls.addEventListener('change', () => {
    seen = edgeLabels(camera);
  });
  camera.position.set(0, 0, -0.5);
  controls.update();
  assert.deepEqual(seen, { right: 'L', left: 'R', top: 'S', bottom: 'I' });
});

test('stored letters are translated without asking the camera again', () => {
  const raw = edgeLabels(cameraFor('anterior'));
  assert.deepEqual(localizeEdges(raw, 'fr'), { right: 'G', left: 'D', top: 'S', bottom: 'I' });
  assert.deepEqual(localizeEdges(raw, 'en'), raw);
});

test('with a target, letters follow where the camera stands, not a rotation a framing plan left on it', () => {
  // A camera left turned toward some other view (e.g. mid-plan) must not label the picture
  // with that view's letters.
  const camera = cameraFor('left');
  const planned = cameraFor('anterior');
  camera.quaternion.copy(planned.quaternion);
  camera.updateMatrixWorld(true);
  assert.deepEqual(edgeLabels(camera, 'en', new Vector3(0, 0, 0)), {
    right: 'P',
    left: 'A',
    top: 'S',
    bottom: 'I',
  });
  assert.deepEqual(edgeLabels(cameraFor('superior'), 'fr', new Vector3(0, 0, 0)), {
    right: 'D',
    left: 'G',
    top: 'A',
    bottom: 'P',
  });
});

const close = (actual: readonly number[], expected: readonly number[]) =>
  actual.forEach((value, axis) => assert.ok(Math.abs(value - expected[axis]!) < 1e-9, `${actual}`));

test('the basis points to screen right, screen up and out of the screen, in world axes', () => {
  // From the left the viewer looks along +x: posterior is to the right, superior up, left toward them.
  const left = cameraBasis(cameraFor('left'));
  close(left.right, [0, 0, 1]);
  close(left.up, [0, 1, 0]);
  close(left.back, [-1, 0, 0]);
  const superior = cameraBasis(cameraFor('superior'));
  close(superior.right, [1, 0, 0]);
  close(superior.up, [0, 0, -1]);
  close(superior.back, [0, 1, 0]);
});

test('with a target, the basis is the one lookAt gives, not a rotation a plan left on the camera', () => {
  const camera = cameraFor('left');
  camera.quaternion.copy(cameraFor('anterior').quaternion);
  camera.updateMatrixWorld(true);
  close(cameraBasis(camera, new Vector3(0, 0, 0)).back, [-1, 0, 0]);
  close(cameraBasis(camera).back, [0, 0, -1]);
});

test('the gizmo puts R right of the centre and S above it, and the axis toward the viewer in front', () => {
  const at = (basis: Parameters<typeof projectAxes>[0]) =>
    Object.fromEntries(projectAxes(basis).map(({ letter, ...rest }) => [letter, rest]));
  // Seen from behind: the subject's right is the viewer's right.
  const posterior = at(cameraBasis(cameraFor('posterior')));
  assert.ok(posterior.R!.x > 0.99 && Math.abs(posterior.R!.y) < 1e-9);
  assert.ok(posterior.L!.x < -0.99);
  assert.ok(posterior.S!.y < -0.99 && Math.abs(posterior.S!.x) < 1e-9);
  assert.ok(posterior.I!.y > 0.99);
  assert.ok(posterior.P!.depth > 0.99 && posterior.A!.depth < -0.99);
  // Seen from the front, the sides swap and A faces the viewer.
  const anterior = at(cameraBasis(cameraFor('anterior')));
  assert.ok(anterior.R!.x < -0.99 && anterior.L!.x > 0.99);
  assert.ok(anterior.A!.depth > 0.99);
});
