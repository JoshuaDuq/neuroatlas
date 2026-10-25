// The colophon and the Provenance dialog, run on both apps. Differences between them each cite a
// deviation record in docs/decisions/deviations/ (h4-initial-focus, h4-lang-of-parts).
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import shellEnabled from './enabled/shell.ts';

test.beforeEach(({ browserName: _browser }, testInfo) => {
  test.skip(
    testInfo.project.name === 'next' && !shellEnabled,
    'the shell region is not integrated',
  );
});

const opener = (page: Page) => page.getByRole('button', { name: 'Provenance', exact: true });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Provenance' });

test.describe('colophon and provenance', () => {
  test.beforeEach(async ({ app }) => {
    await app.gotoHash();
    await app.ready();
  });

  test('the status bar states what this is, then names what is loaded', async ({ app }) => {
    const { page } = app;
    const bar = page.getByRole('contentinfo');
    await expect(bar).toContainText('Not clinical anatomy');
    await expect(bar).toContainText(/MRI reconstruction|reference template/);
    await expect(bar).toContainText(/\d+ visible regions?/);
    await expect(opener(page)).toBeVisible();
    await expect(opener(page)).toHaveAttribute('aria-haspopup', 'dialog');
  });

  test('a keyboard open is a modal dialog with the facts, Close and the intended use', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await opener(page).focus();
    await page.keyboard.press('Enter');
    const sheet = dialog(page);
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute('data-instant', '');
    await expect(sheet.getByRole('heading', { level: 2, name: 'Provenance' })).toBeVisible();
    await expect(sheet.locator('dt').first()).toHaveText('Subject');
    await expect(sheet.getByRole('link').first()).toHaveAttribute('target', '_blank');
    await expect(sheet).toContainText('is not a medical device');

    // Deviation h4-initial-focus: the title takes focus on the next app; legacy focuses Close.
    await expect(
      testInfo.project.name === 'next'
        ? sheet.getByRole('heading', { level: 2 })
        : sheet.getByRole('button', { name: 'Close' }),
    ).toBeFocused();
    await app.expectAccessible('provenance');
  });

  test('Tab stays in the dialog and Escape closes it, returning focus to the button', async ({
    app,
  }) => {
    const { page } = app;
    await opener(page).focus();
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeVisible();
    for (let step = 0; step < 40; step++) {
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
    await expect(opener(page)).toBeFocused();
  });

  test('a pointer open animates; Close with the pointer returns focus to the button', async ({
    app,
  }) => {
    const { page } = app;
    await opener(page).click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page)).not.toHaveAttribute('data-instant');
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(opener(page)).toBeFocused();
  });

  test('French labels, and the published data keeps its own language', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await app.gotoHash({ lang: 'fr' });
    await app.ready();
    await expect(page.getByRole('contentinfo')).toContainText('Pas une anatomie clinique');
    await page.getByRole('button', { name: 'Provenance', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Provenance' });
    await expect(sheet.locator('dt').first()).toHaveText('Sujet');
    await expect(sheet.getByRole('button', { name: 'Fermer' })).toBeVisible();
    await expect(sheet).toContainText('Pour la recherche et l’enseignement');
    // Deviation h4-lang-of-parts: only the next app marks the English data.
    const marked = await sheet.locator('[lang="en"]').count();
    expect(marked > 0).toBe(testInfo.project.name === 'next');
  });

  test('on a phone the status bar gives way and Provenance opens from the ⋯ menu', async ({
    app,
  }) => {
    const { page } = app;
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('contentinfo')).toBeHidden();
    const more = page.getByRole('button', { name: 'More settings' });
    await more.click();
    await page.getByRole('button', { name: 'Provenance', exact: true }).click();
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    // The menu closed behind the click, so the opener is gone: focus goes to the ⋯ button.
    await expect(more).toBeFocused();
  });
});
