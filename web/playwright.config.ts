import { defineConfig } from '@playwright/test';

// The same specs run against the legacy viewer and the Svelte preview, served as
// GitHub Pages serves them (e2e/serve-site.mjs). Build the assembled site into the
// repository's dist/ first:
//   npm run build                                                            (repository root)
//   npm run build:preview -- --outDir ../dist/next --emptyOutDir             (web/)
const origin = 'http://127.0.0.1:4173';

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
    { name: 'next', use: { baseURL: `${origin}/neuroatlas/next/` } },
  ],
  webServer: {
    command: 'node e2e/serve-site.mjs',
    url: `${origin}/neuroatlas/`,
    reuseExistingServer: !process.env.CI,
  },
});
