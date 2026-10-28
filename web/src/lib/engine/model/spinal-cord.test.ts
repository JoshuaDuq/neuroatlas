import assert from 'node:assert/strict';
import { afterAll, afterEach, beforeAll, test } from 'vitest';
import { Color, Mesh, Plane, Raycaster, Vector3 } from 'three';
import type { Group } from 'three';
import type { Region } from '../../types/index.ts';
import { createCatalog } from '../../core/catalog/catalog.ts';
import type { CatalogSettings } from '../../core/catalog/catalog.ts';
import { visibilityOf } from '../../core/catalog/visibility.ts';
import { SolidSections } from '../tissues/solid-sections.ts';
import type { SolidSource } from '../tissues/solid-sections.ts';
import { addSolidSources, indexLabels, paintSolids } from '../tissues/solid-assets.ts';
import type { SolidSourceAnatomy } from '../tissues/solid-assets.ts';
import { BrainAtlas } from './brain-atlas.ts';
import { modelDirectory, publishedLoader, readManifest } from './test-support.ts';

// Only cdmd publishes a cord: its scan reaches below the medulla.
const published = 'cdmd';

const manifest = readManifest(published);
const loader = publishedLoader(modelDirectory(published));
const assembly = manifest.regions.filter((region) => region.atlas === 'pam50');
const GRACILE = 'pam50:left:gracile-fasciculus';
const tract = assembly.find((region) => region.id === GRACILE)!;
const solidAnatomy = {} as SolidSourceAnatomy;
/** One model on the published anatomy, shared by the cases and put back to its default view by `reset()`. */
let model: BrainAtlas;
let cordScene: Group;
let beforeShowing: { loaded: boolean; drawn: boolean; shown: boolean };

beforeAll(async () => {
  model = new BrainAtlas(manifest, loader);
  await model.initialize('destrieux');
  // The cord is a hidden layer: nothing of it downloads until it is shown.
  beforeShowing = {
    loaded: model.layers.has('pam50'),
    drawn: model.visibleMeshes.some((mesh) => mesh.userData['atlas'] === 'pam50'),
    shown: model.settings.spinalCordVisible,
  };
  await model.setSpinalCordVisible(true);
  cordScene = (await loader.loadAsync('spinal-cord.glb')).scene;
}, 120_000);

afterEach(async () => {
  model.reset();
  await model.setDetail(model.defaultDetail);
});

afterAll(() => model.dispose());

const asSettings = (atlas: BrainAtlas) => atlas.state as unknown as CatalogSettings;

