import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { afterEach, describe, it, vi } from 'vitest';
import {
  cutFacingView,
  VIEW_DIRECTIONS as legacyDirections,
  viewForRestoredCut as legacyCutView,
} from '../../viewer/render/camera-views.js';
import { createCircuitSession as legacyLesson } from '../../viewer/learning/session.js';
import { ALL_DOMAINS } from '../../viewer/catalog/neuropsych-domains.js';
import { checkLink as legacyCheckLink } from '../../viewer/state/link-check.js';
import { createLinkWriter as legacyWriter } from '../../viewer/state/link-writer.js';
import {
  applyReaderState as legacyApply,
  readerState as legacyReaderState,
} from '../../viewer/state/reader-state.js';
import {
  createSceneCommands as legacyCommands,
  publishesSpinalCord as legacyPublishesCord,
} from '../../viewer/state/scene-commands.js';
import { createSession as legacySession } from '../../viewer/state/session.js';
import {
  PARAMS as legacyParams,
  decodeState as legacyDecode,
} from '../../viewer/state/url-state.js';
import { MODES as legacyModes } from '../../viewer/ui/chrome/workspace.js';
import { createLinks } from '../src/lib/controller/links.ts';
import type { LinkHooks } from '../src/lib/controller/links.ts';
import { createLinkWriter } from '../src/lib/core/state/link-writer.ts';
import { createSceneCommands } from '../src/lib/core/state/scene-commands.ts';
import { decodeState, encodeState } from '../src/lib/core/state/url-state.ts';
import { createFakeEngine } from '../src/lib/engine/fake.ts';
import type { FakeEngine } from '../src/lib/engine/fake.ts';
import { createLessonStore, createSessionStore } from '../src/lib/state/session.svelte.ts';
import type { Manifest } from '../src/lib/types/index.ts';
import { readRepoJson } from '../test/repo.ts';

/**
 * Restoring a link, new against legacy. The legacy `restoreLink` lives inside `startApp`'s closure, so its
 * source is cut out of `viewer/app.js` and run over the same fake engine as the new one. Both sides see the
 * same engine calls, hook calls and console output for each link, and must return the same `notApplied` list
 * and leave the same session and lesson. The camera's own steps (`applyView`, `faceCut`, `restoreCamera`,
 * `placeOrbit`) are E7's; here they are the calls into `engine.camera` that the closure makes.
 */

const manifest = readRepoJson<Manifest>('public/models/cdmd/manifest.json');
const source = readFileSync(new URL('../../viewer/app.js', import.meta.url), 'utf8');
const slice = (from: string, to: string) => {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  assert.ok(start > 0 && end > start, `app.js no longer holds ${from}`);
  return source.slice(start, end);
};
const knownSource = slice('const known = {', '  /**\n   * Apply a decoded link');
const linkStateSource = slice('const CUT_LINKS', '  function focusPoint');
const restoreSource = slice('async function restoreLink(', '  /** A link edited in place');

const domains = {
  atlas: 'destrieux',
  domains: [{ id: 'language', color: '#fff' }],
  lesion_checks: {},
};
const mri = { fieldOfView: 256, size: 64, windowCenter: 100, windowWidth: 200 };
const clinical = { search: () => [{ id: 'aphasia' }, { id: 'neglect' }] };
const steps = [
  { region: 'destrieux:left:1' },
  { region: 'destrieux:left:2' },
  { region: 'destrieux:left:3' },
];
const circuits = {
  all: [{ id: 'language', steps }],
  get(id: string) {
    if (id !== 'language') throw new Error(`Unknown circuit: ${id}`);
    return { id, steps };
  },
};

/** How the lesson's landmark opens, and whether the Tracts excursion is open when the link arrives. */
interface Scenario {
  hash: string;
  landmark?: 'opens' | 'throws' | 'overtaken';
  tractsOpen?: boolean;
  /** A later scene command overtakes the restore once this model method is reached. */
  overtakeAt?: string;
  /** This sections method throws, as a failed download does. */
  failAt?: string;
  /** Start from a scene a hash edit can find: a lesson open, a region selected, a cut on, the window moved. */
  busy?: boolean;
  /** Boot's `{ immediate: true }`, or the `{}` of a hash edit. */
  immediate?: boolean;
}

