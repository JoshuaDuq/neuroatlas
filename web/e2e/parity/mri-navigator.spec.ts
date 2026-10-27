// The diffusion MRI navigator, run on `legacy` and on `next` with role and name locators. `next` runs
// once the panels region is integrated (I1 flips e2e/parity/enabled/panels.ts); each difference
// between the two cites its deviation record in docs/decisions/deviations/.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import panelsEnabled from './enabled/panels.ts';

const TITLE = 'MRI with tracts · MGH CDMD sub_013';

test.beforeEach(async ({ app }, testInfo) => {
  test.skip(
    testInfo.project.name === 'next' && !panelsEnabled,
    'The panels region is not integrated yet (I1).',
  );
  // The first opening decodes the reference dataset, then NiiVue reads two volumes, on software WebGL.
  test.setTimeout(300_000);
  await app.gotoHash({ tab: 'diffusion' });
  await app.ready();
  await expect(
    app.page.getByRole('checkbox', { name: 'Arcuate fasciculus · left', exact: true }),
  ).toBeEnabled({ timeout: 200_000 });
});

const opener = (page: Page) => page.getByRole('button', { name: 'MRI with tracts' });
const dialog = (page: Page) => page.getByRole('dialog', { name: TITLE });
const plane = (page: Page) => dialog(page).getByRole('combobox', { name: 'View' });
const canvas = (page: Page) => dialog(page).locator('canvas');
const readout = (page: Page) => dialog(page).getByText(/^RAS:/);

/** Opens the dialog from the keyboard and waits for the scan: the controls enable once it has loaded. */
async function open(page: Page) {
  await opener(page).focus();
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeVisible();
  await expect(plane(page)).toBeEnabled({ timeout: 240_000 });
  await expect(readout(page)).toBeVisible();
}

async function expectClosedToOpener(page: Page, closed: Locator) {
  await expect(closed).toBeHidden();
  await expect(opener(page)).toBeFocused();
}

test('a modal on the reference MRI: Close first, the view, the voxel form and the three sliders', async ({
  app,
}) => {
  const { page } = app;
  await open(page);
  await expect(page.getByRole('heading', { level: 2, name: TITLE })).toBeVisible();
  await expect(dialog(page).getByRole('button', { name: 'Close' })).toBeFocused();
  await expect(plane(page)).toHaveValue('MULTIPLANAR');
  // Deviation t2-voxel-group: the next app names the fields "Voxel i" and so on.
  for (const axis of ['i', 'j', 'k']) {
    await expect(
      dialog(page).getByRole('spinbutton', { name: new RegExp(`^(Voxel )?${axis}$`) }),
    ).toBeEnabled();
  }
  await expect(dialog(page).getByRole('button', { name: 'Go to voxel' })).toBeEnabled();
  // Deviation t2-slider-output: legacy puts the number in the slider's name, the next app does not.
  for (const name of ['Window', 'Level', 'FA opacity']) {
    await expect(dialog(page).getByRole('slider', { name: new RegExp(`^${name}`) })).toBeEnabled();
  }
  await expect(dialog(page)).toContainText('source voxels');
});

test('the voxel form, a canvas key and the plane select each move or change the view', async ({
  app,
}) => {
  const { page } = app;
  await open(page);

  await dialog(page)
    .getByRole('spinbutton', { name: /^(Voxel )?i$/ })
    .fill('40');
  await dialog(page)
    .getByRole('spinbutton', { name: /^(Voxel )?j$/ })
    .fill('50');
  await dialog(page)
    .getByRole('spinbutton', { name: /^(Voxel )?k$/ })
    .fill('60');
  await dialog(page).getByRole('button', { name: 'Go to voxel' }).click();
  await expect(readout(page)).toContainText('T1:');
  const before = await readout(page).textContent();

  // The canvas takes the arrow keys: one voxel on the first axis.
  await canvas(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(readout(page)).not.toHaveText(before!);

  await plane(page).selectOption('AXIAL');
  await expect(plane(page)).toHaveValue('AXIAL');
});

test('M and Escape close it, and focus returns to the MRI button', async ({ app }) => {
  const { page } = app;
  await open(page);
  await canvas(page).focus();
  await page.keyboard.press('m');
  await expectClosedToOpener(page, dialog(page));

  // A second opening reloads the engine and works the same.
  await open(page);
  await page.keyboard.press('Escape');
  await expectClosedToOpener(page, dialog(page));
});

test('there is no accessibility violation with the dialog open', async ({ app }) => {
  await open(app.page);
  await app.expectAccessible('mri-navigator');
});
