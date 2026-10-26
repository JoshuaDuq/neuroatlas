import assert from 'node:assert/strict';
import { test } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial } from 'three';
import {
  FEATHER_ITEM_SIZE,
  createFeatherPalette,
  featherBorders,
  writeFeatherPalette,
} from './border-feather.ts';
import { modelDirectory, publishedLoader } from '../model/test-support.ts';

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

test('RENDER-35 on the published destrieux cortex every border weight is a share between 0 and a half, and blends reach some vertices only', async () => {
  const { scene } = await publishedLoader(modelDirectory('cdmd')).loadAsync('cortex-destrieux.glb');
  const meshes: ParcelMesh[] = [];
  scene.traverse((object) => {
    if (object instanceof Mesh && object.userData['kind'] === 'cortex') meshes.push(object);
  });
  assert.equal(meshes.length, 148);
  featherBorders(meshes);
  let feathered = 0;
  let total = 0;
  for (const mesh of meshes) {
    const values = mesh.geometry.getAttribute('_feather').array;
    for (let vertex = 0; vertex < values.length; vertex += FEATHER_ITEM_SIZE) {
      total += 1;
      for (const at of [vertex + 1, vertex + 3]) {
        const weight = values[at]!;
        assert.ok(weight >= 0 && weight <= 0.5, `${mesh.userData['region_id']}: ${weight}`);
        if (weight > 0) {
          assert.ok(values[at - 1]! >= 0 && values[at - 1]! < meshes.length);
          if (at === vertex + 1) feathered += 1;
        }
      }
    }
  }
  // Some vertices blend and the parcels' interiors do not.
  assert.ok(feathered > 1000 && feathered < total, `${feathered} of ${total}`);
});
