import assert from 'node:assert/strict';
import test from 'node:test';
import { createLinkWriter, sameSubject } from './link-writer.js';

test('the link is written once the scene settles, not at every change', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let writes = 0;
  const writer = createLinkWriter(() => { writes += 1; });
  writer.schedule();
  t.mock.timers.tick(200);
  writer.schedule();
  t.mock.timers.tick(200);
  assert.equal(writes, 0);
  t.mock.timers.tick(50);
  assert.equal(writes, 1);
});

test('while a link is applied the address bar keeps it, until that restore ends or is overtaken', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let writes = 0;
  const writer = createLinkWriter(() => { writes += 1; });
  let live = true;
  const restoring = () => live;
  writer.hold(restoring);
  writer.schedule();
  t.mock.timers.tick(1000);
  assert.equal(writes, 0, 'a half-restored scene is not written over the link');
  live = false;
  writer.schedule();
  t.mock.timers.tick(250);
  assert.equal(writes, 1, 'an overtaken restore holds nothing');
  const next = () => true;
  writer.hold(next);
  writer.release(restoring);
  writer.schedule();
  t.mock.timers.tick(250);
  assert.equal(writes, 1, 'an older restore cannot release a newer one');
  writer.release(next);
  writer.schedule();
  t.mock.timers.tick(250);
  assert.equal(writes, 2);
});

test('a cancelled write never lands, as when another subject is about to load', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let writes = 0;
  const writer = createLinkWriter(() => { writes += 1; });
  writer.schedule();
  writer.cancel();
  t.mock.timers.tick(1000);
  assert.equal(writes, 0);
});

test('a link without a subject means the published default', () => {
  assert.equal(sameSubject({}, 'snail', 'snail'), true);
  assert.equal(sameSubject({}, 'bert', 'snail'), false);
  assert.equal(sameSubject({ anatomy: 'bert' }, 'bert', 'snail'), true);
  assert.equal(sameSubject({ anatomy: 'aomic' }, 'bert', 'snail'), false);
});
