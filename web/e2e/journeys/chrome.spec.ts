// Journeys 6 and 8, and the settings menu: the data bar, the comparison download, the real PNG and
// the real full screen, and the shortcuts dialog. The wording of each is proved in the browser tests.
import { readFileSync } from 'node:fs';
import { expect, test } from '../fixtures.ts';

const field = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('combobox', { name, exact: true });

test.describe('wide window', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('data bar: a colouring that needs another atlas switches the atlas', async ({ app }) => {
    const { page } = app;
    await app.gotoHash();
    await app.ready();
    await expect(field(page, 'Atlas')).toHaveValue('destrieux');
    await field(page, 'Colour').selectOption({ label: 'CAB-NP networks (atlas becomes HCP-MMP)' });
    await expect(field(page, 'Atlas')).toHaveValue('hcp-mmp', { timeout: 60_000 });
    await expect(field(page, 'Colour')).toHaveValue('cab-np');
    expect(app.requestsTo(/cortex-hcp-mmp\.glb/)).not.toHaveLength(0);
    await expect.poll(() => app.hash()).toContain('atlas=hcp-mmp');
  });

  test('the comparison CSV downloads under the subject and region name', async ({ app }) => {
    const { page } = app;
    await app.gotoHash({ atlas: 'hcp-mmp', region: 'hcp-mmp:left:1' });
    await app.ready();
    const summary = page.locator('summary', { hasText: 'Overlap with Destrieux' });
    const panel = page.locator('details', { has: summary });
    await expect(summary).toBeVisible();
    await summary.click();
    const download = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Download CSV' }).click();
    expect((await download).suggestedFilename()).toBe('cdmd-hcp-mmp-left-1-atlas-comparison.csv');
  });

  test('Save image downloads a PNG of the real stage, and full screen goes in and out', async ({
    app,
  }) => {
    const { page } = app;
    const save = page.getByRole('button', { name: 'Save image (PNG)' });
    await app.gotoHash({ atlas: 'destrieux' });
    await app.ready();
    await expect(save).toBeEnabled();
    const downloading = page.waitForEvent('download');
    await save.click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe('planum-destrieux.png');
    const bytes = readFileSync(await download.path());
    expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const stage = (await page.locator('#viewport').boundingBox())!;
    const ratio = await page.evaluate(() => devicePixelRatio);
    expect(Math.abs(bytes.readUInt32BE(16) - stage.width * ratio)).toBeLessThanOrEqual(1);
    await expect(page.locator('#announcer')).toHaveText('Image saved as planum-destrieux.png.');

    const fullscreenElement = () => page.evaluate(() => document.fullscreenElement?.id ?? null);
    await page.locator('header').getByRole('button', { name: 'Full screen', exact: true }).click();
    await expect.poll(fullscreenElement).toBe('viewport');
    const exit = page.locator('#viewport').getByRole('button', { name: 'Exit full screen' });
    await expect(exit).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(fullscreenElement).toBeNull();
    await expect(
      page.locator('header').getByRole('button', { name: 'Full screen', exact: true }),
    ).toBeFocused();
  });

  test('SHORT-13: the settings menu opens the shortcuts, and ? does nothing once single keys are off', async ({
    app,
  }) => {
    const { page } = app;
    await app.gotoHash();
    await app.ready();
    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await page.getByRole('button', { name: 'More settings' }).click();
    await page.getByRole('button', { name: 'Keyboard shortcuts' }).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');

    await page.evaluate(() => localStorage.setItem('planum.single-key-shortcuts', 'off'));
    await page.reload();
    await app.ready();
    await page.keyboard.press('?');
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: 'More settings' }).click();
    await page.getByRole('button', { name: 'Keyboard shortcuts' }).click();
    await expect(dialog).toContainText('Turn them back on in the settings menu');
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Escape in the data popover closes it and keeps the selection', async ({ app }) => {
    const { page } = app;
    await app.gotoHash({ region: 'destrieux:left:38' });
    await app.ready();
    const summary = page.getByRole('button', { name: /^Atlas and display settings: / });
    await summary.click();
    await field(page, 'Colour').focus();
    await page.keyboard.press('Escape');
    await expect(summary).toHaveAttribute('aria-expanded', 'false');
    await expect(summary).toBeFocused();
    expect(await app.hash()).toContain('destrieux:left:38');
  });
});
