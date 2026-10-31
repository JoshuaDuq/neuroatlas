import assert from 'node:assert/strict';
import { GreaterDepth, Group, Plane, Vector3 } from 'three';
import type { Mesh, MeshStandardMaterial } from 'three';
import { test, vi } from 'vitest';
import { tractCatalog } from '../../core/diffusion/catalogs.ts';
import { createNativeTractViewer } from './native-viewer.ts';
import { readRepoJson } from '../../../../test/repo.ts';
import { createReferenceTransform } from './reference-space.ts';
import { createTractLoader } from './tract-file.ts';
import type { LineSegments } from 'three';
import { streamlineLengths } from './streamlines.ts';
import type { LoadedTract, TractLoader } from './tract-file.ts';

/** The asset reader serves `public/diffusion/` from disk, so `load()` runs in Node. */
vi.mock('../../core/assets/diffusion-assets.ts', async () => {
  const { readPublishedDiffusion } = await import('./test-support.ts');
  return { readDiffusionAsset: readPublishedDiffusion };
});

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
  // Each bundle is its lines and their hidden pass.
  assert.equal(viewer.group.children.length, 4);
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

const outlineOf = (viewer: ReturnType<typeof createNativeTractViewer>) => {
  const found: Mesh[] = [];
  viewer.group.children[0]!.traverse((object) => {
    if ((object as Mesh).isMesh) found.push(object as Mesh);
  });
  assert.equal(found.length, 1);
  return { mesh: found[0]!, material: found[0]!.material as MeshStandardMaterial };
};

test('DIFF-17 loading the published tracts places the outline and the initial bundles on the surface', async () => {
  const viewer = createNativeTractViewer(catalog, () => {}, createTractLoader());
  assert.equal(viewer.ready, false);
  await viewer.load();
  assert.equal(viewer.ready, true);
  assert.equal(viewer.group.matrixAutoUpdate, false);
  const transform = createReferenceTransform(
    readRepoJson<{ scanner_ras_to_surface_ras: number[][] }>(
      `public/diffusion/${catalog.reference_space}`,
    ).scanner_ras_to_surface_ras,
  );
  assert.deepEqual(viewer.group.matrix.elements, transform.elements);
  const { material } = outlineOf(viewer);
  assert.equal(material.color.getHex(), 0xb3babf);
  assert.equal(material.roughness, 0.8);
  assert.equal(material.transparent, true);
  assert.equal(material.depthWrite, false);
  assert.equal(material.opacity, 0.16);
  assert.deepEqual(
    viewer.snapshot().map(({ id, total }) => [id, total]),
    [
      ['af-left', 3639],
      ['cst-right', 964],
    ],
  );
  // The outline's box (brain-outline.json) moved by the published transform, as R, S, -A metres.
  const { min, max } = viewer.bounds;
  [-0.067971, -0.053958, -0.067933].forEach((value, axis) =>
    assert.ok(Math.abs(min.toArray()[axis]! - value) < 1e-6, `min ${axis}: ${min.toArray()[axis]}`),
  );
  [0.0659, 0.091946, 0.085333].forEach((value, axis) =>
    assert.ok(Math.abs(max.toArray()[axis]! - value) < 1e-6, `max ${axis}: ${max.toArray()[axis]}`),
  );
  // DIFF-18: the published frame carries a scanner point to its surface point and back.
  const surface = viewer.scannerToSurface([10, -20, 30]);
  [7.4626923, -22.6237411, 44.0663681].forEach((value, axis) =>
    assert.ok(Math.abs(surface[axis]! - value) < 1e-6, `surface ${axis}: ${surface[axis]}`),
  );
  const scanner = viewer.surfaceToScanner(surface);
  [10, -20, 30].forEach((value, axis) => assert.ok(Math.abs(scanner[axis]! - value) < 1e-9));
  viewer.dispose();
}, 60_000);