interface Outcome {
  notApplied: string[] | null;
  engineCalls: unknown[];
  hookCalls: unknown[];
  errors: unknown[];
  session: unknown;
  lesson: unknown;
  excursion: unknown;
}

const cabNp = { atlas: 'destrieux', regions: {} };
const functionalRegions = { atlas: 'hcp-mmp' };

const createEngine = () =>
  createFakeEngine({
    manifest,
    domains: { ...domains, search: { terms: new Map([['term-a', {}]]) } },
    cabNp,
    functionalRegions,
    mri,
  }) as FakeEngine;

/** The scene before the link arrives, on either side: the same calls, then a clean log. */
async function prepare(
  engine: FakeEngine,
  session: { setExplorer(explorer: never): unknown },
  lesson: { start(id: string): unknown; go(step: number): unknown },
) {
  session.setExplorer('circuits' as never);
  lesson.start('language');
  lesson.go(1);
  engine.model.setHemisphere('left');
  engine.model.select('destrieux:left:1');
  await engine.sections.setMode('coronal');
  await engine.sections.load();
  engine.sections.setWindow(50, 60);
  (engine.calls as unknown[]).length = 0;
}

/** After the scene is set: a later command overtakes the restore, or a download fails. */
function intercept(engine: FakeEngine, { overtakeAt, failAt }: Scenario, overtake: () => void) {
  const wrap = (target: object, method: string, before: () => void) => {
    const record = target as Record<string, (...args: unknown[]) => unknown>;
    const original = record[method]!;
    record[method] = (...args) => {
      before();
      return original(...args);
    };
  };
  if (overtakeAt) wrap(engine.model, overtakeAt, overtake);
  if (failAt) {
    wrap(engine.sections, failAt, () => {
      throw new Error(`${failAt} failed`);
    });
  }
}

/** The calls into the engine, with each callback (an intent check or a progress report) named by its kind. */
const calls = (engine: FakeEngine) =>
  engine.calls.map((call) => ({
    ...call,
    args: call.args.map((argument) => (typeof argument === 'function' ? '[function]' : argument)),
  }));

const errors = () => vi.spyOn(console, 'error').mockImplementation(() => {});

