import assert from 'node:assert/strict';
import { beforeAll, describe, test } from 'vitest';
import type { Manifest, Paint } from '../../types/index.ts';
import { readRepoYaml } from '../../../../test/repo.ts';
import { readModel } from '../catalog/test-support.ts';
import { ALL_DOMAINS, validateNeuropsychDomains } from '../catalog/neuropsych-domains.ts';
import type { NeuropsychDomains, NeurosynthTerms } from '../catalog/neuropsych-domains.ts';
import { createClinicalCatalog, findingPaint } from '../clinical/catalog.ts';
import type { ClinicalCatalog } from '../clinical/catalog.ts';
import type { ClinicalData } from '../clinical/types.ts';
import { legendFor, paintFor, paintKind } from './paint.ts';
import type { PaintState } from './paint.ts';

const domains = {
  atlas: 'hcp-mmp',
  unit_atlas: 'learning',
  units: {},
  domains: [
    { id: 'language', name: 'Language', name_fr: 'Langage', overview: true, color: [1, 2, 3] },
    { id: 'memory', name: 'Memory', name_fr: 'Mémoire', overview: true, color: [4, 5, 6] },
    { id: 'reading', name: 'Reading', name_fr: 'Lecture', overview: false, color: [7, 8, 9] },
  ],
  regions: {
    'hcp-mmp:left:1': [
      { domain: 'memory', z: 7 },
      { domain: 'language', z: 4 },
    ],
  },
  z_scale: [
    { from: 3, color: [30, 30, 30] },
    { from: 5, color: [50, 50, 50] },
    { from: 10, color: [90, 90, 90] },
  ],
} as unknown as NeuropsychDomains;
const associations = [
  {
    id: 'naming',
    title: { en: 'Naming', fr: 'Dénomination' },
    mappings: [{ region: 'destrieux:left:1' }],
  },
  {
    id: 'repetition',
    title: { en: 'Repetition', fr: 'Répétition' },
    mappings: [{ region: 'destrieux:left:2' }],
  },
];
const clinical = {
  paint: (id: string, finding: string | null = null) => findingPaint(id, associations, finding),
  get: () => ({ name: { en: 'Aphasia', fr: 'Aphasie' } }),
  standIns: () => [],
} as unknown as ClinicalCatalog;
const drawn = new Set(['destrieux:left:1', 'destrieux:left:2']);
const sources = { domains, clinical, drawn: (id: string) => drawn.has(id) };
const base: PaintState = {
  explorer: 'functions',
  atlas: 'hcp-mmp',
  selectedFunction: 'all',
  selectedDeficit: 'aphasia',
  selectedFinding: null,
  paintLifted: false,
  lang: 'en',
};
const paintOf = (id: string): Paint => ({ id, colors: new Map() });

test('a tab paints only while it is in front, on the atlas its map is defined on, and not once lifted', () => {
  assert.equal(paintFor(base, sources)!.id, 'function:all');
  assert.equal(paintFor({ ...base, atlas: 'destrieux' }, sources), null);
  assert.equal(paintFor({ ...base, selectedFunction: null }, sources), null);
  assert.equal(paintFor({ ...base, paintLifted: true }, sources), null);
  assert.equal(paintFor({ ...base, explorer: 'anatomy' }, sources), null);
  assert.equal(
    paintFor({ ...base, explorer: 'deficits', atlas: 'destrieux' }, sources)!.id,
    'deficit:aphasia',
  );
  assert.equal(
    paintFor({ ...base, explorer: 'deficits', selectedFinding: 'naming' }, sources)!.id,
    'deficit:aphasia:naming',
  );
  assert.equal(paintFor({ ...base, explorer: 'deficits', selectedDeficit: null }, sources), null);
});

test('the key lists the overview, or the z scale of the function chosen, or each finding of the open deficit', () => {
  const paint = paintOf('function:memory');
  const functions = legendFor({ ...base, selectedFunction: 'memory', paint, lang: 'fr' }, sources)!;
  assert.equal(functions.map, 'function');
  assert.equal(functions.title, 'Mémoire');
  assert.equal(functions.pickable, false);
  assert.deepEqual(
    functions.rows.map((row) => [row.label, row.color]),
    [
      ['z\u00a0≥\u00a010', [90, 90, 90]],
      ['z\u00a05\u00a0à\u00a010', [50, 50, 50]],
      ['z\u00a03\u00a0à\u00a05', [30, 30, 30]],
    ],
  );
  const overview = legendFor({ ...base, paint: paintOf('function:all') }, sources)!;
  assert.deepEqual(
    overview.rows.map((row) => [row.id, row.pressed]),
    [
      ['language', false],
      ['memory', false],
    ],
  );
  assert.notEqual(overview.pickable, false);
  const deficit = legendFor(
    { ...base, explorer: 'deficits', paint: clinical.paint('aphasia').paint },
    sources,
  )!;
  assert.equal(deficit.title, 'Aphasia');
  assert.deepEqual(
    deficit.rows.map((row) => [row.id, row.label, row.pressed]),
    [
      ['naming', 'Naming', false],
      ['repetition', 'Repetition', false],
    ],
  );
  assert.equal(legendFor({ ...base, paint: null }, sources), null);
});

