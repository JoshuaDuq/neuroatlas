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
                args: [
                  '--use-angle=swiftshader',
                  '--enable-unsafe-swiftshader',
                  // Headless Linux has no pointing device, so it reports (hover: none) and
                  // (pointer: none) where macOS reports a mouse. Pin a mouse (hover = 2,
                  // fine = 4) so every host runs the same media queries; touch tests emulate.
                  '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4',
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
