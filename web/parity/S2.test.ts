import assert from 'node:assert/strict';
import { afterAll, beforeAll, describe, it } from 'vitest';
import manifest from '../../public/models/cdmd/manifest.json' with { type: 'json' };
import { createCatalog as legacyCatalog } from '../../viewer/catalog/catalog.js';
import { visibilityOf as legacyVisibility } from '../../viewer/catalog/visibility.js';
import { atlasSwitchLabel, t } from '../../viewer/i18n/translations.js';
import { offsetThrough as legacyOffsetThrough } from '../../viewer/slices/coordinates.js';
import {
  captureBeforeInternal,
  insideInternal,
  leaveInternal,
} from '../../viewer/state/internal-mode.js';
import { createSceneCommands as legacyCommands } from '../../viewer/state/scene-commands.js';
import { createSession as legacySession } from '../../viewer/state/session.js';
import { createAnatomyCommands } from '../src/lib/controller/anatomy.ts';
import { createCatalog } from '../src/lib/core/catalog/catalog.ts';
import { createSceneCommands } from '../src/lib/core/state/scene-commands.ts';
import { createSession } from '../src/lib/core/state/session.ts';
import type { MoveOptions } from '../src/lib/engine/api.ts';
import { createFakeEngine } from '../src/lib/engine/fake.ts';
import type { FakeEngine } from '../src/lib/engine/fake.ts';
import type { Manifest } from '../src/lib/types/index.ts';

/**
 * The anatomy commands against the legacy closure functions of `viewer/app.js` (select, display,
 * focusSelection, isolate, hide, reveal, the internal-anatomy doors, the cord, reset), copied below
 * as the reference with their bodies as in legacy. Their engine calls are the contract's:
 * `camera.frameRegion` for `visibleMeshes` + `planFraming`, `legacyModel` for the model members the
 * contract renamed. One seeded sequence drives both over fake engines, some commands started
 * without awaiting the one before, each after a seeded number of microtask turns (the same on both
 * sides), so that a later one overtakes an earlier at any of its awaits. After every step the two
 * must agree on whether each command threw, on every call made into the engine, on the model's and
 * the sections' state, on the session and on the interface hooks.
 */

const published = manifest as unknown as Manifest;
const regions = published.regions;
const STRUCTURE = 'aseg:left:4';
const TISSUE = regions.find((r) => r.kind === 'tissue-region' && r.atlas === 'nextbrain')!.id;
const NO_MRI = 'zanatomy:midline:cord';
const IDS = [
  ...Array.from({ length: 30 }, (_, index) => `destrieux:left:${index + 1}`),
  'destrieux:right:5',
  'hcp-mmp:left:1',
  'hcp-mmp:left:2',
  STRUCTURE,
  'aseg:right:4',
  'learning:left:caudate',
  TISSUE,
  NO_MRI,
  'nonexistent',
];
const SYSTEMS = ['Spinal cord', 'Basal ganglia', 'Limbic', 'Nowhere', null];
const REASONS = [
  'removed',
  'hemisphere',
  'cortex-hidden',
  'internal-hidden',
  'spinal-cord-hidden',
  'isolated',
  'no-cut',
  'no-mri',
  'other-detail',
  'other-system',
  'other-atlas',
];
const CAB_NP = { atlas: 'hcp-mmp', regions: {} };
const FUNCTIONAL = { atlas: 'hcp-mmp' };
const MRI = { fieldOfView: 256, size: 4, windowCenter: 100, windowWidth: 200 };

/** mulberry32: a 32-bit seeded generator, so a failure replays. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(random: () => number, items: readonly T[]) =>
  items[Math.floor(random() * items.length)]!;

type Hooks = string[];
type Command = (...args: never[]) => unknown;
interface Side {
  engine: FakeEngine;
  hooks: Hooks;
  /** The session as the legacy `assemble({})` gives it; read live, so a stale copy would show. */
  readonly state: unknown;
  commands: Record<string, Command>;
}

const ui = (hooks: Hooks) => ({
  showDetail: () => hooks.push('showDetail'),
  revealOnSelect: () => hooks.push('revealOnSelect'),
  dismissHelp: () => hooks.push('dismissHelp'),
  showList: () => hooks.push('showList'),
});

