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
import { createFakeEngine } from '../src/lib/engine/fake.ts';
import type { FakeEngine } from '../src/lib/engine/fake.ts';
import type { Manifest } from '../src/lib/types/index.ts';

/**
 * The anatomy commands against the legacy closure functions of `viewer/app.js` (select, display,
 * isolate, hide, reveal, the internal-anatomy doors, the cord, reset), copied below as the reference.
 * One seeded sequence of commands drives both over fake engines; after every command the two must
 * agree on whether it threw, on every call made into the engine, on the session and on the
 * interface hooks. The legacy functions read meshes and the Three.js camera; here their engine calls
 * are the contract's (`camera.frameRegion` for `visibleMeshes` + `planFraming`, and so on).
 */

const published = manifest as unknown as Manifest;
const SYSTEMS = ['Spinal cord', 'Basal ganglia', 'Nowhere', null];
const REASONS = ['removed', 'hemisphere', 'cortex-hidden', 'internal-hidden', 'isolated'];

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
interface Side {
  engine: FakeEngine;
  hooks: Hooks;
  state: () => unknown;
  commands: Record<string, (...args: never[]) => unknown>;
}

const ui = (hooks: Hooks) => ({
  showDetail: () => hooks.push('showDetail'),
  revealOnSelect: () => hooks.push('revealOnSelect'),
  dismissHelp: () => hooks.push('dismissHelp'),
  showList: () => hooks.push('showList'),
});

