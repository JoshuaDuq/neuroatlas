import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import {
  Group,
  Mesh,
  PlaneGeometry,
  MeshStandardMaterial,
  DoubleSide,
  Raycaster,
  Vector3,
} from 'three';
import { readRepoJson } from '../../../../test/repo.ts';
import { BrainSections } from './sections.ts';
import type { SectionsModel } from './sections.ts';
import type { TissueSections } from '../tissues/gpu-sections.ts';

/* oxlint-disable typescript/no-explicit-any -- each test mutates the stubs freely */
type Stub = Record<string, any>;

const published = readRepoJson<{ default: string }>('public/models/anatomies.json').default;
const manifest = readRepoJson<Stub>(`public/models/${published}/manifest.json`);

function fixture() {
  const region = { id: 'aseg:left:10', kind: 'structure', source_label_id: 10 };
  const model: Stub = Object.assign(new EventTarget(), {
    clippingPlanes: [],
    manifest: {},
    state: { atlas: 'destrieux', hemisphere: 'both', cortexVisible: true, cortexOpacity: 1 },
    regions: new Map([[region.id, region]]),
    setCutState(this: Stub, cut: unknown) {
      this.cut = cut;
    },
    setClippingPlanes(this: Stub & EventTarget, planes: unknown[]) {
      this.clippingPlanes = planes;
      this.dispatchEvent(new Event('change'));
    },
    intersect() {
      return null;
    },
  });
  const tissues: Stub = {
    group: new Group(),
    async load() {},
    layers: new Map([['destrieux', {}]]),
    hasDetail: () => true,
    solids: { warm() {} },
    update() {},
    intersect() {
      return null;
    },
    dispose() {},
  };
  return {
    model,
    tissues,
    sections: new BrainSections(
      model as unknown as SectionsModel,
      new URL('https://example.invalid/volumes.json'),
      tissues as unknown as TissueSections,
    ),
    region,
  };
}

test('a later appearance choice wins while MRI is loading', async () => {
  const { model, tissues, sections } = fixture();
  let finish: (value?: unknown) => void = () => {};
  tissues.loadMri = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  model.setSurfaceColor = (mode: string) => {
    model.state.surfaceColor = mode;
  };
  model.setMriAnatomy = () => {};
  const pending = sections.setSurfaceColor('mri');
  await sections.setSurfaceColor('tissue');
  finish();
  await pending;
  assert.equal(model.state.surfaceColor, 'tissue');
  sections.dispose();
});

test('a colour overtaken by another scene command lands without changing the colour, and stops loading', async () => {
  const { model, tissues, sections } = fixture();
  let finish: (value?: unknown) => void = () => {};
  tissues.loadMri = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  model.setSurfaceColor = (mode: string) => {
    model.state.surfaceColor = mode;
  };
  model.setMriAnatomy = () => {};
  model.state.surfaceColor = 'atlas';
  let live = true;
  const pending = sections.setSurfaceColor('mri', () => live);
  assert.equal(sections.state.status, 'loading');
  // Reset, or entering internal anatomy: a new command that sets no colour through the sections.
  live = false;
  finish();
  await pending;
  assert.equal(model.state.surfaceColor, 'atlas');
  assert.equal(sections.state.status, 'ready');
  sections.dispose();
});

test('window changes reach the MRI renderer as well as the linked slices', () => {
  const { sections, tissues } = fixture();
  sections.display = { fieldOfView: 256, size: 256, windowCenter: 90, windowWidth: 180 };
  let window;
  tissues.setWindow = (center: number, width: number) => {
    window = [center, width];
  };
  sections.setWindow(100, 120);
  assert.deepEqual(window, [100, 120]);
  assert.equal(sections.display!.windowCenter, 100);
  assert.equal(sections.display!.windowWidth, 120);
  assert.throws(() => sections.setWindow(100, 0), RangeError);
  sections.dispose();
});

test('GPU cut plane preserves fractional coordinates and reverse-side clipping', async () => {
  const { sections, model } = fixture();
  await sections.setMode('coronal');
  sections.setOffset(0.5);
  await sections.update();
  assert.ok(Math.abs(model.clippingPlanes[0].distanceToPoint(new Vector3(0, 0, -0.0005))) < 1e-12);
  sections.setDisplay({ reverse: true });
  await sections.update();
  assert.ok(model.clippingPlanes[0].distanceToPoint(new Vector3(0, 0, -0.001)) > 0);
  await sections.setMode('off');
  assert.equal(sections.group.visible, false);
  assert.deepEqual(model.clippingPlanes, []);
  sections.dispose();
});

