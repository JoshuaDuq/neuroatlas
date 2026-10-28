import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Region } from '../../types/index.ts';
import {
  SOFT_SHARE,
  boundariesOf,
  overallShare,
  validateBoundaryCertainty,
  type BoundaryCertainty,
} from './boundary-certainty.ts';
import { asRegion } from './test-support.ts';

const PULVINAR = 'nextbrain:right:10517';
const regions = new Map<string, Region>([
  [PULVINAR, asRegion({ atlas: 'nextbrain', hemisphere: 'right' })],
  ['nextbrain:right:10516', asRegion({ atlas: 'nextbrain', hemisphere: 'right' })],
  ['nextbrain:right:10002', asRegion({ atlas: 'nextbrain', hemisphere: 'right' })],
  ['nextbrain:left:517', asRegion({ atlas: 'nextbrain', hemisphere: 'left' })],
  ['aseg:right:49', asRegion({ atlas: 'aseg', hemisphere: 'right' })],
]);

const certainty = (pairs: BoundaryCertainty['pairs']): BoundaryCertainty => ({
  id: 'boundary-certainty',
  atlas: 'nextbrain',
  near_tie_margin: 0.2,
  voxel_spacing_mm: 0.4,
  pairs,
});

test('a region lists its rated boundaries, the largest first, soft from a third', () => {
  const published = certainty([
    ['nextbrain:right:10516', PULVINAR, 300, 99],
    [PULVINAR, 'nextbrain:right:10002', 900, 300],
  ]);
  const boundaries = boundariesOf(validateBoundaryCertainty(published, regions), PULVINAR);
  assert.deepEqual(
    boundaries.map(({ neighbour, voxels, soft }) => [neighbour, voxels, soft]),
    [
      ['nextbrain:right:10002', 900, true],
      ['nextbrain:right:10516', 300, false],
    ],
  );
  assert.equal(boundaries[0]!.share, SOFT_SHARE);
  // Weighted by interface: (300 + 99) / 1200.
  assert.equal(overallShare(boundaries), 399 / 1200);
  assert.deepEqual(boundariesOf(published, 'nextbrain:left:517'), []);
  assert.deepEqual(boundariesOf(null, PULVINAR), []);
});

test('a rating that names another atlas, crosses the midline, repeats or miscounts is refused', () => {
  const refused: [BoundaryCertainty['pairs'][number], RegExp][] = [
    [[PULVINAR, 'aseg:right:49', 10, 1], /Invalid boundary rating/],
    [[PULVINAR, 'nextbrain:left:517', 10, 1], /Invalid boundary rating/],
    [[PULVINAR, PULVINAR, 10, 1], /Invalid boundary rating/],
    [[PULVINAR, 'nextbrain:right:10516', 10, 11], /Invalid boundary rating/],
    [[PULVINAR, 'nextbrain:right:10516', 10.5, 1], /Invalid boundary rating/],
    [['nextbrain:right:10516', PULVINAR, 10, 1], /rated twice/],
  ];
  for (const [pair, message] of refused) {
    const pairs: BoundaryCertainty['pairs'] = [[PULVINAR, 'nextbrain:right:10516', 10, 1]];
    if (!/twice/.test(message.source)) pairs.pop();
    assert.throws(() => validateBoundaryCertainty(certainty([...pairs, pair]), regions), message);
  }
  assert.throws(
    () => validateBoundaryCertainty({ ...certainty([]), near_tie_margin: 0 }, regions),
    /Invalid boundary certainty/,
  );
});

test('a region with no rated boundary has no overall share to report', () => {
  assert.throws(() => overallShare([]), /no rated boundary/);
});