test('DIFF-23 an opacity or visibility set before the outline loads applies when it arrives, and a bad opacity is refused', async () => {
  const viewer = createNativeTractViewer(
    catalog,
    () => {},
    async () => decoded(),
  );
  viewer.setOpacity(0.5);
  viewer.setOutlineVisible(false);
  await viewer.load();
  const { material } = outlineOf(viewer);
  assert.equal(material.opacity, 0.5);
  assert.equal(viewer.group.children[0]!.visible, false);
  for (const value of [0, 0.16, 1]) {
    viewer.setOpacity(value);
    assert.equal(material.opacity, value);
  }
  viewer.setOutlineVisible(true);
  assert.equal(viewer.group.children[0]!.visible, true);
  for (const value of [-0.1, 1.1, NaN]) {
    assert.throws(() => viewer.setOpacity(value), {
      name: 'RangeError',
      message: 'Brain opacity must be between 0 and 1.',
    });
  }
  viewer.dispose();
}, 60_000);

test('DIFF-23 an outline hidden before loading keeps the catalogue opacity', async () => {
  const viewer = createNativeTractViewer(
    catalog,
    () => {},
    async () => decoded(),
  );
  viewer.setOutlineVisible(false);
  await viewer.load();
  assert.equal(outlineOf(viewer).material.opacity, catalog.brain_outline.opacity);
  assert.equal(viewer.group.children[0]!.visible, false);
  viewer.dispose();
}, 60_000);

test('DIFF-17 a reference space of another anatomy is refused', async () => {
  const viewer = createNativeTractViewer(
    { ...catalog, anatomy: 'another-anatomy' },
    () => {},
    async () => decoded(),
  );
  await assert.rejects(viewer.load(), {
    message: 'The tract reference space belongs to a different anatomy.',
  });
  viewer.dispose();
});

test('DIFF-20 a minimum set before a bundle loads filters it when it arrives', async () => {
  const viewer = createNativeTractViewer(
    catalog,
    () => {},
    async () => decoded(),
  );
  viewer.setMinimum(20);
  await viewer.loadBundle(first);
  assert.equal(viewer.snapshot()[0]!.shown, 1);
  viewer.dispose();
});

test('DIFF-21 a hidden bundle requested again is shown without a new load, and a failed load is forgotten', async () => {
  const loadTract = vi.fn<TractLoader>(async () => decoded());
  const viewer = createNativeTractViewer(catalog, () => {}, loadTract);
  await viewer.loadBundle(first);
  viewer.setVisible(first.id, false);
  await viewer.loadBundle(first);
  assert.equal(viewer.snapshot()[0]!.visible, true);
  assert.equal(loadTract.mock.calls.length, 1);

  loadTract.mockRejectedValueOnce(new Error('HTTP 503'));
  await assert.rejects(viewer.loadBundle(second), /503/);
  await viewer.loadBundle(second);
  assert.equal(viewer.hasBundle(second.id), true);
  viewer.dispose();
});

test('DIFF-24 the cut planes clip the bundles already loaded and those loaded later', async () => {
  const viewer = createNativeTractViewer(
    catalog,
    () => {},
    async () => decoded(),
  );
  const plane = new Plane(new Vector3(1, 0, 0), 0);
  await viewer.loadBundle(first);
  viewer.setClippingPlanes([plane]);
  await viewer.loadBundle(second);
  for (const lines of viewer.group.children as LineSegments[]) {
    assert.deepEqual((lines.material as { clippingPlanes: Plane[] }).clippingPlanes, [plane]);
  }
  assert.equal(viewer.group.children.length, 4);
  viewer.dispose();
});

test('DIFF-25 disposal frees what is drawn and refuses a bundle or outline that arrives late', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const viewer = createNativeTractViewer(
    catalog,
    () => {},
    async () => {
      await gate;
      return decoded();
    },
  );
  const late = viewer.loadBundle(first);
  const parent = new Group();
  parent.add(viewer.group);
  viewer.dispose();
  assert.equal(viewer.group.parent, null);
  release();
  await assert.rejects(late, { message: 'Tract viewer disposed during bundle loading.' });
  await assert.rejects(viewer.load(), { message: 'Tract viewer disposed during outline loading.' });
}, 60_000);

