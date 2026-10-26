import assert from 'node:assert/strict';
import { beforeAll, describe, test } from 'vitest';
import type { Language, Manifest, Region } from '../../types/index.ts';
import { createCatalog } from './catalog.ts';
import {
  FUNCTIONAL_LEVELS,
  functionalName,
  functionalRegionOf,
  functionalShortName,
  validateFunctionalRegions,
  type FunctionalRegions,
} from './functional-regions.ts';
import { beneathCortex, labelOf } from './labels.ts';
import { networkBasis, networksOf, validateCabNp, type CabNpPartition } from './networks.ts';
import {
  ALL_DOMAINS,
  domainAreas,
  domainPaint,
  domainStudies,
  groupedDomains,
  matchingTerms,
  nearestName,
  overviewDomains,
  scoredRegion,
  validateNeuropsychDomains,
  zBand,
  type NeuropsychDomains,
  type NeurosynthTerms,
} from './neuropsych-domains.ts';
import { asRegion, asSettings, readModel } from './test-support.ts';

// The published anatomy, parsed and validated once for every test in this file.
let manifest: Manifest;
let regionsById: Map<string, Region>;
let cabNp: CabNpPartition;
let functional: FunctionalRegions;
let domains: NeuropsychDomains;
let terms: NeurosynthTerms;
const catalogs = {} as Record<Language, ReturnType<typeof createCatalog>>;

beforeAll(() => {
  manifest = readModel<Manifest>('cdmd/manifest.json');
  regionsById = new Map(manifest.regions.map((region) => [region.id, region]));
  cabNp = readModel<CabNpPartition>(`cdmd/${manifest.cab_np!.file}`);
  functional = readModel<FunctionalRegions>(`cdmd/${manifest.functional_regions!.file}`);
  terms = readModel<NeurosynthTerms>(`cdmd/${manifest.neurosynth_terms!.file}`);
  domains = validateNeuropsychDomains(
    readModel<NeuropsychDomains>(`cdmd/${manifest.neuropsych_domains!.file}`),
    regionsById,
    terms,
  );
  for (const lang of ['en', 'fr'] as const) catalogs[lang] = createCatalog(manifest, lang, cabNp);
});

const settings = (over: object = {}) =>
  asSettings({
    atlas: 'destrieux',
    detail: 'aseg',
    hemisphere: 'both',
    cortexVisible: true,
    cortexOpacity: 1,
    internalVisible: true,
    spinalCordVisible: true,
    isolatedRegion: null,
    hiddenRegions: new Set(),
    cutAtlas: null,
    cutActive: false,
    surfaceColor: 'atlas',
    lang: 'en',
    ...over,
  });

const sizes = (groups: { key: string; rows: unknown[] }[]) =>
  Object.fromEntries(groups.map((group) => [group.key, group.rows.length]));

test('CAT-07: a region without a label stops the catalogue from building', () => {
  const nameless = asRegion({ id: 'x:l:1', atlas: 'x', kind: 'structure', source_name: 'Nowhere' });
  assert.throws(() => createCatalog({ regions: [nameless] }), /Region has no label: x:l:1/);
});

