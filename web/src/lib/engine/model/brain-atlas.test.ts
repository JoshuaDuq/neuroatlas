import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import {
  BoxGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Plane,
  Raycaster,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { readRepoYaml } from '../../../../test/repo.ts';
import type { Region } from '../../types/index.ts';
import { visibilityOf } from '../../core/catalog/visibility.ts';
import { TissueSections } from '../tissues/gpu-sections.ts';
import { Volume } from '../slices/volume.ts';
import type { Appearance } from '../render/materials.ts';
import { BrainAtlas, SURFACE_COLORS } from './brain-atlas.ts';
import type { AtlasManifest, GlbLoader } from './brain-atlas.ts';

/* oxlint-disable typescript/no-explicit-any -- fixtures stand in for published JSON and mutate the model freely */
type Stub = Record<string, any>;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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
  const volume = new Volume(
    {
      shape: [2, 2, 2],
      order: 'F',
      voxel_to_surface_ras_mm: [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ],
    },
    new Uint8Array(8).fill(100),
  );
  sections.anatomy = sections.createAnatomy(volume);
  sections.setWindow(90, 180);
  atlas.setMriAnatomy(sections.anatomy);
  const ray = new Raycaster(new Vector3(0.03, 0, 0.1), new Vector3(0, 0, -1));
  atlas.select('a-right');
  atlas.setSurfaceColor('mri');
  assert.equal(atlas.pick(ray)!.id, 'a-right');
  assert.equal(atlas.state.selectedRegion!.id, 'a-right');
  await atlas.setAtlas('b');
  for (const mesh of atlas.visibleMeshes) {
    const shader: Stub = {
      uniforms: {},
      vertexShader: '#include <begin_vertex>',
      fragmentShader: '#include <opaque_fragment>',
    };
    mesh.material.onBeforeCompile(shader as never, undefined as never);
    assert.equal(shader.uniforms.scanEnabled.value, true);
    assert.equal(shader.uniforms.scanVolume.value, sections.anatomy.texture);
  }
  atlas.setSurfaceColor('tissue');
  assert.equal(sections.anatomy.mriUniforms.scanEnabled.value, false);
  sections.dispose();
  atlas.dispose();
});

const { appearance } = readRepoYaml<{ appearance: Appearance & Stub }>('config/model.yaml');

const regions = [
  {
    id: 'a-left',
    label: 'A left',
    hemisphere: 'left',
    atlas: 'a',
    source_label_id: 1,
    kind: 'cortex',
    centroid_ras_mm: [-30.5, 12.25, 40],
    anchor_ras_mm: [-31, 12, 41],
  },
  {
    id: 'a-right',
    label: 'A right',
    hemisphere: 'right',
    atlas: 'a',
    source_label_id: 2,
    kind: 'cortex',
  },
  {
    id: 'a-wall',
    label: 'Unlabeled',
    hemisphere: 'left',
    atlas: 'a',
    source_label_id: 0,
    source_name: 'Unknown',
    kind: 'non-region',
  },
  {
    id: 'b-left',
    label: 'B left',
    hemisphere: 'left',
    atlas: 'b',
    source_label_id: 1,
    kind: 'cortex',
  },
  {
    id: 'stem',
    label: 'Brainstem',
    hemisphere: 'midline',
    atlas: 'aseg',
    source_label_id: 16,
    kind: 'structure',
  },
  // Cut-only: it belongs to no GLB, so the loader never makes a mesh for it.
  {
    id: 'n-left',
    label: 'N left',
    hemisphere: 'left',
    atlas: 'n',
    source_label_id: 48,
    kind: 'tissue-region',
  },
] as Region[];

function fixture(
  cabNp: Stub | null = null,
  functional: Stub | null = null,
  domains: Stub | null = null,
) {
  const manifest = {
    schema_version: 1,
    appearance,
    anatomy: { id: 'bert', subject: 'bert', display_name: 'Subject', individual: true },
    atlases: [
      { id: 'a', label: 'Atlas A', file: 'a.glb' },
      { id: 'b', label: 'Atlas B', file: 'b.glb' },
    ],
    detail_levels: [{ id: 'aseg', label: 'Coarse', file: 'structures.glb' }],
    solid_envelopes: { file: 'tissue-envelopes.glb' },
    regions,
  } as unknown as AtlasManifest;
  const loads: string[] = [];
  const loader: GlbLoader = {
    async loadAsync(file, onProgress) {
      loads.push(file);
      onProgress?.({ loaded: 10, total: 20 });
      onProgress?.({ loaded: 20, total: 20 });
      const scene = new Group();
      if (file === 'tissue-envelopes.glb') {
        for (const [index, hemisphere] of ['left', 'right'].entries()) {
          const mesh = new Mesh(new BoxGeometry(0.009, 0.009, 0.009), new MeshStandardMaterial());
          mesh.position.set(index * 0.03, 0, 0.015);
          mesh.userData = { hemisphere, boundary: 'white', units: 'meters' };
          scene.add(mesh);
        }
        return { scene };
      }
      const atlasId = file === 'structures.glb' ? 'aseg' : file[0];
      for (const [index, region] of regions
        .filter((region) => region.atlas === atlasId)
        .entries()) {
        const mesh = new Mesh(
          new BoxGeometry(0.01, 0.01, 0.01),
          new MeshStandardMaterial({ side: DoubleSide }),
        );
        for (const name of ['_sulc', '_concavity', '_t1']) {
          mesh.geometry.setAttribute(
            name,
            new Float32BufferAttribute(
              new Float32Array(mesh.geometry.attributes.position.count),
              1,
            ),
          );
        }
        mesh.position.x = index * 0.03;
        mesh.userData = { ...region, region_id: region.id };
        scene.add(mesh);
      }
      return { scene };
    },
  };
  return {
    atlas: new BrainAtlas(manifest, loader, cabNp as never, functional as never, domains as never),
    loads,
  };
}

