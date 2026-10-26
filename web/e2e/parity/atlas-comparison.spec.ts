// R2: the atlas comparison, run on both apps. Role and name locators; each difference between them
// cites its deviation record in docs/decisions/deviations/ (r2-summary-heading, r2-status-live,
// r2-aria-disabled-rows, r2-retry-focus, r2-forced-colours, r2-new-tab-cue) or decision 39 on #4.
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import enabled from './enabled/panels.ts';

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name === 'next' && !enabled, 'the panels region is not integrated');
});

const V1 = 'hcp-mmp:left:1'; // 5 overlaps: four rows, one behind "1 more overlapping region"
const panelOf = (page: Page) => page.locator('#region-comparison, .comparison');
const summaryOf = (page: Page) => panelOf(page).locator('summary').first();
const rowsOf = (page: Page) =>
  panelOf(page).getByRole('button', {
    name: /^(Highlight overlap with|Tracer le recouvrement avec) /,
  });
const isNext = () => test.info().project.name === 'next';

async function openPanel(page: Page) {
  await summaryOf(page).click();
  await expect(panelOf(page)).toHaveAttribute('open', '');
}

test.describe('atlas comparison', () => {
  test.beforeEach(async ({ app }) => {
    await app.page.setViewportSize({ width: 1280, height: 800 });
    await app.gotoHash({ atlas: 'hcp-mmp', region: V1 });
    await app.ready();
  });

  test('is shown for a cortex region, names the other atlas and loads while still closed', async ({
    app,
  }) => {
    const { page } = app;
    await expect(summaryOf(page)).toHaveText('Overlap with Destrieux');
    await expect(panelOf(page)).not.toHaveAttribute('open', /.*/);
    await expect.poll(() => app.requestsTo(/atlas-comparison\.json/).length).toBe(1);
  });

  test('shows four rows, the rest behind a disclosure, and the unassigned remainder', async ({
    app,
  }) => {
    const { page } = app;
    await openPanel(page);
    await expect(rowsOf(page)).toHaveCount(4);
    await expect(rowsOf(page).first()).toHaveAccessibleName(
      /^Highlight overlap with .+, 956\.4 mm², 34\.4% of this region$/,
    );
    await expect(panelOf(page).getByText('1 more overlapping region')).toBeVisible();
    await expect(panelOf(page).getByText('Unassigned')).toBeVisible();
    await expect(
      panelOf(page).getByText('Shares of this region’s full pial surface.'),
    ).toBeVisible();
  });

  test('a row toggles its outline; pressing another moves it; closing the panel clears it', async ({
    app,
  }) => {
    const { page } = app;
    await openPanel(page);
    const [first, second] = [rowsOf(page).nth(0), rowsOf(page).nth(1)];
    await expect(first).toHaveAttribute('aria-pressed', 'false');
    await first.click();
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await second.click();
    await expect(second).toHaveAttribute('aria-pressed', 'true');
    await expect(first).toHaveAttribute('aria-pressed', 'false');
    await second.click();
    await expect(second).toHaveAttribute('aria-pressed', 'false');
    await first.click();
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await summaryOf(page).click();
    await summaryOf(page).click();
    await expect(first).toHaveAttribute('aria-pressed', 'false');
  });

  test('a cut leaves the figures and turns the rows off, with the reason beside them', async ({
    app,
  }) => {
    const { page } = app;
    await app.gotoHash({ atlas: 'hcp-mmp', region: V1, cut: 'sagittal' });
    await app.ready();
    await openPanel(page);
    await expect(rowsOf(page).first()).toBeDisabled();
    await expect(panelOf(page).getByText(/^Turn off sections to outline overlaps\./)).toBeVisible();
    // r2-aria-disabled-rows: legacy rows are natively disabled and leave the tab order; next keeps them in it.
    await summaryOf(page).focus();
    await page.keyboard.press('Tab');
    if (isNext()) await expect(rowsOf(page).first()).toBeFocused();
    else await expect(rowsOf(page).first()).not.toBeFocused();
  });

  test('Download CSV saves the overlaps under the subject and region name', async ({ app }) => {
    const { page } = app;
    await openPanel(page);
    const download = page.waitForEvent('download');
    await panelOf(page).getByRole('button', { name: 'Download CSV' }).click();
    expect((await download).suggestedFilename()).toBe('cdmd-hcp-mmp-left-1-atlas-comparison.csv');
  });

  test('the method and its two sources open in a new tab', async ({ app }) => {
    const { page } = app;
    await openPanel(page);
    await panelOf(page).getByText('Method and sources').click();
    for (const name of ['Destrieux', 'HCP-MMP']) {
      // r2-new-tab-cue: next adds "(opens in a new tab)" to the name.
      const link = panelOf(page).getByRole('link', { name: new RegExp(`^${name}`) });
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('href', /^https:\/\/doi\.org\//);
    }
  });

  test('is accessible', async ({ app }) => {
    const { page } = app;
    await openPanel(page);
    await panelOf(page).getByText('1 more overlapping region').click();
    await app.expectAccessible('atlas-comparison');
  });
});

test.describe('atlas comparison, in French', () => {
  test('words the heading, the list and the actions', async ({ app }) => {
    const { page } = app;
    await app.page.setViewportSize({ width: 1280, height: 800 });
    await app.gotoHash({ lang: 'fr', atlas: 'hcp-mmp', region: V1 });
    await app.ready();
    await expect(summaryOf(page)).toHaveText('Recouvrement avec Destrieux');
    await openPanel(page);
    await expect(rowsOf(page).first()).toHaveAccessibleName(
      /^Tracer le recouvrement avec .+, 956,4 mm², 34,4 % de cette région$/,
    );
    await expect(panelOf(page).getByText('1 autre région en recouvrement')).toBeVisible();
    await expect(panelOf(page).getByText('Non assigné')).toBeVisible();
    await expect(panelOf(page).getByRole('button', { name: 'Télécharger CSV' })).toBeVisible();
  });
});

test.describe('atlas comparison, without a cortex region', () => {
  test('is not shown', async ({ app }) => {
    const { page } = app;
    await app.gotoHash({
      detail: 'learning',
      internal: '1',
      cortex: '0',
      region: 'learning:midline:optic-chiasm',
    });
    await app.ready();
    await expect(panelOf(page)).toBeHidden();
  });
});

test.describe('atlas comparison, when the file cannot be loaded', () => {
  test('says so, offers Retry and shows the rows once it works', async ({ app }) => {
    const { page } = app;
    let blocked = true;
    await page.route(/atlas-comparison\.json/, (route) =>
      blocked ? route.abort() : route.continue(),
    );
    await app.page.setViewportSize({ width: 1280, height: 800 });
    await app.gotoHash({ atlas: 'hcp-mmp', region: V1 });
    await app.ready();
    await openPanel(page);
    await expect(panelOf(page).getByRole('status')).toContainText(
      'Could not load the atlas comparison.',
    );
    blocked = false;
    await panelOf(page).getByRole('button', { name: 'Retry comparison' }).click();
    // r2-retry-focus: next hands focus to the summary; legacy drops it with the hidden button.
    if (isNext()) await expect(summaryOf(page)).toBeFocused();
    await expect(rowsOf(page)).toHaveCount(4);
  });
});