/** A lesson landmark is open when the test says so; both sides frame it through the same engine call. */
function landmarkFraming(engine: FakeEngine) {
  const lesson = { open: false };
  return {
    lesson,
    frame: ({ immediate = false }: MoveOptions = {}) => {
      const id = engine.model.state.selectedRegion?.id;
      return Boolean(
        lesson.open && id && engine.camera.frameLandmark(id, 'left', 5, { immediate }),
      );
    },
  };
}

/** The legacy functions, copied from viewer/app.js:213-229, 510-604, 661-692, 1128-1267. */
function legacySide(): Side {
  const engine = createFakeEngine({
    manifest: published,
    mri: MRI,
    cabNp: CAB_NP,
    functionalRegions: FUNCTIONAL,
  });
  const hooks: Hooks = [];
  const { model, sections, camera } = engine;
  const session = legacySession({ views: ['oblique', 'left'] });
  const catalog = legacyCatalog(published);
  const interfaceHooks = ui(hooks);
  const render = () => {};
  const landmark = landmarkFraming(engine);
  // The contract renamed the model's `layers`, `envelopes` and `spinalCordLoadState` to `hasLayer`,
  // `envelopesLoaded` and `spinalCordLoad`.
  const legacyModel = new Proxy(model, {
    get(target, key) {
      if (key === 'layers') return { has: (id: string) => target.hasLayer(id) };
      if (key === 'envelopes') return target.envelopesLoaded;
      if (key === 'spinalCordLoadState') return target.spinalCordLoad;
      return Reflect.get(target, key);
    },
  });
  const commands = legacyCommands({ model: legacyModel, sections, session, render });
  const hasSpinalCord = published.supplemental_layers!.some((layer) => layer.id === 'zanatomy');
  let beforeInternal: unknown = null;

  function chooseExplorer(value: string) {
    session.setExplorer(value);
    hooks.push(`chooseExplorer:${value}`);
  }
  // app.js:221-229
  function display(change: () => void) {
    const had = model.state.selectedRegion;
    session.notify(null);
    change();
    notifyClearedSelection(had);
    render();
  }
  function notifyClearedSelection(had: { id: string; label: string } | null) {
    if (had && !model.state.selectedRegion) {
      const state = session.assemble(model.state);
      const name = catalog.get(had.id)?.label.name ?? had.label;
      session.notify({ text: t(state.lang, 'app').selectionCleared(name) });
    }
  }
  // app.js:510-524, the camera half in the contract's terms
  function focusSelection({ immediate = false } = {}) {
    if (landmark.frame({ immediate })) {
      render();
      return;
    }
    const id = model.state.selectedRegion?.id;
    if (!id) return;
    camera.frameRegion(id, { immediate });
  }
  // app.js:527-533
  function revealInTree(id: string) {
    const current = session.assemble(model.state);
    const group = catalog
      .groups(current)
      .find((g: { rows: { region: { id: string } }[] }) => g.rows.some((r) => r.region.id === id));
    if (group && !current.expanded.has(group.key)) session.toggleGroup(group.key);
  }
  function select(id: string | null) {
    model.select(id);
    if (id) revealInTree(id);
    render();
    if (id) {
      interfaceHooks.showDetail();
      interfaceHooks.revealOnSelect();
      interfaceHooks.dismissHelp();
    }
  }
  // app.js:575-604
  async function reveal(reason: string, id: string, current: () => boolean): Promise<boolean> {
    if (reason === 'removed') model.showRegions([id]);
    if (reason === 'no-mri') await commands.applySurfaceColor('tissue', current);
    if (reason === 'cortex-hidden') {
      model.setCortexVisible(true);
      model.setCortexOpacity(1);
    }
    if (reason === 'internal-hidden') model.setInternalVisible(true);
    if (reason === 'spinal-cord-hidden') await commands.showSpinalCord(true, current);
    if (reason === 'hemisphere') model.setHemisphere('both');
    if (reason === 'isolated') model.clearIsolation();
    if (reason === 'no-cut') {
      await commands.cut('coronal', current);
      const coords = model.centroidOf(id);
      if (current() && coords && sections.active) {
        const [x, y, z] = sections.frame.normal;
        sections.setOffset(legacyOffsetThrough(coords, { x, y, z }, sections.offsetRange));
      }
    }
    if (reason === 'other-detail') {
      await commands.loadDetail(model.regions.get(id)!.atlas, current);
    }
    if (reason === 'other-system') model.setInternalSystem(null);
    if (!current()) return false;
    const region = model.regions.get(id)!;
    if (!model.canSelect(region)) {
      const next = legacyVisibility(region, model.settings).reason;
      if (next === reason) throw new Error(`Cannot reveal ${id}: ${next}`);
      return reveal(next, id, current);
    }
    select(id);
    return true;
  }
  // app.js:1148-1162
  async function enterInternal() {
    const current = commands.begin();
    beforeInternal = captureBeforeInternal(model.settings, model.defaultDetail);
    session.setQuery('');
    try {
      await sections.setMode('off');
      if (!current()) return;
      await commands.loadDetail(model.defaultDetail, current);
      if (!current()) return;
    } catch (error) {
      commands.failIfCurrent(current, 'internal', error);
      return;
    }
    model.setInternalSystem(null);
    model.setCortexVisible(false);
    model.setSurfaceColor('atlas');
    camera.frameInternal();
    render();
  }
  // app.js:1164-1188
  async function leaveInternalAnatomy() {
    const current = commands.begin();
    const changes = leaveInternal(beforeInternal, model.settings, {
      'cab-np': model.cabNp?.atlas,
      functional: model.functionalRegions?.atlas,
    });
    beforeInternal = null;
    session.setQuery('');
    model.setInternalSystem(changes.internalSystem);
    model.setCortexVisible(changes.cortexVisible);
    try {
      await commands.applySurfaceColor(changes.surfaceColor, current);
      if (current() && changes.detail) await commands.loadDetail(changes.detail, current);
    } catch (error) {
      commands.failIfCurrent(current, 'wholeBrain', error);
    }
    if (!current()) return;
    if (changes.colourLost) {
      const { lang, atlas } = session.assemble(model.state);
      const copy = t(lang, 'app');
      const said = { 'cab-np': copy.cabNpAtlasOnly, functional: copy.functionalAtlasOnly }[
        changes.colourLost as 'cab-np' | 'functional'
      ];
      session.notify({ text: said(atlasSwitchLabel(atlas, lang)) });
    }
    camera.frameWhole();
    render();
  }
  // app.js:1228-1243
  async function setSpinalCordVisible(visible: boolean) {
    if (!hasSpinalCord) {
      session.notify({ text: t(session.assemble({}).lang, 'display').spinalCordUnavailable });
      render();
      return;
    }
    const current = commands.begin();
    const had = model.state.selectedRegion;
    try {
      if (!(await commands.showSpinalCord(visible, current))) return;
      notifyClearedSelection(had);
      camera.frameWhole();
    } catch (error) {
      commands.failIfCurrent(current, 'cord', error);
    }
    render();
  }

  return {
    engine,
    hooks,
    get state() {
      return session.assemble({});
    },
    commands: {
      toggleLesson: (() => {
        landmark.lesson.open = !landmark.lesson.open;
      }) as Command,
      chooseAtlas: ((id: string) => commands.chooseAtlas(id)) as Command,
      chooseDetail: ((id: string) => commands.chooseDetail(id)) as Command,
      chooseSurfaceColor: ((value: never) => commands.chooseSurfaceColor(value)) as Command,
      cut: ((mode: never) => sections.setMode(mode)) as Command,
      // app.js:661-665
      selectRegion: ((id: string | null, { frame = false }: { frame?: boolean } = {}) => {
        const same = id != null && id === model.state.selectedRegion?.id;
        select(id);
        if (frame && id && !same) focusSelection();
      }) as Command,
      clearSelection: (() => select(null)) as Command,
      focusSelection: ((options: MoveOptions) => focusSelection(options)) as Command,
      hideRegions: ((ids: string[]) => display(() => model.hideRegions(ids))) as Command,
      showRegions: ((ids: string[]) => display(() => model.showRegions(ids))) as Command,
      undoDissection: (() => display(() => model.undoDissection())) as Command,
      restoreHiddenRegions: (() => display(() => model.restoreHiddenRegions())) as Command,
      // app.js:692-701
      isolateSelection: (() =>
        display(() => {
          if (model.state.isolatedRegion) {
            model.clearIsolation();
            camera.frameWhole();
          } else {
            model.isolate();
            focusSelection();
          }
        })) as Command,
      // app.js:716-723, without the focus
      hideSelection: (() => {
        const id = model.state.selectedRegion?.id;
        if (!id) return;
        chooseExplorer('anatomy');
        display(() => model.hideRegions([id]));
        interfaceHooks.showList();
      }) as Command,
      // app.js:675-686
      revealRegion: (async (reason: string, id: string) => {
        const current = commands.begin();
        try {
          if ((await reveal(reason, id, current)) && id) focusSelection();
        } catch (error) {
          commands.failIfCurrent(current, 'region', error);
        }
      }) as Command,
      // app.js:1213-1225
      openConstituent: (async (id: string) => {
        const current = commands.begin();
        try {
          model.setInternalSystem(null);
          if (await commands.openRegion(id, current)) focusSelection();
        } catch (error) {
          commands.failIfCurrent(current, 'region', error);
        }
      }) as Command,
      toggleInternalAnatomy: (() =>
        insideInternal(model.settings) ? leaveInternalAnatomy() : enterInternal()) as Command,
      // app.js:1191-1210
      chooseInternalSystem: (async (system: string | null) => {
        const current = commands.begin();
        try {
          if (system === 'Spinal cord' && !(await commands.showSpinalCord(true, current))) return;
          if (!insideInternal(model.settings)) {
            beforeInternal = captureBeforeInternal(model.settings, model.settings.detail);
            model.setSurfaceColor('atlas');
            model.setCortexVisible(false);
          }
          model.setInternalSystem(system);
          session.setQuery('');
          const group = catalog
            .groups(session.assemble(model.state))
            .find((entry: { kind: string }) => entry.kind === 'structure');
          if (system && group && !session.assemble(model.state).expanded.has(group.key)) {
            session.toggleGroup(group.key);
          }
          camera.frameInternal();
          render();
        } catch (error) {
          commands.failIfCurrent(current, 'system', error);
        }
      }) as Command,
      setHemisphere: ((value: never) =>
        display(() => {
          model.setHemisphere(value);
          camera.frameWhole();
        })) as Command,
      setCortexVisible: ((value: boolean) =>
        display(() => model.setCortexVisible(value))) as Command,
      setCortexOpacity: ((value: number) =>
        display(() => model.setCortexOpacity(value))) as Command,
      setInternalVisible: ((value: boolean) =>
        display(() => model.setInternalVisible(value))) as Command,
      setSpinalCordVisible: setSpinalCordVisible as Command,
      // app.js:1258-1266
      reset: (() => {
        commands.begin();
        session.setQuery('');
        void sections.setMode('off');
        model.reset();
        camera.recenter();
        if (!session.setView('oblique')) throw new Error('Unknown view: oblique');
        camera.applyView('oblique');
      }) as Command,
    },
  };
}

