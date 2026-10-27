// Journey 9: tracts on the built site. The first opening downloads a bundle and says so, the
// lengths CSV downloads, and the MRI navigator opens on the real scan and steps. TRACT-33 (the
// source voxels) is proved in the browser project on the real engine's navigator.
import { readFile } from 'node:fs/promises';
import { expect, test } from '../fixtures.ts';

const AF_LEFT = 'Arcuate fasciculus · left';

test('the first check of a bundle downloads and draws it, the lengths CSV downloads, and the MRI navigator steps', async ({
  app,
}) => {
  test.setTimeout(300_000);
  const { page } = app;
  await page.setViewportSize({ width: 1280, height: 800 });
  await app.gotoHash({ tab: 'diffusion' });
  await app.ready();
  const key = (name: string) => page.getByRole('checkbox', { name, exact: true });
  await expect(key(AF_LEFT)).toBeEnabled({ timeout: 200_000 });
  await expect(key(AF_LEFT)).toBeChecked();
  await expect(key(AF_LEFT)).toHaveAccessibleDescription(/streamlines.*mean .* mm \(range/);

  await key('Cingulum · left').click();
  await expect(key('Cingulum · left')).toBeChecked({ timeout: 60_000 });
  await expect(key('Cingulum · left')).toHaveAccessibleDescription(/streamlines/);

  await page.getByText('Tract display').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export lengths CSV' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('planum-streamline-lengths.csv');
  const [header, firstRow] = (await readFile((await file.path())!, 'utf8')).split('\n');
  expect(header).toBe(
    'bundle,total_streamlines,enabled_streamlines,minimum_length_mm,mean_length_mm,min_length_mm,max_length_mm',
  );
  expect(firstRow).toMatch(/^"Arcuate fasciculus · left",\d+,\d+,1,[\d.]+,[\d.]+,[\d.]+$/);

  const opener = page.getByRole('button', { name: 'MRI with tracts' });
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'MRI with tracts · MGH CDMD sub_013' });
  await expect(dialog.getByRole('combobox', { name: 'View' })).toBeEnabled({ timeout: 240_000 });
  await expect(dialog).toContainText('source voxels');
  const readout = dialog.getByText(/^RAS:/);
  await dialog.getByRole('spinbutton', { name: /^(Voxel )?i$/ }).fill('40');
  await dialog.getByRole('spinbutton', { name: /^(Voxel )?j$/ }).fill('50');
  await dialog.getByRole('spinbutton', { name: /^(Voxel )?k$/ }).fill('60');
  await dialog.getByRole('button', { name: 'Go to voxel' }).click();
  await expect(readout).toContainText('T1:');
  const before = await readout.textContent();
  await dialog.locator('canvas').focus();
  await page.keyboard.press('ArrowRight');
  await expect(readout).not.toHaveText(before!);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});
