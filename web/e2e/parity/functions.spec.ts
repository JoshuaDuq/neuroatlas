// X1: the Functions tab (viewer/ui/panels/functions.js), run on both apps with role and name locators.
// Each difference between them cites its deviation record in web/docs/decisions/deviations/ or
// decision 37 on #4. The panels region is gated on `next` until I1 mounts it.
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';

const searchbox = (page: Page) => page.getByRole('searchbox');
const list = (page: Page) => page.getByRole('group', { name: /^(Functions|Fonctions)$/ });
const functionRow = (page: Page, name: string | RegExp) => list(page).getByRole('button', { name });
const heading = (page: Page) => page.getByRole('heading', { level: 2 });

/** Opens the Functions tab. */
async function openFunctions(app: Parameters<Parameters<typeof test>[2]>[0]['app'], state = {}) {
  await app.gotoHash({ tab: 'functions', ...state });
  await app.ready();
  // A link that carries a function opens its profile, with the list behind it.
  if (!('function' in state)) await expect(list(app.page)).toBeVisible();
}

test.describe('the list', () => {
  test.beforeEach(async ({ app }) => {
    await app.page.setViewportSize({ width: 1280, height: 800 });
  });

  test('opens with the overview row, groups headed by h3, and rows named with their detail', async ({
    app,
  }) => {
    const { page } = app;
    await openFunctions(app);
    await expect(functionRow(page, /^All functions/)).toBeVisible();
    await expect(list(page).getByRole('group')).not.toHaveCount(0);
    await expect(list(page).getByRole('heading', { level: 3 }).first()).toBeVisible();
    await expect(functionRow(page, /^Language\s*, [\d,]+ studies · \d+ areas?/)).toBeVisible();
    await expect(searchbox(page)).toHaveAccessibleName('Search functions');
  });

  test('a French interface names the field, the list and the rows in French', async ({ app }) => {
    const { page } = app;
    await openFunctions(app, { lang: 'fr' });
    await expect(searchbox(page)).toHaveAccessibleName('Rechercher une fonction');
    await expect(functionRow(page, /^Toutes les fonctions/)).toBeVisible();
    await expect(functionRow(page, /^Langage\s*, [\d,]+ études? ·/)).toBeVisible();
  });

  test('the search label is visible on next (deviation x1-search-label)', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await openFunctions(app);
    const label = page.locator('label[for]').filter({ hasText: 'Search functions' });
    const box = await label.boundingBox();
    if (testInfo.project.name === 'legacy') expect(box?.width ?? 0).toBeLessThanOrEqual(1);
    else expect(box?.width ?? 0).toBeGreaterThan(40);
  });

  test('a search lists Neurosynth terms, then a bridge to the Deficits tab with its count', async ({
    app,
  }) => {
    const { page } = app;
    await openFunctions(app);
    await searchbox(page).fill('aphasia');
    await expect(
      list(page).getByRole('heading', { level: 3, name: /Neurosynth clinical groups/ }),
    ).toBeVisible();
    await expect(functionRow(page, /^aphasia\s*,/)).toBeVisible();
    await expect(
      functionRow(page, /^Deficits: \d+ lesion profiles? match(es)? “aphasia”/),
    ).toBeVisible();
    // The count is for a search, not for the list at rest.
    await expect(page.getByText(/functions, each a Neurosynth meta-analysis/)).toBeHidden();
  });

  test('nothing found says so and suggests the nearest name', async ({ app }) => {
    const { page } = app;
    await openFunctions(app);
    await searchbox(page).fill('langauge');
    await expect(page.getByText('No match for “langauge”')).toBeVisible();
    await page.getByRole('button', { name: /^Did you mean “.+”\?$/ }).click();
    await expect(searchbox(page)).toBeFocused();
    await expect(searchbox(page)).not.toHaveValue('langauge');
  });

  test('Escape clears the text and keeps focus; the clear button does too', async ({ app }) => {
    const { page } = app;
    await openFunctions(app);
    await searchbox(page).fill('lang');
    await searchbox(page).press('Escape');
    await expect(searchbox(page)).toHaveValue('');
    await expect(searchbox(page)).toBeFocused();
    await searchbox(page).fill('lang');
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(searchbox(page)).toHaveValue('');
    await expect(searchbox(page)).toBeFocused();
  });

  test('ArrowDown and Enter in the field move to the first row, ArrowUp returns', async ({
    app,
  }) => {
    const { page } = app;
    await openFunctions(app);
    await searchbox(page).focus();
    await page.keyboard.press('ArrowDown');
    await expect(functionRow(page, /^All functions/)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(list(page).getByRole('button').nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(searchbox(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(functionRow(page, /^All functions/)).toBeFocused();
  });

  test('every row is a Tab stop', async ({ app }) => {
    const { page } = app;
    await openFunctions(app);
    await functionRow(page, /^All functions/).focus();
    await page.keyboard.press('Tab');
    await expect(list(page).getByRole('button').nth(1)).toBeFocused();
  });
});

test.describe('a profile', () => {
  test.beforeEach(async ({ app }) => {
    await app.page.setViewportSize({ width: 1280, height: 800 });
  });

  test('opening a function marks its row, focuses its heading and says what is shown', async ({
    app,
  }) => {
    const { page } = app;
    await openFunctions(app);
    const row = functionRow(page, /^Language\s*,/);
    await row.click();
    await expect(heading(page).filter({ hasText: 'Language' })).toBeFocused();
    // The list is behind the profile now, so it is found by its data attribute.
    await expect(page.locator('[data-function="language"]')).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(page.getByRole('status').filter({ hasText: /HCP-MMP areas?/ })).toBeVisible({
      timeout: 60_000,
    });
    // The link is written once the camera move has finished.
    await app.waitForCameraIdle();
    await expect.poll(() => app.hash()).toContain('function=language');
  });

  test('a link carrying a function opens its profile', async ({ app }) => {
    const { page } = app;
    await openFunctions(app, { function: 'language' });
    await expect(heading(page).filter({ hasText: 'Language' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /HCP-MMP areas?/ })).toBeVisible({
      timeout: 60_000,
    });
  });

  test('areas are buttons named with their division and z, twelve then a disclosure', async ({
    app,
  }) => {
    const { page } = app;
    await openFunctions(app, { function: 'attention' });
    await expect(page.getByRole('status').filter({ hasText: /HCP-MMP areas?/ })).toBeVisible({
      timeout: 60_000,
    });
    // Legacy names an area "Show area: …"; next names it by its content (deviation x1-area-name).
    const areas = page.getByRole('button', { name: /^(Show area: )?.+ · \S+,? .*z [\d.]+$/ });
    await expect(areas.first()).toBeVisible();
    expect(await areas.count()).toBeGreaterThanOrEqual(12);
    const more = page.getByText(/^\d+ more areas$/);
    await expect(more).toBeVisible();
    await more.focus();
    await page.keyboard.press('Enter');
    await expect(more).toBeVisible();
    expect(await areas.count()).toBeGreaterThan(12);
  });

  test('Restore returns focus to the function row', async ({ app }) => {
    const { page } = app;
    await openFunctions(app);
    const row = functionRow(page, /^Language\s*,/);
    await row.click();
    await expect(page.getByRole('status').filter({ hasText: /HCP-MMP areas?/ })).toBeVisible({
      timeout: 60_000,
    });
    await page.getByRole('button', { name: 'Restore previous view' }).click();
    await expect(row).toBeFocused();
    await expect(page.getByRole('button', { name: 'Restore previous view' })).toBeHidden();
  });

  test('the profile adds no region landmark of its own (deviation x1-no-landmarks)', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await openFunctions(app, { function: 'language' });
    await expect(heading(page).filter({ hasText: 'Language' })).toBeVisible();
    const regions = page.getByRole('region');
    if (testInfo.project.name === 'legacy') expect(await regions.count()).toBeGreaterThan(0);
    else await expect(regions).toHaveCount(0);
  });
});

test.describe('accessibility', () => {
  test('axe: the list and an open profile', async ({ app }) => {
    test.setTimeout(240_000);
    const { page } = app;
    await page.setViewportSize({ width: 1280, height: 800 });
    await openFunctions(app, { function: 'language' });
    await expect(page.getByRole('status').filter({ hasText: /HCP-MMP areas?/ })).toBeVisible({
      timeout: 60_000,
    });
    await app.expectAccessible('functions');
  });

  test('a phone width does not scroll the page sideways', async ({ app }) => {
    const { page } = app;
    await page.setViewportSize({ width: 390, height: 844 });
    await app.gotoHash({ tab: 'functions' });
    await app.ready();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});
