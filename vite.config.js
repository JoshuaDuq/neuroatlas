import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { parse } from 'yaml';
import { publishedVersion } from './scripts/published-version.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));

const MODEL_VERSION = publishedVersion(resolve(root, 'public'));
let outDir;

export default defineConfig({
  base: '/neuroatlas/',
  define: { __MODEL_VERSION__: JSON.stringify(MODEL_VERSION) },
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
      name: 'model-version-in-html',
      transformIndexHtml: html => html.replace('__MODEL_VERSION__', MODEL_VERSION),
    },
    {
      // Emit the service worker, stamped with the same model version the page
      // puts on its requests.
      name: 'model-service-worker',
      // Wherever this build writes, including an `--outDir` given on the command line.
      configResolved(config) { outDir = resolve(config.root, config.build.outDir); },
      closeBundle() {
        const source = readFileSync(resolve(root, 'viewer/service-worker.js'), 'utf8');
        writeFileSync(resolve(outDir, 'sw.js'), source.replace('__MODEL_VERSION__', MODEL_VERSION));
      },
    },
  ],
});
