// Journey 5: the explorers on the built site. Each opens from its list, writes its state to the
// link and gives the previous scene back; the lists, profiles and wording are proved in the
// browser tests of each feature.
import { expect, test } from '../fixtures.ts';

test.use({ viewport: { width: 1280, height: 800 } });

test('open a function, then Restore the previous view', async ({ app }) => {
  const { page } = app;
  await app.gotoHash({ tab: 'functions' });
  await app.ready();
  const row = page
    .getByRole('group', { name: 'Functions' })
    .getByRole('button', { name: /^Language\s*,/ });
  await row.click();
  await expect(
    page.getByRole('heading', { level: 2 }).filter({ hasText: 'Language' }),
  ).toBeFocused();
  await expect(page.getByRole('status').filter({ hasText: /HCP-MMP areas?/ })).toBeVisible({
    timeout: 60_000,
  });
  await expect.poll(() => app.hash()).toContain('function=language');

  await page.getByRole('button', { name: 'Restore previous view' }).click();
  await expect(row).toBeFocused();
  await expect.poll(() => app.hash()).not.toContain('function=');
});

test('open a deficit and one of its mapped regions', async ({ app }) => {
  const { page } = app;
  await app.gotoHash({ tab: 'deficits' });
  await app.ready();
  const row = page
    .getByRole('group', { name: 'Deficits', exact: true })
    .getByRole('button', { name: /^Aphasia\b/ });
  await row.click();
  await expect(page.getByRole('heading', { level: 2, name: 'Aphasia', exact: true })).toBeFocused();
  await expect.poll(() => app.hash()).toContain('deficit=aphasia');

  await page
    .getByRole('button', { name: /^Open region: .+ · Left$/ })
    .first()
    .click();
  await expect.poll(() => app.hash()).toContain('region=');
  await expect(page.getByRole('heading', { level: 2 }).and(page.locator(':focus'))).not.toHaveText(
    'Aphasia',
  );
});

test('open a circuit and step through it with Next', async ({ app }) => {
  const { page } = app;
  await app.gotoHash({ tab: 'circuits' });
  await app.ready();
  await page.getByRole('button', { name: /^Visual pathway/ }).click();
  const stepper = page.getByRole('group', { name: 'Landmarks' });
  await expect(page.locator('[data-circuit-title]')).toHaveText('Optic chiasm');
  await expect(stepper).toContainText('1 of 4');
  await page.getByRole('button', { name: 'Next landmark' }).click();
  await expect(stepper).toContainText('2 of 4');
  await expect.poll(() => app.hash()).toMatch(/(^|&)circuit=vision(&|$)/);
  await expect.poll(() => app.hash()).toMatch(/(^|&)step=2(&|$)/);
});
