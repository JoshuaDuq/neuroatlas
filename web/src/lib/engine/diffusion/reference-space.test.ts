import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'vitest';
import { Vector3 } from 'three';
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
