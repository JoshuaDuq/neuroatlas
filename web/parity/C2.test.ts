import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { createCatalog as legacyCreateCatalog } from '../../viewer/catalog/catalog.js';
import * as legacyFunctional from '../../viewer/catalog/functional-regions.js';
import {
  beneathCortex as legacyBeneathCortex,
  labelOf as legacyLabelOf,
} from '../../viewer/catalog/labels.js';
import * as legacyNetworks from '../../viewer/catalog/networks.js';
import { nearest as legacyNearest } from '../../viewer/catalog/nearest.js';
import * as legacyDomains from '../../viewer/catalog/neuropsych-domains.js';
import { visibilityOf as legacyVisibilityOf } from '../../viewer/catalog/visibility.js';
import { createCatalog } from '../src/lib/core/catalog/catalog.ts';
import * as functional from '../src/lib/core/catalog/functional-regions.ts';
import { beneathCortex, labelOf } from '../src/lib/core/catalog/labels.ts';
import * as networks from '../src/lib/core/catalog/networks.ts';
import { nearest } from '../src/lib/core/catalog/nearest.ts';
import * as domains from '../src/lib/core/catalog/neuropsych-domains.ts';
import { anatomies, readModel } from '../src/lib/core/catalog/test-support.ts';
import { visibilityOf } from '../src/lib/core/catalog/visibility.ts';
import type { FunctionalRegions } from '../src/lib/core/catalog/functional-regions.ts';
import type { CabNpPartition } from '../src/lib/core/catalog/networks.ts';
import type {
  NeuropsychDomains,
  NeurosynthTerms,
} from '../src/lib/core/catalog/neuropsych-domains.ts';
import type { Manifest, Region } from '../src/lib/types/index.ts';

/** mulberry32: a seeded PRNG, so every run draws the same corpus. */
function prng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const stripAccents = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** catalog.ts `tierOf`, with `startsAWord` treating Unicode letters and digits as word characters. */
function correctedTierOf(text: string, query: string): number {
  if (!text) return 4;
  if (text === query) return 0;
  if (text.startsWith(query)) return 1;
  if (!text.includes(query)) return 4;
  let from = text.indexOf(query);
  while (from > 0) {
    if (!/[\p{L}\p{N}]/u.test(text[from - 1])) return 2;
    from = text.indexOf(query, from + 1);
  }
  return 3;
}

const LANGUAGES = ['en', 'fr'] as const;

