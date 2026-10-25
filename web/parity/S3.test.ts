import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it, vi } from 'vitest';
import {
  prepareCircuitMri as legacyPrepare,
  showCircuitLandmark as legacyShow,
} from '../../viewer/learning/navigation.js';
import { createSession as legacySession } from '../../viewer/state/session.js';
import { createExplorerChoice } from '../src/lib/controller/modes.ts';
import {
  prepareCircuitMri,
  showCircuitLandmark,
} from '../src/lib/controller/navigation/learning.ts';
import { createSession } from '../src/lib/core/state/session.ts';
import manifestFile from '../../public/models/cdmd/manifest.json' with { type: 'json' };
import domainsFile from '../../public/models/cdmd/neuropsych-domains.json' with { type: 'json' };
import { createCatalog as legacyCatalog } from '../../viewer/catalog/catalog.js';
import { beneathCortex as legacyBeneath } from '../../viewer/catalog/labels.js';
import * as legacyDomains from '../../viewer/catalog/neuropsych-domains.js';
import { visibilityOf as legacyVisibility } from '../../viewer/catalog/visibility.js';
import { loadClinicalCatalog as legacyClinical } from '../../viewer/clinical/load.js';
import { CLINICAL_TEXT } from '../../viewer/clinical/translations.js';
import { t as legacyT } from '../../viewer/i18n/translations.js';
import { loadCircuitCatalog as legacyCircuits } from '../../viewer/learning/load.js';
import { createCircuitSession } from '../../viewer/learning/session.js';
import { revealNotice as legacyRevealNotice } from '../../viewer/ui/panels/clinical.js';
import { createInvolvement as legacyInvolvement } from '../../viewer/ui/panels/related.js';
import { createSceneCommands as legacyCommands } from '../../viewer/state/scene-commands.js';
import { createScene } from '../src/lib/controller/excursion-test-support.ts';
import { createFakeEngine } from '../src/lib/engine/fake.ts';
import { validateNeuropsychDomains } from '../src/lib/core/catalog/neuropsych-domains.ts';
import { VIEW_NAMES } from '../src/lib/types/index.ts';
import type { Engine } from '../src/lib/engine/api.ts';
import { EXPLORERS } from '../src/lib/types/constants.ts';
import { repoRoot } from '../test/repo.ts';

/**
 * The tab and the lesson's landmark, against the legacy functions. The legacy `chooseExplorer` is
 * `app.js`'s own source, run over the same fakes as the new one (the legacy suite's technique): the
 * app cannot be constructed without WebGL.
 */

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

const appSource = readFileSync(`${repoRoot}viewer/app.js`, 'utf8');
const legacyChooseExplorerSource = appSource.match(
  / {2}function chooseExplorer\(value\) \{[\s\S]*?\n {2}\}/,
)![0];

/** One side's tracts overlay and cortex, recording what each is told. */
function tractsRig(anatomy: string, opacity: number) {
  const calls: unknown[][] = [];
  const model = { settings: { cortexOpacity: opacity } };
  const tracts = { anatomy: 'bert', defaultOpacity: 0.16 };
  return {
    calls,
    model,
    tracts,
    anatomy,
    setCortexOpacity(value: number) {
      model.settings.cortexOpacity = value;
      calls.push(['opacity', value]);
    },
    setOverlay(visible: boolean) {
      calls.push(['overlay', visible]);
    },
  };
}

