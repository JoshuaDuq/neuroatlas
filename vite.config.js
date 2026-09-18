import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: '/neuroatlas/',
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
      /*
       * Emit the service worker, stamped with a version derived from what the
       * published manifests say rather than from this build. A code-only
       * deploy then leaves a reader's cached anatomy alone; republishing a
       * brain replaces it.
       */
      name: 'model-service-worker',
      closeBundle() {
        const models = resolve(root, 'dist/models');
        if (!existsSync(models)) return;
        const digest = createHash('sha256');
        // The manifests carry a checksum per published file, so hashing them
        // covers every asset without reading a hundred megabytes of geometry.
        for (const name of readdirSync(models).sort()) {
          for (const file of ['manifest.json', 'tissue-labels.json', 'volumes.json']) {
            const path = resolve(models, name, file);
            if (existsSync(path)) digest.update(readFileSync(path));
          }
        }
        const index = resolve(root, 'dist/models/anatomies.json');
        if (existsSync(index)) digest.update(readFileSync(index));
        const source = readFileSync(resolve(root, 'viewer/service-worker.js'), 'utf8');
        writeFileSync(
          resolve(root, 'dist/sw.js'),
          source.replace('__MODEL_VERSION__', digest.digest('hex').slice(0, 16)),
        );
      },
    },
  ],
});
