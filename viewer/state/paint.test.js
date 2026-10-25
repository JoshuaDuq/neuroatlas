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
  z_scale: [{ from: 3, color: [30, 30, 30] }, { from: 5, color: [50, 50, 50] }, { from: 10, color: [90, 90, 90] }],
};
const associations = [
  { id: 'naming', title: { en: 'Naming', fr: 'Dénomination' }, mappings: [{ region: 'destrieux:left:1' }] },
  { id: 'repetition', title: { en: 'Repetition', fr: 'Répétition' }, mappings: [{ region: 'destrieux:left:2' }] },
];
const clinical = {
  paint: (id, finding) => findingPaint(id, associations, finding),
  get: () => ({ name: { en: 'Aphasia', fr: 'Aphasie' } }),
};
const drawn = new Set(['destrieux:left:1', 'destrieux:left:2']);
const sources = { domains, clinical, drawn: id => drawn.has(id) };
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

test('the key lists the overview, or the z scale of the function chosen, or each finding of the open deficit', () => {
  const paint = { id: 'function:memory' };
  const functions = legendFor({ ...base, selectedFunction: 'memory', paint, lang: 'fr' }, sources);
  assert.equal(functions.map, 'function');
  assert.equal(functions.title, 'Mémoire');
  assert.equal(functions.pickable, false);
  assert.deepEqual(functions.rows.map(row => [row.label, row.color]),
    [['z\u00a0≥\u00a010', [90, 90, 90]], ['z\u00a05\u00a0à\u00a010', [50, 50, 50]], ['z\u00a03\u00a0à\u00a05', [30, 30, 30]]]);
  const overview = legendFor({ ...base, paint: { id: 'function:all' } }, sources);
  assert.deepEqual(overview.rows.map(row => [row.id, row.pressed]), [['language', false], ['memory', false]]);
  assert.notEqual(overview.pickable, false);
  const deficit = legendFor({ ...base, explorer: 'deficits', paint: clinical.paint('aphasia').paint }, sources);
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

test('a finding none of whose regions is drawn coloured is keyed as absent, and the note says why', () => {
  const state = { ...base, explorer: 'deficits', paint: clinical.paint('aphasia').paint };
  assert.deepEqual(legendFor(state, sources).rows.map(row => row.absent), [false, false]);
  drawn.delete('destrieux:left:2');
  const hidden = legendFor(state, sources);
  assert.deepEqual(hidden.rows.map(row => row.absent), [false, true]);
  assert.match(hidden.note, /outlined finding has no region coloured/);
  const picked = legendFor({ ...state, selectedFinding: 'naming', paint: clinical.paint('aphasia', 'naming').paint }, sources);
  assert.deepEqual(picked.rows.map(row => row.absent), [false, false], 'a finding not picked is muted, not absent');
  drawn.add('destrieux:left:2');
});