async function runLegacy({
  hash,
  landmark = 'opens',
  tractsOpen = false,
  overtakeAt,
  failAt,
  busy,
  immediate,
}: Scenario): Promise<Outcome> {
  const spy = errors();
  let commands: ReturnType<typeof legacyCommands>;
  const engine = createEngine();
  const { camera } = engine;
  // The contract's `publishedWindow` is legacy's `volumes.metadata.display`.
  const sections = new Proxy(engine.sections, {
    get: (target, key) =>
      key === 'volumes'
        ? target.publishedWindow && {
            metadata: {
              display: {
                window_center: target.publishedWindow.center,
                window_width: target.publishedWindow.width,
              },
            },
          }
        : Reflect.get(target, key),
  });
  // The contract renames three legacy members of the model: `layers` is `hasLayer`, `envelopes` is `envelopesLoaded`
  // and `spinalCordLoadState` is `spinalCordLoad`.
  const renamed: Record<string, (target: FakeEngine['model']) => unknown> = {
    layers: (target) => ({ has: (id: string) => target.hasLayer(id) }),
    envelopes: (target) => target.envelopesLoaded,
    spinalCordLoadState: (target) => target.spinalCordLoad,
  };
  const model = new Proxy(engine.model, {
    get: (target, key) => renamed[key as string]?.(target) ?? Reflect.get(target, key),
  });
  const session = legacySession({ views: Object.keys(legacyDirections) });
  const circuitSession = legacyLesson(circuits as never);
  const hookCalls: unknown[] = [];
  commands = legacyCommands({ model, sections, session, render() {} } as never);
  const linkWriter = legacyWriter(() => {});
  const hooks = {
    chooseExplorer(value: string) {
      hookCalls.push(['chooseExplorer', value]);
      session.setExplorer(value as never);
    },
    revealInTree: (id: string) => hookCalls.push(['revealInTree', id]),
    async openLandmark(step: { region: string }, current: () => boolean) {
      hookCalls.push(['openLandmark', step.region]);
      if (landmark === 'throws') throw new Error('Landmark geometry unavailable');
      if (landmark === 'overtaken') commands.begin();
      return current();
    },
  };
  const applyView = (view: string, movement: object) => {
    if (!session.setView(view)) throw new Error(`Unknown view: ${view}`);
    camera.applyView(view as never, movement);
  };
  const body = new Function(
    'd',
    `
    let { commands, linkWriter, session, circuitSession, model, sections, hooks, hookCalls, checkLink, readerState,
      viewForRestoredCut, PARAMS, ALL_DOMAINS, MODES, VIEW_DIRECTIONS, hasSpinalCord, clinicalCatalog, circuitCatalog,
      restoreReaderState, camera, applyView, cutFacingView } = d;
    let beforeTractsOpacity = d.tractsOpen ? 0.5 : null;
    let beforeExcursion = 'kept', beforeLesson = 'kept';
    const chooseExplorer = hooks.chooseExplorer, revealInTree = hooks.revealInTree, openLandmark = hooks.openLandmark;
    const workspace = { showDetail: () => hookCalls.push(['showDetail']) };
    const functionExplorer = { openFunction: id => hookCalls.push(['openFunction', id]) };
    const clinicalExplorer = { openDeficit: id => hookCalls.push(['openDeficit', id]) };
    const render = () => {};
    const scheduleUrl = linkWriter.schedule;
    const captureReaderState = () => { hookCalls.push(['rememberLessonScene']); sections.mriWindowLink(); camera.capture(); return 'captured'; };
    const applyReaderState = (target, current, movement = {}) => restoreReaderState(target, {
      model, sections, commands, current, revealInTree,
      applyCamera: () => {
        if (target.camera === 'cut' && sections.active) {
          const faced = camera.faceCut(movement);
          if (faced) session.setView(faced);
        } else if (target.camera === 'cut' || target.camera === 'view') applyView(target.view, movement);
        else throw new Error('A link has no exact camera pose.');
      },
      applyOrbit: orbit => camera.placeOrbit(orbit, movement),
    });
    ${knownSource}
    ${restoreSource}
    return { restoreLink, get beforeExcursion() { return beforeExcursion; }, get beforeLesson() { return beforeLesson; } };
  `,
  );
  const app = body({
    commands,
    linkWriter,
    session,
    circuitSession,
    model,
    sections,
    hooks,
    hookCalls,
    camera,
    applyView,
    cutFacingView,
    checkLink: legacyCheckLink,
    readerState: legacyReaderState,
    viewForRestoredCut: legacyCutView,
    PARAMS: legacyParams,
    ALL_DOMAINS,
    MODES: legacyModes,
    VIEW_DIRECTIONS: legacyDirections,
    hasSpinalCord: legacyPublishesCord(model.manifest),
    clinicalCatalog: clinical,
    circuitCatalog: circuits,
    restoreReaderState: legacyApply,
    tractsOpen,
  });
  if (busy) await prepare(engine, session, circuitSession);
  intercept(engine, { hash, overtakeAt, failAt }, () => commands.begin());
  const notApplied = await app.restoreLink(legacyDecode(hash), immediate ? { immediate } : {});
  linkWriter.cancel();
  session.releaseNotices();
  const outcome = {
    notApplied,
    engineCalls: calls(engine),
    hookCalls,
    errors: spy.mock.calls.map(([error]) => (error as Error).message),
    session: session.assemble({}),
    lesson: circuitSession.snapshot(),
    excursion: [app.beforeExcursion, app.beforeLesson],
  };
  spy.mockRestore();
  return outcome;
}

