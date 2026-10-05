import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { BrainAtlas } from '../model/brain-atlas.js';
import { openCircuitLandmark, prepareCircuitMri } from './navigation.js';

test('the actual model accepts a hidden landmark only after the tour reveals it', async () => {
  const manifest = JSON.parse(readFileSync(new URL('../../public/models/bert/manifest.json', import.meta.url)));
  const model = new BrainAtlas(manifest, {});
  model.atlasId = 'destrieux';
  model.detailId = 'learning';
  model.setInternalVisible(false);
  const step = { region: 'learning:midline:optic-chiasm' };
  assert.throws(() => model.select(step.region), /Region is not visible/);
  await openCircuitLandmark(model, { async setMode() {} }, step);
  assert.equal(model.state.selectedRegion.id, step.region);
  assert.equal(model.state.internalVisible, true);
  model.dispose();
});

test('a deep cerebellar lesson uncovers the nucleus and returning restores its cortex', async () => {
  const manifest = JSON.parse(readFileSync(new URL('../../public/models/bert/manifest.json', import.meta.url)));
  const model = new BrainAtlas(manifest, {});
  model.atlasId = 'destrieux';
  model.detailId = 'learning';
  const sections = { async setMode() {} };
  const cortex = 'learning:cerebellar-cortex-left';
  await openCircuitLandmark(model, sections, {
    region: 'learning:left:dentate', covering_region: cortex,
  });
  assert.equal(model.state.selectedRegion.id, 'learning:left:dentate');
  assert.ok(model.state.hiddenRegions.has(cortex));
  await openCircuitLandmark(model, sections, { region: cortex });
  assert.equal(model.state.selectedRegion.id, cortex);
  assert.ok(!model.state.hiddenRegions.has(cortex));
  model.dispose();
});

test('a lesson reveals hidden internal anatomy and selects its authored side', async () => {
  const calls = [];
  const region = { id: 'learning:left:fornix', kind: 'structure', atlas: 'learning', hemisphere: 'left' };
  let visible = false;
  const model = {
    regions: new Map([[region.id, region]]), settings: { detail: 'nextbrain' },
    async setDetail(id) { calls.push(['detail', id]); },
    clearIsolation() {}, setInternalSystem() {}, setCortexVisible() {}, showRegions() {},
    select(id) { assert.ok(visible, 'hidden anatomy cannot be selected'); calls.push(['select', id]); },
    setInternalVisible(value) { visible = value; calls.push(['internal', value]); },
    setHemisphere(value) { calls.push(['side', value]); },
  };
  const sections = { async setMode() {} };
  await openCircuitLandmark(model, sections, { region: region.id });
  assert.ok(calls.find(([key, value]) => key === 'internal' && value === true));
  assert.deepEqual(calls.at(-1), ['side', 'left']);
  model.setDetail = async () => { throw new Error('Landmark unavailable'); };
  calls.length = 0;
  await assert.rejects(openCircuitLandmark(model, sections, { region: region.id }), /Landmark unavailable/);
  assert.deepEqual(calls, []);
});

test('prepared MRI uses the actual selected landmark centroid and authored plane', async () => {
  const calls = [];
  const model = { centroidOf: () => [12, -8, 4] };
  const sections = {
    setCrosshair(point) { calls.push(['crosshair', point]); },
    setDisplay(display) { calls.push(['display', display]); },
    async setMode(mode) { calls.push(['mode', mode]); },
  };
  await prepareCircuitMri(model, sections, { region: 'test', plane: 'coronal' });
  assert.deepEqual(calls, [
    ['crosshair', [12, -8, 4]], ['display', { reverse: false, overlay: true }],
    ['mode', 'coronal'],
  ]);
});

test('missing geometry and MRI loading failures surface rather than opening another location', async () => {
  const model = { centroidOf: () => null };
  await assert.rejects(prepareCircuitMri(model, {}, { region: 'missing', plane: 'axial' }), /centroid/);
  model.centroidOf = () => [0, 0, 0];
  const sections = { setCrosshair() {}, setDisplay() {},
    async setMode() { throw new Error('MRI unavailable'); } };
  await assert.rejects(prepareCircuitMri(model, sections, { region: 'test', plane: 'axial' }), /MRI unavailable/);
});
