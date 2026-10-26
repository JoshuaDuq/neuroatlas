import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushSync } from 'svelte';
import manifest from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import { createCatalog } from '../core/catalog/catalog.ts';
import { createSceneCommands } from '../core/state/scene-commands.ts';
import { createFakeEngine } from '../engine/fake.ts';
import type { FakeEngine } from '../engine/fake.ts';
import { createCatalogStore } from '../state/catalog.svelte.ts';
import { createEngineSync } from '../state/engine-sync.svelte.ts';
import { createLessonStore, createSessionStore } from '../state/session.svelte.ts';
import { createView } from '../state/view.svelte.ts';
import type { MoveOptions } from '../engine/api.ts';
import type { Explorer, Manifest } from '../types/index.ts';
import { FOCUS_TARGETS, registerFocusTarget } from '../ui/focus.ts';
import { createAnatomyCommands } from './anatomy.ts';

const published = manifest as unknown as Manifest;
const SULCUS = 'destrieux:left:30';
const OTHER = 'destrieux:left:31';
const HCP = 'hcp-mmp:left:1';
const CORD = 'zanatomy:midline:cord';

let engine: FakeEngine;
let cleanup: () => void;
let unregister: (() => void)[];

/** The stores and the commands over the fake engine, built in an effect root as a component would. */
function build() {
  const parts = {} as {
    session: ReturnType<typeof createSessionStore>;
    anatomy: ReturnType<typeof createAnatomyCommands>;
    ui: Record<'showDetail' | 'revealOnSelect' | 'dismissHelp' | 'showList', () => void>;
    chooseExplorer: ReturnType<typeof vi.fn<(explorer: Explorer) => void>>;
    scene: ReturnType<typeof createSceneCommands>;
    frameLandmark: ReturnType<typeof vi.fn<(options: MoveOptions) => boolean>>;
  };
  cleanup = $effect.root(() => {
    const engineState = createEngineSync(engine);
    const session = createSessionStore({ views: ['oblique', 'left'] });
    const lesson = createLessonStore({ get: () => ({ steps: [{}] }) as never });
    const view = createView({
      engine: engineState,
      session,
      lesson,
      anatomy: published.anatomy.id,
      referenceAnatomy: engine.tracts.anatomy,
    });
    const catalog = createCatalogStore(createCatalog(published), view);
    parts.session = session;
    parts.ui = {
      showDetail: vi.fn(),
      revealOnSelect: vi.fn(),
      dismissHelp: vi.fn(),
      showList: vi.fn(),
    };
    parts.chooseExplorer = vi.fn<(explorer: Explorer) => void>((explorer) => {
      session.setExplorer(explorer);
    });
    parts.frameLandmark = vi.fn<(options: MoveOptions) => boolean>(() => false);
    parts.scene = createSceneCommands({
      model: engine.model,
      sections: engine.sections,
      session: { ...session, assemble: () => session.state } as never,
      render: () => {},
    });
    parts.anatomy = createAnatomyCommands(
      { engine, engineState, session, lesson, view, catalog, link: undefined as never },
      {
        commands: parts.scene,
        ui: parts.ui,
        chooseExplorer: parts.chooseExplorer,
        frameLandmark: parts.frameLandmark,
      },
    );
  });
  flushSync();
  return parts;
}

const cameraCalls = () => engine.calls.filter((call) => call.domain === 'camera');
const cameraMethods = () => cameraCalls().map((call) => call.method);

