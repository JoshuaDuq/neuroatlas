import assert from 'node:assert/strict';
import { test } from 'vitest';
import { lesionSides, regionRows, tractRows } from './report.ts';

const regions = new Map([
  ['destrieux:left:41', { inside: 964, whole: 1181 }],
  ['destrieux:left:38', { inside: 9, whole: 5293 }],
  ['destrieux:left:74', { inside: 1700, whole: 7802 }],
  ['aseg:left:10', { inside: 5, whole: 10 }],
  ['wmparc:right:4031', { inside: 1, whole: 2 }],
]);

test('lists an atlas’s regions by the share inside, folding those under 1%', () => {
  const rows = regionRows(regions, 'destrieux');
  assert.deepEqual(
    rows.shown.map((row) => [row.id, Math.round(row.share * 100)]),
    [
      ['destrieux:left:41', 82],
      ['destrieux:left:74', 22],
    ],
  );
  assert.deepEqual(
    rows.slight.map((row) => row.id),
    ['destrieux:left:38'],
  );
  assert.deepEqual(regionRows(regions, 'hcp-mmp'), { shown: [], slight: [] });
});

test('names the hemispheres the lesion reaches', () => {
  assert.equal(lesionSides(regions), 'both');
  assert.equal(lesionSides(new Map([['destrieux:left:1', { inside: 1, whole: 2 }]])), 'left');
  assert.equal(lesionSides(new Map([['aseg:right:49', { inside: 1, whole: 2 }]])), 'right');
  assert.equal(lesionSides(new Map()), null);
});

test('lists the bundles the lesion crosses by share, and the ones it misses apart', () => {
  const { crossed, missed } = tractRows([
    { id: 'ilf-left', crossing: 1626, total: 3745 },
    { id: 'uf-left', crossing: 0, total: 911 },
    { id: 'af-left', crossing: 3025, total: 3639 },
  ]);
  assert.deepEqual(
    crossed.map((row) => row.id),
    ['af-left', 'ilf-left'],
  );
  assert.deepEqual(missed, ['uf-left']);
});
