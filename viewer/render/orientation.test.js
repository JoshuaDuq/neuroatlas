import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { edgeLabels } from './orientation.js';

// manifest coordinate_system: x = right, y = superior, z = posterior.
const VIEWS = {
  left: [-1, 0, 0], right: [1, 0, 0],
  anterior: [0, 0, -1], posterior: [0, 0, 1],
  superior: [0, 1, 0], inferior: [0, -1, 0],
};

/** Place a camera exactly as the viewer does for a named view. */
function cameraFor(view) {
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
  assert.deepEqual(edgeLabels(cameraFor('left')),
    { right: 'P', left: 'A', top: 'S', bottom: 'I' });
  assert.deepEqual(edgeLabels(cameraFor('right')),
    { right: 'A', left: 'P', top: 'S', bottom: 'I' });
  // Facing the subject, their left is on the viewer's right.
  assert.deepEqual(edgeLabels(cameraFor('anterior')),
    { right: 'L', left: 'R', top: 'S', bottom: 'I' });
  assert.deepEqual(edgeLabels(cameraFor('posterior')),
    { right: 'R', left: 'L', top: 'S', bottom: 'I' });
  assert.deepEqual(edgeLabels(cameraFor('superior')),
    { right: 'R', left: 'L', top: 'A', bottom: 'P' });
  assert.deepEqual(edgeLabels(cameraFor('inferior')),
    { right: 'R', left: 'L', top: 'P', bottom: 'A' });
});

test('left and right are never both on the same side', () => {
  for (const view of Object.keys(VIEWS)) {
    const { left, right } = edgeLabels(cameraFor(view));
    assert.notEqual(left, right, `${view} put the same letter on both sides`);
  }
});

test('opposing edges always carry opposing anatomical directions', () => {
  const opposite = { L: 'R', R: 'L', S: 'I', I: 'S', A: 'P', P: 'A' };
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
