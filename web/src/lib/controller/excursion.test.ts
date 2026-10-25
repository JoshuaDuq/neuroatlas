import assert from 'node:assert/strict';
import { describe, expect, test, vi } from 'vitest';
import { beneathCortex } from '../core/catalog/labels.ts';
import { ALL_DOMAINS, domainAreas, domainPaint } from '../core/catalog/neuropsych-domains.ts';
import { createScene } from './excursion-test-support.ts';

const DEFICIT = 'acalculia';
const OTHER_DEFICIT = 'amusia';

/** A function one of whose five strongest regions the cortex hides. */
const deepFunction = (scene: ReturnType<typeof createScene>) =>
  scene.domains.domains.find((domain) =>
    domainAreas(scene.domains, domain.id)
      .slice(0, 5)
      .some(({ region }) => beneathCortex(scene.engine.model.regions.get(region)!)),
  )!.id;

describe('an excursion into a deficit', () => {
  test('holds the scene it found, opens the profile at once, then draws and frames the regions', async () => {
    const scene = createScene();
    const mark = scene.engine.calls.length;
    assert.equal(await scene.excursions.openDeficit(DEFICIT), true);

    assert.equal(scene.reader.capture.mock.calls.length, 1);
    assert.equal(scene.excursions.restorable, true);
    assert.equal(scene.session.state.explorer, 'deficits');
    assert.equal(scene.session.state.selectedDeficit, DEFICIT);

    const timeline = scene.calls(mark);
    // The tab (a render of its own), the profile and its detail, the scene's own changes, then the
    // paint drawn before the framing.
    assert.deepEqual(timeline.slice(0, 3), ['app.render', 'app.render', 'shell.showDetail']);
    assert.deepEqual(timeline.slice(-3), ['app.render', 'camera.frameRegions', 'app.render']);
    const framed = scene.engine.calls.findLast((call) => call.method === 'frameRegions')!;
    assert.deepEqual(framed.args, [scene.clinical.mappedRegions(DEFICIT)]);
  });

  test('keeps the first scene across later steps; Restore puts it back and closes the item that opened it', async () => {
    const scene = createScene();
    await scene.excursions.openDeficit(DEFICIT);
    await scene.excursions.openDeficit(OTHER_DEFICIT);
    await scene.excursions.openListedRegion(scene.clinical.mappedRegions(OTHER_DEFICIT)[0]!);
    assert.equal(scene.reader.capture.mock.calls.length, 1);

    assert.equal(await scene.excursions.restoreBeforeExcursion(), true);
    const [target] = scene.reader.apply.mock.calls[0]!;
    assert.equal(target, scene.reader.capture.mock.results[0]!.value);
    assert.equal(scene.excursions.restorable, false);
    assert.equal(scene.session.state.selectedDeficit, null);
    assert.equal(scene.session.state.notice?.text, 'Previous view restored.');
  });

  test('Restore on Functions closes the open function', async () => {
    const scene = createScene();
    await scene.excursions.openFunction('language');
    await scene.excursions.restoreBeforeExcursion();
    assert.equal(scene.session.state.selectedFunction, null);
  });

  test('a restore that fails in part throws every cause and keeps the scene to try again', async () => {
    const scene = createScene();
    await scene.excursions.openDeficit(DEFICIT);
    const error = new Error('cut failed');
    scene.reader.apply.mockImplementationOnce(async () => [{ fields: ['cut'], error }]);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(scene.excursions.restoreBeforeExcursion()).rejects.toMatchObject({
      name: 'AggregateError',
      errors: [error],
    });
    expect(logged).toHaveBeenCalledWith(error);
    assert.equal(scene.excursions.restorable, true);
    assert.equal(scene.session.state.selectedDeficit, DEFICIT);
  });

  test('a restore a later command overtook changes nothing', async () => {
    const scene = createScene();
    await scene.excursions.openDeficit(DEFICIT);
    scene.reader.apply.mockImplementationOnce(async (_target, current) => {
      scene.commands.begin();
      assert.equal(current(), false);
      return [];
    });
    assert.equal(await scene.excursions.restoreBeforeExcursion(), false);
    assert.equal(scene.excursions.restorable, true);
    assert.equal(scene.session.state.selectedDeficit, DEFICIT);
  });

  test('there is nothing to restore before an excursion', async () => {
    const scene = createScene();
    await expect(scene.excursions.restoreBeforeExcursion()).rejects.toThrow(/no scene/);
  });

  test('closing the deficit or the function ends the excursion and leaves the scene', async () => {
    const scene = createScene();
    await scene.excursions.openDeficit(DEFICIT);
    scene.excursions.closeDeficit();
    assert.equal(scene.excursions.restorable, false);
    assert.equal(scene.session.state.selectedDeficit, null);

    await scene.excursions.openFunction('language');
    scene.excursions.closeFunction();
    assert.equal(scene.excursions.restorable, false);
    assert.equal(scene.session.state.selectedFunction, null);
    assert.equal(scene.reader.apply.mock.calls.length, 0);
  });

  test('a command that overtakes the reveal stops it before it draws, says or frames anything', async () => {
    const scene = createScene();
    const opening = scene.excursions.openDeficit(DEFICIT);
    scene.commands.begin();
    assert.equal(await opening, false);
    assert.equal(
      scene.engine.calls.some((call) => call.method === 'frameRegions'),
      false,
    );
    assert.equal(scene.session.state.notice, null);
    // The profile opened and the scene is held: the later command owns what happens next.
    assert.equal(scene.excursions.restorable, true);
  });
});

