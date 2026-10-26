import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { AssetError } from '../../viewer/model/published-assets.js';
import { DiffusionInputError } from '../../viewer/diffusion/validation.js';
import {
  diffusionError as legacyDiffusionError,
  mriReadout as legacyMriReadout,
} from '../../viewer/diffusion/translations.js';
import * as legacyFormat from '../../viewer/ui/format.js';
import {
  failureNotice as legacyFailureNotice,
  linkNotice as legacyLinkNotice,
  startFailure as legacyStartFailure,
} from '../../viewer/i18n/errors.js';
import {
  TRANSLATIONS as LEGACY_TRANSLATIONS,
  atlasSwitchLabel as legacyAtlasSwitchLabel,
  t as legacyT,
} from '../../viewer/i18n/translations.js';
import { CLINICAL_TEXT } from '../../viewer/clinical/translations.js';
import { CIRCUIT_TEXT } from '../../viewer/learning/translations.js';
import { DIFFUSION_TEXT } from '../../viewer/diffusion/translations.js';
import * as format from '../src/lib/core/format.ts';
import { diffusionError, mriReadout } from '../src/lib/core/i18n/diffusion.ts';
import { failureNotice, linkNotice, startFailure } from '../src/lib/core/i18n/errors.ts';
import { TRANSLATIONS, atlasSwitchLabel, t } from '../src/lib/core/i18n/index.ts';

/** mulberry32: a seeded PRNG, so every run draws the same samples. */
function prng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = Math.imul(state ^ (state >>> 15), state | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const random = prng(20251025);
const pickFrom = <T>(draw: () => number, pool: readonly T[]): T =>
  pool[Math.floor(draw() * pool.length)]!;
const pick = <T>(pool: readonly T[]): T => pickFrom(random, pool);

// ---- Sample arguments for the string functions, by parameter kind ----

const POOLS = {
  s: ['Alpha', 'Destrieux', 'Left', 'x “q”', '3.5', ''],
  n: [0, 1, 2, 3, 5, 7, 183, 12345],
  b: [true, false],
  a: [['a', 'b'], ['one'], []],
  l: [null, '3.5', '4'],
  o: [{ individual: true }, { individual: false }],
  d: [
    [1, 2, 3],
    [182, 218, 182],
  ],
} as const;
type Kind = keyof typeof POOLS;

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
  'diffusion.streamlines': 'nn',
  'diffusion.bundleCollection': 'n',
  'mri.grid': 'ds',
};

type Fn = (...args: unknown[]) => unknown;

/** What a function says over a fixed number of seeded argument draws; a throw is recorded too. */
/** Both sides of a comparison draw the same arguments: the seed is the function's name. */
function sample(fn: Fn, kinds: string, name: string): unknown[] {
  const draw = prng([...name].reduce((hash, char) => Math.imul(hash, 31) + char.charCodeAt(0), 7));
  const draws: unknown[] = [];
  for (let i = 0; i < 40; i++) {
    const args = [...kinds].map((kind) =>
      pickFrom(draw, POOLS[kind as Kind] as readonly unknown[]),
    );
    let said: unknown;
    try {
      said = fn(...args);
    } catch (error) {
      said = `throws ${(error as Error).message}`;
    }
    draws.push(args, said);
  }
  return draws;
}

/** A table with each function replaced by what it says, so `deepStrictEqual` compares behaviour. */
function resolve(node: unknown, area: string, leaf = ''): unknown {
  if (typeof node === 'function') {
    const kinds = KINDS[`${area}.${leaf}`] ?? 's'.repeat(node.length);
    return sample(node as Fn, kinds, `${area}.${leaf}`);
  }
  if (Array.isArray(node)) return node.map((item) => resolve(item, area, leaf));
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [key, resolve(value, area, key)]),
    );
  }
  return node;
}

const without = (node: unknown, ...keys: string[]) =>
  Object.fromEntries(Object.entries(node as object).filter(([key]) => !keys.includes(key)));

