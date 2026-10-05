import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { stepperTargets } from './circuits.js';

test('the landmark stepper offers only the directions that have a landmark', () => {
  assert.deepEqual(stepperTargets(0, 4), { previous: null, next: 1 });
  assert.deepEqual(stepperTargets(1, 4), { previous: 0, next: 2 });
  assert.deepEqual(stepperTargets(3, 4), { previous: 2, next: null });
  assert.deepEqual(stepperTargets(0, 1), { previous: null, next: null });
});

test('a lesson has no landmark commands of its own beside the region’s', async () => {
  const source = await readFile(new URL('./circuits.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /circuit-actions|circuit-navigation|dataset\.boundary/);
  assert.doesNotMatch(source, /text\.choose/);
});
