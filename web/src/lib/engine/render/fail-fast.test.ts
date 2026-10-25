/// <reference types="node" />
// The behaviours that deliberately differ from the legacy modules; see
// web/docs/decisions/deviations/e1-render-primitives.md.
import assert from 'node:assert/strict';
import { Box3, PerspectiveCamera, Scene, Vector2, Vector3, type WebGLRenderer } from 'three';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { onTestFinished, test, vi } from 'vitest';
import type { CutMode } from '../../types/index.ts';
import { createFrame } from '../slices/coordinates.ts';
import { VIEW_DIRECTIONS, fitDistance } from './camera-views.ts';
import { detectIntegratedGpu } from './device.ts';
import { paintOutlineEdges } from './outline-edges.ts';

test('fitting to an empty point list is refused rather than reporting a zero distance', () => {
  const camera = new PerspectiveCamera(35, 1.6, 0.001, 10);
  const bounds = new Box3(new Vector3(-0.08, -0.07, -0.1), new Vector3(0.08, 0.11, 0.1));
  assert.throws(
    () => fitDistance(camera, bounds, VIEW_DIRECTIONS.left, {}, new Float32Array()),
    RangeError,
  );
});

test('names inherited from Object are not section planes', () => {
  for (const name of ['constructor', 'toString', '__proto__']) {
    assert.throws(() => createFrame(name as CutMode, [0, 0, 0]), /plane/i, name);
  }
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

test('the GPU probe releases its context and lets errors surface', () => {
  const lose = vi.fn();
  const info = { UNMASKED_RENDERER_WEBGL: 37446 };
  const gl = {
    getExtension: (name: string) =>
      name === 'WEBGL_debug_renderer_info' ? info : { loseContext: lose },
    getParameter: () => 'NVIDIA GeForce RTX 4090',
  };
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => gl }) });
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
  assert.equal(detectIntegratedGpu(), false);
  assert.equal(lose.mock.calls.length, 1);

  vi.stubGlobal('document', {
    createElement: () => ({
      getContext: () => {
        throw new Error('no context');
      },
    }),
  });
  assert.throws(() => detectIntegratedGpu(), /no context/);
});
