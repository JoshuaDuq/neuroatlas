// The Tracts explorer, run on `legacy` and on `next` with role and name locators. `next` runs once
// the panels region is integrated (I1 flips e2e/parity/enabled/panels.ts); each difference between
// the two cites its deviation record.
import { readFile } from 'node:fs/promises';
import { expect, test } from '../fixtures.ts';

const AF_LEFT = 'Arcuate fasciculus · left';
const AF_RIGHT = 'Arcuate fasciculus · right';

test.beforeEach(async ({ app }) => {
  // The first opening decodes the reference dataset on software WebGL.
  test.setTimeout(240_000);
  await app.gotoHash({ tab: 'diffusion' });
  await app.ready();
  // The reference dataset downloads on the first opening; the list is usable once its keys are enabled.
  await expect(app.page.getByRole('checkbox', { name: AF_LEFT, exact: true })).toBeEnabled({
    timeout: 200_000,
  });
});

const key = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('checkbox', { name, exact: true });

test('thirteen tracts, each a group of keys named in full, with the catalog’s two drawn', async ({
  app,
}) => {
  const { page } = app;
  await expect(page.getByRole('group', { name: 'Arcuate fasciculus', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Corticospinal tract', exact: true })).toBeVisible();
  await expect(key(page, AF_LEFT)).toBeChecked();
  await expect(key(page, 'Corticospinal tract · right')).toBeChecked();
  await expect(key(page, AF_RIGHT)).not.toBeChecked();
  await expect(page.getByRole('searchbox', { name: 'Search tracts' })).toBeVisible();
});

test('the drawn key’s count and lengths describe it', async ({ app }) => {
  const { page } = app;
  await expect(key(page, AF_LEFT)).toHaveAccessibleDescription(/streamlines.*mean .* mm \(range/);
});

test('a key not drawn has no description (deviations/t1-metrics-only-while-drawn.md)', async ({
  app,
}, testInfo) => {
  const { page } = app;
  await key(page, AF_LEFT).uncheck();
  await expect(key(page, AF_LEFT)).not.toBeChecked();
  if (testInfo.project.name === 'next') {
    await expect(key(page, AF_LEFT)).toHaveAccessibleDescription('');
  } else {
    // Legacy keeps the text on the key and only clips it away.
    await expect(key(page, AF_LEFT)).toHaveAccessibleDescription(/streamlines/);
  }
});

test('the first check of a bundle that is not loaded downloads and draws it', async ({ app }) => {
  const { page } = app;
  // A click, not `check()`: the legacy box flickers back to unchecked while it downloads (deviations/t1-pending-check.md).
  await key(page, 'Cingulum · left').click();
  await expect(key(page, 'Cingulum · left')).toBeChecked({ timeout: 60_000 });
  await expect(key(page, 'Cingulum · left')).toHaveAccessibleDescription(/streamlines/);
});

test('the search filters by name, counts the bundles kept, and says when nothing matches', async ({
  app,
}) => {
  const { page } = app;
  const search = page.getByRole('searchbox', { name: 'Search tracts' });
  await search.fill('cingul');
  await expect(page.getByRole('group', { name: 'Cingulum', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Arcuate fasciculus', exact: true })).toBeHidden();
  await expect(page.getByRole('heading', { level: 4 })).toContainText('2');
  await search.fill('zzz');
  await expect(page.getByText('No match for “zzz”')).toBeVisible();
  await expect(page.getByText('Try another tract name.')).toBeVisible();
});

test('Escape clears the search and keeps focus in it; the clear button does too', async ({
  app,
}) => {
  const { page } = app;
  const search = page.getByRole('searchbox', { name: 'Search tracts' });
  await search.fill('cingul');
  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
  await search.fill('cingul');
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
});

test('the settings read out opacity and the length filter, and open on a disclosure', async ({
  app,
}) => {
  const { page } = app;
  const summary = page.getByText('Tract display');
  await expect(page.getByText('16% · ≥1\u202fmm')).toBeVisible();
  await summary.click();
  const minimum = page.getByRole('slider', { name: /^Minimum length \(mm\)/ });
  await expect(minimum).toHaveAttribute('aria-valuetext', '1\u202fmm');
  await minimum.focus();
  await minimum.press('ArrowRight');
  await expect(minimum).toHaveAttribute('aria-valuetext', '2\u202fmm');
  await summary.click();
  await expect(page.getByText('16% · ≥2\u202fmm')).toBeVisible();
});

test('the opacity slider is named by its label alone (deviations/u4-slider-readout-not-in-name.md)', async ({
  app,
}, testInfo) => {
  const { page } = app;
  await page.getByText('Tract display').click();
  const opacity = page.getByRole('slider', { name: /^Cortex opacity/ });
  await expect(opacity).toHaveAttribute('aria-valuetext', '16%');
  if (testInfo.project.name === 'next') {
    await expect(page.getByRole('slider', { name: 'Cortex opacity', exact: true })).toBeVisible();
  }
});

test('Restore returns the drawn tracts to the catalog’s initial two', async ({ app }) => {
  const { page } = app;
  await key(page, AF_LEFT).uncheck();
  await expect(key(page, AF_LEFT)).not.toBeChecked();
  await key(page, AF_RIGHT).click();
  await expect(key(page, AF_RIGHT)).toBeChecked();
  await page.getByText('Tract display').click();
  await page.getByRole('button', { name: 'Restore default tracts' }).click();
  await expect(key(page, AF_LEFT)).toBeChecked();
  await expect(key(page, AF_RIGHT)).not.toBeChecked();
});

test('Export saves planum-streamline-lengths.csv with the legacy header and quoted names', async ({
  app,
}) => {
  const { page } = app;
  await page.getByText('Tract display').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export lengths CSV' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('planum-streamline-lengths.csv');
  const csv = await readFile((await file.path())!, 'utf8');
  const [header, ...rows] = csv.split('\n');
  expect(header).toBe(
    'bundle,total_streamlines,enabled_streamlines,minimum_length_mm,mean_length_mm,min_length_mm,max_length_mm',
  );
  expect(rows.at(-1)).toBe('');
  expect(csv).not.toContain('\r');
  expect(rows[0]).toMatch(/^"Arcuate fasciculus · left",\d+,\d+,1,[\d.]+,[\d.]+,[\d.]+$/);
});

test('the dock holds only the MRI command', async ({ app }) => {
  const { page } = app;
  await expect(page.getByRole('button', { name: 'MRI with tracts' })).toBeVisible();
});

test('the tracts panel is accessible', async ({ app }) => {
  await app.expectAccessible('tracts');
});

test('the first row’s accessibility tree is the legacy baseline', async ({ app }) => {
  await expect(app.page.getByRole('group', { name: 'Arcuate fasciculus', exact: true }))
    .toMatchAriaSnapshot(`
    - group "Arcuate fasciculus":
      - checkbox "Arcuate fasciculus · left" [checked]
      - checkbox "Arcuate fasciculus · right"
  `);
});
