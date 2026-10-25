import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { tractCatalog } from '../../core/diffusion/catalogs.ts';
import { createMriNavigationViewer } from './navigation-viewer.ts';
import { streamlineLengths } from './streamlines.ts';
import type { LoadedTract } from './tract-file.ts';

const added = vi.hoisted(() => [] as { visible: boolean }[]);

vi.mock('@niivue/niivue', () => {
  class Niivue {
    volumes: unknown[] = [];
    gl = {};
    onLocationChange = () => {};
    attachToCanvas = async () => {};
    addMesh = (mesh: { visible: boolean }) => added.push(mesh);
    drawScene = () => {};
  }
  class NVMesh {
    visible = true;
    fiberLength = 0;
    updateMesh = () => {};
  }
  return {
    Niivue,
    NVMesh,
    NVImage: {},
    SHOW_RENDER: { ALWAYS: 1 },
    MULTIPLANAR_TYPE: { GRID: 1 },
    SLICE_TYPE: {},
  };
});

const catalog = { ...tractCatalog('cdmd'), maps: [] };
const [first, second] = catalog.bundles as [
  (typeof catalog.bundles)[number],
  (typeof catalog.bundles)[number],
];
const pts = new Float32Array([0, 0, 0, 3, 4, 0, 3, 4, 12]);
const offsetPt0 = new Uint32Array([0, 3]);
const loadTract = async () =>
  ({ pts, offsetPt0, lengths: streamlineLengths(pts, offsetPt0) }) as LoadedTract;
const open = () => createMriNavigationViewer(catalog, {} as HTMLCanvasElement, () => {}, loadTract);

test('overlapping syncs of one tract add one mesh', async () => {
  added.length = 0;
  const navigator = await open();
  await Promise.all([navigator.syncTracts([first.id], 1), navigator.syncTracts([first.id], 1)]);
  assert.equal(added.length, 1);
  assert.equal(added[0]!.visible, true);
});

test('the last sync decides which tracts show, however the loads overlap', async () => {
  added.length = 0;
  const navigator = await open();
  await Promise.all([navigator.syncTracts([second.id], 1), navigator.syncTracts([], 1)]);
  assert.equal(added.length, 1);
  assert.equal(added[0]!.visible, false);
});

test('a rejected minimum leaves the viewer unchanged and later syncs still run', async () => {
  added.length = 0;
  const navigator = await open();
  await assert.rejects(navigator.syncTracts([first.id], 0), RangeError);
  assert.equal(added.length, 0);
  await navigator.syncTracts([first.id], 1);
  assert.equal(added.length, 1);
});
