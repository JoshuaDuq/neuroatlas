import assert from 'node:assert/strict';
import { isDeepStrictEqual, inspect } from 'node:util';
import { describe as vitestDescribe, test as vitestTest } from 'vitest';
import { readRepoYaml } from '../test/repo.ts';
import {
  FINDING_COLORS as legacyFindingColors,
  createClinicalCatalog as legacyClinical,
} from '../../viewer/clinical/catalog.js';
import { createCircuitCatalog as legacyCircuits } from '../../viewer/learning/catalog.js';
import { createCircuitSession as legacySession } from '../../viewer/learning/session.js';
import { createComparisonCatalog as legacyComparison } from '../../viewer/comparison/catalog.js';
import {
  TRACT_CATALOGS as legacyTractCatalogs,
  tractCatalog as legacyTractCatalog,
} from '../../viewer/diffusion/catalogs.js';
import { isIndependentTractReference as legacyIndependent } from '../../viewer/diffusion/presentation.js';
import { diffusionErrorCode as legacyErrorCode } from '../../viewer/diffusion/translations.js';
import {
  DiffusionInputError as LegacyInputError,
  validateVolume as legacyValidateVolume,
} from '../../viewer/diffusion/validation.js';
import { AssetError as LegacyAssetError } from '../../viewer/model/published-assets.js';
import { readModel } from '../src/lib/core/catalog/test-support.ts';
import { createClinicalCatalog, FINDING_COLORS } from '../src/lib/core/clinical/catalog.ts';
import type { ClinicalData } from '../src/lib/core/clinical/types.ts';
import { createComparisonCatalog } from '../src/lib/core/comparison/catalog.ts';
import type { ComparisonData } from '../src/lib/core/comparison/catalog.ts';
import { TRACT_CATALOGS, tractCatalog } from '../src/lib/core/diffusion/catalogs.ts';
import { isIndependentTractReference } from '../src/lib/core/diffusion/presentation.ts';
import {
  DiffusionInputError,
  diffusionErrorCode,
  validateVolume,
} from '../src/lib/core/diffusion/validation.ts';
import { createCircuitCatalog } from '../src/lib/core/learning/catalog.ts';
import type { CircuitData } from '../src/lib/core/learning/catalog.ts';
import { createCircuitSession } from '../src/lib/core/learning/session.ts';
import type { Manifest } from '../src/lib/types/index.ts';

/**
 * Every parity case is registered by its full name and runs once, whichever test asks first: the
 * branch suite at the end runs them all itself, so `-t` on any single test still works.
 */
const cases = new Map<string, () => void>();
const outcomes = new Map<string, unknown>();
let prefix = '';
let caseName = '';
function describe(name: string, define: () => void) {
  // Vitest runs the callback later, while collecting, so the prefix is set around the call itself.
  vitestDescribe(name, () => {
    const outer = prefix;
    prefix = `${outer}${name} > `;
    define();
    prefix = outer;
  });
}
function runCase(key: string) {
  if (!outcomes.has(key)) {
    caseName = key;
    try {
      cases.get(key)!();
      outcomes.set(key, null);
    } catch (error) {
      outcomes.set(key, error);
    }
  }
  if (outcomes.get(key)) throw outcomes.get(key);
}
function test(name: string, run: () => void) {
  const key = `${prefix}${name}`;
  cases.set(key, run);
  vitestTest(name, () => runCase(key));
}

/** mulberry32: a seeded PRNG, so every run draws the same corpus. */
function prng(seed: number) {
  let state = seed >>> 0;
  const rand = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Object.assign(rand, { seed });
}
type Rand = (() => number) & { seed?: number };
const below = (rand: Rand, n: number) => Math.floor(rand() * n);
const pick = <T>(rand: Rand, items: readonly T[]): T => items[below(rand, items.length)];
/** The item for this seed: seeds 1..n walk a list of n variants, so no variant is left to chance. */
const cycle = <T>(rand: Rand, items: readonly T[]): T => items[(rand.seed! - 1) % items.length];

/** What a call returned, or the error it threw, so both implementations are compared on either. */
const reached = new Set<string>();

/**
 * deepStrictEqual that names the first item that differs and prints only a short excerpt of each
 * side: node:assert builds a full diff of its operands, which for a whole catalog observation
 * exhausts memory. Outcome kind (value or error) and message come before the contents.
 */
function expectSame(actual: unknown, expected: unknown, label = 'result', depth = 0): void {
  if (isDeepStrictEqual(actual, expected)) return;
  const container = (value: unknown): value is Any =>
    value !== null && typeof value === 'object' && !(value instanceof Map);
  if (
    depth < 4 &&
    container(actual) &&
    container(expected) &&
    Array.isArray(actual) === Array.isArray(expected)
  ) {
    const keys = [...new Set([...Object.keys(actual), ...Object.keys(expected)])].sort(
      (a, b) => Number(b === 'error') - Number(a === 'error'),
    );
    for (const key of keys) expectSame(actual[key], expected[key], `${label}.${key}`, depth + 1);
  }
  const brief = (value: unknown) =>
    inspect(value, { depth: 2, maxArrayLength: 4, maxStringLength: 120, breakLength: Infinity });
  assert.fail(`${label} differs: new ${brief(actual)}; legacy ${brief(expected)}`);
}
function outcome<T>(run: () => T): { value: T } | { error: [string, string] } {
  try {
    return { value: run() };
  } catch (error) {
    reached.add((error as Error).message);
    return { error: [(error as Error).name, (error as Error).message] };
  }
}

type Any = Record<string, any>;
const manifest = readModel<Manifest>('cdmd/manifest.json');
const clinicalData = readRepoYaml<ClinicalData>('data/neuropsychology.yaml');
const circuitData = readRepoYaml<CircuitData>('data/circuits.yaml');
const deficitIds = clinicalData.deficits.map((deficit) => deficit.id);
const regionsOf = (m: Any, predicate: (r: Any) => boolean) => m.regions.filter(predicate);

/**
 * Apply `mutate` to a clone and give both implementations their own copy of the result: the same
 * outcome, value or error message, is required of them.
 */
function bothAgree<D, M, T>(
  data: D,
  man: M,
  mutate: (data: any, man: any, rand: Rand) => void,
  seed: number,
  run: (impl: 'legacy' | 'new', data: D, man: M) => T,
) {
  const mutatedData = structuredClone(data);
  const mutatedManifest = structuredClone(man);
  mutate(mutatedData, mutatedManifest, prng(seed));
  const legacy = outcome(() =>
    run('legacy', structuredClone(mutatedData), structuredClone(mutatedManifest)),
  );
  const current = outcome(() =>
    run('new', structuredClone(mutatedData), structuredClone(mutatedManifest)),
  );
  expectSame(current, legacy, `${caseName} seed ${seed}`);
  return current;
}