/** The new commands, over plain (non-reactive) adapters of the stores that read the same engine and session. */
function newSide(): Side {
  const engine = createFakeEngine({
    manifest: published,
    mri: MRI,
    cabNp: CAB_NP,
    functionalRegions: FUNCTIONAL,
  });
  const hooks: Hooks = [];
  const core = createSession({ views: ['oblique', 'left'] });
  const { assemble: _assemble, ...methods } = core;
  const session = {
    ...methods,
    get state() {
      return core.assemble({});
    },
  };
  const coreCatalog = createCatalog(published);
  const view = {
    get current() {
      return { ...engine.model.state, ...core.assemble({}) };
    },
  };
  const catalog = {
    get groups() {
      return coreCatalog.groups(view.current);
    },
    label: (id: string) => coreCatalog.label(id, view.current),
  };
  const scene = createSceneCommands({
    model: engine.model,
    sections: engine.sections,
    session: core,
    render: () => {},
  });
  const landmark = landmarkFraming(engine);
  const anatomy = createAnatomyCommands(
    {
      engine,
      engineState: {
        get model() {
          return engine.model.state;
        },
      },
      session,
      view,
      catalog,
    } as never,
    {
      commands: scene,
      ui: ui(hooks),
      chooseExplorer: (explorer) => {
        core.setExplorer(explorer);
        hooks.push(`chooseExplorer:${explorer}`);
      },
      frameLandmark: landmark.frame,
    },
  );
  return {
    engine,
    hooks,
    get state() {
      return core.assemble({});
    },
    commands: {
      ...anatomy,
      toggleLesson: () => {
        landmark.lesson.open = !landmark.lesson.open;
      },
      chooseAtlas: (id: string) => scene.chooseAtlas(id),
      chooseDetail: (id: string) => scene.chooseDetail(id),
      chooseSurfaceColor: (value: never) => scene.chooseSurfaceColor(value),
      cut: (mode: never) => engine.sections.setMode(mode),
    } as never,
  };
}