test('DIFF-18 a scanner point and its surface point are inverse for 100 seeded rigid frames', () => {
  const viewer = createNativeTractViewer(
    catalog,
    () => {},
    async () => decoded(),
  );
  let state = 0xe6;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  viewer.group.matrixAutoUpdate = false;
  for (let trial = 0; trial < 100; trial++) {
    viewer.group.matrix.makeRotationAxis(
      new Vector3(random(), random(), random()).normalize(),
      random() * 6,
    );
    viewer.group.matrix.setPosition(random() - 0.5, random() - 0.5, random() - 0.5);
    const point = [random() * 240 - 120, random() * 240 - 120, random() * 240 - 120] as const;
    const back = viewer.surfaceToScanner(viewer.scannerToSurface(point));
    point.forEach((value, axis) => assert.ok(Math.abs(back[axis]! - value) < 1e-9));
  }
});

test('a moving camera draws every third point, the length filter included, and rest draws every point', async () => {
  const viewer = createNativeTractViewer(
    catalog,
    () => {},
    async () => decoded(),
  );
  const drawn = (id: string) => {
    const { geometry } = viewer.group.getObjectByName(id) as LineSegments;
    return Array.from(geometry.index!.array.slice(0, geometry.drawRange.count));
  };
  await viewer.loadBundle(first);
  assert.deepEqual(drawn(first.id), [0, 1, 1, 2, 3, 4]);
  viewer.setMotion(true);
  assert.deepEqual(drawn(first.id), [0, 2, 3, 4]);
  // A bundle that arrives mid-move starts on the coarser lines.
  await viewer.loadBundle(second);
  assert.deepEqual(drawn(second.id), [0, 2, 3, 4]);
  viewer.setMinimum(20);
  assert.deepEqual(drawn(first.id), [3, 4]);
  viewer.setMotion(false);
  assert.deepEqual(drawn(first.id), [3, 4]);
  viewer.setMinimum(1);
  assert.deepEqual(drawn(second.id), [0, 1, 1, 2, 3, 4]);
  viewer.dispose();
});

test('a lesion shows exactly its counted lines through the scanner transform, then restores ordinary tracts', async () => {
  const loadTract = vi.fn<TractLoader>(async () => decoded());
  const viewer = createNativeTractViewer(catalog, () => {}, loadTract);
  await viewer.loadBundle(second);
  viewer.setMinimum(20);
  const transform = createReferenceTransform(
    readRepoJson<{ scanner_ras_to_surface_ras: number[][] }>(
      `public/diffusion/${catalog.reference_space}`,
    ).scanner_ras_to_surface_ras,
  );
  const surface = new Vector3(0, 0, 0).applyMatrix4(transform);
  const sphere = {
    centre: [surface.x * 1000, -surface.z * 1000, surface.y * 1000] as const,
    radius: 1,
  };
  await viewer.showLesionTract(first, sphere);
  const lines = viewer.group.getObjectByName(first.id) as LineSegments;
  const other = viewer.group.getObjectByName(second.id) as LineSegments;
  assert.equal(lines.visible, true);
  assert.equal(other.visible, false);
  assert.deepEqual(
    Array.from(lines.geometry.index!.array.slice(0, lines.geometry.drawRange.count)),
    [0, 1, 1, 2],
  );
  assert.deepEqual(viewer.group.matrix.elements, transform.elements);
  assert.equal(viewer.group.children.length, 4, 'does not load the outline or initial bundles');
  assert.equal(viewer.group.getObjectByName(`${first.id}-hidden`)!.visible, false);
  viewer.setMotion(true);
  assert.deepEqual(
    Array.from(lines.geometry.index!.array.slice(0, lines.geometry.drawRange.count)),
    [0, 2],
  );
  viewer.setMinimum(25);
  assert.equal(lines.geometry.drawRange.count, 2, 'minimum length does not remove counted lines');
  viewer.clearLesionTract();
  assert.equal(lines.visible, false, 'a bundle loaded only for the lesion stays off afterward');
  assert.equal(other.visible, true);
  assert.deepEqual(
    Array.from(other.geometry.index!.array.slice(0, other.geometry.drawRange.count)),
    [3, 4],
  );
  viewer.dispose();
});

