import assert from 'node:assert/strict';
import { test } from 'vitest';
import { Color, ColorManagement, LinearSRGBColorSpace, SRGBColorSpace, Vector3 } from 'three';
import { RAS_MM_TO_WORLD, createTractGeometry, filterTractGeometry } from './native-geometry.ts';

const points = new Float32Array([
  100, 200, 300, 103, 204, 300, 100, 200, 300, -100, 0, 0, -100, 0, 20,
]);
const offsets = new Uint32Array([0, 3, 5]);

test('native tract coordinates preserve RAS orientation and millimeter scale', () => {
  const original = points.slice();
  const { geometry, lengths } = createTractGeometry(points, offsets);
  const position = geometry.getAttribute('position');
  assert.equal(position.count, points.length / 3);
  // The lines draw the source points themselves; their matrix carries mm → m and the axes.
  assert.equal(position.array, points);
  const world = new Vector3().fromBufferAttribute(position, 0).applyMatrix4(RAS_MM_TO_WORLD);
  assert.ok(Math.abs(world.x - 0.1) < 1e-7);
  assert.ok(Math.abs(world.y - 0.3) < 1e-7);
  assert.ok(Math.abs(world.z + 0.2) < 1e-7);
  assert.deepEqual(points, original);
  assert.deepEqual(Array.from(lengths), [10, 20]);
  geometry.dispose();
});

test('native lines never join separate streamlines and filter only their indices', () => {
  const { geometry, lengths } = createTractGeometry(points, offsets);
  assert.deepEqual(Array.from(geometry.index!.array), [0, 1, 1, 2, 3, 4]);
  const position = geometry.getAttribute('position');
  const color = geometry.getAttribute('color');
  const index = geometry.index;
  filterTractGeometry(geometry, offsets, lengths, 15);
  assert.deepEqual(Array.from(geometry.index!.array.slice(0, geometry.drawRange.count)), [3, 4]);
  assert.equal(geometry.index, index);
  assert.equal(geometry.getAttribute('position'), position);
  assert.equal(geometry.getAttribute('color'), color);
  filterTractGeometry(geometry, offsets, lengths, 25);
  assert.equal(geometry.drawRange.count, 0);
  geometry.dispose();
});

test('direction colours display as |R|, |A|, |S| after the sRGB output encoding', () => {
  const line = new Float32Array([0, 0, 0, 3, 4, 0, 6, 8, 0, 0, 0, 0, 0, 0, 5]);
  const { geometry } = createTractGeometry(line, new Uint32Array([0, 3, 5]));
  const color = geometry.getAttribute('color');
  const shown = (index: number) =>
    new Color(color.getX(index), color.getY(index), color.getZ(index)).getRGB(
      new Color(),
      SRGBColorSpace,
    );
  assert.equal(ColorManagement.workingColorSpace, LinearSRGBColorSpace);
  const expectations: [number, number[]][] = [
    [1, [0.6, 0.8, 0]],
    [4, [0, 0, 1]],
  ];
  for (const [index, expected] of expectations) {
    const { r, g, b } = shown(index);
    [r, g, b].forEach((value, axis) =>
      assert.ok(Math.abs(value - expected[axis]!) < 1 / 255, `${value} ≠ ${expected[axis]}`),
    );
  }
  geometry.dispose();
});

test('a minimum below 1 mm is rejected', () => {
  const { geometry, lengths } = createTractGeometry(points, offsets);
  for (const minimum of [0, -1, NaN]) {
    assert.throws(() => filterTractGeometry(geometry, offsets, lengths, minimum), /at least 1 mm/);
  }
});

test('DIFF-09 a point with no direction is black, as is the tract centre of a doubled point', () => {
  const doubled = new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 5, 1]);
  const { geometry } = createTractGeometry(doubled, new Uint32Array([0, 4]));
  const color = geometry.getAttribute('color');
  // Points 0 and 1 have a zero central difference; point 3 has a one-sided one along x and y.
  for (const index of [0, 1]) {
    assert.deepEqual([color.getX(index), color.getY(index), color.getZ(index)], [0, 0, 0]);
  }
  assert.ok(color.getX(3) > 0 && color.getY(3) > 0 && color.getZ(3) === 0);
  geometry.dispose();
});

test('DIFF-07 a streamline exactly as long as the minimum is kept', () => {
  const { geometry, lengths } = createTractGeometry(points, offsets);
  filterTractGeometry(geometry, offsets, lengths, 20);
  assert.deepEqual(Array.from(geometry.index!.array.slice(0, geometry.drawRange.count)), [3, 4]);
  geometry.dispose();
});

test('DIFF-06 the bounds of the lines are the bounds of the source points', () => {
  const { geometry } = createTractGeometry(points, offsets);
  assert.deepEqual(geometry.boundingBox!.min.toArray(), [-100, 0, 0]);
  assert.deepEqual(geometry.boundingBox!.max.toArray(), [103, 204, 300]);
  geometry.dispose();
});