describe('S3 parity', () => {
  it('chooseExplorer agrees with the legacy one over seeded tab and opacity sequences', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const random = seeded(seed);
      const anatomy = pick(random, ['bert', 'aomic']);
      const opacity = pick(random, [1, 0.64, 0]);

      const old = tractsRig(anatomy, opacity);
      const oldSession = legacySession({ views: [] });
      const oldModel = {
        state: old.model.settings,
        setCortexOpacity: old.setCortexOpacity,
      };
      const oldTracts = {
        anatomy: old.tracts.anatomy,
        defaultOpacity: old.tracts.defaultOpacity,
        enableOverlay: () => old.setOverlay(true),
        disableOverlay: () => old.setOverlay(false),
      };
      const legacy = runInNewContext(
        `let beforeTractsOpacity = null;
        ${legacyChooseExplorerSource}
        chooseExplorer;`,
        {
          session: oldSession,
          model: oldModel,
          nativeTracts: oldTracts,
          anatomy,
          render() {},
        },
      ) as (value: string) => void;

      const next = tractsRig(anatomy, opacity);
      const core = createSession({ views: [] });
      const { chooseExplorer } = createExplorerChoice({
        engine: {
          model: {
            settings: next.model.settings,
            setCortexOpacity: next.setCortexOpacity,
          },
          tracts: { ...next.tracts, setOverlay: next.setOverlay },
        } as unknown as Pick<Engine, 'model' | 'tracts'>,
        session: {
          get state() {
            return core.assemble({});
          },
          setExplorer: core.setExplorer,
        },
        anatomy: () => anatomy,
        render() {},
      });

      for (let step = 0; step < 60; step++) {
        if (random() < 0.3) {
          const value = pick(random, [0, 0.22, 0.4, 1]);
          old.setCortexOpacity(value);
          next.setCortexOpacity(value);
        } else {
          const tab = pick(random, EXPLORERS);
          legacy(tab);
          chooseExplorer(tab);
        }
        assert.deepEqual(next.calls, old.calls, `seed ${seed} step ${step}`);
        assert.equal(core.assemble({}).explorer, oldSession.assemble({}).explorer);
      }
    }
  });

  it('showCircuitLandmark and prepareCircuitMri agree with the legacy ones', async () => {
    const random = seeded(7);
    const regions = new Map(
      ['left', 'right', 'midline'].map((hemisphere) => [`r:${hemisphere}`, { hemisphere }]),
    );
    for (let case_ = 0; case_ < 40; case_++) {
      const step = {
        region: pick(random, [...regions.keys()]),
        restores: pick(random, [[], ['a'], ['a', 'b']]),
        covering_regions: pick(random, [undefined, ['c'], ['c', 'd']]),
        plane: pick(random, ['axial', 'coronal', 'sagittal'] as const),
      };
      const record = () => {
        const calls: unknown[][] = [];
        return {
          calls,
          model: {
            regions,
            showRegions: (ids: unknown) => calls.push(['show', ids]),
            hideRegions: (ids: unknown) => calls.push(['hide', ids]),
            setHemisphere: (side: unknown) => calls.push(['hemisphere', side]),
          },
        };
      };
      const old = record();
      const next = record();
      legacyShow(old.model, step);
      showCircuitLandmark(next.model as never, step as never);
      assert.deepEqual(next.calls, old.calls);

      const centroid = pick(random, [[1, 2, 3], [0, 0, 0], null, [1, Number.NaN, 3], [1, 2]]);
      const mri = () => {
        const calls: unknown[][] = [];
        return {
          calls,
          model: { centroidOf: () => centroid },
          sections: {
            setCrosshair: (point: unknown) => calls.push(['crosshair', point]),
            setDisplay: (display: unknown) => calls.push(['display', display]),
            setMode: async (mode: unknown) => void calls.push(['mode', mode]),
          },
        };
      };
      const oldMri = mri();
      const nextMri = mri();
      const outcome = async (run: () => Promise<void>) =>
        run().then(
          () => 'resolved',
          (error: Error) => error.message,
        );
      assert.equal(
        await outcome(() =>
          prepareCircuitMri(nextMri.model as never, nextMri.sections as never, step),
        ),
        await outcome(() => legacyPrepare(oldMri.model, oldMri.sections, step)),
      );
      assert.deepEqual(nextMri.calls, oldMri.calls);
    }
  });
});

const manifest = manifestFile as any;
const source = readFileSync(`${repoRoot}viewer/app.js`, 'utf8');
const slice = (from: string, to: string) => {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  assert.ok(start > 0 && end > start, from);
  return source.slice(start, end);
};
const excursionSource = slice(
  '  /** Panels word their own failures',
  '  function frameInternal() {',
);
const lessonSource = slice(
  '  /** Draw, select and frame a lesson',
  '  // Under a lesson the landmark',
);
const landmarkSource = slice(
  '  /** The lesson step whose landmark',
  '  /** A landmark is framed as',
);

