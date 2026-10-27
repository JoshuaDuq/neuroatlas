import { defineConfig } from '@playwright/test';
import panelsEnabled from './e2e/parity/enabled/panels.ts';
import shellEnabled from './e2e/parity/enabled/shell.ts';
import stageEnabled from './e2e/parity/enabled/stage.ts';

// The same specs run against the legacy viewer and the Svelte preview, served as
// GitHub Pages serves them (e2e/serve-site.mjs). Build the assembled site into the
// repository's dist/ first:
//   npm run build                                                            (repository root)
//   npm run build:preview -- --outDir ../dist/next --emptyOutDir             (web/)
const origin = 'http://127.0.0.1:4173';

// The specs whose region is not integrated in the Svelte app are left out of the `next` project,
// so `--shard` counts only tests that run. The gate files in e2e/parity/enabled stay the one
// switch: flipping one to true lists its specs again. Each spec also skips itself at run time.
const nextIgnored = [
  ...(panelsEnabled
    ? []
    : ['anatomy-tree', 'deficits', 'functions', 'inspector', 'tracts', 'workspace']),
  ...(shellEnabled ? [] : ['boot', 'data-bar', 'masthead', 'provenance', 'shell', 'shortcuts']),
  ...(stageEnabled ? [] : ['stage-overlay']),
].map((name) => `**/parity/${name}.spec.ts`);

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  // Software WebGL makes the legacy viewer slow to settle.
  timeout: 90_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    // Software WebGL, as in the browser tests (vitest.config.ts).
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    trace: 'retain-on-failure',
  },
  projects: [
    // The trailing slash matters: relative URLs in the specs resolve under each app.
    { name: 'legacy', use: { baseURL: `${origin}/neuroatlas/` } },
    {
      name: 'next',
      testIgnore: nextIgnored,
      use: { baseURL: `${origin}/neuroatlas/next/` },
    },
  ],
  webServer: {
    command: 'node e2e/serve-site.mjs',
    url: `${origin}/neuroatlas/`,
    reuseExistingServer: !process.env.CI,
  },
});
