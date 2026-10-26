// The keyboard shortcuts dialog, run on both apps. Differences between them each cite a deviation
// record in docs/decisions/deviations/ (s5b-initial-focus, s5b-group-structure,
// s5b-shortcut-strings).
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';

const more = (page: Page) => page.getByRole('button', { name: 'More settings' });
const item = (page: Page) => page.getByRole('button', { name: 'Keyboard shortcuts' });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Keyboard shortcuts' });

async function openFromMenu(page: Page) {
  await more(page).click();
  await item(page).click();
}

test.describe('keyboard shortcuts dialog', () => {
  test.beforeEach(async ({ app }) => {
    await app.gotoHash();
    await app.ready();
  });

  test('opens from the settings menu with three groups of key rows and the note', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await openFromMenu(page);
    const sheet = dialog(page);
    await expect(sheet).toBeVisible();
    await expect(
      sheet.getByRole('heading', { level: 2, name: 'Keyboard shortcuts' }),
    ).toBeVisible();
    await expect(sheet.getByRole('heading', { level: 3 })).toHaveText([
      'Panel',
      'Model',
      'Display',
    ]);
    await expect(sheet.getByRole('term')).toHaveCount(21);
    await expect(sheet.getByRole('definition')).toHaveCount(21);
    await expect(sheet.getByRole('definition').first()).toHaveText('Focus the search field');
    await expect(sheet.locator('kbd').first()).toHaveText('/');
    await expect(sheet).toContainText('can be turned off in the settings menu');
    // Deviation s5b-shortcut-strings D4: only the next app reads a range's dash as "to".
    expect(await sheet.locator('.key-range .visually-hidden').count()).toBe(
      testInfo.project.name === 'next' ? 1 : 0,
    );
    // Deviation s5b-group-structure: legacy wraps each group in an unnamed section.
    expect(await sheet.locator('section').count()).toBe(testInfo.project.name === 'next' ? 0 : 3);
    await app.expectAccessible('shortcuts');
  });

  test('the title takes focus on the next app; legacy focuses Close', async ({ app }, testInfo) => {
    const { page } = app;
    await openFromMenu(page);
    // Deviation s5b-initial-focus.
    await expect(
      testInfo.project.name === 'next'
        ? dialog(page).getByRole('heading', { level: 2 })
        : dialog(page).getByRole('button', { name: 'Close' }),
    ).toBeFocused();
  });

  test('? opens it instantly and closes it again, from inside as well', async ({ app }) => {
    const { page } = app;
    await page.keyboard.press('?');
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page)).toHaveAttribute('data-instant', '');
    await page.keyboard.press('?');
    await expect(dialog(page)).toBeHidden();
  });

  test('Tab stays in the dialog; Escape closes it and focus does not fall to the page', async ({
    app,
  }) => {
    const { page } = app;
    await more(page).focus();
    await page.keyboard.press('Enter');
    await item(page).focus();
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeVisible();
    for (let step = 0; step < 6; step++) {
      await page.keyboard.press('Tab');
      expect(
        await page.evaluate(() => {
          const active = document.activeElement!;
          return (
            active === document.body || document.querySelector('dialog[open]')!.contains(active)
          );
        }),
      ).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    // The settings panel closed behind the dialog, so the opener is gone: focus goes to ⋯.
    // The late `close` event can take a while under software WebGL.
    await expect(more(page)).toBeFocused({ timeout: 30_000 });
  });

  test('Escape closes only the dialog: the selection behind it stays', async ({ app }) => {
    const { page } = app;
    await app.selectRegion('destrieux:left:38');
    await app.waitForCameraIdle();
    const before = await app.hash();
    await page.keyboard.press('?');
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    expect(await app.hash()).toBe(before);
  });

  test('a pointer open animates; Close with the pointer closes it', async ({ app }) => {
    const { page } = app;
    await openFromMenu(page);
    await expect(dialog(page)).not.toHaveAttribute('data-instant');
    await dialog(page).getByRole('button', { name: 'Close' }).click();
    await expect(dialog(page)).toBeHidden();
  });
});

// Each of these boots the app once, in the state it needs, rather than after a default boot.
test.describe('keyboard shortcuts dialog, booted otherwise', () => {
  test('with single-key shortcuts off ? does nothing, and the note says how to turn them on', async ({
    app,
  }) => {
    const { page } = app;
    await page.addInitScript(() => localStorage.setItem('planum.single-key-shortcuts', 'off'));
    await app.gotoHash();
    await app.ready();
    await page.keyboard.press('?');
    await expect(dialog(page)).toBeHidden();
    await openFromMenu(page);
    await expect(dialog(page)).toContainText('Turn them back on in the settings menu');
  });

  test('French labels', async ({ app }) => {
    const { page } = app;
    await app.gotoHash({ lang: 'fr' });
    await app.ready();
    await page.getByRole('button', { name: 'Plus de réglages' }).click();
    await page.getByRole('button', { name: 'Raccourcis clavier' }).click();
    const sheet = page.getByRole('dialog', { name: 'Raccourcis clavier' });
    await expect(sheet.getByRole('heading', { level: 3 })).toHaveText([
      'Panneau',
      'Modèle',
      'Affichage',
    ]);
    await expect(sheet.getByRole('button', { name: 'Fermer' })).toBeVisible();
    // The strings are the same until C1's amendment lands (s5b-shortcut-strings D3).
    await expect(sheet.locator('kbd', { hasText: /^(Esc|Échap)$/ })).toBeVisible();
  });
});

// Booted at phone size: resizing the legacy stage from desktop after boot leaves it drawing a
// frame every few seconds under software WebGL, which is not what these tests are about.
test.describe('keyboard shortcuts dialog on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('it fills the screen and returns focus to ⋯', async ({ app }) => {
    const { page } = app;
    await app.gotoHash();
    await app.ready();
    await openFromMenu(page);
    const sheet = dialog(page);
    await expect(sheet).toBeVisible();
    const close = await sheet.getByRole('button', { name: 'Close' }).boundingBox();
    expect(close!.width).toBeGreaterThanOrEqual(24);
    // The sheet settles from scale(0.98), so allow for that.
    expect((await sheet.boundingBox())!.width).toBeGreaterThanOrEqual(380);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(more(page)).toBeFocused();
  });
});