/** The legacy functions, copied from viewer/app.js:213-229, 516-604, 661-692, 1128-1267. */
function legacySide(): Side {
  const engine = createFakeEngine({ manifest: published });
  const hooks: Hooks = [];
  const { model, sections, camera } = engine;
  const session = legacySession({ views: ['oblique', 'left'] });
  const catalog = legacyCatalog(published);
  const interfaceHooks = ui(hooks);
  const render = () => {};
  const chooseExplorer = (value: string) => {
    session.setExplorer(value);
    hooks.push(`chooseExplorer:${value}`);
  };
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
  function focusSelection() {
    const id = model.state.selectedRegion?.id;
    if (!id) return;
    camera.frameRegion(id);
  }
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
  async function enterInternal() {
    const current = commands.begin();
    beforeInternal = captureBeforeInternal(model.settings, model.defaultDetail);
    session.setQuery('');
    try {
      await sections.setMode('off');
      if (!current()) return;
      await commands.loadDetail(model.defaultDetail, current);
      if (!current()) return;
      model.setInternalSystem(null);
      model.setCortexVisible(false);
      // Deviation by contract: the model has no `setSurfaceColor`, the sections colour the surface.
      await commands.applySurfaceColor('atlas', current);
      if (!current()) return;
    } catch (error) {
      commands.failIfCurrent(current, 'internal', error);
      return;
    }
    camera.frameInternal();
  }
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
  }
  async function setSpinalCordVisible(visible: boolean) {
    if (!hasSpinalCord) {
      session.notify({ text: t(session.assemble({}).lang, 'display').spinalCordUnavailable });
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
  }

  return {
    engine,
    hooks,
    state: () => session.assemble({}),
    commands: {
      selectRegion: ((id: string | null, { frame = false } = {}) => {
        const same = id != null && id === model.state.selectedRegion?.id;
        select(id);
        if (frame && id && !same) focusSelection();
      }) as never,
      clearSelection: (() => select(null)) as never,
      focusSelection: focusSelection as never,
      hideRegions: ((ids: string[]) => display(() => model.hideRegions(ids))) as never,
      showRegions: ((ids: string[]) => display(() => model.showRegions(ids))) as never,
      undoDissection: (() => display(() => model.undoDissection())) as never,
      restoreHiddenRegions: (() => display(() => model.restoreHiddenRegions())) as never,
      isolateSelection: (() =>
        display(() => {
          if (model.state.isolatedRegion) {
            model.clearIsolation();
            camera.frameWhole();
          } else {
            model.isolate();
            focusSelection();
          }
        })) as never,
      hideSelection: (() => {
        const id = model.state.selectedRegion?.id;
        if (!id) return;
        chooseExplorer('anatomy');
        display(() => model.hideRegions([id]));
        interfaceHooks.showList();
      }) as never,
      revealRegion: (async (reason: string, id: string) => {
        const current = commands.begin();
        try {
          if ((await reveal(reason, id, current)) && id) focusSelection();
        } catch (error) {
          commands.failIfCurrent(current, 'region', error);
        }
      }) as never,
      openConstituent: (async (id: string) => {
        const current = commands.begin();
        try {
          model.setInternalSystem(null);
          if (await commands.openRegion(id, current)) focusSelection();
        } catch (error) {
          commands.failIfCurrent(current, 'region', error);
        }
      }) as never,
      toggleInternalAnatomy: (() =>
        insideInternal(model.settings) ? leaveInternalAnatomy() : enterInternal()) as never,
      chooseInternalSystem: (async (system: string | null) => {
        const current = commands.begin();
        try {
          if (system === 'Spinal cord' && !(await commands.showSpinalCord(true, current))) return;
          if (!insideInternal(model.settings)) {
            beforeInternal = captureBeforeInternal(model.settings, model.settings.detail);
            await commands.applySurfaceColor('atlas', current);
            if (!current()) return;
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
        } catch (error) {
          commands.failIfCurrent(current, 'system', error);
        }
      }) as never,
      setHemisphere: ((value: never) =>
        display(() => {
          model.setHemisphere(value);
          camera.frameWhole();
        })) as never,
      setCortexVisible: ((value: boolean) => display(() => model.setCortexVisible(value))) as never,
      setCortexOpacity: ((value: number) => display(() => model.setCortexOpacity(value))) as never,
      setInternalVisible: ((value: boolean) =>
        display(() => model.setInternalVisible(value))) as never,
      setSpinalCordVisible: setSpinalCordVisible as never,
      reset: (() => {
        commands.begin();
        session.setQuery('');
        void sections.setMode('off');
        model.reset();
        camera.recenter();
        if (!session.setView('oblique')) throw new Error('Unknown view: oblique');
        camera.applyView('oblique');
      }) as never,
    },
  };
}

/** The new commands, over plain (non-reactive) adapters of the stores that read the same engine and session. */
function newSide(): Side {
  const engine = createFakeEngine({ manifest: published });
  const hooks: Hooks = [];
  const core = createSession({ views: ['oblique', 'left'] });
  const { assemble: _assemble, ...methods } = core;
  const session = Object.assign(methods, {
    get state() {
      return core.assemble({});
    },
  });
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
    },
  );
  return {
    engine,
    hooks,
    state: () => core.assemble({}),
    commands: {
      ...anatomy,
      // Focus is the one thing the legacy closure did with the DOM; there is none here to compare.
      hideSelection: anatomy.hideSelection,
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

async function outcome(call: () => unknown) {
  try {
    return { returned: await call() };
  } catch (error) {
    return { threw: `${(error as Error).constructor.name}: ${(error as Error).message}` };
  }
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
    const regions = published.regions;
    const ids = [
      ...Array.from({ length: 30 }, (_, index) => `destrieux:left:${index + 1}`),
      'destrieux:right:5',
      'hcp-mmp:left:1',
      'aseg:left:4',
      'aseg:right:4',
      'learning:left:caudate',
      'zanatomy:midline:cord',
      'nonexistent',
    ];
    assert(ids.some((id) => regions.some((region) => region.id === id)));
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const random = seeded(seed);
      const legacy = legacySide();
      const current = newSide();
      const names = Object.keys(current.commands).sort();
      const argumentsFor: Record<string, () => unknown[]> = {
        selectRegion: () => [random() < 0.15 ? null : pick(random, ids), { frame: random() < 0.5 }],
        hideRegions: () => [[pick(random, ids), pick(random, ids)]],
        showRegions: () => [[pick(random, ids)]],
        revealRegion: () => [pick(random, REASONS), pick(random, ids)],
        openConstituent: () => [pick(random, ids)],
        chooseInternalSystem: () => [pick(random, SYSTEMS)],
        setHemisphere: () => [pick(random, ['left', 'right', 'both', 'both'])],
        setCortexVisible: () => [random() < 0.5],
        setCortexOpacity: () => [pick(random, [0, 0.4, 1, 1.5])],
        setInternalVisible: () => [random() < 0.5],
        setSpinalCordVisible: () => [random() < 0.7],
      };
      const sequence = Array.from({ length: 40 }, () => pick(random, names));
      for (const [step, name] of sequence.entries()) {
        const args = (argumentsFor[name] ?? (() => []))();
        const label = `seed ${seed}, step ${step}: ${name}(${JSON.stringify(args)})`;
        const was = await outcome(() => legacy.commands[name]!(...(args as never[])));
        const is = await outcome(() => current.commands[name]!(...(args as never[])));
        if (name === 'hideSelection' || name === 'clearSelection') {
          // Both place focus after a flush; with no DOM here only the commands' own effects compare.
          assert.deepEqual(Object.keys(is), Object.keys(was), label);
        } else {
          assert.deepStrictEqual(is, was, label);
        }
        assert.deepStrictEqual(normalised(current.engine), normalised(legacy.engine), label);
        assert.deepStrictEqual(current.state(), legacy.state(), label);
        assert.deepStrictEqual(current.hooks, legacy.hooks, label);
        assert.deepStrictEqual(current.engine.model.state, legacy.engine.model.state, label);
      }
    }
  });
});