async function runNew({
  hash,
  landmark = 'opens',
  tractsOpen = false,
  overtakeAt,
  failAt,
  busy,
  immediate,
}: Scenario): Promise<Outcome> {
  const spy = errors();
  let commands: ReturnType<typeof createSceneCommands>;
  const engine = createEngine();
  const session = createSessionStore({ views: Object.keys(legacyDirections) });
  const lesson = createLessonStore(circuits as never);
  commands = createSceneCommands({
    model: engine.model,
    sections: engine.sections,
    session: { ...session, assemble: (state: object) => ({ ...state, ...session.state }) } as never,
    render() {},
  });
  const link = createLinkWriter(() => {});
  const hookCalls: unknown[] = [];
  let scenes: unknown[] = ['kept', 'kept'];
  const hooks: LinkHooks = {
    chooseExplorer(value) {
      hookCalls.push(['chooseExplorer', value]);
      session.setExplorer(value);
    },
    tractsExcursionOpen: () => tractsOpen,
    forgetScenes: () => {
      scenes = [null, null];
    },
    rememberLessonScene: (scene) => {
      assert.ok(scene.camera);
      hookCalls.push(['rememberLessonScene']);
      scenes[1] = 'captured';
    },
    revealInTree: (id) => hookCalls.push(['revealInTree', id]),
    async openLandmark(step, current) {
      hookCalls.push(['openLandmark', step.region]);
      if (landmark === 'throws') throw new Error('Landmark geometry unavailable');
      if (landmark === 'overtaken') commands.begin();
      return current();
    },
    showDetail: () => hookCalls.push(['showDetail']),
    openFunction: (id) => hookCalls.push(['openFunction', id]),
    openDeficit: (id) => hookCalls.push(['openDeficit', id]),
  };
  const links = createLinks({
    engine,
    session,
    lesson,
    view: { current: { anatomy: manifest.anatomy.id } } as never,
    link,
    commands,
    clinical: clinical as never,
    circuits: circuits as never,
    hooks,
    followLanguage() {},
    defaultAnatomy: manifest.anatomy.id,
    page: {} as never,
  });
  if (busy) await prepare(engine, session, lesson);
  intercept(engine, { hash, overtakeAt, failAt }, () => commands.begin());
  const notApplied = await links.restore(decodeState(hash), immediate ? { immediate } : {});
  link.cancel();
  session.releaseNotices();
  const outcome = {
    notApplied,
    engineCalls: calls(engine),
    hookCalls,
    errors: spy.mock.calls.map(([error]) => (error as Error).message),
    session: session.state,
    lesson: lesson.state,
    excursion: scenes,
  };
  spy.mockRestore();
  return outcome;
}

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

const regionIds = manifest.regions
  .filter((region) => region.kind !== 'non-region')
  .slice(0, 400)
  .map((region) => region.id);
const OPTIONS: Record<string, string[]> = {
  atlas: ['destrieux', 'hcp-mmp', 'missing'],
  detail: ['aseg', 'nextbrain', 'learning', 'missing'],
  cuts: ['destrieux', 'hcp-mmp', 'nextbrain', 'missing'],
  system: ['vascular', 'ventricles'],
  region: [...regionIds.slice(0, 30), 'destrieux:left:1', 'nope'],
  isolate: [...regionIds.slice(0, 10), 'nope'],
  view: ['oblique', 'left', 'right', 'superior', 'inferior', 'anterior', 'posterior', 'sideways'],
  cam: ['0,0,300,0,0,0', '10,20,300,0,0,0,0,1,0', '0,0,90000,0,0,0'],
  cut: ['off', 'sagittal', 'coronal', 'axial', 'oblique'],
  pos: ['-12.5', '0', '4', '9999'],
  rev: ['0', '1'],
  tilt: ['10', '45'],
  az: ['-90', '120'],
  hemi: ['left', 'right', 'both'],
  cortex: ['0', '1'],
  internal: ['0', '1'],
  cord: ['0', '1'],
  colors: ['tissue', 'mri', 'atlas', 'network', 'cab-np', 'functional', 'bogus'],
  level: ['named', 'sections'],
  opacity: ['0.4', '1'],
  mri: ['90,180', '100,200', '300,2'],
  tab: ['anatomy', 'functions', 'deficits', 'circuits', 'diffusion', 'bogus'],
  function: ['all', 'language', 'term-a', 'bogus'],
  deficit: ['aphasia', 'neglect', 'bogus'],
  circuit: ['language', 'bogus'],
  step: ['1', '2', '3', '9'],
  lang: ['en', 'fr'],
};

