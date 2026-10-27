import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { LoadProgress } from '../../types/index.ts';
import { combineProgress } from './progress.ts';

test('combineProgress sums every in-flight download into one bar', () => {
  const seen: LoadProgress[] = [];
  const group = combineProgress(['a', 'b'], (event) => seen.push({ ...event }));
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
  const seen: LoadProgress[] = [];
  const group = combineProgress(['a', 'b'], (event) => seen.push({ ...event }));
  group.track('a')({ loaded: 0, total: 0 });
  assert.deepEqual(seen, []);
  group.track('a')({ loaded: 4, total: 8 });
  assert.deepEqual(seen, [{ loaded: 4, total: 8 }]);
});

test('ATLAS-08 over seeded trials the bar is the sum of the parts that announced a size, and a missing figure counts as 0', () => {
  let state = 0xe4b;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let trial = 0; trial < 50; trial++) {
    const parts = ['a', 'b', 'c'].slice(0, 1 + Math.floor(random() * 3));
    const seen: LoadProgress[] = [];
    const group = combineProgress(parts, (event) => seen.push({ ...event }));
    const latest = new Map<string, { loaded?: number; total?: number }>();
    for (let step = 0; step < 20; step++) {
      const id = parts[Math.floor(random() * parts.length)]!;
      const event = [
        { loaded: Math.floor(random() * 100), total: Math.floor(random() * 100) },
        { loaded: 5 },
        { total: 9 },
        {},
      ][Math.floor(random() * 4)]!;
      const count = seen.length;
      group.track(id)(event);
      latest.set(id, event);
      let loaded = 0;
      let total = 0;
      for (const { loaded: l = 0, total: t = 0 } of latest.values()) {
        if (t > 0) {
          loaded += l;
          total += t;
        }
      }
      if (total > 0) assert.deepEqual(seen.at(-1), { loaded, total });
      assert.equal(seen.length, count + (total > 0 ? 1 : 0));
    }
  }
});
