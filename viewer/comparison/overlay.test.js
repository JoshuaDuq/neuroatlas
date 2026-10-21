import assert from 'node:assert/strict';
import test from 'node:test';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { createComparisonOverlay } from './overlay.js';

function overlapScene() {
  const scene = new Group();
  for (const id of ['pair-a', 'pair-b']) {
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    mesh.userData.overlap_id = id;
    scene.add(mesh);
  }
  return scene;
}

test('an overlap outlines only its exact mesh without painting or changing source geometry', async () => {
  const source = overlapScene();
  const geometry = source.children[0].geometry;
  const positions = geometry.attributes.position.array.slice();
  const overlay = createComparisonOverlay(async () => source);
  await overlay.highlight('pair-a');
  assert.equal(overlay.outlined.length, 1);
  assert.equal(overlay.outlined[0].userData.overlap_id, 'pair-a');
  assert.equal(overlay.outlined[0].material.colorWrite, false);
  assert.equal(overlay.outlined[0].material.depthWrite, false);
  assert.equal(overlay.outlined[0].geometry, geometry);
  assert.deepEqual(geometry.attributes.position.array, positions);
  assert.equal(source.children[1].visible, false);
  overlay.dispose();
});

test('clearing a selection cancels a pending highlight', async () => {
  let resolve;
  const overlay = createComparisonOverlay(() => new Promise(done => { resolve = done; }));
  const loading = overlay.highlight('pair-a');
  overlay.clear();
  resolve(overlapScene());
  assert.equal(await loading, false);
  assert.deepEqual(overlay.outlined, []);
  overlay.dispose();
});

test('switching highlights reuses loaded geometry and clears the previous pair', async () => {
  let loads = 0;
  const overlay = createComparisonOverlay(async () => { loads++; return overlapScene(); });
  await overlay.highlight('pair-a');
  await overlay.highlight('pair-b');
  assert.equal(loads, 1);
  assert.deepEqual(overlay.outlined.map(mesh => mesh.userData.overlap_id), ['pair-b']);
  overlay.setVisible(false);
  assert.deepEqual(overlay.outlined, []);
  overlay.setVisible(true);
  assert.equal(overlay.outlined.length, 1);
  overlay.clear();
  assert.deepEqual(overlay.outlined, []);
  overlay.dispose();
});

test('missing and duplicate overlap identities surface errors', async () => {
  const overlay = createComparisonOverlay(async () => overlapScene());
  await assert.rejects(overlay.highlight('absent'), /Unknown overlap/);
  overlay.dispose();
  const duplicated = overlapScene();
  duplicated.children[1].userData.overlap_id = 'pair-a';
  let releases = 0;
  for (const mesh of duplicated.children) {
    mesh.material.addEventListener('dispose', () => releases++);
  }
  const invalid = createComparisonOverlay(async () => duplicated);
  await assert.rejects(invalid.highlight('pair-a'), /duplicate/);
  assert.equal(releases, 2);
  invalid.dispose();
});

test('geometry arriving after disposal is released and cannot become a highlight', async () => {
  let resolve;
  const scene = overlapScene();
  let releases = 0;
  for (const mesh of scene.children) mesh.geometry.addEventListener('dispose', () => releases++);
  const overlay = createComparisonOverlay(() => new Promise(done => { resolve = done; }));
  const loading = overlay.highlight('pair-a');
  overlay.dispose();
  resolve(scene);
  assert.equal(await loading, false);
  assert.equal(releases, 2);
  assert.deepEqual(overlay.outlined, []);
});

test('an explicit new highlight request can retry a failed geometry load', async () => {
  let attempts = 0;
  const failure = new Error('Overlap request failed: HTTP 503');
  const overlay = createComparisonOverlay(async () => {
    if (++attempts === 1) throw failure;
    return overlapScene();
  });
  await assert.rejects(overlay.highlight('pair-a'), error => error === failure);
  await overlay.highlight('pair-a');
  assert.equal(attempts, 2);
  assert.equal(overlay.outlined[0].userData.overlap_id, 'pair-a');
  overlay.dispose();
});
