import { describe, expect, it, vi } from 'vitest';
import { fetchPublished, reloadWithoutStoredModels } from './published-assets.ts';
import { publish } from './published-test-support.ts';

const record = (version: string, fill: string) => ({ version, sha256: fill.repeat(64), size: 1 });

function recordFetches() {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (_url, _options) => new Response(''));
}

describe('fetchPublished', () => {
  it('carries each published file’s own version', async () => {
    publish({
      'models/bert/learning.glb': record('aaaa', 'a'),
      'models/bert/manifest.json': record('bbbb', 'b'),
    });
    const fetch = recordFetches();
    await fetchPublished('https://example.test/neuroatlas/models/bert/learning.glb');
    await fetchPublished('https://example.test/neuroatlas/models/bert/manifest.json');
    expect(fetch.mock.calls[0][0]).toBe(
      'https://example.test/neuroatlas/models/bert/learning.glb?v=aaaa',
    );
    expect(fetch.mock.calls[1][0]).toBe(
      'https://example.test/neuroatlas/models/bert/manifest.json?v=bbbb',
    );
    expect(fetch.mock.calls[0][1]).toMatchObject({ cache: 'no-cache', priority: 'high' });
  });

  it('refuses a file the build did not publish before any request', () => {
    publish({});
    const fetch = recordFetches();
    expect(() => fetchPublished('https://example.test/neuroatlas/models/bert/missing.glb')).toThrow(
      expect.objectContaining({
        code: 'asset-fetch',
        message: expect.stringMatching(/missing\.glb/),
      }),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends requests unversioned without a published map', async () => {
    const fetch = recordFetches();
    await fetchPublished('https://example.test/neuroatlas/models/bert/learning.glb');
    expect(fetch.mock.calls[0][0]).toBe('https://example.test/neuroatlas/models/bert/learning.glb');
  });
});

describe('reloadWithoutStoredModels', () => {
  const stubReload = () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { href: 'https://example.test/', reload });
    return reload;
  };

  it('deletes only the stored models, then reloads', async () => {
    const reload = stubReload();
    const deleted: string[] = [];
    vi.stubGlobal('caches', {
      keys: async () => ['planum-models', 'other'],
      delete: async (name: string) => deleted.push(name),
    });
    await reloadWithoutStoredModels();
    expect(deleted).toEqual(['planum-models']);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('reloads when Cache Storage is blocked', async () => {
    const reload = stubReload();
    vi.stubGlobal('caches', {
      keys: async () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
    await reloadWithoutStoredModels();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('lets any other error surface without reloading', async () => {
    const reload = stubReload();
    vi.stubGlobal('caches', {
      keys: async () => {
        throw new TypeError('broken');
      },
    });
    await expect(reloadWithoutStoredModels()).rejects.toThrow('broken');
    expect(reload).not.toHaveBeenCalled();
  });
});