for (const request of [
  { atlas: 'missing', options: {}, message: /Unknown atlas: missing/ },
  { atlas: null, options: {}, message: /Unknown atlas: null/ },
  { atlas: 'a', options: { detail: 'missing' }, message: /Unknown detail level: missing/ },
  { atlas: 'a', options: { detail: null }, message: /Unknown detail level: null/ },
]) {
  test(`published loading rejects atlas=${request.atlas}, detail=${request.options.detail}`, async () => {
    const { atlas } = fixture();
    vi.stubGlobal('location', { href: 'https://example.invalid/' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).endsWith('manifest.json'))
        return new Response(JSON.stringify(atlas.manifest));
      throw new Error(`Unrequested default layer download: ${url}`);
    });
    await assert.rejects(
      BrainAtlas.load(
        'https://example.invalid/manifest.json',
        request.atlas as string,
        request.options as never,
      ),
      (error: Error & { code?: string }) =>
        request.message.test(error.message) && error.code === 'unknown-layer',
    );
    atlas.dispose();
  });
}

test('omitted atlas and detail choices use published defaults', async () => {
  const { atlas } = fixture();
  await atlas.initialize();
  assert.equal(atlas.settings.atlas, 'a');
  assert.equal(atlas.settings.detail, 'aseg');
  atlas.dispose();
});

function cordFixture(loadCord: (region: Region) => Promise<{ scene: Group }>) {
  const { atlas, loads } = fixture();
  const cord = {
    id: 'cord',
    label: 'Spinal cord',
    hemisphere: 'midline',
    atlas: 'pam50',
    source_label_id: 1,
    kind: 'structure',
    supplemental: true,
    mri_registered: false,
    system_names: { en: 'Spinal cord', fr: 'Moelle épinière' },
  } as Region;
  atlas.manifest.supplemental_layers = [{ id: 'pam50', file: 'cord.glb' }] as never;
  atlas.manifest.regions = [...atlas.manifest.regions, cord];
  atlas.regions.set(cord.id, cord);
  const loadBrain = atlas.loader.loadAsync.bind(atlas.loader);
  atlas.loader.loadAsync = (file, onProgress) => {
    if (file !== 'cord.glb') return loadBrain(file, onProgress);
    loads.push(file);
    return loadCord(cord);
  };
  return { atlas, loads, cord };
}

function cordScene(cord: Region) {
  const scene = new Group();
  const mesh = new Mesh(new BoxGeometry(0.01, 0.01, 0.01), new MeshStandardMaterial());
  mesh.userData = { ...cord, region_id: cord.id };
  scene.add(mesh);
  return { scene };
}

test('the cord is not downloaded until it is first shown', async () => {
  const { atlas, loads, cord } = cordFixture(async (region) => cordScene(region));
  await atlas.initialize();
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(!loads.includes('cord.glb'));
  assert.equal(atlas.spinalCordLoadState, 'unloaded');
  await atlas.setSpinalCordVisible(true);
  assert.deepEqual(
    loads.filter((file) => file === 'cord.glb'),
    ['cord.glb'],
  );
  assert.ok(atlas.canSelect(cord));
  await atlas.setSpinalCordVisible(false);
  await atlas.setSpinalCordVisible(true);
  assert.equal(loads.filter((file) => file === 'cord.glb').length, 1, 'shown again from memory');
  atlas.dispose();
});

test('a failed cord download leaves the brain alone and the next request retries it', async () => {
  const failure = new Error('Spinal cord request failed: HTTP 503');
  let attempts = 0;
  const { atlas, cord } = cordFixture(async (region) => {
    attempts += 1;
    if (attempts === 1) throw failure;
    return cordScene(region);
  });
  await atlas.initialize();
  await assert.rejects(
    () => atlas.setSpinalCordVisible(true),
    (error) => error === failure,
  );
  assert.equal(atlas.spinalCordLoadState, 'error');
  assert.equal(atlas.spinalCordLoadError, failure);
  assert.equal(atlas.settings.spinalCordVisible, false);
  assert.ok(atlas.visibleMeshes.length > 0);
  assert.equal(atlas.canSelect(cord), false);
  await atlas.setSpinalCordVisible(true);
  assert.equal(attempts, 2);
  assert.equal(atlas.spinalCordLoadState, 'ready');
  assert.equal(atlas.settings.spinalCordVisible, true);
  atlas.select(cord.id);
  atlas.dispose();
});

test('showing the cord awaits its download and blocks selection while pending', async () => {
  let finishDownload!: () => void;
  const { atlas, cord } = cordFixture(
    (region) =>
      new Promise((resolve) => {
        finishDownload = () => resolve(cordScene(region));
      }),
  );
  await atlas.initialize();
  const showing = atlas.setSpinalCordVisible(true);
  assert.equal(atlas.spinalCordLoadState, 'loading');
  assert.equal(atlas.settings.spinalCordVisible, false);
  assert.equal(atlas.canSelect(cord), false);
  assert.throws(() => atlas.select(cord.id), /not visible/);
  finishDownload();
  await showing;
  assert.equal(atlas.spinalCordLoadState, 'ready');
  assert.equal(atlas.settings.spinalCordVisible, true);
  atlas.select(cord.id);
  atlas.isolate();
  atlas.hideRegions([cord.id]);
  assert.equal(atlas.state.selectedRegion, null);
  atlas.undoDissection();
  assert.equal(atlas.state.selectedRegion!.id, cord.id);
  assert.equal(atlas.state.isolatedRegion, cord.id);
  atlas.dispose();
});

test('an unloaded supplemental region cannot be selected even with display flags enabled', async () => {
  let finishDownload!: () => void;
  const { atlas, cord } = cordFixture(
    (region) =>
      new Promise((resolve) => {
        finishDownload = () => resolve(cordScene(region));
      }),
  );
  await atlas.initialize();
  const loading = atlas.ensureSpinalCord();
  (atlas as unknown as Stub)['spinalCordVisible'] = true;
  assert.equal(atlas.canSelect(cord), false);
  assert.throws(() => atlas.select(cord.id), /not visible/);
  finishDownload();
  await loading;
  assert.equal(atlas.canSelect(cord), true);
  atlas.dispose();
});

