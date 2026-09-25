import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { BoxGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { visibilityOf } from '../catalog/visibility.js';
import { BrainAtlas, SURFACE_COLORS } from './brain-atlas.js';
import { TissueSections } from '../tissues/gpu-sections.js';
import { Volume } from '../slices/volume.js';

test('MRI is an explicit appearance and requires registered data', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  assert.ok(SURFACE_COLORS.includes('mri'));
  assert.throws(() => atlas.setSurfaceColor('mri'), /MRI.*load/i);
  atlas.dispose();
});

test('MRI preserves picking and shares its scan with later-loaded surface layers', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  const sections = new TissueSections(atlas, new URL('https://example.invalid/'));
  const volume = new Volume({ shape: [2, 2, 2], order: 'F',
    voxel_to_surface_ras_mm: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]],
  }, new Uint8Array(8).fill(100));
  sections.anatomy = sections.createAnatomy(volume);
  sections.setWindow(90, 180);
  atlas.setMriAnatomy(sections.anatomy);
  const ray = new Raycaster(new Vector3(.03, 0, .1), new Vector3(0, 0, -1));
  atlas.select('a-right');
  atlas.setSurfaceColor('mri');
  assert.equal(atlas.pick(ray).id, 'a-right');
  assert.equal(atlas.state.selectedRegion.id, 'a-right');
  await atlas.setAtlas('b');
  for (const mesh of atlas.visibleMeshes) {
    const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>',
      fragmentShader: '#include <opaque_fragment>' };
    mesh.material.onBeforeCompile(shader);
    assert.equal(shader.uniforms.scanEnabled.value, true);
    assert.equal(shader.uniforms.scanVolume.value, sections.anatomy.texture);
  }
  atlas.setSurfaceColor('tissue');
  assert.equal(sections.anatomy.mriUniforms.scanEnabled.value, false);
  sections.dispose();
  atlas.dispose();
});

const { appearance } = parse(readFileSync(new URL('../../config/model.yaml', import.meta.url), 'utf8'));

const regions = [
  { id: 'a-left', label: 'A left', hemisphere: 'left', atlas: 'a', source_label_id: 1, kind: 'cortex' },
  { id: 'a-right', label: 'A right', hemisphere: 'right', atlas: 'a', source_label_id: 2, kind: 'cortex' },
  { id: 'a-wall', label: 'Unlabeled', hemisphere: 'left', atlas: 'a', source_label_id: 0, kind: 'non-region' },
  { id: 'b-left', label: 'B left', hemisphere: 'left', atlas: 'b', source_label_id: 1, kind: 'cortex' },
  { id: 'stem', label: 'Brainstem', hemisphere: 'midline', atlas: 'aseg', source_label_id: 16, kind: 'structure' },
  // Cut-only: it belongs to no GLB, so the loader never makes a mesh for it.
  { id: 'n-left', label: 'N left', hemisphere: 'left', atlas: 'n', source_label_id: 48,
    kind: 'tissue-region' },
];

