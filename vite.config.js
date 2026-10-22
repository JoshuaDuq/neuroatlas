import { readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { parse } from 'yaml';
import { PUBLISHED_TREES, publishedFiles, publishedRecord } from './scripts/published-version.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const base = '/neuroatlas/';
const publicDirectory = resolve(root, 'public');
const publishedModule = resolve(root, 'viewer/model/published-files.js');

/**
 * Each published file's version, sha256 and decoded size. The viewer imports
 * it in place of `published-files.js`; the head script and the service worker
 * get the versions alone.
 */
const published = publishedFiles(publicDirectory);
const versions = () => ({
  base,
  files: Object.fromEntries(Object.entries(published).map(([path, { version }]) => [path, version])),
  gunzipped: Object.fromEntries(Object.entries(published).filter(([, record]) => record.gunzipped)
    .map(([path, { gunzipped }]) => [path, gunzipped.sha256.slice(0, 16)])),
});
let outDir;
let building = false;

export default defineConfig({
  base,
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        // Three.js and the BVH index change far less often than the viewer.
        // Splitting them keeps a chrome-only deploy from re-downloading 1 MB.
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('three-mesh-bvh')) return 'bvh';
        },
      },
    },
  },
  plugins: [
    {
      // The clinical data is authored as YAML and read once, at startup.
      // Parsing it here means the bundle carries the records rather than a
      // YAML parser and 400 lines of source text for it to chew through.
      name: 'yaml-records',
      enforce: 'pre',
      load(id) {
        const file = id.split('?')[0];
        if (!file.endsWith('.yaml')) return null;
        return `export default ${JSON.stringify(parse(readFileSync(file, 'utf8')))};`;
      },
    },
    {
      name: 'published-files',
      enforce: 'pre',
      load(id) {
        if (id.split('?')[0] !== publishedModule) return null;
        return `export default ${JSON.stringify({ base, files: published })};`;
      },
      // The head script starts anatomy downloads only, so it needs no diffusion versions.
      transformIndexHtml: html => html.replace('__PUBLISHED_VERSIONS__', JSON.stringify(Object.fromEntries(
        Object.entries(versions().files).filter(([path]) => path.startsWith('models/'))))),
      // In development a rebuilt asset gets its new version on the next reload.
      configureServer(server) {
        server.watcher.on('all', (event, file) => {
          const path = relative(publicDirectory, file).split(sep).join('/');
          if (!PUBLISHED_TREES.some(tree => path.startsWith(`${tree}/`))) return;
          if (event === 'add' || event === 'change') published[path] = publishedRecord(publicDirectory, path);
          else if (event === 'unlink') delete published[path];
          else return;
          const module = server.moduleGraph.getModuleById(publishedModule);
          if (module) server.moduleGraph.invalidateModule(module);
          server.ws.send({ type: 'full-reload' });
        });
      },
      // Wherever this build writes, including an `--outDir` given on the command line.
      configResolved(config) {
        outDir = resolve(config.root, config.build.outDir);
        building = config.command === 'build';
      },
      closeBundle() {
        // A development server calls this on close, and has no build to write into.
        if (!building) return;
        const source = readFileSync(resolve(root, 'viewer/service-worker.js'), 'utf8');
        writeFileSync(resolve(outDir, 'sw.js'),
          source.replace('__PUBLISHED_VERSIONS__', JSON.stringify(versions())));
      },
    },
  ],
});
