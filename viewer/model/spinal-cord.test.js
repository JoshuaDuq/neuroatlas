import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { Color, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BrainAtlas } from './brain-atlas.js';
import { createCatalog } from '../catalog/catalog.js';
import { visibilityOf } from '../catalog/visibility.js';
import { SolidSections } from '../tissues/solid-sections.js';
import { addSolidSources, indexLabels, paintSolids } from '../tissues/solid-assets.js';

const directory = new URL('../../public/models/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
const assembly = manifest.regions.filter(region => region.atlas === 'zanatomy');
const cord = assembly.find(region => region.id === 'zanatomy:midline:cord');
const loader = { async loadAsync(file) {
  const bytes = await readFile(new URL(file, directory));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength), '');
} };

/** A point inside the cord at a given height, superior being +Y in the glTF frame. */
function slabCentre(mesh, fraction) {
  const position = mesh.geometry.attributes.position;
  let low = Infinity, high = -Infinity;
  for (let at = 0; at < position.count; at++) {
    low = Math.min(low, position.getY(at));
    high = Math.max(high, position.getY(at));
  }
  const height = low + (high - low) * fraction;
  const band = (high - low) * 0.02;
  const centre = new Vector3();
  let found = 0;
  for (let at = 0; at < position.count; at++) {
    const y = position.getY(at);
    if (Math.abs(y - height) > band) continue;
    centre.add(new Vector3(position.getX(at), y, position.getZ(at)));
    found += 1;
  }
  assert.ok(found > 8, 'no cross-section at that height');
  return centre.divideScalar(found);
}

test('the whole cord assembly is published as one supplemental system', () => {
  assert.ok(cord, 'The published model must include a spinal cord');
  assert.equal(assembly.length, manifest.supplemental_layers[0].region_count);
  for (const region of assembly) {
    assert.equal(region.supplemental, true);
    assert.equal(region.mri_registered, false);
    assert.equal(region.system_names.en, 'Spinal cord');
  }
  // Grey horns, roots and ganglia are what a straightened template cannot carry.
  for (const id of ['zanatomy:left:anterior-horn', 'zanatomy:left:posterior-horn',
    'zanatomy:left:anterior-root', 'zanatomy:right:posterior-root',
    'zanatomy:left:spinal-ganglion', 'zanatomy:midline:cauda-equina']) {
    assert.ok(assembly.some(region => region.id === id), `missing ${id}`);
  }
});

test('reference cord is searchable, selectable and isolatable in every detail level', async () => {
  const model = new BrainAtlas(manifest, loader);
  await model.initialize('destrieux');
  model.setSpinalCordVisible(true);
  const catalog = createCatalog(manifest);
  for (const level of manifest.detail_levels) {
    await model.setDetail(level.id);
    assert.ok(model.visibleMeshes.some(mesh => mesh.userData.region_id === cord.id));
    assert.equal(catalog.search('spinal cord', model.state).rows[0].region.id, cord.id);
    assert.ok(catalog.groups(model.state).some(group => group.rows.some(row => row.region.id === cord.id)));
    model.setCortexVisible(false);
    model.setHemisphere('left');
    model.setInternalSystem('Spinal cord');
    assert.equal(visibilityOf(cord, model.settings).visible, true);
    model.select(cord.id);
    model.isolate();
    assert.deepEqual(model.visibleMeshes.map(mesh => mesh.userData.region_id), [cord.id]);
    model.clearIsolation();
    model.setInternalSystem(null);
  }
  assert.equal(catalog.search('moelle epiniere', { ...model.state, lang: 'fr' }).rows[0].region.id, cord.id);
  assert.equal(catalog.search('cauda equina', model.state).rows[0].region.id,
    'zanatomy:midline:cauda-equina');
  model.dispose();
});

test('a lateral root follows the hemisphere filter its own side declares', async () => {
  const model = new BrainAtlas(manifest, loader);
  await model.initialize('destrieux');
  model.setSpinalCordVisible(true);
  const left = assembly.find(region => region.id === 'zanatomy:left:anterior-root');
  const right = assembly.find(region => region.id === 'zanatomy:right:anterior-root');
  model.setHemisphere('left');
  assert.equal(visibilityOf(left, model.settings).visible, true);
  assert.equal(visibilityOf(right, model.settings).visible, false);
  model.setHemisphere('right');
  assert.equal(visibilityOf(right, model.settings).visible, true);
  // The cord itself is midline, so neither side hides it.
  assert.equal(visibilityOf(cord, model.settings).visible, true);
  model.dispose();
});

