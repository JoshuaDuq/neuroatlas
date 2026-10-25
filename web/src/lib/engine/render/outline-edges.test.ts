/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Object3D } from 'three';
import { sameMeshSet } from './outline-edges.ts';

test('the same meshes match in either order', () => {
  const a = { id: 'a' } as unknown as Object3D;
  const b = { id: 'b' } as unknown as Object3D;
  assert.equal(sameMeshSet([a, b], [b, a]), true);
  assert.equal(sameMeshSet([a], [a]), true);
  assert.equal(sameMeshSet([], []), true);
});

test('a different mesh or a different count does not match', () => {
  const a = { id: 'a' } as unknown as Object3D;
  const b = { id: 'b' } as unknown as Object3D;
  assert.equal(sameMeshSet([a], [b]), false);
  assert.equal(sameMeshSet([a, b], [a]), false);
  assert.equal(sameMeshSet([a], []), false);
});
