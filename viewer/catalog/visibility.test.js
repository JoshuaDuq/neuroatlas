import assert from 'node:assert/strict';
import test from 'node:test';
import { visibilityOf } from './visibility.js';

const region = (over = {}) =>
  ({ id: 'a:left:1', atlas: 'a', hemisphere: 'left', kind: 'cortex', ...over });

const base = {
  atlas: 'a', cutAtlas: 'a', cutActive: true, hemisphere: 'both',
  cortexVisible: true, cortexOpacity: 1, isolatedRegion: null,
};
const settings = (over = {}) => ({ ...base, ...over });

test('a cortical region of the active atlas is visible by default', () => {
  assert.deepEqual(visibilityOf(region(), settings()), { visible: true, reason: null });
});

test('cortex belonging to a different atlas is hidden', () => {
  assert.deepEqual(visibilityOf(region({ atlas: 'b' }), settings()),
    { visible: false, reason: 'other-atlas' });
});

test('structures are shared, so the active atlas never hides them', () => {
  const stem = region({ atlas: 'aseg', hemisphere: 'midline', kind: 'structure' });
  assert.equal(visibilityOf(stem, settings()).visible, true);
});

test('a hemisphere filter hides the opposite hemisphere but keeps midline', () => {
  assert.deepEqual(visibilityOf(region(), settings({ hemisphere: 'right' })),
    { visible: false, reason: 'hemisphere' });
  assert.equal(visibilityOf(region({ hemisphere: 'midline' }),
    settings({ hemisphere: 'right' })).visible, true);
});

test('hiding the cortex hides cortical regions but not structures', () => {
  assert.deepEqual(visibilityOf(region(), settings({ cortexVisible: false })),
    { visible: false, reason: 'cortex-hidden' });
  const stem = region({ atlas: 'aseg', hemisphere: 'midline', kind: 'structure' });
  assert.equal(visibilityOf(stem, settings({ cortexVisible: false })).visible, true);
});

test('fully transparent cortex counts as hidden', () => {
  assert.deepEqual(visibilityOf(region(), settings({ cortexOpacity: 0 })),
    { visible: false, reason: 'cortex-hidden' });
});

test('isolating a region hides every other region, structures included', () => {
  const isolated = settings({ isolatedRegion: 'other' });
  assert.deepEqual(visibilityOf(region(), isolated),
    { visible: false, reason: 'isolated' });
  const stem = region({ atlas: 'aseg', hemisphere: 'midline', kind: 'structure' });
  assert.deepEqual(visibilityOf(stem, isolated), { visible: false, reason: 'isolated' });
  assert.equal(visibilityOf(region(), settings({ isolatedRegion: 'a:left:1' })).visible, true);
});

test('unlabelled cortex follows the cortex rules like any other patch', () => {
  const wall = region({ kind: 'non-region' });
  assert.equal(visibilityOf(wall, settings()).visible, true);
  assert.deepEqual(visibilityOf(wall, settings({ cortexVisible: false })),
    { visible: false, reason: 'cortex-hidden' });
});

test('reasons are reported in a fixed precedence, most fundamental first', () => {
  const everything = settings({
    hemisphere: 'right', cortexVisible: false, isolatedRegion: 'other',
  });
  assert.equal(visibilityOf(region({ atlas: 'b' }), everything).reason, 'other-atlas');
  assert.equal(visibilityOf(region(), everything).reason, 'hemisphere');
  assert.equal(visibilityOf(region({ hemisphere: 'midline' }), everything).reason,
    'cortex-hidden');
});

// --- cut-only regions: no mesh, drawn only where the plane samples them ------

const tissue = (over = {}) =>
  region({ atlas: 'n', kind: 'tissue-region', id: 'n:left:7', ...over });

test('a cut-only region is visible when its atlas is the active cut atlas', () => {
  assert.deepEqual(visibilityOf(tissue(), settings({ cutAtlas: 'n' })),
    { visible: true, reason: null });
});

test('the surface atlas never hides a cut-only region', () => {
  // 'a' is the surface atlas and 'n' has no surface at all; only cutAtlas counts.
  assert.equal(visibilityOf(tissue(), settings({ atlas: 'a', cutAtlas: 'n' })).visible, true);
});

test('a cut-only region of another cut atlas reports its own reason', () => {
  assert.deepEqual(visibilityOf(tissue(), settings({ cutAtlas: 'a' })),
    { visible: false, reason: 'other-cut-atlas' });
});

test('with no cut on screen a cut-only region is nowhere, and says so', () => {
  assert.deepEqual(visibilityOf(tissue(), settings({ cutAtlas: 'n', cutActive: false })),
    { visible: false, reason: 'no-cut' });
});

test('hiding the cortex leaves cut-only regions alone', () => {
  const hidden = settings({ cutAtlas: 'n', cortexVisible: false });
  assert.equal(visibilityOf(tissue(), hidden).visible, true);
  assert.equal(visibilityOf(region(), hidden).reason, 'cortex-hidden');
});

test('hemisphere and isolation still apply to cut-only regions', () => {
  const cut = settings({ cutAtlas: 'n' });
  assert.equal(
    visibilityOf(tissue(), { ...cut, hemisphere: 'right' }).reason, 'hemisphere');
  assert.equal(
    visibilityOf(tissue(), { ...cut, isolatedRegion: 'other' }).reason, 'isolated');
  assert.equal(
    visibilityOf(tissue(), { ...cut, isolatedRegion: 'n:left:7' }).visible, true);
});

test('a missing cut atlas hides cut-only regions rather than showing them', () => {
  // An older caller that assembles no cut state must not leak them on screen.
  assert.equal(visibilityOf(tissue(), { ...base, cutAtlas: undefined }).visible, false);
});
