import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { repoRoot } from '../../../test/repo.ts';
import type { Engine } from './api.ts';
import { createEngine } from './index.ts';

/** The browser globals the engine reads, as a bare DOM-less Node needs them. Undo with `vi.unstubAllGlobals()`. */
export function stubHeadlessGlobals() {
  vi.spyOn(EffectComposer.prototype, 'render').mockImplementation(() => {});
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('document', { documentElement: {} });
  vi.stubGlobal('location', { href: 'http://localhost/' });
  vi.stubGlobal('getComputedStyle', () => ({
    getPropertyValue: (name: string) => (name === '--scene-exposure' ? '1' : '#808080'),
  }));
}

/** Boot the real engine on the CDMD manifest in a stage 800 × 600. */
export function bootHeadless(): Promise<Engine> {
  const host = Object.assign(new EventTarget(), {
    prepend() {},
    getBoundingClientRect: () => ({ width: 800, height: 600 }),
  });
  return createEngine({
    host: host as unknown as HTMLElement,
    manifestUrl: 'http://localhost/models/cdmd/manifest.json',
    theme: 'light',
  });
}

/**
 * Answer `fetch` from the repository's `public/` directory: the volumes, the tracts and the overlap file
 * are requests the engine makes by URL. A request is served by the part of its path from `models/` or
 * `diffusion/` on. Undo with `vi.unstubAllGlobals()`.
 */
export function stubPublishedFetch() {
  vi.stubGlobal('fetch', async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const at = url.pathname.search(/\/(models|diffusion)\//);
    if (at < 0) return new Response(null, { status: 404 });
    const file = fileURLToPath(new URL(`public${url.pathname.slice(at)}`, `file://${repoRoot}`));
    try {
      return new Response(await readFile(file));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return new Response(null, { status: 404 });
      }
      throw error;
    }
  });
}
