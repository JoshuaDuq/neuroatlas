import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { build } from 'vite';
import type { InlineConfig, Plugin, UserConfig } from 'vite';
import viteConfig from '../vite.config.ts';

// The config creates the build plugin, which hashes `public/`; here it hashes the small fixture tree.
vi.mock('../../scripts/published-version.mjs', async (importActual) => {
  const actual = await importActual<typeof import('../../scripts/published-version.mjs')>();
  const { createPublishedFixture } = await import('./published-fixture.ts');
  const fixture = createPublishedFixture();
  return {
    ...actual,
    publishedFiles: () => actual.publishedFiles(fixture),
    publishedRecord: (_directory: string, path: string) => actual.publishedRecord(fixture, path),
  };
});

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const scratch = mkdtempSync(resolve(tmpdir(), 'planum-build-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const configFor = (mode: string): UserConfig =>
  (viteConfig as (env: { mode: string; command: 'build' }) => UserConfig)({
    mode,
    command: 'build',
  });

/** The app's own config, built into `outDir` without copying the published data. */
const buildWith = (outDir: string, overrides: InlineConfig = {}) => {
  const config = configFor('production');
  return build({
    ...config,
    ...overrides,
    configFile: false,
    root: webRoot,
    logLevel: 'silent',
    build: { ...config.build, outDir, emptyOutDir: true, copyPublicDir: false, ...overrides.build },
    plugins: [...(overrides.plugins ?? []), ...(config.plugins ?? [])],
  });
};

describe('the build', () => {
  it('BUILD-02 copies the published data in production and leaves it out of the preview', () => {
    expect(configFor('preview').build?.copyPublicDir).toBe(false);
    expect(configFor('production').build?.copyPublicDir).toBe(true);
  });

  it('BUILD-04 gives Three.js core its own three chunk, containing WebGLRenderer, and the BVH index its own', async () => {
    const probe: Plugin = {
      name: 'three-probe',
      resolveId: (id) => (id === 'three-probe' ? '\0three-probe' : null),
      load: (id) =>
        id === '\0three-probe'
          ? "import { WebGLRenderer } from 'three'; import { MeshBVH } from 'three-mesh-bvh'; console.log(WebGLRenderer, MeshBVH);"
          : null,
    };
    const outDir = resolve(scratch, 'probe');
    const result = await buildWith(outDir, {
      plugins: [probe],
      build: {
        rolldownOptions: {
          ...configFor('production').build?.rolldownOptions,
          input: 'three-probe',
        },
      },
    });
    const output = (Array.isArray(result) ? result[0] : result) as {
      output: { type: string; name: string; code: string }[];
    };
    const chunks = output.output.filter((item) => item.type === 'chunk');
    expect(chunks.find((chunk) => chunk.name === 'three')?.code).toContain('WebGLRenderer');
    expect(chunks.find((chunk) => chunk.name === 'bvh')?.code).toContain('MeshBVH');
    // BUILD-05: the service worker is written beside the bundle.
    expect(readFileSync(resolve(outDir, 'sw.js'), 'utf8')).toContain('planum-models');
  }, 120_000);

  it('BUILD-06 declares the charset within the first 1024 bytes, ahead of the prefetch script and the stylesheet', async () => {
    const outDir = resolve(scratch, 'page');
    await buildWith(outDir);
    const html = readFileSync(resolve(outDir, 'index.html'));
    const text = html.toString('utf8');
    expect(html.subarray(0, 1024).toString('utf8')).toContain('<meta charset="UTF-8"');
    expect(text.indexOf('window.__planumAssets')).toBeGreaterThan(-1);
    expect(text.indexOf('window.__planumAssets')).toBeLessThan(text.indexOf('rel="stylesheet"'));
  }, 120_000);
});
