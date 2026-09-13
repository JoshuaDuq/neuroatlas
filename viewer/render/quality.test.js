import assert from 'node:assert/strict';
import test from 'node:test';
import { occlusionActive, qualityProfile } from './quality.js';

test('a phone does not run ambient occlusion and caps pixel ratio at 1.5', () => {
  const quality = qualityProfile({
    phone: true, coarse: true, saveData: false, pixelRatio: 3,
    deviceMemory: 4, hardwareConcurrency: 6,
  });
  assert.equal(quality.occlusion, false);
  assert.equal(quality.pixelRatio, 1.5);
  assert.equal(quality.msaaSamples, 2);
  assert.equal(quality.prefetchLayers, false);
});

test('a tablet drops ambient occlusion and caps pixel ratio at 1.5', () => {
  // An iPad is wider than the phone layout query, so it was taking the
  // desktop path: full-resolution GTAO, 4x MSAA, and a 2× pixel ratio over
  // a thousand CSS pixels. That is what made the orbit feel stuck.
  const quality = qualityProfile({
    phone: false, coarse: true, saveData: false, pixelRatio: 3,
    deviceMemory: 8, hardwareConcurrency: 8,
  });
  assert.equal(quality.occlusion, false);
  assert.equal(quality.pixelRatio, 1.5);
  assert.equal(quality.msaaSamples, 2);
  assert.equal(quality.prefetchLayers, false);
});

test('a desktop workstation keeps occlusion and caps pixel ratio at 2', () => {
  const quality = qualityProfile({
    phone: false, coarse: false, saveData: false, pixelRatio: 3,
    deviceMemory: 16, hardwareConcurrency: 12, integrated: false,
  });
  assert.equal(quality.occlusion, true);
  assert.equal(quality.pixelRatio, 2);
  assert.equal(quality.msaaSamples, 4);
  assert.equal(quality.occlusionScale, 1);
  assert.equal(quality.prefetchLayers, true);
});

test('an integrated GPU keeps occlusion but spends fewer pixels', () => {
  // An M-series Mac has a trackpad, so it is not a tablet, and enough RAM
  // that it is not a phone. GTAO stays; the retina 2× buffer and 4× MSAA
  // do not — that fill rate is what a discrete GPU has and a laptop iGPU
  // does not.
  const quality = qualityProfile({
    phone: false, coarse: false, saveData: false, pixelRatio: 3,
    deviceMemory: 16, hardwareConcurrency: 12, integrated: true,
  });
  assert.equal(quality.occlusion, true);
  assert.equal(quality.pixelRatio, 1.5);
  assert.equal(quality.msaaSamples, 2);
  assert.equal(quality.prefetchLayers, false);
});

test('Save-Data drops occlusion and extra layer prefetch', () => {
  const quality = qualityProfile({
    phone: false, coarse: false, saveData: true, pixelRatio: 2,
    deviceMemory: 8, hardwareConcurrency: 8,
  });
  assert.equal(quality.occlusion, false);
  assert.equal(quality.prefetchLayers, false);
});

test('low-memory devices drop occlusion even on a wide screen', () => {
  const quality = qualityProfile({
    phone: false, coarse: false, saveData: false, pixelRatio: 2,
    deviceMemory: 2, hardwareConcurrency: 8,
  });
  assert.equal(quality.occlusion, false);
  assert.equal(quality.prefetchLayers, false);
});

test('occlusion survives a click or orbit; only cuts, transparency and the device drop it', () => {
  const idle = { enabled: true, moving: false, transparent: false, sections: false };
  assert.equal(occlusionActive(idle), true);
  assert.equal(occlusionActive({ ...idle, moving: true }), true);
  assert.equal(occlusionActive({ ...idle, transparent: true }), false);
  assert.equal(occlusionActive({ ...idle, sections: true }), false);
  assert.equal(occlusionActive({ ...idle, enabled: false }), false);
});