test('hiding the cord cancels a pending visibility request', async () => {
  let finishDownload!: () => void;
  const { atlas } = cordFixture(
    (region) =>
      new Promise((resolve) => {
        finishDownload = () => resolve(cordScene(region));
      }),
  );
  await atlas.initialize();
  const showing = atlas.setSpinalCordVisible(true);
  await atlas.setSpinalCordVisible(false);
  finishDownload();
  await showing;
  assert.equal(atlas.settings.spinalCordVisible, false);
  atlas.dispose();
});

test('requesting an unpublished spinal cord fails descriptively', async () => {
  const { atlas } = fixture();
  await atlas.initialize();
  await assert.rejects(
    async () => atlas.setSpinalCordVisible(true),
    /spinal cord.*publish|publish.*spinal cord/i,
  );
  atlas.dispose();
});

test('hiding cortex exposes native white matter and restoring it closes the exposure', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  assert.equal(
    atlas.visibleMeshes.some((mesh) => mesh.userData['boundary'] === 'white'),
    false,
  );
  const changed = new Promise((resolve) =>
    atlas.addEventListener('change', resolve, { once: true }),
  );
  atlas.hideRegions(['a-left']);
  await changed;
  assert.equal(
    atlas.visibleMeshes.some((mesh) => mesh.userData['boundary'] === 'white'),
    false,
    'the envelopes are still on their way',
  );
  await atlas.ensureEnvelopes();
  const white = atlas.visibleMeshes.find((mesh) => mesh.userData['boundary'] === 'white');
  assert.ok(white, 'the tissue beneath removed cortex must be drawn');
  assert.equal(white.userData['hemisphere'], 'left');
  assert.equal(white.userData['kind'], 'non-region');
  assert.deepEqual(white.position.toArray(), [0, 0, 0.015]);
  const positions = white.geometry.attributes.position.array.slice();
  atlas.setCortexOpacity(0.6);
  assert.equal(white.material.opacity, 0.6);
  const plane = new Plane(new Vector3(0, 0, -1), 0.012);
  atlas.setClippingPlanes([plane]);
  assert.deepEqual(white.material.clippingPlanes, [plane]);
  atlas.setHemisphere('right');
  assert.equal(white.visible, false);
  atlas.setHemisphere('both');
  assert.equal(white.visible, true);
  atlas.setCortexVisible(false);
  assert.equal(white.visible, false);
  atlas.setCortexVisible(true);
  await atlas.setAtlas('b');
  assert.equal(white.visible, false);
  await atlas.setAtlas('a');
  assert.equal(white.visible, true);
  atlas.select('a-right');
  atlas.isolate();
  assert.equal(white.visible, false);
  atlas.clearIsolation();
  assert.equal(white.visible, true);
  atlas.restoreHiddenRegions();
  assert.equal(white.visible, false);
  assert.deepEqual(white.geometry.attributes.position.array, positions);
  atlas.dispose();
});

test('the first frame waits for no envelopes; the first exposure downloads them once and repaints', async () => {
  const { atlas, loads } = fixture();
  await Promise.all([atlas.initialize('a'), atlas.initialize('a')]);
  assert.ok(!loads.includes('tissue-envelopes.glb'));
  let changes = 0;
  atlas.addEventListener('change', () => {
    changes += 1;
  });
  atlas.hideRegions(['a-left']);
  atlas.setCortexOpacity(0.9);
  const before = changes;
  await atlas.ensureEnvelopes();
  assert.equal(loads.filter((file) => file === 'tissue-envelopes.glb').length, 1);
  assert.ok(changes > before, 'the model announces the exposed white matter');
  await atlas.initialize('a');
  assert.equal(
    atlas.visibleMeshes.filter((mesh) => mesh.userData['boundary'] === 'white').length,
    1,
  );
  assert.equal(
    atlas.group.children.filter((group) => group.name === 'Native exposed white matter').length,
    1,
  );
  atlas.dispose();
});

test('a failed envelope download is reported and retried by the next exposure', async () => {
  const { atlas, loads } = fixture();
  await atlas.initialize('a');
  const load = atlas.loader.loadAsync;
  const failure = new Error('HTTP 503');
  atlas.loader.loadAsync = async (file) => {
    if (file === 'tissue-envelopes.glb' && loads.filter((name) => name === file).length === 0) {
      loads.push(file);
      throw failure;
    }
    return load(file);
  };
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const reported = new Promise((resolve) =>
    atlas.addEventListener('loaderror', resolve, { once: true }),
  );
  atlas.hideRegions(['a-left']);
  assert.equal(((await reported) as CustomEvent).detail, failure);
  atlas.setHemisphere('left');
  await atlas.ensureEnvelopes();
  assert.ok(atlas.visibleMeshes.some((mesh) => mesh.userData['boundary'] === 'white'));
  atlas.dispose();
});

test('MRI colour attached before the envelopes reaches them when they arrive', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  const sections = new TissueSections(atlas, new URL('https://example.invalid/'));
  sections.anatomy = sections.createAnatomy(
    new Volume(
      {
        shape: [2, 2, 2],
        order: 'F',
        voxel_to_surface_ras_mm: [
          [1, 0, 0, 0],
          [0, 1, 0, 0],
          [0, 0, 1, 0],
          [0, 0, 0, 1],
        ],
      },
      new Uint8Array(8).fill(100),
    ),
  );
  atlas.setMriAnatomy(sections.anatomy);
  atlas.setSurfaceColor('mri');
  await atlas.ensureEnvelopes();
  for (const mesh of atlas.whiteMatterSurfaces!.meshes) {
    const shader: Stub = {
      uniforms: {},
      vertexShader: '#include <begin_vertex>',
      fragmentShader: '#include <opaque_fragment>',
    };
    mesh.material.onBeforeCompile(shader as never, undefined as never);
    assert.equal(shader.uniforms.scanVolume.value, sections.anatomy.texture);
  }
  sections.dispose();
  atlas.dispose();
});

