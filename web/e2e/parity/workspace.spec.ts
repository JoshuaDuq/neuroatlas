// H5: the workspace frame, run on both apps: the mode tablist, the list and detail views, the
// location bar, the selection strip. Differences between the apps each cite a deviation record in
// docs/decisions/deviations/ (h5-tabpanel-semantics, h5-strip-name-side, h5-clear-focus).
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import enabled from './enabled/panels.ts';

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name === 'next' && !enabled, 'the panels region is not integrated');
});

const REGION = 'destrieux:left:38';
const MODES = ['Anatomy', 'Functions', 'Deficits', 'Circuits', 'Tracts'];

const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const breadcrumb = (page: Page) => page.getByRole('navigation', { name: 'Breadcrumb' });
const back = (page: Page) => page.getByRole('button', { name: /^Back to / });
const strip = (page: Page) => page.getByRole('button', { name: /^Inspect / });

test.describe('mode tabs', () => {
  test.beforeEach(async ({ app }) => {
    await app.page.setViewportSize({ width: 1280, height: 800 });
    await app.gotoHash();
    await app.ready();
  });

  test('one tablist of the five modes, the first selected and the only Tab stop', async ({
    app,
  }) => {
    const { page } = app;
    const tablist = page.getByRole('tablist', { name: 'Explore the atlas' });
    await expect(tablist).toMatchAriaSnapshot(`
      - tablist "Explore the atlas":
        - tab "Anatomy" [selected]
        - tab "Functions"
        - tab "Deficits"
        - tab "Circuits"
        - tab "Tracts"
    `);
    await expect(tab(page, 'Anatomy')).toHaveAttribute('tabindex', '0');
    for (const name of MODES.slice(1)) {
      await expect(tab(page, name)).toHaveAttribute('tabindex', '-1');
    }
  });

  test('the selected tab controls the shown panel, which the tab labels', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    const panel = page.getByRole('tabpanel');
    await expect(panel).toHaveCount(1);
    await expect(panel).toHaveAccessibleName('Anatomy');
    const id = await panel.getAttribute('id');
    await expect(tab(page, 'Anatomy')).toHaveAttribute('aria-controls', id!);
    // h5-tabpanel-semantics: the legacy tabs all point at the one shown panel; the next app
    // sets aria-controls on the selected tab only (APG; React Aria).
    const others = tab(page, 'Functions');
    if (testInfo.project.name === 'legacy')
      await expect(others).toHaveAttribute('aria-controls', id!);
    else await expect(others).not.toHaveAttribute('aria-controls');
  });

  test('arrows and Home/End move focus, wrapping, and choose nothing', async ({ app }) => {
    const { page } = app;
    const before = await app.hash();
    await tab(page, 'Anatomy').focus();
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'Functions')).toBeFocused();
    await page.keyboard.press('End');
    await expect(tab(page, 'Tracts')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'Anatomy')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(tab(page, 'Tracts')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(tab(page, 'Anatomy')).toBeFocused();
    await expect(tab(page, 'Anatomy')).toHaveAttribute('aria-selected', 'true');
    expect(await app.hash()).toBe(before);
  });

  test('Enter and Space choose the focused tab, and focus stays on it', async ({ app }) => {
    const { page } = app;
    await tab(page, 'Anatomy').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(tab(page, 'Functions')).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, 'Functions')).toBeFocused();
    await expect.poll(() => app.hash()).toContain('tab=functions');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');
    await expect(tab(page, 'Deficits')).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => app.hash()).toContain('tab=deficits');
  });

  test('a phone has the same tabs, and choosing one switches the mode', async ({ app }) => {
    const { page } = app;
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(tab(page, 'Anatomy')).toBeVisible();
    await tab(page, 'Functions').click();
    await expect(tab(page, 'Functions')).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => app.hash()).toContain('tab=functions');
  });
});

test.describe('list and detail', () => {
  test.beforeEach(async ({ app }) => {
    await app.page.setViewportSize({ width: 1280, height: 800 });
    await app.gotoHash({ region: REGION });
    await app.ready();
  });

  test('a region in the link opens the detail: a breadcrumb that leads Back, then its group', async ({
    app,
  }) => {
    const { page } = app;
    await expect(breadcrumb(page)).toBeVisible();
    await expect(back(page)).toHaveAccessibleName('Back to Anatomy');
    await expect(back(page)).toContainText('Anatomy');
    const group = breadcrumb(page).getByRole('button', { name: /, show in the list$/ });
    await expect(group).toHaveAttribute('aria-current', 'location');
    // The detail is the shown panel; the tab controls it.
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
  });

  test('Back returns to the list; the current mode tab does the same', async ({ app }) => {
    const { page } = app;
    await back(page).click();
    await expect(breadcrumb(page)).toBeHidden();
    await expect(page.getByRole('tabpanel')).toHaveAccessibleName('Anatomy');
    await app.selectRegion(REGION.replace('38', '39'));
    await expect(breadcrumb(page)).toBeVisible();
    await tab(page, 'Anatomy').click();
    await expect(breadcrumb(page)).toBeHidden();
  });

  test('another mode returns to its list', async ({ app }) => {
    const { page } = app;
    await tab(page, 'Functions').click();
    await expect(tab(page, 'Functions')).toHaveAttribute('aria-selected', 'true');
    await expect(breadcrumb(page)).toBeHidden();
    await expect(tab(page, 'Functions')).toBeFocused();
  });

  test("the strip appears over another mode's list, names the selection, and opens the detail", async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await tab(page, 'Deficits').click();
    await expect(breadcrumb(page)).toBeHidden();
    await expect(strip(page)).toBeVisible();
    // h5-strip-name-side: the next app's strip names the side, as the phone's does.
    if (testInfo.project.name === 'next') {
      await expect(strip(page)).toHaveAccessibleName(/^Inspect .+, (left|right|midline)$/);
    }
    const visible = (await strip(page).textContent())!;
    const named = (await strip(page).getAttribute('aria-label'))!;
    expect(named.startsWith('Inspect ')).toBe(true);
    expect(named).toContain(visible.trim().split(/\s+/).slice(0, -1).join(' '));
    await strip(page).click();
    await expect(breadcrumb(page)).toBeVisible();
    await expect(back(page)).toBeFocused();
  });

  test('clear removes the selection and, in the next app, leaves focus on the tab in front', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await tab(page, 'Deficits').click();
    await page.getByRole('button', { name: 'Clear selection' }).first().click();
    await expect(strip(page)).toBeHidden();
    // h5-clear-focus: the legacy strip checks for stranded focus before it has re-rendered, so
    // focus falls to the document; the next app waits for the page and hands it to the tab.
    if (testInfo.project.name === 'next') await expect(tab(page, 'Deficits')).toBeFocused();
  });

  test('accessibility', async ({ app }) => {
    await app.expectAccessible('workspace');
  });
});