for (const { id } of anatomies.anatomies) {
  describe(`C2 catalog against the legacy catalog: ${id}`, () => {
    const manifest = readModel<Manifest>(`${id}/manifest.json`);
    const cabNpFile = readModel<CabNpPartition>(`${id}/${manifest.cab_np!.file}`);
    const regionsById = new Map<string, Region>(
      manifest.regions.map((region) => [region.id, region]),
    );

    const random = prng(20260101);
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
    const subset = <T>(items: readonly T[], share: number): T[] =>
      items.filter(() => random() < share);

    const regionIds = manifest.regions.map((region) => region.id);
    const systems = [
      null,
      ...new Set(
        manifest.regions
          .filter((r) => r.kind === 'structure')
          .map((r) => legacyLabelOf(r, 'en')?.group),
      ),
    ];
    const cutAtlases = [null, ...(manifest.cut_atlases ?? []).map((cut) => cut.id)];
    const settingsGrid = Array.from({ length: 240 }, () => ({
      atlas: pick(manifest.atlases).id,
      detail: pick(manifest.detail_levels).id,
      internalSystem: pick(systems),
      internalConstituents: new Set(subset(regionIds, 0.02)),
      cutAtlas: pick(cutAtlases),
      cutActive: random() < 0.5,
      hemisphere: pick(['both', 'left', 'right'] as const),
      cortexVisible: random() < 0.8,
      cortexOpacity: pick([0, 0.5, 1]),
      internalVisible: random() < 0.8,
      spinalCordVisible: random() < 0.8,
      surfaceColor: pick(['atlas', 'mri', 'cab-np', 'network', 'tissue'] as const),
      functionalLevel: pick(['named', 'sections'] as const),
      paint: null,
      isolatedRegion: random() < 0.15 ? pick(regionIds) : null,
      hiddenRegions: new Set(subset(regionIds, 0.03)),
      dissectionCanUndo: false,
      lang: pick(LANGUAGES),
    }));

    it('labelOf agrees for every region in both languages', () => {
      for (const region of manifest.regions) {
        for (const lang of LANGUAGES) {
          assert.deepStrictEqual(
            labelOf(region, lang),
            legacyLabelOf(region, lang),
            `${region.id} ${lang}`,
          );
        }
        assert.equal(beneathCortex(region), legacyBeneathCortex(region), region.id);
      }
    });

    it('visibilityOf agrees for every region over a seeded settings grid', () => {
      for (const settings of settingsGrid) {
        for (const region of manifest.regions) {
          assert.deepStrictEqual(
            visibilityOf(region, settings),
            legacyVisibilityOf(region, settings),
            region.id,
          );
        }
      }
    });

    it('groups, search and visibleCount agree over both languages and a query corpus', () => {
      const labelTexts = manifest.regions.flatMap((region) => {
        const label = legacyLabelOf(region, 'en');
        return label ? [label.name, label.code ?? label.name] : [];
      });
      const queries = [
        '',
        '   ',
        's',
        'a',
        'c',
        'cun',
        'cuneus',
        'cunéus',
        'CUNEUS',
        'central',
        'V1',
        'STG',
        'broca',
        'hippocampus',
        'thalamus',
        'noyau',
        'gyrus',
        'sillon',
        'white matter',
        'substance blanche',
        'putamen',
        'zzz',
        ...Array.from({ length: 120 }, () => {
          const text = pick(labelTexts);
          const start = Math.floor(random() * text.length);
          return text.slice(start, start + 1 + Math.floor(random() * 6));
        }),
      ];
      for (const lang of LANGUAGES) {
        const catalog = createCatalog(manifest, lang, cabNpFile);
        const legacy = legacyCreateCatalog(manifest, lang, cabNpFile as never);
        for (const settings of settingsGrid.slice(0, 40)) {
          const withLang = { ...settings, lang };
          assert.deepStrictEqual(
            catalog.groups(withLang),
            legacy.groups(withLang),
            `groups ${lang}`,
          );
          assert.equal(
            catalog.visibleCount(withLang),
            legacy.visibleCount(withLang),
            `visibleCount ${lang}`,
          );
        }
        for (const query of queries) {
          const settings = { ...pick(settingsGrid), lang };
          // Deviation c2-search-word-boundary: accented letters are word characters. The expected
          // ranking is the legacy rows re-ranked with the corrected predicate.
          const all = 1_000_000;
          const ours = catalog.search(query, settings, all);
          const theirs = legacy.search(query, settings, all);
          const q = query.trim().toLowerCase();
          const tier = (row: (typeof theirs.rows)[number]) =>
            Math.min(
              ...(legacy.get(row.region.id)!.searchable as string[]).map((text) =>
                Math.min(correctedTierOf(text, q), correctedTierOf(text, stripAccents(q))),
              ),
            );
          const compare = (a: (typeof theirs.rows)[number], b: (typeof theirs.rows)[number]) =>
            (a.region.family_order ?? 0) - (b.region.family_order ?? 0) ||
            a.label.name.localeCompare(b.label.name, lang) ||
            a.region.hemisphere.localeCompare(b.region.hemisphere);
          const expected = [...theirs.rows].sort((a, b) => tier(a) - tier(b) || compare(a, b));
          assert.equal(ours.total, theirs.total, `search total "${query}" ${lang}`);
          assert.deepStrictEqual(ours.rows, expected, `search "${query}" ${lang}`);
          assert.deepStrictEqual(catalog.search(query, settings, 5), {
            rows: expected.slice(0, 5),
            total: theirs.total,
          });
        }
        for (const region of manifest.regions.slice(0, 200)) {
          const settings = pick(settingsGrid);
          assert.deepStrictEqual(
            catalog.label(region.id, settings),
            legacy.label(region.id, settings),
          );
        }
        assert.deepStrictEqual(
          catalog.get(manifest.regions[0].id),
          legacy.get(manifest.regions[0].id),
        );
        assert.equal(catalog.get('not-a-region'), legacy.get('not-a-region'));
      }
    });

    it('the language switch is lazy and equal: searching in one language then the other', () => {
      const catalog = createCatalog(manifest, 'en', cabNpFile);
      const legacy = legacyCreateCatalog(manifest, 'en', cabNpFile as never);
      const settings = settingsGrid[0];
      for (const lang of ['fr', 'en', 'fr'] as const) {
        catalog.setLanguage(lang);
        legacy.setLanguage(lang);
        assert.deepStrictEqual(catalog.groups(settings), legacy.groups(settings));
      }
    });

    it('networks agree', () => {
      assert.deepStrictEqual(
        networks.validateCabNp(structuredClone(cabNpFile), regionsById),
        legacyNetworks.validateCabNp(structuredClone(cabNpFile), regionsById),
      );
      for (const key of [...Object.keys(cabNpFile.colors), 'Vis', 'SomMot', 'Cont', 'Invented']) {
        for (const lang of LANGUAGES) {
          assert.equal(networks.networkName(key, lang), legacyNetworks.networkName(key, lang));
        }
      }
      for (const network of cabNpFile.networks) {
        for (const lang of LANGUAGES) {
          assert.equal(networks.cabNpName(network, lang), legacyNetworks.cabNpName(network, lang));
        }
      }
      for (const region of manifest.regions) {
        assert.deepStrictEqual(networks.networksOf(region), legacyNetworks.networksOf(region));
        assert.equal(networks.dominantNetwork(region), legacyNetworks.dominantNetwork(region));
        if (region.networks?.length)
          assert.equal(networks.networkBasis(region), legacyNetworks.networkBasis(region));
      }
    });

    it('functional regions agree', () => {
      const published = readModel<FunctionalRegions>(`${id}/${manifest.functional_regions!.file}`);
      const ours = functional.validateFunctionalRegions(structuredClone(published), regionsById);
      const theirs = legacyFunctional.validateFunctionalRegions(
        structuredClone(published),
        regionsById,
      );
      assert.deepStrictEqual(ours, theirs);
      assert.deepStrictEqual(functional.FUNCTIONAL_LEVELS, legacyFunctional.FUNCTIONAL_LEVELS);
      for (const level of functional.FUNCTIONAL_LEVELS) {
        for (const region of manifest.regions) {
          const record = functional.functionalRegionOf(ours, level, region.id);
          assert.deepStrictEqual(
            record,
            legacyFunctional.functionalRegionOf(theirs, level, region.id),
          );
          if (record) {
            for (const lang of LANGUAGES) {
              assert.equal(
                functional.functionalName(record, lang),
                legacyFunctional.functionalName(record, lang),
              );
              assert.equal(
                functional.functionalShortName(record, lang),
                legacyFunctional.functionalShortName(record, lang),
              );
            }
          }
        }
      }
    });

    it('neuropsychological domains: validation, ordering, search and every paint colour map agree', () => {
      const partitionFile = `${id}/${manifest.neuropsych_domains!.file}`;
      const termsFile = `${id}/${manifest.neurosynth_terms!.file}`;
      const load = <T>(path: string) => readModel<T>(path);
      const ours = domains.validateNeuropsychDomains(
        load<NeuropsychDomains>(partitionFile),
        regionsById,
        load<NeurosynthTerms>(termsFile),
      );
      const theirs = legacyDomains.validateNeuropsychDomains(
        load<NeuropsychDomains>(partitionFile),
        regionsById,
        load<NeurosynthTerms>(termsFile) as never,
      );
      assert.deepStrictEqual(ours, theirs);

      const ids = [
        domains.ALL_DOMAINS,
        ...ours.domains.map((domain) => domain.id),
        ...ours.search!.terms.keys(),
      ];
      assert.ok(ids.length > ours.domains.length + 1);
      for (const domain of ids) {
        assert.deepStrictEqual(
          domains.domainPaint(ours, domain),
          legacyDomains.domainPaint(theirs, domain),
          domain,
        );
        if (domain !== domains.ALL_DOMAINS) {
          assert.deepStrictEqual(
            domains.domainAreas(ours, domain),
            legacyDomains.domainAreas(theirs, domain),
            domain,
          );
          assert.equal(
            domains.domainStudies(ours, domain),
            legacyDomains.domainStudies(theirs, domain),
            domain,
          );
        }
      }
      assert.throws(
        () => domains.domainPaint(ours, 'praxis'),
        /Unknown neuropsychological domain: praxis/,
      );

      const query = prng(7);
      const queries = [
        '',
        'fear',
        ' Fear ',
        'cond',
        'memoire',
        'mémoire',
        'langage',
        'vis',
        'zzz',
        ...Array.from({ length: 60 }, () => {
          const term = [...ours.search!.terms.values()][
            Math.floor(query() * ours.search!.terms.size)
          ].term;
          const start = Math.floor(query() * term.length);
          return term.slice(start, start + 1 + Math.floor(query() * 5));
        }),
      ];
      for (const text of queries) {
        assert.deepStrictEqual(
          domains.matchingTerms(ours, text),
          legacyDomains.matchingTerms(theirs, text),
          text,
        );
        for (const lang of LANGUAGES) {
          assert.deepStrictEqual(
            domains.groupedDomains(ours, text, lang),
            legacyDomains.groupedDomains(theirs, text, lang),
            text,
          );
          assert.equal(
            domains.nearestName(ours, text, lang),
            legacyDomains.nearestName(theirs, text, lang),
            text,
          );
        }
      }
      for (const region of manifest.regions) {
        assert.deepStrictEqual(
          domains.domainsOf(ours, region.id),
          legacyDomains.domainsOf(theirs, region.id),
        );
        assert.deepStrictEqual(
          domains.shownDomain(ours, region.id, null),
          legacyDomains.shownDomain(theirs, region.id, null),
        );
        assert.equal(
          domains.scoredRegion(ours, region),
          legacyDomains.scoredRegion(theirs, region),
        );
      }
      assert.deepStrictEqual(domains.overviewDomains(ours), legacyDomains.overviewDomains(theirs));
      for (const z of [-1, 0, 3, 3.5, 5, 7.77, 10, 25]) {
        assert.deepStrictEqual(domains.zBand(ours, z), legacyDomains.zBand(theirs, z));
      }
    });

    it('nearest agrees over a seeded corpus of misspellings', () => {
      const names = [
        ...new Set(manifest.regions.flatMap((region) => legacyLabelOf(region, 'en')?.name ?? [])),
      ].slice(0, 150);
      const draw = prng(11);
      for (let i = 0; i < 60; i += 1) {
        const word = names[Math.floor(draw() * names.length)];
        const cut = Math.floor(draw() * word.length);
        const typed = word.slice(0, cut) + word.slice(cut + 1);
        assert.equal(nearest(typed, names), legacyNearest(typed, names), typed);
      }
    });
  });
}
