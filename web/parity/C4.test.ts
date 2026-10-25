/**
 * C4 parity: the TypeScript state modules against the legacy `viewer/state/**` over fixtures and
 * seeded draws. Each test is one labelled unit that runs alone (`-t`); every draw is reported by
 * its seed. Exact outputs are compared, never shapes.
 */
import assert from 'node:assert/strict';
import { isDeepStrictEqual, inspect } from 'node:util';
import { describe, onTestFinished, test, vi } from 'vitest';
import { readModel } from '../src/lib/core/catalog/test-support.ts';
import { readRepoYaml } from '../test/repo.ts';
import {
  prefetchAtlas as legacyPrefetch,
  startLanguage as legacyStartLanguage,
} from '../../viewer/state/boot.js';
import { createDissection as legacyDissection } from '../../viewer/state/dissection.js';
import {
  captureBeforeInternal as legacyCapture,
  insideInternal as legacyInside,
  leaveInternal as legacyLeave,
} from '../../viewer/state/internal-mode.js';
import { checkLink as legacyCheckLink } from '../../viewer/state/link-check.js';
import {
  createLinkWriter as legacyLinkWriter,
  sameSubject as legacySameSubject,
} from '../../viewer/state/link-writer.js';
import {
  legendFor as legacyLegendFor,
  paintFor as legacyPaintFor,
  paintKind as legacyPaintKind,
} from '../../viewer/state/paint.js';
import {
  applyReaderState as legacyApply,
  readerState as legacyReaderState,
  sameRegions as legacySameRegions,
} from '../../viewer/state/reader-state.js';
import {
  createSceneCommands as legacySceneCommands,
  publishesSpinalCord as legacyPublishesCord,
  requiredAtlas as legacyRequiredAtlas,
} from '../../viewer/state/scene-commands.js';
import {
  createSession as legacySession,
  shortcutsAllowed as legacyShortcuts,
} from '../../viewer/state/session.js';
import {
  DEFAULTS as legacyDefaults,
  PARAMS as legacyParams,
  decodeState as legacyDecode,
  encodeState as legacyEncode,
  orbitWithin as legacyOrbitWithin,
  towardZero as legacyTowardZero,
} from '../../viewer/state/url-state.js';
import { createClinicalCatalog as legacyClinical } from '../../viewer/clinical/catalog.js';
import * as legacyDomains from '../../viewer/catalog/neuropsych-domains.js';
import { createClinicalCatalog } from '../src/lib/core/clinical/catalog.ts';
import type { ClinicalData } from '../src/lib/core/clinical/types.ts';
import * as domains from '../src/lib/core/catalog/neuropsych-domains.ts';
import type {
  NeuropsychDomains,
  NeurosynthTerms,
} from '../src/lib/core/catalog/neuropsych-domains.ts';
import { prefetchAtlas, startLanguage } from '../src/lib/core/state/boot.ts';
import { createDissection } from '../src/lib/core/state/dissection.ts';
import {
  captureBeforeInternal,
  insideInternal,
  leaveInternal,
} from '../src/lib/core/state/internal-mode.ts';
import { checkLink, type KnownLinkIds } from '../src/lib/core/state/link-check.ts';
import { createLinkWriter, sameSubject } from '../src/lib/core/state/link-writer.ts';
import { legendFor, paintFor, paintKind } from '../src/lib/core/state/paint.ts';
import { applyReaderState, readerState, sameRegions } from '../src/lib/core/state/reader-state.ts';
import {
  createSceneCommands,
  publishesSpinalCord,
  requiredAtlas,
} from '../src/lib/core/state/scene-commands.ts';
import { createSession, shortcutsAllowed } from '../src/lib/core/state/session.ts';
import {
  DEFAULTS,
  PARAMS,
  decodeState,
  encodeState,
  orbitWithin,
  towardZero,
} from '../src/lib/core/state/url-state.ts';
import type { Manifest } from '../src/lib/types/index.ts';

type Any = Record<string, any>;
type Rand = () => number;

