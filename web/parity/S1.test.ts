import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { createCircuitSession as legacyLesson } from '../../viewer/learning/session.js';
import { createSession as legacySession } from '../../viewer/state/session.js';
import { createLessonStore, createSessionStore } from '../src/lib/state/session.svelte.ts';

/**
 * The reactive session and lesson stores against the legacy `createSession` and `createCircuitSession`,
 * driven by one seeded sequence of commands. After every command the two must agree on whether it threw
 * (and with what), on what it returned, and on the whole state.
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

const VIEWS = ['oblique', 'left', 'right', 'top'];
const WORDS = ['', 'gyrus', 'a', 'Précentral'];
const NOTICES = [null, { text: 'One.' }, { text: 'Two.', action: 'reload' }, { text: 'One.' }];

type Commands = Record<string, (...args: never[]) => unknown>;

function outcome(call: () => unknown) {
  try {
    return { returned: call() };
  } catch (error) {
    return { threw: (error as Error).constructor.name + ': ' + (error as Error).message };
  }
}

describe('S1 parity', () => {
  it('the session store agrees with createSession over seeded command sequences', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const random = seeded(seed);
      const options = { views: VIEWS, lang: pick(random, ['en', 'fr', 'de']) };
      const legacy = legacySession(options) as unknown as Commands & {
        assemble: (state: object) => object;
      };
      const store = createSessionStore(options) as unknown as Commands & {
        state: object;
      };
      const calls: [string, () => unknown[]][] = [
        ['setView', () => [pick(random, [...VIEWS, 'nowhere'])]],
        ['setQuery', () => [pick(random, WORDS)]],
        [
          'setExplorer',
          () => [pick(random, ['anatomy', 'functions', 'deficits', 'circuits', 'diffusion', 'x'])],
        ],
        ['setFunctionQuery', () => [pick(random, WORDS)]],
        ['setFunction', () => [pick(random, [null, 'all', 'language'])]],
        ['setClinicalQuery', () => [pick(random, WORDS)]],
        ['setDeficit', () => [pick(random, [null, 'aphasia'])]],
        ['setFinding', () => [pick(random, [null, 'naming'])]],
        ['liftPaint', () => []],
        ['toggleGroup', () => [pick(random, ['a', 'b', 'c'])]],
        ['setExpanded', () => [pick(random, [[], ['a'], ['a', 'b']])]],
        ['setTheme', () => [pick(random, ['light', 'dark'])]],
        ['setLang', () => [pick(random, ['en', 'fr', 'de'])]],
        ['setStatus', () => [pick(random, ['loading', 'ready', 'switching', 'error'])]],
        ['setProgress', () => [pick(random, [null, { loaded: 1, total: 4 }])]],
        ['setSwitching', () => [pick(random, [null, { loaded: 2, total: 4 }])]],
        ['endSwitching', () => []],
        ['setError', () => [new Error('boom')]],
        ['setContextLost', () => []],
        ['notify', () => [pick(random, [...NOTICES, { text: 3 }])]],
        ['holdNotices', () => []],
        ['releaseNotices', () => [pick(random, [null, { text: 'Lead.' }])]],
      ];
      let holds = 0;
      for (let step = 0; step < 400; step++) {
        const [name, draw] = pick(random, calls);
        // An unbalanced release fails differently by design (deviation c4-unbalanced-notice-release).
        if (name === 'releaseNotices' && holds === 0) continue;
        if (name === 'holdNotices') holds += 1;
        if (name === 'releaseNotices') holds -= 1;
        const args = draw();
        const expected = outcome(() => (legacy[name] as (...a: unknown[]) => unknown)(...args));
        const actual = outcome(() => (store[name] as (...a: unknown[]) => unknown)(...args));
        assert.deepStrictEqual(actual, expected, `seed ${seed} step ${step} ${name}`);
        assert.deepStrictEqual(
          store.state,
          legacy.assemble({}),
          `seed ${seed} step ${step} ${name}`,
        );
      }
    }
  });

  it('the lesson store agrees with createCircuitSession', () => {
    const catalog = { get: () => ({ steps: [{}, {}, {}, {}] }) };
    for (const seed of [1, 2, 3, 4]) {
      const random = seeded(seed);
      const legacy = legacyLesson(catalog);
      const store = createLessonStore(catalog as never);
      for (let step = 0; step < 200; step++) {
        const name = pick(random, ['start', 'close', 'go'] as const);
        const args =
          name === 'go' ? [pick(random, [-1, 0, 1, 2, 3, 4, 1.5])] : name === 'start' ? ['c'] : [];
        const expected = outcome(() => (legacy[name] as (...a: unknown[]) => unknown)(...args));
        const actual = outcome(() => (store[name] as (...a: unknown[]) => unknown)(...args));
        assert.deepStrictEqual(actual, expected, `seed ${seed} step ${step} ${name}`);
        assert.deepStrictEqual(store.state, legacy.snapshot(), `seed ${seed} step ${step} ${name}`);
      }
    }
  });
});