test('dissection exposes white matter and blocks picking through it', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  const front = atlas.visibleMeshes.find((mesh) => mesh.userData['region_id'] === 'a-left');
  front!.position.z = 0.03;
  front!.updateMatrix();
  const positions = front!.geometry.attributes.position.array.slice();
  const ray = new Raycaster(new Vector3(0, 0, 0.1), new Vector3(0, 0, -1));
  assert.equal(atlas.pick(ray)!.id, 'a-left');
  atlas.select('a-left');
  atlas.hideRegions(['a-left']);
  await atlas.ensureEnvelopes();
  assert.equal(atlas.intersect(ray)!.object.userData['boundary'], 'white');
  assert.equal(atlas.pick(ray), null);
  assert.equal(front!.visible, false);
  assert.equal(atlas.state.selectedRegion, null);
  assert.equal(atlas.canSelect(regions[0]!), false);
  assert.deepEqual(front!.geometry.attributes.position.array, positions);
  atlas.undoDissection();
  assert.equal(atlas.pick(ray)!.id, 'a-left');
  assert.equal(atlas.state.selectedRegion!.id, 'a-left');
  atlas.dispose();
});

test('dissection batches are atomic, undoable and preserve other display settings', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  atlas.setCortexOpacity(0.7);
  atlas.hideRegions(['a-left', 'stem']);
  assert.deepEqual([...atlas.state.hiddenRegions].sort(), ['a-left', 'stem']);
  atlas.hideRegions(['a-left', 'stem']);
  atlas.showRegions(['a-left']);
  assert.deepEqual([...atlas.state.hiddenRegions], ['stem']);
  atlas.undoDissection();
  assert.deepEqual([...atlas.state.hiddenRegions].sort(), ['a-left', 'stem']);
  atlas.undoDissection();
  assert.equal(atlas.state.hiddenRegions.size, 0);
  assert.equal(atlas.state.dissectionCanUndo, false);
  assert.equal(atlas.state.cortexOpacity, 0.7);
  atlas.hideRegions(['a-left']);
  await atlas.setAtlas('b');
  await atlas.setAtlas('a');
  assert.equal(
    atlas.visibleMeshes.some((mesh) => mesh.userData['region_id'] === 'a-left'),
    false,
  );
  atlas.restoreHiddenRegions();
  assert.equal(atlas.state.hiddenRegions.size, 0);
  atlas.undoDissection();
  assert.deepEqual([...atlas.state.hiddenRegions], ['a-left']);
  atlas.reset();
  assert.equal(atlas.state.hiddenRegions.size, 0);
  assert.equal(atlas.state.dissectionCanUndo, false);
  atlas.dispose();
});

test('hiding an isolated region releases isolation and undo restores it', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  atlas.select('a-left');
  atlas.isolate();
  atlas.hideRegions(['a-left']);
  assert.equal(atlas.state.isolatedRegion, null);
  await atlas.ensureEnvelopes();
  assert.equal(atlas.visibleMeshes.length, 3);
  atlas.undoDissection();
  assert.equal(atlas.state.isolatedRegion, 'a-left');
  assert.equal(atlas.state.selectedRegion!.id, 'a-left');
  atlas.dispose();
});

test('dissection undo preserves the current atlas and hemisphere without invalid isolation', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  atlas.select('a-left');
  atlas.isolate();
  atlas.hideRegions(['a-left']);
  await atlas.setAtlas('b');
  atlas.undoDissection();
  assert.equal(atlas.state.atlas, 'b');
  assert.equal(atlas.state.isolatedRegion, null);
  assert.equal(atlas.state.selectedRegion, null);
  assert.equal(atlas.canSelect(regions.find((region) => region.id === 'b-left')!), true);

  await atlas.setAtlas('a');
  atlas.select('a-left');
  atlas.isolate();
  atlas.hideRegions(['a-left']);
  atlas.setHemisphere('right');
  atlas.undoDissection();
  assert.equal(atlas.state.hemisphere, 'right');
  assert.equal(atlas.state.isolatedRegion, null);
  assert.equal(atlas.state.selectedRegion, null);
  assert.equal(atlas.canSelect(regions.find((region) => region.id === 'a-right')!), true);
  atlas.dispose();
});

test('dissection undo announces a restored selection', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  const selections: (string | null)[] = [];
  atlas.addEventListener('selectionchange', (event) => selections.push(event.detail?.id ?? null));
  atlas.select('a-left');
  atlas.hideRegions(['a-left']);
  atlas.undoDissection();
  assert.deepEqual(selections, ['a-left', null, 'a-left']);
  atlas.dispose();
});

test('invalid dissection identifiers fail before changing visibility', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  assert.throws(() => atlas.hideRegions(['a-left', 'missing']), /Unknown region/);
  assert.equal(atlas.state.hiddenRegions.size, 0);
  assert.equal(atlas.state.dissectionCanUndo, false);
  atlas.dispose();
});

test('a detail change does not cancel an atlas change still loading', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  const load = atlas.loader.loadAsync;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  atlas.loader.loadAsync = async (file, onProgress) => {
    if (file === 'b.glb') await gate;
    return load(file, onProgress);
  };
  const switching = atlas.setAtlas('b');
  await atlas.setDetail('aseg');
  release();
  await switching;
  assert.equal(atlas.settings.atlas, 'b');
  assert.equal(atlas.settings.detail, 'aseg');
  atlas.dispose();
});

test('switches one atlas at a time, caches geometry, and keeps shared anatomy', async () => {
  const { atlas, loads } = fixture();
  await atlas.initialize('a');
  assert.equal(atlas.state.atlas, 'a');
  assert.equal(atlas.visibleMeshes.length, 3);
  await atlas.setAtlas('b');
  assert.equal(atlas.visibleMeshes.length, 2);
  assert.ok(atlas.visibleMeshes.some((mesh) => mesh.userData['region_id'] === 'stem'));
  await atlas.setAtlas('a');
  assert.deepEqual(loads.sort(), ['a.glb', 'b.glb', 'structures.glb']);
  assert.equal(atlas.group.children.filter((group) => group.visible).length, 2);
  atlas.dispose();
  assert.equal(atlas.group.children.length, 0);
});

