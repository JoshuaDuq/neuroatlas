import { describe, expect, it, vi } from 'vitest';
import anatomies from '../../../public/models/anatomies.json' with { type: 'json' };
import manifestFile from '../../../public/models/cdmd/manifest.json' with { type: 'json' };
import { prefetchScript } from '../../build/published-files.ts';
import { ASSET_BASE } from '../../build/site.ts';
import type { Manifest } from '../lib/types/index.ts';

const manifest = manifestFile as unknown as Manifest;
const ORIGIN = 'https://example.org';

const versions = {
  'models/anatomies.json': 'index0000000000a',
  'models/bert/manifest.json': 'manifest00000000',
  'models/bert/cortex-hcp-mmp.glb': 'hcp0000000000000',
  'models/bert/cortex-destrieux.glb': 'destrieux0000000',
  'models/bert/nextbrain.glb': 'fine000000000000',
  'models/bert/structures.glb': 'structures0000000',
  'models/bert/learning.glb': 'learning000000000',
};

/** Runs the script as the browser would, against a stub window, location and fetch. */
function run(hash: string, reply = '{}') {
  const requested: string[] = [];
  const window: { __planumAssets?: Record<string, Promise<Response>> } = {};
  const fetch = async (url: string) => {
    requested.push(url);
    return new Response(reply);
  };
  new Function('window', 'location', 'fetch', prefetchScript(versions))(
    window,
    { hash, origin: ORIGIN },
    fetch,
  );
  return { requested, window };
}

const pathOf = (url: string) => new URL(url).pathname.slice(ASSET_BASE.length);
const INDEX_URL = `${ORIGIN}${ASSET_BASE}models/anatomies.json`;

describe('the head prefetch script', () => {
  it('ASSET-16 asks for each file at the version the build publishes for it, under the published root', () => {
    const { requested, window } = run('#anatomy=bert&atlas=hcp-mmp&detail=nextbrain');
    expect(requested.sort()).toEqual([
      'https://example.org/neuroatlas/models/anatomies.json?v=index0000000000a',
      'https://example.org/neuroatlas/models/bert/cortex-hcp-mmp.glb?v=hcp0000000000000',
      'https://example.org/neuroatlas/models/bert/manifest.json?v=manifest00000000',
      'https://example.org/neuroatlas/models/bert/nextbrain.glb?v=fine000000000000',
    ]);
    expect(Object.keys(window.__planumAssets!).sort()).toEqual(
      requested.map((url) => url.split('?')[0]).sort(),
    );
  });

  it.each([
    { hash: '#anatomy=bert', file: 'cortex-destrieux.glb', detail: 'learning.glb' },
    { hash: '#anatomy=bert&atlas=hcp-mmp', file: 'cortex-hcp-mmp.glb', detail: 'learning.glb' },
    {
      hash: '#anatomy=bert&atlas=other&detail=aseg',
      file: 'cortex-destrieux.glb',
      detail: 'structures.glb',
    },
    {
      hash: '#anatomy=bert&detail=nextbrain',
      file: 'cortex-destrieux.glb',
      detail: 'nextbrain.glb',
    },
    { hash: '#anatomy=bert&detail=nowhere', file: 'cortex-destrieux.glb', detail: 'learning.glb' },
  ])('ASSET-16 $hash starts $file and $detail', ({ hash, file, detail }) => {
    expect(run(hash).requested.map(pathOf).sort()).toEqual(
      [
        'models/anatomies.json',
        'models/bert/manifest.json',
        `models/bert/${file}`,
        `models/bert/${detail}`,
      ].sort(),
    );
  });

  it('ASSET-16 asks for the files revalidated and at high priority', () => {
    const calls: [string, RequestInit][] = [];
    const fetch = (url: string, options: RequestInit) => {
      calls.push([url, options]);
      return Promise.resolve(new Response('{}'));
    };
    new Function('window', 'location', 'fetch', prefetchScript(versions))(
      {},
      { hash: '#anatomy=bert', origin: ORIGIN },
      fetch,
    );
    expect(calls).toHaveLength(4);
    for (const [, options] of calls) {
      expect(options).toEqual({ cache: 'no-cache', priority: 'high' });
    }
  });

  it('ASSET-17 prefetches the brain the index names when the link names none', async () => {
    const { requested } = run('', '{"default":"bert"}');
    await vi.waitFor(() => expect(requested).toHaveLength(4));
    expect(requested.map(pathOf)).toContain('models/bert/manifest.json');
  });

  it('ASSET-17 prefetches the link’s brain without waiting for the index', () => {
    const { requested } = run('#anatomy=bert');
    expect(requested.map(pathOf)).toContain('models/bert/manifest.json');
    expect(requested).toHaveLength(4);
  });

  it('ASSET-18 hands the index to the app only once the brain it names has started', async () => {
    const { requested, window } = run('', '{"default":"bert"}');
    expect(requested).toHaveLength(1);
    const response = await window.__planumAssets![INDEX_URL]!;
    expect(response.ok).toBe(true);
    expect(requested.map(pathOf)).toContain('models/bert/manifest.json');
  });

  it.each(['not json', 'null'])(
    'ASSET-18 still hands over an index that is %s, with one request, for the app to report',
    async (reply) => {
      const { requested, window } = run('', reply);
      expect(await (await window.__planumAssets![INDEX_URL]!).text()).toBe(reply);
      expect(requested).toHaveLength(1);
    },
  );

  it('ASSET-19 starts neither the tissue envelopes nor the cord, for any atlas and detail level', () => {
    const later = [
      manifest.solid_envelopes!.file,
      ...(manifest.supplemental_layers ?? []).map((layer) => layer.file),
    ];
    expect(later).toEqual(['tissue-envelopes.glb', 'spinal-cord.glb']);
    for (const atlas of manifest.atlases) {
      for (const level of manifest.detail_levels) {
        const hash = `#anatomy=cdmd&atlas=${atlas.id}&detail=${level.id}`;
        const files = run(hash).requested.map((url) => pathOf(url).split('/').pop());
        for (const file of later) expect(files).not.toContain(file);
      }
    }
  });

  it('ASSET-20 asks only for files the default manifest publishes, and for every atlas and detail level', () => {
    expect(anatomies.default).toBe('cdmd');
    const published = (hash: string) =>
      run(hash).requested.map((url) => pathOf(url).split('?')[0]!.split('/').pop());
    const manifestFiles = ['anatomies.json', 'manifest.json'];
    const layerFiles = new Set([
      ...manifest.atlases.map((entry) => entry.file),
      ...manifest.detail_levels.map((entry) => entry.file),
    ]);
    for (const atlas of manifest.atlases) {
      const files = published(`#anatomy=cdmd&atlas=${atlas.id}`);
      expect(files).toContain(atlas.file);
      for (const file of files)
        expect(manifestFiles.includes(file!) || layerFiles.has(file!)).toBe(true);
    }
    for (const level of manifest.detail_levels) {
      const files = published(`#anatomy=cdmd&detail=${level.id}`);
      expect(files).toContain(level.file);
      for (const file of files)
        expect(manifestFiles.includes(file!) || layerFiles.has(file!)).toBe(true);
    }
  });

  it('ASSET-16 fetches from the published root', () => {
    expect(JSON.parse(prefetchScript(versions).match(/var root = ("[^"]+");/)![1]!)).toBe(
      '/neuroatlas/',
    );
    for (const url of run('#anatomy=bert').requested) {
      expect(new URL(url).pathname.startsWith('/neuroatlas/')).toBe(true);
    }
  });
});
