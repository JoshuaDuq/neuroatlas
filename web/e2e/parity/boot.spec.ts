// H1b: the boot screen. The WebGL capability check, the failure screen, and the stage status
// (loading, error, context lost), in the legacy viewer (main.js:26-60, viewport-chrome.js:63-83,
// 749-781) and in the Svelte app. Role and name locators run on `legacy` and `next`; each
// difference cites its deviation record in web/docs/decisions/deviations/.
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import enabled from './enabled/shell.ts';

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'next' && !enabled,
    'the next stage status is mounted by the shell region (I3b)',
  );
});

const TEXT = {
  en: {
    webgl2: /^This viewer needs WebGL 2, which this browser or device does not provide\./,
    floatTargets: /^This viewer needs WebGL 2 with floating-point render targets/,
    start: 'Could not load the anatomy.',
    link: 'Could not open this link. Retry opens Planum without this link.',
    loading: 'Loading anatomy…',
    contextLost: 'The 3D view was interrupted by the graphics driver. Restoring…',
    retry: 'Retry',
  },
  fr: {
    webgl2:
      /^Cette visionneuse nécessite WebGL 2, que ce navigateur ou cet appareil ne fournit pas\./,
    floatTargets: /^Cette visionneuse nécessite WebGL 2 avec des cibles de rendu/,
    start: 'Impossible de charger l’anatomie.',
    link: 'Impossible d’ouvrir ce lien. Réessayer ouvre Planum sans ce lien.',
    loading: 'Chargement de l’anatomie…',
    contextLost: 'La vue 3D a été interrompue par le pilote graphique. Restauration…',
    retry: 'Réessayer',
  },
};

/** The page's WebGL 2 context is missing, or lacks the float render-target extension. */
async function lackWebgl(page: Page, missing: 'webgl2' | 'floatTargets') {
  await page.addInitScript((missing) => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string) {
      // @ts-expect-error forwarding the overloaded call
      const context = getContext.apply(this, arguments) as WebGL2RenderingContext | null;
      if (type !== 'webgl2') return context;
      if (missing === 'webgl2' || !context) return null;
      const getExtension = context.getExtension;
      context.getExtension = function (this: WebGL2RenderingContext, name: string) {
        // @ts-expect-error forwarding the overloaded call
        return name === 'EXT_color_buffer_float' ? null : getExtension.apply(this, arguments);
      } as typeof getExtension;
      return context;
    } as typeof getContext;
  }, missing);
}

/** Every published file fails to download. */
const failDownloads = (page: Page) => page.route('**/models/**', (route) => route.abort());

const main = (page: Page) => page.getByRole('main');
const retryButton = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

for (const lang of ['en', 'fr'] as const) {
  const text = TEXT[lang];

  test.describe(`capability errors (${lang})`, () => {
    test('no WebGL 2 says what is needed, without Retry, and is announced once', async ({
      app,
    }) => {
      const { page } = app;
      await lackWebgl(page, 'webgl2');
      await app.gotoHash({ lang });
      await expect(main(page).getByText(text.webgl2)).toBeVisible();
      await expect(page.locator('#announcer')).toHaveText(text.webgl2);
      await expect(retryButton(page, text.retry)).toHaveCount(0);
      await expect(page.locator('#app')).toHaveAttribute('data-status', 'error');
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
    });

    test('WebGL 2 without float render targets says so, without Retry', async ({ app }) => {
      const { page } = app;
      await lackWebgl(page, 'floatTargets');
      await app.gotoHash({ lang });
      await expect(main(page).getByText(text.floatTargets)).toBeVisible();
      await expect(retryButton(page, text.retry)).toHaveCount(0);
    });
  });

  test.describe(`failed start (${lang})`, () => {
    test('a failed download says so and offers Retry', async ({ app }) => {
      const { page } = app;
      await failDownloads(page);
      await app.gotoHash({ lang });
      await expect(main(page).getByText(text.start, { exact: false })).toBeVisible();
      await expect(retryButton(page, text.retry)).toBeVisible();
      await expect(page.getByRole('progressbar')).toHaveCount(0);
    });

    test('a failed start from a link says the link failed, and Retry drops the hash', async ({
      app,
    }) => {
      const { page } = app;
      // A download failure is the network's, not the link's, so make the renderer the cause:
      // the capability probe gets its context, the renderer's own request for one is refused.
      await page.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        let requests = 0;
        HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string) {
          // @ts-expect-error forwarding the overloaded call
          return type === 'webgl2' && ++requests > 1 ? null : getContext.apply(this, arguments);
        } as typeof getContext;
      });
      await app.gotoHash({ lang, tab: 'functions' });
      await expect(main(page).getByText(text.link)).toBeVisible();
      await retryButton(page, text.retry).click();
      await page.waitForURL((url) => url.hash === '');
      expect(page.url()).not.toContain('#');
    });
  });
}

