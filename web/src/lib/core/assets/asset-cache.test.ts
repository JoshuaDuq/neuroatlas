/// <reference types="node" />
import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { fetchAsset, type AssetProgress } from './asset-cache.ts';
import { publish, recordOf, sha256 } from './published-test-support.ts';

const bytesOf = (count: number) => new Uint8Array(count).map((_, i) => i + 1);

function responseFor(count: number) {
  const body = bytesOf(count);
  return new Response(body, {
    status: 200,
    headers: { 'Content-Length': String(body.byteLength) },
  });
}

describe('fetchAsset', () => {
  it('reuses an in-flight request and fans progress out to every listener', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => responseFor(8));
    const seenA: AssetProgress[] = [];
    const seenB: AssetProgress[] = [];
    const a = fetchAsset('https://example.test/a.glb', {
      onProgress: (event) => seenA.push({ ...event }),
    });
    const b = fetchAsset('https://example.test/a.glb', {
      onProgress: (event) => seenB.push({ ...event }),
    });
    const [left, right] = await Promise.all([a, b]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(left.byteLength).toBe(8);
    expect(right.byteLength).toBe(8);
    expect(seenA.at(-1)).toEqual({ loaded: 8, total: 8 });
    expect(seenB.at(-1)).toEqual({ loaded: 8, total: 8 });
  });

  it('consumes a head-started response instead of opening a second download', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    globalThis.__planumAssets = { 'https://example.test/b.glb': Promise.resolve(responseFor(4)) };
    const buffer = await fetchAsset('https://example.test/b.glb');
    expect(buffer.byteLength).toBe(4);
    expect(fetch).not.toHaveBeenCalled();
    expect(globalThis.__planumAssets['https://example.test/b.glb']).toBeUndefined();
  });

  it('fails bytes that are not the published file as an update, not as data', async () => {
    publish({ 'models/bert/manifest.json': recordOf(bytesOf(6)) });
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(new Uint8Array([9, 9, 9, 9, 9, 9])),
    );
    await expect(
      fetchAsset('https://example.test/neuroatlas/models/bert/manifest.json'),
    ).rejects.toMatchObject({ code: 'asset-updated' });
  });

  it('passes the published bytes and names their version in the request', async () => {
    publish({ 'models/bert/manifest.json': recordOf(bytesOf(6)) });
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => responseFor(6));
    const buffer = await fetchAsset('https://example.test/neuroatlas/models/bert/manifest.json');
    expect(new Uint8Array(buffer)).toEqual(bytesOf(6));
    expect(fetch.mock.calls[0][0]).toMatch(/manifest\.json\?v=[0-9a-f]{16}$/);
  });

  it('carries the asset-fetch code for HTTP and network failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('', { status: 503 }));
    await expect(fetchAsset('https://example.test/c.glb')).rejects.toMatchObject({
      code: 'asset-fetch',
      status: 503,
    });
    const failure = new TypeError('Failed to fetch');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw failure;
    });
    const error = await fetchAsset('https://example.test/c.glb').catch((caught) => caught);
    expect(error).toMatchObject({ code: 'asset-fetch', cause: failure });
    expect(error.status).toBeUndefined();
  });

  it('reports a gzip-encoded response against the decoded size, never past it', async () => {
    publish({ 'models/bert/learning.glb': recordOf(bytesOf(40)) });
    // The server's Content-Length counts the gzip bytes; the stream yields decoded ones.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(bytesOf(40), {
          headers: { 'Content-Encoding': 'gzip', 'Content-Length': '12' },
        }),
    );
    const seen: AssetProgress[] = [];
    await fetchAsset('https://example.test/neuroatlas/models/bert/learning.glb', {
      onProgress: (event) => seen.push(event),
    });
    expect(seen.every(({ loaded, total }) => total === 40 && loaded <= total)).toBe(true);
  });

  it('does not take an encoded Content-Length for the total when no size is published', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(bytesOf(40), {
          headers: { 'Content-Encoding': 'gzip', 'Content-Length': '12' },
        }),
    );
    const seen: AssetProgress[] = [];
    await fetchAsset('https://example.test/d.glb', { onProgress: (event) => seen.push(event) });
    expect(seen).toEqual([{ loaded: 40, total: 40 }]);
  });

  it('checks a .gz file a server decodes on the way against its contents', async () => {
    const contents = bytesOf(30);
    const file = new Uint8Array(gzipSync(contents));
    publish({
      'diffusion/a.trk.gz': {
        ...recordOf(file),
        gunzipped: { sha256: sha256(contents), size: contents.byteLength },
      },
    });
    const url = 'https://example.test/neuroatlas/diffusion/a.trk.gz';
    const fetch = vi.spyOn(globalThis, 'fetch');
    fetch.mockImplementation(async () => new Response(file));
    expect(new Uint8Array(await fetchAsset(url))).toEqual(file);
    const seen: AssetProgress[] = [];
    fetch.mockImplementation(
      async () => new Response(contents, { headers: { 'Content-Encoding': 'gzip' } }),
    );
    expect(
      new Uint8Array(await fetchAsset(url, { onProgress: (event) => seen.push(event) })),
    ).toEqual(contents);
    expect(seen.at(-1)).toEqual({ loaded: 30, total: 30 });
    fetch.mockImplementation(
      async () => new Response(bytesOf(29), { headers: { 'Content-Encoding': 'gzip' } }),
    );
    await expect(fetchAsset(url)).rejects.toMatchObject({ code: 'asset-updated' });
  });
});
