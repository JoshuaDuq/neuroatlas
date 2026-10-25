/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial } from 'three';
import {
  FEATHER_ITEM_SIZE,
  createFeatherPalette,
  featherBorders,
  writeFeatherPalette,
} from './border-feather.ts';

type ParcelMesh = Mesh<BufferGeometry, MeshStandardMaterial>;

/** A strip of unit squares, two triangles each, over `xs` millimetres and y = 0..1 mm. */
function strip(xs: number[]): ParcelMesh {
  const positions = xs.flatMap((x) => [x, 0, 0, x, 1, 0]).map((value) => value / 1000);
  const index: number[] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const a = i * 2;
    index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  return new Mesh(geometry, new MeshStandardMaterial());
}

const feather = (mesh: ParcelMesh, vertex: number) =>
  Array.from(
    mesh.geometry
      .getAttribute('_feather')
      .array.slice(vertex * FEATHER_ITEM_SIZE, (vertex + 1) * FEATHER_ITEM_SIZE),
  );

const close = (actual: number[], expected: number[]) =>
  expected.forEach((value, i) =>
    assert.ok(Math.abs(actual[i]! - value) < 1e-6, `${actual} is not ${expected}`),
  );

test('two parcels split their shared border evenly and fade to their own colour', () => {
  const left = strip([-3, -2, -1, 0]);
  const right = strip([0, 1, 2, 3]);
  featherBorders([left, right], 0.0015);
  // Vertices 6 and 7 sit on the border, 4 and 5 one millimetre in, 0..3 beyond the radius.
  close(feather(left, 6), [1, 0.5, 0, 0]);
  close(feather(left, 7), [1, 0.5, 0, 0]);
  close(feather(left, 4), [1, 0.5 / 3, 0, 0]);
  close(feather(right, 0), [0, 0.5, 0, 0]);
  close(feather(right, 2), [0, 0.5 / 3, 0, 0]);
  for (const vertex of [0, 1, 2, 3]) close(feather(left, vertex), [0, 0, 0, 0]);
});

test('three parcels meeting at a point take a third each there', () => {
  const fan = [
    [0, 1],
    [1, 2],
    [2, 0],
  ].map(([a, b]) => {
    const angle = (k: number) => (k * 2 * Math.PI) / 3;
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(
        [
          0,
          0,
          0,
          Math.cos(angle(a!)) / 1000,
          Math.sin(angle(a!)) / 1000,
          0,
          Math.cos(angle(b!)) / 1000,
          Math.sin(angle(b!)) / 1000,
          0,
        ],
        3,
      ),
    );
    geometry.setIndex([0, 1, 2]);
    return new Mesh(geometry, new MeshStandardMaterial());
  });
  featherBorders(fan, 0.0015);
  close(feather(fan[0]!, 0), [1, 1 / 3, 2, 1 / 3]);
  close(feather(fan[1]!, 0), [0, 1 / 3, 2, 1 / 3]);
});

test('a parcel that shares no vertex is left as it was', () => {
  const alone = strip([0, 1]);
  const apart = strip([5, 6]);
  featherBorders([alone, apart]);
  for (const vertex of [0, 1, 2, 3]) close(feather(alone, vertex), [0, 0, 0, 0]);
});

test('the palette carries each colour, and hides a hidden parcel from its neighbours', () => {
  const shown = strip([0, 1]);
  const hidden = strip([1, 2]);
  shown.material.color.setRGB(0.25, 0.5, 0.75);
  hidden.visible = false;
  const palette = createFeatherPalette(2);
  writeFeatherPalette(palette, [shown, hidden]);
  const data = palette.image.data as Float32Array;
  assert.deepEqual(Array.from(data.slice(0, 4)), [0.25, 0.5, 0.75, 1]);
  assert.equal(data[7], 0);
});

test('feathering refuses unindexed geometry', () => {
  const mesh = strip([0, 1]);
  mesh.geometry.setIndex(null);
  assert.throws(() => featherBorders([mesh]), /indexed/);
});
