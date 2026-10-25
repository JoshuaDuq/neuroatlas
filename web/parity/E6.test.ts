import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';
import { NVMeshLoaders } from '@niivue/niivue';
import { Quaternion, Matrix4, Vector3 } from 'three';
import * as legacyStreamlines from '../../viewer/diffusion/streamlines.js';
import * as legacyGeometry from '../../viewer/diffusion/native-geometry.js';
import * as legacyReference from '../../viewer/diffusion/reference-space.js';
import * as legacyNavigation from '../../viewer/diffusion/navigation-data.js';
import * as legacyTractFile from '../../viewer/diffusion/tract-file.js';
import * as legacyViewerModule from '../../viewer/diffusion/native-viewer.js';
import { repoRoot, readRepoJson } from '../test/repo.ts';
import { tractCatalog } from '../src/lib/core/diffusion/catalogs.ts';
import * as streamlines from '../src/lib/engine/diffusion/streamlines.ts';
import * as geometry from '../src/lib/engine/diffusion/native-geometry.ts';
import * as reference from '../src/lib/engine/diffusion/reference-space.ts';
import * as navigation from '../src/lib/engine/diffusion/navigation-data.ts';
import * as tractFile from '../src/lib/engine/diffusion/tract-file.ts';
import * as viewer from '../src/lib/engine/diffusion/native-viewer.ts';

/** The JavaScript modules are typed by what they infer; parity asserts they behave as the ports. */
const legacyLengths = legacyStreamlines as unknown as typeof streamlines;
const legacyGeom = legacyGeometry as unknown as typeof geometry;
const legacyRef = legacyReference as unknown as typeof reference;
const legacyNav = legacyNavigation as unknown as typeof navigation;
const legacyLoader = legacyTractFile as unknown as typeof tractFile;
const legacyViewer = legacyViewerModule as unknown as typeof viewer;

/** `deepStrictEqual` separates -0 from 0, which is what bitwise parity needs. */
const same = (actual: unknown, expected: unknown, message?: string) =>
  assert.deepStrictEqual(actual, expected, message);

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** What a call returned, or the class, code and message of what it threw. */
function outcome(call: () => unknown) {
  try {
    return { value: call() };
  } catch (error) {
    const { name, message } = error as Error;
    return { error: { name, code: (error as { code?: unknown }).code, message } };
  }
}

const random = mulberry32(0xe6);

/** Synthetic tractography: 1 to 40 lines of 2 to 40 points in [-120, 120] mm. */
function syntheticTract() {
  const lines = 1 + Math.floor(random() * 40);
  const offsets = [0];
  for (let line = 0; line < lines; line++)
    offsets.push(offsets.at(-1)! + 2 + Math.floor(random() * 39));
  const points = new Float32Array(offsets.at(-1)! * 3).map(() => random() * 240 - 120);
  return { points, offsets: new Uint32Array(offsets) };
}
const synthetic = Array.from({ length: 25 }, syntheticTract);

const directory = resolve(repoRoot, 'public/diffusion/cdmd-sub-013');
const arrayBuffer = (bytes: Uint8Array) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
const decode = (name: string) =>
  NVMeshLoaders.readTRK(arrayBuffer(readFileSync(resolve(directory, name))));
const published = await Promise.all(
  ['uf.left.trk.gz', 'uf.right.trk.gz', 'ifof.right.trk.gz', 'cst.left.trk.gz'].map(decode),
);
const tracts = [
  ...synthetic.map(({ points, offsets }) => ({ pts: points, offsetPt0: offsets })),
  ...published,
];
const MINIMUMS = [0, 1, 15, 25, 100, 500, -1, NaN];

