// The masthead and its ⋯ settings panel, run on both apps. Differences between them each cite a
// deviation record in docs/decisions/deviations/ (h2-radio-groups, h2-close-on-keyboard-choice).
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import shellEnabled from './enabled/shell.ts';

test.beforeEach((_fixtures, testInfo) => {
  test.skip(
    testInfo.project.name === 'next' && !shellEnabled,
    'the shell region is not integrated',
  );
});

const more = (page: Page) => page.getByRole('button', { name: 'More settings' });
const html = (page: Page) => page.locator('html');

/** A segmented choice: radios on the next app, `aria-pressed` buttons on the legacy one. */
const choice = (page: Page, group: string, option: string) =>
  page
    .getByRole('radiogroup', { name: group })
    .getByRole('radio', { name: option, exact: true })
    .or(
      page.getByRole('group', { name: group }).getByRole('button', { name: option, exact: true }),
    );

async function openSettings(page: Page) {
  await more(page).click();
  await expect(more(page)).toHaveAttribute('aria-expanded', 'true');
}

test.describe('masthead', () => {
  test.beforeEach(async ({ app }) => {
    await app.gotoHash();
    await app.ready();
  });

  test('the skip link is the first Tab stop and focuses the model', async ({ app }) => {
    const { page } = app;
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to model' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('CANVAS');
  });

  test('the brand, and the named icon buttons once the anatomy is on screen', async ({ app }) => {
    const { page } = app;
    await expect(page.getByRole('heading', { level: 1, name: 'Planum' })).toBeAttached();
    for (const name of ['Full screen', 'Save image (PNG)', 'More settings']) {
      await expect(page.getByRole('button', { name })).toBeEnabled();
      await expect(page.getByRole('button', { name })).toHaveAttribute('data-tooltip', name);
      await expect(page.getByRole('button', { name })).not.toHaveAttribute('title');
    }
    await expect(more(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('the panel offers language, theme and single-key shortcuts, then the shortcuts command', async ({
    app,
  }) => {
    const { page } = app;
    await openSettings(page);
    await expect(choice(page, 'Language', 'English')).toBeVisible();
    await expect(choice(page, 'Language', 'Français')).toBeVisible();
    for (const option of ['System', 'Light', 'Dark']) {
      await expect(choice(page, 'Theme', option)).toBeVisible();
    }
    await expect(choice(page, 'Single-key shortcuts', 'On')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keyboard shortcuts' })).toBeVisible();
  });

  test('choosing a theme, a language and single keys applies each and closes the panel', async ({
    app,
  }) => {
    const { page } = app;
    await openSettings(page);
    await choice(page, 'Theme', 'Dark').click();
    await expect(html(page)).toHaveAttribute('data-theme', 'dark');
    await expect(more(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(more(page)).toBeFocused();

    await openSettings(page);
    await choice(page, 'Single-key shortcuts', 'Off').click();
    await expect(html(page)).toHaveAttribute('data-single-keys', 'off');

    await openSettings(page);
    await choice(page, 'Language', 'Français').click();
    await expect(html(page)).toHaveAttribute('lang', 'fr');
    await expect(page.getByRole('button', { name: 'Plus de réglages' })).toBeFocused();
  });

  test('arrows on a choice: legacy moves focus only and closes on activation; next moves and selects and stays open', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await openSettings(page);
    await choice(page, 'Theme', 'System').focus();
    await page.keyboard.press('ArrowRight');
    await expect(choice(page, 'Theme', 'Light')).toBeFocused();
    if (testInfo.project.name === 'legacy') {
      await expect(html(page)).not.toHaveAttribute('data-theme', 'dark');
      return;
    }
    // Deviation h2-radio-groups and h2-close-on-keyboard-choice (decisions 6 and 15 on #4).
    await expect(choice(page, 'Theme', 'Light')).toBeChecked();
    await expect(html(page)).toHaveAttribute('data-theme', 'light');
    await expect(more(page)).toHaveAttribute('aria-expanded', 'true');
  });

  test('Escape closes the panel and focuses ⋯', async ({ app }) => {
    const { page } = app;
    await openSettings(page);
    await choice(page, 'Theme', 'Dark').focus();
    await page.keyboard.press('Escape');
    await expect(more(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(more(page)).toBeFocused();
  });

  test('Tab out of the panel closes it and an outside press closes it', async ({ app }) => {
    const { page } = app;
    await openSettings(page);
    await page.getByRole('button', { name: 'Keyboard shortcuts' }).focus();
    await page.keyboard.press('Tab');
    await expect(more(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(more(page)).not.toBeFocused();

    await openSettings(page);
    await page.mouse.click(600, 400);
    await expect(more(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('on a phone the panel also offers Full screen', async ({ app }) => {
    const { page } = app;
    await page.setViewportSize({ width: 390, height: 844 });
    await openSettings(page);
    await expect(page.getByRole('button', { name: 'Full screen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keyboard shortcuts' })).toBeVisible();
  });

  test('the masthead passes axe with the panel open', async ({ app }) => {
    await openSettings(app.page);
    await app.expectAccessible('masthead');
  });
});