test('selection events carry source metadata; medial wall cannot become a region', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  let selected;
  atlas.addEventListener('selectionchange', (event) => {
    selected = event.detail;
  });
  atlas.select('a-left');
  assert.equal(selected!.source_label_id, 1);
  assert.equal(atlas.state.selectedRegion!.id, 'a-left');
  assert.throws(() => atlas.select('a-wall'), /non-region/i);
  assert.throws(() => atlas.select('b-left'), /visible/i);
  atlas.setHemisphere('right');
  assert.equal(atlas.state.selectedRegion, null);
  assert.equal(selected, null);
  assert.deepEqual(atlas.visibleMeshes.map((mesh) => mesh.userData['region_id']).sort(), [
    'a-right',
    'stem',
  ]);
  atlas.dispose();
});

test('neutral anatomy preserves picking and isolation through atlas color changes', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  assert.equal(atlas.state.surfaceColor, 'atlas');
  const mesh = atlas.visibleMeshes.find((mesh) => mesh.userData['region_id'] === 'a-right');
  const positions = mesh!.geometry.attributes.position.array.slice();
  const indices = mesh!.geometry.index!.array.slice();
  const ray = new Raycaster(new Vector3(0.03, 0, 0.1), new Vector3(0, 0, -1));
  const neutral = parseInt(appearance.tissue.cortex.slice(1), 16);
  assert.equal(mesh!.material.color.getHex(), 0xffffff);
  atlas.select(atlas.pick(ray)!.id);
  atlas.isolate();
  for (const mode of ['tissue', 'atlas', 'tissue']) {
    atlas.setSurfaceColor(mode);
    assert.equal(
      mesh!.material.userData['tissueVariation'].value,
      mode === 'tissue' ? appearance.intensity.surface_strength : 0,
    );
    assert.equal(mesh!.material.color.getHex(), mode === 'atlas' ? 0xffffff : neutral);
    assert.equal(atlas.pick(ray)!.id, 'a-right');
    assert.equal(atlas.state.selectedRegion!.id, 'a-right');
    assert.deepEqual(atlas.visibleMeshes, [mesh]);
    assert.deepEqual(mesh!.geometry.attributes.position.array, positions);
    assert.deepEqual(mesh!.geometry.index!.array, indices);
  }
  atlas.reset();
  assert.equal(atlas.state.surfaceColor, 'atlas');
  assert.equal(mesh!.material.color.getHex(), 0xffffff);
  atlas.dispose();
});

const cabNp = {
  id: 'cab-np',
  atlas: 'a',
  networks: ['Visual1', 'Default'],
  colors: { Visual1: [0, 0, 255], Default: [255, 0, 0] },
  regions: { 'a-left': 'Default', 'a-right': 'Visual1' },
};

test('CAB-NP colours each area of its atlas whole, and nothing else', async () => {
  const { atlas } = fixture(cabNp);
  await atlas.initialize('a');
  atlas.setSurfaceColor('cab-np');
  const colour = (id: string) =>
    atlas.layers.get('a')!.meshes.find((mesh) => mesh.userData['region_id'] === id)!.material.color;
  const red = new Color().setRGB(1, 0, 0, SRGBColorSpace);
  assert.equal(colour('a-left').getHex(), red.getHex());
  assert.equal(colour('a-right').getHex(), new Color().setRGB(0, 0, 1, SRGBColorSpace).getHex());
  // The medial wall is in no network and keeps its tissue colour.
  assert.equal(colour('a-wall').getHex(), new Color(appearance.tissue.unlabelled).getHex());
  for (const mesh of atlas.layers.get('a')!.meshes) {
    assert.equal(mesh.material.userData['tissueVariation'].value, 0);
  }
  atlas.dispose();
});

test('CAB-NP needs its own atlas, and leaving that atlas leaves its colours', async () => {
  const { atlas } = fixture(cabNp);
  await atlas.initialize('b');
  assert.throws(() => atlas.setSurfaceColor('cab-np'), /CAB-NP colours a areas/);
  await atlas.setAtlas('a');
  atlas.setSurfaceColor('cab-np');
  await atlas.setAtlas('b');
  assert.equal(atlas.state.surfaceColor, 'atlas');
  atlas.dispose();
});

test('blood supply colours a deep structure whole by the territory holding most of it', async () => {
  const { atlas } = fixture();
  atlas.manifest.arterial_territories = {
    territories: [
      { id: 'basilar', color: [126, 87, 166] },
      { id: 'aca', color: [59, 111, 182] },
    ],
  } as never;
  const stem = atlas.regions.get('stem')!;
  stem.territories = [{ territory: 'basilar', fraction: 0.8 }];
  await atlas.initialize('a');
  const mesh = atlas.layers.get('aseg')!.meshes[0]!;
  atlas.setSurfaceColor('tissue');
  const tissue = mesh.material.color.getHex();
  atlas.setSurfaceColor('territory');
  const basilar = new Color().setRGB(126 / 255, 87 / 255, 166 / 255, SRGBColorSpace);
  assert.equal(mesh.material.color.getHex(), basilar.getHex());
  // Split between territories with none holding a majority, as on the cut, it keeps its tissue.
  stem.territories = [
    { territory: 'basilar', fraction: 0.45 },
    { territory: 'aca', fraction: 0.4 },
  ];
  atlas.update();
  assert.equal(mesh.material.color.getHex(), tissue);
  atlas.dispose();
});

test('a model without the partition refuses CAB-NP colours', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  assert.throws(() => atlas.setSurfaceColor('cab-np'), /no CAB-NP partition/);
  atlas.dispose();
});

test('a partition assigning a region of another atlas is rejected', () => {
  assert.throws(
    () => fixture({ ...cabNp, regions: { 'b-left': 'Default' } }),
    /Invalid CAB-NP assignment: b-left/,
  );
});

