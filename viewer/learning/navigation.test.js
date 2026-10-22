import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { BrainAtlas } from '../model/brain-atlas.js';
import { createSceneCommands } from '../state/scene-commands.js';
import { createSession } from '../state/session.js';
import { prepareCircuitMri, showCircuitLandmark } from './navigation.js';

/** The real model on bert's manifest, its layers already loaded, opened through the scene commands. */
function lesson() {
  const manifest = JSON.parse(readFileSync(new URL('../../public/models/bert/manifest.json', import.meta.url)));
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
  return { model, open };
}

test('the actual model accepts a hidden landmark only after the tour reveals it', async () => {
  const { model, open } = lesson();
  model.setInternalVisible(false);
  const step = { region: 'learning:midline:optic-chiasm' };
  assert.throws(() => model.select(step.region), /Region is not visible/);
  await open(step);
  assert.equal(model.state.selectedRegion.id, step.region);
  assert.equal(model.state.internalVisible, true);
  model.dispose();
});

test('a deep cerebellar lesson uncovers the nucleus and returning restores its cortex', async () => {
  const { model, open } = lesson();
  const cortex = 'learning:cerebellar-cortex-left';
  await open({ region: 'learning:left:dentate', covering_region: cortex });
  assert.equal(model.state.selectedRegion.id, 'learning:left:dentate');
  assert.ok(model.state.hiddenRegions.has(cortex));
  await open({ region: cortex });
  assert.equal(model.state.selectedRegion.id, cortex);
  assert.ok(!model.state.hiddenRegions.has(cortex));
  model.dispose();
});

test('a lesson shows its landmark’s own side, and both for a midline one', async () => {
  const { model, open } = lesson();
  await open({ region: 'learning:left:fornix' });
  assert.equal(model.state.hemisphere, 'left');
  await open({ region: 'learning:midline:optic-chiasm' });
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