/* -------------------------------- clinical -------------------------------- */

const clinicalMutations: Record<string, (d: Any, m: Any, rand: Rand) => void> = {
  none: () => {},
  'revision date': (d, _m, r) => {
    d.revised = pick(r, ['2026-9-1', '', undefined, 20260911, 'x2026-09-11']);
  },
  'no data': (d) => {
    Object.keys(d).forEach((key) => delete d[key]);
  },
  'empty groups': (d) => {
    d.groups = [];
  },
  'groups not a list': (d, _m, r) => {
    d.groups = pick(r, [null, {}, 'groups']);
  },
  'empty deficits': (d) => {
    d.deficits = [];
  },
  'empty references': (d) => {
    d.references = [];
  },
  'empty associations': (d) => {
    d.associations = [];
  },
  'empty manifest regions': (_d, m) => {
    m.regions = [];
  },
  'group id blank': (d, _m, r) => {
    pick<Any>(r, d.groups).id = pick(r, ['', '  ', undefined, 3]);
  },
  'duplicate group': (d, _m, r) => {
    d.groups.push(structuredClone(pick<Any>(r, d.groups)));
  },
  'duplicate deficit': (d, _m, r) => {
    d.deficits.push(structuredClone(pick(r, d.deficits)));
  },
  'duplicate reference': (d, _m, r) => {
    d.references.push(structuredClone(pick(r, d.references)));
  },
  'duplicate association': (d, _m, r) => {
    d.associations.push(structuredClone(pick(r, d.associations)));
  },
  'duplicate region': (_d, m, r) => {
    m.regions.push(structuredClone(pick(r, m.regions)));
  },
  'record is null': (d, _m, r) => {
    d.deficits[below(r, d.deficits.length)] = null;
  },
  'group name': (d, _m, r) => {
    delete pick<Any>(r, d.groups).name[pick(r, ['en', 'fr'])];
  },
  'group name blank': (d, _m, r) => {
    pick<Any>(r, d.groups).name.fr = ' ';
  },
  'deficit text': (d, _m, r) => {
    const deficit = pick<Any>(r, d.deficits);
    const field = cycle(r, ['name', 'domain', 'summary']);
    if (r() < 0.5) delete deficit[field][pick(r, ['en', 'fr'])];
    else delete deficit[field];
  },
  'deficit group': (d, _m, r) => {
    pick<Any>(r, d.deficits).group = pick(r, ['invented', undefined]);
  },
  'deficit aliases': (d, _m, r) => {
    const deficit = pick<Any>(r, d.deficits);
    const lang = pick(r, ['en', 'fr']);
    const bad = pick<unknown>(r, [undefined, 'oubli', ['ok', ''], ['ok', 3]]);
    if (r() < 0.2) delete deficit.aliases;
    else deficit.aliases[lang] = bad;
  },
  'orphan group': (d) => {
    d.groups.push({ id: 'orphan', name: { en: 'Orphan', fr: 'Orpheline' } });
  },
  'reference text': (d, _m, r) => {
    pick<Any>(r, d.references)[cycle(r, ['title', 'authors', 'journal'])] = pick(r, [
      '',
      undefined,
      4,
    ]);
  },
  'reference year': (d, _m, r) => {
    pick<Any>(r, d.references).year = pick<unknown>(r, [1799, 2020.5, '1990', undefined, 1800]);
  },
  'reference doi': (d, _m, r) => {
    pick<Any>(r, d.references).doi = pick<unknown>(r, [
      'javascript:alert(1)',
      '10.12/x',
      '10.1234/',
      undefined,
    ]);
  },
  'reference pmid': (d, _m, r) => {
    pick<Any>(r, d.references).pmid = pick<unknown>(r, ['12a', '', 123, undefined]);
  },
  'reference method': (d, _m, r) => {
    pick<Any>(r, d.references).method = pick<unknown>(r, ['rumour', undefined]);
  },
  'reference scope': (d, _m, r) => {
    pick<Any>(r, d.references).scope = pick<unknown>(r, ['title', undefined, 'full-text']);
  },
  'reference population': (d, _m, r) => {
    delete pick<Any>(r, d.references).population[pick(r, ['en', 'fr'])];
  },
  'corrections not a list': (d, _m, r) => {
    pick<Any>(r, d.references).corrections = pick<unknown>(r, [{}, 'erratum', null]);
  },
  'correction doi': (d, _m, r) => {
    pick<Any>(r, d.references).corrections = [
      { doi: pick(r, ['erratum', undefined]), summary: { en: 'Fix', fr: 'Correctif' } },
    ];
  },
  'correction summary': (d, _m, r) => {
    pick<Any>(r, d.references).corrections = [
      { doi: '10.1523/erratum', summary: pick(r, [{ en: 'Fix' }, undefined, { fr: 'Correctif' }]) },
    ];
  },
  'correction valid': (d, _m, r) => {
    pick<Any>(r, d.references).corrections = [
      { doi: '10.1523/erratum', summary: { en: 'Fix', fr: 'Correctif' } },
    ];
  },
  'association deficit': (d, _m, r) => {
    pick<Any>(r, d.associations).deficit = pick(r, ['missing', undefined]);
  },
  'association text': (d, _m, r) => {
    const association = pick<Any>(r, d.associations);
    const field = pick(r, ['title', 'finding', 'limitation', 'network', 'mapping_note']);
    if (r() < 0.5) delete association[field][pick(r, ['en', 'fr'])];
    else delete association[field];
  },
  laterality: (d, _m, r) => {
    pick<Any>(r, d.associations).laterality = pick<unknown>(r, [
      'both',
      undefined,
      'bilateral',
      'left',
      'right',
    ]);
  },
  'no supporting evidence': (d, _m, r) => {
    const association = pick<Any>(r, d.associations);
    association.evidence = pick<unknown>(r, [
      [],
      undefined,
      association.evidence.map((e: Any) => ({ ...e, role: 'qualifying' })),
    ]);
  },
  'evidence reference': (d, _m, r) => {
    pick<Any>(r, d.associations).evidence.push({ reference: 'missing', role: 'supporting' });
  },
  'evidence role': (d, _m, r) => {
    pick<Any>(r, d.associations).evidence.push({
      reference: d.references[0].id,
      role: pick(r, ['contrary', undefined]),
    });
  },
  'mappings not a list': (d, _m, r) => {
    pick<Any>(r, d.associations).mappings = pick<unknown>(r, [undefined, {}, 'x']);
  },
  'mapping unknown region': (d, _m, r) => {
    pick<Any>(r, d.associations).mappings[0].region = pick(r, ['aseg:right:9999', undefined]);
  },
  'mapping non-region': (d, m, r) => {
    const nonRegion = pick<Any>(
      r,
      regionsOf(m, (region) => region.kind === 'non-region'),
    );
    pick<Any>(r, d.associations).mappings.push({
      region: nonRegion.id,
      source_name: nonRegion.source_name,
    });
  },
  'mapping source name': (d, _m, r) => {
    pick<Any>(r, d.associations).mappings[0].source_name = pick(r, ['Invented', '', undefined]);
  },
  'mapping source name spelling': (d, m, r) => {
    // `&` and `_and_` are the same parcel across recons: accepted either way.
    const association = pick<Any>(r, d.associations);
    const region = m.regions.find(
      (candidate: Any) => candidate.id === association.mappings[0].region,
    );
    association.mappings[0].source_name = region.source_name.replaceAll('_and_', '&');
    region.source_name = region.source_name.replaceAll('&', '_and_');
  },
  'mapping hemisphere': (d, m, r) => {
    const association = pick<Any>(
      r,
      d.associations.filter((a: Any) => a.laterality !== 'bilateral'),
    );
    association.laterality = association.laterality === 'left' ? 'right' : 'left';
    void m;
  },
  'mapping duplicate': (d, _m, r) => {
    const association = pick<Any>(
      r,
      d.associations.filter((a: Any) => a.mappings.length),
    );
    association.mappings.push(structuredClone(association.mappings[0]));
  },
};

