// G3: the stage's colour keys (viewer/ui/chrome/viewport-chrome.js:269-430), run on both apps with
// role and name locators. Each difference between them cites its deviation record in
// docs/decisions/deviations/ (g3-level-radio-group, g3-paint-toolbar). The stage
// region is gated on `next` until I2 mounts it.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import enabled from './enabled/stage.ts';

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name === 'next' && !enabled, 'the next stage region is not enabled');
});

const keys = (page: Page) => page.locator('#stage-keys');
const plateToggle = (page: Page, name: string | RegExp) =>
  keys(page).getByRole('button', { name, exact: typeof name === 'string' });

/** The sum of the band the keys take off the framing rectangle, as the stage host publishes it. */
const keyBand = (page: Page) =>
  page.evaluate(() => {
    const style = getComputedStyle(document.getElementById('viewport')!);
    return (
      parseFloat(style.getPropertyValue('--key-top')) +
      parseFloat(style.getPropertyValue('--key-right'))
    );
  });

const height = async (target: Locator) => (await target.boundingBox())!.height;

test.describe('colour keys', () => {
  test.beforeEach(async ({ app }) => {
    await app.page.setViewportSize({ width: 1280, height: 800 });
  });

  test('a network colour keys its networks on a plate that folds away and opens again', async ({
    app,
  }) => {
    const { page } = app;
    await app.gotoHash({ colors: 'network' });
    await app.ready();
    const toggle = plateToggle(page, 'Yeo 7 networks');
    const list = keys(page).getByRole('list', { name: 'Yeo 7 networks' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(list.getByRole('listitem')).toHaveCount(7);
    await expect(list).toContainText('Default mode');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(list).toBeHidden();
    await toggle.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(list).toBeVisible();
  });

  test('French words the plate and its rows', async ({ app }) => {
    const { page } = app;
    await app.gotoHash({ colors: 'network', lang: 'fr' });
    await app.ready();
    await expect(plateToggle(page, 'Réseaux Yeo 7')).toBeVisible();
    await expect(keys(page).getByRole('list', { name: 'Réseaux Yeo 7' })).toContainText('Visuel');
  });

  test('the keys take a band off the framing rectangle, and it goes with them', async ({ app }) => {
    const { page } = app;
    await app.gotoHash({ colors: 'network' });
    await app.ready();
    await expect.poll(() => keyBand(page)).toBeGreaterThan(0);
    await app.gotoHash({ colors: 'tissue' });
    await app.ready();
    await expect.poll(() => keyBand(page)).toBe(0);
  });

  test('functional divisions: the level is chosen in the title row and the rows follow it', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await app.gotoHash({ atlas: 'hcp-mmp', colors: 'functional' });
    await app.ready();
    const next = testInfo.project.name === 'next';
    await expect(plateToggle(page, 'Functional divisions')).toBeVisible();
    const level = keys(page).getByRole(next ? 'radiogroup' : 'group', {
      name: 'Functional division level',
    });
    const sections = level.getByRole(next ? 'radio' : 'button', { name: 'Sections' });
    const rows = keys(page).getByRole('listitem');
    const named = await rows.allTextContents();
    expect(named.length).toBeGreaterThan(0);
    await sections.click();
    await expect.poll(() => app.hash()).toContain('level=sections');
    await expect.poll(async () => rows.allTextContents()).not.toEqual(named);
    if (next) await expect(sections).toBeChecked();
    else await expect(sections).toHaveAttribute('aria-pressed', 'true');
  });

  test('next only: the arrow keys choose a level (g3-level-radio-group)', async ({
    app,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'legacy', 'legacy arrows move focus without choosing');
    const { page } = app;
    await app.gotoHash({ atlas: 'hcp-mmp', colors: 'functional' });
    await app.ready();
    const level = keys(page).getByRole('radiogroup', { name: 'Functional division level' });
    await level.getByRole('radio', { name: 'Named' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(level.getByRole('radio', { name: 'Sections' })).toBeChecked();
    await expect.poll(() => app.hash()).toContain('level=sections');
  });

  test('a paint keys its rows; choosing one shows that function alone, on a scale', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    const next = testInfo.project.name === 'next';
    await app.gotoHash({ atlas: 'hcp-mmp', tab: 'functions', function: 'all' });
    await app.ready();
    const title = 'Neuropsychological functions';
    await expect(plateToggle(page, title)).toBeVisible();
    // The toolbar is next's (g3-paint-toolbar); legacy's rows are buttons in an unnamed list.
    await expect(keys(page).getByRole('toolbar', { name: title })).toHaveCount(next ? 1 : 0);
    const picks = page.locator('#paint-key li').getByRole('button');
    await expect(picks).toHaveCount(11);
    await expect(picks.first()).toHaveAttribute('aria-pressed', 'false');
    await keys(page)
      .getByRole('button', { name: /^Language/ })
      .click();
    await expect.poll(() => app.hash()).toContain('function=language');
    // One function's z scale is not a set of toggles.
    await expect(plateToggle(page, 'Language')).toBeVisible();
    await expect(keys(page).getByRole('button')).toHaveCount(1);
    await expect(keys(page).getByRole('toolbar')).toHaveCount(0);
  });

  test('targets: the title row and the rows are 24 px or more; the 20 px level buttons keep the spacing exception', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await app.gotoHash({ atlas: 'hcp-mmp', colors: 'functional' });
    await app.ready();
    expect(await height(plateToggle(page, 'Functional divisions'))).toBeGreaterThanOrEqual(24);
    for (const row of await keys(page).getByRole('listitem').all()) {
      expect(await height(row)).toBeGreaterThanOrEqual(24);
    }
    const next = testInfo.project.name === 'next';
    const buttons = await keys(page)
      .getByRole(next ? 'radiogroup' : 'group', { name: 'Functional division level' })
      .getByRole(next ? 'radio' : 'button')
      .all();
    const boxes = (await Promise.all(buttons.map((button) => button.boundingBox()))).map(
      (box) => box!,
    );
    // WCAG 2.5.8: an undersized target is allowed where a 24 px circle on its centre meets no other target.
    expect(boxes).toHaveLength(2);
    for (const box of boxes) expect(box.height).toBeLessThan(24);
    const [a, b] = boxes.map((box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 }));
    expect(Math.hypot(a!.x - b!.x, a!.y - b!.y)).toBeGreaterThanOrEqual(24);
    const toggle = (await plateToggle(page, 'Functional divisions').boundingBox())!;
    for (const c of [a!, b!]) {
      const dx = Math.max(toggle.x - c.x, 0, c.x - (toggle.x + toggle.width));
      const dy = Math.max(toggle.y - c.y, 0, c.y - (toggle.y + toggle.height));
      expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(12);
    }
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the title row is a full target, the keys fold when long, and the page is accessible', async ({
    app,
  }) => {
    const { page } = app;
    await app.gotoHash({ colors: 'network' });
    await app.ready();
    expect(await height(plateToggle(page, 'Yeo 7 networks'))).toBeGreaterThanOrEqual(44);
    await expect.poll(() => keyBand(page)).toBeGreaterThan(0);
    await app.expectAccessible('stage-keys');
  });

  test('a 12-row key folds to its title where it would take over half the stage', async ({
    app,
  }) => {
    const { page } = app;
    await app.gotoHash({ atlas: 'hcp-mmp', colors: 'cab-np' });
    await app.ready();
    await expect(plateToggle(page, 'CAB-NP networks')).toHaveAttribute('aria-expanded', 'false');
  });
});