describe('E6 streamlines', () => {
  it('streamlineLengths is identical on synthetic and published tracts', () => {
    for (const { pts, offsetPt0 } of tracts) {
      same(
        streamlines.streamlineLengths(pts, offsetPt0),
        legacyLengths.streamlineLengths(pts, offsetPt0),
      );
    }
    const points = new Float32Array([0, 0, 0, 3, 4, 0, 3, 4, 12, 0, 0, 0, 1, 1, 1]);
    same(
      streamlines.streamlineLengths(points, new Uint32Array([0, 3, 5])),
      legacyLengths.streamlineLengths(points, new Uint32Array([0, 3, 5])),
    );
  });

  it('streamlineLengths rejects the same inputs with the same class, code and message', () => {
    const pair = new Float32Array([0, 0, 0, 1, 1, 1]);
    const cases: [Float32Array, number[]][] = [
      ...[[1, 2], [0, 1, 2], [0, 3], [0], [0, 2, 1]].map((offsets): [Float32Array, number[]] => [
        pair,
        offsets,
      ]),
      [new Float32Array([0, 0, NaN, 1, 1, 1]), [0, 2]],
      [new Float32Array([1, 1, 1, 1, 1, 1]), [0, 2]],
      [new Float32Array([0, 0, 0, 1]), [0, 2]],
      [new Float32Array(), [0, 1]],
    ];
    for (const [points, offsets] of cases) {
      const next = outcome(() => streamlines.streamlineLengths(points, new Uint32Array(offsets)));
      assert.ok('error' in next);
      same(
        next,
        outcome(() => legacyLengths.streamlineLengths(points, new Uint32Array(offsets))),
      );
    }
  });

  it('summarizeLengths is identical for every minimum, including the invalid ones', () => {
    for (const { pts, offsetPt0 } of tracts) {
      const lengths = legacyLengths.streamlineLengths(pts, offsetPt0);
      for (const minimum of MINIMUMS) {
        same(
          outcome(() => streamlines.summarizeLengths(lengths, minimum)),
          outcome(() => legacyLengths.summarizeLengths(lengths, minimum)),
        );
      }
    }
  });
});

describe('E6 native geometry', () => {
  it('createTractGeometry and filterTractGeometry build identical buffers, ranges and bounds', () => {
    const coincident = {
      pts: new Float32Array([0, 0, 0, 0, 0, 0, 5, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2]),
      offsetPt0: new Uint32Array([0, 3, 6]),
    };
    for (const { pts, offsetPt0 } of [...tracts, coincident]) {
      const next = geometry.createTractGeometry(pts, offsetPt0);
      const old = legacyGeom.createTractGeometry(pts, offsetPt0);
      for (const minimum of [1, 15, 25, 100, 500]) {
        geometry.filterTractGeometry(next.geometry, offsetPt0, next.lengths, minimum);
        legacyGeom.filterTractGeometry(old.geometry, offsetPt0, old.lengths, minimum);
        same(next.geometry.index!.array, old.geometry.index!.array);
        same(next.geometry.drawRange, old.geometry.drawRange);
      }
      same(next.lengths, old.lengths);
      same(
        next.geometry.getAttribute('position').array,
        old.geometry.getAttribute('position').array,
      );
      same(next.geometry.getAttribute('color').array, old.geometry.getAttribute('color').array);
      same(
        next.geometry.getAttribute('color').normalized,
        old.geometry.getAttribute('color').normalized,
      );
      same(next.geometry.boundingBox, old.geometry.boundingBox);
      same(next.geometry.boundingSphere, old.geometry.boundingSphere);
    }
  });

  it('keeps the black vertex a zero-direction segment gives', () => {
    const points = new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 5, 1]);
    const offsets = new Uint32Array([0, 4]);
    same(
      geometry.createTractGeometry(points, offsets).geometry.getAttribute('color').array,
      legacyGeom.createTractGeometry(points, offsets).geometry.getAttribute('color').array,
    );
  });

  it('RAS_MM_TO_WORLD and the minimum check are identical', () => {
    same(geometry.RAS_MM_TO_WORLD.elements, legacyGeom.RAS_MM_TO_WORLD.elements);
    const { points, offsets } = synthetic[0]!;
    for (const minimum of MINIMUMS) {
      const next = geometry.createTractGeometry(points, offsets);
      const old = legacyGeom.createTractGeometry(points, offsets);
      same(
        outcome(() => geometry.filterTractGeometry(next.geometry, offsets, next.lengths, minimum)),
        outcome(() => legacyGeom.filterTractGeometry(old.geometry, offsets, old.lengths, minimum)),
      );
    }
  });
});

