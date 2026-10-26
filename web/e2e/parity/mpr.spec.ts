// G5: the Linked MRI dialog, run on both apps through role and name locators. Differences between the
// apps each cite a deviation record in docs/decisions/deviations/ (g5-slider-label-in-name, g5-save-names,
// g5-panel-names, g5-plane-radio, g5-canvas-not-interactive). The keyboard paths, the live region, the
// saved PNG, the wheel and the focus hand-offs are proved by the component tests
// (src/features/sections/MprDialog.svelte.test.ts) and the unit tests beside it.
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import enabled from './enabled/stage.ts';

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name === 'next' && !enabled, 'the next stage region is not enabled');
});

const PLANES = ['Sagittal', 'Coronal', 'Axial'] as const;

/** Cuts the axial plane and opens the Linked MRI from the section row, as a reader does. */
async function openLinkedMri(page: Page) {
  await page.getByRole('button', { name: 'Section', exact: true }).click();
  await page.getByRole('dialog', { name: 'Section', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Axial', exact: true }).click();
  await page
    .getByRole('group', { name: 'Axial section', exact: true })
    .getByRole('button', { name: 'Linked MRI' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Linked MRI sections' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('the Linked MRI dialog', () => {
  test.beforeEach(async ({ app }) => {
    await app.page.setViewportSize({ width: 1280, height: 800 });
    await app.gotoHash();
    await app.ready();
  });

  test('opens on its Close button, and Escape returns focus to the button that opened it', async ({
    app,
  }) => {
    const { page } = app;
    const dialog = await openLinkedMri(page);
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(
      page
        .getByRole('group', { name: 'Axial section', exact: true })
        .getByRole('button', { name: 'Linked MRI' }),
    ).toBeFocused();
  });

  test('shows three planes, each with a picture, a position slider and a Save button', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    const dialog = await openLinkedMri(page);
    const legacy = testInfo.project.name === 'legacy';
    for (const plane of PLANES) {
      // g5-slider-label-in-name.md: the visible label names the slider on the next app.
      await expect(
        dialog.getByRole('slider', {
          name: legacy ? `${plane} MRI position` : `${plane} position`,
        }),
      ).toBeVisible();
      // g5-save-names.md: three buttons that were all "Save PNG" are told apart.
      await expect(
        dialog.getByRole('button', {
          name: legacy ? 'Save PNG' : `Save PNG, ${plane.toLowerCase()}`,
          exact: true,
        }),
      ).toHaveCount(legacy ? 3 : 1);
      await expect(dialog.getByRole('img', { name: new RegExp(`^${plane} MRI\\.`) })).toBeVisible();
      // g5-panel-names.md: each plane is a named region on the next app.
      if (!legacy) await expect(dialog.getByRole('region', { name: plane })).toBeVisible();
    }
    await expect(dialog.getByRole('slider', { name: 'Window' })).toHaveValue('180');
    await expect(dialog.getByRole('slider', { name: 'Level' })).toHaveValue('90');
    await expect(dialog.getByRole('checkbox', { name: 'Segmentation overlay' })).not.toBeChecked();
  });

  test('a picture takes focus only on the legacy app', async ({ app }, testInfo) => {
    const { page } = app;
    const dialog = await openLinkedMri(page);
    const picture = dialog.getByRole('img', { name: /^Axial MRI\./ });
    // g5-canvas-not-interactive.md: the slider is the keyboard route on the next app.
    expect(await picture.evaluate((node) => (node as HTMLElement).tabIndex)).toBe(
      testInfo.project.name === 'legacy' ? 0 : -1,
    );
  });

  test('the Axial slider moves the shared crosshair by a millimetre', async ({ app }, testInfo) => {
    const { page } = app;
    const dialog = await openLinkedMri(page);
    const name = testInfo.project.name === 'legacy' ? 'Axial MRI position' : 'Axial position';
    const slider = dialog.getByRole('slider', { name });
    const was = Number(await slider.inputValue());
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue(String(was + 1));
    await expect(slider).toHaveAttribute('aria-valuetext', /mm$/);
  });

  test('the Window slider keeps to its range', async ({ app }) => {
    const { page } = app;
    const dialog = await openLinkedMri(page);
    const window = dialog.getByRole('slider', { name: 'Window' });
    await window.focus();
    await page.keyboard.press('Home');
    await expect(window).toHaveValue('10');
    await page.keyboard.press('End');
    await expect(window).toHaveValue('256');
  });
});

test.describe('the Linked MRI dialog on a phone', () => {
  test.beforeEach(async ({ app }) => {
    await app.page.setViewportSize({ width: 390, height: 844 });
    await app.gotoHash();
    await app.ready();
  });

  test('shows the axial plane alone, and the plane control chooses another', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    const dialog = await openLinkedMri(page);
    const legacy = testInfo.project.name === 'legacy';
    // g5-plane-radio.md: a radio group on the next app, pressed buttons on the legacy one.
    const choose = (plane: string) =>
      legacy
        ? dialog.getByRole('button', { name: plane, exact: true })
        : dialog.getByRole('radio', { name: plane, exact: true });
    await expect(dialog.getByRole('img', { name: /^Axial MRI\./ })).toBeVisible();
    await expect(dialog.getByRole('img', { name: /^Coronal MRI\./ })).toBeHidden();
    await choose('Coronal').click();
    await expect(dialog.getByRole('img', { name: /^Coronal MRI\./ })).toBeVisible();
    await expect(dialog.getByRole('img', { name: /^Axial MRI\./ })).toBeHidden();
  });
});
