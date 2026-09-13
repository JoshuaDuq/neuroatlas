import assert from 'node:assert/strict';
import test from 'node:test';
import { captureBeforeInternal, insideInternal, leaveInternal } from './internal-mode.js';

const whole = { cortexVisible: true, surfaceColor: 'tissue', detail: 'destrieux' };
const inside = { cortexVisible: false, surfaceColor: 'atlas', detail: 'learning' };

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
  const changes = leaveInternal(captureBeforeInternal(whole, 'learning'),
    { ...inside, detail: 'nextbrain' });
  assert.equal(changes.detail, null);
});

test('entering on a level entry would have chosen anyway still rolls nothing back', () => {
  const changes = leaveInternal(captureBeforeInternal({ ...whole, detail: 'learning' }, 'learning'),
    inside);
  assert.equal(changes.detail, null);
});

test('leaving clears the system filter, which means nothing with the cortex drawn', () => {
  assert.equal(leaveInternal(captureBeforeInternal(whole, 'learning'), inside).internalSystem, null);
});

test('a session that opened with the cortex already hidden still has a way out', () => {
  const changes = leaveInternal(null, inside);
  assert.equal(changes.cortexVisible, true);
  assert.equal(changes.surfaceColor, 'tissue');
  assert.equal(changes.detail, null);
});

test('leaving speaks only for what entering took: the rest stays the reader\'s', () => {
  const changes = leaveInternal(captureBeforeInternal(whole, 'learning'),
    { ...inside, hemisphere: 'left', cortexOpacity: 0.4, selectedRegion: { id: 'x' } });
  assert.deepEqual(Object.keys(changes).sort(),
    ['cortexVisible', 'detail', 'internalSystem', 'surfaceColor']);
});
