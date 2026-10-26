// R1: the region inspector, run on both apps. Role and name locators; each difference between
// them cites its deviation record in docs/decisions/deviations/ (r1-summary-headings,
// r1-constituent-side, r1-hidden-actions) or decision 35 on #4.
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import enabled from './enabled/panels.ts';

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name === 'next' && !enabled, 'the next panels region is not enabled');
});

const V1 = 'hcp-mmp:left:1';
const regionPanel = (page: Page) => page.locator('#region-detail, .region-detail');
const summary = (page: Page, name: string) =>
  regionPanel(page).locator('summary').filter({ hasText: name });

test.describe('selected region', () => {
  test.beforeEach(async ({ app }) => {
    await app.gotoHash({ atlas: 'hcp-mmp', region: V1 });
    await app.ready();
  });

  test('names the region and its side, then offers the four commands', async ({ app }) => {
    const { page } = app;
    await expect(page.getByRole('heading', { level: 2, name: /V1/ })).toBeVisible();
    await expect(regionPanel(page).getByText('Left', { exact: true })).toBeVisible();
    for (const name of ['Focus', 'Isolate', 'Hide', 'Open linked MRI slices']) {
      await expect(regionPanel(page).getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(regionPanel(page).getByRole('button', { name: 'Linked MRI' })).toBeVisible();
  });

  test('the datasheet lists the metric, the centroid and the source label', async ({ app }) => {
    const { page } = app;
    const facts = page.locator('#selected-facts, .facts');
    await expect(facts.locator('dt')).toHaveText([
      'Surface area',
      'Centroid (RAS)',
      'Source label',
    ]);
    await expect(facts.locator('dd').nth(0)).toContainText('mm²');
    await expect(facts.locator('dd').nth(1)).toContainText(
      /[+−]\d+\.\d, [+−]\d+\.\d, [+−]\d+\.\d mm/,
    );
    await expect(facts.locator('dd').nth(2)).toContainText('· 1');
  });

  test('Isolate becomes Restore and never claims to be pressed', async ({ app }) => {
    const { page } = app;
    const isolate = regionPanel(page).getByRole('button', { name: 'Isolate', exact: true });
    await expect(isolate).not.toHaveAttribute('aria-pressed', /.*/);
    await isolate.click();
    const restore = regionPanel(page).getByRole('button', { name: 'Restore', exact: true });
    await expect(restore).toBeVisible();
    await expect(restore).toHaveAttribute('data-active', 'true');
    await expect(restore).not.toHaveAttribute('aria-pressed', /.*/);
    await restore.click();
    await expect(
      regionPanel(page).getByRole('button', { name: 'Isolate', exact: true }),
    ).toBeVisible();
  });

  test('Clear selection empties the panel and leaves focus on the page', async ({ app }) => {
    const { page } = app;
    await regionPanel(page).getByRole('button', { name: 'Clear selection' }).click();
    await expect(page.getByRole('heading', { name: 'No region selected' })).toBeVisible();
    expect(await app.hash()).not.toContain('region=');
    const focused = await page.evaluate(() => {
      const active = document.activeElement;
      return active !== null && active !== document.body && active.checkVisibility();
    });
    expect(focused).toBe(true);
  });

  test('Hide hands the region to the dissection and focus stays on the page', async ({ app }) => {
    const { page } = app;
    await regionPanel(page).getByRole('button', { name: 'Hide', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'No region selected' })).toBeVisible();
    const focused = await page.evaluate(() => {
      const active = document.activeElement;
      return active !== null && active !== document.body && active.checkVisibility();
    });
    expect(focused).toBe(true);
  });

  test('functional division, domains and networks are collapsed and toggle from the keyboard', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    const names = ['Functional division', 'Neuropsychological functions', 'Functional networks'];
    for (const name of names) {
      const heading = summary(page, name);
      await expect(heading).toBeVisible();
      await expect(heading.locator('xpath=..')).not.toHaveAttribute('open', /.*/);
      // Deviation r1-summary-headings: legacy nests an h3 in each summary, next has plain text.
      await expect(heading.getByRole('heading')).toHaveCount(
        testInfo.project.name === 'legacy' ? 1 : 0,
      );
    }
    await summary(page, 'Functional networks').focus();
    await page.keyboard.press('Enter');
    await expect(summary(page, 'Functional networks').locator('xpath=..')).toHaveAttribute(
      'open',
      '',
    );
    await expect(regionPanel(page).getByText('Visual', { exact: true })).toBeVisible();
    await expect(regionPanel(page).getByText('100%').first()).toBeVisible();
    await page.keyboard.press('Space');
    await expect(summary(page, 'Functional networks').locator('xpath=..')).not.toHaveAttribute(
      'open',
      /.*/,
    );
  });

  test('is accessible', async ({ app }) => {
    await app.expectAccessible('inspector');
  });
});

test.describe('constituents', () => {
  test('a midline union names each part and its side, and a part opens its own region', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await app.gotoHash({
      detail: 'learning',
      internal: '1',
      cortex: '0',
      region: 'learning:midline:optic-chiasm',
    });
    await app.ready();
    const heading = summary(page, 'Constituent regions');
    await expect(heading).toContainText('2');
    await heading.click();
    const parts = regionPanel(page).locator('.constituents-list li, #constituents-list li');
    await expect(parts).toHaveCount(2);
    // Both apps name the side to a screen reader on a structure button (legacy aria-label,
    // next hidden text, deviation r1-constituent-side) and show the glyph.
    await expect(parts.nth(0).getByRole('button')).toHaveAccessibleName(/, left$/);
    await expect(parts.nth(1).getByRole('button')).toHaveAccessibleName(/, right$/);
    await expect(parts.nth(0)).toContainText('L');
    await expect(parts.nth(1)).toContainText('R');
    if (testInfo.project.name === 'next') {
      await expect(parts.locator('[aria-hidden=true]')).toHaveCount(2);
    }
    await parts.nth(0).getByRole('button').click();
    await expect(page.getByRole('heading', { level: 2 })).not.toHaveText(/Optic chiasm/);
  });
});