const clinicalSeeds = [1, 2, 3, 4, 5, 6];

describe('clinical catalog against the legacy catalog', () => {
  for (const [name, mutate] of Object.entries(clinicalMutations)) {
    test(`validation: ${name}`, () => {
      for (const seed of clinicalSeeds) {
        bothAgree(clinicalData, manifest, mutate, seed, (impl, data, man) => {
          const catalog = (impl === 'legacy' ? legacyClinical : createClinicalCatalog)(
            data as never,
            man as never,
          );
          return observeClinical(catalog, data as ClinicalData, seed);
        });
      }
    });
  }

  test('FINDING_COLORS', () => {
    expectSame(FINDING_COLORS, legacyFindingColors);
  });
});

/** Everything a catalog serves, over every id and a seeded corpus of queries in both languages. */
function observeClinical(catalog: Any, data: ClinicalData, seed: number) {
  const rand = prng(seed * 7919);
  const words = data.deficits.flatMap((deficit) =>
    (['en', 'fr'] as const).flatMap((lang) => [
      deficit.name[lang],
      deficit.domain[lang],
      ...(deficit.aliases[lang] ?? []),
    ]),
  );
  // Every deficit by its full name and by one alias, in both languages: an exact name ranks first.
  const queries: [string, string][] = data.deficits.flatMap((deficit) =>
    (['en', 'fr'] as const).flatMap((lang): [string, string][] => [
      [deficit.name[lang], lang],
      ...(deficit.aliases[lang].length
        ? ([[deficit.aliases[lang][0], lang]] as [string, string][])
        : []),
    ]),
  );
  for (let i = 0; i < 60; i++) {
    const word = pick(rand, words);
    const start = below(rand, word.length);
    const piece = word.slice(start, start + 1 + below(rand, 8));
    const query = pick(rand, [
      piece,
      piece.toUpperCase(),
      ` ${piece} `,
      piece.normalize('NFD'),
      `${piece}${pick(rand, ['x', 'e', 'é'])}`,
    ]);
    queries.push([query, pick(rand, ['en', 'fr'])]);
  }
  queries.push(['', 'en'], ['', 'fr'], ['unlisted', 'en'], ['xx', 'de']);
  const observed: Any = {
    revised: catalog.revised,
    groups: catalog.groups,
    search: queries.map(([query, lang]) =>
      outcome(() => catalog.search(query, lang).map((d: Any) => d.id)),
    ),
    grouped: queries.map(([query, lang]) =>
      outcome(() =>
        catalog
          .grouped(query, lang)
          .map((e: Any) => [e.group.id, e.deficits.map((d: Any) => d.id)]),
      ),
    ),
    nearest: [
      ...queries.slice(-64),
      ...data.deficits
        .slice(0, 24)
        .map((deficit): [string, string] => [deficit.name.en.slice(1), 'en']),
    ].map(([query, lang]) => outcome(() => catalog.nearest(query, lang))),
    deficits: data.deficits.map((deficit) => ({
      get: catalog.get(deficit.id),
      forDeficit: catalog.forDeficit(deficit.id),
      mapped: catalog.mappedRegions(deficit.id),
      paint: catalog.paint(deficit.id),
      findings: catalog.forDeficit(deficit.id).map((a: Any) => catalog.paint(deficit.id, a.id)),
      unknownFinding: outcome(() => catalog.paint(deficit.id, 'missing')),
    })),
    references: data.references.map((reference) => catalog.reference(reference.id)),
    regions: [...new Set(data.associations.flatMap((a) => a.mappings.map((m) => m.region)))].map(
      (id) => catalog.forRegion(id),
    ),
    unknown: ['get', 'reference', 'forDeficit', 'forRegion', 'mappedRegions', 'paint'].map(
      (method) => outcome(() => catalog[method]('missing')),
    ),
  };
  return observed;
}

describe('clinical catalog: published content', () => {
  test('exact outputs for every query, id and finding', () => {
    for (const seed of [11, 12, 13]) {
      const legacy = observeClinical(
        legacyClinical(structuredClone(clinicalData) as never, structuredClone(manifest) as never),
        clinicalData,
        seed,
      );
      const current = observeClinical(
        createClinicalCatalog(structuredClone(clinicalData), structuredClone(manifest)),
        clinicalData,
        seed,
      );
      expectSame(current, legacy);
      assert.ok(
        legacy.search.some((s: Any) => s.value?.length),
        'queries reach matches',
      );
    }
  });

  test('findingPaint rejects a deficit with more findings than colours', () => {
    const catalog = (impl: typeof createClinicalCatalog) => {
      const data = structuredClone(clinicalData) as Any;
      const association = data.associations.find((a: Any) => a.deficit === data.deficits[0].id);
      for (let i = 0; i < 7; i++) {
        data.associations.push({ ...structuredClone(association), id: `extra-${i}` });
      }
      return outcome(() => impl(data as ClinicalData, manifest).paint(data.deficits[0].id));
    };
    const current = catalog(createClinicalCatalog);
    expectSame(current, catalog(legacyClinical as never));
    assert.ok('error' in current && /more findings than finding colours/.test(current.error[1]));
  });
});

