// The masthead's data bar, run on both apps: Subject, Atlas, Colour and Internal anatomy as
// selects on a wide window, the same fields behind a summary button on a phone. Differences
// between the apps each cite a deviation record in docs/decisions/deviations/ (h3-*).
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import shellEnabled from './enabled/shell.ts';

test.beforeEach(() => {
  test.skip(
    test.info().project.name === 'next' && !shellEnabled,
    'the shell region is not integrated',
  );
});

const field = (page: Page, name: string) => page.getByRole('combobox', { name, exact: true });
const summary = (page: Page) => page.getByRole('button', { name: /^Atlas and display settings: / });
const selected = (page: Page, name: string) =>
  field(page, name).evaluate((select: HTMLSelectElement) => select.selectedOptions[0].textContent);

test.describe('data bar on a wide window', () => {
  test.use({ viewport: { width: 1600, height: 900 } });
  test.beforeEach(async ({ app }) => {
    await app.gotoHash();
    await app.ready();
  });

  test('Atlas, Colour and Internal anatomy are labelled selects; one published subject is no field', async ({
    app,
  }) => {
    const { page } = app;
    for (const name of ['Atlas', 'Colour', 'Internal anatomy']) {
      await expect(field(page, name)).toBeVisible();
    }
    await expect(field(page, 'Subject')).toHaveCount(0);
    await expect(summary(page)).toBeHidden();
    expect(await selected(page, 'Atlas')).toBe('Destrieux');
    expect(await selected(page, 'Colour')).toBe('Regions');
  });

  test('Colour is grouped, and an option names the atlas it brings', async ({ app }) => {
    const { page } = app;
    const colour = field(page, 'Colour');
    const groups = await colour.evaluate((select: HTMLSelectElement) =>
      [...select.querySelectorAll('optgroup')].map((group) => group.label),
    );
    expect(groups).toEqual(['Appearance', 'Parcellation', 'Networks']);
    const options = await colour.evaluate((select: HTMLSelectElement) =>
      [...select.options].map((option) => option.textContent),
    );
    expect(options).toContain('CAB-NP networks (atlas becomes HCP-MMP)');
  });

  test('choosing a colour and an atlas changes the select, and an atlas option names the colour it drops', async ({
    app,
  }) => {
    const { page } = app;
    await field(page, 'Colour').selectOption({ label: 'Tissue' });
    await expect(field(page, 'Colour')).toHaveValue('tissue');
    await field(page, 'Colour').selectOption({ label: 'CAB-NP networks (atlas becomes HCP-MMP)' });
    await expect(field(page, 'Atlas')).toHaveValue('hcp-mmp', { timeout: 60_000 });
    await expect(field(page, 'Colour')).toHaveValue('cab-np');
    const options = await field(page, 'Atlas').evaluate((select: HTMLSelectElement) =>
      [...select.options].map((option) => option.textContent),
    );
    expect(options).toContain('Destrieux (colour becomes Regions)');
    expect(options).toContain('HCP-MMP');
  });

  test('on the bar a note is the tooltip of its field, not a title', async ({ app }) => {
    const { page } = app;
    const atlas = field(page, 'Atlas');
    await expect(atlas).toHaveAttribute('data-tooltip', /Sulcal and gyral regions/);
    await expect(atlas).not.toHaveAttribute('title');
  });

  test('the bar passes axe', async ({ app }) => {
    await app.expectAccessible('data-bar');
  });

  test('the bar tabs through its fields in order', async ({ app }) => {
    const { page } = app;
    await field(page, 'Atlas').focus();
    await page.keyboard.press('Tab');
    await expect(field(page, 'Colour')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(field(page, 'Internal anatomy')).toBeFocused();
  });
});

test.describe('data bar on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.beforeEach(async ({ app }) => {
    await app.gotoHash();
    await app.ready();
  });

  test('a phone gets one summary button that opens the same fields', async ({ app }) => {
    const { page } = app;
    await expect(summary(page)).toBeVisible();
    await expect(summary(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(summary(page)).toHaveAccessibleName(/Destrieux · Regions · /);
    await expect(field(page, 'Atlas')).toBeHidden();
    await summary(page).click();
    await expect(summary(page)).toHaveAttribute('aria-expanded', 'true');
    for (const name of ['Atlas', 'Colour', 'Internal anatomy']) {
      await expect(field(page, name)).toBeVisible();
    }
    // The popover prints each note instead of a tooltip.
    await expect(page.getByText('Sulcal and gyral regions, 74 per hemisphere')).toBeVisible();
  });

  test('Escape closes the popover onto the summary and does not clear the selection', async ({
    app,
  }) => {
    const { page } = app;
    await app.selectRegion('destrieux:left:38');
    await summary(page).click();
    await field(page, 'Colour').focus();
    const before = await app.hash();
    expect(before).toContain('destrieux:left:38');
    await page.keyboard.press('Escape');
    await expect(summary(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(summary(page)).toBeFocused();
    expect(await app.hash()).toContain('destrieux:left:38');
  });

  test('Tab out of the popover and a press outside both close it', async ({ app }) => {
    const { page } = app;
    await summary(page).click();
    await field(page, 'Internal anatomy').focus();
    await page.keyboard.press('Tab');
    await expect(summary(page)).toHaveAttribute('aria-expanded', 'false');

    await summary(page).click();
    await expect(summary(page)).toHaveAttribute('aria-expanded', 'true');
    await page.mouse.click(195, 800);
    await expect(summary(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('the data popover and the settings panel are never open together', async ({ app }) => {
    const { page } = app;
    await summary(page).click();
    await page.getByRole('button', { name: 'More settings' }).click();
    await expect(summary(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('French names the fields and the summary', async ({ app }) => {
    const { page } = app;
    await page.getByRole('button', { name: 'More settings' }).click();
    await page
      .getByRole('radiogroup', { name: 'Language' })
      .getByRole('radio', { name: 'Français' })
      .or(
        page
          .getByRole('group', { name: 'Language' })
          .getByRole('button', { name: 'Français', exact: true }),
      )
      .click();
    const frSummary = page.getByRole('button', {
      name: /^Réglages de l’atlas et de l’affichage: /,
    });
    await expect(frSummary).toBeVisible();
    await frSummary.click();
    for (const name of ['Atlas', 'Couleur', 'Anatomie interne']) {
      await expect(field(page, name)).toBeVisible();
    }
  });

  test('the open popover passes axe', async ({ app }) => {
    await summary(app.page).click();
    await expect(field(app.page, 'Atlas')).toBeVisible();
    await app.expectAccessible('data-bar-popover');
  });
});