describe('the published cdmd anatomy', () => {
  test('CAT-07: all 1289 regions have a non-empty name and group in English and French', () => {
    assert.equal(manifest.regions.length, 1289);
    for (const region of manifest.regions) {
      for (const lang of ['en', 'fr'] as const) {
        const label = labelOf(region, lang);
        assert.ok(label?.name && label.group, `${region.id} ${lang}`);
      }
    }
  });

  test('CAT-16: exactly the deep forebrain structures lie beneath the cortex', () => {
    const beneath = manifest.regions.filter(beneathCortex).map((region) => region.id);
    for (const id of ['aseg:left:17', 'aseg:left:12', 'aseg:midline:253', 'learning:left:fornix'])
      assert.ok(beneath.includes(id), id);
    for (const id of [
      'aseg:left:8',
      'learning:left:pons',
      'nextbrain:left:352',
      'destrieux:left:38',
    ])
      assert.ok(!beneath.includes(id), id);
    assert.ok(manifest.regions.filter((r) => r.kind === 'cortex').every((r) => !beneathCortex(r)));
  });

  test('CAT-18: the 58 spinal cord regions are the ones not registered to the MRI', () => {
    const unregistered = manifest.regions.filter((region) => region.mri_registered === false);
    assert.equal(unregistered.length, 58);
    assert.ok(unregistered.every((region) => region.atlas === 'zanatomy'));
  });

  test('CAT-22: "Broca", "cunéus" and "cuneus" find the published rows', () => {
    const french = settings({ lang: 'fr' });
    const ids = (query: string, lang: Language, over: object = {}) =>
      catalogs[lang].search(query, settings({ lang, ...over })).rows.map((row) => row.region.id);
    assert.deepEqual(ids('Broca', 'fr', { lang: 'fr' }), [
      'destrieux:left:12',
      'destrieux:right:12',
      'destrieux:left:14',
      'destrieux:right:14',
      'nextbrain:left:111',
      'nextbrain:right:10111',
    ]);
    assert.deepEqual(ids('cunéus', 'fr'), ids('cuneus', 'fr'));
    assert.ok(catalogs.fr.search('cuneus', french).rows.some((r) => r.label.name === 'Cunéus'));
    const english = catalogs.en.search('cuneus', settings());
    assert.equal(english.total, 12);
    assert.deepEqual(
      english.rows.slice(0, 5).map((row) => row.region.id),
      [
        'nextbrain:left:2005',
        'nextbrain:right:12005',
        'destrieux:left:11',
        'destrieux:right:11',
        'wmparc:left:3005',
      ],
    );
    assert.equal(catalogs.en.search('V1', settings({ atlas: 'hcp-mmp' })).rows[0].label.code, 'V1');
  });

  test('CAT-22: the published search totals are fixed', () => {
    const total = (query: string, lang: Language) =>
      catalogs[lang].search(query, settings({ lang })).total;
    assert.equal(total('s', 'en'), 779);
    assert.equal(total('noyau', 'fr'), 241);
    assert.equal(total('zzz', 'en'), 0);
    assert.equal(total('', 'en'), 0);
  });

  test('CAT-24: a search for "s" is capped at 50 rows of 779', () => {
    const found = catalogs.en.search('s', settings());
    assert.equal(found.rows.length, 50);
    assert.equal(found.total, 779);
    assert.equal(catalogs.en.search('s', settings(), 5).rows.length, 5);
  });

  test('CAT-25: the destrieux list holds the published groups and row counts', () => {
    const groups = catalogs.en.groups(settings());
    assert.deepEqual(sizes(groups), {
      'cortex:Central': 6,
      'cortex:Cingulate': 14,
      'cortex:Frontal': 38,
      'cortex:Insula': 10,
      'cortex:Lateral fissure': 6,
      'cortex:Limbic': 4,
      'cortex:Occipital': 26,
      'cortex:Parietal': 18,
      'cortex:Temporal': 26,
      'structure:Basal ganglia': 8,
      'structure:Brainstem': 1,
      'structure:Cerebellum': 4,
      'structure:Corpus callosum': 5,
      'structure:Diencephalon': 4,
      'structure:Limbic': 4,
      'structure:Spinal cord': 58,
      'structure:Ventricles and CSF': 6,
    });
  });

  test('CAT-25: a nextbrain cut adds 18 tissue groups', () => {
    const groups = catalogs.en.groups(settings({ cutAtlas: 'nextbrain', cutActive: true }));
    assert.equal(groups.filter((group) => group.kind === 'tissue').length, 18);
  });

  test('CAT-25: with the cortex hidden the structures are listed first', () => {
    const groups = catalogs.en.groups(settings({ cortexVisible: false }));
    assert.equal(groups[0].kind, 'structure');
    assert.equal(groups.at(-1)!.kind, 'cortex');
  });

  test('CAT-25: exploring a system lists only that system among the structures', () => {
    const groups = catalogs.en.groups(settings({ internalSystem: 'Basal ganglia' }));
    const structures = groups.filter((group) => group.kind === 'structure');
    assert.deepEqual(sizes(structures), { 'structure:Basal ganglia': 8 });
  });

  test('CAT-26: hcp-mmp areas group by Yeo network, or by CAB-NP network when it colours', () => {
    const hcp = { atlas: 'hcp-mmp', detail: 'aseg', cortexVisible: true };
    const cortexSizes = (over: object) =>
      Object.fromEntries(
        Object.entries(sizes(catalogs.en.groups(settings({ ...hcp, ...over })))).filter(([key]) =>
          key.startsWith('cortex:'),
        ),
      );
    assert.deepEqual(cortexSizes({}), {
      'cortex:Default mode': 88,
      'cortex:Dorsal attention': 41,
      'cortex:Frontoparietal control': 43,
      'cortex:Limbic': 27,
      'cortex:Salience / ventral attention': 48,
      'cortex:Somatomotor': 49,
      'cortex:Visual': 64,
    });
    assert.deepEqual(cortexSizes({ surfaceColor: 'cab-np' }), {
      'cortex:Auditory': 15,
      'cortex:Cingulo-opercular': 56,
      'cortex:Default mode': 77,
      'cortex:Dorsal attention': 23,
      'cortex:Frontoparietal': 50,
      'cortex:Language': 23,
      'cortex:Orbito-affective': 6,
      'cortex:Posterior multimodal': 7,
      'cortex:Primary visual': 6,
      'cortex:Secondary visual': 54,
      'cortex:Somatomotor': 39,
      'cortex:Ventral multimodal': 4,
    });
  });

  test('CAT-27: the visible count is 238 on destrieux, 450 on hcp-mmp and 90 with the cortex hidden', () => {
    const count = (over: object) => catalogs.en.visibleCount(settings(over));
    assert.equal(count({}), 238);
    assert.equal(count({ atlas: 'hcp-mmp' }), 450);
    assert.equal(count({ cortexVisible: false }), 90);
  });

  test('CAT-28: switching en, fr, en, fr gives the lists of a fresh catalogue; an unknown id has no entry', () => {
    const switched = createCatalog(manifest, 'en', cabNp);
    for (const lang of ['fr', 'en', 'fr'] as const) {
      switched.setLanguage(lang);
      assert.deepEqual(
        switched.groups(settings({ lang })),
        catalogs[lang].groups(settings({ lang })),
      );
    }
    assert.deepEqual(
      switched
        .groups(settings({ lang: 'fr' }))
        .filter((group) => group.kind !== 'tissue')
        .map((group) => group.name),
      [
        'Central',
        'Cingulaire',
        'Frontal',
        'Insula',
        'Limbique',
        'Occipital',
        'Pariétal',
        'Scissure latérale',
        'Temporal',
        'Cervelet',
        'Corps calleux',
        'Diencéphale',
        'Ganglions de la base',
        'Limbique',
        'Moelle épinière',
        'Tronc cérébral',
        'Ventricules et LCS',
      ],
    );
    assert.equal(switched.get('not-a-region'), null);
  });

  test('CAT-31: the published CAB-NP partition is valid, with 12 networks and 360 assignments', () => {
    assert.equal(cabNp.id, 'cab-np');
    assert.equal(cabNp.atlas, 'hcp-mmp');
    assert.deepEqual(cabNp.networks, [
      'Visual1',
      'Visual2',
      'Somatomotor',
      'Cingulo-Opercular',
      'Dorsal-Attention',
      'Language',
      'Frontoparietal',
      'Auditory',
      'Default',
      'Posterior-Multimodal',
      'Ventral-Multimodal',
      'Orbito-Affective',
    ]);
    assert.equal(Object.keys(cabNp.regions).length, 360);
    assert.equal(validateCabNp(structuredClone(cabNp), regionsById).id, 'cab-np');
  });

  test('CAT-32: all 580 regions with network shares have a counting basis', () => {
    const withNetworks = manifest.regions.filter((region) => networksOf(region).length > 0);
    assert.equal(withNetworks.length, 580);
    for (const region of withNetworks) assert.ok(networkBasis(region), region.id);
  });

  test('CAT-34: the published functional regions are 2 levels, 22 sections and 21 named regions', () => {
    const checked = validateFunctionalRegions(structuredClone(functional), regionsById);
    assert.deepEqual(FUNCTIONAL_LEVELS, ['named', 'sections']);
    assert.equal(checked.levels.sections.length, 22);
    assert.equal(checked.levels.named.length, 21);
    assert.deepEqual(
      checked.levels.named.map((record) => record.id),
      [
        'v1',
        'mt',
        'ffc',
        'm1',
        's1',
        's2',
        'sma',
        'fef',
        'pef',
        'broca',
        'a1',
        'lateral-ofc',
        'medial-ofc',
        'subgenual-cingulate',
        'pregenual-acc',
        'area-10',
        'supracallosal-acc',
        'midcingulate',
        'pcc-1',
        'pcc-2',
        'pcc-3',
      ],
    );
    const areas = manifest.regions.filter((r) => r.atlas === 'hcp-mmp' && r.kind === 'cortex');
    assert.ok(areas.every((area) => functionalRegionOf(checked, 'sections', area.id)));
    assert.equal(areas.filter((a) => functionalRegionOf(checked, 'named', a.id)).length, 114);
    assert.deepEqual(
      [
        ...new Set([...checked.levels.named, ...checked.levels.sections].map((r) => r.source)),
      ].sort(),
      ['glasser-2016', 'rolls-2022-ofc', 'rolls-2023-pcc'],
    );
  });

  test('CAT-34: area 8 is the primary motor cortex in section 6; area 84 is in no named region', () => {
    const m1 = functionalRegionOf(functional, 'named', 'hcp-mmp:left:8')!;
    assert.equal(m1.id, 'm1');
    assert.equal(functionalName(m1, 'fr'), 'Cortex moteur primaire (M1)');
    assert.equal(functionalRegionOf(functional, 'sections', 'hcp-mmp:left:8')!.id, 'section-6');
    assert.equal(functionalRegionOf(functional, 'named', 'hcp-mmp:left:84'), null);
    const section = functionalRegionOf(functional, 'sections', 'hcp-mmp:left:84')!;
    assert.equal(section.id, 'section-22');
    assert.equal(functionalShortName(section, 'en'), 'Dorsolateral prefrontal');
    assert.equal(functionalShortName(section, 'fr'), 'Préfrontal dorsolatéral');
  });

  test('CAT-37: the empty Functions query lists the six groups with 14, 8, 13, 14, 10 and 11 domains', () => {
    const listed = groupedDomains(domains, '', 'en');
    assert.deepEqual(
      listed.map((entry) => [entry.group.id, entry.domains.length]),
      [
        ['attention-executive', 14],
        ['memory', 8],
        ['language-number', 13],
        ['perception', 14],
        ['sensorimotor', 10],
        ['social-emotional', 11],
      ],
    );
  });

  test('CAT-38: language reaches 96 regions on 1101 studies, strongest hcp-mmp:left:81 then :74', () => {
    const areas = domainAreas(domains, 'language');
    assert.equal(areas.length, 96);
    assert.deepEqual(
      areas.slice(0, 2).map((area) => [area.region, Math.round(area.z * 100) / 100]),
      [
        ['hcp-mmp:left:81', 20.26],
        ['hcp-mmp:left:74', 18.29],
      ],
    );
    assert.equal(domainStudies(domains, 'language'), 1101);
  });

  test('CAT-39: the published bands start at 3, 5 and 10 and pick the last one the z reaches', () => {
    assert.deepEqual(
      domains.z_scale.map((band) => band.from),
      [3, 5, 10],
    );
    assert.equal(zBand(domains, 2.9), undefined);
    for (const [z, from] of [
      [3, 3],
      [4.99, 3],
      [5, 5],
      [10, 10],
      [25, 10],
    ])
      assert.equal(zBand(domains, z)!.from, from, String(z));
  });

  test('CAT-39: the overview paints 249 of the 289 regions that reach a domain; an unknown domain throws', () => {
    assert.equal(domainPaint(domains, ALL_DOMAINS).colors.size, 249);
    assert.equal(Object.keys(domains.regions).length, 289);
    assert.throws(
      () => domainPaint(domains, 'praxis'),
      /Unknown neuropsychological domain: praxis/,
    );
    assert.throws(() => domainPaint(domains, 'term:praxis'), /Unknown neuropsychological domain/);
  });

  test('CAT-41: the term "fear" finds "fearful" (221 studies) then "fearful faces" (91)', () => {
    const found = matchingTerms(domains, 'fear').map((record) => [record.term, record.studies]);
    assert.deepEqual(found.slice(0, 2), [
      ['fearful', 221],
      ['fearful faces', 91],
    ]);
  });

  test('CAT-42: a misspelt Functions query is offered the closest domain name', () => {
    assert.equal(nearestName(domains, 'langauge', 'en'), 'Language');
    assert.equal(nearestName(domains, 'abc', 'en'), null);
  });

  test('CAT-43: the published domains and terms', () => {
    assert.equal(domains.atlas, 'hcp-mmp');
    assert.equal(domains.threshold_z, 3);
    assert.equal(domains.domains.length, 70);
    assert.deepEqual(
      domains.groups.map((group) => group.id),
      [
        'attention-executive',
        'memory',
        'language-number',
        'perception',
        'sensorimotor',
        'social-emotional',
      ],
    );
    assert.deepEqual(
      overviewDomains(domains).map((domain) => domain.id),
      [
        'executive',
        'working-memory',
        'long-term-memory',
        'language',
        'attention',
        'visuospatial',
        'social-cognition',
        'visual-perception',
        'motor',
        'auditory-perception',
        'emotion',
      ],
    );
    const records = [...domains.search!.terms.values()];
    assert.equal(terms.regions.length, 379);
    assert.equal(manifest.regions.filter((region) => scoredRegion(domains, region)).length, 379);
    assert.equal(records.length, 277);
    assert.equal(records.filter((record) => record.kind === 'function').length, 232);
    assert.equal(records.filter((record) => record.kind === 'population').length, 45);
  });
});