const PARAMS = [
  'model',
  'sections',
  'session',
  'commands',
  'render',
  'catalog',
  'clinicalCatalog',
  'circuitCatalog',
  'circuitSession',
  'captureReaderState',
  'applyReaderState',
  'showDetail',
  'workspace',
  'frameRegions',
  'frameWhole',
  'frameLandmark',
  'faceCut',
  'sectionControls',
  'nativeTracts',
  'anatomy',
  'setCutAtlas',
  'createClinicalExplorer',
  'createFunctionExplorer',
  'createCircuitExplorer',
  'showCircuitLandmark',
  'prepareCircuitMri',
  'revealNotice',
  'beneathCortex',
  'visibilityOf',
  'createInvolvement',
  't',
  'CLINICAL_TEXT',
  'ALL_DOMAINS',
  'domainAreas',
  'domainName',
  'domainPaint',
  'domainRecord',
  'groupedDomains',
  'matchingTerms',
];
const makeLegacy = new Function(
  ...PARAMS,
  `${landmarkSource}\n${excursionSource}\n${lessonSource}\nreturn { restoreBeforeExcursion, closeDeficit, closeFunction,
  openDeficit, openFunction, openListedRegion, seeThroughCortex, pickPaint, chooseExplorer, searchIn, chooseMode,
  leaveLesson, circuitExplorer, offerReload, lessonLandmark, functionExplorer, clinicalExplorer,
  restorable: () => beforeExcursion !== null };`,
) as (...args: unknown[]) => any;

const named = (engine: any) =>
  engine.calls.map((call: any) => ({
    ...call,
    args: call.args.map((a: unknown) => (typeof a === 'function' ? '[function]' : a)),
  }));

function legacySide() {
  const regions = new Map(manifest.regions.map((region: any) => [region.id, region]));
  const domains = validateNeuropsychDomains(domainsFile as any, regions as any);
  const engine = createFakeEngine({ manifest, domains: domains as any }) as any;
  const { sections, camera } = engine;
  const model = new Proxy(engine.model, {
    get(target, key) {
      if (key === 'layers') return { has: (id: string) => target.hasLayer(id) };
      if (key === 'envelopes') return target.envelopesLoaded;
      if (key === 'spinalCordLoadState') return target.spinalCordLoad;
      return Reflect.get(target, key);
    },
  });
  const note = (domain: string, method: string, ...args: unknown[]) =>
    engine.calls.push({ domain, method, args });
  const session = legacySession({ views: VIEW_NAMES });
  const render = () => note('app', 'render');
  const commands = legacyCommands({ model, sections, session, render: () => undefined });
  const clinicalCatalog = legacyClinical(manifest);
  const circuitCatalog = legacyCircuits(manifest, clinicalCatalog);
  const circuitSession = createCircuitSession(circuitCatalog);
  let captured = 0;
  const reader = {
    capture: vi.fn(() => ({ label: `scene ${++captured}` })),
    apply: vi.fn(async (_target: unknown, _current: () => boolean) => [] as any[]),
  };
  const mri = {
    openPreparedPlane: vi.fn(async (plane: string) => note('mri', 'openPreparedPlane', plane)),
  };
  const legacy = makeLegacy(
    model,
    sections,
    session,
    commands,
    render,
    legacyCatalog(manifest),
    clinicalCatalog,
    circuitCatalog,
    circuitSession,
    () => reader.capture(),
    (target: unknown, current: () => boolean) => reader.apply(target, current),
    () => note('shell', 'showDetail'),
    { showList: () => note('shell', 'showList') },
    (ids: string[]) => camera.frameRegions(ids),
    () => camera.frameWhole(),
    (step: any, options: object = {}) => {
      if (!camera.frameLandmark(step.region, step.view, circuitCatalog.contextMarginMm, options))
        return false;
      session.setView(step.view);
      return true;
    },
    () => {
      // app.js:1281-1296: nothing happens, and nothing renders, without a cut.
      const faced = camera.faceCut();
      if (!faced) return;
      session.setView(faced);
      render();
    },
    mri,
    {
      anatomy: engine.tracts.anatomy,
      defaultOpacity: engine.tracts.defaultOpacity,
      enableOverlay: () => engine.tracts.setOverlay(true),
      disableOverlay: () => engine.tracts.setOverlay(false),
    },
    manifest.anatomy.id,
    (id: string) => sections.setCutAtlas(id).catch(() => {}),
    (opts: any) => ({ ...opts, openDeficit: (id: string) => opts.onDeficit(id) }),
    (opts: any) => ({ ...opts, openFunction: (id: string) => opts.onFunction(id) }),
    (opts: any) => opts,
    legacyShow,
    legacyPrepare,
    legacyRevealNotice,
    legacyBeneath,
    legacyVisibility,
    legacyInvolvement,
    legacyT,
    CLINICAL_TEXT,
    legacyDomains.ALL_DOMAINS,
    legacyDomains.domainAreas,
    legacyDomains.domainName,
    legacyDomains.domainPaint,
    legacyDomains.domainRecord,
    legacyDomains.groupedDomains,
    legacyDomains.matchingTerms,
  );
  return {
    engine,
    reader,
    mri,
    legacy,
    commands,
    rawSession: session,
    render,
    session: () => session.assemble({}),
    lesson: () => circuitSession.snapshot(),
    circuits: circuitCatalog,
  };
}

