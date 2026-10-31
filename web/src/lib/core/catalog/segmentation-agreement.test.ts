import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Region } from '../../types/index.ts';
import {
  agreementDice,
  categoryAt,
  comparedStructureOf,
  validateSegmentationAgreement,
  type ComparedStructure,
  type SegmentationAgreement,
} from './segmentation-agreement.ts';
import { asRegion } from './test-support.ts';

const regions = new Map<string, Region>([
  ['aseg:left:17', asRegion({ atlas: 'aseg', hemisphere: 'left', source_label_id: 17 })],
  ['learning:left:hippocampus', asRegion({ atlas: 'learning', hemisphere: 'left' })],
  ['nextbrain:left:326', asRegion({ atlas: 'nextbrain', hemisphere: 'left' })],
  ['nextbrain:right:10326', asRegion({ atlas: 'nextbrain', hemisphere: 'right' })],
]);

const hippocampus = (overrides: Partial<ComparedStructure> = {}): ComparedStructure => ({
  code: 7,
  structure: 'hippocampus',
  hemisphere: 'left',
  aseg_label: 17,
  regions: {
    aseg: 'aseg:left:17',
    learning: 'learning:left:hippocampus',
    nextbrain: ['nextbrain:left:326'],
  },
  voxels: { both: 3234, aseg_only: 852, nextbrain_only: 95 },
  ...overrides,
});

const agreement = (...structures: ComparedStructure[]): SegmentationAgreement => ({
  id: 'segmentation-agreement',
  voxel_volume_mm3: 1,
  structures,
});

test('a structure is found from its aseg label, its union or any NextBrain label in it', () => {
  const published = validateSegmentationAgreement(agreement(hippocampus()), regions);
  for (const id of ['aseg:left:17', 'learning:left:hippocampus', 'nextbrain:left:326'])
    assert.equal(comparedStructureOf(published, id)?.code, 7);
  assert.equal(comparedStructureOf(published, 'nextbrain:right:10326'), null);
  assert.equal(comparedStructureOf(null, 'aseg:left:17'), null);
});

test('a comparison naming the wrong atlas, label or side, or repeating a code, is refused', () => {
  const invalid = [
    hippocampus({ aseg_label: 53 }),
    hippocampus({ hemisphere: 'right' }),
    hippocampus({
      regions: { ...hippocampus().regions, nextbrain: ['nextbrain:right:10326'] },
    }),
    hippocampus({ regions: { ...hippocampus().regions, learning: 'aseg:left:17' } }),
    hippocampus({ voxels: { both: 0, aseg_only: 0, nextbrain_only: 0 } }),
    hippocampus({ code: 0 }),
  ];
  for (const structure of invalid)
    assert.throws(() => validateSegmentationAgreement(agreement(structure), regions));
  assert.throws(() =>
    validateSegmentationAgreement(agreement(hippocampus(), hippocampus()), regions),
  );
});

test('Dice and each voxel’s category follow from the two labels alone', () => {
  assert.equal(agreementDice({ both: 3, aseg_only: 1, nextbrain_only: 1 }), 0.75);
  const structure = { code: 7, aseg_label: 17 };
  assert.equal(categoryAt(structure, 17, 7), 'both');
  assert.equal(categoryAt(structure, 17, 3), 'aseg-only');
  assert.equal(categoryAt(structure, 18, 7), 'nextbrain-only');
  assert.equal(categoryAt(structure, 18, 3), null);
});
