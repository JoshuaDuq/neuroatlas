import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { afterEach, test, vi } from 'vitest';
import type { CoordinateField } from '../../types/index.ts';
import { createField, loadField } from './field.ts';

const OUTSIDE = -32768;
const shape = [4, 5, 6] as const;
const affine = [
  [2, 0, 0, -4],
  [0, 2, 0, -6],
  [0, 0, 2, -8],
  [0, 0, 0, 1],
];

/** Linear in the node indices, so trilinear interpolation reproduces it exactly. */
const displacement = (i: number, j: number, k: number) => [
  100 + 10 * i,
  -50 + 20 * j,
  5 * k + 3 * i,
];

function payload(outsideNodes: readonly [number, number, number][] = []): Int16Array {
  const [nx, ny, nz] = shape;
  const data = new Int16Array(nx * ny * nz * 3);
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const outside = outsideNodes.some(([a, b, c]) => a === i && b === j && c === k);
        displacement(i, j, k).forEach((value, c) => {
          data[c + 3 * (i + nx * (j + ny * k))] = outside ? OUTSIDE : value;
        });
      }
  return data;
}

const record = (extra: Partial<CoordinateField> = {}): CoordinateField => ({
  file: 'coordinates-test.field',
  shape,
  components: 3,
  dtype: '<i2',
  order: 'F',
  interleaved: true,
  compression: 'gzip',
  byte_length: 0,
  sha256: '',
  decoded_sha256: '',
  node_to_template_mm: affine,
  unit_mm: 0.01,
  outside: OUTSIDE,
  ...extra,
});

/** The point plus the linear displacement at its node coordinates. */
function expected([x, y, z]: [number, number, number]) {
  const node = [(x + 4) / 2, (y + 6) / 2, (z + 8) / 2] as const;
  return [x, y, z].map((value, axis) => value + displacement(...node)[axis]! * 0.01);
}

const close = (actual: readonly number[] | null, wanted: readonly number[]) => {
  assert.ok(actual, `expected ${wanted.join(', ')}, got null`);
  actual.forEach((value, axis) => assert.ok(Math.abs(value - wanted[axis]!) < 1e-9, `${value}`));
};

test('a point is carried by the trilinear displacement between its eight nodes', () => {
  const field = createField(record(), payload());
  for (const point of [
    [-4, -6, -8],
    [-3.3, -1.7, 0.9],
    [1.9, 1.99, 1.5],
    [0, 0, 0],
  ] as [number, number, number][]) {
    close(field.map(point), expected(point));
  }
  // At a node it is that node's displacement exactly.
  assert.deepEqual(field.map([-2, -4, -6]), [-2 + 110 * 0.01, -4 + -30 * 0.01, -6 + 8 * 0.01]);
});

test('a point needing a node beyond the template, or past the grid, is refused', () => {
  const field = createField(record(), payload([[1, 1, 1]]));
  // Node (1, 1, 1) is a corner of every cell whose lower node lies in 0..1 on each axis.
  assert.equal(field.map([-1, -3, -5]), null);
  assert.equal(field.map([-3.9, -5.9, -7.9]), null);
  assert.equal(field.map([-2, -4, -6]), null);
  close(field.map([0.5, -1.5, -3.5]), expected([0.5, -1.5, -3.5]));
  close(field.map([-4, -6, 1.5]), expected([-4, -6, 1.5]));
  // The grid's first node maps; its last plane, and anything outside, has no cell to interpolate in.
  assert.equal(field.map([-4.01, 0, 0]), null);
  assert.equal(field.map([2, 0, 0]), null);
  assert.equal(field.map([0, 2, 0]), null);
  assert.equal(field.map([0, 0, 2]), null);
  close(field.map([1.999, 1.999, 1.999]), expected([1.999, 1.999, 1.999]));
});

test('one outside component is enough to refuse', () => {
  const data = payload();
  data[2 + 3 * (2 + 4 * (2 + 5 * 2))] = OUTSIDE;
  const field = createField(record(), data);
  assert.equal(field.map([0.5, -1.5, -3.5]), null);
  assert.ok(field.map([-3.5, -5.5, -7.5]));
});

test('refuses a field it would misread', () => {
  const data = payload();
  assert.throws(() => createField(record({ dtype: '<u2' }), data), /layout/);
  assert.throws(() => createField(record({ interleaved: false }), data), /layout/);
  assert.throws(() => createField(record({ order: 'C' }), data), /layout/);
  assert.throws(() => createField(record(), data.subarray(3)), /length/);
  const sheared = affine.map((row) => [...row]);
  sheared[0]![1] = 0.5;
  assert.throws(() => createField(record({ node_to_template_mm: sheared }), data), /axis-aligned/);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('the published file is checked before and after it is inflated', async () => {
  const data = payload();
  const raw = Buffer.from(data.buffer);
  const compressed = gzipSync(raw);
  const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  const published = record({
    byte_length: raw.byteLength,
    sha256: sha(compressed),
    decoded_sha256: sha(raw),
  });
  vi.stubGlobal('fetch', async () => new Response(new Uint8Array(compressed)));
  const field = await loadField(published, 'https://example.test/models/cdmd/');
  close(field.map([-3.3, -1.7, 0.9]), expected([-3.3, -1.7, 0.9]));
  await assert.rejects(
    loadField({ ...published, sha256: '0'.repeat(64) }, 'https://example.test/models/cdmd/'),
    /checksum/,
  );
  await assert.rejects(
    loadField({ ...published, decoded_sha256: '0'.repeat(64) }, 'https://example.test/x/'),
    /integrity/,
  );
});
