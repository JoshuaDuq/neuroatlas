import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readRepoYaml } from '../../../../test/repo.ts';
import { manifests } from '../clinical/test-support.ts';
import type { ClinicalData } from '../clinical/types.ts';
import { ownTractIds } from '../diffusion/catalogs.ts';
import { createCircuitCatalog } from './catalog.ts';
import type { CircuitData } from './catalog.ts';
import { createCircuitSession } from './session.ts';

const circuit = { id: 'vision', steps: [{ id: 'chiasm' }, { id: 'tract' }] };
const catalog = {
  get(id: string) {
    if (id !== circuit.id) throw new Error('Unknown circuit');
    return circuit as never;
  },
};

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

test('a link without a lesson closes the one open', () => {
  const session = createCircuitSession(catalog);
  session.start('vision');
  session.go(1);
  session.close();
  assert.deepEqual(session.snapshot(), { circuit: null, step: 0, visited: [] });
});

test('CAT-55 · a landmark index that is not a whole number inside the circuit fails with the index', () => {
  const session = createCircuitSession(catalog);
  session.start('vision');
  for (const index of [2, -1, 0.5, NaN, '1' as unknown as number]) {
    assert.throws(() => session.go(index), {
      name: 'RangeError',
      message: `Invalid landmark index: ${index}`,
    });
  }
  assert.deepEqual(session.snapshot(), { circuit: 'vision', step: 0, visited: [0] });
});

test('CAT-55 · going to a landmark before any start fails, and a failed start changes nothing', () => {
  const session = createCircuitSession(catalog);
  const published = createCircuitCatalog(
    readRepoYaml<CircuitData>('data/circuits.yaml'),
    manifests[0][1],
    readRepoYaml<ClinicalData>('data/neuropsychology.yaml').deficits.map((d) => d.id),
    ownTractIds(manifests[0][1].anatomy.id),
  );
  assert.throws(() => createCircuitSession(published).go(0), {
    message: 'Unknown circuit: null',
  });
  assert.throws(() => session.go(0), { message: 'Unknown circuit' });
  assert.deepEqual(session.snapshot(), { circuit: null, step: 0, visited: [] });
  session.start('vision');
  session.go(1);
  assert.throws(() => session.start('missing'));
  assert.deepEqual(session.snapshot(), { circuit: 'vision', step: 1, visited: [0, 1] });
});