const functional = {
  id: 'functional-regions',
  atlas: 'a',
  sources: {
    glasser: { citation: 'Glasser et al. (2016)', doi: 'https://doi.org/10.1038/nature18933' },
  },
  levels: {
    named: [
      {
        id: 'm1',
        name: 'M1',
        name_fr: 'M1',
        short: 'M1',
        short_fr: 'M1',
        source: 'glasser',
        color: [255, 0, 0],
        areas: ['4'],
      },
    ],
    sections: [
      {
        id: 'section-6',
        number: 6,
        name: 'S6',
        name_fr: 'S6',
        short: 'S6',
        short_fr: 'S6',
        source: 'glasser',
        color: [0, 0, 255],
        areas: ['4'],
      },
      {
        id: 'section-22',
        number: 22,
        name: 'S22',
        name_fr: 'S22',
        short: 'S22',
        short_fr: 'S22',
        source: 'glasser',
        color: [0, 255, 0],
        areas: ['46'],
      },
    ],
  },
  regions: {
    named: { 'a-left': 'm1' },
    sections: { 'a-left': 'section-6', 'a-right': 'section-22' },
  },
};

const meshOf = (atlas: BrainAtlas, id: string) =>
  atlas.layers.get('a')!.meshes.find((mesh) => mesh.userData['region_id'] === id)!;

test('a paint colours the regions it names over any surface colour, every other region in tissue colour', async () => {
  const { atlas } = fixture(null, functional);
  await atlas.initialize('a');
  atlas.setSurfaceColor('tissue');
  atlas.setCortexOpacity(0.5);
  const red = new Color().setRGB(1, 0, 0, SRGBColorSpace).getHex();
  const tissue = new Color(appearance.tissue.cortex).getHex();
  const changes = [];
  atlas.addEventListener('change', () => changes.push(true));
  atlas.setPaint({ id: 'deficit:aphasia', colors: new Map([['a-left', [255, 0, 0]]]) });
  assert.equal(meshOf(atlas, 'a-left').material.color.getHex(), red);
  assert.equal(meshOf(atlas, 'a-right').material.color.getHex(), tissue);
  // A see-through cortex leaves the painted area opaque, the cortex around it see-through.
  assert.equal(meshOf(atlas, 'a-left').material.opacity, 1);
  assert.equal(meshOf(atlas, 'a-right').material.opacity, 0.5);
  assert.equal(atlas.state.paint!.id, 'deficit:aphasia');
  // The same paint again changes nothing; the surface colour underneath is kept.
  atlas.setPaint({ id: 'deficit:aphasia', colors: new Map() });
  assert.equal(changes.length, 1);
  assert.equal(atlas.state.surfaceColor, 'tissue');
  atlas.setPaint(null);
  assert.equal(meshOf(atlas, 'a-left').material.opacity, 0.5);
  assert.throws(() => atlas.setPaint({ id: 'x', colors: {} } as never), /Map of region colours/);
  atlas.dispose();
});

test('the functional divisions are not a surface colour, even where they are published', async () => {
  const { atlas } = fixture(null, functional);
  await atlas.initialize('a');
  assert.throws(() => atlas.setSurfaceColor('functional'), /Unknown surface colour: functional/);
  assert.throws(() => atlas.setSurfaceColor('domains'), /Unknown surface colour: domains/);
  atlas.dispose();
});

test('rejects cortex missing source morphometry instead of silently losing relief', async () => {
  const { atlas } = fixture();
  const load = atlas.loader.loadAsync;
  atlas.loader.loadAsync = async (file) => {
    const result = await load(file);
    result.scene.traverse((object) => {
      if ((object as Mesh).isMesh) (object as Mesh).geometry.deleteAttribute('_sulc');
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
  const mesh = atlas.visibleMeshes.find((mesh) => mesh.userData['region_id'] === 'a-right');
  const position = mesh!.position.clone();
  atlas.isolate();
  assert.deepEqual(atlas.visibleMeshes, [mesh]);
  atlas.reset();
  assert.equal(atlas.visibleMeshes.length, 3);
  assert.ok(mesh!.position.equals(position));
  atlas.setCortexOpacity(0.3);
  assert.equal(mesh!.material.opacity, 0.3);
  atlas.setCortexVisible(false);
  assert.deepEqual(
    atlas.visibleMeshes.map((mesh) => mesh.userData['region_id']),
    ['stem'],
  );
  assert.throws(() => atlas.setCortexOpacity(1.1), /opacity/i);
  atlas.dispose();
});

test('picking respects hemisphere visibility and leaves unlabeled cortex unselectable', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  atlas.group.updateMatrixWorld(true);
  const raycaster = new Raycaster(new Vector3(0.03, 0, 0.1), new Vector3(0, 0, -1));
  assert.equal(atlas.pick(raycaster)!.id, 'a-right');
  atlas.setHemisphere('left');
  assert.equal(atlas.pick(raycaster), null);
  raycaster.ray.origin.x = 0.06;
  assert.equal(atlas.pick(raycaster), null);
  atlas.dispose();
});

test('accelerated picking preserves original indices, positions, and hit region', async () => {
  const { atlas } = fixture();
  const raw = await atlas.loader.loadAsync('a.glb');
  const original = (raw.scene.children[1] as Mesh).geometry;
  const positions = original.attributes.position.array.slice();
  const indices = original.index!.array.slice();
  await atlas.initialize('a');
  const mesh = atlas.visibleMeshes.find((mesh) => mesh.userData['region_id'] === 'a-right');
  assert.ok(mesh!.geometry.boundsTree, 'every loaded mesh must have a spatial index');
  assert.deepEqual(mesh!.geometry.attributes.position.array, positions);
  assert.deepEqual(mesh!.geometry.index!.array, indices);
  const ray = new Raycaster(new Vector3(0.03, 0, 0.1), new Vector3(0, 0, -1));
  ray.firstHitOnly = true;
  assert.equal(atlas.pick(ray)!.id, 'a-right');
  atlas.dispose();
});

test('selection leaves the material untouched, so atlas colour stays the datum', async () => {
  // With atlas colours on, a region's colour encodes atlas identity. Tinting
  // the selection would alter the value being read, so selection is signalled
  // by the outline pass alone.
  const { atlas } = fixture();
  await atlas.initialize('a');
  atlas.setSurfaceColor('atlas');
  const mesh = atlas.visibleMeshes.find((m) => m.userData['region_id'] === 'a-left');
  const before = {
    colour: mesh!.material.color.getHex(),
    emissive: mesh!.material.emissive.getHex(),
    intensity: mesh!.material.emissiveIntensity,
  };
  atlas.select('a-left');
  assert.equal(mesh!.material.color.getHex(), before.colour);
  assert.equal(mesh!.material.emissive.getHex(), before.emissive);
  assert.equal(mesh!.material.emissiveIntensity, before.intensity);
  atlas.dispose();
});

test('settings is a cheap snapshot that does not walk the scene graph', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  assert.deepEqual(atlas.settings, {
    atlas: 'a',
    detail: 'aseg',
    internalSystem: null,
    internalConstituents: new Set(),
    cutAtlas: null,
    cutActive: false,
    hemisphere: 'both',
    cortexVisible: true,
    cortexOpacity: 1,
    internalVisible: true,
    spinalCordVisible: false,
    surfaceColor: 'atlas',
    paint: null,
    isolatedRegion: null,
    hiddenRegions: new Set(),
    dissectionCanUndo: false,
  });
  assert.ok(!('visibleMeshCount' in atlas.settings));
  assert.equal(atlas.state.visibleMeshCount, 3);

  atlas.setCortexVisible(false);
  assert.equal(atlas.settings.cortexVisible, false);
  assert.equal(atlas.state.visibleMeshCount, 1);

  atlas.setCortexVisible(true);
  assert.equal(atlas.settings.cortexVisible, true);
  assert.equal(atlas.state.visibleMeshCount, 3);
  atlas.dispose();
});

test('mesh visibility agrees with the shared rule for every region', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  atlas.setHemisphere('left');
  for (const [id, layer] of atlas.layers) {
    for (const mesh of layer.meshes) {
      const region = atlas.regions.get(mesh.userData['region_id'])!;
      const expected = visibilityOf(region, atlas.settings).visible;
      assert.equal(
        mesh.visible && layer.scene.visible,
        expected,
        `${id}/${region!.id} disagreed with the shared visibility rule`,
      );
    }
  }
  atlas.dispose();
});