test('a paint names its tab by its id', () => {
  assert.equal(paintKind(paintOf('function:language')), 'function');
  assert.equal(paintKind(paintOf('deficit:aphasia:naming')), 'deficit');
  assert.equal(paintKind(null), null);
});

test('a finding none of whose regions is drawn coloured is keyed as absent, and the note says why', () => {
  const state: PaintState = {
    ...base,
    explorer: 'deficits',
    paint: clinical.paint('aphasia').paint,
  };
  assert.deepEqual(
    legendFor(state, sources)!.rows.map((row) => row.absent),
    [false, false],
  );
  drawn.delete('destrieux:left:2');
  const hidden = legendFor(state, sources)!;
  assert.deepEqual(
    hidden.rows.map((row) => row.absent),
    [false, true],
  );
  assert.match(hidden.note, /outlined finding has no region coloured/);
  const picked = legendFor(
    { ...state, selectedFinding: 'naming', paint: clinical.paint('aphasia', 'naming').paint },
    sources,
  )!;
  assert.deepEqual(
    picked.rows.map((row) => row.absent),
    [false, false],
    'a finding not picked is muted, not absent',
  );
  drawn.add('destrieux:left:2');
});

describe('the published cdmd functions and deficits', () => {
  const manifest = readModel<Manifest>('cdmd/manifest.json');
  const regionsById = new Map(manifest.regions.map((region) => [region.id, region]));
  const load = <T>(path: string) => readModel<T>(`cdmd/${path}`);
  let published: ReturnType<typeof validateNeuropsychDomains>;
  let data: ClinicalData;
  let catalog: ClinicalCatalog;
  let both: { domains: typeof published; clinical: ClinicalCatalog };
  beforeAll(() => {
    published = validateNeuropsychDomains(
      load<NeuropsychDomains>(manifest.neuropsych_domains!.file),
      regionsById,
      load<NeurosynthTerms>(manifest.neurosynth_terms!.file),
    );
    data = readRepoYaml<ClinicalData>('data/neuropsychology.yaml');
    catalog = createClinicalCatalog(data, manifest, published.units);
    both = { domains: published, clinical: catalog };
  });
  const functionState = (selectedFunction: string, lang: 'en' | 'fr' = 'en'): PaintState => ({
    explorer: 'functions',
    atlas: 'hcp-mmp',
    selectedFunction,
    selectedDeficit: null,
    selectedFinding: null,
    paintLifted: false,
    lang,
  });

  test('STATE-54 a function keys its z bands, strongest first, in the language of the reader', () => {
    const state = functionState('language', 'fr');
    const paint = paintFor(state, both)!;
    const fr = legendFor({ ...state, paint }, { ...both, drawn: () => true })!;
    assert.equal(fr.title, 'Langage');
    assert.equal(fr.pickable, false);
    assert.deepEqual(
      fr.rows.map((row) => [row.label, row.color]),
      [
        ['z ≥ 10', [10, 62, 125]],
        ['z 5 à 10', [43, 131, 199]],
        ['z 3 à 5', [150, 200, 240]],
      ],
    );
    const en = legendFor({ ...state, lang: 'en', paint }, { ...both, drawn: () => true })!;
    assert.deepEqual(
      en.rows.map((row) => row.label),
      ['z ≥ 10', 'z 5 to 10', 'z 3 to 5'],
    );
    assert.equal(
      en.note,
      'Mean consistency z per area; darker is more consistent. Tissue-coloured areas fall below 3.',
    );
  });

  test('STATE-54 the overview keys the eleven overview functions, none pressed', () => {
    const state = functionState('all');
    const overview = legendFor(
      { ...state, paint: paintFor(state, both) },
      { ...both, drawn: () => true },
    )!;
    assert.equal(overview.title, 'Neuropsychological functions');
    assert.equal(
      overview.note,
      'Each area shows its strongest function; tissue-coloured areas reach none. Choose one to see all its areas.',
    );
    assert.equal(overview.rows.length, 11);
    assert.equal(overview.rows[0]!.id, 'executive');
    assert.equal(overview.rows[10]!.id, 'emotion');
    assert.ok(overview.rows.every((row) => row.pressed === false));
  });

  test('a deficit’s FreeSurfer structures are painted and keyed on their teaching-set stand-ins', () => {
    const state: PaintState = {
      explorer: 'deficits',
      atlas: 'destrieux',
      selectedFunction: null,
      selectedDeficit: 'dystonia',
      selectedFinding: null,
      paintLifted: false,
      lang: 'en',
    };
    const paint = paintFor(state, both)!;
    for (const structure of catalog.mappedRegions('dystonia')) {
      for (const id of catalog.standIns(structure)) {
        assert.deepEqual(paint.colors.get(id), paint.colors.get(structure), id);
      }
    }
    assert.ok(paint.colors.has('learning:left:pallidum-internal'));
    const teachingOnly = (id: string) => id.startsWith('learning:');
    const legend = legendFor({ ...state, paint }, { ...both, drawn: teachingOnly })!;
    assert.deepEqual(
      legend.rows.map((row) => row.absent),
      legend.rows.map(() => false),
    );
  });

  test('STATE-56 every function, term, deficit and finding has a paint and a key in both languages', () => {
    assert.equal(published.domains.length, 70);
    const terms = [...published.search!.terms.keys()];
    assert.equal(terms.length, 277);
    const everyDrawn = { ...both, drawn: () => true };
    for (const id of [ALL_DOMAINS, ...published.domains.map((d) => d.id), ...terms]) {
      const state = functionState(id);
      const paint = paintFor(state, both)!;
      assert.equal(paint.id, `function:${id}`, id);
      assert.equal(paintFor({ ...state, atlas: 'destrieux' }, both), null, id);
      if (id === ALL_DOMAINS) continue;
      for (const lang of ['en', 'fr'] as const) {
        const legend = legendFor({ ...state, lang, paint }, everyDrawn)!;
        assert.equal(legend.rows.length, 3, id);
      }
    }
    assert.equal(data.deficits.length, 70);
    for (const deficit of data.deficits) {
      const state: PaintState = {
        explorer: 'deficits',
        atlas: 'destrieux',
        selectedFunction: null,
        selectedDeficit: deficit.id,
        selectedFinding: null,
        paintLifted: false,
        lang: 'en',
      };
      const findings = catalog.paint(deficit.id).findings.map(({ association }) => association.id);
      for (const finding of [null, ...findings]) {
        const chosen = { ...state, selectedFinding: finding };
        const paint = paintFor(chosen, both)!;
        assert.equal(
          paint.id,
          finding ? `deficit:${deficit.id}:${finding}` : `deficit:${deficit.id}`,
        );
        assert.equal(paintFor({ ...chosen, paintLifted: true }, both), null);
        for (const lang of ['en', 'fr'] as const) {
          const legend = legendFor({ ...chosen, lang, paint }, everyDrawn)!;
          assert.equal(legend.title, deficit.name[lang === 'en' ? 'en' : 'fr'], deficit.id);
          assert.equal(legend.rows.length, findings.length, deficit.id);
        }
      }
    }
  });
});

