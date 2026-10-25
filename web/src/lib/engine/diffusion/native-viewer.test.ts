import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { tractCatalog } from '../../core/diffusion/catalogs.ts';
import { createNativeTractViewer } from './native-viewer.ts';
import { streamlineLengths } from './streamlines.ts';
import type { LoadedTract, TractLoader } from './tract-file.ts';

const catalog = tractCatalog('cdmd-sub-013');
const [first, second] = catalog.bundles as [
  (typeof catalog.bundles)[number],
  (typeof catalog.bundles)[number],
];

const pts = new Float32Array([0, 0, 0, 3, 4, 0, 3, 4, 12, 10, 10, 10, 10, 10, 40]);
const offsetPt0 = new Uint32Array([0, 3, 5]);
const decoded = (): LoadedTract =>
  ({ pts: pts.slice(), offsetPt0, lengths: streamlineLengths(pts, offsetPt0) }) as LoadedTract;

test('snapshot summarises each loaded bundle at the minimum length', async () => {
  const viewer = createNativeTractViewer(
    catalog,
    () => {},
    async () => decoded(),
  );
  await viewer.loadBundle(first);
  assert.equal(viewer.hasBundle(first.id), true);
  assert.deepEqual(
    viewer.snapshot().map(({ id, visible, total, shown }) => ({ id, visible, total, shown })),
    [{ id: first.id, visible: true, total: 2, shown: 2 }],
  );
  viewer.setMinimum(20);
  assert.equal(viewer.snapshot()[0]!.shown, 1);
  viewer.setVisible(first.id, false);
  assert.equal(viewer.anyVisible, false);
  assert.throws(() => viewer.setVisible('missing', true), RangeError);
  viewer.dispose();
});

test('a minimum below 1 mm is rejected before any bundle is loaded, and keeps the last one', async () => {
  const viewer = createNativeTractViewer(
    catalog,
    () => {},
    async () => decoded(),
  );
  for (const value of [0, -1, NaN]) assert.throws(() => viewer.setMinimum(value), RangeError);
  await viewer.loadBundle(first);
  assert.equal(viewer.snapshot()[0]!.shown, 2);
  viewer.dispose();
});

test('a bundle requested twice while it downloads is added once', async () => {
  const loadTract = vi.fn<TractLoader>(async () => decoded());
  const viewer = createNativeTractViewer(catalog, () => {}, loadTract);
  await Promise.all([
    viewer.loadBundle(first),
    viewer.loadBundle(first),
    viewer.loadBundle(second),
  ]);
  assert.equal(loadTract.mock.calls.length, 2);
  assert.equal(viewer.group.children.length, 2);
  assert.equal(viewer.snapshot().length, 2);
  viewer.dispose();
});

test('the brain opacity can be set before the outline loads', () => {
  const viewer = createNativeTractViewer(
    catalog,
    () => {},
    async () => decoded(),
  );
  viewer.setOpacity(0.4);
  assert.throws(() => viewer.setOpacity(2), RangeError);
});

test('scanner and surface coordinates are inverse of each other', () => {
  const viewer = createNativeTractViewer(
    catalog,
    () => {},
    async () => decoded(),
  );
  viewer.group.matrixAutoUpdate = false;
  viewer.group.matrix.makeRotationZ(0.3).setPosition(0.01, -0.02, 0.03);
  const surface = viewer.scannerToSurface([10, -20, 30]);
  const scanner = viewer.surfaceToScanner(surface);
  [10, -20, 30].forEach((value, axis) => assert.ok(Math.abs(scanner[axis]! - value) < 1e-9));
});