function randomHash(random: () => number) {
  const parameters = new URLSearchParams();
  for (const [name, values] of Object.entries(OPTIONS)) {
    if (random() < 0.25) parameters.set(name, values[Math.floor(random() * values.length)]!);
  }
  if (random() < 0.3) {
    const hidden = Array.from(
      { length: 1 + Math.floor(random() * 4) },
      () => regionIds[Math.floor(random() * 60)]!,
    );
    parameters.set('hidden', [...new Set(hidden)].join(','));
  }
  return parameters.toString().replaceAll('%3A', ':').replaceAll('%2C', ',');
}

const fixed: Scenario[] = [
  { hash: '' },
  { hash: 'atlas=hcp-mmp&region=hcp-mmp:left:1' },
  { hash: 'cut=coronal&pos=-12.5&rev=1' },
  { hash: 'cut=oblique&tilt=40&az=-60&pos=3' },
  { hash: 'cut=axial&view=left' },
  { hash: 'tab=functions&function=language' },
  { hash: 'tab=deficits&deficit=aphasia&atlas=destrieux' },
  { hash: 'tab=circuits&circuit=language&step=2' },
  { hash: 'tab=circuits&circuit=language&step=2', landmark: 'throws' },
  { hash: 'tab=circuits&circuit=language&step=2', landmark: 'overtaken' },
  { hash: 'tab=circuits&circuit=language&step=2&region=destrieux:left:1' },
  { hash: 'tab=circuits&circuit=bogus&step=9' },
  { hash: 'tab=anatomy', tractsOpen: true },
  { hash: 'tab=diffusion', tractsOpen: true },
  { hash: 'cam=10,20,300,0,0,0&view=left' },
  { hash: 'cam=0,0,90000,0,0,0' },
  { hash: 'mri=90,180&cut=sagittal' },
  { hash: 'hidden=destrieux:left:1,destrieux:left:2&region=destrieux:left:3' },
  {
    hash: 'atlas=missing&detail=missing&cuts=missing&colors=bogus&view=sideways&tab=bogus&region=nope',
  },
  { hash: 'region=destrieux:left:1', overtakeAt: 'setHemisphere' },
  { hash: 'hemi=left&cortex=0&opacity=0.4&cord=1', overtakeAt: 'setHemisphere' },
  { hash: 'hemi=left&cortex=0&opacity=0.4', overtakeAt: 'setCortexOpacity' },
  { hash: 'region=a&region=b&lang=fr&lang=de' },
  { hash: 'pos=abc&tilt=999&opacity=2&mri=1,2,3' },
  { hash: 'tab=functions&function=language&atlas=destrieux' },
  { hash: 'tab=functions&function=term-a' },
  { hash: 'colors=cab-np' },
  { hash: 'colors=functional&level=sections' },
  { hash: 'hemi=right', busy: true },
  { hash: '', busy: true },
  { hash: 'tab=circuits&circuit=language&step=3', busy: true, immediate: true },
  { hash: 'cut=axial&rev=1&view=superior', busy: true, immediate: true },
  { hash: 'cam=10,20,300,0,0,0,0,1,0&mri=100,200', busy: true },
  { hash: 'hemi=left', busy: true, failAt: 'setMode' },
  { hash: 'cut=coronal&pos=3&rev=1', busy: true, failAt: 'setMode' },
  { hash: 'cut=coronal', busy: true, failAt: 'setMode' },
  { hash: 'mri=90,180', busy: true, failAt: 'load' },
];

afterEach(() => vi.restoreAllMocks());

