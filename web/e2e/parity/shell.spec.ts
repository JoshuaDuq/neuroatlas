// H1a: the app shell. Landmarks, the skip link, the pre-paint head script and #app[data-status].
// Role and name locators run on `legacy` and `next`; each difference cites its deviation record
// in web/docs/decisions/deviations/ or decision 13 on #4.
import { expect, test } from '../fixtures.ts';
import enabled from './enabled/shell.ts';

test.beforeEach((_fixtures, testInfo) => {
  test.skip(testInfo.project.name === 'next' && !enabled, 'the next shell region is not enabled');
});

const STATUSES = /^(loading|ready|switching|error|context-lost)$/;

test.describe('landmarks', () => {
  test('one banner, main and contentinfo, and the panel before the stage', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await page.setViewportSize({ width: 1280, height: 800 });
    await app.gotoHash();
    // The legacy inspector is hidden, and so not a landmark, until the anatomy has loaded.
    if (testInfo.project.name === 'legacy') await app.ready();

    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('contentinfo')).toHaveCount(1);
    await expect(page.getByRole('navigation')).toHaveCount(0);

    // Decision 13: one top-level complementary landmark holds the panels. The legacy asides
    // carry role=tabpanel, so the legacy page has none.
    const panels = page.getByRole('complementary');
    if (testInfo.project.name === 'legacy') {
      await expect(panels).toHaveCount(0);
    } else {
      await expect(panels).toHaveCount(1);
      await expect(panels).toHaveAccessibleName('Anatomical details');
    }

    // WCAG 1.3.2: the sequence a screen reader reads has the panel before the stage.
    const panelBeforeStage = await page.locator('#workspace-panel').evaluate((panel) => {
      const main = document.querySelector('main')!;
      return Boolean(panel.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(panelBeforeStage).toBe(true);
  });

  test('a phone has no contentinfo and does not scroll the page', async ({ app }) => {
    const { page } = app;
    await page.setViewportSize({ width: 390, height: 844 });
    await app.gotoHash();
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('contentinfo')).toHaveCount(0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test('#app carries a known data-status', async ({ app }) => {
    await app.gotoHash();
    await expect(app.page.locator('#app')).toHaveAttribute('data-status', STATUSES);
  });
});

test.describe('skip link', () => {
  for (const [lang, name] of [
    ['en', 'Skip to model'],
    ['fr', 'Aller au modèle'],
  ]) {
    test(`is the first Tab stop and moves focus into the stage (${lang})`, async ({ app }) => {
      const { page } = app;
      await app.gotoHash({ lang });
      const link = page.getByRole('link', { name, exact: true });
      await expect(link).toHaveCount(1);

      await page.keyboard.press('Tab');
      await expect(link).toBeFocused();
      // WCAG 2.5.8: a target of at least 24 px once it shows.
      const box = (await link.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(24);
      expect(box.height).toBeGreaterThanOrEqual(24);

      await page.keyboard.press('Enter');
      // The canvas once the engine is mounted, the main landmark until then.
      const inStage = await page.evaluate(() =>
        document.querySelector('main')!.contains(document.activeElement),
      );
      expect(inStage).toBe(true);
      // The link keeps the view: the anchor's own jump to #viewport is cancelled.
      expect(await app.hash()).not.toContain('viewport');
    });
  }

  test('keeps a border under forced colours', async ({ app }) => {
    const { page } = app;
    await page.emulateMedia({ forcedColors: 'active' });
    await app.gotoHash();
    const link = page.getByRole('link', { name: 'Skip to model', exact: true });
    await expect(link).toHaveCount(1);
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS('border-top-width', '1px');
  });
});

// Without the app's script, only the document's own head script has run.
test.describe('before the app loads', () => {
  test.beforeEach(({ page }) => page.route('**/*.js', (route) => route.abort()));

  test('<html lang> follows the link and the saved choice (deviation h1a-html-lang)', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await app.gotoHash({ lang: 'fr' });
    // Legacy leaves English until its script runs, which reads as the wrong voice.
    const expected = testInfo.project.name === 'legacy' ? 'en' : 'fr';
    await expect(page.locator('html')).toHaveAttribute('lang', expected);

    await page.addInitScript(() => localStorage.setItem('planum-lang', 'fr'));
    await app.gotoHash();
    await expect(page.locator('html')).toHaveAttribute('lang', expected);
  });

  test('the first frame has the system theme (deviation h1a-theme-flash)', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await page.emulateMedia({ colorScheme: 'dark' });
    await app.gotoHash();
    const dark = testInfo.project.name === 'next';
    await expect(page.locator('html')).toHaveAttribute('data-theme', dark ? 'dark' : 'light');
    if (dark) {
      await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1b1e21');
    }
  });

  test('a saved theme wins over the system', async ({ app }, testInfo) => {
    test.skip(testInfo.project.name === 'legacy', 'the legacy page is light until its script runs');
    const { page } = app;
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(() => localStorage.setItem('planum.theme', 'light'));
    await app.gotoHash();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});

test.describe('accessibility', () => {
  test('the shell passes axe', async ({ app }) => {
    await app.gotoHash();
    await app.page.waitForLoadState('load');
    await app.expectAccessible('shell');
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    for (const [width, height] of [
      [1280, 800],
      [390, 844],
    ]) {
      for (const lang of ['en', 'fr']) {
        test(`the shell passes axe with the skip link shown: ${colorScheme}, ${width}px, ${lang}`, async ({
          app,
        }, testInfo) => {
          // The legacy theme follows its own script and its violations are only recorded above.
          test.skip(testInfo.project.name === 'legacy');
          const { page } = app;
          await page.emulateMedia({ colorScheme });
          await page.setViewportSize({ width, height });
          await app.gotoHash({ lang });
          await page.keyboard.press('Tab');
          expect(await app.axe()).toEqual([]);
        });
      }
    }
  }
});