beforeEach(() => {
  engine = createFakeEngine({ manifest: published });
  unregister = [];
});
afterEach(() => {
  cleanup();
  for (const stop of unregister) stop();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('selectRegion', () => {
  test('selects, opens the group that holds it, shows the detail, raises the sheet and dismisses help', () => {
    const { anatomy, session, ui } = build();
    anatomy.selectRegion(SULCUS);
    flushSync();
    expect(engine.model.state.selectedRegion?.id).toBe(SULCUS);
    expect([...session.state.expanded]).toHaveLength(1);
    expect(ui.showDetail).toHaveBeenCalledOnce();
    expect(ui.revealOnSelect).toHaveBeenCalledOnce();
    expect(ui.dismissHelp).toHaveBeenCalledOnce();
    expect(cameraCalls()).toEqual([]);
  });

  test('a group already open is left alone', () => {
    const { anatomy, session } = build();
    anatomy.selectRegion(SULCUS);
    const [group] = session.state.expanded;
    anatomy.selectRegion(null);
    anatomy.selectRegion(SULCUS);
    expect([...session.state.expanded]).toEqual([group]);
  });

  test('frames only a new pick from the navigator', () => {
    const { anatomy } = build();
    anatomy.selectRegion(SULCUS, { frame: true });
    expect(cameraMethods()).toEqual(['frameRegion']);
    anatomy.selectRegion(SULCUS, { frame: true });
    expect(cameraMethods()).toEqual(['frameRegion']);
    anatomy.selectRegion(OTHER);
    expect(cameraMethods()).toEqual(['frameRegion']);
  });

  test('choosing the selection again still opens its detail', () => {
    const { anatomy, ui } = build();
    anatomy.selectRegion(SULCUS);
    anatomy.selectRegion(SULCUS);
    expect(ui.showDetail).toHaveBeenCalledTimes(2);
  });

  test('none clears the selection and touches nothing else', () => {
    const { anatomy, ui } = build();
    anatomy.selectRegion(SULCUS);
    anatomy.selectRegion(null);
    expect(engine.model.state.selectedRegion).toBeNull();
    expect(ui.showDetail).toHaveBeenCalledOnce();
  });

  test('a region that cannot be selected throws and changes nothing', () => {
    const { anatomy, ui } = build();
    expect(() => anatomy.selectRegion(HCP)).toThrow('not visible');
    expect(ui.showDetail).not.toHaveBeenCalled();
  });
});

describe('clearSelection', () => {
  test('hands focus to the tab in front when the control that had it went away', async () => {
    const { anatomy } = build();
    document.body.insertAdjacentHTML(
      'beforeend',
      '<button id="stranded"></button><button id="tab" role="tab"></button>',
    );
    unregister.push(
      registerFocusTarget(FOCUS_TARGETS.activeTab, () => document.getElementById('tab')),
    );
    anatomy.selectRegion(SULCUS);
    document.getElementById('stranded')!.focus();
    document.getElementById('stranded')!.remove();
    expect(await anatomy.clearSelection()).toBe(true);
    expect(document.activeElement?.id).toBe('tab');
    expect(engine.model.state.selectedRegion).toBeNull();
  });

  test('leaves focus where it is while it is on a control that stays', async () => {
    const { anatomy } = build();
    document.body.insertAdjacentHTML(
      'beforeend',
      '<button id="here"></button><button id="tab"></button>',
    );
    unregister.push(
      registerFocusTarget(FOCUS_TARGETS.activeTab, () => document.getElementById('tab')),
    );
    document.getElementById('here')!.focus();
    expect(await anatomy.clearSelection()).toBe(false);
    expect(document.activeElement?.id).toBe('here');
  });
});

describe('the dissection', () => {
  test('hiding the selection says it is no longer shown; hiding something else does not', () => {
    const { anatomy, session } = build();
    anatomy.selectRegion(SULCUS);
    anatomy.hideRegions([OTHER]);
    expect(session.state.notice).toBeNull();
    anatomy.hideRegions([SULCUS]);
    expect(session.state.notice?.text).toMatch(/^Selection cleared — .+ is no longer shown\.$/);
  });

  test('the next command retires the notice', () => {
    const { anatomy, session } = build();
    anatomy.selectRegion(SULCUS);
    anatomy.hideRegions([SULCUS]);
    anatomy.showRegions([SULCUS]);
    expect(session.state.notice).toBeNull();
  });

  test('undo brings back the hidden regions and the selection; restore shows all', () => {
    const { anatomy } = build();
    anatomy.selectRegion(SULCUS);
    anatomy.hideRegions([SULCUS, OTHER]);
    anatomy.undoDissection();
    expect(engine.model.state.selectedRegion?.id).toBe(SULCUS);
    anatomy.hideRegions([OTHER]);
    anatomy.restoreHiddenRegions();
    expect(engine.model.settings.hiddenRegions.size).toBe(0);
  });

  test('Hide opens the anatomy list and puts focus on Undo, else on the fallback, else says it could not', async () => {
    const { anatomy, chooseExplorer, ui } = build();
    document.body.insertAdjacentHTML(
      'beforeend',
      '<button id="undo"></button><button id="stop"></button>',
    );
    unregister.push(
      registerFocusTarget(FOCUS_TARGETS.dissectionUndo, () => document.getElementById('undo')),
      registerFocusTarget(FOCUS_TARGETS.treeStop, () => document.getElementById('stop')),
    );
    expect(await anatomy.hideSelection()).toBe(false);
    expect(chooseExplorer).not.toHaveBeenCalled();

    anatomy.selectRegion(SULCUS);
    expect(await anatomy.hideSelection()).toBe(true);
    expect(chooseExplorer).toHaveBeenCalledWith('anatomy');
    expect(ui.showList).toHaveBeenCalledOnce();
    expect(engine.model.settings.hiddenRegions.has(SULCUS)).toBe(true);
    expect(document.activeElement?.id).toBe('undo');

    anatomy.selectRegion(OTHER);
    document.getElementById('undo')!.setAttribute('disabled', '');
    expect(await anatomy.hideSelection()).toBe(true);
    expect(document.activeElement?.id).toBe('stop');

    anatomy.selectRegion('destrieux:left:32');
    document.getElementById('stop')!.remove();
    expect(await anatomy.hideSelection()).toBe(false);
  });

  test('isolating frames the region; isolating again returns to the whole brain', () => {
    const { anatomy } = build();
    anatomy.selectRegion(SULCUS);
    anatomy.isolateSelection();
    expect(engine.model.settings.isolatedRegion).toBe(SULCUS);
    anatomy.isolateSelection();
    expect(engine.model.settings.isolatedRegion).toBeNull();
    expect(cameraMethods()).toEqual(['frameRegion', 'frameWhole']);
  });

  test('isolating a lesson landmark frames the landmark as its lesson authored it', () => {
    const { anatomy, frameLandmark } = build();
    frameLandmark.mockReturnValue(true);
    anatomy.selectRegion(SULCUS);
    anatomy.isolateSelection();
    expect(frameLandmark).toHaveBeenCalledWith({ immediate: false });
    expect(cameraMethods()).toEqual([]);
  });

  test('focusing passes `immediate` to the region and to the landmark', () => {
    const { anatomy, frameLandmark } = build();
    anatomy.selectRegion(SULCUS);
    anatomy.focusSelection({ immediate: true });
    expect(frameLandmark).toHaveBeenCalledWith({ immediate: true });
    expect(cameraCalls()[0]!.args).toEqual([SULCUS, { immediate: true }]);
  });

  test('isolating with nothing selected fails', () => {
    const { anatomy } = build();
    expect(() => anatomy.isolateSelection()).toThrow('Select a region');
  });
});

describe('the display toggles', () => {
  test('the hemisphere reframes the whole brain; the cortex and internal toggles do not', () => {
    const { anatomy } = build();
    anatomy.setHemisphere('left');
    anatomy.setCortexVisible(false);
    anatomy.setCortexOpacity(0.5);
    anatomy.setInternalVisible(false);
    expect(engine.model.settings).toMatchObject({
      hemisphere: 'left',
      cortexVisible: false,
      cortexOpacity: 0.5,
      internalVisible: false,
    });
    expect(cameraMethods()).toEqual(['frameWhole']);
  });

  test('a toggle that drops the selection says so', () => {
    const { anatomy, session } = build();
    anatomy.selectRegion(SULCUS);
    anatomy.setHemisphere('right');
    expect(session.state.notice?.text).toMatch(/^Selection cleared/);
  });

  test('a cortex opacity out of range fails', () => {
    const { anatomy } = build();
    expect(() => anatomy.setCortexOpacity(2)).toThrow(RangeError);
  });

  test('the spinal cord is shown, then the whole brain reframed', async () => {
    const { anatomy } = build();
    await anatomy.setSpinalCordVisible(true);
    expect(engine.model.settings.spinalCordVisible).toBe(true);
    expect(engine.model.isRegionDrawn(CORD)).toBe(true);
    expect(cameraMethods()).toEqual(['frameWhole']);
  });

  test('an anatomy without a cord says so', async () => {
    engine = createFakeEngine({
      manifest: { ...published, supplemental_layers: [] } as Manifest,
    });
    const { anatomy, session } = build();
    await anatomy.setSpinalCordVisible(true);
    expect(session.state.notice?.text).toBe('No spinal cord is published for this subject.');
    expect(engine.model.settings.spinalCordVisible).toBe(false);
  });

  test('reset returns to the opening picture', () => {
    const { anatomy, session } = build();
    session.setView('left');
    session.setQuery('gyrus');
    anatomy.selectRegion(SULCUS);
    anatomy.setHemisphere('left');
    const logged = engine.calls.length;
    anatomy.reset();
    expect(engine.model.settings.hemisphere).toBe('both');
    expect(engine.model.state.selectedRegion).toBeNull();
    expect(session.state).toMatchObject({ view: 'oblique', query: '', notice: null });
    expect(engine.calls.slice(logged).map((call) => `${call.domain}.${call.method}`)).toEqual([
      'sections.setMode',
      'model.reset',
      'camera.recenter',
      'camera.applyView',
    ]);
  });
});

describe('internal anatomy', () => {
  test('entering hides the cortex and shows the structures; leaving gives the whole brain back', async () => {
    const { anatomy } = build();
    const before = engine.model.settings;
    await anatomy.toggleInternalAnatomy();
    expect(engine.model.settings).toMatchObject({
      cortexVisible: false,
      surfaceColor: 'atlas',
      detail: engine.model.defaultDetail,
      internalSystem: null,
    });
    expect(cameraMethods()).toEqual(['frameInternal']);

    await anatomy.toggleInternalAnatomy();
    expect(engine.model.settings).toMatchObject({
      cortexVisible: true,
      surfaceColor: before.surfaceColor,
      detail: before.detail,
    });
    expect(cameraMethods()).toEqual(['frameInternal', 'frameWhole']);
  });

  test('choosing a system by the other door enters internal anatomy, opening its group', async () => {
    const { anatomy, session } = build();
    const system = published.regions.find((r) => r.atlas === 'learning' && r.system_names)!
      .system_names!.en;
    await anatomy.chooseInternalSystem(system);
    expect(engine.model.settings).toMatchObject({ cortexVisible: false, internalSystem: system });
    expect([...session.state.expanded].some((key) => key.startsWith('structure:'))).toBe(true);
    await anatomy.toggleInternalAnatomy();
    expect(engine.model.settings).toMatchObject({ cortexVisible: true, internalSystem: null });
  });

  test('an unknown system fails the command and tells the reader', async () => {
    const { anatomy, session } = build();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await anatomy.chooseInternalSystem('Nowhere');
    expect(session.state.notice).not.toBeNull();
  });

  test('a later command overtakes one still loading', async () => {
    const { anatomy, scene } = build();
    const entering = anatomy.toggleInternalAnatomy();
    scene.begin();
    await entering;
    expect(engine.model.settings.cortexVisible).toBe(true);
  });
});

describe('revealing a region', () => {
  test('undoes what hides it, selects it, then frames it', async () => {
    const { anatomy } = build();
    engine.model.setHemisphere('right');
    await anatomy.revealRegion('hemisphere', SULCUS);
    expect(engine.model.settings.hemisphere).toBe('both');
    expect(engine.model.state.selectedRegion?.id).toBe(SULCUS);
    expect(cameraMethods()).toEqual(['frameRegion']);
  });

  test('chains through each reason until the region can be selected', async () => {
    const { anatomy } = build();
    engine.model.setCortexVisible(false);
    engine.model.hideRegions([SULCUS]);
    await anatomy.revealRegion('removed', SULCUS);
    expect(engine.model.settings.cortexVisible).toBe(true);
    expect(engine.model.state.selectedRegion?.id).toBe(SULCUS);
  });

  test('a region the reveal cannot make selectable is reported, not selected', async () => {
    const { anatomy, session } = build();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await anatomy.revealRegion('hemisphere', HCP);
    expect(session.state.notice).not.toBeNull();
    expect(engine.model.state.selectedRegion).toBeNull();
  });

  test('a constituent opens with its own layers, then is framed', async () => {
    const { anatomy } = build();
    const constituent = published.regions.find(
      (r) => r.atlas === 'aseg' && r.kind === 'structure',
    )!;
    await anatomy.openConstituent(constituent.id);
    expect(engine.model.state.selectedRegion?.id).toBe(constituent.id);
    expect(cameraMethods()).toEqual(['frameRegion']);
  });
});

const ASEG_HIPPOCAMPUS = 'aseg:left:17';
const NEXTBRAIN_CAUDATE_HEAD = 'nextbrain:left:48';
const CUT_ONLY = 'wmparc:left:3001';
const MRI = { fieldOfView: 256, size: 4, windowCenter: 100, windowWidth: 200 };
const CAB_NP = { atlas: 'hcp-mmp', regions: {} };
const FUNCTIONAL = { atlas: 'hcp-mmp' };

describe('the six reveal reasons beyond the first two (CTRL-18)', () => {
  const framedRegion = () => cameraCalls().filter((call) => call.method === 'frameRegion');

  test('CTRL-18 internal-hidden: the internal structures are shown, then the region is selected and framed', async () => {
    const { anatomy } = build();
    await engine.model.setDetail('aseg');
    engine.model.setInternalVisible(false);
    await anatomy.revealRegion('internal-hidden', ASEG_HIPPOCAMPUS);
    expect(engine.model.settings.internalVisible).toBe(true);
    expect(engine.model.state.selectedRegion?.id).toBe(ASEG_HIPPOCAMPUS);
    expect(framedRegion().map((call) => call.args[0])).toEqual([ASEG_HIPPOCAMPUS]);
  });

  test('CTRL-18 spinal-cord-hidden: the cord is shown, then selected and framed', async () => {
    const { anatomy } = build();
    await anatomy.revealRegion('spinal-cord-hidden', CORD);
    expect(engine.model.settings.spinalCordVisible).toBe(true);
    expect(engine.model.state.selectedRegion?.id).toBe(CORD);
    expect(framedRegion().map((call) => call.args[0])).toEqual([CORD]);
  });

  test('CTRL-18 isolated: the isolation is released, then the other region is selected and framed', async () => {
    const { anatomy } = build();
    anatomy.selectRegion(SULCUS);
    anatomy.isolateSelection();
    expect(engine.model.settings.isolatedRegion).toBe(SULCUS);
    await anatomy.revealRegion('isolated', 'destrieux:left:38');
    expect(engine.model.settings.isolatedRegion).toBeNull();
    expect(engine.model.state.selectedRegion?.id).toBe('destrieux:left:38');
    expect(framedRegion().at(-1)!.args[0]).toBe('destrieux:left:38');
  });

  test('CTRL-18 no-mri: the tissue colouring replaces the MRI one, then the region is selected', async () => {
    engine = createFakeEngine({ manifest: published, mri: MRI });
    const { anatomy } = build();
    await engine.sections.setSurfaceColor('mri');
    expect(engine.model.settings.surfaceColor).toBe('mri');
    await anatomy.revealRegion('no-mri', CORD);
    expect(engine.model.settings.surfaceColor).toBe('tissue');
    expect(engine.model.state.selectedRegion?.id).toBe(CORD);
  });

  test("CTRL-18 other-detail: the region's own detail level is loaded, then the region is selected", async () => {
    const { anatomy } = build();
    await engine.model.setDetail('aseg');
    await anatomy.revealRegion('other-detail', NEXTBRAIN_CAUDATE_HEAD);
    expect(engine.model.settings.detail).toBe('nextbrain');
    expect(engine.model.state.selectedRegion?.id).toBe(NEXTBRAIN_CAUDATE_HEAD);
    expect(framedRegion().map((call) => call.args[0])).toEqual([NEXTBRAIN_CAUDATE_HEAD]);
  });

  test('CTRL-18 other-system: the system filter is cleared, then the region is selected', async () => {
    const { anatomy } = build();
    engine.model.setInternalSystem('Basal ganglia');
    await anatomy.revealRegion('other-system', 'learning:left:amygdala');
    expect(engine.model.settings.internalSystem).toBeNull();
    expect(engine.model.state.selectedRegion?.id).toBe('learning:left:amygdala');
  });
});

describe('a cut-only region (CTRL-19)', () => {
  test.each([
    { centroid: [10, -20, 5], expected: -20 },
    { centroid: [-60, 0, 90], expected: 0 },
  ] as const)(
    'CTRL-19 reveal no-cut opens a coronal cut through the centroid $centroid at offset $expected',
    async ({ centroid, expected }) => {
      const { anatomy } = build();
      vi.spyOn(engine.model, 'centroidOf').mockReturnValue([...centroid]);
      await anatomy.revealRegion('no-cut', CUT_ONLY);
      expect(engine.sections.state.mode).toBe('coronal');
      expect(engine.sections.offset).toBe(expected);
      expect(engine.model.state.selectedRegion?.id).toBe(CUT_ONLY);
    },
  );

  test('CTRL-19 the offset is clamped to the cut range', async () => {
    const { anatomy } = build();
    const [minimum, maximum] = engine.sections.offsetRange;
    expect([minimum, maximum]).toEqual([-128, 128]);
    vi.spyOn(engine.model, 'centroidOf').mockReturnValue([0, -500, 0]);
    await anatomy.revealRegion('no-cut', CUT_ONLY);
    expect(engine.sections.offset).toBe(minimum);
  });

  test('CTRL-19 a centroid that is not finite fails the reveal with a notice', async () => {
    const { anatomy, session } = build();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(engine.model, 'centroidOf').mockReturnValue([0, Number.NaN, 0]);
    await anatomy.revealRegion('no-cut', CUT_ONLY);
    expect(session.state.notice).not.toBeNull();
    expect(engine.model.state.selectedRegion).toBeNull();
  });
});

describe('the spinal cord and reset', () => {
  test('CTRL-11 hiding the cord while a cord region is selected clears the selection and says so', async () => {
    const { anatomy, session } = build();
    await anatomy.setSpinalCordVisible(true);
    anatomy.selectRegion(CORD);
    await anatomy.setSpinalCordVisible(false);
    expect(engine.model.state.selectedRegion).toBeNull();
    expect(session.state.notice?.text).toBe('Selection cleared — Spinal cord is no longer shown.');
  });

  test('CTRL-12 a command still loading when Reset is pressed applies nothing after it', async () => {
    const { anatomy } = build();
    await engine.model.setDetail('aseg');
    const entering = anatomy.toggleInternalAnatomy();
    anatomy.reset();
    await entering;
    expect(engine.model.settings).toMatchObject({ cortexVisible: true, hemisphere: 'both' });
    expect(cameraMethods()).not.toContain('frameInternal');
  });
});

describe('the doors into internal anatomy and out again', () => {
  test('CTRL-14 leaving puts back the detail level that was on screen, aseg included', async () => {
    const { anatomy } = build();
    await engine.model.setDetail('aseg');
    await anatomy.toggleInternalAnatomy();
    expect(engine.model.settings.detail).toBe(engine.model.defaultDetail);
    await anatomy.toggleInternalAnatomy();
    expect(engine.model.settings.detail).toBe('aseg');
  });

  test('CTRL-14 a detail level chosen while inside is kept on leaving', async () => {
    const { anatomy, scene } = build();
    await engine.model.setDetail('aseg');
    await anatomy.toggleInternalAnatomy();
    await scene.chooseDetail('nextbrain');
    await anatomy.toggleInternalAnatomy();
    expect(engine.model.settings.detail).toBe('nextbrain');
  });

  test('CTRL-15 leaving says why the CAB-NP colouring is gone after an atlas change inside', async () => {
    engine = createFakeEngine({
      manifest: published,
      mri: MRI,
      cabNp: CAB_NP,
      functionalRegions: FUNCTIONAL,
    });
    const { anatomy, scene, session } = build();
    await scene.chooseAtlas('hcp-mmp');
    await scene.chooseSurfaceColor('cab-np');
    expect(engine.model.settings.surfaceColor).toBe('cab-np');
    await anatomy.toggleInternalAnatomy();
    await scene.chooseAtlas('destrieux');
    await anatomy.toggleInternalAnatomy();
    expect(engine.model.settings.surfaceColor).toBe('atlas');
    expect(session.state.notice?.text).toBe(
      'CAB-NP colours HCP-MMP areas only, so Destrieux shows its own region colours.',
    );
  });

  test('CTRL-16 the second door records the detail on screen, so leaving restores it', async () => {
    const { anatomy, scene } = build();
    await engine.model.setDetail('aseg');
    await anatomy.chooseInternalSystem('Basal ganglia');
    await scene.chooseDetail('learning');
    await anatomy.toggleInternalAnatomy();
    expect(engine.model.settings).toMatchObject({
      cortexVisible: true,
      internalSystem: null,
      detail: 'learning',
    });
  });

  test('CTRL-17 leaving is overtaken by the cord command: the detail is not restored over it', async () => {
    const { anatomy } = build();
    await engine.model.setDetail('aseg');
    await anatomy.toggleInternalAnatomy();
    expect(engine.model.settings.detail).toBe(engine.model.defaultDetail);
    const leaving = anatomy.toggleInternalAnatomy();
    const cord = anatomy.setSpinalCordVisible(true);
    await Promise.all([leaving, cord]);
    expect(engine.model.settings.detail).toBe(engine.model.defaultDetail);
    expect(engine.model.settings.spinalCordVisible).toBe(true);
  });
});
