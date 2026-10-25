import assert from 'node:assert/strict';
import { onTestFinished, test, vi } from 'vitest';
import { createLinkWriter, sameSubject } from './link-writer.ts';

test('the link is written once the scene settles, not at every change', () => {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.useRealTimers();
  });
  let writes = 0;
  const writer = createLinkWriter(() => {
    writes += 1;
  });
  writer.schedule();
  vi.advanceTimersByTime(200);
  writer.schedule();
  vi.advanceTimersByTime(200);
  assert.equal(writes, 0);
  vi.advanceTimersByTime(50);
  assert.equal(writes, 1);
});

test('while a link is applied the address bar keeps it, until that restore ends or is overtaken', () => {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.useRealTimers();
  });
  let writes = 0;
  const writer = createLinkWriter(() => {
    writes += 1;
  });
  let live = true;
  const restoring = () => live;
  writer.hold(restoring);
  writer.schedule();
  vi.advanceTimersByTime(1000);
  assert.equal(writes, 0, 'a half-restored scene is not written over the link');
  live = false;
  writer.schedule();
  vi.advanceTimersByTime(250);
  assert.equal(writes, 1, 'an overtaken restore holds nothing');
  const next = () => true;
  writer.hold(next);
  writer.release(restoring);
  writer.schedule();
  vi.advanceTimersByTime(250);
  assert.equal(writes, 1, 'an older restore cannot release a newer one');
  writer.release(next);
  writer.schedule();
  vi.advanceTimersByTime(250);
  assert.equal(writes, 2);
});

test('a cancelled write never lands, as when another subject is about to load', () => {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.useRealTimers();
  });
  let writes = 0;
  const writer = createLinkWriter(() => {
    writes += 1;
  });
  writer.schedule();
  writer.cancel();
  vi.advanceTimersByTime(1000);
  assert.equal(writes, 0);
});

test('a link without a subject means the published default', () => {
  assert.equal(sameSubject({}, 'snail', 'snail'), true);
  assert.equal(sameSubject({}, 'bert', 'snail'), false);
  assert.equal(sameSubject({ anatomy: 'bert' }, 'bert', 'snail'), true);
  assert.equal(sameSubject({ anatomy: 'aomic' }, 'bert', 'snail'), false);
});
