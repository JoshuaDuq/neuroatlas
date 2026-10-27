// Journeys 2 to 4: the shareable link, the real model under the pointer, and finding a region.
// The rules each step touches have their own unit or browser test; these prove them together on
// the built site, the real address bar and the real engine.
import { expect, test } from '../fixtures.ts';

const REGION = 'destrieux:left:38';
const bar = (page: import('@playwright/test').Page) =>
  page.getByRole('group', { name: 'Dissection' });
const undo = (page: import('@playwright/test').Page) =>
  bar(page).getByRole('button', { name: 'Undo', exact: true });
const system = (page: import('@playwright/test').Page) =>
  page.getByRole('combobox', { name: 'System', exact: true });

test.use({ viewport: { width: 1280, height: 800 } });

test('LINK-21: a system chosen by hand is in the link and is the one shown after a reload', async ({
  app,
}) => {
  const { page } = app;
  await app.gotoHash();
  await app.ready();
  await page
    .getByRole('button', { name: 'By system' })
    .or(page.getByRole('radio', { name: 'By system' }))
    .click();
  await system(page).selectOption({ index: 1 });
  await expect.poll(() => app.hash()).toContain('system=');
  await app.waitForCameraIdle();
  const link = await app.hash();
  const chosen = await system(page).locator('option:checked').textContent();

  await page.reload();
  await app.ready();
  await expect.poll(() => app.hash()).toBe(link);
  await expect(system(page).locator('option:checked')).toHaveText(chosen!);
  await system(page).selectOption({ index: 0 });
  await expect.poll(() => app.hash()).not.toContain('system=');
});

test('LINK-21: a scene with a region, a hidden part, a cut, a hemisphere, a colouring and a function reopens unchanged', async ({
  app,
}) => {
  const { page } = app;
  await app.gotoHash({
    region: REGION,
    hidden: 'destrieux:right:38',
    cut: 'coronal',
    pos: '12.5',
    rev: '1',
    hemi: 'left',
    colors: 'network',
    level: 'sections',
    tab: 'functions',
    function: 'language',
  });
  await app.ready();
  await app.waitForCameraIdle();
  const link = await app.hash();
  expect(link).toContain('hidden=destrieux:right:38');

  await page.reload();
  await app.ready();
  await expect.poll(() => app.hash()).toBe(link);
  await page.getByRole('tab', { name: 'Anatomy', exact: true }).click();
  await expect(bar(page).getByText('1 part hidden')).toBeVisible();
  await expect(undo(page)).toBeDisabled();
  await bar(page).getByRole('button', { name: 'Restore all', exact: true }).click();
  await expect.poll(() => app.hash()).not.toContain('hidden=');
});

test('pick and inspect on the real model, then find a region by search', async ({ app }) => {
  const { page } = app;
  await app.gotoHash();
  await app.ready();
  const chip = page.locator('#hover-label');
  const canvas = (await page.locator('#viewport canvas').boundingBox())!;
  const points = [0.5, 0.42, 0.58, 0.35, 0.65].flatMap((x) =>
    [0.4, 0.5, 0.3, 0.6].map((y) => ({
      x: canvas.x + canvas.width * x,
      y: canvas.y + canvas.height * y,
    })),
  );
  // Probe the model one point per poll until the pointer is over a region.
  let probed = 0;
  let point = points[0]!;
  await expect
    .poll(async () => {
      point = points[probed++ % points.length]!;
      await page.mouse.move(point.x, point.y, { steps: 3 });
      return chip.isVisible();
    })
    .toBe(true);
  const name = (await chip.textContent())!.trim();
  expect(name).not.toBe('');

  await page.mouse.click(point.x, point.y);
  await expect.poll(() => app.hash()).toContain('region=');
  const hide = page.getByRole('button', { name: 'Hide', exact: true });
  await hide.click();
  await expect(bar(page).getByText('1 part hidden')).toBeVisible();
  await expect(undo(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(bar(page)).toHaveCount(0);
  await expect.poll(() => app.hash()).not.toContain('hidden=');

  // Find a region.
  const field = page.getByRole('combobox', { name: 'Search regions' });
  await field.fill('middle frontal gyrus');
  await expect(
    page.getByRole('option', { name: /^Middle frontal gyrus, left, Frontal$/ }),
  ).toBeVisible();
  await field.press('Enter');
  await expect.poll(() => app.hash()).toContain('region=destrieux:left:');

  await page.getByRole('button', { name: 'Back to Anatomy' }).click();
  const tree = page.getByRole('treegrid', { name: 'Browse anatomy' });
  await expect(tree.locator('[aria-selected="true"]')).toHaveCount(1);
  await expect(tree.getByRole('row', { name: 'Middle frontal gyrus, left' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await tree.getByRole('button', { name: 'Hide Middle frontal gyrus, left', exact: true }).click();
  await expect(page.locator('#announcer')).toContainText(
    'Hidden: Middle frontal gyrus, left. 1 part hidden',
  );
});