describe('an excursion into a function', () => {
  test('draws the function’s areas and frames the whole brain', async () => {
    const scene = createScene();
    const mark = scene.engine.calls.length;
    assert.equal(await scene.excursions.openFunction('language'), true);
    assert.equal(scene.session.state.explorer, 'functions');
    assert.equal(scene.session.state.selectedFunction, 'language');
    assert.deepEqual(scene.calls(mark).slice(-3), [
      'app.render',
      'camera.frameWhole',
      'app.render',
    ]);
    const shown = [...domainPaint(scene.domains, 'language').colors.keys()];
    assert.ok(shown.every((id) => scene.engine.model.isRegionDrawn(id)));
  });

  test('a lesson it is opened from ends there and hands over the scene from before it', async () => {
    const scene = createScene();
    const [circuit] = scene.circuits.all;
    await scene.excursions.openCircuit(circuit!.id);
    assert.equal(scene.lesson.state.circuit, circuit!.id);
    const held = scene.reader.capture.mock.results[0]!.value;

    await scene.excursions.openFunction('language');
    assert.equal(scene.lesson.state.circuit, null);
    assert.equal(scene.reader.capture.mock.calls.length, 1);
    await scene.excursions.restoreBeforeExcursion();
    assert.equal(scene.reader.apply.mock.calls[0]![0], held);
    // The lesson's scene was handed over: leaving no lesson, there is nothing for it to restore.
    await scene.excursions.leaveLesson();
    assert.equal(scene.reader.apply.mock.calls.length, 1);
  });

  test('a region it names is selected and framed, and holds the scene if none is held', async () => {
    const scene = createScene();
    assert.equal(await scene.excursions.openListedRegion('destrieux:left:25'), true);
    assert.equal(scene.engine.model.state.selectedRegion?.id, 'destrieux:left:25');
    assert.equal(scene.excursions.restorable, true);
    const framed = scene.engine.calls.findLast((call) => call.method === 'frameRegions')!;
    assert.deepEqual(framed.args, [['destrieux:left:25']]);
  });
});

