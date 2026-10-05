import assert from 'node:assert/strict';
import test from 'node:test';
import { openClinicalRegion, revealClinicalRegions } from './navigation.js';

function scene(...regions) {
  const calls = [];
  const model = {
    regions: new Map(regions.map(region => [region.id, region])),
    settings: { atlas: 'hcp-mmp', detail: 'nextbrain', cortexOpacity: 0 },
    async setAtlas(id) { calls.push(['atlas', id]); this.settings.atlas = id; },
    async setDetail(id) { calls.push(['detail', id]); this.settings.detail = id; },
    setInternalSystem(value) { calls.push(['system', value]); },
    setInternalVisible(value) { calls.push(['internal', value]); },
    clearIsolation() { calls.push(['clearIsolation']); },
    setHemisphere(side) { calls.push(['hemisphere', side]); },
    setCortexVisible(value) { calls.push(['cortex', value]); },
    setCortexOpacity(value) { calls.push(['opacity', value]); },
    showRegions(ids) { calls.push(['show', ids]); },
    select(id) { calls.push(['select', id]); },
  };
  const sections = { async setMode(mode) { calls.push(['cut', mode]); } };
  return { model, sections, calls };
}

test('opening cortical evidence loads its atlas before selecting and reveals hidden anatomy', async () => {
  const region = { id: 'destrieux:left:38', atlas: 'destrieux', kind: 'cortex' };
  const { model, sections, calls } = scene(region);
  await openClinicalRegion(model, sections, region.id);
  assert.deepEqual(calls, [
    ['atlas', 'destrieux'], ['cut', 'off'], ['clearIsolation'], ['system', null],
    ['hemisphere', 'both'], ['cortex', true], ['opacity', 1],
    ['show', [region.id]], ['select', region.id],
  ]);
});

test('opening a hippocampus loads coarse anatomy and hides the occluding cortex', async () => {
  const region = { id: 'aseg:left:17', atlas: 'aseg', kind: 'structure' };
  const { model, sections, calls } = scene(region);
  await openClinicalRegion(model, sections, region.id);
  assert.deepEqual(calls, [
    ['detail', 'aseg'], ['cut', 'off'], ['clearIsolation'], ['system', null],
    ['hemisphere', 'both'], ['cortex', false], ['internal', true], ['show', [region.id]], ['select', region.id],
  ]);
});

test('hidden internal anatomy is restored before selecting a deep landmark', async () => {
  const region = { id: 'learning:left:fornix', atlas: 'learning', kind: 'structure' };
  const { model, sections } = scene(region);
  let internalVisible = false;
  model.setInternalVisible = value => { internalVisible = value; };
  model.select = id => {
    assert.equal(internalVisible, true, `cannot select hidden landmark ${id}`);
  };
  await openClinicalRegion(model, sections, region.id);
});

test('an unsuccessful atlas load surfaces the error without selecting an unavailable region', async () => {
  const region = { id: 'destrieux:left:38', atlas: 'destrieux', kind: 'cortex' };
  const { model, sections, calls } = scene(region);
  model.setAtlas = async () => { throw new Error('Atlas unavailable'); };
  await assert.rejects(openClinicalRegion(model, sections, region.id), /Atlas unavailable/);
  assert.deepEqual(calls, []);
  await assert.rejects(openClinicalRegion(model, sections, 'unknown'), /Unknown clinical region/);
});

test('a deficit draws its mapped regions together, in the detail level holding most of them', async () => {
  const regions = [
    { id: 'destrieux:right:26', atlas: 'destrieux', kind: 'cortex' },
    { id: 'aseg:right:49', atlas: 'aseg', kind: 'structure' },
    { id: 'aseg:right:50', atlas: 'aseg', kind: 'structure' },
    { id: 'nextbrain:right:7', atlas: 'nextbrain', kind: 'structure' },
  ];
  const { model, sections, calls } = scene(...regions);
  model.settings.detail = 'learning';
  const ids = regions.map(region => region.id);
  await revealClinicalRegions(model, sections, ids);
  assert.deepEqual(calls, [
    ['atlas', 'destrieux'], ['detail', 'aseg'], ['cut', 'off'], ['clearIsolation'], ['system', null],
    ['hemisphere', 'both'], ['cortex', true], ['opacity', 1], ['internal', true], ['show', ids],
  ]);
});

test('deep-only mappings hide the cortex, and a detail level already holding one is kept', async () => {
  const regions = [
    { id: 'nextbrain:left:458', atlas: 'nextbrain', kind: 'structure' },
    { id: 'aseg:left:10', atlas: 'aseg', kind: 'structure' },
    { id: 'aseg:left:11', atlas: 'aseg', kind: 'structure' },
  ];
  const { model, sections, calls } = scene(...regions);
  await revealClinicalRegions(model, sections, regions.map(region => region.id));
  assert.equal(calls.some(([kind]) => kind === 'detail' || kind === 'atlas'), false);
  assert.ok(calls.some(([kind, value]) => kind === 'cortex' && value === false));
  const empty = scene(regions[0]);
  await revealClinicalRegions(empty.model, empty.sections, []);
  assert.deepEqual(empty.calls, []);
});