const sessionFields = (s: any) => ({
  explorer: s.explorer,
  selectedFunction: s.selectedFunction,
  selectedDeficit: s.selectedDeficit,
  selectedFinding: s.selectedFinding,
  functionQuery: s.functionQuery,
  clinicalQuery: s.clinicalQuery,
  notice: s.notice,
  paintLifted: s.paintLifted,
  view: s.view,
});

/** Run the same script on both sides and compare after every step. */
async function compare(
  script: Array<[string, (side: 'old' | 'new', o: any, n: any) => Promise<unknown> | unknown]>,
) {
  const old = legacySide();
  const next = createScene() as any;
  // Drop the construction-time calls so the logs start level.
  old.engine.calls.length = 0;
  next.engine.calls.length = 0;
  const diffs: string[] = [];
  for (const [label, step] of script) {
    let oldOut: unknown;
    let newOut: unknown;
    // What a step fires and does not await (the panels' entry points) settles before the comparison.
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
    try {
      oldOut = await step('old', old, next);
    } catch (e) {
      oldOut = `threw ${(e as Error).message}`;
    }
    await settle();
    try {
      newOut = await step('new', old, next);
    } catch (e) {
      newOut = `threw ${(e as Error).message}`;
    }
    await settle();
    const o = named(old.engine);
    const n = named(next.engine);
    try {
      assert.deepStrictEqual(n, o);
    } catch {
      diffs.push(
        `${label}: engine log differs\n  old: ${JSON.stringify(o.map((c: any) => `${c.domain}.${c.method}`))}\n  new: ${JSON.stringify(n.map((c: any) => `${c.domain}.${c.method}`))}`,
      );
    }
    try {
      assert.deepStrictEqual(sessionFields(next.session.state), sessionFields(old.session()));
    } catch {
      diffs.push(
        `${label}: session differs\n  old: ${JSON.stringify(sessionFields(old.session()))}\n  new: ${JSON.stringify(sessionFields(next.session.state))}`,
      );
    }
    try {
      assert.deepStrictEqual(
        { circuit: next.lesson.state.circuit, step: next.lesson.state.step },
        { circuit: old.lesson().circuit, step: old.lesson().step },
      );
    } catch {
      diffs.push(`${label}: lesson differs`);
    }
    if (next.excursions.restorable !== old.legacy.restorable())
      diffs.push(`${label}: restorable differs`);
    if (next.reader.capture.mock.calls.length !== old.reader.capture.mock.calls.length)
      diffs.push(`${label}: captures differ`);
    if (
      JSON.stringify(next.reader.apply.mock.calls.map((c: any) => c[0])) !==
      JSON.stringify(old.reader.apply.mock.calls.map((c: any) => c[0]))
    )
      diffs.push(`${label}: restore targets differ`);
    // Results are not compared: `openDeficit` now answers true or false where legacy's answered
    // undefined, and nothing read it.
    void oldOut;
    void newOut;
    old.engine.calls.length = 0;
    next.engine.calls.length = 0;
  }
  return diffs;
}

