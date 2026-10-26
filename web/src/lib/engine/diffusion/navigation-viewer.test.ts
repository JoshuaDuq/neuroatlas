import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { tractCatalog } from '../../core/diffusion/catalogs.ts';
import type { MriLocation } from '../api.ts';
import { createMriNavigationViewer } from './navigation-viewer.ts';
import { streamlineLengths } from './streamlines.ts';
import type { LoadedTract } from './tract-file.ts';

const added = vi.hoisted(() => [] as { visible: boolean }[]);
const viewers = vi.hoisted(() => [] as Record<string, any>[]);

vi.mock('@niivue/niivue', () => {
  class Niivue {
    volumes: unknown[] = [];
    gl = {};
    onLocationChange: (location: unknown) => void = () => {};
    constructor() {
      viewers.push(this);
    }
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
const open = (onLocation: (location: MriLocation) => void = () => {}) =>
  createMriNavigationViewer(catalog, {} as HTMLCanvasElement, onLocation, loadTract);

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

test('reports the source voxel and a three-component point, not NiiVue’s mirrored voxel', async () => {
  const locations: MriLocation[] = [];
  await open((location) => locations.push(location));
  const viewer = viewers.at(-1)!;
  // A right-to-left scan: x runs against the source index, as in the CDMD reference MRI.
  viewer['volumes'] = [
    {
      hdr: {
        dims: [3, 176, 220, 220],
        affine: [
          [-1, 0, 0, 87],
          [0, 1, 0, -100],
          [0, 0, 1, -100],
          [0, 0, 0, 1],
        ],
      },
    },
  ];
  const values = [{ name: 'FA', value: 0.4 }];
  viewer['onLocationChange']({ mm: [81.54, -87.38, -94.07, 1], vox: [166, 20, 30], values });
  assert.deepEqual(locations, [{ mm: [81.54, -87.38, -94.07], vox: [5, 13, 6], values }]);
  // Before the volumes load there is no grid to name a voxel in.
  viewer['volumes'] = [];
  viewer['onLocationChange']({ mm: [0, 0, 0, 1], vox: [0, 0, 0], values });
  assert.equal(locations.length, 1);
  viewer['volumes'] = [
    {
      hdr: {
        dims: [3, 2, 2, 2],
        affine: [
          [1, 0, 0, 0],
          [0, 1, 0, 0],
          [0, 0, 1, 0],
          [0, 0, 0, 1],
        ],
      },
    },
  ];
  assert.throws(
    () => viewer['onLocationChange']({ mm: [50, 0, 0, 1], vox: [0, 0, 0], values }),
    RangeError,
  );
});
