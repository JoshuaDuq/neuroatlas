import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAnatomies, resolveAnatomy } from './published-anatomy.js';

const published = { default: 'snail', anatomies: [{ id: 'snail' }, { id: 'aomic' }] };

test('omitted anatomy uses the published default', () => {
  assert.equal(resolveAnatomy(published), 'snail');
});

test('an explicit published anatomy opens that subject', () => {
  assert.equal(resolveAnatomy(published, 'aomic'), 'aomic');
});

test('unknown explicit anatomy is an error instead of a different subject', () => {
  for (const id of ['missing', '', null, 1]) {
    assert.throws(() => resolveAnatomy(published, id), /Unknown anatomy/);
  }
});

test('a published default must name an available subject', () => {
  assert.throws(() => resolveAnatomy({ ...published, default: 'missing' }), /Unknown anatomy/);
});

test('the anatomy index revalidates the published request', async context => {
  let options;
  context.mock.method(globalThis, 'fetch', async (url, request) => {
    options = request;
    return new Response(JSON.stringify(published));
  });
  assert.deepEqual(await loadAnatomies('https://example.invalid/models/anatomies.json'), published);
  assert.equal(options?.cache, 'no-cache');
  assert.equal(options?.priority, 'high');
});

test('an unsuccessful anatomy index request reports its HTTP status', async context => {
  context.mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify({ error: 'Unavailable' }), { status: 503 }));
  await assert.rejects(loadAnatomies('https://example.invalid/models/anatomies.json'), /HTTP 503/);
});

test('an anatomy index network failure propagates without a substitute subject', async context => {
  const failure = new TypeError('Network unavailable');
  context.mock.method(globalThis, 'fetch', async () => { throw failure; });
  await assert.rejects(loadAnatomies('https://example.invalid/models/anatomies.json'),
    error => error === failure);
});
