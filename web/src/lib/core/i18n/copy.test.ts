import { expect, test } from 'vitest';
import { TRANSLATIONS } from './index.ts';

/**
 * I18N-04: the approved copy. Each language's table is written to a committed snapshot, every
 * function called at fixed arguments, so a change of wording shows up in review. Regenerate with
 * `vitest -u` only for a reviewed change of the record.
 */

/** Argument pools by parameter kind; the i-th call takes the (i + position)-th member of each. */
const POOLS = {
  s: ['Alpha', ''],
  n: [0, 1, 2, 183, 12345],
  b: [true, false],
  a: [['a', 'b'], ['one'], []],
  l: [null, '3.5'],
  o: [{ individual: true }, { individual: false }],
  d: [
    [1, 2, 3],
    [182, 218, 182],
  ],
} as const;

/** Parameter kinds of every function that takes anything but strings, by `area.leaf`. */
const KINDS: Record<string, string> = {
  'dissection.hiddenCount': 'n',
  'functional.section': 'n',
  'functional.contested': 'nn',
  'footer.colophon': 'sb',
  'footer.kind': 'b',
  'footer.sourceFiles': 'nb',
  'footer.visibleRegions': 'n',
  'comparison.more': 'n',
  'domains.band': 'sl',
  'domains.lesionCheck': 'a',
  'functions.areas': 'nns',
  'functions.areasShort': 'nn',
  'functions.coverage': 'nn',
  'functions.deepAmong': 'sssn',
  'functions.deficitBridge': 'ns',
  'functions.more': 'n',
  'functions.results': 'nn',
  'functions.termsMore': 'n',
  'mpr.note': 'o',
  'mpr.readout': 'ssn',
  'navigator.showingCapped': 'ns',
  'shortcuts.singleKeysNote': 'b',
  'clinical.evidenceKind': 'n',
  'clinical.deepMapped': 'sn',
  'clinical.otherMapped': 'n',
  'clinical.functionBridge': 'ns',
  'clinical.results': 'n',
  'clinical.regionsMarked': 'nnb',
  'circuits.landmarkCount': 'n',
  'circuits.coverage': 'nn',
  'circuits.step': 'nn',
  'circuits.stepShort': 'nn',
  'diffusion.matches': 'n',
  'diffusion.streamlines': 'nn',
  'diffusion.bundleCollection': 'n',
  'mri.grid': 'ds',
  'mri.dialog.grid': 'ds',
  'mri.dialog.range': 'n',
  'mri.dialog.moved': 'd',
  'viewport.loadingWithTotal': 'nn',
  'lesion.cited': 'sn',
};

type Fn = (...args: unknown[]) => unknown;

/** What a function says at the fixed arguments; a throw is recorded too. */
function sample(fn: Fn, path: string): string[] {
  const kinds = KINDS[path] ?? 's'.repeat(fn.length);
  const calls = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const args = [...kinds].map((kind, position) => {
      const pool = POOLS[kind as keyof typeof POOLS] as readonly unknown[];
      return pool[(i + position) % pool.length];
    });
    let said: unknown;
    try {
      said = fn(...args);
    } catch (error) {
      said = `throws ${(error as Error).message}`;
    }
    calls.add(`${JSON.stringify(args)} → ${JSON.stringify(said)}`);
  }
  return [...calls];
}

/** The table with each function replaced by what it says. */
function resolve(node: unknown, path: string): unknown {
  if (typeof node === 'function') return sample(node as Fn, path);
  if (Array.isArray(node)) return node.map((item) => resolve(item, path));
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [
        key,
        resolve(value, path ? `${path}.${key}` : key),
      ]),
    );
  }
  return node;
}

/** Spaces and hyphens that look alike are written by name, so a review can see them. */
const visible = (json: string) =>
  json.replaceAll(' ', '<NNBSP>').replaceAll(' ', '<NBSP>').replaceAll('\u2011', '<NBHY>');

for (const lang of ['en', 'fr'] as const) {
  test(`I18N-04 · the ${lang} interface says the approved copy`, async () => {
    const text = JSON.stringify(resolve(TRANSLATIONS[lang], ''), null, 1);
    await expect(visible(text)).toMatchFileSnapshot(`./__snapshots__/copy.${lang}.txt`);
  });
}
