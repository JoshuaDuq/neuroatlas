import assert from 'node:assert/strict';
import test from 'node:test';
import { combineProgress } from './progress.js';

test('combineProgress sums every in-flight download into one bar', () => {
  const seen = [];
  const group = combineProgress(['a', 'b'], event => seen.push({ ...event }));
  group.track('a')({ loaded: 10, total: 20 });
  group.track('b')({ loaded: 5, total: 20 });
  group.track('a')({ loaded: 20, total: 20 });
  assert.deepEqual(seen, [
    { loaded: 10, total: 20 },
    { loaded: 15, total: 40 },
    { loaded: 25, total: 40 },
  ]);
});

test('combineProgress ignores a part until it reports a total', () => {
  const seen = [];
  const group = combineProgress(['a', 'b'], event => seen.push({ ...event }));
  group.track('a')({ loaded: 0, total: 0 });
  assert.deepEqual(seen, []);
  group.track('a')({ loaded: 4, total: 8 });
  assert.deepEqual(seen, [{ loaded: 4, total: 8 }]);
});
