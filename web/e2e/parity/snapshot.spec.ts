// G6: Save image (PNG) and full screen (viewer/app.js:1450-1463; viewport-chrome.js:625-631, 796-831), run on
// both apps with role and name locators. The masthead buttons are the shell's and the exit control the
// stage's, so `next` runs once both regions are integrated. Differences cite their deviation records:
// g6-fullscreen-exit (exit control, labels), g6-fullscreen-focus, g6-snapshot-blob (an object URL, not a
// data URL) and the approved success announcement (decision 33 on #4).
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import shellEnabled from './enabled/shell.ts';
import stageEnabled from './enabled/stage.ts';

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'next' && !(shellEnabled && stageEnabled),
    'the shell and stage regions are not integrated',
  );
});

const saveImage = (page: Page) => page.getByRole('button', { name: 'Save image (PNG)' });
const fullScreen = (page: Page) =>
  page.locator('header').getByRole('button', { name: 'Full screen', exact: true });
const fullscreenElement = (page: Page) =>
  page.evaluate(() => document.fullscreenElement?.id ?? null);

/** Width and height from a PNG's IHDR chunk. */
function pngSize(bytes: Buffer) {
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test.describe('save image', () => {
  test('is unavailable until the anatomy is drawn, then downloads planum-<atlas>.png of the visible stage', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await page.setViewportSize({ width: 1280, height: 800 });
    await app.gotoHash({ atlas: 'destrieux' });
    await expect(saveImage(page)).toBeDisabled();
    await app.ready();
    await expect(saveImage(page)).toBeEnabled();
    const downloading = page.waitForEvent('download');
    await saveImage(page).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe('planum-destrieux.png');
    const size = pngSize(readFileSync(await download.path()));
    // The visible stage, in device pixels.
    const stage = await page.locator('#viewport').boundingBox();
    const ratio = await page.evaluate(() => devicePixelRatio);
    expect(Math.abs(size.width - stage!.width * ratio)).toBeLessThanOrEqual(1);
    expect(size.height).toBeGreaterThan(0);
    expect(size.height).toBeLessThanOrEqual(Math.ceil(stage!.height * ratio));
    await expect(saveImage(page)).toBeFocused();
    if (testInfo.project.name === 'next') {
      await expect(page.locator('#announcer')).toHaveText('Image saved as planum-destrieux.png.');
    }
  });
});

test.describe('full screen', () => {
  test('is not offered where the browser has no full screen', async ({ app }) => {
    const { page } = app;
    await page.addInitScript(() =>
      Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false }),
    );
    await app.gotoHash();
    await app.ready();
    await expect(saveImage(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Full screen' })).toHaveCount(0);
  });

  test('shows the stage alone; next names the way out, focuses it and gives focus back on leaving', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await page.setViewportSize({ width: 1280, height: 800 });
    await app.gotoHash();
    await app.ready();
    await fullScreen(page).click();
    await expect.poll(() => fullscreenElement(page)).toBe('viewport');
    if (testInfo.project.name === 'legacy') {
      // No way out but the browser's own Escape, and the label never changes (g6-fullscreen-exit).
      await page.evaluate(() => document.exitFullscreen());
      await expect.poll(() => fullscreenElement(page)).toBeNull();
      await expect(fullScreen(page)).toBeVisible();
      return;
    }
    const exit = page.locator('#viewport').getByRole('button', { name: 'Exit full screen' });
    await expect(exit).toBeVisible();
    await expect(exit).toBeFocused();
    // Focus is never under the stage's own chrome (WCAG 2.4.11).
    const box = (await exit.boundingBox())!;
    const hit = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.textContent?.trim(),
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    );
    expect(hit).toContain('Exit full screen');
    await app.expectAccessible('snapshot');
    await page.keyboard.press('Enter');
    await expect.poll(() => fullscreenElement(page)).toBeNull();
    await expect(exit).toBeHidden();
    await expect(fullScreen(page)).toBeFocused();
  });

  test('French names both labels', async ({ app }, testInfo) => {
    test.skip(testInfo.project.name === 'legacy', 'legacy labels never change');
    const { page } = app;
    await page.setViewportSize({ width: 1280, height: 800 });
    await app.gotoHash({ lang: 'fr' });
    await app.ready();
    await page.locator('header').getByRole('button', { name: 'Plein écran', exact: true }).click();
    await expect(
      page.locator('#viewport').getByRole('button', { name: 'Quitter le plein écran' }),
    ).toBeFocused();
  });
});
