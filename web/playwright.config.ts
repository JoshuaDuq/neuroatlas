import { defineConfig } from '@playwright/test';

// The journeys run against the Svelte preview, served as GitHub Pages serves it
// (e2e/serve-site.mjs). Build it into web/dist first:
//   npm run build:preview        (web/)
const origin = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './e2e/journeys',
  testMatch: '**/*.spec.ts',
  // Software WebGL makes the first frame slow to settle.
  timeout: 90_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    // The trailing slash matters: relative URLs in the journeys resolve under the app.
    baseURL: `${origin}/neuroatlas/next/`,
    // Software WebGL, as in the browser tests (vitest.config.ts).
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node e2e/serve-site.mjs',
    url: `${origin}/neuroatlas/next/`,
    reuseExistingServer: !process.env.CI,
  },
});
