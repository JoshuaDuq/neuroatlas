import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readRepoJson } from '../../../../test/repo.ts';
import type { Manifest } from '../../types/index.ts';
import { createInvolvement } from './related.ts';

const regions = new Map([
  [
    'learning:left:thalamus',
    {
      id: 'learning:left:thalamus',
      constituent_regions: ['nextbrain:left:458', 'nextbrain:left:441'],
    },
  ],
  ['nextbrain:left:458', { id: 'nextbrain:left:458' }],
  ['nextbrain:left:441', { id: 'nextbrain:left:441' }],
  ['aseg:left:10', { id: 'aseg:left:10' }],
]);

test('a grouped structure involves its source regions, and each source region the structure holding it', () => {
  const involved = createInvolvement(regions);
  assert.deepEqual(
    involved('learning:left:thalamus'),
    new Set(['learning:left:thalamus', 'nextbrain:left:458', 'nextbrain:left:441']),
  );
  assert.deepEqual(
    involved('nextbrain:left:458'),
    new Set(['nextbrain:left:458', 'learning:left:thalamus']),
  );
  // Another segmentation of the same structure is not the same region.
  assert.deepEqual(involved('aseg:left:10'), new Set(['aseg:left:10']));
  assert.throws(() => involved('missing'), /Unknown region/);
});

test('every published constituent is itself a published region', () => {
  const manifest = readRepoJson<Manifest>('public/models/cdmd/manifest.json');
  const published = new Map(manifest.regions.map((region) => [region.id, region]));
  const involved = createInvolvement(published);
  for (const region of manifest.regions.filter((entry) => entry.constituent_regions)) {
    for (const id of involved(region.id)) assert.ok(published.has(id), id);
  }
});

test('PANEL-20 the published caudate and thalamus are linked to the source regions they unite', () => {
  const manifest = readRepoJson<Manifest>('public/models/cdmd/manifest.json');
  const involved = createInvolvement(
    new Map(manifest.regions.map((region) => [region.id, region])),
  );
  assert.deepEqual([...involved('learning:left:caudate')].sort(), [
    'learning:left:caudate',
    'nextbrain:left:118',
    'nextbrain:left:393',
    'nextbrain:left:48',
  ]);
  const thalamus = involved('learning:left:thalamus');
  assert.equal(thalamus.size, 53, 'itself and its 52 source regions');
  assert.ok(thalamus.has('nextbrain:left:190'));
  assert.deepEqual([...involved('nextbrain:left:48')].sort(), [
    'learning:left:caudate',
    'nextbrain:left:48',
  ]);
});