test('spinal cord visibility toggle hides meshes and prevents selection', async () => {
  const model = new BrainAtlas(manifest, loader);
  await model.initialize('destrieux');
  assert.equal(model.settings.spinalCordVisible, false);
  assert.ok(!model.visibleMeshes.some(mesh => mesh.userData.atlas === 'zanatomy'));

  model.setSpinalCordVisible(true);
  assert.ok(model.visibleMeshes.some(mesh => mesh.userData.region_id === cord.id));

  model.setSpinalCordVisible(false);
  assert.equal(model.settings.spinalCordVisible, false);
  assert.ok(!model.visibleMeshes.some(mesh => mesh.userData.atlas === 'zanatomy'));
  assert.equal(visibilityOf(cord, model.settings).visible, false);
  assert.equal(visibilityOf(cord, model.settings).reason, 'spinal-cord-hidden');
  assert.throws(() => model.select(cord.id), /Region is not visible/);

  model.setSpinalCordVisible(true);
  assert.equal(model.settings.spinalCordVisible, true);
  assert.ok(model.visibleMeshes.some(mesh => mesh.userData.region_id === cord.id));
  assert.equal(visibilityOf(cord, model.settings).visible, true);
  model.select(cord.id);
  assert.equal(model.state.selectedRegion?.id, cord.id);

  model.dispose();
});

test('the grey horns cap as grey matter against the cord that surrounds them', async () => {
  const { scene } = await loader.loadAsync('spinal-cord.glb');
  const horn = scene.children.find(child =>
    child.userData.region_id === 'zanatomy:left:anterior-horn');
  const sections = new SolidSections();
  addSolidSources(sections, [horn], {}, manifest.appearance, 2);
  paintSolids(sections, { labels: indexLabels([]),
    state: { surfaceColor: 'tissue', hemisphere: 'both', isolatedRegion: null },
    atlas: 'nextbrain', detail: 'learning', wedged: false,
    appearance: manifest.appearance,
    lookup: { regions: new Map(assembly.map(region => [region.id, region])) } });
  assert.ok(sections.solids[0].cap.material.color
    .equals(new Color(manifest.appearance.tissue.gray)));
  sections.dispose();
});

test('published cord caps have no subject MRI shading and remain pickable at the lower end', async () => {
  const { scene } = await loader.loadAsync('spinal-cord.glb');
  const source = scene.children.find(child => child.isMesh
    && child.userData.region_id === cord.id);
  const sections = new SolidSections();
  addSolidSources(sections, [source], {}, manifest.appearance, 2);
  const solid = sections.solids[0];
  for (const surfaceColor of ['tissue', 'atlas', 'network']) {
    paintSolids(sections, { labels: indexLabels([]),
      state: { surfaceColor, hemisphere: 'right', isolatedRegion: cord.id },
      atlas: 'nextbrain', detail: 'learning', wedged: false,
      appearance: manifest.appearance, lookup: { regions: new Map([[cord.id, cord]]) } });
    assert.equal(solid.visible, true);
    assert.equal(solid.cap.material.userData.tissueVariation.value, 0);
    assert.equal(solid.cap.material.userData.tissueRelief.value, 0);
    // The cord's surface is its white matter, and the tissue palette classes it
    // as such; only the published atlas colour overrides that.
    assert.ok(solid.cap.material.color.equals(surfaceColor === 'atlas'
      ? source.material.color
      : new Color(manifest.appearance.tissue.white)));
  }
  const { Plane } = await import('three');
  // Near the conus, where a straight template has nothing and where the curve
  // has carried the cord well away from the centre of its own bounding box.
  const point = slabCentre(source, 0.12);
  for (const normal of [new Vector3(1, 0, 0), new Vector3(0, 1, 0),
    new Vector3(0, 0, 1), new Vector3(1, 1, 1).normalize()]) {
    for (const side of [-1, 1]) {
      const direction = normal.clone().multiplyScalar(side);
      sections.update(new Plane().setFromNormalAndCoplanarPoint(direction, point));
      const ray = new Raycaster(point.clone().addScaledVector(direction, 0.1), direction.negate());
      assert.equal(sections.intersect(ray)?.region, cord.id);
    }
  }
  sections.dispose();
});
