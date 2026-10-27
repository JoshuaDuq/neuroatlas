// Journey 1: cold start on the built site. The rules are ASSET-15, ASSET-21, SW-10 and the boot
// screens of BOOT-; the copy of each screen is proved in the browser tests.
import type { Page } from '@playwright/test';
import { publishedRecord } from '../../../scripts/published-version.mjs';
import { readRepoJson, repoRoot } from '../../test/repo.ts';
import { expect, test } from '../fixtures.ts';

const brain = readRepoJson<{ default: string }>('public/models/anatomies.json').default;
const prefetched = [
  'models/anatomies.json',
  `models/${brain}/manifest.json`,
  `models/${brain}/cortex-destrieux.glb`,
  `models/${brain}/learning.glb`,
];

/** The published files live at the site root, `/neuroatlas/`, beside the preview's `/neuroatlas/next/`. */
const siteRoot = (baseURL: string) => baseURL.replace(/next\/$/, '');

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, (char) => `\\${char}`);

/** The URL a published file is requested under: its path and its own content version. */
const versioned = (base: string, file: string) =>
  `${base}${file}?v=${publishedRecord(`${repoRoot}public`, file).version}`;

/** The page's WebGL 2 context is missing. */
const lackWebgl2 = (page: Page) =>
  page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string) {
      return type === 'webgl2' ? null : getContext.apply(this, arguments as unknown as [string]);
    } as typeof getContext;
  });

test('a cold start reaches ready, asks for each prefetched file once and versions every request', async ({
  app,
  baseURL,
}) => {
  const root = siteRoot(baseURL!);
  await app.gotoHash();
  await app.ready();
  await app.page.waitForLoadState('networkidle');
  await expect(app.page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(app.page).toHaveTitle('Planum');

  for (const file of prefetched) {
    expect(
      app.requestsTo(new RegExp(`/${escapeRegExp(file)}(\\?|$)`)).map(({ url }) => url),
    ).toEqual([versioned(root, file)]);
  }
  for (const { url } of app.requestsTo(/\/(models|diffusion)\//)) {
    const [path, version] = url.slice(root.length).split('?v=');
    expect(version, `${path} is requested without a version`).toBe(
      publishedRecord(`${repoRoot}public`, path!).version,
    );
  }
});

test('the service worker registers in its scope and serves the second visit', async ({
  app,
  baseURL,
}) => {
  const { page } = app;
  const root = siteRoot(baseURL!);
  await app.gotoHash();
  const scope = await page.evaluate(async (base) => {
    await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
    return (await navigator.serviceWorker.ready).scope;
  }, baseURL!);
  expect(scope).toBe(baseURL);

  const index = versioned(root, 'models/anatomies.json');
  await page.evaluate(async (url) => (await fetch(url)).arrayBuffer(), index);
  await expect
    .poll(() =>
      page.evaluate(async (url) => {
        const cache = await caches.open('planum-models');
        return (await cache.match(new URL(url).pathname + new URL(url).search)) !== undefined;
      }, index),
    )
    .toBe(true);

  const second = page.waitForResponse((response) => response.url() === index);
  await page.reload({ waitUntil: 'commit' });
  expect((await second).fromServiceWorker()).toBe(true);
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toBe(
    `${baseURL}sw.js`,
  );
});

test('without WebGL 2 the page says what is needed and offers no Retry', async ({ app }) => {
  const { page } = app;
  await lackWebgl2(page);
  await app.gotoHash();
  const message = /^This viewer needs WebGL 2, which this browser or device does not provide\./;
  await expect(page.getByRole('main').getByText(message)).toBeVisible();
  await expect(page.locator('#announcer')).toHaveText(message);
  await expect(page.locator('#app')).toHaveAttribute('data-status', 'error');
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0);
});

test('a failed start from a link says the link failed, and Retry opens Planum without it', async ({
  app,
}) => {
  const { page } = app;
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    let requests = 0;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string) {
      return type === 'webgl2' && ++requests > 1
        ? null
        : getContext.apply(this, arguments as unknown as [string]);
    } as typeof getContext;
  });
  await app.gotoHash({ tab: 'functions' });
  await expect(
    page
      .getByRole('main')
      .getByText('Could not open this link. Retry opens Planum without this link.'),
  ).toBeVisible();
  expect(page.url()).toContain('#tab=functions');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.waitForURL((url) => url.hash === '');
});

test.describe('before the app script has run', () => {
  test.beforeEach(({ page }) => page.route('**/*.js', (route) => route.abort()));

  test('the head script sets the language from the link and the theme from the system', async ({
    app,
  }) => {
    const { page } = app;
    await page.emulateMedia({ colorScheme: 'dark' });
    await app.gotoHash({ lang: 'fr' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1b1e21');
  });
});
