import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  FUNCTIONAL_LEVELS, functionalName, functionalRegionOf, functionalShortName, validateFunctionalRegions,
} from './functional-regions.js';

const regions = new Map([
  ['hcp-mmp:left:8', { atlas: 'hcp-mmp' }],
  ['hcp-mmp:left:84', { atlas: 'hcp-mmp' }],
  ['destrieux:left:1', { atlas: 'destrieux' }],
]);

const partition = () => ({
  id: 'functional-regions',
  atlas: 'hcp-mmp',
  sources: { 'glasser-2016': { citation: 'Glasser et al. (2016)', doi: 'https://doi.org/10.1038/nature18933' } },
  levels: {
    named: [{ id: 'm1', name: 'Primary motor cortex (M1)', name_fr: 'Cortex moteur primaire (M1)',
      short: 'M1', short_fr: 'M1', source: 'glasser-2016', color: [1, 2, 3], areas: ['4'] }],
    sections: [
      { id: 'section-6', number: 6, name: 'Somatosensory and motor cortex', name_fr: 'Cortex somatosensoriel et moteur',
        short: 'Somatosensory and motor', short_fr: 'Somatosensoriel et moteur',
        source: 'glasser-2016', color: [4, 5, 6], areas: ['4'] },
      { id: 'section-22', number: 22, name: 'Dorsolateral prefrontal cortex', name_fr: 'Cortex préfrontal dorsolatéral',
        short: 'Dorsolateral prefrontal', short_fr: 'Préfrontal dorsolatéral',
        source: 'glasser-2016', color: [7, 8, 9], areas: ['46'] },
    ],
  },
  regions: {
    named: { 'hcp-mmp:left:8': 'm1' },
    sections: { 'hcp-mmp:left:8': 'section-6', 'hcp-mmp:left:84': 'section-22' },
  },
});

test('an area takes its section at every level, and a named region only where one is published', () => {
  const published = validateFunctionalRegions(partition(), regions);
  assert.equal(functionalRegionOf(published, 'named', 'hcp-mmp:left:8').id, 'm1');
  assert.equal(functionalRegionOf(published, 'sections', 'hcp-mmp:left:8').id, 'section-6');
  assert.equal(functionalRegionOf(published, 'named', 'hcp-mmp:left:84'), null);
  assert.equal(functionalRegionOf(published, 'sections', 'hcp-mmp:left:84').id, 'section-22');
  assert.equal(functionalRegionOf(null, 'sections', 'hcp-mmp:left:84'), null);
});

test('names and key labels are read in the reader\'s language', () => {
  const [record] = partition().levels.named;
  assert.equal(functionalName(record), 'Primary motor cortex (M1)');
  assert.equal(functionalName(record, 'fr'), 'Cortex moteur primaire (M1)');
  const [, section] = partition().levels.sections;
  assert.equal(functionalShortName(section), 'Dorsolateral prefrontal');
  assert.equal(functionalShortName(section, 'fr'), 'Préfrontal dorsolatéral');
});

test('an assignment to another atlas or to an undefined region is rejected', () => {
  const foreign = partition();
  foreign.regions.sections['destrieux:left:1'] = 'section-6';
  assert.throws(() => validateFunctionalRegions(foreign, regions), /assignment: destrieux:left:1/);
  const undefinedRegion = partition();
  undefinedRegion.regions.named['hcp-mmp:left:84'] = 'dlpfc';
  assert.throws(() => validateFunctionalRegions(undefinedRegion, regions), /assignment: hcp-mmp:left:84/);
});

test('a region without a source or a colour is rejected', () => {
  const unsourced = partition();
  unsourced.levels.named[0].source = 'memory';
  assert.throws(() => validateFunctionalRegions(unsourced, regions), /Invalid functional region: m1/);
  const uncoloured = partition();
  delete uncoloured.levels.sections[1].color;
  assert.throws(() => validateFunctionalRegions(uncoloured, regions), /Invalid functional region: section-22/);
});

test('each published anatomy assigns every HCP-MMP area a section', () => {
  for (const anatomy of ['snail', 'cdmd']) {
    const base = new URL(`../../public/models/${anatomy}/`, import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', base), 'utf8'));
    const published = JSON.parse(readFileSync(new URL(manifest.functional_regions.file, base), 'utf8'));
    const byId = new Map(manifest.regions.map(region => [region.id, region]));
    validateFunctionalRegions(published, byId);
    const areas = manifest.regions.filter(region => region.atlas === 'hcp-mmp' && region.kind === 'cortex');
    assert.equal(areas.length, 360);
    for (const area of areas) assert.ok(functionalRegionOf(published, 'sections', area.id), area.id);
    assert.deepEqual(Object.keys(published.levels), FUNCTIONAL_LEVELS);
    assert.equal(published.levels.sections.length, 22);
  }
});
