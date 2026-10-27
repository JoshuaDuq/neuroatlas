import assert from 'node:assert/strict';
import { test } from 'vitest';
import { lesionBundles } from './tracts.ts';

const bundles = [
  'af-left',
  'af-right',
  'slf1-left',
  'slf1-right',
  'cc-1',
  'callosum-1',
  'callosum-7',
].map((id) => ({ id }));

test('takes the bundles of the sides the sphere reaches, and the callosal segments', () => {
  assert.deepEqual(lesionBundles(bundles, { centre: [-45, -25, 30], radius: 15 }), [
    'af-left',
    'slf1-left',
    'callosum-1',
    'callosum-7',
  ]);
  assert.deepEqual(lesionBundles(bundles, { centre: [40, 0, 0], radius: 10 }), [
    'af-right',
    'slf1-right',
    'callosum-1',
    'callosum-7',
  ]);
});

test('a sphere across the midline reaches both sides', () => {
  assert.deepEqual(lesionBundles(bundles, { centre: [-3, 0, 0], radius: 5 }), [
    'af-left',
    'af-right',
    'slf1-left',
    'slf1-right',
    'callosum-1',
    'callosum-7',
  ]);
});