test('load progress is reported while a layer downloads', async () => {
  const seen: Stub[] = [];
  const { atlas } = fixture();
  await atlas.initialize('a', (event) => seen.push({ loaded: event.loaded, total: event.total }));
  assert.deepEqual(
    seen.at(-1),
    { loaded: 40, total: 40 },
    'surface and structure downloads share one bar',
  );
  assert.ok(seen.some((event) => event.loaded === 10 && event.total === 20));
  atlas.dispose();
});

test('initialize fetches cortex and internal anatomy together, and nothing else', async () => {
  const { atlas, loads } = fixture();
  const original = atlas.loader.loadAsync;
  let started = 0;
  let released!: () => void;
  const gate = new Promise<void>((resolve) => {
    released = resolve;
  });
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
  atlas.manifest.detail_levels.push({
    id: 'nextbrain',
    label: 'Fine',
    file: 'nextbrain.glb',
  } as never);
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
  assert.equal(atlas.state.selectedRegion!.id, 'a-right', 'selection survives');
  assert.equal(atlas.state.cortexOpacity, 0.5, 'other settings are untouched');
  assert.equal(atlas.visibleMeshes.length, 3);
  atlas.dispose();
});

test('cut picking skips discarded front faces and finds the retained back face', async () => {
  const { Plane } = await import('three');
  const { atlas } = fixture();
  await atlas.initialize('a');
  const mesh = atlas.visibleMeshes.find((m) => m.userData['region_id'] === 'a-right');
  const positions = mesh!.geometry.attributes.position.array.slice();
  const indices = mesh!.geometry.index!.array.slice();
  const ray = new Raycaster(new Vector3(0.03, 0, 0.1), new Vector3(0, 0, -1));
  ray.firstHitOnly = true;
  atlas.setClippingPlanes([new Plane(new Vector3(0, 0, -1), 0)]);
  assert.equal(
    atlas.pick(ray)!.id,
    'a-right',
    'discarded nearest face must not mask the retained face',
  );
  assert.equal(ray.firstHitOnly, true, 'caller ray configuration survives');
  atlas.setClippingPlanes([new Plane(new Vector3(0, 0, -1), -0.02)]);
  assert.equal(atlas.pick(ray), null, 'fully discarded mesh must not be clickable');
  await atlas.setAtlas('b');
  assert.equal(atlas.visibleMeshes[0]!.material.clippingPlanes!.length, 1);
  atlas.reset();
  assert.equal(atlas.clippingPlanes.length, 0);
  assert.deepEqual(mesh!.geometry.attributes.position.array, positions);
  assert.deepEqual(mesh!.geometry.index!.array, indices);
  atlas.dispose();
});