describe('the offer to see through the cortex', () => {
  test('a function with a deep strongest region names it and offers; taking it makes the cortex see-through', async () => {
    const scene = createScene();
    await scene.excursions.openFunction(deepFunction(scene));
    const notice = scene.session.state.notice!;
    assert.equal(notice.action, 'see-through');
    assert.match(notice.text, /beneath the cortex/);

    scene.excursions.seeThroughCortex();
    assert.equal(
      scene.engine.model.settings.cortexOpacity,
      scene.engine.model.manifest.appearance.see_through_opacity,
    );
    assert.match(scene.session.state.notice!.text, /see-through/);
    assert.equal(scene.session.state.notice!.action, null);
  });

  test('the overview offers nothing', async () => {
    const scene = createScene();
    await scene.excursions.openFunction(ALL_DOMAINS);
    assert.equal(scene.session.state.notice?.action ?? null, null);
  });

  test('a see-through cortex the offer set is made opaque again by a map that needs none, and says so', async () => {
    const scene = createScene();
    await scene.excursions.openFunction(deepFunction(scene));
    scene.excursions.seeThroughCortex();
    await scene.excursions.openFunction(ALL_DOMAINS);
    assert.equal(scene.engine.model.settings.cortexOpacity, 1);
    assert.equal(scene.session.state.notice!.text, 'Cortex made opaque again.');
  });

  test('a see-through cortex stays for another map that makes the same offer, which is not repeated', async () => {
    const scene = createScene();
    const deep = deepFunction(scene);
    await scene.excursions.openFunction(deep);
    scene.excursions.seeThroughCortex();
    await scene.excursions.openFunction(deep);
    assert.equal(
      scene.engine.model.settings.cortexOpacity,
      scene.engine.model.manifest.appearance.see_through_opacity,
    );
    assert.equal(scene.session.state.notice?.action ?? null, null);
  });

  test('a deficit that maps structures the cortex hides names them and offers', async () => {
    const scene = createScene();
    await scene.excursions.openDeficit('neglect');
    const notice = scene.session.state.notice!;
    assert.equal(notice.action, 'see-through');
    assert.match(notice.text, /lies beneath the cortex|lie beneath the cortex/);
  });

  test('a deficit with more than three deep structures names two and counts the rest', async () => {
    const scene = createScene();
    const { regions } = scene.engine.model;
    const names = new Map<string, string>();
    for (const region of regions.values()) {
      const name = scene.anatomy.get(region.id)?.label.name;
      if (name && beneathCortex(region) && ![...names.values()].includes(name)) {
        names.set(region.id, name);
      }
      if (names.size === 5) break;
    }
    vi.spyOn(scene.clinical, 'mappedRegions').mockReturnValue([
      'destrieux:left:25',
      ...names.keys(),
    ]);
    await scene.excursions.openDeficit('acalculia');
    assert.match(scene.session.state.notice!.text, /\b3 other mapped/);
  });

  test('a deficit mapped on structures alone hides the cortex and offers nothing', async () => {
    const scene = createScene();
    await scene.excursions.openDeficit('abulia');
    assert.equal(scene.engine.model.settings.cortexVisible, false);
    assert.equal(scene.session.state.notice?.action ?? null, null);
  });
});

