import assert from 'node:assert/strict';
import test from 'node:test';
import { createCircuitSession } from './session.js';

const circuit = { id: 'vision', steps: [{ id: 'chiasm' }, { id: 'tract' }],
  question: { options: ['one', 'two', 'three'] } };
const catalog = { get(id) {
  if (id !== circuit.id) throw new Error('Unknown circuit');
  return circuit;
} };

test('starting and navigating a lesson validates landmarks and preserves its answer', () => {
  const session = createCircuitSession(catalog);
  assert.deepEqual(session.snapshot(), { circuit: null, step: 0, answer: null });
  session.start('vision');
  session.answer(1);
  session.go(1);
  assert.deepEqual(session.snapshot(), { circuit: 'vision', step: 1, answer: 1 });
  assert.throws(() => session.go(2), /landmark/);
  assert.throws(() => session.go(-1), /landmark/);
  assert.throws(() => session.go(0.5), /landmark/);
  assert.throws(() => session.answer(3), /answer/);
  session.start('vision');
  assert.deepEqual(session.snapshot(), { circuit: 'vision', step: 0, answer: null });
});

test('invalid actions do not mutate the previous lesson', () => {
  const session = createCircuitSession(catalog);
  assert.throws(() => session.answer(0), /circuit/);
  session.start('vision');
  const before = session.snapshot();
  assert.throws(() => session.start('missing'), /Unknown circuit/);
  assert.deepEqual(session.snapshot(), before);
  before.step = 99;
  assert.equal(session.snapshot().step, 0);
});
