import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { createClinicalCatalog } from './catalog.ts';
import type { ClinicalData } from './types.ts';

const text = () => ({ en: 'Memory', fr: 'Mémoire' });
const regions = [
  {
    id: 'aseg:left:17',
    atlas: 'aseg',
    kind: 'structure',
    source_name: 'Left-Hippocampus',
    hemisphere: 'left',
  },
  {
    id: 'aseg:right:53',
    atlas: 'aseg',
    kind: 'structure',
    source_name: 'Right-Hippocampus',
    hemisphere: 'right',
  },
  {
    id: 'destrieux:left:1',
    atlas: 'destrieux',
    kind: 'cortex',
    source_name: 'G_and_S_frontomargin',
    hemisphere: 'left',
  },
  {
    id: 'destrieux:left:-1',
    atlas: 'destrieux',
    kind: 'non-region',
    source_name: 'Unknown',
    hemisphere: 'left',
  },
];

type Fixture = { data: Record<string, any>; regions: Record<string, any>[] };

function fixture(): Fixture {
  return structuredClone({
    data: {
      revised: '2026-09-11',
      groups: [{ id: 'memory', name: text() }],
      deficits: [
        {
          id: 'amnesia',
          name: text(),
          group: 'memory',
          domain: text(),
          summary: text(),
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
          population: text(),
          scope: 'abstract',
        },
      ],
      associations: [
        {
          id: 'hippocampal-amnesia',
          deficit: 'amnesia',
          title: text(),
          finding: text(),
          limitation: text(),
          network: text(),
          mapping_note: text(),
          laterality: 'left',
          evidence: [{ reference: 'memory-study', role: 'supporting' }],
          mappings: [{ region: 'aseg:left:17', source_name: 'Left-Hippocampus' }],
        },
      ],
    },
    regions,
  });
}

const create = ({ data, regions }: Fixture) =>
  createClinicalCatalog(data as ClinicalData, { regions } as never);

const prefix = 'Invalid clinical catalog: ';
const [association, reference, deficit, group] = [
  (f: Fixture) => f.data.associations[0],
  (f: Fixture) => f.data.references[0],
  (f: Fixture) => f.data.deficits[0],
  (f: Fixture) => f.data.groups[0],
];