/* -------------------------------- learning -------------------------------- */

const step = (c: Any, r: Rand) => pick<Any>(r, pick<Any>(r, c.circuits).steps);
const circuitMutations: Record<string, (c: Any, m: Any, rand: Rand) => void> = {
  none: () => {},
  revised: (c, _m, r) => {
    c.revised = pick(r, ['', ' ', undefined, 3]);
  },
  margin: (c, _m, r) => {
    c.context_margin_mm = pick<unknown>(r, [0, -1, NaN, Infinity, '12', undefined, 0.5]);
  },
  'circuits empty': (c, _m, r) => {
    c.circuits = pick<unknown>(r, [[], null, {}]);
  },
  'circuit id': (c, _m, r) => {
    pick<Any>(r, c.circuits).id = pick(r, ['', undefined]);
  },
  'circuit duplicate': (c, _m, r) => {
    c.circuits.push(structuredClone(pick(r, c.circuits)));
  },
  'references empty': (c) => {
    c.references = [];
  },
  'reference duplicate': (c, _m, r) => {
    c.references.push(structuredClone(pick(r, c.references)));
  },
  'reference text': (c, _m, r) => {
    pick<Any>(r, c.references)[pick(r, ['title', 'citation'])] = pick(r, ['', undefined]);
  },
  'reference url': (c, _m, r) => {
    pick<Any>(r, c.references).url = pick(r, ['http://example.org/', 'not a url', 'ftp://x/y']);
  },
  'reference url missing': (c, _m, r) => {
    delete pick<Any>(r, c.references).url;
  },
  'reference identifier': (c, _m, r) => {
    const reference = pick<Any>(r, c.references);
    delete reference.pmid;
    delete reference.nbk;
  },
  'reference identifier malformed': (c, _m, r) => {
    const reference = pick<Any>(r, c.references);
    delete reference.pmid;
    reference.nbk = pick(r, ['NBK', 'nbk123', '123', 'NBK12x']);
  },
  'reference pmid malformed': (c, _m, r) => {
    const reference = pick<Any>(
      r,
      c.references.filter((x: Any) => x.pmid),
    );
    reference.pmid = pick(r, ['12a', '', ' 1']);
  },
  'reference pmcid': (c, _m, r) => {
    pick<Any>(r, c.references).pmcid = pick<unknown>(r, [
      '5608081',
      'PMC',
      'pmc1',
      undefined,
      'PMC1',
    ]);
  },
  'circuit text': (c, _m, r) => {
    const circuit = pick<Any>(r, c.circuits);
    const key = pick(r, ['name', 'summary', 'route', 'scope', 'clinical']);
    const how = below(r, 3);
    if (how === 0) delete circuit[key][pick(r, ['en', 'fr'])];
    else if (how === 1) circuit[key].extra = 'unquoted comma';
    else circuit[key] = pick(r, [undefined, 'text']);
  },
  'circuit deficit': (c, _m, r) => {
    pick<Any>(r, c.circuits).deficit = pick(r, ['invented', undefined]);
  },
  'circuit references': (c, _m, r) => {
    pick<Any>(r, c.circuits).references = pick<unknown>(r, [[], undefined, ['missing'], 'vision']);
  },
  'step duplicate': (c, _m, r) => {
    const circuit = pick<Any>(r, c.circuits);
    circuit.steps.push(structuredClone(pick(r, circuit.steps)));
  },
  'step source name': (c, _m, r) => {
    step(c, r).source_name = pick(r, ['Invented tract', undefined]);
  },
  'step region': (c, _m, r) => {
    step(c, r).region = pick(r, ['learning:missing', undefined, 'aseg:left:0']);
  },
  'step unsupported kind': (c, m, r) => {
    const region = pick<Any>(
      r,
      regionsOf(m, (x) => x.kind === 'tissue-region' || x.kind === 'non-region'),
    );
    Object.assign(step(c, r), { region: region.id, source_name: region.source_name });
  },
  'step text': (c, _m, r) => {
    const target = step(c, r);
    const key = pick(r, ['name', 'role', 'explanation', 'mapping']);
    if (r() < 0.5) delete target[key][pick(r, ['en', 'fr'])];
    else target[key].extra = 'x';
  },
  'step view': (c, _m, r) => {
    step(c, r).view = pick<unknown>(r, ['diagonal', undefined, 'toString', 'oblique', 'left']);
  },
  'step plane': (c, _m, r) => {
    step(c, r).plane = pick<unknown>(r, ['invented', undefined, 'axial']);
  },
  'covering regions': (c, m, r) => {
    const target = pick<Any>(
      r,
      c.circuits.find((x: Any) => x.id === 'cerebellar').steps.slice(1, 2),
    );
    delete target.alternatives;
    const structure = regionsOf(m, (x) => x.kind === 'structure' && x.atlas === 'learning');
    target.covering_regions = pick<unknown>(r, [
      [],
      'x',
      ['missing'],
      [target.region],
      [pick<Any>(r, structure).id],
      ['hcp-mmp:left:24'],
    ]);
  },
  'covering regions valid': (c, m, r) => {
    const target = c.circuits.find((x: Any) => x.id === 'cerebellar').steps[1];
    const region = m.regions.find((x: Any) => x.id === target.region) ?? {
      atlas: 'learning',
      hemisphere: 'left',
    };
    const siblings = regionsOf(
      m,
      (x) =>
        x.kind === 'structure' &&
        x.atlas === region.atlas &&
        x.hemisphere === region.hemisphere &&
        x.id !== target.region,
    );
    target.covering_regions = [pick<Any>(r, siblings).id];
  },
  'alternatives both': (c, _m, r) => {
    const target = step(c, r);
    target.alternatives = [{ name: target.name }];
  },
  'alternatives none': (c, _m, r) => {
    const target = pick<Any>(
      r,
      c.circuits.find((x: Any) => x.id === 'cerebellar').steps.slice(0, 1),
    );
    target.region = 'learning:missing';
    for (const alternative of target.alternatives) alternative.region = 'learning:missing';
  },
  'alternatives empty': (c, _m, r) => {
    step(c, r).alternatives = [];
  },
};

