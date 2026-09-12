import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BrainAtlas } from './brain-atlas.js';

test('published GLBs load in Three.js with manifest metadata and unchanged geometry', async () => {
  const directory = new URL('../../public/models/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
  const gltfLoader = new GLTFLoader();
  const loader = {
    async loadAsync(file) {
      const bytes = await readFile(new URL(file, directory));
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      return gltfLoader.parseAsync(buffer, '');
    },
  };
  const atlas = new BrainAtlas(manifest, loader);
  await atlas.initialize('destrieux');
  assert.equal(atlas.visibleMeshes.length, 185);
  for (const entry of manifest.atlases) {
    await atlas.setAtlas(entry.id);
    const corticalMeshes = atlas.visibleMeshes.filter(mesh => mesh.userData.kind === 'cortex');
    assert.equal(corticalMeshes.length, entry.region_count);
    for (const mesh of atlas.visibleMeshes) {
      assert.ok(mesh.geometry.getAttribute('normal'));
      if (['cortex', 'non-region'].includes(mesh.userData.kind)) {
        for (const name of ['_sulc', '_concavity', '_t1']) {
          const field = mesh.geometry.getAttribute(name);
          assert.equal(field.count, mesh.geometry.attributes.position.count);
          assert.ok(field.array.every(Number.isFinite));
        }
      }
      assert.deepEqual(mesh.position.toArray(), [0, 0, 0]);
      assert.deepEqual(mesh.scale.toArray(), [1, 1, 1]);
    }
    atlas.select(corticalMeshes[0].userData.region_id);
    assert.equal(atlas.state.selectedRegion.atlas, entry.id);
  }
  atlas.setCortexVisible(false);
  assert.equal(atlas.visibleMeshes.length, manifest.detail_levels[0].region_count);
  atlas.select(atlas.visibleMeshes[0].userData.region_id);
  assert.equal(atlas.state.selectedRegion.kind, 'structure');
  atlas.dispose();
});