function fixture() {
  const manifest = {
    schema_version: 1,
    appearance,
    anatomy: { id: 'bert', subject: 'bert', display_name: 'Subject', individual: true },
    atlases: [{ id: 'a', label: 'Atlas A', file: 'a.glb' }, { id: 'b', label: 'Atlas B', file: 'b.glb' }],
    detail_levels: [{ id: 'aseg', label: 'Coarse', file: 'structures.glb' }],
    regions,
  };
  const loads = [];
  const loader = {
    async loadAsync(file, onProgress) {
      loads.push(file);
      onProgress?.({ loaded: 10, total: 20 });
      onProgress?.({ loaded: 20, total: 20 });
      const scene = new Group();
      const atlasId = file === 'structures.glb' ? 'aseg' : file[0];
      for (const [index, region] of regions.filter(region => region.atlas === atlasId).entries()) {
        const mesh = new Mesh(new BoxGeometry(0.01, 0.01, 0.01), new MeshStandardMaterial({ side: DoubleSide }));
        for (const name of ['_sulc', '_concavity', '_t1']) {
          mesh.geometry.setAttribute(name, new Float32BufferAttribute(
            new Float32Array(mesh.geometry.attributes.position.count), 1));
        }
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

test('neutral anatomy preserves picking and isolation through atlas color changes', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  assert.equal(atlas.state.surfaceColor, 'atlas');
  const mesh = atlas.visibleMeshes.find(mesh => mesh.userData.region_id === 'a-right');
  const positions = mesh.geometry.attributes.position.array.slice();
  const indices = mesh.geometry.index.array.slice();
  const ray = new Raycaster(new Vector3(0.03, 0, 0.1), new Vector3(0, 0, -1));
  const neutral = parseInt(appearance.tissue.cortex.slice(1), 16);
  assert.equal(mesh.material.color.getHex(), 0xffffff);
  atlas.select(atlas.pick(ray).id);
  atlas.isolate();
  for (const mode of ['tissue', 'atlas', 'tissue']) {
    atlas.setSurfaceColor(mode);
    assert.equal(mesh.material.userData.tissueVariation.value,
      mode === 'tissue' ? appearance.intensity.surface_strength : 0);
    assert.equal(mesh.material.color.getHex(), mode === 'atlas' ? 0xffffff : neutral);
    assert.equal(atlas.pick(ray).id, 'a-right');
    assert.equal(atlas.state.selectedRegion.id, 'a-right');
    assert.deepEqual(atlas.visibleMeshes, [mesh]);
    assert.deepEqual(mesh.geometry.attributes.position.array, positions);
    assert.deepEqual(mesh.geometry.index.array, indices);
  }
  atlas.reset();
  assert.equal(atlas.state.surfaceColor, 'atlas');
  assert.equal(mesh.material.color.getHex(), 0xffffff);
  atlas.dispose();
});

test('rejects cortex missing source morphometry instead of silently losing relief', async () => {
  const { atlas } = fixture();
  const load = atlas.loader.loadAsync;
  atlas.loader.loadAsync = async file => {
    const result = await load(file);
    result.scene.traverse(mesh => {
      if (mesh.isMesh) mesh.geometry.deleteAttribute('_sulc');
    });
    return result;
  };
  await assert.rejects(atlas.initialize('a'), /_sulc/);
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

test('selection leaves the material untouched, so atlas colour stays the datum', async () => {
  // With atlas colours on, a region's colour encodes atlas identity. Tinting
  // the selection would alter the value being read, so selection is signalled
  // by the outline pass alone.
  const { atlas } = fixture();
  await atlas.initialize('a');
  atlas.setSurfaceColor('atlas');
  const mesh = atlas.visibleMeshes.find(m => m.userData.region_id === 'a-left');
  const before = {
    colour: mesh.material.color.getHex(),
    emissive: mesh.material.emissive.getHex(),
    intensity: mesh.material.emissiveIntensity,
  };
  atlas.select('a-left');
  assert.equal(mesh.material.color.getHex(), before.colour);
  assert.equal(mesh.material.emissive.getHex(), before.emissive);
  assert.equal(mesh.material.emissiveIntensity, before.intensity);
  atlas.dispose();
});

test('settings is a cheap snapshot that does not walk the scene graph', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  assert.deepEqual(atlas.settings, {
    atlas: 'a', detail: 'aseg', internalSystem: null, internalConstituents: new Set(), cutAtlas: null, cutActive: false,
    hemisphere: 'both', cortexVisible: true, cortexOpacity: 1, internalVisible: true, spinalCordVisible: false,
    surfaceColor: 'atlas', isolatedRegion: null,
  });
  assert.ok(!('visibleMeshCount' in atlas.settings));
  assert.equal(atlas.state.visibleMeshCount, 4);

  atlas.setInternalVisible(false);
  assert.equal(atlas.settings.internalVisible, false);
  assert.equal(atlas.state.visibleMeshCount, 3);

  atlas.setInternalVisible(true);
  assert.equal(atlas.settings.internalVisible, true);
  assert.equal(atlas.state.visibleMeshCount, 4);
  atlas.dispose();
});

test('mesh visibility agrees with the shared rule for every region', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  atlas.setHemisphere('left');
  for (const [id, layer] of atlas.layers) {
    for (const mesh of layer.meshes) {
      const region = atlas.regions.get(mesh.userData.region_id);
      const expected = visibilityOf(region, atlas.settings).visible;
      assert.equal(mesh.visible && layer.scene.visible, expected,
        `${id}/${region.id} disagreed with the shared visibility rule`);
    }
  }
  atlas.dispose();
});

test('load progress is reported while a layer downloads', async () => {
  const seen = [];
  const { atlas } = fixture();
  await atlas.initialize('a', event => seen.push({ loaded: event.loaded, total: event.total }));
  assert.deepEqual(seen.at(-1), { loaded: 40, total: 40 }, 'both layers share one bar');
  assert.ok(seen.some(event => event.loaded === 10 && event.total === 20));
  atlas.dispose();
});

test('initialize fetches the atlas and internal anatomy together', async () => {
  const { atlas, loads } = fixture();
  const original = atlas.loader.loadAsync;
  let started = 0;
  let released;
  const gate = new Promise(resolve => { released = resolve; });
  atlas.loader.loadAsync = async (file, onProgress) => {
    started += 1;
    await gate;
    return original(file, onProgress);
  };
  const pending = atlas.initialize('a');
  await Promise.resolve();
  assert.equal(started, 2, 'both downloads must have started before either finishes');
  released();
  await pending;
  assert.deepEqual(loads.sort(), ['a.glb', 'structures.glb']);
  atlas.dispose();
});

test('initialize can open a named detail level without fetching another', async () => {
  const { atlas, loads } = fixture();
  atlas.manifest.detail_levels.push({ id: 'nextbrain', label: 'Fine', file: 'nextbrain.glb' });
  await atlas.initialize('a', { detail: 'aseg' });
  assert.equal(atlas.state.detail, 'aseg');
  assert.ok(!loads.includes('nextbrain.glb'));
  atlas.dispose();
});

test('isolation can be released without disturbing any other setting', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  atlas.setCortexOpacity(0.5);
  atlas.select('a-right');
  atlas.isolate();
  assert.equal(atlas.state.isolatedRegion, 'a-right');
  atlas.clearIsolation();
  assert.equal(atlas.state.isolatedRegion, null);
  assert.equal(atlas.state.selectedRegion.id, 'a-right', 'selection survives');
  assert.equal(atlas.state.cortexOpacity, 0.5, 'other settings are untouched');
  assert.equal(atlas.visibleMeshes.length, 4);
  atlas.dispose();
});

test('cut picking skips discarded front faces and finds the retained back face', async () => {
  const { Plane } = await import('three');
  const { atlas } = fixture();
  await atlas.initialize('a');
  const mesh = atlas.visibleMeshes.find(m => m.userData.region_id === 'a-right');
  const positions = mesh.geometry.attributes.position.array.slice();
  const indices = mesh.geometry.index.array.slice();
  const ray = new Raycaster(new Vector3(.03, 0, .1), new Vector3(0, 0, -1));
  ray.firstHitOnly = true;
  atlas.setClippingPlanes([new Plane(new Vector3(0, 0, -1), 0)]);
  assert.equal(atlas.pick(ray).id, 'a-right', 'discarded nearest face must not mask the retained face');
  assert.equal(ray.firstHitOnly, true, 'caller ray configuration survives');
  atlas.setClippingPlanes([new Plane(new Vector3(0, 0, -1), -.02)]);
  assert.equal(atlas.pick(ray), null, 'fully discarded mesh must not be clickable');
  await atlas.setAtlas('b');
  assert.equal(atlas.visibleMeshes[0].material.clippingPlanes.length, 1);
  atlas.reset();
  assert.equal(atlas.clippingPlanes.length, 0);
  assert.deepEqual(mesh.geometry.attributes.position.array, positions);
  assert.deepEqual(mesh.geometry.index.array, indices);
  atlas.dispose();
});

test('picking stops at the first surface and still reaches past a clipped one', async () => {
  const { Plane } = await import('three');
  const { atlas } = fixture();
  await atlas.initialize('a');
  const far = atlas.visibleMeshes.find(mesh => mesh.userData.region_id === 'a-wall');
  const kept = atlas.visibleMeshes.find(mesh => mesh.userData.region_id === 'a-right');
  let farCasts = 0;
  let keptCasts = 0;
  const farRaycast = far.raycast.bind(far);
  const keptRaycast = kept.raycast.bind(kept);
  far.raycast = (raycaster, hits) => { farCasts += 1; farRaycast(raycaster, hits); };
  kept.raycast = (raycaster, hits) => { keptCasts += 1; keptRaycast(raycaster, hits); };
  const ray = new Raycaster(new Vector3(-0.1, 0, 0), new Vector3(1, 0, 0));
  ray.firstHitOnly = true;
  const nearest = atlas.pick(ray);
  assert.ok(nearest.id === 'a-left' || nearest.id === 'stem');
  assert.equal(farCasts, 0, 'a box behind the hit is not tested');
  assert.equal(keptCasts, 0, 'a box behind the hit is not tested');

  atlas.setClippingPlanes([new Plane(new Vector3(1, 0, 0), -0.02)]);
  assert.equal(atlas.pick(ray).id, 'a-right', 'a clipped nearer mesh does not hide the one behind it');
  assert.ok(keptCasts > 0);
  assert.equal(ray.firstHitOnly, true);
  atlas.dispose();
});

test('a cut-only region can be selected and is not dropped on the next update', async () => {
  // Regression: `select` accepted it and `update` immediately cleared it again,
  // because only one of the two knew that these regions have no mesh. The drop
  // raised nothing, so the selection simply vanished.
  const { atlas } = fixture();
  await atlas.initialize('a');
  atlas.setCutState({ atlas: 'n', active: true });
  const dropped = [];
  atlas.addEventListener('selectionchange', event => dropped.push(event.detail));

  atlas.select('n-left');
  assert.equal(atlas.state.selectedRegion?.id, 'n-left');
  atlas.update();
  assert.equal(atlas.state.selectedRegion?.id, 'n-left', 'survives a redraw');
  assert.deepEqual(dropped.filter(detail => detail === null), []);
});

test('a cut-only region still obeys the constraints the model does own', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  atlas.setCutState({ atlas: 'n', active: true });
  atlas.setHemisphere('right');
  assert.throws(() => atlas.select('n-left'), /not visible/);

  // And an existing selection is dropped when one of those constraints changes.
  atlas.setHemisphere('both');
  atlas.select('n-left');
  atlas.setHemisphere('right');
  assert.equal(atlas.state.selectedRegion, null);
});

test('a cut-only region is unselectable once the cut stops showing it', () => {
  // It has no mesh, so the cut is the only thing that can put it on screen.
  const { atlas } = fixture();
  return atlas.initialize('a').then(() => {
    atlas.setCutState({ atlas: 'n', active: true });
    atlas.select('n-left');
    atlas.setCutState({ atlas: 'n', active: false });
    assert.equal(atlas.state.selectedRegion, null);
    assert.throws(() => atlas.select('n-left'), /not visible/);
  });
});

test('an out-of-date manifest names the field it is missing, not the schema', () => {
  // The failure this actually reports is a manifest cached from an earlier
  // deploy, so the message has to point at the field that is gone.
  const good = {
    schema_version: 1,
    atlases: [{ id: 'a', label: 'A', file: 'a.glb' }],
    detail_levels: [{ id: 'aseg', label: 'Coarse', file: 'structures.glb' }],
    regions: [],
  };
  const loader = { async loadAsync() { return { scene: new Group() }; } };

  const { detail_levels, ...stale } = good;
  assert.throws(() => new BrainAtlas(stale, loader), /detail_levels/);
  assert.throws(() => new BrainAtlas({ ...good, atlases: [] }, loader), /atlases/);
  assert.throws(() => new BrainAtlas({ ...good, schema_version: 2 }, loader),
    /schema_version 1/);
  // The viewer names the subject whose brain this is, so a manifest that has
  // stopped saying which brain it is cannot be shown under the old label.
  assert.throws(() => new BrainAtlas({ ...good, anatomy: { id: 'bert' } }, loader),
    /anatomy/);
  // `individual` decides how the viewer describes the brain, so a manifest that
  // omits it would silently describe it as the other kind.
  assert.throws(() => new BrainAtlas(
    { ...good, anatomy: { subject: 'bert', display_name: 'Subject' } }, loader), /anatomy/);
  // And it says what to do about it.
  assert.throws(() => new BrainAtlas(stale, loader), /cache/i);
});

test('centroidOf computes and caches surface RAS millimeter coordinates', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  const coords = atlas.centroidOf('a-left');
  assert.ok(Array.isArray(coords) && coords.length === 3);
  assert.ok(coords.every(Number.isFinite));
  // Cached on subsequent access
  assert.strictEqual(atlas.centroidOf('a-left'), coords);
  assert.strictEqual(atlas.centroidOf('nonexistent'), null);
  atlas.dispose();
});
