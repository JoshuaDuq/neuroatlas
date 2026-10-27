// Journey 7: the phone. The sheet's geometry and rests are proved in the browser tests of the
// sheet; this is the assembled page: the sheet tells the stage what it covers, the desktop to
// phone change keeps tab focus, the focus walk never lands under the sheet, 320 px fits, and the
// phone to desktop change gives the stage its room back.
import { expect, test } from '../fixtures.ts';

const PHONE = { width: 390, height: 844 };

test('the phone: the sheet tells the stage, focus survives the resize, the focus walk, the data popover, 320 px, back to a desktop', async ({
  app,
}) => {
  const { page } = app;
  await page.setViewportSize({ width: 1280, height: 800 });
  await app.gotoHash();
  await app.ready();
  const handle = page.getByRole('button', { name: /^(Expand|Collapse) panel$/ });
  const covered = () =>
    page
      .locator('#viewport')
      .evaluate((host) => parseFloat(getComputedStyle(host).getPropertyValue('--vis-bottom')));
  await expect(handle).toBeHidden();

  const tab = page.getByRole('tab', { name: 'Anatomy', exact: true });
  await tab.focus();
  await page.setViewportSize(PHONE);
  await expect(handle).toBeVisible();
  await expect(tab).toBeFocused();
  await expect.poll(covered).toBeGreaterThan(60);
  await handle.click();
  const stage = (await page.locator('#viewport').boundingBox())!;
  await expect.poll(covered).toBeCloseTo(Math.round(stage.height * 0.5), -1);

  // The page-wide focus walk never lands under the sheet.
  await handle.focus();
  for (let step = 0; step < 30; step += 1) {
    await page.keyboard.press('Tab');
    const obscured = await page.evaluate(() => {
      const focused = document.activeElement as HTMLElement;
      if (focused === document.body || focused.tagName === 'CANVAS') return false;
      if (focused.closest('#sheet')) return false;
      const rect = focused.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return !(hit && (hit === focused || focused.contains(hit) || hit.contains(focused)));
    });
    expect(obscured, `Tab ${step + 1}`).toBe(false);
  }

  // Escape in the data popover closes it onto the summary and keeps the selection.
  await page.evaluate(() => (location.hash = 'region=destrieux:left:38'));
  const summary = page.getByRole('button', { name: /^Atlas and display settings: / });
  await summary.click();
  await page.getByRole('combobox', { name: 'Colour', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(summary).toHaveAttribute('aria-expanded', 'false');
  await expect(summary).toBeFocused();
  expect(await app.hash()).toContain('destrieux:left:38');

  // SHEET-29: at 320 px the page does not scroll sideways and the last tab shows.
  await page.setViewportSize({ width: 320, height: 640 });
  await expect(page.getByRole('tab', { name: 'Tracts', exact: true })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);

  // Back to a desktop: the sheet is gone, so the stage is no longer covered.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(handle).toBeHidden();
  // The resize reaches the page after a slow software-WebGL frame, and polling slows it: see docs/testing.
  await expect.poll(covered, { timeout: 30_000 }).toBe(0);
});
