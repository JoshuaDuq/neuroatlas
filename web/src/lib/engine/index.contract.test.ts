import { afterAll, beforeAll, vi } from 'vitest';
import { defineEngineContract } from './fake/contract-suite.ts';
import { bootHeadless, stubHeadlessGlobals, stubPublishedFetch } from './headless-support.ts';
import type { HeadlessProbe } from './headless-renderer.ts';

const probe = vi.hoisted(
  (): HeadlessProbe => ({ attributes: new Map(), rendererDisposed: 0, loop: null }),
);
vi.mock('three', async (importOriginal) =>
  (await import('./headless-renderer.ts')).withHeadlessRenderer(
    await importOriginal<typeof import('three')>(),
    probe,
  ),
);
vi.mock('./render/lighting.ts', () => ({
  createAnatomicalLighting: () => ({ texture: null, dispose() {} }),
}));

// Compiling the outline programs is a draw.
vi.mock('./render/scene.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('./render/scene.ts')>();
  return {
    ...original,
    createScene: (...args: Parameters<typeof original.createScene>) => {
      const scene = original.createScene(...args);
      scene.warmOutlines = () => {};
      return scene;
    },
  };
});

beforeAll(() => {
  stubHeadlessGlobals();
  stubPublishedFetch();
});
afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

defineEngineContract('real engine, headless', bootHeadless, {
  canvas: {} as HTMLCanvasElement,
  comparison: {
    id: 'overlap:left:-1:0',
    geometry: {
      file: 'atlas-overlaps.glb',
      sha256: 'c6ebb202fc9ec9852cc75ae8e6023d7efdd85e10e084abc3901e65d397b1d80c',
    },
  },
});