describe('S3 parity: the legacy excursion and lesson closures', () => {
  it('excursions: deficits, functions, restore, tabs and Tracts', async () => {
    const both =
      (fnOld: (o: any) => unknown, fnNew: (n: any) => unknown) =>
      (side: 'old' | 'new', o: any, n: any) => (side === 'old' ? fnOld(o) : fnNew(n));
    const diffs = await compare([
      [
        'openDeficit acalculia',
        both(
          (o) => o.legacy.openDeficit('acalculia'),
          (n) => n.excursions.openDeficit('acalculia'),
        ),
      ],
      [
        'openDeficit neglect',
        both(
          (o) => o.legacy.openDeficit('neglect'),
          (n) => n.excursions.openDeficit('neglect'),
        ),
      ],
      [
        'seeThroughCortex',
        both(
          (o) => o.legacy.seeThroughCortex(),
          (n) => n.excursions.seeThroughCortex(),
        ),
      ],
      [
        'openListedRegion',
        both(
          (o) => o.legacy.openListedRegion('destrieux:left:25'),
          (n) => n.excursions.openListedRegion('destrieux:left:25'),
        ),
      ],
      [
        'pickPaint finding',
        both(
          (o) => o.legacy.pickPaint('x'),
          (n) => n.excursions.pickPaint('x'),
        ),
      ],
      [
        'restore',
        both(
          (o) => o.legacy.restoreBeforeExcursion(),
          (n) => n.excursions.restoreBeforeExcursion(),
        ),
      ],
      [
        'openFunction language',
        both(
          (o) => o.legacy.openFunction('language'),
          (n) => n.excursions.openFunction('language'),
        ),
      ],
      [
        'pickPaint null (functions)',
        both(
          (o) => o.legacy.pickPaint(null),
          (n) => n.excursions.pickPaint(null),
        ),
      ],
      [
        'chooseMode anatomy',
        both(
          (o) => o.legacy.chooseMode('anatomy'),
          (n) => n.excursions.chooseMode('anatomy'),
        ),
      ],
      [
        'chooseAtlas other',
        both(
          (o) => {
            o.rawSession.liftPaint();
            o.render();
            return o.commands.chooseAtlas('destrieux');
          },
          (n) => n.excursions.chooseAtlas('destrieux'),
        ),
      ],
      [
        'chooseMode functions (re-open)',
        both(
          (o) => o.legacy.chooseMode('functions'),
          (n) => n.excursions.chooseMode('functions'),
        ),
      ],
      [
        'settle',
        both(
          () => new Promise((r) => setTimeout(r, 0)),
          () => new Promise((r) => setTimeout(r, 0)),
        ),
      ],
      [
        'searchIn deficits',
        both(
          (o) => o.legacy.searchIn('deficits', 'aphasia'),
          (n) => n.excursions.searchIn('deficits', 'aphasia'),
        ),
      ],
      [
        'chooseMode diffusion',
        both(
          (o) => o.legacy.chooseMode('diffusion'),
          (n) => n.excursions.chooseMode('diffusion'),
        ),
      ],
      [
        'chooseMode anatomy 2',
        both(
          (o) => o.legacy.chooseMode('anatomy'),
          (n) => n.excursions.chooseMode('anatomy'),
        ),
      ],
      [
        'closeDeficit',
        both(
          (o) => o.legacy.closeDeficit(),
          (n) => n.excursions.closeDeficit(),
        ),
      ],
    ]);
    assert.deepEqual(diffs, []);
  });

  it('lessons: open, step, Linked MRI, leave, and a deficit opened from a lesson', async () => {
    const both =
      (fnOld: (o: any) => unknown, fnNew: (n: any) => unknown) =>
      (side: 'old' | 'new', o: any, n: any) => (side === 'old' ? fnOld(o) : fnNew(n));
    const scene = createScene();
    const [circuit] = scene.circuits.all;
    const id = circuit!.id;
    const diffs = await compare([
      [
        'onCircuit',
        both(
          (o) => o.legacy.circuitExplorer.onCircuit(id),
          (n) => n.excursions.openCircuit(id),
        ),
      ],
      [
        'onStep 1',
        both(
          (o) => o.legacy.circuitExplorer.onStep(1),
          (n) => n.excursions.openLessonStep(1),
        ),
      ],
      [
        'chooseMode circuits',
        both(
          (o) => o.legacy.chooseMode('circuits'),
          (n) => n.excursions.chooseMode('circuits'),
        ),
      ],
      [
        'onMri',
        both(
          (o) => o.legacy.circuitExplorer.onMri(),
          (n) => n.excursions.openLinkedMri({ atRegion: true }),
        ),
      ],
      [
        'chooseMode anatomy (leave)',
        both(
          (o) => o.legacy.chooseMode('anatomy'),
          (n) => n.excursions.chooseMode('anatomy'),
        ),
      ],
      [
        'onLandmark 2',
        both(
          (o) => o.legacy.circuitExplorer.onLandmark(id, 2),
          (n) => n.excursions.openLessonLandmark(id, 2),
        ),
      ],
      [
        'openDeficit from lesson',
        both(
          (o) => o.legacy.openDeficit('acalculia'),
          (n) => n.excursions.openDeficit('acalculia'),
        ),
      ],
      [
        'restore',
        both(
          (o) => o.legacy.restoreBeforeExcursion(),
          (n) => n.excursions.restoreBeforeExcursion(),
        ),
      ],
    ]);
    assert.deepEqual(diffs, []);
  });
  it('deep functions, overtaken opens and tabs chosen together', async () => {
    const both =
      (fnOld: (o: any) => unknown, fnNew: (n: any) => unknown) =>
      (side: 'old' | 'new', o: any, n: any) => (side === 'old' ? fnOld(o) : fnNew(n));
    const scene = createScene();
    const deep = scene.domains.domains.find((domain: any) =>
      legacyDomains
        .domainAreas(scene.domains, domain.id)
        .slice(0, 5)
        .some(({ region }: any) => legacyBeneath(scene.engine.model.regions.get(region)!)),
    )!.id;
    const [circuit] = scene.circuits.all;
    const diffs = await compare([
      [
        'openFunction deep',
        both(
          (o) => o.legacy.openFunction(deep),
          (n) => n.excursions.openFunction(deep),
        ),
      ],
      [
        'seeThrough',
        both(
          (o) => o.legacy.seeThroughCortex(),
          (n) => n.excursions.seeThroughCortex(),
        ),
      ],
      [
        'openFunction deep again',
        both(
          (o) => o.legacy.openFunction(deep),
          (n) => n.excursions.openFunction(deep),
        ),
      ],
      [
        'openFunction all',
        both(
          (o) => o.legacy.openFunction(legacyDomains.ALL_DOMAINS),
          (n) => n.excursions.openFunction(legacyDomains.ALL_DOMAINS),
        ),
      ],
      [
        'overtaken openDeficit',
        both(
          async (o) => {
            const p = o.legacy.openDeficit('neglect');
            o.commands.begin();
            return p;
          },
          async (n) => {
            const p = n.excursions.openDeficit('neglect');
            n.commands.begin();
            return p;
          },
        ),
      ],
      [
        'openDeficit abulia',
        both(
          (o) => o.legacy.openDeficit('abulia'),
          (n) => n.excursions.openDeficit('abulia'),
        ),
      ],
      [
        'onLandmark',
        both(
          (o) => o.legacy.circuitExplorer.onLandmark(circuit!.id, 1),
          (n) => n.excursions.openLessonLandmark(circuit!.id, 1),
        ),
      ],
      [
        'two tabs during leave',
        both(
          async (o) => {
            const a = o.legacy.chooseMode('functions');
            const b = o.legacy.chooseMode('deficits');
            await Promise.all([a, b]);
          },
          async (n) => {
            const a = n.excursions.chooseMode('functions');
            const b = n.excursions.chooseMode('deficits');
            await Promise.all([a, b]);
          },
        ),
      ],
      [
        'restore',
        both(
          (o) => o.legacy.restoreBeforeExcursion(),
          (n) => n.excursions.restoreBeforeExcursion(),
        ),
      ],
    ]);
    assert.deepEqual(diffs, []);
  });
});
