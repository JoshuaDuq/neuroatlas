import assert from 'node:assert/strict';
import { test } from 'vitest';
import { regionCountText } from './region-count.ts';

const ready = {
  tracts: null,
  status: 'ready' as const,
  progress: null,
  visibleCount: 3,
  choosing: false,
};

test('the count is the regions drawn, with the plural of each language', () => {
  assert.equal(regionCountText('en', { ...ready, visibleCount: 1 }), '1 visible region');
  assert.equal(regionCountText('en', ready), '3 visible regions');
  assert.equal(regionCountText('fr', ready), '3 régions visibles');
});

test('tracts mode names its bundles, whatever is loading', () => {
  assert.equal(
    regionCountText('en', { ...ready, tracts: '72 bundles', status: 'switching' }),
    '72 bundles',
  );
});

test('a download the data bar does not show is counted here; one it shows is not', () => {
  const switching = {
    ...ready,
    status: 'switching' as const,
    progress: { loaded: 1, total: 4 },
  };
  assert.match(regionCountText('en', switching), /25/);
  assert.equal(regionCountText('en', { ...switching, choosing: true }), '3 visible regions');
});

test('nothing is counted before the first model is ready', () => {
  assert.equal(regionCountText('en', { ...ready, status: 'loading' }), '');
});
