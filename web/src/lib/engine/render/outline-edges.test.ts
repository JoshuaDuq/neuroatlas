/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { PerspectiveCamera, Scene, Vector2, type Object3D, type WebGLRenderer } from 'three';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { paintOutlineEdges, sameMeshSet } from './outline-edges.ts';

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

test('the stencil test is restored when drawing the edges throws', () => {
  const calls: boolean[] = [];
  const pass = new OutlinePass(new Vector2(64, 64), new Scene(), new PerspectiveCamera());
  (pass as unknown as { _fsQuad: { render(): void } })._fsQuad.render = () => {
    throw new Error('GPU lost');
  };
  const renderer = {
    autoClear: true,
    state: { buffers: { stencil: { setTest: (on: boolean) => calls.push(on) } } },
    getClearColor: () => {},
    getClearAlpha: () => 1,
    setClearColor: () => {},
    setRenderTarget: () => {},
    clear: () => {},
  } as unknown as WebGLRenderer;
  const target = pass.renderTargetMaskBuffer;
  assert.throws(() => paintOutlineEdges(pass, target.texture, renderer, target, true), /GPU lost/);
  assert.deepEqual(calls, [false, true]);
  assert.equal(renderer.autoClear, true);
});
