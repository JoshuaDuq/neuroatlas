import assert from 'node:assert/strict';
import { test } from 'vitest';
import { prefetchAtlas } from './boot.ts';

const atlases = [
  { id: 'destrieux', file: 'cortex-destrieux.glb' },
  { id: 'hcp-mmp', file: 'cortex-hcp-mmp.glb' },
];

test('only the other cortical atlas is fetched ahead, on a GPU that can hold both', () => {
  assert.equal(
    prefetchAtlas(atlases, 'destrieux', { prefetchLayers: true, connection: undefined })?.id,
    'hcp-mmp',
  );
  assert.equal(
    prefetchAtlas(atlases, 'hcp-mmp', { prefetchLayers: true, connection: { effectiveType: '4g' } })
      ?.id,
    'destrieux',
  );
  assert.equal(
    prefetchAtlas(atlases, 'destrieux', { prefetchLayers: false, connection: undefined }),
    null,
  );
});

test('a metered or slow connection is never spent on a download nobody asked for', () => {
  for (const connection of [
    { saveData: true, effectiveType: '4g' },
    { effectiveType: 'slow-2g' },
    { effectiveType: '2g' },
    { effectiveType: '3g' },
  ]) {
    assert.equal(
      prefetchAtlas(atlases, 'destrieux', { prefetchLayers: true, connection }),
      null,
      JSON.stringify(connection),
    );
  }
});
