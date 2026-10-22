import assert from 'node:assert/strict';
import test from 'node:test';
import { clinicalLayers, showClinicalRegions } from './navigation.js';

function scene(...regions) {
  const calls = [];
  const model = {
    regions: new Map(regions.map(region => [region.id, region])),
    settings: { atlas: 'hcp-mmp', detail: 'nextbrain', cortexOpacity: 0 },
    setInternalSystem(value) { calls.push(['system', value]); },
    setInternalVisible(value) { calls.push(['internal', value]); },
    clearIsolation() { calls.push(['clearIsolation']); },
    setHemisphere(side) { calls.push(['hemisphere', side]); },
    setCortexVisible(value) { calls.push(['cortex', value]); },
    setCortexOpacity(value) { calls.push(['opacity', value]); },
    showRegions(ids) { calls.push(['show', ids]); },
  };
  return { model, calls };
}

test('cortical evidence needs its atlas; the loaded one is kept while it draws any of it', () => {
  const region = { id: 'destrieux:left:38', atlas: 'destrieux', kind: 'cortex' };
  const { model } = scene(region);
  assert.deepEqual(clinicalLayers(model, [region.id]), { atlas: 'destrieux', detail: null });
  model.settings.atlas = 'destrieux';
  assert.deepEqual(clinicalLayers(model, [region.id]), { atlas: null, detail: null });
});

test('a deficit draws its mapped regions in the detail level holding most of them', () => {
  const regions = [
    { id: 'destrieux:right:26', atlas: 'destrieux', kind: 'cortex' },
    { id: 'aseg:right:49', atlas: 'aseg', kind: 'structure' },
    { id: 'aseg:right:50', atlas: 'aseg', kind: 'structure' },
    { id: 'nextbrain:right:7', atlas: 'nextbrain', kind: 'structure' },
  ];
  const { model } = scene(...regions);
  model.settings.detail = 'learning';
  assert.deepEqual(clinicalLayers(model, regions.map(region => region.id)), { atlas: 'destrieux', detail: 'aseg' });
  model.settings.detail = 'nextbrain';
  assert.equal(clinicalLayers(model, regions.map(region => region.id)).detail, null);
});

test('an unknown or non-anatomical citation is an error, not a guess', () => {
  const { model } = scene({ id: 'wall', atlas: 'destrieux', kind: 'non-region' });
  assert.throws(() => clinicalLayers(model, ['unknown']), /Unknown clinical region: unknown/);
  assert.throws(() => showClinicalRegions(model, ['wall']), /Unknown clinical region: wall/);
});

test('cortical evidence is shown with the cortex opaque and nothing isolating it', () => {
  const region = { id: 'destrieux:left:38', atlas: 'destrieux', kind: 'cortex' };
  const { model, calls } = scene(region);
  showClinicalRegions(model, [region.id]);
  assert.deepEqual(calls, [
    ['clearIsolation'], ['system', null], ['hemisphere', 'both'], ['cortex', true], ['opacity', 1],
    ['show', [region.id]],
  ]);
});

test('deep-only mappings hide the occluding cortex and show the internal anatomy', () => {
  const region = { id: 'aseg:left:17', atlas: 'aseg', kind: 'structure' };
  const { model, calls } = scene(region);
  showClinicalRegions(model, [region.id]);
  assert.deepEqual(calls, [
    ['clearIsolation'], ['system', null], ['hemisphere', 'both'], ['cortex', false], ['internal', true],
    ['show', [region.id]],
  ]);
  const empty = scene(region);
  showClinicalRegions(empty.model, []);
  assert.deepEqual(empty.calls, []);
});
