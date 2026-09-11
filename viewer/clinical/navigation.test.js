import assert from 'node:assert/strict';
import test from 'node:test';
import { openClinicalRegion } from './navigation.js';

function scene(region) {
  const calls = [];
  const model = {
    regions: new Map([[region.id, region]]),
    settings: { atlas: 'hcp-mmp', detail: 'nextbrain', cortexOpacity: 0 },
    async setAtlas(id) { calls.push(['atlas', id]); this.settings.atlas = id; },
    async setDetail(id) { calls.push(['detail', id]); this.settings.detail = id; },
    clearIsolation() { calls.push(['clearIsolation']); },
    setHemisphere(side) { calls.push(['hemisphere', side]); },
    setCortexVisible(value) { calls.push(['cortex', value]); },
    setCortexOpacity(value) { calls.push(['opacity', value]); },
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
    ['atlas', 'destrieux'], ['cut', 'off'], ['clearIsolation'],
    ['hemisphere', 'both'], ['cortex', true], ['opacity', 1], ['select', region.id],
  ]);
});

test('opening a hippocampus loads coarse anatomy and hides the occluding cortex', async () => {
  const region = { id: 'aseg:left:17', atlas: 'aseg', kind: 'structure' };
  const { model, sections, calls } = scene(region);
  await openClinicalRegion(model, sections, region.id);
  assert.deepEqual(calls, [
    ['detail', 'aseg'], ['cut', 'off'], ['clearIsolation'],
    ['hemisphere', 'both'], ['cortex', false], ['select', region.id],
  ]);
});

test('an unsuccessful atlas load surfaces the error without selecting an unavailable region', async () => {
  const region = { id: 'destrieux:left:38', atlas: 'destrieux', kind: 'cortex' };
  const { model, sections, calls } = scene(region);
  model.setAtlas = async () => { throw new Error('Atlas unavailable'); };
  await assert.rejects(openClinicalRegion(model, sections, region.id), /Atlas unavailable/);
  assert.deepEqual(calls, []);
  await assert.rejects(openClinicalRegion(model, sections, 'unknown'), /Unknown clinical region/);
});
