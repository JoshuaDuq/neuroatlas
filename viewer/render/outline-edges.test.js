import assert from 'node:assert/strict';
import test from 'node:test';
import { sameMeshSet } from './outline-edges.js';

test('the same meshes match in either order', () => {
  const a = { id: 'a' };
  const b = { id: 'b' };
  assert.equal(sameMeshSet([a, b], [b, a]), true);
  assert.equal(sameMeshSet([a], [a]), true);
  assert.equal(sameMeshSet([], []), true);
});

test('a different mesh or a different count does not match', () => {
  const a = { id: 'a' };
  const b = { id: 'b' };
  assert.equal(sameMeshSet([a], [b]), false);
  assert.equal(sameMeshSet([a, b], [a]), false);
  assert.equal(sameMeshSet([a], []), false);
});
