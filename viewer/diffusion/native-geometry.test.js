import assert from 'node:assert/strict';
import test from 'node:test';
import { Color, ColorManagement, LinearSRGBColorSpace, SRGBColorSpace, Vector3 } from 'three';
import { RAS_MM_TO_WORLD, createTractGeometry, filterTractGeometry } from './native-geometry.js';

const points = new Float32Array([
  100, 200, 300, 103, 204, 300, 100, 200, 300,
  -100, 0, 0, -100, 0, 20,
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
  assert.deepEqual(Array.from(geometry.index.array), [0, 1, 1, 2, 3, 4]);
  const position = geometry.getAttribute('position');
  const color = geometry.getAttribute('color');
  const index = geometry.index;
  filterTractGeometry(geometry, offsets, lengths, 15);
  assert.deepEqual(Array.from(geometry.index.array.slice(0, geometry.drawRange.count)), [3, 4]);
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
  const shown = index => new Color(color.getX(index), color.getY(index), color.getZ(index))
    .getRGB(new Color(), SRGBColorSpace);
  assert.equal(ColorManagement.workingColorSpace, LinearSRGBColorSpace);
  for (const [index, expected] of [[1, [0.6, 0.8, 0]], [4, [0, 0, 1]]]) {
    const { r, g, b } = shown(index);
    [r, g, b].forEach((value, axis) => assert.ok(Math.abs(value - expected[axis]) < 1 / 255, `${value} ≠ ${expected[axis]}`));
  }
  geometry.dispose();
});
