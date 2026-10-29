// Journeys 6 and 8, and the settings menu: the data bar, the comparison download, the real PNG and
// the real full screen, and the shortcuts dialog. The wording of each is proved in the browser tests.
import { readFileSync } from 'node:fs';
import { expect, test } from '../fixtures.ts';

const field = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('combobox', { name, exact: true });

test.use({ viewport: { width: 1280, height: 800 } });

test('data bar, comparison CSV, saved PNG and full screen on one load', async ({ app }) => {
  const { page } = app;
  await app.gotoHash();
  await app.ready();

  // A colouring that needs another atlas switches the atlas.
  await expect(field(page, 'Atlas')).toHaveValue('destrieux');
  await field(page, 'Colour').selectOption({ label: 'CAB-NP networks (atlas becomes HCP-MMP)' });
  await expect(field(page, 'Atlas')).toHaveValue('hcp-mmp', { timeout: 60_000 });
  await expect(field(page, 'Colour')).toHaveValue('cab-np');
  expect(app.requestsTo(/cortex-hcp-mmp\.glb/)).not.toHaveLength(0);
  await expect.poll(() => app.hash()).toContain('atlas=hcp-mmp');

  // The comparison CSV downloads under the subject and region name.
  await page.evaluate(() => {
    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    params.set('region', 'hcp-mmp:left:1');
    location.hash = params.toString().replaceAll('%3A', ':').replaceAll('%2C', ',');
  });
  const summary = page.locator('summary', { hasText: 'Overlap with Destrieux' });
  const panel = page.locator('details', { has: summary });
  await summary.click();
  const csv = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Download CSV' }).click();
  expect((await csv).suggestedFilename()).toBe(
    'cdmd-hcp-mmp-left-1-destrieux-atlas-comparison.csv',
  );

  // Save image downloads a PNG of the real stage.
  const save = page.getByRole('button', { name: 'Save image (PNG)' });
  const downloading = page.waitForEvent('download');
  await save.click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('planum-hcp-mmp.png');
  const bytes = readFileSync(await download.path());
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const stage = (await page.locator('#viewport').boundingBox())!;
  const ratio = await page.evaluate(() => devicePixelRatio);
  expect(Math.abs(bytes.readUInt32BE(16) - stage.width * ratio)).toBeLessThanOrEqual(1);
  await expect(page.locator('#announcer')).toHaveText('Image saved as planum-hcp-mmp.png.');

  // Real full screen in and out.
  const fullscreenElement = () => page.evaluate(() => document.fullscreenElement?.id ?? null);
  const enter = page.locator('header').getByRole('button', { name: 'Full screen', exact: true });
  await enter.click();
  await expect.poll(fullscreenElement).toBe('viewport');
  await expect(
    page.locator('#viewport').getByRole('button', { name: 'Exit full screen' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(fullscreenElement).toBeNull();
  await expect(enter).toBeFocused();
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