/** A point inside a region at a given height, superior being +Y in the glTF frame. */
function slabCentre(mesh: Mesh, fraction: number) {
  const position = mesh.geometry.attributes['position']!;
  let low = Infinity;
  let high = -Infinity;
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

test('the cord is published as one supplemental system registered to the MRI', () => {
  assert.equal(assembly.length, manifest.supplemental_layers![0]!.region_count);
  for (const region of assembly) {
    assert.equal(region.supplemental, true);
    assert.equal(region.mri_registered, true);
    assert.equal(region.system_names!['en'], 'Spinal cord');
    assert.ok(region.hemisphere === 'left' || region.hemisphere === 'right', region.id);
  }
  for (const id of [
    'gracile-fasciculus',
    'lateral-corticospinal-tract',
    'ventral-horn',
    'dorsal-horn',
  ]) {
    for (const side of ['left', 'right']) {
      assert.ok(
        assembly.some((region) => region.id === `pam50:${side}:${id}`),
        `missing ${side} ${id}`,
      );
    }
  }
});

test(
  'a cord tract is searchable, selectable and isolatable in every detail level',
  { timeout: 120_000 },
  async () => {
    await model.setSpinalCordVisible(true);
    const catalog = createCatalog(manifest);
    for (const level of manifest.detail_levels) {
      await model.setDetail(level.id);
      assert.ok(model.visibleMeshes.some((mesh) => mesh.userData['region_id'] === GRACILE));
      assert.ok(
        catalog
          .search('gracile fasciculus', asSettings(model))
          .rows.some((row) => row.region.id === GRACILE),
      );
      assert.ok(
        catalog
          .groups(asSettings(model))
          .some((group) => group.rows.some((row) => row.region.id === GRACILE)),
      );
      model.setCortexVisible(false);
      model.setHemisphere('left');
      model.setInternalSystem('Spinal cord');
      assert.equal(visibilityOf(tract, model.settings).visible, true);
      model.select(GRACILE);
      model.isolate();
      assert.deepEqual(
        model.visibleMeshes.map((mesh) => mesh.userData['region_id']),
        [GRACILE],
      );
      model.clearIsolation();
      model.setInternalSystem(null);
    }
    assert.ok(
      catalog
        .search('faisceau gracile', { ...asSettings(model), lang: 'fr' })
        .rows.some((row) => row.region.id === GRACILE),
    );
  },
);

test('each side of the cord follows the hemisphere filter', async () => {
  await model.setSpinalCordVisible(true);
  const right = assembly.find((region) => region.id === 'pam50:right:gracile-fasciculus')!;
  model.setHemisphere('left');
  assert.equal(visibilityOf(tract, model.settings).visible, true);
  assert.equal(visibilityOf(right, model.settings).visible, false);
  model.setHemisphere('right');
  assert.equal(visibilityOf(right, model.settings).visible, true);
  assert.equal(visibilityOf(tract, model.settings).visible, false);
});

test('spinal cord visibility toggle hides meshes and prevents selection', async () => {
  assert.deepEqual(beforeShowing, { loaded: false, drawn: false, shown: false });

  await model.setSpinalCordVisible(true);
  assert.ok(model.visibleMeshes.some((mesh) => mesh.userData['region_id'] === GRACILE));

  await model.setSpinalCordVisible(false);
  assert.equal(model.settings.spinalCordVisible, false);
  assert.ok(!model.visibleMeshes.some((mesh) => mesh.userData['atlas'] === 'pam50'));
  assert.equal(visibilityOf(tract, model.settings).visible, false);
  assert.equal(visibilityOf(tract, model.settings).reason, 'spinal-cord-hidden');
  assert.throws(() => model.select(GRACILE), /Region is not visible/);

  await model.setSpinalCordVisible(true);
  assert.equal(model.settings.spinalCordVisible, true);
  assert.ok(model.visibleMeshes.some((mesh) => mesh.userData['region_id'] === GRACILE));
  assert.equal(visibilityOf(tract, model.settings).visible, true);
  model.select(GRACILE);
  assert.equal(model.state.selectedRegion?.id, GRACILE);
});

test('the grey matter caps as grey and a tract as white', async () => {
  const sources = ['pam50:left:ventral-horn', GRACILE].map(
    (id) => cordScene.children.find((child) => child.userData['region_id'] === id) as SolidSource,
  );
  const sections = new SolidSections();
  addSolidSources(sections, sources, solidAnatomy, manifest.appearance, 2);
  paintSolids(
    sections as never,
    {
      labels: indexLabels([]),
      state: { surfaceColor: 'tissue', hemisphere: 'both', isolatedRegion: null },
      atlas: 'nextbrain',
      detail: 'learning',
      wedged: false,
      appearance: manifest.appearance,
      lookup: { regions: new Map(assembly.map((region) => [region.id, region])) },
    } as never,
  );
  assert.ok(
    sections.solids[0]!.cap.material.color.equals(new Color(manifest.appearance.tissue.gray)),
  );
  assert.ok(
    sections.solids[1]!.cap.material.color.equals(new Color(manifest.appearance.tissue.white)),
  );
  sections.dispose();
});

test(
  'registered cord caps keep MRI colour and stay pickable across any plane',
  { timeout: 120_000 },
  async () => {
    const source = cordScene.children.find(
      (child) => (child as Mesh).isMesh && child.userData['region_id'] === GRACILE,
    ) as SolidSource;
    const sections = new SolidSections();
    addSolidSources(sections, [source], solidAnatomy, manifest.appearance, 2);
    const solid = sections.solids[0]!;
    paintSolids(
      sections as never,
      {
        labels: indexLabels([]),
        state: { surfaceColor: 'mri', hemisphere: 'both', isolatedRegion: null },
        atlas: 'nextbrain',
        detail: 'learning',
        wedged: false,
        appearance: manifest.appearance,
        lookup: { regions: new Map<string, Region>([[GRACILE, tract]]) },
      } as never,
    );
    // An unregistered solid hides under MRI colour; this one is the subject's own.
    assert.equal(solid.visible, true);
    const point = slabCentre(source, 0.5);
    for (const normal of [
      new Vector3(1, 0, 0),
      new Vector3(0, 1, 0),
      new Vector3(0, 0, 1),
      new Vector3(1, 1, 1).normalize(),
    ]) {
      for (const side of [-1, 1]) {
        const direction = normal.clone().multiplyScalar(side);
        sections.update(new Plane().setFromNormalAndCoplanarPoint(direction, point));
        const ray = new Raycaster(
          point.clone().addScaledVector(direction, 0.1),
          direction.negate(),
        );
        assert.equal(sections.intersect(ray)?.region, GRACILE);
      }
    }
    sections.dispose();
  },
);

test('ATLAS-40 reset cancels a cord show still downloading, and keeps the detail level', async () => {
  await model.setDetail('aseg');
  await model.setSpinalCordVisible(false);
  const shown = model.setSpinalCordVisible(true);
  model.reset();
  await shown;
  assert.equal(model.settings.spinalCordVisible, false);
  assert.equal(model.settings.detail, 'aseg');
});