describe('S4 parity: restoring a link', () => {
  it('makes the same engine calls, hook calls and notApplied list for each link in the corpus', async () => {
    const random = seeded(35);
    const corpus: Scenario[] = [...fixed];
    for (let index = 0; index < 120; index++) {
      corpus.push({
        hash: randomHash(random),
        tractsOpen: random() < 0.1,
        landmark: random() < 0.2 ? 'throws' : 'opens',
        busy: random() < 0.4,
        immediate: index % 2 === 0,
      });
    }
    const seen = { overtaken: 0, reported: 0, clean: 0 };
    for (const scenario of corpus) {
      const legacy = await runLegacy(scenario);
      const next = await runNew(scenario);
      assert.deepStrictEqual(next, legacy, `link #${scenario.hash}`);
      if (legacy.notApplied === null) seen.overtaken++;
      else if (legacy.notApplied.length) seen.reported++;
      else seen.clean++;
    }
    // The corpus must reach every way a restore ends.
    assert.ok(seen.overtaken > 0 && seen.reported > 10 && seen.clean > 10, JSON.stringify(seen));
  });

  it('writes the same link state as legacy, over the scenes a link is written from', async () => {
    const scenes: ((engine: FakeEngine) => Promise<void>)[] = [
      async () => {},
      async (engine) => engine.sections.setMode('sagittal'),
      async (engine) => {
        await engine.sections.setMode('oblique');
        engine.sections.setAngles(40, -60);
        engine.sections.setDisplay({ reverse: true });
      },
      async (engine) => {
        await engine.sections.setMode('coronal');
        engine.sections.setOffset(12.34);
        await engine.sections.load();
        engine.sections.setWindow(50, 60);
        engine.model.setHemisphere('right');
        engine.camera.applyView('left');
      },
      async (engine) => {
        engine.camera.placeOrbit({ position: [10, 20, 300], target: [0, 0, 0] });
        engine.model.loadHiddenRegions(['destrieux:left:1']);
      },
    ];
    for (const [index, scene] of scenes.entries()) {
      for (const lessonOpen of [false, true]) {
        const engine = createEngine();
        const session = createSessionStore({ views: Object.keys(legacyDirections) });
        const lesson = createLessonStore(circuits as never);
        const legacyOnly = legacySession({ views: Object.keys(legacyDirections) });
        const circuitSession = legacyLesson(circuits as never);
        await scene(engine);
        if (lessonOpen) {
          lesson.start('language');
          lesson.go(2);
          circuitSession.start('language');
          circuitSession.go(2);
        }
        const anatomy = manifest.anatomy.id;
        const legacy = new Function(
          'd',
          `
          const { Vector3, sections, session, model, anatomy, circuitSession, camera } = d;
          const orbitLink = () => camera.orbitLink();
          const mriWindowLink = () => sections.mriWindowLink();
          ${linkStateSource}
          return linkState();
        `,
        )({
          Vector3,
          // Legacy frames are Vector3s; the contract's are tuples.
          sections: new Proxy(engine.sections, {
            get: (target, key) =>
              key === 'frame'
                ? { normal: new Vector3(...target.frame.normal) }
                : Reflect.get(target, key),
          }),
          session: legacyOnly,
          model: engine.model,
          anatomy,
          circuitSession,
          camera: engine.camera,
        });
        const links = createLinks({
          engine,
          session,
          lesson,
          view: {
            get current() {
              return {
                ...engine.model.state,
                ...session.state,
                lesson: lesson.state,
                anatomy,
                referenceAnatomy: anatomy,
              };
            },
          } as never,
          link: createLinkWriter(() => {}),
          commands: {} as never,
          clinical: clinical as never,
          circuits: circuits as never,
          hooks: {} as never,
          followLanguage() {},
          defaultAnatomy: anatomy,
          page: {} as never,
        });
        const next = links.linkState();
        // An absent field and a null one are the same link: the encoder skips both.
        for (const key of Object.keys(legacy)) {
          assert.deepStrictEqual(
            next[key as keyof typeof next] ?? null,
            legacy[key] ?? null,
            `scene ${index} ${key}`,
          );
        }
        assert.equal(encodeState(next), encodeState(legacy), `scene ${index}`);
        assert.ok(Object.keys(next).length >= Object.keys(legacy).length);
      }
    }
  });
});
