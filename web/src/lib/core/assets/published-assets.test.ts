import { describe, expect, it, vi } from 'vitest';
import { fetchPublished } from './published-assets.ts';
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