test.describe('loading', () => {
  test('a pending request shows the message and no Retry', async ({ app }) => {
    const { page } = app;
    // Held, never answered: the page stays in `loading`.
    await page.route('**/models/**', () => {});
    await app.gotoHash();
    await expect(main(page).getByText(TEXT.en.loading)).toBeVisible();
    await expect(retryButton(page, 'Retry')).toHaveCount(0);
    await expect(page.locator('#app')).toHaveAttribute('data-status', 'loading');
    await expect(page.locator('#announcer')).toHaveText(TEXT.en.loading);
  });

  // The new app writes the megabytes in the reader's notation: c1-loading-megabytes.md.
  test('a slow download shows a determinate bar and its megabytes, and speaks only at the start', async ({
    app,
  }) => {
    const { page } = app;
    const session = await page.context().newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: 1_048_576,
      uploadThroughput: -1,
    });
    await app.gotoHash();
    const bar = page.getByRole('progressbar', { name: /^(Anatomy download|Téléchargement)/ });
    await expect(bar).toBeVisible();
    await expect(main(page).getByText(/^Loading anatomy · /)).toBeVisible();
    const value = async () =>
      Number(
        await bar.evaluate(
          (el: HTMLProgressElement) => el.value ?? el.getAttribute('aria-valuenow'),
        ),
      );
    const first = await value();
    await expect.poll(value).toBeGreaterThan(first);
    await expect(page.locator('#announcer')).toHaveText(TEXT.en.loading);
  });
});

test.describe('accessibility', () => {
  test('the failure screen is axe-clean in the reader theme, light and dark', async ({ app }) => {
    const { page } = app;
    await lackWebgl(page, 'webgl2');
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await app.gotoHash();
      await expect(main(page).getByText(TEXT.en.webgl2)).toBeVisible();
      await app.expectAccessible(`boot-${scheme}`);
    }
  });

  test('forced colours and reduced motion leave the failure message readable', async ({ app }) => {
    const { page } = app;
    await lackWebgl(page, 'webgl2');
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await app.gotoHash();
    await expect(main(page).getByText(TEXT.en.webgl2)).toBeVisible();
  });
});

test.describe('after a lost graphics context', () => {
  test('says the view was interrupted, without Retry, and returns when restored', async ({
    app,
  }) => {
    const { page } = app;
    await app.gotoHash();
    await app.ready();
    await page.evaluate(() => {
      const canvas = document.querySelector('#app canvas')!;
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    });
    await expect(main(page).getByText(TEXT.en.contextLost)).toBeVisible();
    await expect(page.locator('#announcer')).toHaveText(TEXT.en.contextLost);
    await expect(retryButton(page, 'Retry')).toHaveCount(0);
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    await page.evaluate(() => {
      document.querySelector('#app canvas')!.dispatchEvent(new Event('webglcontextrestored'));
    });
    await expect(page.locator('#app')).toHaveAttribute('data-status', 'ready');
    await expect(page.locator('#announcer')).toHaveText('Anatomy loaded.');
  });
});
