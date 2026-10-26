import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { yamlRecords } from './build/yaml-records.ts';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

// One Three.js instance for web/ and the legacy viewer/ modules the parity tests import.
const shared = {
  plugins: [svelte(), yamlRecords()],
  resolve: { dedupe: ['three', 'three-mesh-bvh', '@niivue/niivue', 'yaml'] },
  server: { fs: { allow: [repositoryRoot] } },
};

export default defineConfig({
  test: {
    projects: [
      {
        ...shared,
        test: {
          name: 'unit',
          environment: 'node',
          // The parity tests build and read the whole site; shared runners are slow.
          testTimeout: 30_000,
          include: [
            'src/**/*.test.ts',
            'build/**/*.test.ts',
            'parity/**/*.test.ts',
            'test/**/*.test.ts',
          ],
          exclude: ['src/**/*.svelte.test.ts'],
        },
      },
      {
        ...shared,
        test: {
          name: 'browser',
          include: ['src/**/*.svelte.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({
              launchOptions: {
                // Scrollbars hidden as headless hides them, so CI's headed run (tests.yml) lays
                // pages out at the widths the tests are written for.
                args: [
                  '--use-angle=swiftshader',
                  '--enable-unsafe-swiftshader',
                  '--hide-scrollbars',
                ],
              },
            }),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