test('a hidden spinal cord does not stretch the axial cut below the brain', async () => {
  const { sections, model } = fixture();
  model.manifest = {
    supplemental_layers: [
      {
        id: 'zanatomy',
        bounds_ras_mm: [
          [-5, -50, -550],
          [8, -30, -60],
        ],
      },
    ],
  };
  model.state.spinalCordVisible = false;
  await sections.setMode('axial');
  assert.deepEqual(sections.offsetRange, [-128, 128]);
  assert.throws(() => sections.setOffset(-500), RangeError);

  model.state.spinalCordVisible = true;
  model.dispatchEvent(new Event('change'));
  assert.deepEqual(sections.offsetRange, [-550, 128]);
  sections.setOffset(-500);
  assert.equal(sections.state.crosshair[2], -500);
  assert.throws(() => sections.setOffset(-551), RangeError);
  await sections.setMode('sagittal');
  sections.setOffset(0);
  assert.equal(sections.state.crosshair[2], -500);
  await sections.setMode('axial');

  model.state.spinalCordVisible = false;
  model.dispatchEvent(new Event('change'));
  assert.deepEqual(sections.offsetRange, [-128, 128]);
  assert.equal(sections.state.crosshair[2], -128);

  await sections.setMode('sagittal');
  model.state.spinalCordVisible = true;
  assert.deepEqual(sections.offsetRange, [-128, 128]);
  sections.dispose();
});

test('cut picking uses categorical source region IDs without opening the MRI reference', async () => {
  const { sections, tissues, region } = fixture();
  const mesh = new Mesh(
    new PlaneGeometry(0.02, 0.02),
    new MeshStandardMaterial({ side: DoubleSide }),
  );
  mesh.userData.region_id = region.id;
  tissues.group.add(mesh);
  tissues.intersect = (raycaster: Raycaster) => {
    const hit = raycaster.intersectObject(mesh)[0];
    return hit ? { ...hit, region } : null;
  };
  await sections.setMode('coronal');
  assert.equal(sections.volumes, null);
  assert.equal(
    sections.pick(new Raycaster(new Vector3(0, 0, 0.1), new Vector3(0, 0, -1)))?.id,
    region.id,
  );
  sections.dispose();
  mesh.geometry.dispose();
  mesh.material.dispose();
});

test('latest mode wins when the tissue volume load is still pending', async () => {
  const { sections, tissues } = fixture();
  let resolve: (value?: unknown) => void = () => {};
  tissues.load = () =>
    new Promise((done) => {
      resolve = done;
    });
  const loading = sections.setMode('coronal');
  await sections.setMode('off');
  resolve();
  await loading;
  assert.equal(sections.state.mode, 'off');
  sections.dispose();
});

test('distant crosshair cannot invalidate an allowed oblique offset', async () => {
  const { sections } = fixture();
  await sections.setMode('oblique');
  sections.setAngles(45, 0);
  sections.setCrosshair([100, 0, -100]);
  sections.setOffset(60);
  await sections.update();
  assert.ok(sections.state.crosshair.every((value) => Math.abs(value) <= 128));
  assert.ok(
    Math.abs(new Vector3(...sections.state.crosshair).dot(sections.frame.normal) - 60) < 1e-10,
  );
  sections.dispose();
});

test('dragging reuses the attached clipping plane instead of updating all surface materials', async () => {
  const { sections, model } = fixture();
  await sections.setMode('axial');
  const planes = model.clippingPlanes;
  let changes = 0;
  model.addEventListener('change', () => changes++);
  for (let offset = -30; offset <= 30; offset += 0.5) sections.setOffset(offset);
  assert.equal(model.clippingPlanes, planes);
  assert.equal(changes, 0);
  assert.ok(Math.abs(planes[0].distanceToPoint(new Vector3(0, 0.03, 0))) < 1e-12);
  sections.dispose();
});

test('an unselectable tissue cut blocks selecting a surface behind it', async () => {
  const { sections, model, tissues, region } = fixture();
  model.intersect = () => ({ distance: 0.2, object: { userData: { region_id: region.id } } });
  tissues.intersect = () => ({ distance: 0.1, region: null });
  await sections.setMode('coronal');
  assert.equal(sections.pick(new Raycaster()), null);
  tissues.intersect = () => null;
  assert.equal(sections.pick(new Raycaster()), region);
  sections.dispose();
});

test('a highlight reaches the tissue that draws the cut faces', () => {
  const { sections, tissues } = fixture();
  const seen: unknown[] = [];
  tissues.setHighlight = (highlight: unknown) => seen.push(highlight);
  sections.setHighlight({ hovered: 'aseg:left:10' });
  assert.deepEqual(seen, [{ hovered: 'aseg:left:10' }]);
});