const rejections: [string, (f: Fixture) => void, string][] = [
  [
    'a revision date not YYYY-MM-DD',
    (f) => (f.data.revised = '2026-9-1'),
    'revision date is required',
  ],
  ['a missing revision date', (f) => delete f.data.revised, 'revision date is required'],
  ['no groups', (f) => (f.data.groups = []), 'group records are required'],
  ['groups that are not a list', (f) => (f.data.groups = {}), 'group records are required'],
  ['no deficits', (f) => (f.data.deficits = []), 'deficit records are required'],
  ['no references', (f) => (f.data.references = []), 'reference records are required'],
  ['no associations', (f) => (f.data.associations = []), 'association records are required'],
  ['no manifest regions', (f) => (f.regions.length = 0), 'region records are required'],
  ['a blank group id', (f) => (group(f).id = '  '), 'group id is required'],
  ['a null group id', (f) => (group(f).id = null), 'group id is required'],
  ['a numeric group id', (f) => (group(f).id = 3), 'group id is required'],
  ['a null deficit record', (f) => (f.data.deficits[0] = null), 'deficit id is required'],
  ['a repeated group', (f) => f.data.groups.push(group(f)), 'Duplicate group: memory'],
  ['a repeated deficit', (f) => f.data.deficits.push(deficit(f)), 'Duplicate deficit: amnesia'],
  [
    'a repeated reference',
    (f) => f.data.references.push(reference(f)),
    'Duplicate reference: memory-study',
  ],
  [
    'a repeated association',
    (f) => f.data.associations.push(association(f)),
    'Duplicate association: hippocampal-amnesia',
  ],
  ['a repeated region', (f) => f.regions.push(f.regions[0]), 'Duplicate region: aseg:left:17'],
  ['an unknown group', (f) => (deficit(f).group = 'invented'), 'amnesia: unknown group invented'],
  [
    'a group with no deficit',
    (f) => f.data.groups.push({ id: 'orphan', name: text() }),
    'orphan: group has no deficits',
  ],
  ['a blank title', (f) => (reference(f).title = ''), 'memory-study: title is required'],
  ['a numeric authors', (f) => (reference(f).authors = 4), 'memory-study: authors is required'],
  ['a missing journal', (f) => delete reference(f).journal, 'memory-study: journal is required'],
  [
    'a year of 1799',
    (f) => (reference(f).year = 1799),
    'memory-study: year must be a publication year',
  ],
  [
    'a fractional year',
    (f) => (reference(f).year = 2020.5),
    'memory-study: year must be a publication year',
  ],
  [
    'a year written as text',
    (f) => (reference(f).year = '1990'),
    'memory-study: year must be a publication year',
  ],
  [
    'a script as DOI',
    (f) => (reference(f).doi = 'javascript:alert(1)'),
    'memory-study: invalid doi',
  ],
  [
    'a DOI with a short registrant',
    (f) => (reference(f).doi = '10.12/x'),
    'memory-study: invalid doi',
  ],
  ['a DOI with no suffix', (f) => (reference(f).doi = '10.1234/'), 'memory-study: invalid doi'],
  ['a PMID with a letter', (f) => (reference(f).pmid = '12a'), 'memory-study: invalid pmid'],
  ['an empty PMID', (f) => (reference(f).pmid = ''), 'memory-study: invalid pmid'],
  ['an unknown method', (f) => (reference(f).method = 'rumour'), 'memory-study: unknown method'],
  [
    'a title as scope',
    (f) => (reference(f).scope = 'title'),
    'memory-study: source scope is required',
  ],
  [
    'corrections that are not a list',
    (f) => (reference(f).corrections = {}),
    'memory-study: corrections must be a list',
  ],
  [
    'a correction DOI that is not a DOI',
    (f) => (reference(f).corrections = [{ doi: 'erratum', summary: text() }]),
    'memory-study: invalid correction doi',
  ],
  [
    'an unknown deficit',
    (f) => (association(f).deficit = 'missing'),
    'hippocampal-amnesia: unknown deficit',
  ],
  [
    'laterality "both"',
    (f) => (association(f).laterality = 'both'),
    'hippocampal-amnesia: invalid laterality',
  ],
  [
    'no evidence',
    (f) => (association(f).evidence = []),
    'hippocampal-amnesia: supporting evidence is required',
  ],
  [
    'qualifying evidence only',
    (f) => (association(f).evidence[0].role = 'qualifying'),
    'hippocampal-amnesia: supporting evidence is required',
  ],
  [
    'an unknown reference',
    (f) => association(f).evidence.push({ reference: 'missing', role: 'supporting' }),
    'hippocampal-amnesia: unknown reference missing',
  ],
  [
    'an evidence role that is neither supporting nor qualifying',
    (f) => association(f).evidence.push({ reference: 'memory-study', role: 'contrary' }),
    'hippocampal-amnesia: invalid evidence role',
  ],
  [
    'mappings that are not a list',
    (f) => (association(f).mappings = {}),
    'hippocampal-amnesia: mappings must be a list',
  ],
  [
    'a mapped region the atlas lacks',
    (f) => (association(f).mappings[0].region = 'aseg:right:9999'),
    'hippocampal-amnesia: unknown region aseg:right:9999',
  ],
  [
    'a mapped non-region',
    (f) => association(f).mappings.push({ region: 'destrieux:left:-1', source_name: 'Unknown' }),
    'hippocampal-amnesia: unknown region destrieux:left:-1',
  ],
  [
    'a different source name',
    (f) => (association(f).mappings[0].source_name = 'Invented'),
    'hippocampal-amnesia: source_name disagrees with aseg:left:17',
  ],
  [
    'a region on the other side',
    (f) =>
      (association(f).mappings[0] = { region: 'aseg:right:53', source_name: 'Right-Hippocampus' }),
    'hippocampal-amnesia: hemisphere mismatch',
  ],
  [
    'a region mapped twice',
    (f) => association(f).mappings.push({ ...association(f).mappings[0] }),
    'hippocampal-amnesia: duplicate region aseg:left:17',
  ],
];

