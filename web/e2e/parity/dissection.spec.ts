// A3: the internal-system picker and the dissection bar, run on both apps. Role and name locators
// match the legacy `region` and the next `group` (a3-bar-group); the aria snapshot is the legacy
// baseline. A select that shows the display's system (a3-system-value-sync), focus that falls back
// through the registry (a3-focus-fallback) and the select disabled while loading
// (a3-picker-switching) are covered by the component tests; here are the behaviours on the page.
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import enabled from './enabled/panels.ts';

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name === 'next' && !enabled, 'the panels region is not integrated');
});

const REGION = 'destrieux:left:38';
const isNext = () => test.info().project.name === 'next';

/** The bar: a legacy `region` landmark, a next `group` (a3-bar-group). */
const bar = (page: Page) =>
  page
    .getByRole('region', { name: 'Dissection' })
    .or(page.getByRole('group', { name: 'Dissection' }));
const undo = (page: Page) => bar(page).getByRole('button', { name: 'Undo', exact: true });
const restore = (page: Page) => bar(page).getByRole('button', { name: 'Restore all', exact: true });
const tree = (page: Page) =>
  page
    .getByRole('tree', { name: 'Browse anatomy' })
    .or(page.getByRole('treegrid', { name: 'Browse anatomy' }));
const system = (page: Page) => page.getByRole('combobox', { name: 'System', exact: true });

test.describe('dissection bar', () => {
  test.beforeEach(async ({ app }) => {
    await app.page.setViewportSize({ width: 1280, height: 800 });
  });

  test('nothing is hidden: there is no bar', async ({ app }) => {
    await app.gotoHash();
    await app.ready();
    await expect(bar(app.page)).toHaveCount(0);
  });

  test('a permalink with a hidden part: the count, Undo disabled, Restore all enabled', async ({
    app,
  }) => {
    const { page } = app;
    await app.gotoHash({ hidden: REGION });
    await app.ready();
    if (isNext()) {
      // a3-bar-group: a group, not a region landmark.
      await expect(bar(page)).toBeVisible();
    } else {
      await expect(bar(page)).toMatchAriaSnapshot(`
        - region "Dissection":
          - heading "Dissection" [level=3]
          - paragraph: 1 part hidden
          - button "Undo" [disabled]
          - button "Restore all"
      `);
    }
    await expect(bar(page).getByText('1 part hidden')).toBeVisible();
    await expect(undo(page)).toBeDisabled();
    await expect(restore(page)).toBeEnabled();
    await app.expectAccessible('dissection');
  });

  test('Restore all empties the bar and puts focus on the tree’s tab stop', async ({ app }) => {
    const { page } = app;
    await app.gotoHash({ hidden: REGION });
    await app.ready();
    await restore(page).focus();
    await page.keyboard.press('Enter');
    await expect(bar(page)).toHaveCount(0);
    await expect(tree(page).locator('[tabindex="0"]').first()).toBeFocused();
    await expect.poll(() => app.hash()).not.toContain('hidden=');
  });

  test('French: the bar is worded in French', async ({ app }) => {
    const { page } = app;
    await app.gotoHash({ hidden: REGION, lang: 'fr' });
    await app.ready();
    await expect(bar(page).getByText('1 partie masquée')).toBeVisible();
    await expect(bar(page).getByRole('button', { name: 'Annuler', exact: true })).toBeDisabled();
    await expect(
      bar(page).getByRole('button', { name: 'Tout rétablir', exact: true }),
    ).toBeEnabled();
  });

  test('the inspector’s Hide puts focus on Undo; Undo brings the part back and focus to the tree', async ({
    app,
  }) => {
    const { page } = app;
    await app.gotoHash({ region: REGION });
    await app.ready();
    await page.getByRole('button', { name: 'Hide', exact: true }).click();
    await expect(bar(page).getByText('1 part hidden')).toBeVisible();
    await expect(undo(page)).toBeEnabled();
    await expect(undo(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(bar(page)).toHaveCount(0);
    await expect(tree(page).locator('[tabindex="0"]').first()).toBeFocused();
  });

  test('Undo that spends the history while parts remain moves focus to Restore all', async ({
    app,
  }) => {
    const { page } = app;
    // The permalink's part has no history; hiding a whole group after it is one step to undo.
    await app.gotoHash({ hidden: REGION });
    await app.ready();
    await tree(page).getByRole('button', { name: 'Hide Cerebellum, left' }).click();
    await expect(undo(page)).toBeEnabled();
    await expect(bar(page).getByText(/^\d+ parts hidden$/)).toBeVisible();
    await undo(page).focus();
    await page.keyboard.press('Enter');
    await expect(bar(page).getByText('1 part hidden')).toBeVisible();
    await expect(undo(page)).toBeDisabled();
    await expect(restore(page)).toBeFocused();
  });
});

test.describe('system picker', () => {
  test.beforeEach(async ({ app }) => {
    await app.page.setViewportSize({ width: 1280, height: 800 });
    await app.gotoHash();
    await app.ready();
  });

  const bySystem = (page: Page) =>
    page
      .getByRole('button', { name: 'By system' })
      .or(page.getByRole('radio', { name: 'By system' }));

  test('shown by system only; all systems first; a choice is written to the link', async ({
    app,
  }) => {
    const { page } = app;
    await expect(system(page)).toBeHidden();
    await bySystem(page).click();
    await expect(system(page)).toBeVisible();
    const labels = await system(page).locator('option').allTextContents();
    expect(labels[0]).toBe('All internal structures');
    const named = labels.slice(1);
    expect(named.length).toBeGreaterThan(1);
    expect(named).toEqual([...named].sort((a, b) => a.localeCompare(b, 'en')));
    await system(page).selectOption({ index: 1 });
    await expect(system(page).locator('option:checked')).toHaveText(named[0]);
    await expect.poll(() => app.hash()).toContain('system=');
    await system(page).selectOption({ index: 0 });
    await expect.poll(() => app.hash()).not.toContain('system=');
    await app.expectAccessible('system-picker');
  });

  test('a permalink’s system is the one shown', async ({ app }) => {
    const { page } = app;
    await bySystem(page).click();
    await system(page).selectOption({ index: 1 });
    await expect.poll(() => app.hash()).toContain('system=');
    await app.waitForCameraIdle();
    const link = await app.hash();
    const chosen = await system(page).locator('option:checked').textContent();
    // A reload: setting the same hash would be a same-document navigation that loads nothing.
    await page.reload();
    await app.ready();
    await expect.poll(() => app.hash()).toBe(link);
    await expect(system(page)).toBeVisible();
    await expect(system(page).locator('option:checked')).toHaveText(chosen!);
  });
});