describe('circuit catalog against the legacy catalog', () => {
  for (const [name, mutate] of Object.entries(circuitMutations)) {
    test(`validation: ${name}`, () => {
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const ids = seed === 6 ? deficitIds.slice(1) : deficitIds;
        bothAgree(circuitData, manifest, mutate, seed, (impl, data, man) => {
          const catalog = (impl === 'legacy' ? legacyCircuits : createCircuitCatalog)(
            data as never,
            man as never,
            ids,
          );
          return observeCircuits(catalog);
        });
      }
    });
  }
});

/** Every circuit, every landmark and reference the catalog serves. */
function observeCircuits(catalog: Any) {
  return {
    all: catalog.all,
    revised: catalog.revised,
    contextMarginMm: catalog.contextMarginMm,
    circuits: catalog.all.map((circuit: Any) => catalog.get(circuit.id)),
    steps: catalog.all.flatMap((circuit: Any) =>
      circuit.steps.map((s: Any) => catalog.step(circuit.id, s.id)),
    ),
    references: catalog.all.flatMap((circuit: Any) =>
      circuit.references.map((id: string) => catalog.reference(id)),
    ),
    unknown: [
      outcome(() => catalog.get('missing')),
      outcome(() => catalog.step('missing', 'chiasm')),
      outcome(() => catalog.step(catalog.all[0].id, 'missing')),
      outcome(() => catalog.reference('missing')),
    ],
  };
}

describe('circuit session against the legacy session', () => {
  test('seeded sequences of start, go and close', () => {
    const circuits = new Map([
      ['vision', { id: 'vision', steps: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }],
      ['memory', { id: 'memory', steps: [{ id: 'x' }, { id: 'y' }] }],
    ]);
    const catalog = {
      get(id: string) {
        const circuit = circuits.get(id);
        if (!circuit) throw new Error(`Unknown circuit: ${id}`);
        return circuit;
      },
    };
    const rand = prng(99);
    const sequences = 40;
    const seen = new Set<string>();
    for (let sequence = 0; sequence < sequences; sequence++) {
      const legacy = legacySession(catalog);
      const current = createCircuitSession(catalog as never);
      for (let i = 0; i < 40; i++) {
        const action = pick(rand, ['start', 'go', 'go', 'go', 'close', 'snapshot']);
        const argument =
          action === 'start'
            ? pick<unknown>(rand, ['vision', 'memory', 'missing', undefined])
            : pick<unknown>(rand, [0, 1, 2, 3, -1, 0.5, NaN, '1', undefined]);
        const run = (session: Any) =>
          outcome(() => {
            if (action === 'close') session.close();
            else if (action === 'start') session.start(argument);
            else if (action === 'go') session.go(argument);
            return session.snapshot();
          });
        const expected = run(legacy);
        expectSame(run(current), expected);
        seen.add(`${action}:${'error' in expected ? 'error' : 'ok'}`);
      }
    }
    for (const reached of [
      'start:ok',
      'start:error',
      'go:ok',
      'go:error',
      'close:ok',
      'snapshot:ok',
    ]) {
      assert.ok(seen.has(reached), `sequences reach ${reached}`);
    }
  });
});

/* ------------------------------- comparison ------------------------------- */

