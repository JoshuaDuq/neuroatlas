import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BrainAtlas } from './brain-atlas.js';

const { anatomies } = JSON.parse(await readFile(new URL('../../public/models/anatomies.json', import.meta.url), 'utf8'));

for (const { id: published } of anatomies) test(`${published}: published GLBs load in Three.js with manifest metadata and unchanged geometry`, async () => {
  const directory = new URL(`../../public/models/${published}/`, import.meta.url);
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
  const detail = manifest.detail_levels.find(level => level.id === atlas.defaultDetail);
  assert.equal(atlas.state.detail, 'learning');
  // 148 Destrieux parcels plus the two non-region surfaces; a published cord waits to be shown.
  assert.equal(atlas.visibleMeshes.length, 150 + detail.region_count);
  // A scan that ends inside the medulla (SNAIL's) publishes no reference cord to show.
  if (manifest.supplemental_layers.length) {
    const [cord] = manifest.supplemental_layers;
    assert.deepEqual(manifest.supplemental_layers.map(layer => layer.id), ['zanatomy']);
    await atlas.setSpinalCordVisible(true);
    assert.equal(atlas.visibleMeshes.length, 150 + detail.region_count + cord.region_count);
    await atlas.setSpinalCordVisible(false);
  } else await assert.rejects(atlas.setSpinalCordVisible(true), /does not publish a spinal cord/);
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
  assert.equal(atlas.visibleMeshes.length, detail.region_count);
  atlas.select(atlas.visibleMeshes[0].userData.region_id);
  assert.equal(atlas.state.selectedRegion.kind, 'structure');
  atlas.setInternalSystem('Basal ganglia');
  assert.ok(atlas.visibleMeshes.length > 5);
  assert.ok(atlas.visibleMeshes.every(mesh =>
    atlas.regions.get(mesh.userData.region_id).system_names.en === 'Basal ganglia'));
  assert.throws(() => atlas.setInternalSystem('Imaginary system'), /Unknown internal/);
  const caudate = atlas.visibleMeshes.find(mesh => mesh.userData.region_id === 'learning:left:caudate');
  atlas.select(caudate.userData.region_id);
  atlas.isolate();
  assert.equal(atlas.visibleMeshes.length, 1);
  atlas.setInternalSystem('Brainstem');
  assert.equal(atlas.state.selectedRegion, null);
  assert.equal(atlas.state.isolatedRegion, null);
  atlas.reset();
  assert.equal(atlas.state.internalSystem, null);
  atlas.dispose();
});
