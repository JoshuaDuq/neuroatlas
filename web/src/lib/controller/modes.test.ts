import assert from 'node:assert/strict';
import { describe, expect, test, vi } from 'vitest';
import type { Explorer } from '../types/index.ts';
import { createScene } from './excursion-test-support.ts';
import type { Scene } from './excursion-test-support.ts';
import { createExplorerChoice, createModes } from './modes.ts';

/** How many times the tracts overlay was switched, and to what. */
const overlay = (scene: Scene) =>
  scene.engine.calls.filter((call) => call.method === 'setOverlay').map((call) => call.args[0]);

describe('leaving Tracts', () => {
  for (const tab of ['anatomy', 'deficits', 'circuits'] as const) {
    test(`for ${tab} restores the opacity and removes the overlay`, () => {
      const { excursions, engine, session } = createScene();
      excursions.chooseExplorer('diffusion');
      assert.equal(engine.model.settings.cortexOpacity, engine.tracts.defaultOpacity);
      assert.equal(session.state.explorer, 'diffusion');
      assert.equal(excursions.tractsHeld, true);
      excursions.chooseExplorer(tab);
      assert.equal(engine.model.settings.cortexOpacity, 1);
      assert.equal(session.state.explorer, tab);
      assert.equal(excursions.tractsHeld, false);
    });
  }

  test('the overlay goes on with Tracts and off after it', () => {
    const scene = createScene();
    scene.excursions.chooseExplorer('diffusion');
    scene.excursions.chooseExplorer('anatomy');
    assert.deepEqual(overlay(scene), [true, false]);
  });

  test('a custom opacity returns even after adjusting it in Tracts or choosing Tracts again', () => {
    const scene = createScene();
    scene.engine.model.setCortexOpacity(0.64);
    scene.excursions.chooseExplorer('diffusion');
    assert.equal(scene.engine.model.settings.cortexOpacity, 0.64);
    scene.engine.model.setCortexOpacity(0.22);
    scene.excursions.chooseExplorer('diffusion');
    scene.excursions.chooseExplorer('anatomy');
    assert.equal(scene.engine.model.settings.cortexOpacity, 0.64);
    assert.deepEqual(overlay(scene), [true, false]);
  });

  test('each visit returns to the opacity from that visit, including zero', () => {
    const { excursions, engine } = createScene();
    excursions.chooseExplorer('diffusion');
    excursions.chooseExplorer('anatomy');
    engine.model.setCortexOpacity(0);
    excursions.chooseExplorer('diffusion');
    engine.model.setCortexOpacity(0.4);
    excursions.chooseExplorer('anatomy');
    assert.equal(engine.model.settings.cortexOpacity, 0);
  });

  test('Tracts on another subject leaves the anatomy opacity alone', () => {
    const scene = createScene();
    const { chooseExplorer } = createExplorerChoice({
      engine: scene.engine,
      session: scene.session,
      anatomy: () => 'another-subject',
      render: scene.render,
    });
    scene.engine.model.setCortexOpacity(0.7);
    chooseExplorer('diffusion');
    assert.deepEqual(overlay(scene), []);
    chooseExplorer('anatomy');
    assert.equal(scene.engine.model.settings.cortexOpacity, 0.7);
  });
});

describe('choosing a tab', () => {
  test('after a lesson, waits for the lesson’s scene to come back', async () => {
    const scene = createScene();
    await scene.excursions.openCircuit(scene.circuits.all[0]!.id);
    scene.session.setExplorer('circuits');
    const held = scene.reader.capture.mock.results[0]!.value;
    await scene.excursions.chooseMode('anatomy');
    assert.equal(scene.lesson.state.circuit, null);
    assert.equal(scene.reader.apply.mock.calls[0]![0], held);
    assert.equal(scene.session.state.explorer, 'anatomy');
  });

  test('a later choice wins over one still waiting', async () => {
    const scene = createScene();
    const chosen: Explorer[] = [];
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => (release = resolve));
    const { chooseMode } = createModes({
      engine: scene.engine,
      session: scene.session,
      clinical: { mappedRegions: () => [] },
      domainsAtlas: 'hcp-mmp',
      chooseExplorer: (value) => void chosen.push(value),
      leaveLesson: () => waiting,
      openFunction: async () => true,
      openDeficit: async () => true,
    });
    const first = chooseMode('functions');
    const second = chooseMode('deficits');
    release();
    await Promise.all([first, second]);
    assert.deepEqual(chosen, ['deficits']);
  });

  test('back on Functions after another atlas, opens the function again on its own atlas', async () => {
    const scene = createScene();
    const { engine, excursions, session } = scene;
    await excursions.openFunction('language');
    excursions.chooseExplorer('anatomy');
    await scene.commands.loadAtlas(
      engine.model.manifest.atlases.find((atlas) => atlas.id !== scene.domains.atlas)!.id,
      scene.commands.begin(),
    );
    assert.notEqual(engine.model.settings.atlas, scene.domains.atlas);
    await excursions.chooseMode('functions');
    assert.equal(session.state.explorer, 'functions');
    assert.equal(engine.model.settings.atlas, scene.domains.atlas);
    assert.equal(session.state.selectedFunction, 'language');
  });

  test('back on Functions on the right atlas, leaves the open function as it is', async () => {
    const scene = createScene();
    await scene.excursions.openFunction('language');
    scene.excursions.chooseExplorer('anatomy');
    const mark = scene.engine.calls.length;
    await scene.excursions.chooseMode('functions');
    assert.equal(
      scene.engine.calls.slice(mark).some((call) => call.method === 'frameWhole'),
      false,
    );
  });

  test('back on Deficits after another atlas, opens the deficit again when it maps cortex of another atlas', async () => {
    const scene = createScene();
    const { engine, excursions } = scene;
    await excursions.openDeficit('acalculia');
    excursions.chooseExplorer('anatomy');
    const cortical = scene.clinical.mappedRegions('acalculia')[0]!;
    const other = engine.model.manifest.atlases.find(
      (atlas) => atlas.id !== engine.model.regions.get(cortical)!.atlas,
    )!;
    await scene.commands.loadAtlas(other.id, scene.commands.begin());
    const mark = engine.calls.length;
    await excursions.chooseMode('deficits');
    assert.equal(engine.model.settings.atlas, engine.model.regions.get(cortical)!.atlas);
    assert.ok(engine.calls.slice(mark).some((call) => call.method === 'frameRegions'));
  });

  test('a failure re-opening the item reaches the caller', async () => {
    const scene = createScene();
    const { chooseMode } = createModes({
      engine: scene.engine,
      session: { state: { ...scene.session.state, selectedFunction: 'language' } },
      clinical: { mappedRegions: () => [] },
      domainsAtlas: 'not-the-atlas',
      chooseExplorer: vi.fn(),
      leaveLesson: async () => undefined,
      openFunction: async () => {
        throw new Error('download failed');
      },
      openDeficit: async () => true,
    });
    await expect(chooseMode('functions')).rejects.toThrow('download failed');
  });
});
