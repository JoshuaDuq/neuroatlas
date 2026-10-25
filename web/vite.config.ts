import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { siteBase } from './build/site.ts';
import { yamlRecords } from './build/yaml-records.ts';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

export default defineConfig(({ mode }) => ({
  base: siteBase(mode),
  server: { fs: { allow: [repositoryRoot] } },
  build: { target: 'es2022' },
  plugins: [svelte(), yamlRecords()],
}));
