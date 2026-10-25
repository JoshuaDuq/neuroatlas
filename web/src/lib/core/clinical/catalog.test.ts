import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  FINDING_COLORS,
  createClinicalCatalog,
  findingPaint,
  groupDeficits,
  mappedRegionIds,
} from './catalog.ts';
import type { ClinicalData } from './types.ts';

const text = { en: 'Memory', fr: 'Mémoire' };
const manifest = {
  regions: [
    {
      id: 'aseg:left:17',
      label: 'Left-Hippocampus',
      atlas: 'aseg',
      kind: 'structure',
      source_name: 'Left-Hippocampus',
      hemisphere: 'left',
    },
  ],
} as const;

function fixture() {
  return structuredClone({
    revised: '2026-09-11',
    groups: [
      {
        id: 'memory',
        name: { en: 'Memory and navigation', fr: 'Mémoire et orientation spatiale' },
      },
    ],
    deficits: [
      {
        id: 'amnesia',
        name: { en: 'Amnesia', fr: 'Amnésie' },
        group: 'memory',
        domain: text,
        summary: text,
        aliases: { en: ['forgetfulness'], fr: ['oubli'] },
      },
    ],
    references: [
      {
        id: 'memory-study',
        title: 'Memory study',
        authors: 'Author A',
        year: 1986,
        journal: 'Journal of Neuroscience',
        doi: '10.1523/example',
        pmid: '3760943',
        method: 'case-report',
        population: text,
        scope: 'abstract',
      },
    ],
    associations: [
      {
        id: 'hippocampal-amnesia',
        deficit: 'amnesia',
        title: text,
        finding: text,
        limitation: text,
        network: text,
        mapping_note: text,
        laterality: 'left',
        evidence: [{ reference: 'memory-study', role: 'supporting' }],
        mappings: [{ region: 'aseg:left:17', source_name: 'Left-Hippocampus' }],
      },
    ],
  }) as Record<string, any>;
}

const create = (data: object, regions: readonly object[] = manifest.regions) =>
  createClinicalCatalog(
    data as ClinicalData,
    { regions } as Parameters<typeof createClinicalCatalog>[1],
  );

test('deficit search supports translated names, domains, synonyms and accents', () => {
  const catalog = create(fixture());
  for (const [query, lang] of [
    ['amnesie', 'fr'],
    ['mémoire', 'fr'],
    ['oubli', 'fr'],
    ['forgetfulness', 'en'],
    ['memory', 'en'],
  ] as const) {
    assert.deepEqual(
      catalog.search(query, lang).map((d) => d.id),
      ['amnesia'],
    );
  }
  assert.equal(catalog.search('', 'en').length, 1);
  assert.deepEqual(catalog.search('unlisted', 'en'), []);
});

test('both exploration routes resolve the same cited association', () => {
  const catalog = create(fixture());
  const [association] = catalog.forDeficit('amnesia');
  assert.equal(catalog.forRegion('aseg:left:17')[0], association);
  assert.equal(catalog.reference(association.evidence[0].reference).pmid, '3760943');
  assert.equal(catalog.get(association.deficit).name.fr, 'Amnésie');
});

test('an uncovered region has empty coverage without inheriting another atlas mapping', () => {
  const extra = {
    id: 'hcp-mmp:left:1',
    source_name: 'L_V1_ROI',
    hemisphere: 'left',
    kind: 'cortex',
    atlas: 'hcp-mmp',
  };
  const catalog = create(fixture(), [...manifest.regions, extra]);
  assert.deepEqual(catalog.forRegion(extra.id), []);
  assert.throws(() => catalog.get('unknown'), /Unknown deficit/);
});

