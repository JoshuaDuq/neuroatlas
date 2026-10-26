// G4: the Section popover and the section row, run on both apps through role and name locators. Differences
// between the apps each cite a deviation record in docs/decisions/deviations/ (u3-segmented-controls,
// g4-label-in-name, g4-status-outlives-bar, u4-number-field-range-error). Every keyboard path, the pending
// plane, the compact row and focus hand-offs are proved by the component tests
// (src/features/sections/SectionBar.svelte.test.ts).
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import enabled from './enabled/stage.ts';

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name === 'next' && !enabled, 'the next stage region is not enabled');
});

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const row = (page: Page, name: string) => page.getByRole('group', { name, exact: true });

/** Chooses a plane from the Section popover. */
async function choose(page: Page, plane: string) {
  await button(page, 'Section').click();
  await page.getByRole('dialog', { name: 'Section', exact: true }).waitFor();
  await button(page, plane).click();
}

test.describe('the section', () => {
  test.beforeEach(async ({ app }) => {
    await app.page.setViewportSize({ width: 1280, height: 800 });
    await app.gotoHash();
    await app.ready();
  });

  test('the popover offers five planes, Full brain pressed, and Cut labels', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await button(page, 'Section').click();
    const popover = page.getByRole('dialog', { name: 'Section', exact: true });
    // u3-segmented-controls.md: a toolbar of toggles on the next app, a group on the legacy one.
    const planes = popover.getByRole(testInfo.project.name === 'legacy' ? 'group' : 'toolbar', {
      name: 'Cutting plane',
    });
    await expect(planes.getByRole('button')).toHaveCount(5);
    await expect(button(page, 'Full brain')).toHaveAttribute('aria-pressed', 'true');
    await expect(button(page, 'Full brain')).toBeFocused();
    await expect(popover.getByRole('combobox', { name: 'Cut labels' })).toBeVisible();
  });

  test('choosing a plane closes the popover, keeps focus on Section and shows its row', async ({
    app,
  }) => {
    const { page } = app;
    await choose(page, 'Coronal');
    await expect(page.getByRole('dialog', { name: 'Section', exact: true })).toBeHidden();
    await expect(button(page, 'Section')).toBeFocused();
    const coronal = row(page, 'Coronal section');
    await expect(coronal).toBeVisible();
    await expect(
      coronal.getByRole('slider', { name: 'A coordinate (mm): − posterior / + anterior' }),
    ).toHaveAttribute('aria-valuetext', /mm$/);
    await expect(
      coronal.getByRole('spinbutton', { name: 'Exact cut position in millimetres' }),
    ).toBeVisible();
    await expect(coronal.getByRole('button', { name: 'Linked MRI' })).toBeVisible();
    await expect.poll(() => app.hash()).toMatch(/(^|&)cut=coronal(&|$)/);
  });

  test('the exact field moves the cut, and empty puts the position back', async ({ app }) => {
    const { page } = app;
    await choose(page, 'Axial');
    const field = row(page, 'Axial section').getByRole('spinbutton');
    await field.fill('12.5');
    await field.press('Enter');
    await expect.poll(() => app.hash()).toMatch(/(^|&)pos=12\.5(&|$)/);
    await field.fill('');
    await field.press('Enter');
    await expect(field).toHaveValue('12.5');
  });

  test('an exact position outside the range is explained on the next app, not applied', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await choose(page, 'Axial');
    const field = row(page, 'Axial section').getByRole('spinbutton');
    await field.fill('900');
    await field.press('Enter');
    // u4-number-field-range-error.md: legacy hands it to the sections, which refuse it.
    if (testInfo.project.name === 'legacy') return;
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription(/^Enter a position from −\d+ to \d+ mm\.$/);
    await expect.poll(() => app.hash()).not.toMatch(/(^|&)pos=/);
  });

  test('Reverse side is named by its words on the next app', async ({ app }, testInfo) => {
    const { page } = app;
    await choose(page, 'Sagittal');
    const name = testInfo.project.name === 'legacy' ? 'Reverse retained side' : 'Reverse side';
    // g4-label-in-name.md: the legacy name is not the visible text.
    const reverse = row(page, 'Sagittal section').getByRole('checkbox', { name, exact: true });
    await reverse.check();
    await expect.poll(() => app.hash()).toMatch(/(^|&)rev=1(&|$)/);
  });

  test('an oblique cut adds tilt and azimuth in degrees', async ({ app }, testInfo) => {
    const { page } = app;
    await choose(page, 'Oblique');
    const oblique = row(page, 'Oblique section');
    // g4-label-in-name.md: the legacy azimuth is named by words it does not show.
    const azimuth =
      testInfo.project.name === 'legacy' ? 'Rotation around superior axis' : 'Azimuth';
    await expect(oblique.getByRole('slider', { name: /^Tilt/ })).toHaveAttribute(
      'aria-valuetext',
      '30°',
    );
    await expect(oblique.getByRole('slider', { name: azimuth, exact: true })).toHaveAttribute(
      'aria-valuetext',
      '+30°',
    );
  });

  test('Close returns to the full brain with focus on Section, and the next app says so', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await choose(page, 'Axial');
    await button(page, 'Close section and show the full brain').click();
    await expect(row(page, 'Axial section')).toBeHidden();
    await expect(button(page, 'Section')).toBeFocused();
    // g4-status-outlives-bar.md: the legacy live region is hidden with the row, so it says nothing.
    if (testInfo.project.name === 'legacy') return;
    await expect(
      page.locator('#viewport [role="status"]').filter({ hasText: 'Full brain · no cut' }),
    ).toHaveCount(1);
  });

  test('the row and the popover are accessible', async ({ app }) => {
    const { page } = app;
    await choose(page, 'Oblique');
    await expect(row(page, 'Oblique section')).toBeVisible();
    await button(page, 'Section').click();
    await app.expectAccessible('sections');
  });

  test('French words the planes, the row and its ends', async ({ app }) => {
    const { page } = app;
    await app.gotoHash({ lang: 'fr' });
    await app.ready();
    await choose(page, 'Sagittal');
    const sagittal = row(page, 'Coupe sagittale');
    await expect(sagittal.getByRole('slider', { name: /^Coordonnée D/ })).toBeVisible();
    await expect(sagittal.getByRole('button', { name: 'IRM liée' })).toBeVisible();
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the planes show short names, and the row folds its details behind More', async ({
    app,
  }) => {
    const { page } = app;
    await app.gotoHash();
    await app.ready();
    await button(page, 'Section').click();
    await expect(button(page, 'Sagittal')).toContainText('Sag');
    await button(page, 'Sagittal').click();
    const more = row(page, 'Sagittal section').getByRole('button', {
      name: 'More section controls',
    });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(
      row(page, 'Sagittal section').getByRole('button', { name: 'Linked MRI' }),
    ).toBeVisible();
  });
});
