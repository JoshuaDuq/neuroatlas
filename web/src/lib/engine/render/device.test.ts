import assert from 'node:assert/strict';
import { onTestFinished, test, vi } from 'vitest';
import { PHONE_QUERY } from '../../types/constants.ts';
import { detectIntegratedGpu, isIntegratedGpu, isPhone, pixelRatioCap } from './device.ts';

for (const { width, height, compact, phone } of [
  { width: 390, height: 844, compact: true, phone: true },
  { width: 681, height: 900, compact: true, phone: false },
  { width: 800, height: 900, compact: true, phone: false },
  { width: 821, height: 900, compact: false, phone: false },
  { width: 1000, height: 900, compact: false, phone: false },
  { width: 844, height: 390, compact: true, phone: true },
]) {
  test(`${width}×${height} selects its interface shell without changing the phone rendering budget`, () => {
    vi.stubGlobal('devicePixelRatio', 2);
    vi.stubGlobal('matchMedia', (query: string) => {
      const maxWidth = Number(query.match(/max-width:\s*(\d+)px/)?.[1] ?? 0);
      return {
        matches:
          query !== '(pointer: coarse)' && (width <= maxWidth || (height <= 480 && width > height)),
      };
    });
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    assert.equal(globalThis.matchMedia(PHONE_QUERY).matches, compact);
    assert.equal(isPhone(), phone);
    assert.equal(pixelRatioCap(), phone ? 1 : 2);
    assert.equal(pixelRatioCap(true), phone ? 1 : 1.5);
  });
}

test('Apple Silicon and Intel iGPUs are treated as integrated', () => {
  assert.equal(
    isIntegratedGpu('ANGLE (Apple, ANGLE Metal Renderer: Apple M5, Unspecified Version)'),
    true,
  );
  assert.equal(isIntegratedGpu('Apple M4 Pro'), true);
  assert.equal(isIntegratedGpu('Intel(R) UHD Graphics 770'), true);
  assert.equal(isIntegratedGpu('AMD Radeon Graphics'), true);
  assert.equal(isIntegratedGpu(''), true);
});

test('discrete NVIDIA, Radeon RX/Pro and Intel Arc are not integrated', () => {
  assert.equal(isIntegratedGpu('NVIDIA GeForce RTX 4090/PCIe/SSE2'), false);
  assert.equal(
    isIntegratedGpu('ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)'),
    false,
  );
  assert.equal(isIntegratedGpu('AMD Radeon RX 6800 XT'), false);
  assert.equal(isIntegratedGpu('AMD Radeon Pro 5500M OpenGL Engine'), false);
  assert.equal(isIntegratedGpu('Intel Arc A770'), false);
});

test('Apple silicon is recognised from what WebGL reports', async () => {
  const { isAppleSilicon } = await import('./device.ts');
  assert.equal(
    isAppleSilicon('ANGLE (Apple, ANGLE Metal Renderer: Apple M5, Unspecified Version)'),
    true,
  );
  assert.equal(isAppleSilicon('Apple M4 Pro'), true);
  assert.equal(isAppleSilicon('Intel(R) UHD Graphics 770'), false);
  assert.equal(isAppleSilicon('AMD Radeon Graphics'), false);
  assert.equal(isAppleSilicon(''), false);
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

test('RENDER-31 without a document the GPU is not integrated', () => {
  vi.stubGlobal('document', undefined);
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
  assert.equal(detectIntegratedGpu(), false);
});
