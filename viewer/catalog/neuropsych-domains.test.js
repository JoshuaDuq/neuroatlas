import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_DOMAINS, domainAreas, domainPaint, domainRecord, domainsOf, domainStudies, groupedDomains, matchingTerms,
  nearestName, overviewDomains, scoredRegion, shownDomain, validateNeuropsychDomains,
} from './neuropsych-domains.js';

const regions = new Map([['hcp-mmp:left:1', { atlas: 'hcp-mmp', kind: 'cortex' }],
  ['hcp-mmp:right:1', { atlas: 'hcp-mmp', kind: 'cortex' }], ['destrieux:left:1', { atlas: 'destrieux' }],
  ['aseg:left:18', { atlas: 'aseg', kind: 'structure', source_name: 'Left-Amygdala' }],
  ['aseg:left:4', { atlas: 'aseg', kind: 'structure', source_name: 'Left-Lateral-Ventricle' }]]);
const partition = () => ({
  id: 'neuropsych-domains', atlas: 'hcp-mmp', structure_atlas: 'aseg', structures: ['Left-Amygdala'], threshold_z: 3,
  groups: [
    { id: 'cognition', name: 'Cognition', name_fr: 'Cognition' },
    { id: 'perception', name: 'Perception', name_fr: 'Perception' },
  ],
  domains: [
    { id: 'language', term: 'language', group: 'cognition', name: 'Language', name_fr: 'Langage', overview: true, color: [1, 2, 3] },
    { id: 'memory', term: 'episodic memory', group: 'cognition', name: 'Memory', name_fr: 'Mémoire', overview: true, color: [4, 5, 6] },
    { id: 'visual', term: 'visual', group: 'perception', name: 'Visual', name_fr: 'Visuel', overview: true, color: [7, 8, 9] },
  ],
  lesion_checks: { language: [], memory: [], visual: [] },
  derivation: { studies: { language: 1101, memory: 332, visual: 3110 } },
  regions: {
    'hcp-mmp:left:1': [{ domain: 'memory', z: 7.5 }, { domain: 'language', z: 3.2 }],
    'hcp-mmp:right:1': [{ domain: 'language', z: 4.1 }],
    'aseg:left:18': [{ domain: 'memory', z: 3.5 }],
  },
});

test('an area lists its domains strongest first and is drawn as the strongest unless one is picked', () => {
  const published = validateNeuropsychDomains(partition(), regions);
  assert.deepEqual(domainsOf(published, 'hcp-mmp:left:1').map(record => [record.id, record.z]),
    [['memory', 7.5], ['language', 3.2]]);
  assert.equal(shownDomain(published, 'hcp-mmp:left:1', null).id, 'memory');
  assert.equal(shownDomain(published, 'hcp-mmp:left:1', 'language').id, 'language');
  assert.deepEqual(domainsOf(published, 'hcp-mmp:left:2'), []);
  assert.equal(shownDomain(published, 'hcp-mmp:left:2', null), null);
});

test('a domain assigned below the threshold, off its atlas or unknown is rejected', () => {
  for (const [change, message] of [
    [p => { p.regions['hcp-mmp:left:1'][1].z = 2.9; }, /assignment: hcp-mmp:left:1/],
    [p => { p.regions['destrieux:left:1'] = [{ domain: 'memory', z: 4 }]; }, /assignment: destrieux:left:1/],
    [p => { p.regions['hcp-mmp:left:1'][0].domain = 'praxis'; }, /assignment: hcp-mmp:left:1/],
    [p => { delete p.lesion_checks.memory; }, /domain: memory/],
    [p => { p.domains[2].group = 'action'; }, /domain: visual/],
    [p => { p.regions['aseg:left:4'] = [{ domain: 'memory', z: 4 }]; }, /assignment: aseg:left:4/],
    [p => { p.domains[2].id = ALL_DOMAINS; }, /domain: all/],
    [p => { p.groups.push({ id: 'cognition', name: 'Again', name_fr: 'Encore' }); }, /group: cognition/],
    [p => { delete p.domains[2].overview; }, /domain: visual/],
    [p => { delete p.derivation.studies.visual; }, /domain: visual/],
    [p => { for (const domain of p.domains) domain.overview = false; }, /No neuropsychological domain is in the overview/],
  ]) {
    const broken = partition();
    change(broken);
    assert.throws(() => validateNeuropsychDomains(broken, regions), message);
  }
});