test('picking stops at the first surface and still reaches past a clipped one', async () => {
  const { Plane } = await import('three');
  const { atlas } = fixture();
  await atlas.initialize('a');
  // The medial wall is drawn only while the internal anatomy is hidden.
  atlas.setInternalVisible(false);
  const far = atlas.visibleMeshes.find((mesh) => mesh.userData['region_id'] === 'a-wall');
  const kept = atlas.visibleMeshes.find((mesh) => mesh.userData['region_id'] === 'a-right');
  let farCasts = 0;
  let keptCasts = 0;
  const farRaycast = far!.raycast.bind(far);
  const keptRaycast = kept!.raycast.bind(kept);
  far!.raycast = (raycaster, hits) => {
    farCasts += 1;
    farRaycast(raycaster, hits);
  };
  kept!.raycast = (raycaster, hits) => {
    keptCasts += 1;
    keptRaycast(raycaster, hits);
  };
  const ray = new Raycaster(new Vector3(-0.1, 0, 0), new Vector3(1, 0, 0));
  ray.firstHitOnly = true;
  const nearest = atlas.pick(ray);
  assert.equal(nearest!.id, 'a-left');
  assert.equal(farCasts, 0, 'a box behind the hit is not tested');
  assert.equal(keptCasts, 0, 'a box behind the hit is not tested');

  atlas.setClippingPlanes([new Plane(new Vector3(1, 0, 0), -0.02)]);
  assert.equal(
    atlas.pick(ray)!.id,
    'a-right',
    'a clipped nearer mesh does not hide the one behind it',
  );
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
  const dropped: unknown[] = [];
  atlas.addEventListener('selectionchange', (event) => dropped.push(event.detail));

  atlas.select('n-left');
  assert.equal(atlas.state.selectedRegion?.id, 'n-left');
  atlas.update();
  assert.equal(atlas.state.selectedRegion?.id, 'n-left', 'survives a redraw');
  assert.deepEqual(
    dropped.filter((detail) => detail === null),
    [],
  );
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
  const good: Stub = {
    schema_version: 1,
    atlases: [{ id: 'a', label: 'A', file: 'a.glb' }],
    detail_levels: [{ id: 'aseg', label: 'Coarse', file: 'structures.glb' }],
    regions: [],
  };
  const loader = {
    async loadAsync() {
      return { scene: new Group() };
    },
  };

  const stale: Stub = { ...good };
  delete stale.detail_levels;
  assert.throws(() => new BrainAtlas(stale as never, loader), /detail_levels/);
  assert.throws(() => new BrainAtlas({ ...good, atlases: [] } as never, loader), /atlases/);
  assert.throws(
    () => new BrainAtlas({ ...good, schema_version: 2 } as never, loader),
    /schema_version 1/,
  );
  // The viewer names the subject whose brain this is, so a manifest that has
  // stopped saying which brain it is cannot be shown under the old label.
  assert.throws(
    () => new BrainAtlas({ ...good, anatomy: { id: 'bert' } } as never, loader),
    /anatomy/,
  );
  // `individual` decides how the viewer describes the brain, so a manifest that
  // omits it would silently describe it as the other kind.
  assert.throws(
    () =>
      new BrainAtlas(
        { ...good, anatomy: { subject: 'bert', display_name: 'Subject' } } as never,
        loader,
      ),
    /anatomy/,
  );
  // And it says what to do about it.
  assert.throws(() => new BrainAtlas(stale as never, loader), /cache/i);
});

test('ATLAS-46 a region’s centroid and anchor are the ones the manifest publishes, not its mesh’s box', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  assert.deepEqual(atlas.centroidOf('a-left'), [-30.5, 12.25, 40]);
  assert.deepEqual(atlas.anchorOf('a-left'), [-31, 12, 41]);
  assert.equal(atlas.centroidOf('nonexistent'), null);
  assert.equal(atlas.anchorOf('a-wall'), null);
  // A placed region the manifest leaves unplaced is a build error, not a guess.
  assert.throws(() => atlas.anchorOf('a-right'), /anchor_ras_mm for a-right/);
  atlas.dispose();
});

test('loading a hidden set that holds the isolated region releases the isolation', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  atlas.select('a-left');
  atlas.isolate();
  atlas.loadHiddenRegions(['a-left', 'stem']);
  assert.equal(atlas.state.isolatedRegion, null);
  assert.deepEqual([...atlas.state.hiddenRegions].sort(), ['a-left', 'stem']);
  // Isolation of a region the set leaves alone is kept.
  atlas.select('a-right');
  atlas.isolate();
  atlas.loadHiddenRegions(['stem']);
  assert.equal(atlas.state.isolatedRegion, 'a-right');
  atlas.dispose();
});

test('the settings name the first atlas and the default detail before anything has loaded', () => {
  const { atlas } = fixture();
  assert.equal(atlas.settings.atlas, 'a');
  assert.equal(atlas.settings.detail, 'aseg');
  assert.equal(atlas.visibleMeshes.length, 0);
  atlas.dispose();
});

test('the cut can hand the model an anatomy only once the MRI has loaded', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  assert.throws(() => atlas.setMriAnatomy(null), /MRI anatomy has not loaded/);
  atlas.dispose();
});

test('a download joined while it is under way reports its progress to every caller', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  const load = atlas.loader.loadAsync;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  atlas.loader.loadAsync = async (file, onProgress) => {
    if (file === 'b.glb') {
      onProgress?.({ loaded: 5, total: 20 });
      await gate;
    }
    return load(file, onProgress);
  };
  // The boot prefetch asks for no progress; the reader's switch joins it.
  const prefetch = atlas.loadLayer('b', 'b.glb');
  const heard: number[] = [];
  const switching = atlas.setAtlas('b', (event) => heard.push(event.loaded));
  release();
  await Promise.all([prefetch, switching]);
  assert.deepEqual(heard, [10, 20]);
  assert.equal(atlas.settings.atlas, 'b');
  atlas.dispose();
});

test('the envelope download fans progress out to a joining caller', async () => {
  const { atlas } = fixture();
  await atlas.initialize('a');
  const load = atlas.loader.loadAsync;
  atlas.loader.loadAsync = async (file, onProgress) => {
    await Promise.resolve();
    return load(file, onProgress);
  };
  const first: number[] = [];
  const second: number[] = [];
  const envelopes = atlas.ensureEnvelopes((event) => first.push(event.loaded));
  const joined = atlas.ensureEnvelopes((event) => second.push(event.loaded));
  await Promise.all([envelopes, joined]);
  assert.deepEqual(second, first);
  assert.ok(first.length > 0);
  atlas.dispose();
});

test('disposed is readable', async () => {
  const { atlas } = fixture();
  assert.equal(atlas.disposed, false);
  atlas.dispose();
  assert.equal(atlas.disposed, true);
});
