import assert from 'node:assert/strict';
import test from 'node:test';
import { startupAssets } from './startup-assets.js';

test('startupAssets prefetches the default cortex, learning layer and reference cord', () => {
  assert.deepEqual(startupAssets('', '/neuroatlas/'), [
    '/neuroatlas/models/manifest.json',
    '/neuroatlas/models/cortex-destrieux.glb',
    '/neuroatlas/models/learning.glb',
    '/neuroatlas/models/spinal-cord.glb',
  ]);
});

test('startupAssets follows a shared link to HCP and the coarse interior', () => {
  assert.deepEqual(startupAssets('#atlas=hcp-mmp&detail=aseg', '/neuroatlas/'), [
    '/neuroatlas/models/manifest.json',
    '/neuroatlas/models/cortex-hcp-mmp.glb',
    '/neuroatlas/models/structures.glb',
    '/neuroatlas/models/spinal-cord.glb',
  ]);
});

test('startupAssets treats a missing trailing slash on the base as a directory', () => {
  assert.equal(
    startupAssets('', '/neuroatlas')[0],
    '/neuroatlas/models/manifest.json',
  );
});
