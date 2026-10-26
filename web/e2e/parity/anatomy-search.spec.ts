// A2: anatomy search and the scope of the tree, run on both apps. Role and name locators match the
// legacy combobox and `option` rows and the next ones; each difference between them cites its
// deviation record in docs/decisions/deviations/ (a2-*).
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import enabled from './enabled/panels.ts';

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name === 'next' && !enabled, 'the panels region is not integrated');
});

const isNext = () => test.info().project.name === 'next';
const field = (page: Page) =>
  page.getByRole('combobox', { name: /^(Search regions|Rechercher des régions)$/ });
const tree = (page: Page) =>
  page
    .getByRole('tree', { name: /^(Browse anatomy|Parcourir l’anatomie)$/ })
    .or(page.getByRole('treegrid', { name: /^(Browse anatomy|Parcourir l’anatomie)$/ }));
const option = (page: Page, name: string | RegExp) => page.getByRole('option', { name });
const scope = (page: Page, name: string) =>
  page.getByRole('radio', { name }).or(page.getByRole('button', { name, exact: true }));

async function search(page: Page, text: string) {
  await field(page).fill(text);
}

test.describe('anatomy search', () => {
  test.beforeEach(async ({ app }) => {
    await app.page.setViewportSize({ width: 1280, height: 800 });
    await app.gotoHash();
    await app.ready();
  });

  test('a query lists regions named with their side and group, arms the first, and replaces the tree', async ({
    app,
  }) => {
    const { page } = app;
    await expect(field(page)).toHaveAttribute('aria-expanded', 'false');
    await search(page, 'middle frontal gyrus');
    const left = option(page, /^Middle frontal gyrus, left, Frontal$/);
    await expect(left).toBeVisible();
    await expect(option(page, /^Middle frontal gyrus, right, Frontal$/)).toBeVisible();
    await expect(field(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(field(page)).toHaveAttribute(
      'aria-activedescendant',
      (await left.getAttribute('id'))!,
    );
    await expect(tree(page)).toBeHidden();
    await expect(page.locator('mark.query-match').first()).toHaveText('Middle frontal gyrus');
    // Escape empties the field and the tree comes back; the field keeps focus.
    await page.keyboard.press('Escape');
    await expect(field(page)).toHaveValue('');
    await expect(tree(page)).toBeVisible();
    await expect(field(page)).toBeFocused();
  });

  test('Down moves to the next result and stops at the last; Enter chooses the armed region', async ({
    app,
  }) => {
    const { page } = app;
    await search(page, 'middle frontal gyrus');
    const right = option(page, /^Middle frontal gyrus, right/);
    await expect(right).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(field(page)).toHaveAttribute(
      'aria-activedescendant',
      (await right.getAttribute('id'))!,
    );
    await page.keyboard.press('Enter');
    await expect.poll(() => app.hash()).toContain('region=');
    await expect(field(page)).toHaveValue('');
    await expect(field(page)).toBeFocused();
  });

  test('a click chooses a region', async ({ app }) => {
    const { page } = app;
    await search(page, 'middle frontal gyrus');
    await option(page, /^Middle frontal gyrus, left/).click();
    await expect.poll(() => app.hash()).toContain('region=');
    await expect(field(page)).toHaveValue('');
    // a2-focus-stays-in-field: legacy drops focus with the removed row; next keeps it in the field.
    if (isNext()) await expect(field(page)).toBeFocused();
  });

  test('aria-selected is on the one option the field points at', async ({ app }) => {
    const { page } = app;
    await search(page, 'middle frontal gyrus');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(() => app.hash()).toContain('region=');
    await page.getByRole('button', { name: 'Back to Anatomy' }).click();
    await search(page, 'middle frontal gyrus');
    const left = option(page, /^Middle frontal gyrus, left/);
    const right = option(page, /^Middle frontal gyrus, right/);
    await expect(left).toBeVisible();
    // a2-active-option-selected: legacy marks the chosen region, next the armed option (APG combobox).
    await expect(isNext() ? left : right).toHaveAttribute('aria-selected', 'true');
    await expect(isNext() ? right : left).toHaveAttribute('aria-selected', 'false');
  });

  test('a region that is not on screen says why, and gives it in the name', async ({ app }) => {
    const { page } = app;
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('h');
    await search(page, 'middle frontal gyrus');
    const hidden = option(
      page,
      'Middle frontal gyrus, right: Hemisphere hidden. Activate to reveal.',
    );
    await expect(hidden).toBeVisible();
    await expect(hidden).toContainText('Hemisphere hidden');
    // a2-option-title: legacy repeats the name in a native title; next shows it in U5's tooltip.
    if (isNext()) {
      await expect(hidden.locator('[title]')).toHaveCount(0);
      await expect(hidden.locator('[data-tooltip]')).toHaveAttribute(
        'data-tooltip',
        /Hemisphere hidden/,
      );
    } else {
      await expect(hidden).toHaveAttribute('title', /.+/);
    }
  });

  test('nothing found says so, with a hint; the list is not expanded when it holds nothing', async ({
    app,
  }) => {
    const { page } = app;
    await search(page, 'zzzzqq');
    await expect(page.getByText('No match for “zzzzqq”')).toBeVisible();
    await expect(
      page.getByText(/^Try another spelling, an abbreviation or a synonym/),
    ).toBeVisible();
    await expect(page.locator('#announcer')).toContainText('No match for “zzzzqq”');
    await expect(page.getByRole('option')).toHaveCount(0);
    // a2-expanded-with-options: legacy reports an expanded popup with no option in it.
    await expect(field(page)).toHaveAttribute('aria-expanded', isNext() ? 'false' : 'true');
  });

  test('the clear button empties the field, gives the focus back to it and shows the tree', async ({
    app,
  }) => {
    const { page } = app;
    await search(page, 'middle frontal');
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(field(page)).toHaveValue('');
    await expect(field(page)).toBeFocused();
    await expect(tree(page)).toBeVisible();
  });

  test('`/` focuses the field and selects its text', async ({ app }) => {
    const { page } = app;
    await search(page, 'middle');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('/');
    await expect(field(page)).toBeFocused();
    expect(
      await field(page).evaluate((input: HTMLInputElement) => [
        input.selectionStart,
        input.selectionEnd,
      ]),
    ).toEqual([0, 6]);
  });

  test('the browse scope: arrows only move focus in legacy; in next they choose, as in an APG radio group', async ({
    app,
  }) => {
    const { page } = app;
    const whole = scope(page, 'Whole brain');
    const system = scope(page, 'By system');
    await expect(whole).toBeVisible();
    await whole.focus();
    await page.keyboard.press('ArrowRight');
    await expect(system).toBeFocused();
    if (isNext()) {
      // a2-tree-scope-radio-group
      await expect(page.getByRole('radiogroup', { name: 'Browse' })).toBeVisible();
      await expect(system).toBeChecked();
      await expect(page.getByRole('combobox', { name: 'System' })).toBeVisible();
    } else {
      await expect(page.getByRole('group', { name: 'Browse' })).toBeVisible();
      await expect(system).toHaveAttribute('aria-pressed', 'false');
    }
  });

  test('French: the field, the list and the notes are named in French', async ({ app }) => {
    const { page } = app;
    await app.gotoHash({ lang: 'fr' });
    await app.ready();
    await search(page, 'zzzzqq');
    await expect(page.getByText('Aucun résultat pour « zzzzqq »')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Effacer la recherche' })).toBeVisible();
  });

  test('accessible with results showing', async ({ app }) => {
    const { page } = app;
    await search(page, 'middle frontal');
    await expect(option(page, /^Middle frontal gyrus, left/)).toBeVisible();
    await app.expectAccessible('anatomy-search');
  });
});
