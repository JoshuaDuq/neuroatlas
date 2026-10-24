import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { BrainAtlas } from '../model/brain-atlas.js';
import { createSceneCommands } from '../state/scene-commands.js';
import { createSession } from '../state/session.js';
import { createCircuitCatalog } from './catalog.js';
import { prepareCircuitMri, showCircuitLandmark } from './navigation.js';

/** The real model on cdmd's manifest, its layers already loaded, opened through the scene commands. */
function lesson() {
  const manifest = JSON.parse(readFileSync(new URL('../../public/models/cdmd/manifest.json', import.meta.url)));
  const model = new BrainAtlas(manifest, {});
  model.atlasId = 'destrieux';
  model.detailId = 'learning';
  const commands = createSceneCommands({
    model, sections: { async setMode() {} }, session: createSession({ views: ['oblique'] }), render() {},
  });
  const open = async step => {
    assert.equal(await commands.openRegion(step.region, commands.begin()), true);
    showCircuitLandmark(model, step);
  };
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
  const deficits = parse(read('../../data/neuropsychology.yaml')).deficits.map(deficit => deficit.id);
  const catalog = createCircuitCatalog(parse(read('../../data/circuits.yaml')), manifest, deficits);
  return { model, open, catalog };
}

test('the actual model accepts a hidden landmark only after the tour reveals it', async () => {
  const { model, open } = lesson();
  model.setInternalVisible(false);
  const step = { region: 'learning:midline:optic-chiasm', restores: [] };
  assert.throws(() => model.select(step.region), /Region is not visible/);
  await open(step);
  assert.equal(model.state.selectedRegion.id, step.region);
  assert.equal(model.state.internalVisible, true);
  model.dispose();
});

test('a deep cerebellar lesson uncovers the nucleus and returning restores every covering lobule', async () => {
  const { model, open, catalog } = lesson();
  const [cortex, dentate] = catalog.get('cerebellar').steps;
  assert.equal(cortex.region, 'learning:lobule-v-left');
  assert.equal(dentate.covering_regions.length, 10);
  await open(dentate);
  assert.equal(model.state.selectedRegion.id, 'learning:left:dentate');
  for (const id of dentate.covering_regions) assert.ok(model.state.hiddenRegions.has(id), id);
  await open(cortex);
  assert.equal(model.state.selectedRegion.id, cortex.region);
  for (const id of dentate.covering_regions) assert.ok(!model.state.hiddenRegions.has(id), id);
  model.dispose();
});

test('a lesson shows its landmark’s own side, and both for a midline one', async () => {
  const { model, open } = lesson();
  await open({ region: 'learning:left:fornix', restores: [] });
  assert.equal(model.state.hemisphere, 'left');
  await open({ region: 'learning:midline:optic-chiasm', restores: [] });
  assert.equal(model.state.hemisphere, 'both');
  model.dispose();
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