test('invalid scientific links and missing translations fail with record context', () => {
  const cases: [(data: ReturnType<typeof fixture>) => void, RegExp][] = [
    [
      (data) => {
        data.deficits.push(data.deficits[0]);
      },
      /Duplicate deficit.*amnesia/,
    ],
    [
      (data) => {
        data.associations[0].deficit = 'missing';
      },
      /hippocampal-amnesia.*deficit/,
    ],
    [
      (data) => {
        data.associations[0].evidence[0].reference = 'missing';
      },
      /hippocampal-amnesia.*reference/,
    ],
    [
      (data) => {
        data.associations[0].evidence = [];
      },
      /hippocampal-amnesia.*supporting/,
    ],
    [
      (data) => {
        data.associations[0].mappings[0].region = 'aseg:right:53';
      },
      /hippocampal-amnesia.*region/,
    ],
    [
      (data) => {
        data.associations[0].mappings[0].source_name = 'Right-Hippocampus';
      },
      /hippocampal-amnesia.*source_name/,
    ],
    [
      (data) => {
        data.associations[0].laterality = 'right';
      },
      /hippocampal-amnesia.*hemisphere/,
    ],
    [
      (data) => {
        data.deficits[0].summary = { en: 'Memory' } as never;
      },
      /amnesia.*summary.fr/,
    ],
    [
      (data) => {
        data.references[0].doi = 'javascript:alert(1)';
      },
      /memory-study.*doi/,
    ],
    [
      (data) => {
        data.references[0].corrections = [{ doi: 'erratum', summary: text }];
      },
      /memory-study.*correction doi/,
    ],
    [
      (data) => {
        data.references[0].corrections = [
          { doi: '10.1523/erratum', summary: { en: 'Fix' } as never },
        ];
      },
      /memory-study.*correction summary.fr/,
    ],
    [
      (data) => {
        data.deficits[0].group = 'invented';
      },
      /amnesia.*group/,
    ],
    [
      (data) => {
        data.groups.push({ id: 'empty', name: text });
      },
      /empty.*no deficits/,
    ],
    [
      (data) => {
        delete (data.groups[0].name as Record<string, string>).fr;
      },
      /memory.*name.fr/,
    ],
  ];
  for (const [mutate, expected] of cases) {
    const data = fixture();
    mutate(data);
    assert.throws(() => create(data), expected);
  }
});

test('deficits list under their group in authored group order, empty groups omitted', () => {
  const groups = [{ id: 'language' }, { id: 'memory' }, { id: 'motor' }];
  const deficits = [
    { id: 'amnesia', group: 'memory' },
    { id: 'aphasia', group: 'language' },
    { id: 'dysarthria', group: 'language' },
  ];
  assert.deepEqual(
    groupDeficits(groups, deficits).map(({ group, deficits }) => [
      group.id,
      deficits.map((d) => d.id),
    ]),
    [
      ['language', ['aphasia', 'dysarthria']],
      ['memory', ['amnesia']],
    ],
  );
  assert.deepEqual(groupDeficits(groups, []), []);
  const catalog = create(fixture());
  assert.deepEqual(
    catalog.grouped('oubli', 'fr').map((entry) => entry.group.name.fr),
    ['Mémoire et orientation spatiale'],
  );
  assert.deepEqual(catalog.grouped('unlisted', 'en'), []);
});

test('a deficit maps each cited region once, in citation order', () => {
  const associations = [
    { mappings: [{ region: 'a' }, { region: 'b' }] },
    { mappings: [] },
    { mappings: [{ region: 'b' }, { region: 'c' }] },
  ];
  assert.deepEqual(mappedRegionIds(associations), ['a', 'b', 'c']);
  const catalog = create(fixture());
  assert.deepEqual(catalog.mappedRegions('amnesia'), ['aseg:left:17']);
  assert.throws(() => catalog.mappedRegions('unknown'), /Unknown deficit/);
});

test('each finding takes the next colour, a region shared by two the first, and one finding can be shown alone', () => {
  const associations = [
    { id: 'naming', mappings: [{ region: 'a' }, { region: 'b' }] },
    { id: 'repetition', mappings: [{ region: 'b' }, { region: 'c' }] },
  ];
  const all = findingPaint('aphasia', associations);
  assert.deepEqual(
    all.findings.map(({ association, color }) => [association.id, color]),
    [
      ['naming', FINDING_COLORS[0]],
      ['repetition', FINDING_COLORS[1]],
    ],
  );
  assert.equal(all.paint.id, 'deficit:aphasia');
  assert.deepEqual(
    [...all.paint.colors],
    [
      ['a', FINDING_COLORS[0]],
      ['b', FINDING_COLORS[0]],
      ['c', FINDING_COLORS[1]],
    ],
  );
  const alone = findingPaint('aphasia', associations, 'repetition');
  assert.equal(alone.paint.id, 'deficit:aphasia:repetition');
  assert.deepEqual(
    [...alone.paint.colors],
    [
      ['b', FINDING_COLORS[1]],
      ['c', FINDING_COLORS[1]],
    ],
  );
  assert.throws(
    () => findingPaint('aphasia', associations, 'reading'),
    /aphasia has no finding reading/,
  );
});
