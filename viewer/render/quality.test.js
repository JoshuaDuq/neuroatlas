import assert from 'node:assert/strict';
import test from 'node:test';
import { qualityProfile } from './quality.js';

test('a phone caps pixel ratio at 1.5 and reduces MSAA', () => {
  const quality = qualityProfile({
    phone: true, coarse: true, saveData: false, pixelRatio: 3,
    deviceMemory: 4, hardwareConcurrency: 6,
  });
  assert.equal(quality.pixelRatio, 1.5);
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