describe('E6 reference space', () => {
  const rotation = (quaternion: Quaternion, translation: Vector3) =>
    new Matrix4().compose(translation, quaternion, new Vector3(1, 1, 1));
  const rows = (matrix: Matrix4) => {
    const e = matrix.elements;
    return [0, 1, 2, 3].map((row) => [0, 1, 2, 3].map((column) => e[column * 4 + row]!));
  };

  it('createReferenceTransform is identical for the published space and random rigid transforms', () => {
    const space = readRepoJson<{ scanner_ras_to_surface_ras: number[][] }>(
      'public/diffusion/cdmd-sub-013/surface-space.json',
    );
    const matrices = [
      space.scanner_ras_to_surface_ras,
      [
        [0, -1, 0, 12],
        [1, 0, 0, -25],
        [0, 0, 1, 40],
        [0, 0, 0, 1],
      ],
      ...Array.from({ length: 200 }, () =>
        rows(
          rotation(
            new Quaternion(
              random() - 0.5,
              random() - 0.5,
              random() - 0.5,
              random() - 0.5,
            ).normalize(),
            new Vector3(random() * 200 - 100, random() * 200 - 100, random() * 200 - 100),
          ),
        ),
      ),
    ];
    for (const matrix of matrices) {
      same(
        reference.createReferenceTransform(matrix).elements,
        legacyRef.createReferenceTransform(matrix).elements,
      );
    }
  });

  it('createReferenceTransform rejects the same matrices with the same class and message', () => {
    const invalid = [
      null,
      [[1]],
      [
        [2, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ],
      [
        [1, 0, 0, NaN],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ],
      [
        [-1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ],
      [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 1],
      ],
    ] as unknown as number[][][];
    for (const matrix of invalid) {
      const next = outcome(() => reference.createReferenceTransform(matrix));
      assert.ok('error' in next);
      same(
        next,
        outcome(() => legacyRef.createReferenceTransform(matrix)),
      );
    }
  });
});

describe('E6 navigation data', () => {
  const header = {
    dims: [3, 256, 256, 150],
    affine: [
      [1, 0, 0, -120.5538330078125],
      [0, 1, 0, -104.4605712890625],
      [0, 0, 1, -28.359909057617188],
      [0, 0, 0, 1],
    ],
  };
  const oblique = {
    dims: [3, 40, 50, 60],
    affine: [
      [0.8, 0.1, -0.2, -30.5],
      [-0.1, 0.9, 0.05, -40.25],
      [0.2, 0, 1.1, -20],
      [0, 0, 0, 1],
    ],
  };

  it('sourceVoxelPoint and scannerVoxel are identical on corners, random voxels and random points', () => {
    for (const grid of [header, oblique]) {
      const [nx, ny, nz] = grid.dims.slice(1) as [number, number, number];
      const voxels = [
        [0, 0, 0],
        [nx - 1, ny - 1, nz - 1],
        [nx / 2, ny / 2, nz / 2].map(Math.floor),
        ...Array.from({ length: 500 }, () =>
          [random() * nx, random() * ny, random() * nz].map(Math.floor),
        ),
        [nx, 0, 0],
        [0, -1, 0],
        [0, 0, nz],
        [1.5, 0, 0],
        [NaN, 0, 0],
        [0, 0],
      ];
      for (const voxel of voxels) {
        same(
          outcome(() => navigation.sourceVoxelPoint(voxel, grid)),
          outcome(() => legacyNav.sourceVoxelPoint(voxel, grid)),
        );
      }
      const points = [
        ...Array.from({ length: 500 }, () => [
          random() * 400 - 200,
          random() * 400 - 200,
          random() * 400 - 200,
        ]),
        ...voxels.slice(0, 3).map((voxel) => legacyNav.sourceVoxelPoint(voxel, grid)),
        [0, NaN, 0],
        [Infinity, 0, 0],
        [0, 0],
      ];
      for (const point of points) {
        same(
          outcome(() => navigation.scannerVoxel(point, grid)),
          outcome(() => legacyNav.scannerVoxel(point, grid)),
        );
      }
    }
  });

  it('half-voxel boundaries round the same way', () => {
    for (const offset of [-0.5, -0.49, 0.49, 0.5, 0.51]) {
      const point = [header.affine[0]![3]! + offset, header.affine[1]![3]!, header.affine[2]![3]!];
      same(navigation.scannerVoxel(point, header), legacyNav.scannerVoxel(point, header));
    }
  });

  it('configureNavigationTract sets the same fields and rejects the same minimums', () => {
    for (const { pts, offsetPt0 } of tracts) {
      for (const minimum of MINIMUMS) {
        const next = { pts, offsetPt0 } as navigation.NavigationTract;
        const old = { pts, offsetPt0 } as navigation.NavigationTract;
        same(
          outcome(() => navigation.configureNavigationTract(next, minimum)),
          outcome(() => legacyNav.configureNavigationTract(old, minimum)),
        );
        same(next, old);
      }
    }
  });
});

describe('E6 tract loader', () => {
  it('shares one read per file, returns the same promise and retries a failed load', async () => {
    const compressed = readFileSync(resolve(directory, 'callosum_1.trk.gz'));
    const bundle = { file: 'cdmd-sub-013/callosum_1.trk.gz' };
    for (const loader of [tractFile, legacyLoader]) {
      let reads = 0;
      const load = loader.createTractLoader(async () => {
        reads += 1;
        return { buffer: arrayBuffer(compressed) };
      });
      const [a, b] = await Promise.all([load(bundle), load(bundle)]);
      assert.equal(reads, 1);
      assert.equal(a, b);
      assert.equal(load(bundle), load(bundle));
      let failures = 0;
      const failing = loader.createTractLoader(async () => {
        failures += 1;
        throw new Error('HTTP 503');
      });
      await assert.rejects(failing(bundle), /503/);
      await assert.rejects(failing(bundle), /503/);
      assert.equal(failures, 2);
    }
    const next = await tractFile.createTractLoader(async () => ({
      buffer: arrayBuffer(compressed),
    }))(bundle);
    const old = await legacyLoader.createTractLoader(async () => ({
      buffer: arrayBuffer(compressed),
    }))(bundle);
    same(next.pts, old.pts);
    same(next.offsetPt0, old.offsetPt0);
    same(next.lengths, old.lengths);
  });

  it('decodeTractAsset returns the same tract for gzip and decompressed bodies', async () => {
    const compressed = readFileSync(resolve(directory, 'uf.left.trk.gz'));
    const next = await tractFile.decodeTractAsset(arrayBuffer(compressed));
    const old = await legacyLoader.decodeTractAsset(arrayBuffer(compressed));
    same(next.pts, old.pts);
    same(next.offsetPt0, old.offsetPt0);
  });
});

describe('E6 native viewer', () => {
  const catalog = tractCatalog('cdmd');
  const bundles = catalog.bundles.slice(0, 3);
  const loadTract = async (bundle: { file: string }) => {
    const index = bundles.findIndex((entry) => entry.file === bundle.file);
    const { pts, offsetPt0 } = tracts[index]!;
    return {
      pts: pts.slice(),
      offsetPt0,
      lengths: legacyLengths.streamlineLengths(pts, offsetPt0),
    };
  };

  it('snapshot, bounds and the scanner/surface transforms are identical', async () => {
    const next = viewer.createNativeTractViewer(catalog, () => {}, loadTract as never);
    const old = legacyViewer.createNativeTractViewer(catalog, () => {}, loadTract as never);
    for (const bundle of bundles) {
      await Promise.all([next.loadBundle(bundle), old.loadBundle(bundle)]);
    }
    for (const minimum of [1, 50, 100]) {
      next.setMinimum(minimum);
      old.setMinimum(minimum);
      same(next.snapshot(), old.snapshot());
    }
    next.setVisible(bundles[1]!.id, false);
    old.setVisible(bundles[1]!.id, false);
    same(next.snapshot(), old.snapshot());
    same(next.anyVisible, old.anyVisible);
    same(next.hasBundle(bundles[0]!.id), old.hasBundle(bundles[0]!.id));
    for (const viewerGroup of [next.group, old.group]) {
      viewerGroup.matrixAutoUpdate = false;
      viewerGroup.matrix.copy(
        legacyRef.createReferenceTransform(
          readRepoJson<{ scanner_ras_to_surface_ras: number[][] }>(
            'public/diffusion/cdmd-sub-013/surface-space.json',
          ).scanner_ras_to_surface_ras,
        ),
      );
    }
    for (let i = 0; i < 100; i++) {
      const point = [random() * 240 - 120, random() * 240 - 120, random() * 240 - 120] as const;
      same(next.scannerToSurface(point), old.scannerToSurface(point));
      same(next.surfaceToScanner(point), old.surfaceToScanner(point));
      const back = next.surfaceToScanner(next.scannerToSurface(point));
      point.forEach((value, axis) => assert.ok(Math.abs(back[axis]! - value) < 1e-9));
    }
    next.dispose();
    old.dispose();
  });

  it('setMinimum rejects an invalid value on an empty viewer (deviations/e6-minimum-validation.md)', () => {
    const next = viewer.createNativeTractViewer(catalog, () => {}, loadTract as never);
    for (const value of [0, -1, NaN]) assert.throws(() => next.setMinimum(value), RangeError);
  });

  it('a bundle requested twice at once is added once (deviations/e6-concurrent-bundle-load.md)', async () => {
    const next = viewer.createNativeTractViewer(catalog, () => {}, loadTract as never);
    await Promise.all([next.loadBundle(bundles[0]!), next.loadBundle(bundles[0]!)]);
    assert.equal(next.group.children.length, 1);
  });
});