const comparisonData = readModel<ComparisonData>('cdmd/atlas-comparison.json');
const comparisonMutations: Record<string, (d: Any, m: Any, rand: Rand) => void> = {
  none: () => {},
  schema: (d, _m, r) => {
    d.schema_version = pick<unknown>(r, [2, '1', undefined]);
  },
  'data not a record': (_d, _m, _r) => {},
  subject: (d, _m, r) => {
    d.anatomy_id = pick(r, ['aomic', undefined]);
  },
  'atlas order': (d) => {
    d.atlases.reverse();
  },
  'atlas list': (d, _m, r) => {
    d.atlases = pick<unknown>(r, [['destrieux'], undefined, ['destrieux', 'hcp-mmp', 'x']]);
  },
  surface: (d, _m, r) => {
    d.surface = pick(r, ['white', undefined]);
  },
  method: (d) => {
    d.method = 'vertex-counts';
  },
  units: (d) => {
    d.units = 'm2';
  },
  'totals missing': (d, _m, r) => {
    d.totals = pick<unknown>(r, [undefined, null, [], 'x']);
  },
  'total removed': (d, _m, r) => {
    delete d.totals[pick(r, Object.keys(d.totals))];
  },
  'total unknown': (d) => {
    d.totals['missing:left:1'] = 1;
  },
  'total invalid': (d, _m, r) => {
    d.totals[pick(r, Object.keys(d.totals))] = pick<unknown>(r, [0, -1, Infinity, NaN, '10', null]);
  },
  'total drift small': (d, _m, r) => {
    const key = pick(r, Object.keys(d.totals));
    d.totals[key] *= 1 + 5e-11;
  },
  'total drift large': (d, _m, r) => {
    const key = pick(r, Object.keys(d.totals));
    d.totals[key] *= 1 + 2e-10;
  },
  'pairs missing': (d, _m, r) => {
    d.pairs = pick<unknown>(r, [undefined, [], {}]);
  },
  'pair not a record': (d, _m, r) => {
    d.pairs[below(r, d.pairs.length)] = pick<unknown>(r, [null, [], 3]);
  },
  'pair ids': (d, _m, r) => {
    pick<Any>(r, d.pairs).region_ids = pick<unknown>(r, [undefined, ['a'], ['a', 'b', 'c'], 'ab']);
  },
  'pair unknown id': (d, _m, r) => {
    pick<Any>(r, d.pairs).region_ids[below(r, 2)] = 'missing';
  },
  'pair swapped': (d, _m, r) => {
    pick<Any>(r, d.pairs).region_ids.reverse();
  },
  'pair hemispheres': (d, _m, r) => {
    const target = pick<Any>(r, d.pairs);
    target.region_ids[1] = target.region_ids[1]
      .replace(':left:', ':right:')
      .replace(/:\d+$/, (id: string) => id);
  },
  'pair duplicate': (d, _m, r) => {
    d.pairs.push({ ...structuredClone(pick<Any>(r, d.pairs)), mesh_id: 'different' });
  },
  'pair mesh': (d, _m, r) => {
    pick<Any>(r, d.pairs).mesh_id = pick<unknown>(r, ['', undefined, d.pairs[0].mesh_id, 3]);
  },
  'pair area': (d, _m, r) => {
    pick<Any>(r, d.pairs).area_mm2 = pick<unknown>(r, [0, -1, NaN, '6', null, Infinity]);
  },
  'pair equal areas': (d, _m, r) => {
    // Two pairs of one region with the same area, the larger target id first in the file, so only
    // the tie-break orders them; every total follows the pairs.
    const bySource = new Map<string, Any[]>();
    for (const pair of d.pairs)
      bySource.set(pair.region_ids[0], [...(bySource.get(pair.region_ids[0]) ?? []), pair]);
    const [first, second] = pick<Any[]>(
      r,
      [...bySource.values()].filter((pairs) => pairs.length > 1),
    );
    second.area_mm2 = first.area_mm2;
    const [a, b] = [first, second].sort((x, y) =>
      y.region_ids[1].localeCompare(x.region_ids[1], 'en'),
    );
    const [ia, ib] = [d.pairs.indexOf(a), d.pairs.indexOf(b)];
    d.pairs[Math.min(ia, ib)] = a;
    d.pairs[Math.max(ia, ib)] = b;
    for (const id of Object.keys(d.totals)) d.totals[id] = 0;
    for (const pair of d.pairs) for (const id of pair.region_ids) d.totals[id] += pair.area_mm2;
  },
  'pair removed': (d, _m, r) => {
    d.pairs.splice(below(r, d.pairs.length), 1);
  },
  geometry: (d, _m, r) => {
    d.geometry = pick<unknown>(r, [
      undefined,
      {},
      { file: 'a', sha256: 'wrong' },
      { file: '', sha256: 'f'.repeat(64) },
    ]);
  },
  'source missing': (d, _m, r) => {
    d.sources = pick<unknown>(r, [undefined, [], [d.sources[0]]]);
  },
  'source duplicate': (d) => {
    d.sources[1] = d.sources[0];
  },
  'source hemisphere': (d, _m, r) => {
    d.sources[0].hemisphere = pick(r, ['both', undefined]);
  },
  'source pial': (d, _m, r) => {
    d.sources[below(r, 2)].pial = cycle<unknown>(r, [
      undefined,
      { file: 'a', sha256: 'z'.repeat(64) },
    ]);
  },
  'source annotations': (d, _m, r) => {
    pick<Any>(r, d.sources).annotations = pick<unknown>(r, [undefined, [], [{}]]);
  },
  'source annotation atlas': (d, _m, r) => {
    const source = pick<Any>(r, d.sources);
    if (r() < 0.5) source.annotations[1] = source.annotations[0];
    else source.annotations[0].atlas = 'aseg';
  },
  'source annotation hash': (d, _m, r) => {
    pick<Any>(r, pick<Any>(r, d.sources).annotations).sha256 = 'wrong';
  },
  'asset missing': (d, _m, r) => {
    d.atlas_assets = pick<unknown>(r, [undefined, [], [d.atlas_assets[0]]]);
  },
  'asset hash': (d, _m, r) => {
    pick<Any>(r, d.atlas_assets).sha256 = pick(r, ['wrong', undefined]);
  },
  'asset atlas': (d, _m, r) => {
    if (r() < 0.5) d.atlas_assets[1] = d.atlas_assets[0];
    else d.atlas_assets[0].atlas = 'aseg';
  },
  'asset file': (d, _m, r) => {
    pick<Any>(r, d.atlas_assets).file = 'other.glb';
  },
  'asset citation': (d, _m, r) => {
    pick<Any>(r, d.atlas_assets).citation = pick(r, ['other citation', '', undefined]);
  },
  'manifest identity': (_d, m, r) => {
    m.anatomy = pick<unknown>(r, [undefined, {}, { id: 'cdmd' }, [], { id: '', subject: 'x' }]);
  },
  'manifest comparison': (_d, m, r) => {
    m.atlas_comparison = cycle<unknown>(r, [
      undefined,
      {},
      { file: 'x', sha256: 'wrong' },
      { file: ' ', sha256: 'a'.repeat(64) },
      null,
    ]);
  },
  'manifest regions': (_d, m, r) => {
    m.regions = pick<unknown>(r, [undefined, {}, null]);
  },
  'manifest region invalid': (_d, m, r) => {
    m.regions[below(r, m.regions.length)] = pick<unknown>(r, [null, [], 3, { id: '' }]);
  },
  'manifest region duplicate': (_d, m, r) => {
    m.regions.push(structuredClone(pick(r, m.regions)));
  },
  'manifest cortical region': (_d, m, r) => {
    const region = pick<Any>(
      r,
      regionsOf(m, (x) => x.atlas === 'destrieux' || x.atlas === 'hcp-mmp'),
    );
    const field = pick(r, ['kind', 'hemisphere', 'id', 'source_name']);
    region[field] = pick<unknown>(r, ['structure', 'midline', 'x:y:1', '', undefined]);
  },
  'manifest region label': (_d, m, r) => {
    const region = pick<Any>(
      r,
      regionsOf(m, (x) => x.atlas === 'destrieux' && x.kind === 'cortex'),
    );
    region.source_name = 'No_such_parcel_name';
    delete region.display_names;
  },
  'manifest atlases': (_d, m, r) => {
    m.atlases = pick<unknown>(r, [undefined, [], 'x']);
  },
};

describe('comparison catalog against the legacy catalog', () => {
  for (const [name, mutate] of Object.entries(comparisonMutations)) {
    test(`validation: ${name}`, () => {
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        bothAgree(comparisonData, manifest, mutate, seed, (impl, data, man) => {
          if (name === 'data not a record')
            data = pick(prng(seed), [null, [], 3] as never[]) as never;
          return observeComparison(
            (impl === 'legacy' ? legacyComparison : createComparisonCatalog)(
              data as never,
              man as never,
            ),
            man as Manifest,
          );
        });
      }
    });
  }
});

/** Every region's comparison and CSV in both languages, and the failure of a bad language or id. */
function observeComparison(catalog: Any, man: Manifest) {
  return {
    regions: man.regions.map((region) => ({
      comparison: catalog.comparisonFor(region.id),
      csv: outcome(() => ['en', 'fr'].map((lang) => catalog.exportCsv(region.id, lang))),
    })),
    defaultCsv: man.regions
      .filter((r) => r.kind === 'cortex' && r.atlas === 'destrieux')
      .slice(0, 5)
      .map((r) => catalog.exportCsv(r.id)),
    badLanguage: outcome(() =>
      catalog.exportCsv(man.regions.find((r) => r.kind === 'cortex' && r.atlas)!.id, 'de'),
    ),
    unknown: [
      outcome(() => catalog.comparisonFor('missing')),
      outcome(() => catalog.exportCsv('missing')),
    ],
  };
}

