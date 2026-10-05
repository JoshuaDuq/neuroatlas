import assert from 'node:assert/strict';
import test from 'node:test';

test('MRI preserves native display pixels even on an integrated GPU', () => {
  const quality = qualityProfile({ integrated: true, pixelRatio: 2 });
  assert.equal(quality.pixelRatio, 1.5);
  assert.equal(quality.mriPixelRatio, 2);
});
import { motionRatio, qualityProfile } from './quality.js';

test('a phone renders at one CSS pixel and reduces MSAA', () => {
  const quality = qualityProfile({
    phone: true, coarse: true, saveData: false, pixelRatio: 3,
    deviceMemory: 4, hardwareConcurrency: 6,
  });
  assert.equal(quality.pixelRatio, 1);
  assert.equal(quality.msaaSamples, 2);
  assert.equal(quality.prefetchLayers, false);
});

test('a tablet caps pixel ratio at 1.5 and reduces MSAA', () => {
  const quality = qualityProfile({
    phone: false, coarse: true, saveData: false, pixelRatio: 3,
    deviceMemory: 8, hardwareConcurrency: 8,
  });
  assert.equal(quality.pixelRatio, 1.5);
  assert.equal(quality.msaaSamples, 2);
  assert.equal(quality.prefetchLayers, false);
});

test('a desktop workstation keeps pixel ratio at 2 and 4x MSAA', () => {
  const quality = qualityProfile({
    phone: false, coarse: false, saveData: false, pixelRatio: 3,
    deviceMemory: 16, hardwareConcurrency: 12, integrated: false,
  });
  assert.equal(quality.pixelRatio, 2);
  assert.equal(quality.msaaSamples, 4);
  assert.equal(quality.prefetchLayers, true);
});

test('an integrated GPU spends fewer pixels and uses 2x MSAA', () => {
  const quality = qualityProfile({
    phone: false, coarse: false, saveData: false, pixelRatio: 3,
    deviceMemory: 16, hardwareConcurrency: 12, integrated: true,
  });
  assert.equal(quality.pixelRatio, 1.5);
  assert.equal(quality.msaaSamples, 2);
  assert.equal(quality.prefetchLayers, false);
});

test('Save-Data drops extra layer prefetch', () => {
  const quality = qualityProfile({
    phone: false, coarse: false, saveData: true, pixelRatio: 2,
    deviceMemory: 8, hardwareConcurrency: 8,
  });
  assert.equal(quality.prefetchLayers, false);
});

test('low-memory devices drop extra layer prefetch even on a wide screen', () => {
  const quality = qualityProfile({
    phone: false, coarse: false, saveData: false, pixelRatio: 2,
    deviceMemory: 2, hardwareConcurrency: 8,
  });
  assert.equal(quality.prefetchLayers, false);
});

test('an Apple Silicon Mac renders at its display density but keeps 2x MSAA', () => {
  // Measured on an M5: at 2x pixels an MRI cut misses ~2% of frames; 4x MSAA halves its rate.
  const quality = qualityProfile({
    phone: false, coarse: false, saveData: false, pixelRatio: 2,
    deviceMemory: 16, integrated: true, appleSilicon: true,
  });
  assert.equal(quality.pixelRatio, 2);
  assert.equal(quality.msaaSamples, 2);
});

test('an iPad keeps the handheld budget although its GPU is Apple silicon', () => {
  const quality = qualityProfile({
    phone: false, coarse: true, saveData: false, pixelRatio: 2,
    deviceMemory: 8, integrated: true, appleSilicon: true,
  });
  assert.equal(quality.pixelRatio, 1.5);
});

test('a moving camera renders at most one device pixel per CSS pixel; a settled one keeps the full ratio', () => {
  const retina = qualityProfile({ phone: false, coarse: false, pixelRatio: 2, integrated: true, appleSilicon: true });
  assert.equal(retina.pixelRatio, 2);
  assert.equal(retina.motionPixelRatio, 1);
  const phone = qualityProfile({ phone: true, coarse: true, pixelRatio: 3 });
  assert.equal(phone.motionPixelRatio, phone.pixelRatio);
  const lowDpi = qualityProfile({ phone: false, coarse: false, pixelRatio: 1, integrated: false });
  assert.equal(lowDpi.motionPixelRatio, 1);
});

test('a moving picture keeps to a pixel budget, so a very large canvas drops below one pixel per CSS pixel', () => {
  assert.equal(motionRatio(1, 1120, 824), 1);
  assert.equal(motionRatio(2, 1120, 824), 1.47);
  assert.equal(motionRatio(1, 2240, 1392), 0.8);
  assert.equal(motionRatio(1, 0, 0), 1);
});
