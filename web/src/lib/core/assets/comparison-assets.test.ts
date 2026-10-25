import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { readComparison, readComparisonGeometry } from './comparison-assets.ts';
import './published-test-support.ts';
import { sha256 as checksum } from './published-test-support.ts';

const json = new TextEncoder().encode('{"schema_version":1,"anatomy_id":"snail"}');
const url = 'https://example.invalid/models/snail/atlas-comparison.json';

describe('comparison assets', () => {
  it('verifies the JSON bytes through the published request policy', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(json));
    expect(await readComparison(url, checksum(json))).toEqual({
      schema_version: 1,
      anatomy_id: 'snail',
    });
    expect(fetch.mock.calls[0][0]).toBe(url);
    expect(fetch.mock.calls[0][1]).toMatchObject({ cache: 'no-cache', priority: 'high' });
  });

  it('returns the verified original geometry bytes', async () => {
    const bytes = new Uint8Array([103, 108, 84, 70, 0, 255, 1]);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(bytes));
    const buffer = await readComparisonGeometry(url, checksum(bytes));
    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(buffer)).toEqual(bytes);
  });

  it('keeps no subject or request cache once a load completes', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(json));
    await readComparison(url, checksum(json));
    await readComparison(url, checksum(json));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  describe.each([
    ['readComparison', readComparison],
    ['readComparisonGeometry', readComparisonGeometry],
  ])('%s', (_name, read) => {
    it('reports HTTP errors before digesting', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        async () => new Response('Unavailable', { status: 503 }),
      );
      await expect(read(url, checksum(json))).rejects.toMatchObject({
        code: 'asset-fetch',
        status: 503,
        message: expect.stringMatching(/HTTP 503/),
      });
    });

    it('keeps the original network failure as the cause', async () => {
      const failure = new TypeError('Network unavailable');
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        throw failure;
      });
      await expect(read(url, checksum(json))).rejects.toMatchObject({
        code: 'asset-fetch',
        cause: failure,
      });
    });

    it('rejects changed published bytes', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('changed'));
      await expect(read(url, checksum(json))).rejects.toMatchObject({
        code: 'asset-updated',
        message: expect.stringMatching(/checksum mismatch/i),
      });
    });

    it('requires a SHA256 before sending a request', async () => {
      const fetch = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async () => new Response(json));
      for (const value of [undefined, null, '', 'wrong', 'z'.repeat(64)]) {
        await expect(read(url, value)).rejects.toThrow(/SHA-256/i);
      }
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  it('leaves validly hashed invalid JSON as the original parse error', async () => {
    const bytes = new TextEncoder().encode('{invalid');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(bytes));
    await expect(readComparison(url, checksum(bytes))).rejects.toBeInstanceOf(SyntaxError);
  });

  it('propagates digest failures as the original error', async () => {
    const failure = new DOMException('Digest unavailable', 'OperationError');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(json));
    vi.spyOn(crypto.subtle, 'digest').mockImplementation(async () => {
      throw failure;
    });
    await expect(readComparison(url, checksum(json))).rejects.toBe(failure);
  });

  it('matches the published comparison JSON and geometry to their declared SHA256 checksums', async () => {
    const directory = new URL('../../../../../public/models/cdmd/', import.meta.url);
    const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (address) => {
      const file = new URL(String(address)).pathname.split('/').at(-1)!;
      return new Response(await readFile(new URL(file, directory)));
    });
    const comparisonUrl = new URL(manifest.atlas_comparison.file, url).href;
    const data = (await readComparison(comparisonUrl, manifest.atlas_comparison.sha256)) as {
      anatomy_id: string;
      geometry: { file: string; sha256: string };
    };
    const geometry = await readComparisonGeometry(
      new URL(data.geometry.file, comparisonUrl).href,
      data.geometry.sha256,
    );
    expect(data.anatomy_id).toBe(manifest.anatomy.id);
    expect(new DataView(geometry).getUint32(0, true)).toBe(0x46546c67);
  });
});
