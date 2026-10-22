import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createInvolvement } from './related.js';

const regions = new Map([
  ['learning:left:thalamus', { id: 'learning:left:thalamus', constituent_regions: ['nextbrain:left:458', 'nextbrain:left:441'] }],
  ['nextbrain:left:458', { id: 'nextbrain:left:458' }],
  ['nextbrain:left:441', { id: 'nextbrain:left:441' }],
  ['aseg:left:10', { id: 'aseg:left:10' }],
]);

test('a grouped structure involves its source regions, and each source region the structure holding it', () => {
  const involved = createInvolvement(regions);
  assert.deepEqual(involved('learning:left:thalamus'),
    new Set(['learning:left:thalamus', 'nextbrain:left:458', 'nextbrain:left:441']));
  assert.deepEqual(involved('nextbrain:left:458'), new Set(['nextbrain:left:458', 'learning:left:thalamus']));
  // Another segmentation of the same structure is not the same region.
  assert.deepEqual(involved('aseg:left:10'), new Set(['aseg:left:10']));
  assert.throws(() => involved('missing'), /Unknown region/);
});

test('every published constituent is itself a published region', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../../public/models/snail/manifest.json', import.meta.url)));
  const published = new Map(manifest.regions.map(region => [region.id, region]));
  const involved = createInvolvement(published);
  for (const region of manifest.regions.filter(entry => entry.constituent_regions)) {
    for (const id of involved(region.id)) assert.ok(published.has(id), id);
  }
});
