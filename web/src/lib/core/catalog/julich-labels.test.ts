import assert from 'node:assert/strict';
import { test } from 'vitest';
import { comparedWith } from '../comparison/catalog.ts';
import { julichLabel } from './julich-labels.ts';
import { readModel } from './test-support.ts';
import type { Manifest } from '../../types/index.ts';

test('a Julich-Brain area joins the lobe its first location tag names, in both languages', () => {
  assert.deepEqual(julichLabel('Area 3b (PostCG)', 'en'), {
    name: 'Area 3b (PostCG)',
    code: null,
    group: 'Central',
    aliases: [],
  });
  assert.equal(julichLabel('Area hOc1 (V1, 17, CalcS)', 'en')!.group, 'Occipital');
  assert.equal(julichLabel('Area TPJ (STG, SMG)', 'en')!.group, 'Temporal');
  assert.deepEqual(julichLabel('Area 7A (SPL)', 'fr'), {
    name: 'Aire 7A (SPL)',
    code: null,
    group: 'Pariétal',
    aliases: [],
  });
  assert.equal(julichLabel('CA1 (Hippocampus)', 'fr')!.group, 'Limbique');
  assert.equal(julichLabel('Area X (Nowhere)', 'en'), null);
  assert.equal(julichLabel('GapMap-Frontal-I.1', 'en'), null);
});

test('every published Julich-Brain area has a lobe, and gap maps are not areas', () => {
  const manifest = readModel<Manifest>('cdmd/manifest.json');
  const julich = manifest.regions.filter((region) => region.atlas === 'julich');
  const areas = julich.filter((region) => region.kind === 'cortex');
  assert.equal(areas.length, 278);
  for (const region of areas) assert.ok(julichLabel(region.source_name!, 'en'), region.id);
  const unassigned = julich.filter((region) => region.kind === 'non-region');
  assert.ok(unassigned.every((region) => /^GapMap-|Mask$/.test(region.source_name!)));
  assert.equal(unassigned.length, 18);
});

test('only Destrieux and HCP-MMP are compared, each against the other', () => {
  assert.equal(comparedWith('destrieux'), 'hcp-mmp');
  assert.equal(comparedWith('hcp-mmp'), 'destrieux');
  assert.equal(comparedWith('julich'), null);
});
