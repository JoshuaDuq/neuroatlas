import assert from 'node:assert/strict';
import { test } from 'vitest';
import { comparisonPartners } from '../comparison/catalog.ts';
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

test('each published cortical atlas is compared with every other', () => {
  const manifest = readModel<Manifest>('cdmd/manifest.json');
  const partners = (atlas: string) =>
    comparisonPartners(manifest, atlas).map(({ atlas: other, declaration }) => [
      other,
      declaration.file,
    ]);
  assert.deepEqual(partners('destrieux'), [
    ['hcp-mmp', 'atlas-comparison.json'],
    ['julich', 'atlas-comparison-destrieux-julich.json'],
    ['schaefer', 'atlas-comparison-destrieux-schaefer.json'],
  ]);
  assert.deepEqual(partners('schaefer'), [
    ['destrieux', 'atlas-comparison-destrieux-schaefer.json'],
    ['hcp-mmp', 'atlas-comparison-hcp-mmp-schaefer.json'],
    ['julich', 'atlas-comparison-julich-schaefer.json'],
  ]);
  assert.deepEqual(partners('aseg'), []);
});

test('a manifest declaring only the first pair compares Destrieux and HCP-MMP alone', () => {
  const { atlas_comparisons: _, ...manifest } = readModel<Manifest>('cdmd/manifest.json');
  assert.deepEqual(
    comparisonPartners(manifest, 'destrieux').map(({ atlas }) => atlas),
    ['hcp-mmp'],
  );
  assert.deepEqual(comparisonPartners(manifest, 'julich'), []);
});