/** Calls with their function arguments (intent checks) named, so two runs compare. */
const normalised = (engine: FakeEngine) =>
  engine.calls.map(({ domain, method, args }) => ({
    domain,
    method,
    args: args.map((arg) => (typeof arg === 'function' ? '[function]' : arg)),
  }));

/** Starts a command; its outcome, thrown synchronously or asynchronously, settles into a value. */
function start(call: () => unknown): Promise<unknown> {
  const failed = (error: unknown) => ({
    threw: `${(error as Error).constructor.name}: ${(error as Error).message}`,
  });
  try {
    return Promise.resolve(call()).then((returned) => ({ returned }), failed);
  } catch (error) {
    return Promise.resolve(failed(error));
  }
}

interface Step {
  name: string;
  args: never[];
  /** Microtask turns to wait before starting the command; the same on both sides. */
  delay?: number;
}

const MAX_DELAY = 11;

/** Starts the burst on each side, each command after its delay and before the earlier settle, and compares everything. */
async function compareBurst(legacy: Side, current: Side, burst: Step[], label: string) {
  const run = (side: Side) =>
    Promise.all(
      burst.map(async ({ name, args, delay = 0 }) => {
        for (let turn = 0; turn < delay; turn += 1) await Promise.resolve();
        return start(() => side.commands[name]!(...args));
      }),
    );
  const was = await run(legacy);
  const is = await run(current);
  // Focus is placed after the interface updates, which this test has no DOM for.
  const compared = (outcomes: unknown[]) =>
    outcomes.map((outcome, index) =>
      ['hideSelection', 'clearSelection'].includes(burst[index]!.name)
        ? Object.keys(outcome as object)
        : outcome,
    );
  assert.deepStrictEqual(compared(is), compared(was), label);
  assert.deepStrictEqual(normalised(current.engine), normalised(legacy.engine), label);
  assert.deepStrictEqual(current.state, legacy.state, label);
  assert.deepStrictEqual(current.hooks, legacy.hooks, label);
  assert.deepStrictEqual(current.engine.model.state, legacy.engine.model.state, label);
  assert.deepStrictEqual(current.engine.sections.state, legacy.engine.sections.state, label);
}

