import assert from 'node:assert/strict';
import test from 'node:test';
import { nextEnabledIndex } from './navigator.js';

test('an arrow moves past a row that cannot be chosen', () => {
  assert.equal(nextEnabledIndex([false, true, false], 0, 1), 2);
  assert.equal(nextEnabledIndex([false, true, false], 2, -1), 0);
});

test('an arrow at the end of the list leaves the armed row where it is', () => {
  assert.equal(nextEnabledIndex([false, true], 0, 1), 0);
  assert.equal(nextEnabledIndex([true, false], 1, 1), 1);
  assert.equal(nextEnabledIndex([false], 0, -1), 0);
});

test('the first arrow from an empty field lands on the first choosable row', () => {
  assert.equal(nextEnabledIndex([true, false, false], -1, 1), 1);
});
