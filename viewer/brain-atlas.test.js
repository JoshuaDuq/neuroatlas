import assert from 'node:assert/strict';
import test from 'node:test';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { BrainAtlas } from './brain-atlas.js';

const regions = [
  { id: 'a-left', label: 'A left', hemisphere: 'left', atlas: 'a', source_label_id: 1, kind: 'cortex' },
  { id: 'a-right', label: 'A right', hemisphere: 'right', atlas: 'a', source_label_id: 2, kind: 'cortex' },
  { id: 'a-wall', label: 'Unlabeled', hemisphere: 'left', atlas: 'a', source_label_id: 0, kind: 'non-region' },
  { id: 'b-left', label: 'B left', hemisphere: 'left', atlas: 'b', source_label_id: 1, kind: 'cortex' },
  { id: 'stem', label: 'Brainstem', hemisphere: 'midline', atlas: 'aseg', source_label_id: 16, kind: 'structure' },
];

function fixture() {
  const manifest = {
    schema_version: 1,
    atlases: [{ id: 'a', label: 'Atlas A', file: 'a.glb' }, { id: 'b', label: 'Atlas B', file: 'b.glb' }],
    structures: { file: 'structures.glb' },
    regions,
  };
  const loads = [];
  const loader = {
    async loadAsync(file) {
      loads.push(file);
      const scene = new Group();
      const atlasId = file === 'structures.glb' ? 'aseg' : file[0];
      for (const [index, region] of regions.filter(region => region.atlas === atlasId).entries()) {
        const mesh = new Mesh(new BoxGeometry(0.01, 0.01, 0.01), new MeshStandardMaterial());
        mesh.position.x = index * 0.03;
        mesh.userData = { ...region, region_id: region.id };
        scene.add(mesh);
      }
      return { scene };
    },
  };
  return { atlas: new BrainAtlas(manifest, loader), loads };
}

test('switches one atlas at a time, caches geometry, and keeps shared anatomy', async () => {
  const { atlas, loads } = fixture();
  await atlas.initialize('a');
  assert.equal(atlas.state.atlas, 'a');
  assert.equal(atlas.visibleMeshes.length, 4);
  await atlas.setAtlas('b');
  assert.equal(atlas.visibleMeshes.length, 2);
  assert.ok(atlas.visibleMeshes.some(mesh => mesh.userData.region_id === 'stem'));
  await atlas.setAtlas('a');
  assert.deepEqual(loads.sort(), ['a.glb', 'b.glb', 'structures.glb']);
  assert.equal(atlas.group.children.filter(group => group.visible).length, 2);
  atlas.dispose();
  assert.equal(atlas.group.children.length, 0);
});

test('selection events carry source metadata; medial wall cannot become a region', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  let selected;
  atlas.addEventListener('selectionchange', event => { selected = event.detail; });
  atlas.select('a-left');
  assert.equal(selected.source_label_id, 1);
  assert.equal(atlas.state.selectedRegion.id, 'a-left');
  assert.throws(() => atlas.select('a-wall'), /non-region/i);
  assert.throws(() => atlas.select('b-left'), /visible/i);
  atlas.setHemisphere('right');
  assert.equal(atlas.state.selectedRegion, null);
  assert.equal(selected, null);
  assert.deepEqual(atlas.visibleMeshes.map(mesh => mesh.userData.region_id).sort(), ['a-right', 'stem']);
  atlas.dispose();
});

test('neutral cortex and optional atlas colors change appearance without geometry changes', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  const mesh = atlas.visibleMeshes.find(mesh => mesh.userData.region_id === 'a-left');
  const geometry = mesh.geometry;
  const neutral = mesh.material.color.getHex();
  atlas.setAtlasColors(true);
  assert.equal(mesh.material.color.getHex(), 0xffffff);
  assert.notEqual(neutral, 0xffffff);
  assert.equal(mesh.geometry, geometry);
  const structure = atlas.visibleMeshes.find(mesh => mesh.userData.kind === 'structure');
  assert.equal(structure.material.color.getHex(), 0xffffff);
  atlas.setAtlasColors(false);
  assert.equal(mesh.material.color.getHex(), neutral);
  assert.notEqual(structure.material.color.getHex(), 0xffffff);
  atlas.dispose();
});

test('isolation, visibility and reset preserve coordinates and restore the full view', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  atlas.select('a-right');
  const mesh = atlas.visibleMeshes.find(mesh => mesh.userData.region_id === 'a-right');
  const position = mesh.position.clone();
  atlas.isolate();
  assert.deepEqual(atlas.visibleMeshes, [mesh]);
  atlas.reset();
  assert.equal(atlas.visibleMeshes.length, 4);
  assert.ok(mesh.position.equals(position));
  atlas.setCortexOpacity(0.3);
  assert.equal(mesh.material.opacity, 0.3);
  atlas.setCortexVisible(false);
  assert.deepEqual(atlas.visibleMeshes.map(mesh => mesh.userData.region_id), ['stem']);
  assert.throws(() => atlas.setCortexOpacity(1.1), /opacity/i);
  atlas.dispose();
});

test('picking respects hemisphere visibility and leaves unlabeled cortex unselectable', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  atlas.group.updateMatrixWorld(true);
  const raycaster = new Raycaster(new Vector3(0.03, 0, 0.1), new Vector3(0, 0, -1));
  assert.equal(atlas.pick(raycaster).id, 'a-right');
  atlas.setHemisphere('left');
  assert.equal(atlas.pick(raycaster), null);
  raycaster.ray.origin.x = 0.06;
  assert.equal(atlas.pick(raycaster), null);
  atlas.dispose();
});

test('accelerated picking preserves original indices, positions, and hit region', async () => {
  const { atlas } = fixture();
  const raw = await atlas.loader.loadAsync('a.glb');
  const original = raw.scene.children[1].geometry;
  const positions = original.attributes.position.array.slice();
  const indices = original.index.array.slice();
  await atlas.initialize('a');
  const mesh = atlas.visibleMeshes.find(mesh => mesh.userData.region_id === 'a-right');
  assert.ok(mesh.geometry.boundsTree, 'every loaded mesh must have a spatial index');
  assert.deepEqual(mesh.geometry.attributes.position.array, positions);
  assert.deepEqual(mesh.geometry.index.array, indices);
  const ray = new Raycaster(new Vector3(.03, 0, .1), new Vector3(0, 0, -1));
  ray.firstHitOnly = true;
  assert.equal(atlas.pick(ray).id, 'a-right');
  atlas.dispose();
});
