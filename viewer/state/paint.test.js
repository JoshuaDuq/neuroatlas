import assert from 'node:assert/strict';
import test from 'node:test';
import { legendFor, paintFor, paintKind } from './paint.js';
import { findingPaint } from '../clinical/catalog.js';

const domains = {
  atlas: 'hcp-mmp',
  domains: [
    { id: 'language', name: 'Language', name_fr: 'Langage', overview: true, color: [1, 2, 3] },
    { id: 'memory', name: 'Memory', name_fr: 'Mémoire', overview: true, color: [4, 5, 6] },
    { id: 'reading', name: 'Reading', name_fr: 'Lecture', overview: false, color: [7, 8, 9] },
  ],
  regions: { 'hcp-mmp:left:1': [{ domain: 'memory', z: 7 }, { domain: 'language', z: 4 }] },
};
const associations = [
  { id: 'naming', title: { en: 'Naming', fr: 'Dénomination' }, mappings: [{ region: 'destrieux:left:1' }] },
  { id: 'repetition', title: { en: 'Repetition', fr: 'Répétition' }, mappings: [{ region: 'destrieux:left:2' }] },
];
const clinical = {
  paint: (id, finding) => findingPaint(id, associations, finding),
  get: () => ({ name: { en: 'Aphasia', fr: 'Aphasie' } }),
};
const sources = { domains, clinical };
const base = { explorer: 'functions', atlas: 'hcp-mmp', selectedFunction: 'all', selectedDeficit: 'aphasia',
  selectedFinding: null, paintLifted: false, lang: 'en' };

test('a tab paints only while it is in front, on the atlas its map is defined on, and not once lifted', () => {
  assert.equal(paintFor(base, sources).id, 'function:all');
  assert.equal(paintFor({ ...base, atlas: 'destrieux' }, sources), null);
  assert.equal(paintFor({ ...base, selectedFunction: null }, sources), null);
  assert.equal(paintFor({ ...base, paintLifted: true }, sources), null);
  assert.equal(paintFor({ ...base, explorer: 'anatomy' }, sources), null);
  assert.equal(paintFor({ ...base, explorer: 'deficits', atlas: 'destrieux' }, sources).id, 'deficit:aphasia');
  assert.equal(paintFor({ ...base, explorer: 'deficits', selectedFinding: 'naming' }, sources).id,
    'deficit:aphasia:naming');
  assert.equal(paintFor({ ...base, explorer: 'deficits', selectedDeficit: null }, sources), null);
});

test('the key lists the overview, or only the function chosen, or each finding of the open deficit', () => {
  const paint = { id: 'function:memory' };
  const functions = legendFor({ ...base, selectedFunction: 'memory', paint, lang: 'fr' }, sources);
  assert.equal(functions.map, 'function');
  assert.deepEqual(functions.rows.map(row => [row.label, row.pressed]), [['Mémoire', true]]);
  const overview = legendFor({ ...base, paint: { id: 'function:all' } }, sources);
  assert.deepEqual(overview.rows.map(row => [row.id, row.pressed]), [['language', false], ['memory', false]]);
  const alone = legendFor({ ...base, selectedFunction: 'reading', paint: { id: 'function:reading' } }, sources);
  assert.deepEqual(alone.rows.map(row => [row.id, row.pressed]), [['reading', true]]);
  const deficit = legendFor({ ...base, explorer: 'deficits', paint: { id: 'deficit:aphasia' } }, sources);
  assert.equal(deficit.title, 'Aphasia');
  assert.deepEqual(deficit.rows.map(row => [row.id, row.label, row.pressed]),
    [['naming', 'Naming', false], ['repetition', 'Repetition', false]]);
  assert.equal(legendFor({ ...base, paint: null }, sources), null);
});

test('a paint names its tab by its id', () => {
  assert.equal(paintKind({ id: 'function:language' }), 'function');
  assert.equal(paintKind({ id: 'deficit:aphasia:naming' }), 'deficit');
  assert.equal(paintKind(null), null);
});
