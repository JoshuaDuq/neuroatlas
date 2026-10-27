// BUILD-10: axe on the composed, loaded app, once per theme at a desktop and a 390 px phone width,
// on one load, then with a selection. Each feature's own states (open dialogs, French, every panel) are axe-checked in its
// browser test.
import { expect, test } from '../fixtures.ts';

test('the loaded app passes axe in both themes at a desktop and a phone width', async ({ app }) => {
  const { page } = app;
  await app.gotoHash();
  await app.ready();
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const [width, height] of [
      [1280, 800],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
      expect(await app.axe(), `${colorScheme}, ${width} px`).toEqual([]);
    }
  }
  // A selection, whose strip is on the page at a desktop and in the phone's sheet.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => (location.hash = 'region=destrieux:left:38'));
  await expect(page.getByRole('button', { name: 'Clear selection' })).toBeVisible();
  expect(await app.axe(), 'dark, 1280 px, with a selection').toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Middle temporal gyrus L, left' })).toBeVisible();
  expect(await app.axe(), 'dark, 390 px, with a selection').toEqual([]);
});
