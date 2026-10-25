import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import type { Landmark } from '../../core/learning/catalog.ts';
import type { EngineModel, EngineSections } from '../../engine/api.ts';
import { createScene } from '../excursion-test-support.ts';
import type { Scene } from '../excursion-test-support.ts';
import { prepareCircuitMri, showCircuitLandmark } from './learning.ts';

/** The model on cdmd's manifest, with the scene commands that draw a landmark before it is shown. */
async function open(
  scene: Scene,
  step: Pick<Landmark, 'region' | 'restores' | 'covering_regions'>,
) {
  assert.equal(await scene.commands.openRegion(step.region, scene.commands.begin()), true);
  showCircuitLandmark(scene.engine.model, step);
}

describe('showing a landmark', () => {
  test('the model accepts a hidden landmark only after the tour reveals it', async () => {
    const scene = createScene();
    const { model } = scene.engine;
    model.setInternalVisible(false);
    const step = { region: 'learning:midline:optic-chiasm', restores: [] };
    assert.throws(() => model.select(step.region), /Region is not visible/);
    await open(scene, step);
    assert.equal(model.state.selectedRegion?.id, step.region);
    assert.equal(model.state.internalVisible, true);
  });

  test('a deep cerebellar lesson uncovers the nucleus and returning restores every covering lobule', async () => {
    const scene = createScene();
    const { model } = scene.engine;
    const [cortex, dentate] = scene.circuits.get('cerebellar').steps;
    assert.equal(cortex!.region, 'learning:lobule-v-left');
    assert.equal(dentate!.covering_regions!.length, 10);
    await open(scene, dentate!);
    assert.equal(model.state.selectedRegion?.id, 'learning:left:dentate');
    for (const id of dentate!.covering_regions!) assert.ok(model.state.hiddenRegions.has(id), id);
    await open(scene, cortex!);
    assert.equal(model.state.selectedRegion?.id, cortex!.region);
    for (const id of dentate!.covering_regions!) assert.ok(!model.state.hiddenRegions.has(id), id);
  });

  test('a lesson shows its landmark’s own side, and both for a midline one', async () => {
    const scene = createScene();
    await open(scene, { region: 'learning:left:fornix', restores: [] });
    assert.equal(scene.engine.model.state.hemisphere, 'left');
    await open(scene, { region: 'learning:midline:optic-chiasm', restores: [] });
    assert.equal(scene.engine.model.state.hemisphere, 'both');
  });

  test('an unknown landmark region is refused', () => {
    const scene = createScene();
    assert.throws(
      () => showCircuitLandmark(scene.engine.model, { region: 'nowhere', restores: [] }),
      /Unknown landmark region: nowhere/,
    );
  });
});

describe('preparing the MRI', () => {
  test('uses the actual selected landmark centroid and authored plane', async () => {
    const calls: unknown[][] = [];
    const model = { centroidOf: () => [12, -8, 4] } as unknown as EngineModel;
    const sections = {
      setCrosshair: (point: unknown) => calls.push(['crosshair', point]),
      setDisplay: (display: unknown) => calls.push(['display', display]),
      setMode: async (mode: unknown) => void calls.push(['mode', mode]),
    } as unknown as EngineSections;
    await prepareCircuitMri(model, sections, { region: 'test', plane: 'coronal' });
    assert.deepEqual(calls, [
      ['crosshair', [12, -8, 4]],
      ['display', { reverse: false, overlay: true }],
      ['mode', 'coronal'],
    ]);
  });

  test('missing geometry and MRI loading failures surface rather than opening another location', async () => {
    const model = { centroidOf: (): null | number[] => null } as unknown as EngineModel;
    const none = {} as EngineSections;
    await assert.rejects(
      prepareCircuitMri(model, none, { region: 'missing', plane: 'axial' }),
      /centroid/,
    );
    model.centroidOf = () => [0, Number.NaN, 0];
    await assert.rejects(
      prepareCircuitMri(model, none, { region: 'missing', plane: 'axial' }),
      /centroid/,
    );
    model.centroidOf = () => [0, 0, 0];
    const sections = {
      setCrosshair() {},
      setDisplay() {},
      async setMode() {
        throw new Error('MRI unavailable');
      },
    } as unknown as EngineSections;
    await assert.rejects(
      prepareCircuitMri(model, sections, { region: 'test', plane: 'axial' }),
      /MRI unavailable/,
    );
  });
});
