import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { publishedAssets } from './build/published-files.ts';
import { ASSET_BASE } from './build/site.ts';
import { yamlRecords } from './build/yaml-records.ts';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

export default defineConfig({
  base: ASSET_BASE,
  // The published models and diffusion data live in the repository's public/, beside the live viewer.
  publicDir: resolve(repositoryRoot, 'public'),
  server: { fs: { allow: [repositoryRoot] } },
  build: {
    target: 'es2022',
    rolldownOptions: {
      output: {
        // Three.js and the BVH index change far less often than the viewer.
        // Splitting them keeps a chrome-only deploy from re-downloading 1 MB.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
            { name: 'bvh', test: /node_modules[\\/]three-mesh-bvh[\\/]/ },
          ],
        },
      },
    },
  },
  plugins: [svelte(), yamlRecords(), publishedAssets()],
});