describe('searching in the other evidence tab', () => {
  test('carries the words, closes the open item, forgets the excursion and chooses the tab', async () => {
    const scene = createScene();
    await scene.excursions.openDeficit(DEFICIT);
    await scene.excursions.searchIn('functions', 'memory');
    assert.equal(scene.session.state.explorer, 'functions');
    assert.equal(scene.session.state.functionQuery, 'memory');
    assert.equal(scene.session.state.selectedFunction, null);
    assert.equal(scene.excursions.restorable, false);

    await scene.excursions.openFunction('language');
    await scene.excursions.searchIn('deficits', 'aphasia');
    assert.equal(scene.session.state.explorer, 'deficits');
    assert.equal(scene.session.state.clinicalQuery, 'aphasia');
    assert.equal(scene.session.state.selectedDeficit, null);
  });

  test('counts the matches the other tab would list', () => {
    const scene = createScene();
    const { excursions, clinical } = scene;
    assert.equal(excursions.deficitsMatching('acalc', 'en'), clinical.search('acalc', 'en').length);
    assert.ok(excursions.functionsMatching('memory', 'en') > 0);
    assert.equal(excursions.functionsMatching('qqqqzzzz', 'en'), 0);
  });

  test('lists the curated functions whose lesion checks cite a deficit', () => {
    const scene = createScene();
    const checks = scene.domains.lesion_checks as Record<string, { deficit: string }[]>;
    const [domain, [check]] = Object.entries(checks).find(([, list]) => list.length)!;
    const maps = scene.excursions.checkedMaps(check!.deficit, 'en');
    assert.ok(maps.some((map) => map.id === domain));
    for (const map of maps) {
      assert.ok(checks[map.id]!.some((entry) => entry.deficit === check!.deficit));
    }
  });
});

describe('the stage key', () => {
  test('on Functions a row opens that function, and none returns to all of them', async () => {
    const scene = createScene();
    await scene.excursions.openFunction('language');
    scene.excursions.pickPaint(null);
    await scene.settled();
    assert.equal(scene.session.state.selectedFunction, ALL_DOMAINS);
    scene.excursions.pickPaint('working-memory');
    await scene.settled();
    assert.equal(scene.session.state.selectedFunction, 'working-memory');
  });

  test('on Deficits a row shows one finding alone', async () => {
    const scene = createScene();
    await scene.excursions.openDeficit(DEFICIT);
    scene.excursions.pickPaint('finding');
    assert.equal(scene.session.state.selectedFinding, 'finding');
    scene.excursions.pickPaint(null);
    assert.equal(scene.session.state.selectedFinding, null);
  });

  test('choosing an atlas or a colour lifts the open paint first', async () => {
    const scene = createScene();
    await scene.excursions.openFunction('language');
    await scene.excursions.chooseSurfaceColor('tissue');
    assert.equal(scene.session.state.paintLifted, true);
    assert.equal(scene.engine.model.settings.surfaceColor, 'tissue');

    scene.session.setFunction('language');
    assert.equal(scene.session.state.paintLifted, false);
    const other = scene.engine.model.manifest.atlases.find(
      (atlas) => atlas.id !== scene.engine.model.settings.atlas,
    )!;
    await scene.excursions.chooseAtlas(other.id);
    assert.equal(scene.session.state.paintLifted, true);
    assert.equal(scene.engine.model.settings.atlas, other.id);
  });
});

describe('a failure that needs a newer deploy', () => {
  test('offers the notice’s Reload; any other failure is the panel’s to word', () => {
    const scene = createScene();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    scene.excursions.offerReload(Object.assign(new Error('moved'), { code: 'other' }));
    expect(scene.session.state.notice).toBeNull();
    scene.excursions.offerReload(Object.assign(new Error('moved'), { code: 'asset-updated' }));
    assert.equal(scene.session.state.notice?.action, 'reload');
  });
});

test('a link’s scene is the new baseline: nothing is left to restore', async () => {
  const scene = createScene();
  await scene.excursions.openDeficit(DEFICIT);
  scene.excursions.forget();
  assert.equal(scene.excursions.restorable, false);
});

describe('the cut atlas', () => {
  test('is the sections’ own, and a rejection reaches the caller', async () => {
    const scene = createScene();
    await scene.excursions.setCutAtlas('destrieux');
    assert.equal(scene.engine.sections.state.cutAtlas, 'destrieux');
    vi.spyOn(scene.engine.sections, 'setCutAtlas').mockRejectedValueOnce(new Error('overtaken'));
    await expect(scene.excursions.setCutAtlas('aseg')).rejects.toThrow('overtaken');
  });
});
