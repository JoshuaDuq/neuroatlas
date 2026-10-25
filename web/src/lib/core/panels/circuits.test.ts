import assert from 'node:assert/strict';
import { test } from 'vitest';
import { stepperTargets, stepProgress } from './circuits.ts';

test('the landmark stepper offers only the directions that have a landmark', () => {
  assert.deepEqual(stepperTargets(0, 4), { previous: null, next: 1 });
  assert.deepEqual(stepperTargets(1, 4), { previous: 0, next: 2 });
  assert.deepEqual(stepperTargets(3, 4), { previous: 2, next: null });
  assert.deepEqual(stepperTargets(0, 1), { previous: null, next: null });
});

test('a lesson’s landmarks read as the current one, those seen, and those ahead', () => {
  const lesson = { step: 2, visited: [0, 2] };
  assert.deepEqual(
    [0, 1, 2, 3].map((index) => stepProgress(index, lesson)),
    ['visited', 'upcoming', 'current', 'upcoming'],
  );
  assert.equal(stepProgress(0, { step: 0, visited: [0] }), 'current');
});
