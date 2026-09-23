import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('.', import.meta.url));

/*
 * One hash over every published model file. Hashing only the manifests missed
 * geometry: the cortex and interior layers carry no checksum of their own.
 */
function modelVersion() {
  const models = resolve(root, 'public/models');
  const digest = createHash('sha256');
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else digest.update(entry.name).update(readFileSync(path));
    }
  };
  if (existsSync(models)) walk(models);
  return digest.digest('hex').slice(0, 16);
}

const MODEL_VERSION = modelVersion();

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
      // Byte-equivalent merge of two layers the viewer already loads separately.
      // Shipping it next to them is 28 MB nobody fetches.
      name: 'omit-unused-anatomical-merge',
      closeBundle() {
        const file = resolve(root, 'dist/models/brain-anatomical.glb');
        if (existsSync(file)) unlinkSync(file);
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
      closeBundle() {
        const source = readFileSync(resolve(root, 'viewer/service-worker.js'), 'utf8');
        writeFileSync(resolve(root, 'dist/sw.js'), source.replace('__MODEL_VERSION__', MODEL_VERSION));
      },
    },
  ],
});
