// The Deficits explorer and the related-deficits list, run on both apps. Differences between them each
// cite a deviation record in docs/decisions/deviations/ (x2-evidence-summary-name,
// x2-aria-disabled-while-opening, x2-focus-after-render, x2-results-announcement).
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';

const search = (page: Page) => page.getByRole('searchbox', { name: /search deficits/i });
const list = (page: Page) => page.getByRole('group', { name: 'Deficits', exact: true });
const rowOf = (page: Page, name: string) =>
  list(page).getByRole('button', { name: new RegExp(`^${name}\\b`) });
/** Deficit rows only: a search also shows its bridge and suggestion buttons. */
const rows = (page: Page) =>
  list(page).getByRole('button', { name: /^(?!Functions:|Did you mean)/ });
const heading = (page: Page, name: string) =>
  page.getByRole('heading', { level: 2, name, exact: true });
const meta = (page: Page) =>
  page.getByRole('status').filter({ hasText: /regions? (coloured|visible)|Opening anatomy/ });

test.describe('deficits list', () => {
  test.beforeEach(async ({ app }) => {
    await app.gotoHash({ tab: 'deficits' });
    await app.ready();
  });

  test('lists every deficit under its group heading and states its scope', async ({ app }) => {
    const { page } = app;
    await expect(list(page).getByRole('button')).toHaveCount(40);
    await expect(list(page).getByRole('heading', { level: 3 }).first()).toBeVisible();
    await expect(page.getByText('40 profiles · adult acquired deficits')).toBeVisible();
    await expect(search(page)).toBeVisible();
  });

  test('typing filters the list and says the count once typing pauses', async ({ app }) => {
    const { page } = app;
    await search(page).fill('aphas');
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByText('40 profiles · adult acquired deficits')).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: /^1 deficit$/ })).toHaveCount(1);
  });

  test('Escape clears a filled field and keeps focus; Clear search does too', async ({ app }) => {
    const { page } = app;
    await search(page).fill('aphas');
    await search(page).press('Escape');
    await expect(search(page)).toHaveValue('');
    await expect(search(page)).toBeFocused();
    await expect(list(page).getByRole('button')).toHaveCount(40);
    await search(page).fill('aphas');
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(search(page)).toHaveValue('');
    await expect(search(page)).toBeFocused();
  });

  test('arrow keys move between the field and the rows; each row is a Tab stop', async ({
    app,
  }) => {
    const { page } = app;
    await search(page).focus();
    await page.keyboard.press('ArrowDown');
    const rows = list(page).getByRole('button');
    await expect(rows.first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(rows.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(search(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(rows.first()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(rows.nth(1)).toBeFocused();
  });

  test('no match: a title, a hint and a suggestion that fills the field', async ({ app }) => {
    const { page } = app;
    await search(page).fill('aphazia');
    await expect(page.getByText('No match for “aphazia”')).toBeVisible();
    await expect(page.getByText('Try another term or a cognitive function.')).toBeVisible();
    await page.getByRole('button', { name: /Did you mean/ }).click();
    await expect(search(page)).not.toHaveValue('aphazia');
    await expect(search(page)).toBeFocused();
  });

  test('a query other activation maps match leads to the Functions tab with the same words', async ({
    app,
  }) => {
    const { page } = app;
    await search(page).fill('language');
    await page.getByRole('button', { name: /^Functions: \d+ activation maps? match/ }).click();
    await expect(page.getByRole('tab', { name: 'Functions' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect.poll(() => app.hash()).toContain('tab=functions');
  });
});

test.describe('deficit profile', () => {
  test.beforeEach(async ({ app }) => {
    await app.gotoHash({ tab: 'deficits' });
    await app.ready();
    await rowOf(app.page, 'Aphasia').click();
  });

  test('opens at once with the name focused and the link carrying the deficit', async ({ app }) => {
    const { page } = app;
    await expect(heading(page, 'Aphasia')).toBeFocused();
    await expect.poll(() => app.hash()).toContain('deficit=aphasia');
    await expect(
      page.getByText(/^Lesion and clinical evidence · \d+ associations?$/),
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Associations' })).toBeVisible();
  });

  test('the meta line names the side and counts the regions from what is drawn', async ({
    app,
  }) => {
    await expect(meta(app.page)).toHaveText(
      /^Left hemisphere · (\d+ of )?\d+ regions? (coloured|visible)$/,
    );
  });

  test('a finding’s regions are always in reach and open the region with its name focused', async ({
    app,
  }) => {
    const { page } = app;
    const region = page.getByRole('button', { name: /^Open region: .+ · Left$/ }).first();
    await expect(region).toBeVisible();
    await region.click();
    await expect.poll(() => app.hash()).toContain('region=');
    const focused = page.getByRole('heading', { level: 2 }).and(page.locator(':focus'));
    await expect(focused).toBeVisible();
    await expect(focused).not.toHaveText('Aphasia');
  });

  test('the evidence of one finding opens and closes', async ({ app }, testInfo) => {
    const { page } = app;
    const summary = page.locator('article summary').first();
    const details = page.locator('article details').first();
    await expect(details).not.toHaveAttribute('open', '');
    await summary.click();
    await expect(details).toHaveAttribute('open', '');
    await expect(
      page.getByRole('heading', { level: 5, name: 'Reported finding' }).first(),
    ).toBeVisible();
    // Deviation x2-evidence-summary-name: the next app says which finding the summary belongs to.
    if (testInfo.project.name === 'next') await expect(summary).toContainText(/^Evidence, /);
    else await expect(summary).toHaveText('Evidence');
    await summary.click();
    await expect(details).not.toHaveAttribute('open', '');
  });

  test('publications link out to DOI and PubMed in a new tab', async ({ app }) => {
    const { page } = app;
    await page.locator('article summary').first().click();
    const paper = page.getByRole('article').getByRole('link').first();
    await expect(paper).toHaveAttribute('href', /^https:\/\/doi\.org\//);
    await expect(paper).toHaveAttribute('target', '_blank');
    await expect(page.getByRole('link', { name: /^PubMed · \d+/ }).first()).toHaveAttribute(
      'href',
      /^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/$/,
    );
  });

  test('Restore previous view returns to the scene from before and focuses the deficit’s row', async ({
    app,
  }) => {
    const { page } = app;
    await page.getByRole('button', { name: 'Restore previous view' }).click();
    await expect.poll(() => app.hash()).not.toContain('deficit=');
    await expect(rowOf(page, 'Aphasia')).toBeFocused();
  });

  test('is accessible', async ({ app }) => {
    await app.page.locator('article summary').first().click();
    await app.expectAccessible('deficits');
  });
});

test.describe('in French', () => {
  test('the list, the profile and its evidence are in French', async ({ app }) => {
    const { page } = app;
    await app.gotoHash({ tab: 'deficits', deficit: 'aphasia', lang: 'fr' });
    await app.ready();
    await expect(heading(page, 'Aphasie')).toBeVisible();
    await expect(
      page.getByText(/^Données lésionnelles et cliniques · \d+ associations?$/),
    ).toBeVisible();
    await expect(page.locator('article summary').first()).toContainText('Données probantes');
  });
});

test.describe('related deficits', () => {
  test('a region named by a finding lists its deficits, and one opens the profile', async ({
    app,
  }) => {
    const { page } = app;
    await app.gotoHash({ tab: 'anatomy', region: 'destrieux:left:38' });
    await app.ready();
    await expect(page.getByRole('heading', { level: 3, name: 'Neuropsychology' })).toBeVisible();
    const related = page
      .getByRole('heading', { level: 3, name: 'Neuropsychology' })
      .locator('xpath=following::button[1]');
    await expect(related).toContainText('Aphasia');
    await related.click();
    await expect(heading(page, 'Aphasia')).toBeFocused();
    await expect.poll(() => app.hash()).toContain('deficit=aphasia');
  });
});