/** mulberry32: a seeded PRNG, so every run draws the same corpus. */
function prng(seed: number): Rand {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const below = (rand: Rand, n: number) => Math.floor(rand() * n);
const pick = <T>(rand: Rand, items: readonly T[]): T => items[below(rand, items.length)]!;
const SEEDS = Array.from({ length: 40 }, (_, index) => index + 1);

/** deepStrictEqual that names what differs, in short, rather than printing a whole diff. */
function same(actual: unknown, expected: unknown, label: string) {
  if (isDeepStrictEqual(actual, expected)) return;
  const brief = (value: unknown) =>
    inspect(value, { depth: 3, maxArrayLength: 6, maxStringLength: 160, breakLength: Infinity });
  assert.fail(`${label}: new ${brief(actual)}; legacy ${brief(expected)}`);
}
/** The value a call returned or the error it threw, so both implementations are held to either. */
function outcome(run: () => unknown) {
  try {
    return { value: run() };
  } catch (error) {
    return { error: [(error as Error).name, (error as Error).message] };
  }
}
async function outcomeAsync(run: () => Promise<unknown>) {
  try {
    return { value: await run() };
  } catch (error) {
    return { error: [(error as Error).name, (error as Error).message] };
  }
}

// ---------------------------------------------------------------------------------------------
// URL state
// ---------------------------------------------------------------------------------------------

/** One parameter's values: those it reads, near misses, and nonsense, so every reader branch is hit. */
const POOL: Record<string, string[]> = {
  anatomy: ['cdmd', 'other', ''],
  atlas: ['destrieux', 'hcp-mmp', ' ', ''],
  cuts: ['nextbrain', 'destrieux', ''],
  system: ['limbic', ''],
  detail: ['aseg', 'learning', ''],
  region: ['destrieux:left:29', 'aseg:left:17', 'nope', ''],
  isolate: ['aseg:left:17', 'destrieux:left:medial-wall', ''],
  view: ['left', 'superior', 'sideways', ''],
  cam: [
    '1,2,3,4,5,6',
    '10.04,-20.06,30.05,0,0,0',
    '1,2,3,4,5,6,0,0,2',
    '1,2,3,4,5,6,0,0,0',
    '1,2,3',
    '1,2,3,4,5,x',
    '200000,0,0,0,0,0',
    '1,2,3,4,5,6,7,8,9,10',
    '0,0,0,0,0,0',
    ' ,,,,,',
  ],
  cut: ['off', 'sagittal', 'coronal', 'axial', 'oblique', 'diagonal'],
  pos: ['0', '-12.34', '12.36', '512', '513', '1e2', 'abc', ' ', '0.04', '-0.04'],
  rev: ['1', '0', 'true', ''],
  tilt: ['0', '30', '90', '91', '-1', '44.6', 'x'],
  az: ['-180', '180', '181', '30', '-45.5', ''],
  hemi: ['both', 'left', 'right', 'middle'],
  cortex: ['1', '0', '2'],
  internal: ['1', '0', ''],
  cord: ['1', '0', 'yes'],
  colors: ['1', '0', 'tissue', 'mri', 'atlas', 'network', 'cab-np', 'functional', 'rainbow'],
  level: ['named', 'sections', 'all'],
  opacity: ['0', '0.5', '0.456', '1', '1.01', '-0.1', 'x', ''],
  mri: ['128,256', '0,1', '255,256', '256,1', '-1,10', '10,0', '10,257', '1', '1,2,3', 'a,b'],
  tab: ['anatomy', 'functions', 'deficits', 'circuits', 'diffusion', 'tree'],
  function: ['all', 'language', ''],
  deficit: ['aphasia', ''],
  circuit: ['visual', 'unknown', ''],
  step: ['1', '4', '5', '0', '-1', '2.5', 'x'],
  lang: ['en', 'fr', 'de', ''],
  hidden: ['destrieux:left:29', 'destrieux:left:29,aseg:left:17', 'a,,b', 'a,a', ''],
};

/** The hashes: a link naming every parameter once, then seeded ones with repeats, junk and prefixes. */
function hashCorpus() {
  const everything = `#${Object.entries(POOL)
    .map(([param, values]) => `${param}=${values[0]}`)
    .join('&')}`;
  const hashes = ['', '#', everything, everything.slice(1), '#unknown=1&atlas=hcp-mmp', '#%zz=1'];
  for (const seed of SEEDS.concat(SEEDS.map((value) => value + 100))) {
    const rand = prng(seed);
    const parts: string[] = [];
    for (let index = 0, count = 1 + below(rand, 9); index < count; index += 1) {
      const param = pick(rand, Object.keys(POOL));
      parts.push(`${param}=${encodeURIComponent(pick(rand, POOL[param]!)).replaceAll('%3A', ':')}`);
      if (rand() < 0.1) parts.push(`${param}=${pick(rand, POOL[param]!)}`);
    }
    hashes.push(`#${parts.join('&')}`);
  }
  return hashes;
}

const KNOWN: KnownLinkIds = {
  atlases: new Set(['destrieux', 'hcp-mmp']),
  details: new Set(['aseg', 'nextbrain', 'learning']),
  cutAtlases: new Set(['destrieux', 'hcp-mmp', 'nextbrain']),
  views: new Set(['oblique', 'left', 'right', 'anterior', 'posterior', 'superior', 'inferior']),
  explorers: new Set(['anatomy', 'functions', 'deficits', 'circuits', 'diffusion']),
  surfaceColors: new Set(['tissue', 'mri', 'atlas', 'network', 'cab-np']),
  regions: new Map([
    ['destrieux:left:29', { kind: 'cortex' }],
    ['aseg:left:17', { kind: 'structure' }],
    ['destrieux:left:medial-wall', { kind: 'non-region' }],
  ]),
  functions: new Set(['all', 'language']),
  deficits: new Set(['aphasia']),
  circuits: new Map([['visual', 4]]),
  spinalCord: false,
};

describe('url-state', () => {
  test('DEFAULTS and PARAMS are the legacy tables', () => {
    same(DEFAULTS, legacyDefaults, 'DEFAULTS');
    same(PARAMS, legacyParams, 'PARAMS');
  });

  test('decodeState gives the same state and rejections over the link corpus and fuzzed hashes', () => {
    for (const hash of hashCorpus()) {
      same(
        outcome(() => decodeState(hash)),
        outcome(() => legacyDecode(hash)),
        `decode ${hash}`,
      );
    }
  });

  test('decodeState refuses a non-string as the legacy does', () => {
    for (const value of [undefined, null, 5, {}]) {
      same(
        outcome(() => decodeState(value as never)),
        outcome(() => legacyDecode(value)),
        String(value),
      );
    }
  });

  test('encodeState(decodeState(h)) writes the same hash body, and it reads back unchanged', () => {
    for (const hash of hashCorpus()) {
      const { state } = decodeState(hash);
      const written = encodeState(state as never);
      same(written, legacyEncode(legacyDecode(hash).state), `encode ${hash}`);
      same(decodeState(written).state, legacyDecode(written).state, `reread ${written}`);
    }
  });

  test('encodeState writes selected regions given as records, hidden sets and non-default numbers', () => {
    for (const seed of SEEDS) {
      const rand = prng(seed);
      const state: Any = {
        selectedRegion: rand() < 0.5 ? { id: 'destrieux:left:29' } : 'destrieux:left:29',
        isolatedRegion: rand() < 0.5 ? null : 'aseg:left:17',
        hiddenRegions: new Set(rand() < 0.5 ? [] : ['b', 'a', 'c:d']),
        cutOffset: (rand() - 0.5) * 300,
        cortexOpacity: rand(),
        circuitStep: below(rand, 6),
        mriWindow: { center: rand() * 255, width: 1 + rand() * 255 },
        orbit: {
          position: [rand() * 100, rand() * 100, rand() * 100],
          target: [rand(), rand(), rand()],
          ...(rand() < 0.5 ? { up: [0, 0.6, 0.8] } : {}),
        },
        cutReverse: rand() < 0.5,
        lang: pick(rand, ['en', 'fr']),
      };
      same(encodeState(state), legacyEncode(state), `seed ${seed}`);
    }
  });

  test('towardZero agrees over seeded values, tenths, and float errors short of a tenth', () => {
    const values = [
      0, -0, 0.1, -0.1, 0.3, 0.30000000000000004, 0.299999999, 1.15, -1.15, 12.349999999999,
    ];
    for (const seed of SEEDS) {
      const rand = prng(seed);
      values.push(
        (rand() - 0.5) * 600,
        Math.round((rand() - 0.5) * 6000) / 10,
        (rand() - 0.5) * 1e-5,
      );
    }
    for (const value of values) {
      assert.ok(Object.is(towardZero(value), legacyTowardZero(value)), `towardZero(${value})`);
    }
  });

  test('orbitWithin agrees over seeded cameras at, inside and beyond the limit', () => {
    for (const seed of SEEDS) {
      const rand = prng(seed);
      const limit = 50 + rand() * 500;
      const direction = [rand() - 0.5, rand() - 0.5, rand() - 0.5];
      const length = Math.hypot(...direction);
      const target = [rand() * 10, rand() * 10, rand() * 10];
      for (const distance of [0, limit - 0.01, limit, limit + 0.17, limit + 0.18, limit * 2]) {
        const position = target.map(
          (value, axis) => value + (direction[axis]! / length) * distance,
        );
        const camera = { position, target };
        same(
          orbitWithin(camera as never, limit),
          legacyOrbitWithin(camera, limit),
          `seed ${seed} d ${distance}`,
        );
      }
    }
  });
});

describe('link-check', () => {
  test('checkLink rejects and keeps the same fields over the link corpus, with and without a cord', () => {
    for (const hash of hashCorpus()) {
      for (const spinalCord of [true, false]) {
        const known = { ...KNOWN, spinalCord };
        const link = decodeState(hash).state;
        same(
          checkLink(link, known),
          legacyCheckLink(legacyDecode(hash).state, known),
          `${hash} cord=${spinalCord}`,
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------------------------

describe('session', () => {
  const VIEWS = ['oblique', 'left', 'right'];
  const model = { atlas: 'destrieux', selectedRegion: null };
  const actions: ((s: Any, rand: Rand) => unknown)[] = [
    (s, r) => s.setView(pick(r, ['left', 'right', 'sideways'])),
    (s, r) => s.setQuery(pick(r, ['', 'a', 'putamen'])),
    (s, r) =>
      s.setExplorer(pick(r, ['anatomy', 'functions', 'deficits', 'circuits', 'diffusion', 'x'])),
    (s) => s.setFunctionQuery('q'),
    (s, r) => s.setFunction(pick(r, ['all', 'language', null])),
    (s) => s.setClinicalQuery('c'),
    (s, r) => s.setDeficit(pick(r, ['aphasia', null])),
    (s, r) => s.setFinding(pick(r, ['naming', null])),
    (s) => s.liftPaint(),
    (s, r) => s.toggleGroup(pick(r, ['F', 'T', 'P'])),
    (s, r) => s.setExpanded(r() < 0.5 ? [] : ['F', 'T']),
    (s, r) => s.setTheme(pick(r, ['light', 'dark'])),
    (s, r) => s.setLang(pick(r, ['en', 'fr', 'zz'])),
    (s, r) => s.setStatus(pick(r, ['loading', 'ready'])),
    (s, r) => s.setProgress(pick(r, [null, { loaded: 1, total: 2 }])),
    (s, r) => s.setSwitching(pick(r, [null, { loaded: 2, total: 4 }])),
    (s) => s.endSwitching(),
    (s) => s.setError(new Error('boom')),
    (s) => s.setContextLost(),
    (s, r) =>
      s.notify(
        pick(r, [
          null,
          { text: 'A' },
          { text: 'B', action: 'reload' },
          { text: 'A', action: 'see-through' },
          'bare',
          {},
        ]),
      ),
    (s) => s.holdNotices(),
    (s, r) => s.releaseNotices(pick(r, [null, { text: 'lead' }, undefined])),
  ];

  test('every action over seeded sequences leaves the same snapshot, return value and error', () => {
    for (const seed of SEEDS) {
      const rand = prng(seed);
      const ours = createSession({ views: VIEWS, theme: 'light', lang: seed % 3 ? 'fr' : 'xx' });
      const theirs = legacySession({ views: VIEWS, theme: 'light', lang: seed % 3 ? 'fr' : 'xx' });
      let depth = 0;
      for (let step = 0; step < 40; step += 1) {
        let index = below(rand, actions.length);
        // An unbalanced release corrupts the legacy hold count; the new session refuses it outright.
        if (index === actions.length - 1 && depth === 0) index = 0;
        if (index === actions.length - 2) depth += 1;
        if (index === actions.length - 1) depth -= 1;
        const a = prng(seed * 1000 + step);
        const b = prng(seed * 1000 + step);
        const got = outcome(() => actions[index]!(ours, a));
        const want = outcome(() => actions[index]!(theirs, b));
        same(got, want, `seed ${seed} step ${step} action ${index}`);
        same(ours.assemble(model), theirs.assemble(model), `seed ${seed} step ${step} snapshot`);
      }
    }
  });

  test('shortcutsAllowed agrees for every element kind and key', () => {
    const targets = [
      null,
      undefined,
      {},
      { isContentEditable: true },
      { tagName: 'TEXTAREA' },
      { tagName: 'SELECT' },
      { tagName: 'BUTTON' },
      { tagName: 'INPUT' },
      { tagName: 'INPUT', type: 'range' },
      ...[
        'text',
        'search',
        'email',
        'number',
        'password',
        'tel',
        'url',
        'checkbox',
        'radio',
        'button',
      ].map((type) => ({ tagName: 'INPUT', type })),
    ];
    for (const target of targets) {
      for (const key of [undefined, 'a', 'ArrowLeft', 'Home', 'PageDown', '3']) {
        same(
          shortcutsAllowed(target, key),
          legacyShortcuts(target, key),
          `${inspect(target)} ${key}`,
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Link writer
// ---------------------------------------------------------------------------------------------

describe('link-writer', () => {
  /** A seeded script of schedule/hold/release/cancel and time passing, as the writes it produced. */
  function run(make: (write: () => void, delay?: number) => Any, seed: number) {
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const rand = prng(seed);
    const log: string[] = [];
    const writer = make(() => log.push(`write@${Date.now()}`), seed % 2 ? undefined : 100);
    const live = [{ on: true }, { on: false }];
    const checks = live.map((flag) => () => flag.on);
    for (let step = 0; step < 40; step += 1) {
      const action = below(rand, 7);
      const which = below(rand, 2);
      if (action === 0 || action === 1) writer.schedule();
      else if (action === 2) writer.hold(checks[which]);
      else if (action === 3) writer.release(checks[which]);
      else if (action === 4) writer.cancel();
      else if (action === 5) live[which]!.on = !live[which]!.on;
      else vi.advanceTimersByTime(below(rand, 400));
    }
    vi.advanceTimersByTime(1000);
    vi.useRealTimers();
    return log.map((entry) => entry.replace(/@.*/, ''));
  }

  test('writes land at the same moments over seeded schedule, hold, release and cancel scripts', () => {
    for (const seed of SEEDS) {
      same(run(createLinkWriter, seed).length, run(legacyLinkWriter, seed).length, `seed ${seed}`);
    }
  });

  test('sameSubject agrees with an omitted, matching and different anatomy', () => {
    for (const link of [{}, { anatomy: 'cdmd' }, { anatomy: 'other' }, { anatomy: null }]) {
      for (const shown of ['cdmd', 'other']) {
        same(
          sameSubject(link, shown, 'cdmd'),
          legacySameSubject(link, shown, 'cdmd'),
          inspect(link),
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Internal mode, boot, dissection
// ---------------------------------------------------------------------------------------------

describe('internal-mode', () => {
  test('capture, inside and leave agree over every combination of colour, detail and atlas', () => {
    const colours = ['tissue', 'mri', 'atlas', 'network', 'cab-np', 'functional'];
    const required = { 'cab-np': 'hcp-mmp', functional: 'hcp-mmp' };
    for (const colour of colours) {
      for (const detail of ['destrieux', 'learning', 'nextbrain']) {
        for (const atlas of ['destrieux', 'hcp-mmp']) {
          const before = { surfaceColor: colour, detail: 'destrieux', atlas: 'hcp-mmp' };
          const inside = { cortexVisible: false, surfaceColor: 'atlas', detail, atlas };
          same(insideInternal(inside), legacyInside(inside), 'inside');
          same(insideInternal(before as never), legacyInside(before), 'inside before');
          const entered = captureBeforeInternal(before as never, 'learning');
          same(entered, legacyCapture(before, 'learning'), 'capture');
          for (const claim of [undefined, required]) {
            for (const entry of [entered, null, undefined]) {
              same(
                leaveInternal(entry, inside as never, claim),
                legacyLeave(entry, inside, claim),
                `${colour} ${detail} ${atlas}`,
              );
            }
          }
        }
      }
    }
  });
});

describe('boot', () => {
  test('startLanguage prefers the link, then the saved choice, then English', () => {
    for (const hash of ['', '#lang=fr', '#lang=en', '#lang=de', '#lang=en&lang=fr', '#atlas=x']) {
      for (const saved of ['fr', 'en', 'de', null]) {
        same(startLanguage(hash, saved), legacyStartLanguage(hash, saved), `${hash} ${saved}`);
      }
    }
  });

  test('prefetchAtlas agrees across GPU, data-saver and connection types', () => {
    const atlases = [{ id: 'destrieux' }, { id: 'hcp-mmp' }, { id: 'extra' }];
    const connections = [
      undefined,
      {},
      { saveData: true },
      { effectiveType: '4g' },
      { effectiveType: '3g' },
      { effectiveType: '2g' },
      { effectiveType: 'slow-2g' },
      { saveData: false, effectiveType: '4g' },
    ];
    for (const shown of ['destrieux', 'hcp-mmp', 'none']) {
      for (const prefetchLayers of [true, false]) {
        for (const connection of connections) {
          same(
            prefetchAtlas(atlases, shown, { prefetchLayers, connection }),
            legacyPrefetch(atlases, shown, { prefetchLayers, connection }),
            `${shown} ${prefetchLayers} ${inspect(connection)}`,
          );
        }
      }
    }
    same(
      prefetchAtlas([{ id: 'a' }], 'a', { prefetchLayers: true, connection: undefined }),
      legacyPrefetch([{ id: 'a' }], 'a', { prefetchLayers: true, connection: undefined }),
      'only one',
    );
  });
});

describe('dissection', () => {
  test('hide, show, restore, undo, load and reset agree over seeded sequences, errors included', () => {
    const regions = new Map(['a', 'b', 'c', 'd', 'e'].map((id) => [id, {}]));
    for (const seed of SEEDS) {
      const rand = prng(seed);
      const ours = createDissection(regions);
      const theirs = legacyDissection(regions);
      for (let step = 0; step < 40; step += 1) {
        const ids = Array.from({ length: below(rand, 4) }, () =>
          pick(rand, ['a', 'b', 'c', 'd', 'e', 'zz']),
        );
        const context = { step };
        const call = (d: Any) =>
          [
            () => d.hide(ids, context),
            () => d.show(ids, context),
            () => d.restore(context),
            () => d.undo(),
            () => d.load(ids),
            () => d.reset(),
            () => d.hide('a', context),
          ][seed % 7 === 0 && step === 3 ? 6 : step % 6]!();
        same(
          outcome(() => call(ours)),
          outcome(() => call(theirs)),
          `seed ${seed} step ${step}`,
        );
        same(ours.state, theirs.state, `seed ${seed} step ${step} state`);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Reader state
// ---------------------------------------------------------------------------------------------

describe('reader-state', () => {
  const LOADED = { atlas: 'destrieux', detail: 'aseg', cutAtlas: 'nextbrain' };

  test('readerState fills every absent field the same way over seeded partials', () => {
    for (const seed of SEEDS) {
      const rand = prng(seed);
      const partial: Any = {};
      for (const key of Object.keys(DEFAULTS)) {
        if (rand() < 0.5) continue;
        partial[key] =
          key === 'selectedRegion' || key === 'isolatedRegion'
            ? pick(rand, [{ id: 'r' }, 'r', null])
            : (DEFAULTS as Any)[key];
      }
      if (rand() < 0.5) partial.hiddenRegions = pick(rand, [['a', 'b'], new Set(['c']), []]);
      if (rand() < 0.5) partial.camera = pick(rand, ['cut', { pose: 1 }]);
      if (rand() < 0.5)
        Object.assign(partial, { atlas: 'hcp-mmp', detail: 'learning', cutAtlas: 'destrieux' });
      same(
        outcome(() => readerState(partial, LOADED)),
        outcome(() => legacyReaderState(partial, LOADED)),
        `seed ${seed}`,
      );
    }
  });

  test('readerState refuses a scene with no atlas, detail or cut atlas, as the legacy does', () => {
    for (const missing of ['atlas', 'detail', 'cutAtlas']) {
      const loaded = { ...LOADED, [missing]: '' };
      same(
        outcome(() => readerState({}, loaded)),
        outcome(() => legacyReaderState({}, loaded)),
        missing,
      );
    }
  });

  test('sameRegions compares sets by membership', () => {
    const sets = [
      new Set<string>(),
      new Set(['a']),
      new Set(['a', 'b']),
      new Set(['b', 'a']),
      new Set(['c', 'a']),
    ];
    for (const a of sets)
      for (const b of sets) same(sameRegions(a, b), legacySameRegions(a, b), 'sets');
  });

  /** A model, sections and commands that log every call; one is built per implementation. */
  function restoration(target: Any, seed: number, failing: string | null) {
    const rand = prng(seed);
    const events: unknown[] = [];
    const log = (name: string, ...args: unknown[]) => events.push([name, ...args]);
    const settings: Any = {
      ...target,
      atlas: pick(rand, ['destrieux', target.atlas]),
      hiddenRegions: new Set(),
      cortexOpacity: 1,
    };
    const stage = (name: string) => {
      if (name === failing) throw new Error(`fail ${name}`);
    };
    const model: Any = {
      settings,
      state: { selectedRegion: null },
      setInternalSystem: (value: unknown) => {
        stage('system');
        log('system', value);
        settings.internalSystem = value;
      },
      setHemisphere: (value: unknown) => {
        stage('hemi');
        log('hemisphere', value);
        settings.hemisphere = value;
      },
      setCortexVisible: (value: unknown) => {
        log('cortex', value);
        settings.cortexVisible = value;
      },
      setInternalVisible: (value: unknown) => {
        log('internal', value);
        settings.internalVisible = value;
      },
      setCortexOpacity: (value: unknown) => {
        log('opacity', value);
        settings.cortexOpacity = value;
      },
      setFunctionalLevel: (value: unknown) => {
        log('level', value);
        settings.functionalLevel = value;
      },
      loadHiddenRegions: (ids: unknown) => {
        stage('hidden');
        log('hidden', ids);
        settings.hiddenRegions = new Set(ids as string[]);
      },
      select: (id: string | null) => {
        stage('region');
        log('select', id);
        model.state.selectedRegion = id ? { id } : null;
      },
      isolate: () => {
        log('isolate');
        settings.isolatedRegion = model.state.selectedRegion.id;
      },
      clearIsolation: () => {
        log('clearIsolation');
        settings.isolatedRegion = null;
      },
    };
    const sections: Any = {
      state: { cutAtlas: 'destrieux' },
      active: rand() < 0.5,
      display: rand() < 0.5 ? null : { windowCenter: 60, windowWidth: 120 },
      publishedWindow: rand() < 0.5 ? null : { center: 60, width: 120 },
      volumes: null,
      setCutAtlas: async (value: unknown) => {
        log('cutAtlas', value);
        sections.state.cutAtlas = value;
      },
      setMode: async (mode: unknown) => {
        log('mode', mode);
        sections.active = mode !== 'off';
      },
      setAngles: (...args: unknown[]) => log('angles', ...args),
      setDisplay: (value: unknown) => log('display', value),
      setOffset: (value: number) => {
        if (Math.abs(value) > 100) throw new RangeError('range');
        log('offset', value);
      },
      load: async () => log('load'),
      setWindow: (...args: unknown[]) => log('window', ...args),
    };
    if (sections.publishedWindow) {
      sections.volumes = { metadata: { display: { window_center: 60, window_width: 120 } } };
    }
    const commands = {
      loadAtlas: async (id: string) => {
        stage('atlas');
        log('atlas', id);
        settings.atlas = id;
      },
      loadDetail: async (id: string) => {
        log('detail', id);
        settings.detail = id;
      },
      showSpinalCord: async (visible: boolean) => {
        log('cord', visible);
        settings.spinalCordVisible = visible;
        return true;
      },
      applySurfaceColor: async (value: string) => {
        log('colour', value);
        settings.surfaceColor = value;
        return true;
      },
      cut: async (mode: string) => {
        log('cutting', mode);
        sections.active = mode !== 'off';
        return true;
      },
    };
    let alive = true;
    const overtakeAfter = seed % 5 === 0 ? 8 : Infinity;
    let checks = 0;
    const current = () => {
      checks += 1;
      if (checks > overtakeAfter) alive = false;
      return alive;
    };
    return {
      events,
      model,
      sections,
      commands,
      current,
      applyCamera: (t: Any) => log('camera', t.camera),
      applyOrbit: (orbit: unknown) => log('orbit', orbit),
      revealInTree: (id: string) => log('tree', id),
    };
  }

  test('applyReaderState runs the same steps in the same order over seeded targets', async () => {
    for (const seed of SEEDS) {
      const rand = prng(seed + 700);
      const partial: Any = {
        atlas: pick(rand, ['destrieux', 'hcp-mmp']),
        detail: pick(rand, ['aseg', 'learning']),
        cutAtlas: pick(rand, ['destrieux', 'nextbrain']),
        hemisphere: pick(rand, ['both', 'left']),
        cortexVisible: rand() < 0.5,
        internalVisible: rand() < 0.5,
        spinalCordVisible: rand() < 0.5,
        cortexOpacity: pick(rand, [1, 0.5]),
        hiddenRegions: rand() < 0.5 ? ['a'] : [],
        functionalLevel: pick(rand, ['named', 'sections']),
        surfaceColor: pick(rand, ['atlas', 'tissue']),
        cut: pick(rand, ['off', 'sagittal', 'oblique']),
        cutOffset: pick(rand, [0, 12.5, 500]),
        cutReverse: rand() < 0.5,
        isolatedRegion: pick(rand, [null, 'r1']),
        selectedRegion: pick(rand, [null, 'r2']),
        mriWindow: pick(rand, [null, { center: 60, width: 120 }, { center: 70, width: 100 }]),
        orbit: pick(rand, [null, { position: [1, 2, 3], target: [0, 0, 0] }]),
        internalSystem: pick(rand, [null, 'limbic']),
        camera: pick(rand, ['view', 'cut']),
      };
      const failing = pick(rand, [null, null, 'atlas', 'system', 'hemi', 'hidden', 'region']);
      const target = readerState(partial, {
        atlas: 'destrieux',
        detail: 'aseg',
        cutAtlas: 'nextbrain',
      });
      const legacyTarget = legacyReaderState(partial, {
        atlas: 'destrieux',
        detail: 'aseg',
        cutAtlas: 'nextbrain',
      });
      const ours = restoration(target, seed, failing);
      const theirs = restoration(legacyTarget, seed, failing);
      const gotFailures = await applyReaderState(target, ours as never);
      const wantFailures = await legacyApply(legacyTarget, theirs);
      same(ours.events, theirs.events, `seed ${seed} calls`);
      same(
        gotFailures.map(({ fields, error }) => [fields, (error as Error).message]),
        wantFailures.map(({ fields, error }: Any) => [fields, error.message]),
        `seed ${seed} failures`,
      );
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Paint
// ---------------------------------------------------------------------------------------------

describe('paint', () => {
  const manifest = readModel<Manifest>('cdmd/manifest.json');
  const regionsById = new Map(manifest.regions.map((region) => [region.id, region]));
  const load = <T>(path: string) => readModel<T>(`cdmd/${path}`);
  const ours = domains.validateNeuropsychDomains(
    load<NeuropsychDomains>(manifest.neuropsych_domains!.file),
    regionsById,
    load<NeurosynthTerms>(manifest.neurosynth_terms!.file),
  );
  const theirs = legacyDomains.validateNeuropsychDomains(
    load<NeuropsychDomains>(manifest.neuropsych_domains!.file),
    regionsById,
    load<NeurosynthTerms>(manifest.neurosynth_terms!.file) as never,
  );
  const data = readRepoYaml<ClinicalData>('data/neuropsychology.yaml');
  const clinical = createClinicalCatalog(data, manifest);
  const legacyCatalog = legacyClinical(data, manifest);
  const functionIds = [
    domains.ALL_DOMAINS,
    ...ours.domains.map((domain) => domain.id),
    ...[...ours.search!.terms.keys()].slice(0, 12),
  ];

  /** The state the tab shows, with its paint put on as the model would. */
  function states(lang: 'en' | 'fr') {
    const list: Any[] = [];
    for (const selectedFunction of functionIds) {
      for (const atlas of [ours.atlas, 'destrieux']) {
        list.push({
          explorer: 'functions',
          selectedFunction,
          atlas,
          paintLifted: false,
          lang,
          selectedDeficit: null,
          selectedFinding: null,
        });
      }
    }
    for (const deficit of data.deficits) {
      const findings = legacyCatalog.paint(deficit.id).findings;
      for (const finding of [null, ...findings.map(({ association }: Any) => association.id)]) {
        list.push({
          explorer: 'deficits',
          selectedDeficit: deficit.id,
          selectedFinding: finding,
          atlas: 'destrieux',
          paintLifted: false,
          lang,
          selectedFunction: null,
        });
      }
    }
    list.push({
      explorer: 'anatomy',
      atlas: 'destrieux',
      paintLifted: false,
      lang,
      selectedFunction: 'all',
      selectedDeficit: null,
    });
    list.push({
      explorer: 'functions',
      selectedFunction: 'all',
      atlas: ours.atlas,
      paintLifted: true,
      lang,
    });
    list.push({
      explorer: 'deficits',
      selectedDeficit: data.deficits[0]!.id,
      atlas: 'x',
      paintLifted: true,
      lang,
    });
    return list;
  }

  test('paintFor and paintKind agree for every function, deficit and finding', () => {
    for (const state of states('en')) {
      const got = paintFor(state as never, { domains: ours, clinical });
      same(
        got,
        legacyPaintFor(state, { domains: theirs, clinical: legacyCatalog }),
        inspect(state),
      );
      same(paintKind(got), legacyPaintKind(got), 'kind');
    }
    same(
      [paintKind(null), paintKind(undefined)],
      [legacyPaintKind(null), legacyPaintKind(undefined)],
      'null kinds',
    );
  });

  test('legendFor agrees in both languages, with every region drawn, half drawn and none', () => {
    for (const lang of ['en', 'fr'] as const) {
      for (const state of states(lang)) {
        const paint = paintFor(state as never, { domains: ours, clinical });
        const shown = { ...state, paint };
        for (const mode of ['all', 'none', 'half']) {
          const drawn = (region: string) =>
            mode === 'all' || (mode === 'half' && region.length % 2 === 0);
          same(
            legendFor(shown as never, { domains: ours, clinical, drawn }),
            legacyLegendFor(shown, { domains: theirs, clinical: legacyCatalog, drawn }),
            `${lang} ${state.selectedFunction ?? state.selectedDeficit}/${state.selectedFinding} ${mode}`,
          );
        }
      }
    }
  }, 30_000);
});

// ---------------------------------------------------------------------------------------------
// Scene commands
// ---------------------------------------------------------------------------------------------

describe('scene-commands', () => {
  const REGIONS = [
    { id: 'destrieux:left:12', atlas: 'destrieux', kind: 'cortex', hemisphere: 'left' },
    { id: 'hcp-mmp:left:44', atlas: 'hcp-mmp', kind: 'cortex', hemisphere: 'left' },
    { id: 'aseg:left:11', atlas: 'aseg', kind: 'structure', hemisphere: 'left' },
    { id: 'nextbrain:left:458', atlas: 'nextbrain', kind: 'structure', hemisphere: 'left' },
  ];
  const LAYERS = ['destrieux', 'hcp-mmp', 'aseg', 'nextbrain', 'envelopes', 'zanatomy', 'mri'];

  /**
   * One model that answers to both vocabularies (the legacy `layers`, `envelopes`,
   * `spinalCordLoadState` and the contract's `hasLayer`, `envelopesLoaded`, `spinalCordLoad`),
   * with BrainAtlas's own request rule and downloads that finish on demand.
   */
  function scene(seed: number) {
    const cord = seed % 4 !== 0;
    const pending = new Map<
      string,
      {
        resolve: () => void;
        reject: (e: Error) => void;
        promise: Promise<void>;
        progress?: (p: unknown) => void;
      }
    >();
    const events: unknown[] = [];
    const layers = new Map<string, object>([
      ['hcp-mmp', {}],
      ['aseg', {}],
    ]);
    const model: Any = {
      disposed: false,
      manifest: { supplemental_layers: cord ? [{ id: 'zanatomy' }] : [] },
      envelopes: null,
      spinalCordLoadState: 'unloaded',
      layers,
      regions: new Map(REGIONS.map((region) => [region.id, region])),
      cabNp: { atlas: 'hcp-mmp' },
      functionalRegions: { atlas: 'hcp-mmp' },
      atlasId: 'hcp-mmp',
      detailId: 'aseg',
      surfaceColor: 'atlas',
      internalVisible: true,
      atlasRequest: 0,
      detailRequest: 0,
      get settings() {
        return {
          atlas: this.atlasId,
          detail: this.detailId,
          surfaceColor: this.surfaceColor,
          cortexOpacity: 1,
          internalVisible: this.internalVisible,
        };
      },
      hasLayer(id: string) {
        return this.layers.has(id);
      },
      get envelopesLoaded() {
        return Boolean(this.envelopes);
      },
      get spinalCordLoad() {
        return this.spinalCordLoadState;
      },
      load(id: string, progress?: (p: unknown) => void) {
        if (this.layers.has(id)) return Promise.resolve();
        if (!pending.has(id)) {
          const entry: Any = { progress };
          entry.promise = new Promise<void>((resolve, reject) =>
            Object.assign(entry, { resolve, reject }),
          );
          pending.set(id, entry as never);
        }
        return pending.get(id)!.promise;
      },
      async setAtlas(id: string, progress?: (p: unknown) => void) {
        events.push(['setAtlas', id, typeof progress]);
        const request = ++this.atlasRequest;
        await this.load(id, progress);
        if (request !== this.atlasRequest) return;
        this.atlasId = id;
        if (this.surfaceColor === 'cab-np' && id !== 'hcp-mmp') this.surfaceColor = 'atlas';
      },
      async setDetail(id: string, progress?: (p: unknown) => void) {
        events.push(['setDetail', id, typeof progress]);
        const request = ++this.detailRequest;
        await this.load(id, progress);
        if (request !== this.detailRequest) return;
        this.detailId = id;
      },
      async ensureEnvelopes(progress?: (p: unknown) => void) {
        events.push(['envelopes', typeof progress]);
        if (this.envelopes) return;
        await this.load('envelopes', progress);
        this.envelopes = [];
      },
      async ensureSpinalCord(progress?: (p: unknown) => void) {
        events.push(['ensureCord', typeof progress]);
        await this.load('zanatomy', progress);
        this.spinalCordLoadState = 'ready';
      },
      async setSpinalCordVisible(visible: boolean, progress?: (p: unknown) => void) {
        events.push(['cord', visible, typeof progress]);
        if (visible) await this.ensureSpinalCord(progress);
      },
      clearIsolation: () => events.push(['clearIsolation']),
      setInternalSystem: (value: unknown) => events.push(['system', value]),
      setHemisphere: (value: unknown) => events.push(['hemisphere', value]),
      setCortexVisible: (value: unknown) => events.push(['cortex', value]),
      setCortexOpacity: (value: unknown) => events.push(['opacity', value]),
      setInternalVisible(value: boolean) {
        events.push(['internal', value]);
        this.internalVisible = value;
      },
      showRegions: (ids: unknown) => events.push(['show', ids]),
      select: (id: string) => events.push(['select', id]),
    };
    const sections: Any = {
      mode: 'off',
      appearanceRequest: 0,
      get solidsReady() {
        return Boolean(model.envelopes);
      },
      async setMode(mode: string) {
        events.push(['mode', mode]);
        if (mode !== 'off') await model.ensureEnvelopes();
        this.mode = mode;
      },
      async setSurfaceColor(value: string, current: () => boolean = () => true) {
        events.push(['colour', value]);
        const request = ++this.appearanceRequest;
        if (value === 'cab-np' && model.atlasId !== 'hcp-mmp')
          throw new Error('CAB-NP needs HCP-MMP first');
        if (value === 'functional') await model.ensureEnvelopes();
        if (value === 'mri') await model.load('mri');
        if (request !== this.appearanceRequest || !current()) return;
        model.surfaceColor = value;
      },
    };
    const session = (make: typeof createSession | typeof legacySession) =>
      make({ views: ['oblique'] } as never);
    return { model, sections, events, pending, layers, session };
  }

  type Op = [string, ...unknown[]];
  /** A seeded script of commands and download events, as the drawn operations. */
  function script(seed: number): Op[] {
    const rand = prng(seed);
    const ops: Op[] = [];
    for (let step = 0; step < 14; step += 1) {
      const kind = below(rand, 12);
      if (kind === 0) ops.push(['chooseAtlas', pick(rand, ['destrieux', 'hcp-mmp', 'nope'])]);
      else if (kind === 1) ops.push(['chooseDetail', pick(rand, ['aseg', 'nextbrain'])]);
      else if (kind === 2)
        ops.push([
          'chooseSurfaceColor',
          pick(rand, ['functional', 'mri', 'cab-np', 'atlas', 'tissue', 'network']),
        ]);
      else if (kind === 3)
        ops.push([
          'openRegion',
          pick(
            rand,
            REGIONS.map((region) => region.id),
          ),
        ]);
      else if (kind === 4)
        ops.push([
          'revealRegions',
          pick(rand, [
            [],
            ['destrieux:left:12', 'nextbrain:left:458'],
            ['hcp-mmp:left:44'],
            ['aseg:left:11', 'nextbrain:left:458', 'nextbrain:left:458'],
          ]),
        ]);
      else if (kind === 5) ops.push(['cut', pick(rand, ['off', 'axial', 'coronal'])]);
      else if (kind === 6) ops.push(['showSpinalCord', rand() < 0.7]);
      else if (kind === 7) ops.push(['lang', pick(rand, ['en', 'fr'])]);
      else if (kind === 8) ops.push(['tick', pick(rand, LAYERS), 1 + below(rand, 5), 8]);
      else if (kind === 9) ops.push(['fail', pick(rand, LAYERS)]);
      else ops.push(['finish', pick(rand, LAYERS)]);
    }
    for (const id of LAYERS) ops.push(['finish', id]);
    return ops;
  }

  async function play(
    make: typeof createSceneCommands | typeof legacySceneCommands,
    makeSession: typeof createSession | typeof legacySession,
    seed: number,
  ) {
    const fake = scene(seed);
    const session = fake.session(makeSession) as Any;
    session.setStatus('ready');
    let renders = 0;
    const commands = (make as unknown as (options: Any) => Any)({
      model: fake.model,
      sections: fake.sections,
      session,
      render: () => {
        renders += 1;
      },
    }) as Any;
    const settle = () => new Promise((resolve) => setImmediate(resolve));
    const trace: unknown[] = [];
    const running: Promise<unknown>[] = [];
    const view = () => {
      const { status, progress, notice, lang } = session.assemble({});
      return {
        status,
        progress,
        notice,
        lang,
        renders,
        atlas: fake.model.atlasId,
        detail: fake.model.detailId,
        colour: fake.model.surfaceColor,
        mode: fake.sections.mode,
      };
    };
    for (const [name, ...args] of script(seed)) {
      if (name === 'lang') session.setLang(args[0]);
      else if (name === 'tick')
        fake.pending.get(args[0] as string)?.progress?.({ loaded: args[1], total: args[2] });
      else if (name === 'fail' || name === 'finish') {
        const entry = fake.pending.get(args[0] as string);
        if (entry) {
          fake.pending.delete(args[0] as string);
          if (name === 'finish') {
            fake.layers.set(args[0] as string, {});
            entry.resolve();
          } else
            entry.reject(Object.assign(new Error(`download ${args[0]}`), { code: 'asset-fetch' }));
        }
      } else {
        const takesIntent = [
          'loadAtlas',
          'loadDetail',
          'cut',
          'showSpinalCord',
          'revealRegions',
          'openRegion',
        ].includes(name);
        running.push(
          outcomeAsync(() =>
            commands[name](...args, ...(takesIntent ? [commands.begin()] : [])),
          ).then((result) => trace.push([name, args, result])),
        );
      }
      await settle();
      trace.push(view());
    }
    // Finishing a download can start the next one a command was waiting to ask for, so drain in rounds.
    for (let round = 0; round < 20; round += 1) {
      for (const [id, entry] of fake.pending) {
        fake.pending.delete(id);
        fake.layers.set(id, {});
        entry.resolve();
      }
      await settle();
    }
    await Promise.all(running);
    trace.push(view(), fake.events);
    return trace;
  }

  test('commands, notices and download progress run the same sequences against the same fake', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    onTestFinished(() => {
      error.mockRestore();
    });
    const reached = {
      switching: false,
      progress: false,
      notice: false,
      action: false,
      overtaken: false,
    };
    for (const seed of SEEDS) {
      const got = await play(createSceneCommands, createSession, seed);
      for (const entry of got as Any[]) {
        if (entry.status === 'switching') reached.switching = true;
        if (entry.progress) reached.progress = true;
        if (entry.notice) reached.notice = true;
        if (entry.notice?.action) reached.action = true;
        if (Array.isArray(entry) && entry[2]?.value === false) reached.overtaken = true;
      }
      const want = await play(legacySceneCommands, legacySession, seed);
      same(got.length, want.length, `seed ${seed} trace length`);
      for (let index = 0; index < got.length; index += 1)
        same(got[index], want[index], `seed ${seed} entry ${index}`);
    }
  }, 30_000);

  test('requiredAtlas and publishesSpinalCord agree for every colour and manifest', () => {
    const model = { cabNp: { atlas: 'hcp-mmp' }, functionalRegions: { atlas: 'hcp-fn' } };
    for (const colour of ['tissue', 'mri', 'atlas', 'network', 'cab-np', 'functional']) {
      same(
        requiredAtlas(model as never, colour as never),
        legacyRequiredAtlas(model, colour),
        colour,
      );
      same(
        requiredAtlas({ cabNp: null, functionalRegions: null } as never, colour as never),
        legacyRequiredAtlas({ cabNp: null, functionalRegions: null }, colour),
        `${colour} none`,
      );
    }
    for (const manifest of [
      {},
      { supplemental_layers: [] },
      { supplemental_layers: [{ id: 'zanatomy' }] },
      { supplemental_layers: [{ id: 'envelopes' }] },
    ]) {
      same(
        publishesSpinalCord(manifest as never),
        legacyPublishesCord(manifest),
        inspect(manifest),
      );
    }
  });
});