/** Keys of a legacy area that the i18n area adds; the legacy tables have no counterpart. */
const ADDED: Record<string, string[]> = {
  viewport: [
    'loadingWithTotal', // c1-loading-megabytes, asserted below
    'navigationHintTouch', // G1, decision 21: the hints name touch gestures
    'navigationHintTractsTouch', // G1, decision 21
    'exitFullscreen', // H2/G6, decision 33: the label while the stage is fullscreen
  ],
  workspace: ['panelAria'], // H1a: the name of the complementary landmark
  link: ['newTab'], // X2/T1, decision 17: the cue after a link that opens a new tab
  diffusion: [
    'tryAgain', // T1, decision 42
    'matches', // T1: the spoken filter result
    'loaded', // T1: the spoken load result
    'restored', // T1: the spoken restore
    'exported', // T1: the spoken CSV export
  ],
  shortcuts: ['rangeTo'], // S5b D4: read after a range's dash
};

/** The legacy French Escape row with the two S5b fixes of s5b-shortcut-strings.md (D1, D3) applied. */
function legacyFixed(area: string, table: any, lang: string) {
  if (area !== 'shortcuts' || lang !== 'fr') return table;
  let rows = 0;
  const groups = table.groups.map(([heading, items]: [string, [string, string][]]) => [
    heading,
    items.map(([key, text]) => {
      if (key !== 'Esc') return [key, text];
      rows++;
      return ['Échap', text.replace('puis le déficit', 'puis la fonction ou le déficit')];
    }),
  ]);
  assert.equal(rows, 1);
  return { ...table, groups };
}

/** The composed table of one language, with the areas this chunk adds left out. */
const withoutAdditions = (table: Record<string, unknown>) => {
  const { mri: _mri, clinical: _clinical, circuits: _circuits, diffusion, ...rest } = table;
  const { errors: _errors, ...withAdded } = diffusion as Record<string, unknown>;
  return { rest, diffusionText: without(withAdded, ...ADDED.diffusion!) };
};

