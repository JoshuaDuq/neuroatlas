// Checks of the site assets that both apps must share, run on `legacy` and on `next`.
import { publishedRecord } from '../../../scripts/published-version.mjs';
import { readRepoJson, repoRoot } from '../../test/repo.ts';
import { expect, test } from '../fixtures.ts';

const publicDirectory = `${repoRoot}public`;
const brain = readRepoJson<{ default: string }>('public/models/anatomies.json').default;
// The head prefetch of the default view: the index, the manifest, one atlas and one detail level.
const prefetched = [
  'models/anatomies.json',
  `models/${brain}/manifest.json`,
  `models/${brain}/cortex-destrieux.glb`,
  `models/${brain}/learning.glb`,
];

/** The published files live at the site root, `/neuroatlas/`, beside the preview's own `/neuroatlas/next/`. */
const siteRoot = (baseURL: string) => baseURL.replace(/next\/$/, '');

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, (char) => `\\${char}`);

/** The URL a published file is requested under: its path and its own content version. */
const versioned = (base: string, file: string) =>
  `${base}${file}?v=${publishedRecord(publicDirectory, file).version}`;

test('each prefetch URL is requested once, with its current version', async ({ app, baseURL }) => {
  const root = siteRoot(baseURL!);
  await app.gotoHash();
  await app.page.waitForLoadState('networkidle');

  for (const file of prefetched) {
    expect(
      app.requestsTo(new RegExp(`/${escapeRegExp(file)}(\\?|$)`)).map(({ url }) => url),
    ).toEqual([versioned(root, file)]);
  }
  for (const { url } of app.requestsTo(/\/(models|diffusion)\//)) {
    const [path, version] = url.slice(root.length).split('?v=');
    expect(version, `${path} is requested without a version`).toBe(
      publishedRecord(publicDirectory, path!).version,
    );
  }
});

test('the service worker registers in its own scope and serves a second visit', async ({
  app,
  baseURL,
}) => {
  const { page } = app;
  const root = siteRoot(baseURL!);
  await app.gotoHash();
  // Registered here rather than by the app, which defers it until after the first frame:
  // the worker file and its scope are what both builds must get right.
  const scope = await page.evaluate(async (base) => {
    await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
    return (await navigator.serviceWorker.ready).scope;
  }, baseURL!);
  expect(scope).toBe(baseURL);

  // The worker stores a published file once the bytes it fetched hash to the published version.
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
  await page.reload();
  expect((await second).fromServiceWorker()).toBe(true);
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toBe(
    `${baseURL}sw.js`,
  );
});

test('the page declares its language and title', async ({ app }) => {
  await app.gotoHash();
  await expect(app.page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(app.page).toHaveTitle('Planum');
});

test('the live site is not marked noindex', async ({ app }, testInfo) => {
  test.skip(testInfo.project.name !== 'legacy');
  await app.gotoHash();
  await expect(app.page.locator('meta[name="robots"]')).toHaveCount(0);
});

test('the preview is marked noindex', async ({ app }, testInfo) => {
  test.skip(testInfo.project.name !== 'next');
  // web/index.html (F0) has no robots meta yet; reported on #4.
  test.fixme(true, 'the preview shell carries no robots meta yet');
  await app.gotoHash();
  await expect(app.page.locator('meta[name="robots"][content~="noindex"]')).toHaveCount(1);
});

test('the page frame passes axe', async ({ app }) => {
  await app.gotoHash();
  await app.page.waitForLoadState('load');
  await app.expectAccessible('harness');
});
