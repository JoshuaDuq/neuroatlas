import { describe, expect, it, vi } from 'vitest';
import { loadAnatomies, resolveAnatomy } from './published-anatomy.ts';
import './published-test-support.ts';

const published = { default: 'snail', anatomies: [{ id: 'snail' }, { id: 'aomic' }] };
const indexUrl = 'https://example.invalid/models/anatomies.json';

describe('resolveAnatomy', () => {
  it('uses the published default when none is requested', () => {
    expect(resolveAnatomy(published)).toBe('snail');
  });

  it('opens the explicitly requested published anatomy', () => {
    expect(resolveAnatomy(published, 'aomic')).toBe('aomic');
  });

  it('refuses an unknown explicit anatomy instead of opening a different subject', () => {
    for (const id of ['missing', '', null, 1]) {
      expect(() => resolveAnatomy(published, id as unknown as string)).toThrow(/Unknown anatomy/);
    }
  });

  it('requires the published default to name an available subject', () => {
    expect(() => resolveAnatomy({ ...published, default: 'missing' })).toThrow(/Unknown anatomy/);
  });
});

describe('loadAnatomies', () => {
  it('revalidates the published request', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(JSON.stringify(published)));
    expect(await loadAnatomies(indexUrl)).toEqual(published);
    expect(fetch.mock.calls[0][1]).toMatchObject({ cache: 'no-cache', priority: 'high' });
  });

  it('reports the HTTP status of an unsuccessful request', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(JSON.stringify({ error: 'Unavailable' }), { status: 503 }),
    );
    await expect(loadAnatomies(indexUrl)).rejects.toMatchObject({
      code: 'asset-fetch',
      status: 503,
    });
  });

  it('propagates a network failure without a substitute subject', async () => {
    const failure = new TypeError('Network unavailable');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw failure;
    });
    await expect(loadAnatomies(indexUrl)).rejects.toMatchObject({
      code: 'asset-fetch',
      cause: failure,
    });
  });
});