describe('C1 i18n against the legacy modules', () => {
  for (const lang of ['en', 'fr'] as const) {
    it(`${lang}: every legacy area of TRANSLATIONS is reproduced, strings and functions`, () => {
      const { rest } = withoutAdditions(TRANSLATIONS[lang]);
      const legacy = { ...LEGACY_TRANSLATIONS[lang] };
      assert.deepStrictEqual(Object.keys(rest).sort(), Object.keys(legacy).sort());
      for (const area of Object.keys(legacy)) {
        const added = ADDED[area] ?? [];
        assert.deepStrictEqual(
          resolve(without(rest[area], ...added), area),
          resolve(
            without(legacyFixed(area, legacy[area as keyof typeof legacy], lang), ...added),
            area,
          ),
          `${lang}.${area}`,
        );
      }
    });

    it(`${lang}: the per-domain tables are reproduced`, () => {
      const { diffusionText } = withoutAdditions(TRANSLATIONS[lang]);
      assert.deepStrictEqual(
        resolve(TRANSLATIONS[lang].clinical, 'clinical'),
        resolve(CLINICAL_TEXT[lang], 'clinical'),
      );
      assert.deepStrictEqual(
        resolve(TRANSLATIONS[lang].circuits, 'circuits'),
        resolve(CIRCUIT_TEXT[lang], 'circuits'),
      );
      assert.deepStrictEqual(
        resolve(diffusionText, 'diffusion'),
        resolve(DIFFUSION_TEXT[lang], 'diffusion'),
      );
    });
  }

  it("the loading line sets megabytes in the reader's notation (c1-loading-megabytes)", () => {
    assert.equal(
      TRANSLATIONS.en.viewport.loadingWithTotal(12.3 * 1_048_576, 46.1 * 1_048_576),
      'Loading anatomy · 12.3\u202fMB / 46.1\u202fMB',
    );
    assert.equal(
      TRANSLATIONS.fr.viewport.loadingWithTotal(12.3 * 1_048_576, 46.1 * 1_048_576),
      'Chargement de l’anatomie · 12,3\u202fMo / 46,1\u202fMo',
    );
  });

  it('t falls back to English exactly as the legacy lookup does', () => {
    for (const lang of ['en', 'fr', 'de', 'unknown', '']) {
      for (const area of Object.keys(LEGACY_TRANSLATIONS.en)) {
        assert.deepStrictEqual(
          resolve(without(t(lang, area as 'header'), ...(ADDED[area] ?? [])), area),
          resolve(
            without(legacyFixed(area, legacyT(lang, area), lang), ...(ADDED[area] ?? [])),
            area,
          ),
        );
      }
    }
  });

  it('atlasSwitchLabel agrees for every atlas and an unknown id', () => {
    const ids = [...Object.keys(LEGACY_TRANSLATIONS.en.atlases), 'unheard-of'];
    for (const lang of ['en', 'fr', 'xx']) {
      for (const id of ids) {
        assert.equal(atlasSwitchLabel(id, lang), legacyAtlasSwitchLabel(id, lang));
      }
    }
    assert.equal(atlasSwitchLabel('learning'), legacyAtlasSwitchLabel('learning'));
  });

  it('failureNotice, linkNotice and startFailure agree', () => {
    const errors = [
      new AssetError('asset-fetch', 'HTTP 503'),
      new AssetError('asset-updated', 'changed'),
      new Error('boom'),
      new SyntaxError('Unexpected token'),
    ];
    const operations = Object.keys(LEGACY_TRANSLATIONS.en.errors.operations);
    for (const lang of ['en', 'fr', 'xx']) {
      for (const error of errors) {
        for (const operation of operations) {
          assert.deepStrictEqual(
            failureNotice(error, lang, operation, 'T1'),
            legacyFailureNotice(error, lang, operation, 'T1'),
          );
        }
        for (const linked of [true, false]) {
          assert.deepStrictEqual(
            startFailure(error, lang, linked),
            legacyStartFailure(error, lang, linked),
          );
        }
      }
      const fields = Object.keys(LEGACY_TRANSLATIONS.en.link.fields);
      const draws = [
        [],
        ['pos'],
        ['circuit', 'step'],
        ['step', 'circuit', 'lang'],
        ['pos', 'pos', 'unknown-field'],
        fields,
      ];
      for (let i = 0; i < 40; i++)
        draws.push(Array.from({ length: 1 + (i % 5) }, () => pick(fields)));
      for (const params of draws) {
        assert.deepStrictEqual(linkNotice(params, lang), legacyLinkNotice(params, lang));
      }
    }
  });

  it('format.ts returns the legacy output over fixtures and seeded draws', () => {
    const values = [0, -0, 1, -1, 0.04, -0.04, 4.9999, 5.1234, 999.95, 1234, 21472, 775.634, 1e9];
    for (let i = 0; i < 200; i++) values.push((random() - 0.5) * 10 ** Math.floor(random() * 8));
    const absent = [null, undefined, Number.NaN, Infinity, '7' as unknown as number];
    for (const lang of ['en', 'fr'] as const) {
      for (const value of [...values, ...absent]) {
        assert.equal(format.grouped(value as number), legacyFormat.grouped(value));
        assert.equal(
          format.quantity(value, 'mm²', lang),
          legacyFormat.quantity(value, 'mm²', lang),
        );
        for (const digits of [0, 1, 2]) {
          for (const options of [
            {},
            { signed: true },
            { trim: true },
            { signed: true, trim: true },
          ]) {
            assert.equal(
              format.decimal(value, digits, lang, options),
              legacyFormat.decimal(value, digits, lang, options),
            );
          }
        }
        if (typeof value === 'number') {
          assert.equal(format.millimetres(value, lang), legacyFormat.millimetres(value, lang));
          assert.equal(format.percent(value, lang), legacyFormat.percent(value, lang));
          assert.equal(
            format.count(value, 'region', lang),
            legacyFormat.count(value, 'region', lang),
          );
        }
      }
      for (const noun of [
        'region',
        'match',
        'label',
        'région',
        'study',
        'day',
        'bus',
        'box',
        'branch',
      ]) {
        for (const value of [0, 1, 2, 80, 21472]) {
          assert.equal(format.count(value, noun, lang), legacyFormat.count(value, noun, lang));
        }
      }
      for (const unit of ['%', 'mm', 'mm²']) {
        assert.equal(format.withUnit('16', unit, lang), legacyFormat.withUnit('16', unit, lang));
      }
      const points: unknown[] = [null, [1, 2], [1, Number.NaN, 2], [0, -0.04, 0.04], 'abc'];
      for (let i = 0; i < 100; i++)
        points.push([random() * 200 - 100, random() * 200 - 100, random() * 200 - 100]);
      for (const point of points) {
        assert.equal(
          format.formatRas(point as number[], lang),
          legacyFormat.formatRas(point, lang),
        );
      }
    }
    // The default language is English on both sides.
    assert.equal(format.quantity(1234.5, 'mm²'), legacyFormat.quantity(1234.5, 'mm²'));
    assert.equal(format.decimal(-3), legacyFormat.decimal(-3));
  });

  it('mriReadout and diffusionError agree with the legacy functions', () => {
    for (let i = 0; i < 100; i++) {
      const mm = [random() * 200 - 100, random() * 200 - 100, random() * 200 - 100];
      const t1 = random() * 1000;
      const fa = pick([undefined, random(), Number.NaN]);
      for (const lang of ['en', 'fr'] as const) {
        assert.equal(mriReadout(mm, t1, fa, lang), legacyMriReadout(mm, t1, fa, lang));
      }
    }
    const failures = [
      [new AssetError('asset-fetch', 'HTTP 503'), 'asset-fetch'],
      [new AssetError('asset-updated', 'changed'), 'asset-updated'],
      [new DiffusionInputError('units', 'millimeters'), 'invalid-data'],
      [new RangeError('opacity'), 'failed'],
    ] as const;
    for (const [error, code] of failures) {
      for (const lang of ['en', 'fr']) {
        assert.equal(diffusionError(lang, code), legacyDiffusionError(lang, error));
      }
    }
  });
});