test('the oblique range is the projected bounds, cut back to where the crosshair stays legal', async () => {
  const { sections, model } = fixture();
  model.manifest = readRepoJson<Stub>('public/models/cdmd/manifest.json');
  model.state.spinalCordVisible = true;
  await sections.setMode('oblique');
  sections.setAngles(15, 30);

  const [min, max] = sections.coordinateBounds;
  const corners = [
    [min[0], min[1], min[2]],
    [min[0], min[1], max[2]],
    [min[0], max[1], min[2]],
    [min[0], max[1], max[2]],
    [max[0], min[1], min[2]],
    [max[0], min[1], max[2]],
    [max[0], max[1], min[2]],
    [max[0], max[1], max[2]],
  ];
  const normal = sections.frame.normal;
  const projections = corners.map(([x, y, z]) => x * normal.x + y * normal.y + z * normal.z);
  const reach = sections.coordinateLimit / Math.max(...normal.toArray().map(Math.abs));
  const [low, high] = sections.offsetRange;
  assert.ok(Math.abs(low - Math.max(Math.min(...projections), -reach)) < 1e-9);
  assert.ok(Math.abs(high - Math.min(Math.max(...projections), reach)) < 1e-9);
  // The cord still reaches far below the brain, and so does the plane.
  assert.ok(low < -500);
  sections.dispose();
});

test('every oblique position the slider can reach is a legal cut', async () => {
  const { sections, model } = fixture();
  model.manifest = manifest;
  await sections.setMode('oblique');
  for (const cordShown of [false, true]) {
    model.state.spinalCordVisible = cordShown;
    for (let tilt = 0; tilt <= 90; tilt += 5) {
      for (let azimuth = -180; azimuth <= 180; azimuth += 15) {
        sections.setAngles(tilt, azimuth);
        const [minimum, maximum] = sections.offsetRange;
        // The slider steps by half a millimetre from its minimum and also lands on its maximum.
        for (let offset = minimum; offset <= maximum; offset += 0.5) sections.crosshairFor(offset);
        sections.crosshairFor(maximum);
        assert.throws(() => sections.crosshairFor(maximum + 0.01), RangeError);
      }
    }
  }
  // 30°/30° spanned ±198.3 mm, of which only ±147.8 mm was accepted.
  model.state.spinalCordVisible = false;
  sections.setAngles(30, 30);
  assert.deepEqual(
    sections.offsetRange.map((value) => Math.round(value * 10) / 10),
    [-147.8, 147.8],
  );
  sections.dispose();
});

test('the linked MRI views reuse the T1 the cut holds and download only the segmentation', async () => {
  const { sections, tissues } = fixture();
  const header = { file: 'aseg.volume' };
  const display = {
    field_of_view_mm: 256,
    texture_size: 256,
    window_center: 90,
    window_width: 180,
  };
  const mri = { shape: [1, 1, 1] };
  tissues.loadVolumeMetadata = async () => ({
    schema_version: 1,
    display,
    segmentation: header,
    mri: { file: 'mri.volume' },
  });
  tissues.loadMri = async () => ({ volume: mri });
  tissues.setWindow = () => {};
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const requested: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    requested.push(String(url));
    return new Response('', { status: 503 });
  });
  await assert.rejects(sections.load(), (error: { code: string }) => error.code === 'asset-fetch');
  assert.deepEqual(requested, ['https://example.invalid/aseg.volume']);
  assert.equal(sections.state.error, 'asset-fetch');
  sections.dispose();
});

test('a drag build that lands after the cut closed does not reopen it', async () => {
  const { model, tissues, sections } = fixture();
  let finish: (value?: unknown) => void = () => {};
  tissues.solids = {
    generation: 0,
    build: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    applyBuild: () => true,
    warm() {},
  };
  await sections.setMode('axial');
  const drag = sections.setOffsetReady(10);
  await sections.setMode('off');
  finish([]);
  await drag;
  assert.equal(sections.group.visible, false);
  assert.deepEqual(model.clippingPlanes, []);
  assert.deepEqual(sections.state.crosshair, [0, 0, 0]);
  sections.dispose();
});

test('hiding the internal anatomy repaints an open cut', async () => {
  const { model, tissues, sections } = fixture();
  await sections.setMode('axial');
  let updates = 0;
  tissues.update = () => {
    updates += 1;
  };
  model.state.internalVisible = false;
  model.dispatchEvent(new Event('change'));
  assert.equal(updates, 1);
  sections.dispose();
});