describe('comparison catalog: published content', () => {
  test('every region, both languages, full precision', () => {
    const legacy = legacyComparison(structuredClone(comparisonData), structuredClone(manifest));
    const current = createComparisonCatalog(
      structuredClone(comparisonData),
      structuredClone(manifest),
    );
    const expected = observeComparison(legacy, manifest);
    expectSame(observeComparison(current, manifest), expected);
    assert.ok(
      expected.regions.some((r: Any) => r.comparison?.rows.length > 1),
      'compared regions have overlaps',
    );
    assert.ok(
      expected.regions.some((r: Any) => r.comparison === null),
      'other regions offer none',
    );
  });

  test('a returned row cannot change the validated measurements', () => {
    const current = createComparisonCatalog(
      structuredClone(comparisonData),
      structuredClone(manifest),
    );
    const id = manifest.regions.find((r) => r.kind === 'cortex' && r.atlas === 'destrieux')!.id;
    const before = structuredClone(current.comparisonFor(id));
    current.comparisonFor(id)!.rows[0].areaMm2 = 0;
    expectSame(current.comparisonFor(id), before);
  });
});

/* -------------------------------- diffusion -------------------------------- */

function volumeFromSeed(rand: Rand): Any {
  const volume: Any = {
    hdr: {
      dims: [3, 2 + below(rand, 3), 2 + below(rand, 3), 2 + below(rand, 3), 1, 1, 1, 1],
      pixDims: [1, 1, 1, 1, 0, 0, 0, 0],
      datatypeCode: 16,
      xyzt_units: 2,
      sform_code: 1,
      qform_code: 0,
      affine: [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ],
    },
    img: new Float32Array(8),
  };
  const mutations: ((v: Any) => void)[] = [
    () => {},
    (v) => {
      v.hdr = undefined;
    },
    (v) => {
      v.img = pick<unknown>(rand, [undefined, new Float32Array(0), []]);
    },
    (v) => {
      Object.assign(v, pick<unknown>(rand, [null, undefined]));
    },
    (v) => {
      v.hdr.dims[0] = pick(rand, [2, 4]);
    },
    (v) => {
      v.hdr.dims[4 + below(rand, 4)] = pick(rand, [2, 64]);
    },
    (v) => {
      v.hdr.dims[1 + below(rand, 3)] = pick(rand, [0, -1, 1.5, NaN]);
    },
    (v) => {
      v.hdr.datatypeCode = pick(rand, [2, 4, 8, 16, 64, 256, 512, 768, 128, 0, 32, 1024]);
    },
    (v) => {
      v.hdr.xyzt_units = pick(rand, [0, 1, 2, 3, 10, 18, 34]);
    },
    (v) => {
      v.hdr.sform_code = 0;
      v.hdr.qform_code = pick(rand, [0, 1]);
    },
    (v) => {
      v.hdr.sform_code = 0;
      v.hdr.qform_code = 0;
    },
    (v) => {
      v.hdr.affine = pick<unknown>(rand, [undefined, [], v.hdr.affine.slice(0, 3), 'x']);
    },
    (v) => {
      v.hdr.affine[below(rand, 4)] = pick<unknown>(rand, [
        [1, 0, 0],
        [1, 0, 0, 0, 0],
      ]);
    },
    (v) => {
      v.hdr.affine[below(rand, 4)][below(rand, 4)] = pick(rand, [NaN, Infinity, 2.5]);
    },
    (v) => {
      v.hdr.affine[0][0] = 0;
    },
    (v) => {
      v.hdr.affine[3] = pick(rand, [
        [0, 0, 0, 2],
        [1, 0, 0, 1],
        [0, 0, 0, 0],
      ]);
    },
    (v) => {
      v.hdr.pixDims[1 + below(rand, 3)] = pick(rand, [0, -1, NaN, Infinity, 2.5]);
    },
    (v) => {
      v.hdr.affine = [
        [0.5, 0.1, 0, 3],
        [-0.1, 0.5, 0, 4],
        [0, 0, 2, 5],
        [0, 0, 0, 1],
      ];
    },
  ];
  pick(rand, mutations)(volume);
  return volume;
}

describe('diffusion against the legacy modules', () => {
  test('validateVolume over seeded headers reaches every rejection', () => {
    const rand = prng(2024);
    const messages = new Set<string>();
    let accepted = 0;
    for (let i = 0; i < 600; i++) {
      const volume = volumeFromSeed(rand);
      const expected = outcome(() => legacyValidateVolume(structuredClone(volume)));
      const current = outcome(() => validateVolume(structuredClone(volume)));
      expectSame(current, expected);
      if ('error' in expected) {
        messages.add(expected.error[1]);
        const thrown = (() => {
          try {
            validateVolume(structuredClone(volume));
          } catch (error) {
            return error;
          }
        })();
        if (thrown instanceof DiffusionInputError) {
          const legacyThrown = (() => {
            try {
              legacyValidateVolume(structuredClone(volume));
            } catch (error) {
              return error;
            }
          })() as LegacyInputError;
          assert.equal(thrown.code, legacyThrown.code);
        }
      } else accepted++;
    }
    assert.ok(accepted > 0);
    for (const message of [
      'The volume contains no readable image data.',
      'Use a three-dimensional map, not a raw 4D acquisition.',
      'Use a scalar map rather than a vector or RGB image.',
      'The NIfTI spatial units must explicitly be millimeters.',
      'The NIfTI needs a valid spatial transform.',
      'The NIfTI needs a valid spatial transform and voxel spacing.',
    ]) {
      assert.ok(messages.has(message), `seeded headers reach: ${message}`);
    }
  });

  test('DiffusionInputError carries its name and code', () => {
    const legacy = new LegacyInputError('units', 'm');
    const current = new DiffusionInputError('units', 'm');
    expectSame(
      [current.name, current.code, current.message],
      [legacy.name, legacy.code, legacy.message],
    );
    assert.ok(current instanceof Error);
  });

  test('diffusionErrorCode over every error class and seeded code-bearing objects', () => {
    const rand = prng(7);
    const pairs: [unknown, unknown][] = [
      [
        new LegacyAssetError('asset-fetch', 'x', { status: 503 }),
        Object.assign(new Error('x'), { name: 'AssetError', code: 'asset-fetch', status: 503 }),
      ],
      [
        new LegacyAssetError('asset-updated', 'x'),
        Object.assign(new Error('x'), { name: 'AssetError', code: 'asset-updated' }),
      ],
      [new LegacyInputError('empty', 'x'), new DiffusionInputError('empty', 'x')],
      [new RangeError('x'), new RangeError('x')],
      [new Error('x'), new Error('x')],
      [null, null],
      [undefined, undefined],
      ['asset-fetch', 'asset-fetch'],
      [{ code: 'asset-fetch' }, { code: 'asset-fetch' }],
    ];
    for (let i = 0; i < 40; i++) {
      const code = pick<unknown>(rand, [
        'asset-fetch',
        'asset-updated',
        'empty',
        'other',
        3,
        undefined,
        null,
      ]);
      pairs.push([{ code }, { code }]);
      pairs.push([
        Object.assign(new Error('x'), { code }),
        Object.assign(new Error('x'), { code }),
      ]);
    }
    const codes = new Set<string>();
    for (const [legacy, current] of pairs) {
      const expected = legacyErrorCode(legacy);
      assert.equal(diffusionErrorCode(current), expected);
      codes.add(expected);
    }
    expectSame([...codes].sort(), ['asset-fetch', 'asset-updated', 'failed', 'invalid-data']);
  });

  test('isIndependentTractReference over every state', () => {
    const rand = prng(3);
    for (const explorer of ['anatomy', 'functions', 'deficits', 'circuits', 'diffusion']) {
      for (let i = 0; i < 30; i++) {
        const state = {
          explorer,
          anatomy: pick<unknown>(rand, ['cdmd', 'aomic', '', null, undefined]),
          referenceAnatomy: pick<unknown>(rand, ['cdmd', 'aomic', '', null, undefined]),
        };
        expectSame(
          outcome(() => isIndependentTractReference(state as never)),
          outcome(() => legacyIndependent(state)),
        );
      }
    }
  });

  test('the tract catalogs and the lookup by anatomy', () => {
    expectSame(TRACT_CATALOGS, legacyTractCatalogs);
    for (const anatomy of ['cdmd', 'aomic', '', 'toString']) {
      expectSame(tractCatalog(anatomy), legacyTractCatalog(anatomy));
    }
  });
});

