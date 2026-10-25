// Fail-fast probe of what the renderer needs from the browser, in headless Chromium
// (SwiftShader through ANGLE, vitest.config.ts). It mirrors viewer/main.js:30-41, which
// requires WebGL 2 and EXT_color_buffer_float, and viewer/render/scene.js, which draws
// into multisampled RGBA16F targets.
//
// Documented fallback for F5, if this fails on GitHub runners: install `mesa-vulkan-drivers`
// (lavapipe), launch Chromium with `--use-angle=vulkan` instead of SwiftShader, set
// `headless: false` and run the command under `xvfb-run -a`.
import { expect, test } from 'vitest';

const MSAA_SAMPLES = 4;

test('WebGL 2 draws into a 4x multisampled RGBA16F framebuffer', () => {
  const gl = document.createElement('canvas').getContext('webgl2');
  expect(gl, 'WebGL 2 context').not.toBeNull();
  if (!gl) return;

  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = info
    ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER);
  console.info(`WebGL renderer: ${renderer}`);

  expect(gl.getExtension('EXT_color_buffer_float'), 'EXT_color_buffer_float').not.toBeNull();

  const supported = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES);
  expect(Math.max(...supported), 'largest RGBA16F sample count').toBeGreaterThanOrEqual(
    MSAA_SAMPLES,
  );

  const renderbuffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
  gl.renderbufferStorageMultisample(gl.RENDERBUFFER, MSAA_SAMPLES, gl.RGBA16F, 64, 64);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, renderbuffer);

  expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).toBe(gl.FRAMEBUFFER_COMPLETE);
  expect(gl.getError()).toBe(gl.NO_ERROR);
  expect(gl.getRenderbufferParameter(gl.RENDERBUFFER, gl.RENDERBUFFER_SAMPLES)).toBe(MSAA_SAMPLES);

  gl.deleteFramebuffer(framebuffer);
  gl.deleteRenderbuffer(renderbuffer);
  gl.getExtension('WEBGL_lose_context')?.loseContext();
});