describe('S2 parity', () => {
  // Focus rescue asks the document what has focus; nothing does, and no target is registered.
  beforeAll(() => {
    (globalThis as { document?: unknown }).document = { activeElement: null };
  });
  afterAll(() => {
    delete (globalThis as { document?: unknown }).document;
  });

  it('the anatomy commands agree with the legacy closure functions over seeded sequences', async () => {
    assert(IDS.some((id) => regions.some((region) => region.id === id)));
    for (const seed of Array.from({ length: 16 }, (_, index) => index + 1)) {
      const random = seeded(seed);
      const legacy = legacySide();
      const current = newSide();
      const argumentsFor: Record<string, () => unknown[]> = {
        selectRegion: () => [random() < 0.15 ? null : pick(random, IDS), { frame: random() < 0.5 }],
        focusSelection: () => [{ immediate: random() < 0.5 }],
        hideRegions: () => [[pick(random, IDS), pick(random, IDS)]],
        showRegions: () => [[pick(random, IDS)]],
        revealRegion: () => [pick(random, REASONS), pick(random, IDS)],
        openConstituent: () => [pick(random, IDS)],
        chooseInternalSystem: () => [pick(random, SYSTEMS)],
        setHemisphere: () => [pick(random, ['left', 'right', 'both', 'both'])],
        setCortexVisible: () => [random() < 0.5],
        setCortexOpacity: () => [pick(random, [0, 0.4, 1, 1.5])],
        setInternalVisible: () => [random() < 0.5],
        setSpinalCordVisible: () => [random() < 0.7],
        chooseAtlas: () => [pick(random, ['destrieux', 'hcp-mmp', 'nowhere'])],
        chooseDetail: () => [pick(random, ['aseg', 'nextbrain', 'learning'])],
        chooseSurfaceColor: () => [
          pick(random, ['atlas', 'tissue', 'mri', 'network', 'cab-np', 'functional']),
        ],
        cut: () => [pick(random, ['off', 'coronal', 'axial'])],
      };
      const names = Object.keys(legacy.commands).sort();
      for (const name of names) assert(name in current.commands, name);
      let step = 0;
      while (step < 60) {
        // A burst of one to three commands, the later ones started before the earlier settle.
        const burst = Array.from({ length: 1 + Math.floor(random() * 3) }, (_, index) => {
          const name = pick(random, names);
          return {
            name,
            args: (argumentsFor[name] ?? (() => []))() as never[],
            delay: index === 0 ? 0 : Math.floor(random() * (MAX_DELAY + 1)),
          };
        });
        const label = `seed ${seed}, step ${step}: ${burst
          .map(({ name, args, delay }) => `${name}(${JSON.stringify(args)})+${delay}`)
          .join(' | ')}`;
        step += burst.length;
        await compareBurst(legacy, current, burst, label);
      }
    }
  });

  /** Sequences that reach what a random walk rarely does: each is run, step by step, on both sides. */
  const SCRIPTS: Record<string, [string, unknown[]][]> = {
    'the colouring is lost when the atlas changes inside': [
      ['chooseAtlas', ['hcp-mmp']],
      ['chooseSurfaceColor', ['cab-np']],
      ['toggleInternalAnatomy', []],
      ['chooseAtlas', ['destrieux']],
      ['toggleInternalAnatomy', []],
    ],
    'leaving restores the detail the first door replaced': [
      ['chooseDetail', ['aseg']],
      ['toggleInternalAnatomy', []],
      ['toggleInternalAnatomy', []],
    ],
    'the second door records the detail on screen, not the default': [
      ['chooseDetail', ['aseg']],
      ['chooseInternalSystem', ['Basal ganglia']],
      ['chooseDetail', ['learning']],
      ['toggleInternalAnatomy', []],
    ],
    'hiding the cord drops a selection in it': [
      ['setSpinalCordVisible', [true]],
      ['selectRegion', [NO_MRI]],
      ['setSpinalCordVisible', [false]],
    ],
    'a lesson landmark is framed by isolate and by focus': [
      ['selectRegion', ['destrieux:left:30']],
      ['toggleLesson', []],
      ['isolateSelection', []],
      ['focusSelection', [{ immediate: true }]],
      ['isolateSelection', []],
    ],
    'a command overtaken by the next one': [
      ['toggleInternalAnatomy', []],
      ['chooseDetail', ['nextbrain']],
      ['toggleInternalAnatomy', []],
    ],
  };

  /**
   * A command that overtakes another at one of its awaits, whichever await that is: `rival` starts
   * `delay` turns after `command`, for every delay up to MAX_DELAY, once `before` has run.
   */
  const OVERTAKES: Record<
    string,
    { before: [string, unknown[]][]; command: string; rival: [string, unknown[]] }
  > = {
    'entering is overtaken while its detail downloads': {
      before: [['chooseDetail', ['aseg']]],
      command: 'toggleInternalAnatomy',
      rival: ['setSpinalCordVisible', [true]],
    },
    'leaving is overtaken before it restores the detail': {
      before: [
        ['chooseDetail', ['aseg']],
        ['toggleInternalAnatomy', []],
      ],
      command: 'toggleInternalAnatomy',
      rival: ['setSpinalCordVisible', [true]],
    },
  };

  for (const [name, { before, command, rival }] of Object.entries(OVERTAKES)) {
    it(`overtaken: ${name}`, async () => {
      for (let delay = 0; delay <= MAX_DELAY; delay += 1) {
        const legacy = legacySide();
        const current = newSide();
        for (const [prior, args] of before) {
          await compareBurst(legacy, current, [{ name: prior, args: args as never[] }], name);
        }
        const burst = [
          { name: command, args: [] as never[] },
          { name: rival[0], args: rival[1] as never[], delay },
        ];
        await compareBurst(legacy, current, burst, `${name}, rival after ${delay} turns`);
      }
    });
  }

  for (const [name, script] of Object.entries(SCRIPTS)) {
    it(`scripted: ${name}`, async () => {
      for (const overlapped of [false, true]) {
        const legacy = legacySide();
        const current = newSide();
        const steps = script.map(([command, args]) => ({ name: command, args: args as never[] }));
        if (overlapped) {
          await compareBurst(legacy, current, steps, `${name}, started together`);
        } else {
          for (const [index, step] of steps.entries()) {
            await compareBurst(legacy, current, [step], `${name}, step ${index}: ${step.name}`);
          }
        }
      }
    });
  }
});
