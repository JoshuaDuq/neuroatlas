import assert from 'node:assert/strict';
import test from 'node:test';
import { createCircuitSession } from './session.js';

const circuit = { id: 'vision', steps: [{ id: 'chiasm' }, { id: 'tract' }] };
const catalog = { get(id) {
  if (id !== circuit.id) throw new Error('Unknown circuit');
  return circuit;
} };

test('starting and navigating a lesson validates landmarks', () => {
  const session = createCircuitSession(catalog);
  assert.deepEqual(session.snapshot(), { circuit: null, step: 0, visited: [] });
  session.start('vision');
  session.go(1);
  assert.deepEqual(session.snapshot(), { circuit: 'vision', step: 1, visited: [0, 1] });
  assert.throws(() => session.go(2), /landmark/);
  assert.throws(() => session.go(-1), /landmark/);
  assert.throws(() => session.go(0.5), /landmark/);
  session.start('vision');
  assert.deepEqual(session.snapshot(), { circuit: 'vision', step: 0, visited: [0] });
});

test('a lesson remembers which landmarks were seen, once each, until it restarts', () => {
  const session = createCircuitSession(catalog);
  session.start('vision');
  session.go(1);
  session.go(0);
  session.go(1);
  assert.deepEqual(session.snapshot().visited, [0, 1]);
  session.snapshot().visited.push(5);
  assert.deepEqual(session.snapshot().visited, [0, 1]);
  session.start('vision');
  assert.deepEqual(session.snapshot().visited, [0]);
});

test('invalid actions do not mutate the previous lesson', () => {
  const session = createCircuitSession(catalog);
  session.start('vision');
  const before = session.snapshot();
  assert.throws(() => session.start('missing'), /Unknown circuit/);
  assert.deepEqual(session.snapshot(), before);
  before.step = 99;
  assert.equal(session.snapshot().step, 0);
  assert.throws(() => session.go(5), /landmark/);
  assert.deepEqual(session.snapshot().visited, [0]);
});
