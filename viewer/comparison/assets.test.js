import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { readComparison, readComparisonGeometry } from './assets.js';

const checksum = bytes => createHash('sha256').update(bytes).digest('hex');
const json = new TextEncoder().encode('{"schema_version":1,"anatomy_id":"snail"}');
const url = 'https://example.invalid/models/snail/atlas-comparison.json';

test('comparison JSON verifies the bytes through the published request policy', async context => {
  let request;
  context.mock.method(globalThis, 'fetch', async (address, options) => {
    request = { address, options };
    return new Response(json);
  });
  assert.deepEqual(await readComparison(url, checksum(json)), { schema_version: 1, anatomy_id: 'snail' });
  assert.equal(request.address, url);
  assert.equal(request.options.cache, 'no-cache');
  assert.equal(request.options.priority, 'high');
});

test('comparison geometry returns verified original bytes', async context => {
  const bytes = new Uint8Array([103, 108, 84, 70, 0, 255, 1]);
  context.mock.method(globalThis, 'fetch', async () => new Response(bytes));
  const buffer = await readComparisonGeometry(url, checksum(bytes));
  assert.ok(buffer instanceof ArrayBuffer);
  assert.deepEqual(new Uint8Array(buffer), bytes);
});

test('comparison readers have no global subject or request cache', async context => {
  let requests = 0;
  context.mock.method(globalThis, 'fetch', async () => { requests += 1; return new Response(json); });
  await Promise.all([readComparison(url, checksum(json)), readComparison(url, checksum(json))]);
  assert.equal(requests, 2);
});

for (const read of [readComparison, readComparisonGeometry]) {
  test(`${read.name} reports HTTP errors before digesting`, async context => {
    context.mock.method(globalThis, 'fetch', async () => new Response('Unavailable', { status: 503 }));
    await assert.rejects(read(url, checksum(json)), /HTTP 503/);
  });

  test(`${read.name} preserves original network failures`, async context => {
    const failure = new TypeError('Network unavailable');
    context.mock.method(globalThis, 'fetch', async () => { throw failure; });
    await assert.rejects(read(url, checksum(json)), error => error === failure);
  });

  test(`${read.name} rejects changed published bytes`, async context => {
    context.mock.method(globalThis, 'fetch', async () => new Response('changed'));
    await assert.rejects(read(url, checksum(json)), /checksum mismatch/i);
  });

  test(`${read.name} requires a SHA256 before sending a request`, async context => {
    let requests = 0;
    context.mock.method(globalThis, 'fetch', async () => { requests += 1; return new Response(json); });
    for (const value of [undefined, null, '', 'wrong', 'z'.repeat(64)]) {
      await assert.rejects(read(url, value), /SHA-256/i);
    }
    assert.equal(requests, 0);
  });
}

test('validly hashed invalid JSON remains an original parse error', async context => {
  const bytes = new TextEncoder().encode('{invalid');
  context.mock.method(globalThis, 'fetch', async () => new Response(bytes));
  await assert.rejects(readComparison(url, checksum(bytes)), SyntaxError);
});

test('digest failures propagate as the original error', async context => {
  const failure = new DOMException('Digest unavailable', 'OperationError');
  context.mock.method(globalThis, 'fetch', async () => new Response(json));
  context.mock.method(crypto.subtle, 'digest', async () => { throw failure; });
  await assert.rejects(readComparison(url, checksum(json)), error => error === failure);
});

test('published comparison JSON and geometry match their declared SHA256 checksums', async context => {
  const directory = new URL('../../public/models/snail/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
  context.mock.method(globalThis, 'fetch', async address => {
    const file = new URL(address).pathname.split('/').at(-1);
    return new Response(await readFile(new URL(file, directory)));
  });
  const comparisonUrl = new URL(manifest.atlas_comparison.file, url).href;
  const data = await readComparison(comparisonUrl, manifest.atlas_comparison.sha256);
  const geometry = await readComparisonGeometry(new URL(data.geometry.file, comparisonUrl).href,
    data.geometry.sha256);
  assert.equal(data.anatomy_id, manifest.anatomy.id);
  assert.equal(new DataView(geometry).getUint32(0, true), 0x46546c67);
});