/** The legacy `sections.js` and `navigation-ui.js` hold their tables privately; read the literals. */
function literal(file: string, name: string): any {
  const source = readFileSync(new URL(`../../viewer/${file}`, import.meta.url), 'utf8');
  const start = source.indexOf(`const ${name} = {`);
  assert.ok(start > -1, `${name} not found in ${file}`);
  const end = source.indexOf('\n};', start);
  return new Function(`return ${source.slice(start + `const ${name} = `.length, end + 2)}`)();
}

describe('strings moved into the mri area', () => {
  it('the tissue names are the legacy tables', () => {
    assert.deepStrictEqual(
      TRANSLATIONS.fr.mri.tissueNames,
      literal('ui/chrome/sections.js', 'TISSUE_NAMES_FR'),
    );
    assert.deepStrictEqual(
      TRANSLATIONS.en.mri.tissueNames,
      literal('ui/chrome/sections.js', 'TISSUE_NAMES_EN'),
    );
  });

  it('the orientation letters sections.js drew in French are the orientation area', () => {
    assert.deepStrictEqual(
      TRANSLATIONS.fr.orientation,
      literal('ui/chrome/sections.js', 'FR_EDGE'),
    );
  });

  it('the diffusion MRI dialog strings are the legacy TEXT table', () => {
    const legacy = literal('diffusion/navigation-ui.js', 'TEXT');
    for (const lang of ['en', 'fr'] as const) {
      // Four French wordings are grammar fixes (c1-mri-dialog-french), asserted below.
      const changed = lang === 'fr' ? ['hint', 'voxel'] : [];
      assert.deepStrictEqual(
        resolve(without(TRANSLATIONS[lang].mri.dialog, ...changed), 'mri'),
        resolve(without(legacy[lang], ...changed), 'mri'),
      );
    }
    assert.equal(
      TRANSLATIONS.fr.mri.dialog.hint,
      'Cliquer sur une coupe pour placer le réticule. Faire défiler pour parcourir les coupes ; les touches fléchées déplacent le réticule d’un voxel.',
    );
    assert.equal(TRANSLATIONS.fr.mri.dialog.voxel, 'Voxel source (indices à partir de 0)');
    assert.equal(
      TRANSLATIONS.fr.mri.dialog.grid([1, 2, 3], '1 mm'),
      legacy.fr.grid([1, 2, 3], '1 mm'),
    );
  });
});
