import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'vitest';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { readRepoJson, readRepoYaml, repoRoot } from '../../../../test/repo.ts';
import { createReferenceTransform } from './reference-space.ts';

test('scanner-to-surface RAS applies in the viewer’s rotated meter coordinates', () => {
  const transform = createReferenceTransform([
    [0, -1, 0, 12],
    [1, 0, 0, -25],
    [0, 0, 1, 40],
    [0, 0, 0, 1],
  ]);
  // Scanner RAS (100, 200, 300) mm becomes surface RAS (-188, 75, 340).
  const point = new Vector3(0.1, 0.3, -0.2).applyMatrix4(transform);
  assert.ok(point.distanceTo(new Vector3(-0.188, 0.34, -0.075)) < 1e-12);
  const vector = new Vector3(0.103, 0.3, -0.204).applyMatrix4(transform);
  assert.ok(Math.abs(vector.distanceTo(point) - 0.005) < 1e-12);
});

test('missing, nonfinite or nonrigid coordinate mappings surface as errors', () => {
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
  ] as unknown as number[][][];
  for (const matrix of invalid) assert.throws(() => createReferenceTransform(matrix), /rigid/);
});

test('DIFF-11 a bottom row other than 0 0 0 1 is a TypeError and a scaled or mirrored frame a RangeError', () => {
  const identity = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
  const withRow = (row: number, values: number[]) =>
    identity.map((entries, at) => (at === row ? values : entries));
  assert.throws(() => createReferenceTransform(withRow(3, [0, 0, 1, 1])), {
    name: 'TypeError',
    message: 'The reference requires a finite rigid RAS transform.',
  });
  assert.throws(() => createReferenceTransform(withRow(0, [2, 0, 0, 0])), {
    name: 'RangeError',
    message: 'The reference requires a rigid, orientation-preserving RAS transform.',
  });
  assert.throws(() => createReferenceTransform(withRow(0, [-1, 0, 0, 0])), {
    name: 'RangeError',
    message: 'The reference requires a rigid, orientation-preserving RAS transform.',
  });
});

test('DIFF-10 any seeded rotation and translation keeps distances, and the published transform maps its own anchors', () => {
  let state = 0xe6;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let trial = 0; trial < 200; trial++) {
    const frame = new Matrix4().compose(
      new Vector3(random() * 200 - 100, random() * 200 - 100, random() * 200 - 100),
      new Quaternion(random() - 0.5, random() - 0.5, random() - 0.5, random() - 0.5).normalize(),
      new Vector3(1, 1, 1),
    );
    const e = frame.elements;
    const rows = [0, 1, 2, 3].map((row) => [0, 1, 2, 3].map((column) => e[column * 4 + row]!));
    const transform = createReferenceTransform(rows);
    const a = new Vector3(random(), random(), random());
    const b = new Vector3(random(), random(), random());
    const moved = a.clone().applyMatrix4(transform).distanceTo(b.clone().applyMatrix4(transform));
    assert.ok(Math.abs(moved - a.distanceTo(b)) < 1e-9);
  }
});

interface ReferenceSpace {
  anatomy: string;
  source: string;
  source_sha256: string;
  scanner_ras_to_surface_ras: number[][];
  anchors: { scanner_ras_mm: number[]; surface_ras_mm: number[] }[];
}

const { tract_catalogs: paths } = readRepoYaml<{ tract_catalogs: string[] }>('config/model.yaml');
const catalogs = paths.map((path) =>
  readRepoYaml<{ id: string; anatomy: string; reference_space: string }>(path),
);

for (const catalog of catalogs) {
  test(`${catalog.id}: published header mapping matches independent NiBabel voxel anchors and its exact source`, async () => {
    const space = readRepoJson<ReferenceSpace>(`public/diffusion/${catalog.reference_space}`);
    const source = await readFile(resolve(repoRoot, space.source));
    assert.equal(createHash('sha256').update(source).digest('hex'), space.source_sha256);
    assert.equal(space.anatomy, catalog.anatomy);
    const matrix = createReferenceTransform(space.scanner_ras_to_surface_ras);
    for (const anchor of space.anchors) {
      const [r, a, s] = anchor.scanner_ras_mm as [number, number, number];
      const [surfaceR, surfaceA, surfaceS] = anchor.surface_ras_mm as [number, number, number];
      const result = new Vector3(r / 1000, s / 1000, -a / 1000).applyMatrix4(matrix);
      assert.ok(
        result.distanceTo(new Vector3(surfaceR / 1000, surfaceS / 1000, -surfaceA / 1000)) < 1e-10,
      );
    }
  });
}