describe('CAT-44 · the clinical records are checked before use', () => {
  for (const [name, mutate, message] of rejections) {
    test(`CAT-44 · refuses ${name}`, () => {
      const f = fixture();
      mutate(f);
      assert.throws(() => create(f), { message: `${prefix}${message}` });
    });
  }

  // Each language of each translated field, absent and blank, names the record and the field.
  const translated: [string, (f: Fixture) => Record<string, any>, string][] = [
    ['name', group, 'memory'],
    ['name', deficit, 'amnesia'],
    ['domain', deficit, 'amnesia'],
    ['summary', deficit, 'amnesia'],
    ['population', reference, 'memory-study'],
    ...['title', 'finding', 'limitation', 'network', 'mapping_note'].map(
      (field): [string, (f: Fixture) => Record<string, any>, string] => [
        field,
        association,
        'hippocampal-amnesia',
      ],
    ),
  ];
  for (const [field, record, id] of translated) {
    for (const lang of ['en', 'fr']) {
      test(`CAT-44 · refuses a missing or blank ${field}.${lang} of ${id}`, () => {
        for (const value of [undefined, ' ']) {
          const f = fixture();
          const entry = record(f);
          entry[field][lang] = value;
          assert.throws(() => create(f), {
            message: `${prefix}${id}: ${field}.${lang} is required`,
          });
        }
      });
    }
  }
  test('CAT-44 · refuses a missing deficit text object', () => {
    const f = fixture();
    delete deficit(f).summary;
    assert.throws(() => create(f), { message: `${prefix}amnesia: summary.en is required` });
  });

  test('CAT-44 · refuses a correction summary missing or blank in either language', () => {
    for (const summary of [{ en: 'Fix' }, { fr: 'Correctif' }, undefined]) {
      const f = fixture();
      reference(f).corrections = [{ doi: '10.1523/erratum', summary }];
      const lang = summary?.en ? 'fr' : 'en';
      assert.throws(() => create(f), {
        message: `${prefix}memory-study: correction summary.${lang} is required`,
      });
    }
  });

  test('CAT-44 · refuses aliases that are not a list of non-empty terms, in each language', () => {
    for (const lang of ['en', 'fr']) {
      for (const aliases of [undefined, 'oubli', ['ok', ''], ['ok', 3]]) {
        const f = fixture();
        deficit(f).aliases[lang] = aliases;
        assert.throws(() => create(f), {
          message: `${prefix}amnesia: aliases.${lang} must be a list of terms`,
        });
      }
    }
  });

  test('CAT-44 · accepts the boundary values, a valid correction and either spelling of a source name', () => {
    const f = fixture();
    reference(f).year = 1800;
    reference(f).corrections = [{ doi: '10.1523/erratum', summary: text() }];
    assert.doesNotThrow(() => create(f));
    for (const laterality of ['left', 'bilateral']) {
      const g = fixture();
      association(g).laterality = laterality;
      assert.doesNotThrow(() => create(g));
    }
    const spelling = fixture();
    spelling.regions[2].source_name = 'G_and_S_frontomargin';
    association(spelling).mappings = [
      { region: 'destrieux:left:1', source_name: 'G&S_frontomargin' },
    ];
    assert.doesNotThrow(() => create(spelling));
    spelling.regions[2].source_name = 'G&S_frontomargin';
    association(spelling).mappings[0].source_name = 'G_and_S_frontomargin';
    assert.doesNotThrow(() => create(spelling));
  });
});