test('clearing or replacing a lesion selection prevents late bundles becoming visible', async () => {
  let release!: (value: LoadedTract) => void;
  const viewer = createNativeTractViewer(
    catalog,
    () => {},
    (bundle) =>
      bundle.file === first.file
        ? new Promise((resolve) => {
            release = resolve;
          })
        : Promise.resolve(decoded()),
  );
  const stale = viewer.showLesionTract(first, { centre: [0, 0, 0], radius: 100 });
  await vi.waitFor(() => assert.ok(release));
  await viewer.showLesionTract(second, { centre: [0, 0, 0], radius: 100 });
  release(decoded());
  await stale;
  assert.equal(viewer.group.getObjectByName(first.id)!.visible, false);
  assert.equal(viewer.group.getObjectByName(second.id)!.visible, true);
  viewer.clearLesionTract();
  assert.equal(viewer.anyVisible, false);
  viewer.dispose();
});

test('a landmark draws its whole bundle alone, faint where hidden, and gives the ordinary tracts back', async () => {
  const viewer = createNativeTractViewer(
    catalog,
    () => {},
    async () => decoded(),
  );
  await viewer.loadBundle(second);
  viewer.setMinimum(20);
  await viewer.showLandmarkTract(first);
  const lines = viewer.group.getObjectByName(first.id) as LineSegments;
  const hidden = viewer.group.getObjectByName(`${first.id}-hidden`) as LineSegments;
  const other = viewer.group.getObjectByName(second.id) as LineSegments;
  assert.deepEqual([lines.visible, hidden.visible, other.visible], [true, true, false]);
  // Every streamline the length filter keeps; no lesion membership thins it.
  assert.deepEqual(
    Array.from(lines.geometry.index!.array.slice(0, lines.geometry.drawRange.count)),
    [3, 4],
  );
  const material = hidden.material as import('three').LineBasicMaterial;
  assert.equal(material.depthFunc, GreaterDepth);
  assert.equal(material.depthWrite, false);
  assert.ok(material.transparent && material.opacity > 0 && material.opacity < 1);
  assert.equal(hidden.geometry, lines.geometry);
  viewer.setMotion(true);
  assert.equal(hidden.geometry, lines.geometry, 'the hidden pass follows the coarser lines');
  viewer.setMotion(false);

  viewer.clearLandmarkTract();
  assert.deepEqual([lines.visible, hidden.visible, other.visible], [false, false, true]);

  await viewer.showLesionTract(first, { centre: [0, 0, 0], radius: 100 });
  viewer.clearLandmarkTract();
  assert.equal(lines.visible, true, 'clearing a landmark leaves the lesion’s streamlines');
  assert.equal(hidden.visible, false, 'the lesion’s streamlines have no hidden pass');
  viewer.dispose();
});

test('a landmark cleared while its bundle downloads keeps the late bundle hidden', async () => {
  let release!: (value: LoadedTract) => void;
  const viewer = createNativeTractViewer(
    catalog,
    () => {},
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const pending = viewer.showLandmarkTract(first);
  await vi.waitFor(() => assert.ok(release));
  viewer.clearLandmarkTract();
  release(decoded());
  await pending;
  assert.equal(viewer.group.getObjectByName(first.id)!.visible, false);
  assert.equal(viewer.anyVisible, false);
  viewer.dispose();
});