test('the list groups domains in authored order and finds them by either name or by term, accents aside', () => {
  const published = validateNeuropsychDomains(partition(), regions);
  assert.deepEqual(groupedDomains(published, '', 'fr').map(entry => [entry.name, entry.domains.map(d => d.id)]),
    [['Cognition', ['language', 'memory']], ['Perception', ['visual']]]);
  assert.deepEqual(groupedDomains(published, 'EPISODIC', 'en').map(entry => entry.domains.map(d => d.id)), [['memory']]);
  assert.deepEqual(groupedDomains(published, 'memoire', 'en').map(entry => entry.domains.map(d => d.id)), [['memory']]);
  assert.deepEqual(groupedDomains(published, 'praxis', 'en'), []);
});

test('a domain lists its every area strongest first, overlaps included', () => {
  const published = validateNeuropsychDomains(partition(), regions);
  assert.deepEqual(domainAreas(published, 'language'),
    [{ region: 'hcp-mmp:right:1', z: 4.1 }, { region: 'hcp-mmp:left:1', z: 3.2 }]);
  assert.deepEqual(domainAreas(published, 'visual'), []);
});

test('the overview paints each area its strongest domain, and one domain paints its every area', () => {
  const published = validateNeuropsychDomains(partition(), regions);
  const all = domainPaint(published, ALL_DOMAINS);
  assert.equal(all.id, 'function:all');
  assert.deepEqual([...all.colors],
    [['hcp-mmp:left:1', [4, 5, 6]], ['hcp-mmp:right:1', [1, 2, 3]], ['aseg:left:18', [4, 5, 6]]]);
  assert.deepEqual([...domainPaint(published, 'language').colors],
    [['hcp-mmp:left:1', [1, 2, 3]], ['hcp-mmp:right:1', [1, 2, 3]]]);
  assert.equal(domainPaint(published, 'visual').colors.size, 0);
  assert.throws(() => domainPaint(published, 'praxis'), /Unknown neuropsychological domain: praxis/);
});

test('the overview draws an area as its strongest overview domain, passing over one shown only alone', () => {
  const published = partition();
  published.domains[1].overview = false;
  validateNeuropsychDomains(published, regions);
  assert.deepEqual(overviewDomains(published).map(domain => domain.id), ['language', 'visual']);
  // Memory is hcp-mmp:left:1's strongest domain, but not an overview one.
  assert.equal(shownDomain(published, 'hcp-mmp:left:1', null).id, 'language');
  assert.equal(shownDomain(published, 'hcp-mmp:left:1', 'memory').id, 'memory');
  assert.deepEqual([...domainPaint(published, ALL_DOMAINS).colors.values()], [[1, 2, 3], [1, 2, 3]]);
});

test('a sampled structure is scored like an area; another structure, or another atlas, is not', () => {
  const published = validateNeuropsychDomains(partition(), regions);
  assert.equal(scoredRegion(published, regions.get('aseg:left:18')), true);
  assert.equal(scoredRegion(published, regions.get('aseg:left:4')), false);
  assert.equal(scoredRegion(published, regions.get('hcp-mmp:left:1')), true);
  assert.equal(scoredRegion(published, regions.get('destrieux:left:1')), false);
  assert.deepEqual(domainAreas(published, 'memory'), [{ region: 'hcp-mmp:left:1', z: 7.5 }, { region: 'aseg:left:18', z: 3.5 }]);
  assert.deepEqual(domainPaint(published, 'memory').colors.get('aseg:left:18'), [4, 5, 6]);
});

