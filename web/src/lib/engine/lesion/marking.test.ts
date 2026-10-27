import assert from 'node:assert/strict';
import { BufferGeometry, Float32BufferAttribute, Matrix4, Mesh, Vector3 } from 'three';
import { test } from 'vitest';
import { footprint } from './marking.ts';

/** Two triangles side by side: one centred at x = 0, one at x = 10. */
function strip(matrix = new Matrix4()): Mesh {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 0, 2, 0, 9, -1, 0, 11, -1, 0, 10, 2, 0], 3),
  );
  const mesh = new Mesh(geometry);
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(matrix);
  mesh.updateMatrixWorld(true);
  return mesh;
}

test('keeps the triangles whose centroid lies within the radius, in world space', () => {
  const { positions } = footprint([strip()], new Vector3(0, 0, 0), 2);
  assert.deepEqual([...positions], [-1, -1, 0, 1, -1, 0, 0, 2, 0]);
});

test('reads a mesh through its world matrix', () => {
  const moved = strip(new Matrix4().makeTranslation(0, 0, 5));
  const { positions } = footprint([moved], new Vector3(0, 0, 5), 2);
  assert.deepEqual([...positions], [-1, -1, 5, 1, -1, 5, 0, 2, 5]);
});

test('reads indexed geometry', () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute([5, 5, 5, -1, -1, 0, 1, -1, 0, 0, 2, 0], 3),
  );
  geometry.setIndex([1, 2, 3, 0, 0, 0]);
  const mesh = new Mesh(geometry);
  mesh.updateMatrixWorld(true);
  assert.deepEqual(
    [...footprint([mesh], new Vector3(), 2).positions],
    [-1, -1, 0, 1, -1, 0, 0, 2, 0],
  );
});

test('keeps the surface’s own normals, turned with the mesh, so the paint shades as the cortex does', () => {
  const mesh = strip(new Matrix4().makeRotationY(Math.PI / 2));
  const normals = new Float32Array(18);
  for (let i = 0; i < 6; i++) normals.set([0, 0, 1], i * 3);
  mesh.geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  const { normals: kept } = footprint([mesh], new Vector3(), 2);
  // +z turned a quarter about y is +x.
  assert.deepEqual(
    [...kept].map((value) => Math.round(value)),
    [1, 0, 0, 1, 0, 0, 1, 0, 0],
  );
});
