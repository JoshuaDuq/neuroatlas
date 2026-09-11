import assert from 'node:assert/strict';
import test from 'node:test';
import { createClinicalCatalog } from './catalog.js';

const text = { en: 'Memory', fr: 'Mémoire' };
const manifest = { regions: [{
  id: 'aseg:left:17', atlas: 'aseg', kind: 'structure',
  source_name: 'Left-Hippocampus', hemisphere: 'left',
}] };

function fixture() {
  return structuredClone({
    revised: '2026-09-11',
    deficits: [{ id: 'amnesia', name: { en: 'Amnesia', fr: 'Amnésie' },
      domain: text, summary: text, aliases: { en: ['forgetfulness'], fr: ['oubli'] } }],
    references: [{ id: 'memory-study', title: 'Memory study', authors: 'Author A',
      year: 1986, journal: 'Journal of Neuroscience', doi: '10.1523/example',
      pmid: '3760943', method: 'case-report', population: text, scope: 'abstract' }],
    associations: [{ id: 'hippocampal-amnesia', deficit: 'amnesia',
      title: text, finding: text, limitation: text, network: text, mapping_note: text,
      laterality: 'left',
      evidence: [{ reference: 'memory-study', role: 'supporting' }],
      mappings: [{ region: 'aseg:left:17', source_name: 'Left-Hippocampus' }] }],
  });
}

test('deficit search supports translated names, domains, synonyms and accents', () => {
  const catalog = createClinicalCatalog(fixture(), manifest);
  for (const [query, lang] of [['amnesie', 'fr'], ['mémoire', 'fr'],
    ['oubli', 'fr'], ['forgetfulness', 'en'], ['memory', 'en']]) {
    assert.deepEqual(catalog.search(query, lang).map(d => d.id), ['amnesia']);
  }
  assert.equal(catalog.search('', 'en').length, 1);
  assert.deepEqual(catalog.search('unlisted', 'en'), []);
});

test('both exploration routes resolve the same cited association', () => {
  const catalog = createClinicalCatalog(fixture(), manifest);
  const [association] = catalog.forDeficit('amnesia');
  assert.equal(catalog.forRegion('aseg:left:17')[0], association);
  assert.equal(catalog.reference(association.evidence[0].reference).pmid, '3760943');
  assert.equal(catalog.get(association.deficit).name.fr, 'Amnésie');
});

test('an uncovered region has empty coverage without inheriting another atlas mapping', () => {
  const extra = { id: 'hcp-mmp:left:1', source_name: 'L_V1_ROI',
    hemisphere: 'left', kind: 'cortex', atlas: 'hcp-mmp' };
  const catalog = createClinicalCatalog(fixture(), { regions: [...manifest.regions, extra] });
  assert.deepEqual(catalog.forRegion(extra.id), []);
  assert.throws(() => catalog.get('unknown'), /Unknown deficit/);
});

test('invalid scientific links and missing translations fail with record context', () => {
  const cases = [
    [data => { data.deficits.push(data.deficits[0]); }, /Duplicate deficit.*amnesia/],
    [data => { data.associations[0].deficit = 'missing'; }, /hippocampal-amnesia.*deficit/],
    [data => { data.associations[0].evidence[0].reference = 'missing'; }, /hippocampal-amnesia.*reference/],
    [data => { data.associations[0].evidence = []; }, /hippocampal-amnesia.*supporting/],
    [data => { data.associations[0].mappings[0].region = 'aseg:right:53'; }, /hippocampal-amnesia.*region/],
    [data => { data.associations[0].mappings[0].source_name = 'Right-Hippocampus'; }, /hippocampal-amnesia.*source_name/],
    [data => { data.associations[0].laterality = 'right'; }, /hippocampal-amnesia.*hemisphere/],
    [data => { data.deficits[0].summary = { en: 'Memory' }; }, /amnesia.*summary.fr/],
    [data => { data.references[0].doi = 'javascript:alert(1)'; }, /memory-study.*doi/],
  ];
  for (const [mutate, expected] of cases) {
    const data = fixture();
    mutate(data);
    assert.throws(() => createClinicalCatalog(data, manifest), expected);
  }
});