describe('the lesion', () => {
  const lesion = {
    kind: 'deficits' as const,
    paint: paintOf('lesion:-45,-25,30:15'),
    rows: [
      { id: 'naming', color: [57, 135, 229] as const, title: { en: 'Naming', fr: 'Dénomination' } },
    ],
  };
  const anatomy: PaintState = { ...base, explorer: 'anatomy' };

  test('paints the findings near it while Anatomy, where its report is, is in front', () => {
    assert.equal(paintFor(anatomy, { ...sources, lesion })!.id, 'lesion:-45,-25,30:15');
    assert.equal(paintFor({ ...anatomy, paintLifted: true }, { ...sources, lesion }), null);
    assert.equal(paintFor(anatomy, { ...sources, lesion: null }), null);
    // Another tab's own paint is that tab's.
    assert.equal(paintFor(base, { ...sources, lesion })!.id, 'function:all');
  });

  test('keys each coloured finding by its title', () => {
    const legend = legendFor(
      { ...anatomy, lang: 'fr', paint: lesion.paint },
      { ...sources, lesion },
    );
    assert.equal(legend!.map, 'lesion');
    assert.equal(legend!.pickable, false);
    assert.deepEqual(legend!.rows, [
      { id: 'naming', color: [57, 135, 229], label: 'Dénomination', pressed: false },
    ]);
  });
});
