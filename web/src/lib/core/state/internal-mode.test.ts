import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { SurfaceColor } from '../../types/index.ts';
import { captureBeforeInternal, insideInternal, leaveInternal } from './internal-mode.ts';

interface Shown {
  cortexVisible: boolean;
  surfaceColor: SurfaceColor;
  detail: string;
  atlas: string;
}
const whole: Shown = {
  cortexVisible: true,
  surfaceColor: 'tissue',
  detail: 'destrieux',
  atlas: 'destrieux',
};
const inside: Shown = {
  cortexVisible: false,
  surfaceColor: 'atlas',
  detail: 'learning',
  atlas: 'destrieux',
};

test('the reader is inside internal anatomy exactly while the cortex is hidden', () => {
  assert.equal(insideInternal(whole), false);
  assert.equal(insideInternal(inside), true);
});

test('leaving restores the colouring and the detail level that entering overwrote', () => {
  const changes = leaveInternal(captureBeforeInternal(whole, 'learning'), inside);
  assert.equal(changes.cortexVisible, true);
  assert.equal(changes.surfaceColor, 'tissue');
  assert.equal(changes.detail, 'destrieux');
});

test('a detail level the reader chose while inside is theirs, and is kept', () => {
  const changes = leaveInternal(captureBeforeInternal(whole, 'learning'), {
    ...inside,
    detail: 'nextbrain',
  });
  assert.equal(changes.detail, null);
});

test('entering on a level entry would have chosen anyway still rolls nothing back', () => {
  const changes = leaveInternal(
    captureBeforeInternal({ ...whole, detail: 'learning' }, 'learning'),
    inside,
  );
  assert.equal(changes.detail, null);
});

test('leaving clears the system filter, which means nothing with the cortex drawn', () => {
  assert.equal(
    leaveInternal(captureBeforeInternal(whole, 'learning'), inside).internalSystem,
    null,
  );
});

test('a session that opened with the cortex already hidden still has a way out', () => {
  const changes = leaveInternal(null, inside);
  assert.equal(changes.cortexVisible, true);
  assert.equal(changes.surfaceColor, 'atlas');
  assert.equal(changes.detail, null);
});

test("leaving speaks only for what entering took: the rest stays the reader's", () => {
  const reader = { ...inside, hemisphere: 'left', cortexOpacity: 0.4, selectedRegion: { id: 'x' } };
  const changes = leaveInternal(captureBeforeInternal(whole, 'learning'), reader);
  assert.deepEqual(Object.keys(changes).sort(), [
    'colourLost',
    'cortexVisible',
    'detail',
    'internalSystem',
    'surfaceColor',
  ]);
});

test('an atlas switched inside wins over a colouring defined on the atlas left behind', () => {
  const required = { 'cab-np': 'hcp-mmp', functional: 'hcp-mmp' };
  for (const colour of ['cab-np', 'functional'] as const) {
    const entered: Shown = { ...whole, surfaceColor: colour, atlas: 'hcp-mmp' };
    const before = captureBeforeInternal(entered, 'learning');
    const switched = leaveInternal(before, { ...inside, atlas: 'destrieux' }, required);
    assert.equal(switched.surfaceColor, 'atlas');
    assert.equal(switched.colourLost, colour);
    const kept = leaveInternal(before, { ...inside, atlas: 'hcp-mmp' }, required);
    assert.equal(kept.surfaceColor, colour);
    assert.equal(kept.colourLost, null);
  }
});
