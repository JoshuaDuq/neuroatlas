import { readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformWithOxc, type Plugin, type ResolvedConfig } from 'vite';
import {
  PUBLISHED_TREES,
  publishedFiles,
  publishedRecord,
} from '../../scripts/published-version.mjs';
import type { PublishedRecord } from '../src/lib/core/assets/published-files.ts';
import { ASSET_BASE } from './site.ts';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const publicDirectory = resolve(webRoot, '../public');
const publishedModule = resolve(webRoot, 'src/lib/core/assets/published-files.ts');
const serviceWorkerSource = resolve(webRoot, 'src/service-worker.ts');
const prefetchSource = resolve(webRoot, 'src/boot/prefetch.js');

type Published = Record<string, PublishedRecord>;

export interface WorkerVersions {
  base: string;
  files: Record<string, string>;
  gunzipped: Record<string, string>;
}

/** The map the service worker is built with: every file's version, and the contents' version of each `.gz`. */
export function workerVersions(published: Published): WorkerVersions {
  return {
    base: ASSET_BASE,
    files: Object.fromEntries(
      Object.entries(published).map(([path, { version }]) => [path, version]),
    ),
    gunzipped: Object.fromEntries(
      Object.entries(published).flatMap(([path, { gunzipped }]) =>
        gunzipped ? [[path, gunzipped.sha256.slice(0, 16)]] : [],
      ),
    ),
  };
}

/** The head script starts anatomy downloads only, so it needs no diffusion versions. */
export function headVersions(published: Published): Record<string, string> {
  return Object.fromEntries(
    Object.entries(workerVersions(published).files).filter(([path]) => path.startsWith('models/')),
  );
}

/** The head prefetch script with the published root and the anatomy versions written in. */
export function prefetchScript(versions: Record<string, string>): string {
  return readFileSync(prefetchSource, 'utf8')
    .replace('__ASSET_BASE__', () => JSON.stringify(ASSET_BASE))
    .replace('__PUBLISHED_VERSIONS__', () => JSON.stringify(versions));
}

/** The service worker type-stripped to plain JavaScript, with the version map written in. */
export async function serviceWorkerCode(versions: WorkerVersions): Promise<string> {
  const { code } = await transformWithOxc(
    readFileSync(serviceWorkerSource, 'utf8'),
    serviceWorkerSource,
    { lang: 'ts' },
  );
  return code.replace('__PUBLISHED_VERSIONS__', () => JSON.stringify(versions));
}

/**
 * Every published file's version, sha256 and decoded size. The app imports
 * the map in place of `published-files.ts`; the head script and the service
 * worker get the versions alone.
 */
export function publishedAssets(): Plugin {
  const published = publishedFiles(publicDirectory) as Published;
  let outDir: string;
  let building = false;

  return {
    name: 'published-files',
    enforce: 'pre',
    load(id) {
      if (id.split('?')[0] !== publishedModule) return null;
      return `export default ${JSON.stringify({ base: ASSET_BASE, files: published })};`;
    },
    // Appended to <head> before Vite adds the stylesheet link, so the script still starts
    // ahead of the CSS while <meta charset> stays within the first 1024 bytes (HTML Standard 4.2.5.4).
    transformIndexHtml: {
      order: 'pre',
      handler: () => [
        {
          tag: 'script',
          children: prefetchScript(headVersions(published)),
          injectTo: 'head',
        },
      ],
    },
    // In development a rebuilt asset gets its new version on the next reload.
    configureServer(server) {
      server.watcher.add(PUBLISHED_TREES.map((tree) => resolve(publicDirectory, tree)));
      server.watcher.on('all', (event, file) => {
        const path = relative(publicDirectory, file).split(sep).join('/');
        if (!PUBLISHED_TREES.some((tree) => path.startsWith(`${tree}/`))) return;
        if (event === 'add' || event === 'change')
          published[path] = publishedRecord(publicDirectory, path);
        else if (event === 'unlink') delete published[path];
        else return;
        const module = server.moduleGraph.getModuleById(publishedModule);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      });
    },
    // Wherever this build writes, including an `--outDir` given on the command line.
    configResolved(config: ResolvedConfig) {
      outDir = resolve(config.root, config.build.outDir);
      building = config.command === 'build';
    },
    async closeBundle() {
      // A development server calls this on close, and has no build to write into.
      if (!building) return;
      writeFileSync(resolve(outDir, 'sw.js'), await serviceWorkerCode(workerVersions(published)));
    },
  };
}