/* ------------------------- every validation branch ------------------------- */

// The messages below are one per `throw` and `requireValue` in the legacy sources. The seeded
// mutations above must have produced each of them (the legacy `missing total for` throw is
// unreachable: totals and regions are already equal in number and every total names a region), so no branch is left to the fixtures' luck.
vitestDescribe('the seeded inputs reach every validation branch', () => {
  const branches: RegExp[] = [
    // clinical/validate.js and clinical/catalog.js
    /revision date is required/,
    /group records are required/,
    /deficit records are required/,
    /reference records are required/,
    /association records are required/,
    /region records are required/,
    /group id is required/,
    /Duplicate group/,
    /Duplicate deficit/,
    /Duplicate reference/,
    /Duplicate association/,
    /Duplicate region/,
    /: name\.fr is required/,
    /: summary\.fr is required/,
    /: domain\.en is required/,
    /unknown group/,
    /aliases\.en must be a list of terms/,
    /group has no deficits/,
    /title is required/,
    /authors is required/,
    /journal is required/,
    /year must be a publication year/,
    /invalid doi/,
    /invalid pmid/,
    /unknown method/,
    /source scope is required/,
    /population\.fr is required/,
    /corrections must be a list/,
    /invalid correction doi/,
    /correction summary\.fr is required/,
    /: unknown deficit/,
    /finding\.fr is required/,
    /invalid laterality/,
    /supporting evidence is required/,
    /unknown reference missing/,
    /invalid evidence role/,
    /mappings must be a list/,
    /unknown region/,
    /source_name disagrees/,
    /hemisphere mismatch/,
    /duplicate region/,
    /Unknown deficit: missing/,
    /Unknown reference: missing/,
    /Unknown region: missing/,
    /Unknown language: de/,
    /has no finding missing/,
    /more findings than finding colours/,
    // learning/catalog.js
    /Missing text: revised/,
    /Circuit context margin must be positive millimetres/,
    /Empty circuit/,
    /Missing text: circuit\.id/,
    /Duplicate circuit/,
    /Empty reference/,
    /Duplicate reference/,
    /Missing text: .*\.title/,
    /Missing text: .*\.citation/,
    /Invalid reference URL/,
    /Invalid URL/,
    /Missing PMID or NBK accession/,
    /Invalid PMCID/,
    /Missing text: .*\.(en|fr)/,
    /Unexpected translation field/,
    /Unknown clinical target/,
    /Missing references/,
    /Unknown reference: missing/,
    /Unknown view/,
    /Unknown MRI plane/,
    /Source mismatch/,
    /Unsupported landmark/,
    /Empty covering regions/,
    /Invalid covering region/,
    /Unknown covering region/,
    /0 forms of landmark/,
    /2 forms of landmark/,
    /Duplicate .* landmark/,
    /Unknown region: learning:missing/,
    /Unknown circuit: missing/,
    /Unknown landmark: missing/,
    // comparison/catalog.js
    /missing subject identity/,
    /missing declared comparison file/,
    /missing or invalid declared comparison SHA-256/,
    /missing manifest regions/,
    /invalid or duplicate manifest region/,
    /invalid cortical region metadata/,
    /missing anatomical name for/,
    /expected schema_version 1/,
    /comparison subject does not match/,
    /invalid atlas order or identity/,
    /expected the original pial surface/,
    /invalid area measurement method/,
    /area units must be mm2/,
    /missing overlap geometry file/,
    /overlap geometry SHA-256/,
    /missing hemisphere source provenance/,
    /invalid or duplicate source hemisphere/,
    /pial source file/,
    /pial source SHA-256/,
    /annotations\./,
    /annotation source SHA-256/,
    /invalid or duplicate .* annotation atlas/,
    /missing cortical asset provenance/,
    /cortical atlas asset SHA-256/,
    /invalid or duplicate cortical atlas asset/,
    /cortical asset file or citation does not match/,
    /missing per-region area totals/,
    /incomplete per-region area totals/,
    /unknown region or invalid total for/,
    /missing overlap pairs/,
    /invalid overlap region identifiers/,
    /overlap region atlas or hemisphere mismatch/,
    /duplicate overlap pair/,
    /invalid or duplicate overlap mesh ID/,
    /invalid overlap area for/,
    /overlap marginal does not conserve/,
    /Unknown comparison export language: de/,
    /Cannot export a cortical comparison for region/,
    // diffusion/presentation.js
    /Tract exploration must identify the anatomy and reference subject/,
  ];
  for (const branch of branches) {
    vitestTest(
      String(branch),
      () => {
        for (const key of cases.keys()) {
          try {
            runCase(key);
          } catch {
            // A failing case reports itself; this suite only needs the messages it produced.
          }
        }
        assert.ok(
          [...reached].some((message) => branch.test(message)),
          'no seeded input produced it',
        );
      },
      120_000,
    );
  }
});
