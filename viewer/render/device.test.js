import assert from 'node:assert/strict';
import test from 'node:test';
import { isIntegratedGpu } from './device.js';

test('Apple Silicon and Intel iGPUs are treated as integrated', () => {
  assert.equal(isIntegratedGpu('ANGLE (Apple, ANGLE Metal Renderer: Apple M5, Unspecified Version)'), true);
  assert.equal(isIntegratedGpu('Apple M4 Pro'), true);
  assert.equal(isIntegratedGpu('Intel(R) UHD Graphics 770'), true);
  assert.equal(isIntegratedGpu('AMD Radeon Graphics'), true);
  assert.equal(isIntegratedGpu(''), true);
});

test('discrete NVIDIA, Radeon RX/Pro and Intel Arc are not integrated', () => {
  assert.equal(isIntegratedGpu('NVIDIA GeForce RTX 4090/PCIe/SSE2'), false);
  assert.equal(isIntegratedGpu('ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)'), false);
  assert.equal(isIntegratedGpu('AMD Radeon RX 6800 XT'), false);
  assert.equal(isIntegratedGpu('AMD Radeon Pro 5500M OpenGL Engine'), false);
  assert.equal(isIntegratedGpu('Intel Arc A770'), false);
});

test('Apple silicon is recognised from what WebGL reports', async () => {
  const { isAppleSilicon } = await import('./device.js');
  assert.equal(isAppleSilicon('ANGLE (Apple, ANGLE Metal Renderer: Apple M5, Unspecified Version)'), true);
  assert.equal(isAppleSilicon('Apple M4 Pro'), true);
  assert.equal(isAppleSilicon('Intel(R) UHD Graphics 770'), false);
  assert.equal(isAppleSilicon('AMD Radeon Graphics'), false);
  assert.equal(isAppleSilicon(''), false);
});