const terms = () => ({
  id: 'neurosynth-terms', atlas: 'hcp-mmp', structure_atlas: 'aseg', threshold_z: 3, color: [0, 114, 178],
  derivation: {}, regions: ['aseg:left:18', 'hcp-mmp:left:1', 'hcp-mmp:right:1'],
  terms: [
    ['fear', 363, 'function', [[0, 9.1], [1, 3.4]]],
    ['fear conditioning', 120, 'function', [[0, 6.2]]],
    ['conditioned fear', 90, 'function', [[2, 3]]],
    ['interference', 400, 'function', [[2, 3]]],
    ['aphasia', 205, 'population', [[1, 4]]],
  ],
});

test('searched terms paint the regions they reach in one colour and keep their kind', () => {
  const published = validateNeuropsychDomains(partition(), regions, terms());
  assert.equal(domainRecord(published, 'term:language'), null);
  assert.equal(domainRecord(published, 'term:aphasia').kind, 'population');
  assert.equal(domainStudies(published, 'term:fear'), 363);
  assert.equal(domainStudies(published, 'language'), 1101);
  assert.deepEqual(domainAreas(published, 'term:fear'), [{ region: 'aseg:left:18', z: 9.1 }, { region: 'hcp-mmp:left:1', z: 3.4 }]);
  assert.deepEqual([...domainPaint(published, 'term:fear').colors], [['aseg:left:18', [0, 114, 178]], ['hcp-mmp:left:1', [0, 114, 178]]]);
  assert.equal(domainPaint(published, 'term:fear').id, 'function:term:fear');
  assert.throws(() => domainPaint(published, 'term:praxis'), /Unknown neuropsychological domain: term:praxis/);
});

test('a term search ranks the term itself, then word starts, then the rest, larger literatures first', () => {
  const published = validateNeuropsychDomains(partition(), regions, terms());
  assert.deepEqual(matchingTerms(published, ' Fear ').map(record => record.term), ['fear', 'fear conditioning', 'conditioned fear']);
  assert.deepEqual(matchingTerms(published, 'cond').map(record => record.term), ['fear conditioning', 'conditioned fear']);
  assert.deepEqual(matchingTerms(published, 'fer').map(record => record.term), ['interference']);
  assert.deepEqual(matchingTerms(published, ''), []);
  assert.deepEqual(matchingTerms(validateNeuropsychDomains(partition(), regions), 'fear'), []);
});

test('a term below the threshold, reaching nothing, of no kind, repeating a curated function or off its atlas is rejected', () => {
  for (const [change, message] of [
    [p => { p.terms[0][3][1][1] = 2.9; }, /term: fear/],
    [p => { p.terms[0][3][1][0] = 7; }, /term: fear/],
    [p => { p.terms.push(['fear', 1, 'function', [[0, 4]]]); }, /term: fear/],
    [p => { p.terms[2][3] = []; }, /term: conditioned fear/],
    [p => { p.terms[0][2] = 'anatomy'; }, /term: fear/],
    [p => { p.terms.push(['language', 1101, 'function', [[1, 5]]]); }, /term: language/],
    [p => { p.regions.push('aseg:left:4'); }, /term region: aseg:left:4/],
    [p => { p.threshold_z = 2; }, /Invalid Neurosynth term search/],
    [p => { p.atlas = 'destrieux'; }, /Invalid Neurosynth term search/],
  ]) {
    const broken = terms();
    change(broken);
    assert.throws(() => validateNeuropsychDomains(partition(), regions, broken), message);
  }
});

test('a misspelt query is offered the closest name or term within one edit per four letters', () => {
  const published = validateNeuropsychDomains(partition(), regions, terms());
  assert.equal(nearestName(published, 'Langauge', 'en'), 'Language');
  assert.equal(nearestName(published, 'interferance', 'en'), 'interference');
  assert.equal(nearestName(published, 'memoire', 'fr'), 'Mémoire');
  assert.equal(nearestName(published, 'nicotine', 'en'), null);
  assert.equal(nearestName(published, 'fea', 'en'), null);
});
