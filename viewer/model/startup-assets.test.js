import assert from 'node:assert/strict';
import test from 'node:test';
import { startupAssets } from './startup-assets.js';

test('startupAssets prefetches the default cortex, learning layer and reference cord', () => {
  assert.deepEqual(startupAssets('', '/neuroatlas/', 'bert'), [
    '/neuroatlas/models/anatomies.json',
    '/neuroatlas/models/bert/manifest.json',
    '/neuroatlas/models/bert/cortex-destrieux.glb',
    '/neuroatlas/models/bert/learning.glb',
    '/neuroatlas/models/bert/spinal-cord.glb',
  ]);
});

test('startupAssets follows a shared link to HCP and the coarse interior', () => {
  assert.deepEqual(startupAssets('#atlas=hcp-mmp&detail=aseg', '/neuroatlas/', 'bert'), [
    '/neuroatlas/models/anatomies.json',
    '/neuroatlas/models/bert/manifest.json',
    '/neuroatlas/models/bert/cortex-hcp-mmp.glb',
    '/neuroatlas/models/bert/structures.glb',
    '/neuroatlas/models/bert/spinal-cord.glb',
  ]);
});

test('a link naming a brain overrides the published default', () => {
  // Region ids are shared between brains, so the link's brain decides which
  // 25 MB is worth starting; the default must not win over an explicit one.
  const assets = startupAssets('#anatomy=aomic', '/neuroatlas/', 'bert');
  assert.equal(assets[1], '/neuroatlas/models/aomic/manifest.json');
  assert.ok(assets.every(url => !url.includes('/bert/')));
});

test('without a known brain only the index is fetched', () => {
  // Guessing here would download the wrong brain's cortex before the index
  // has had a chance to say which one a bare link means.
  assert.deepEqual(startupAssets('', '/neuroatlas/'), [
    '/neuroatlas/models/anatomies.json',
  ]);
});

test('startupAssets treats a missing trailing slash on the base as a directory', () => {
  assert.equal(
    startupAssets('', '/neuroatlas', 'bert')[0],
    '/neuroatlas/models/anatomies.json',
  );
});
