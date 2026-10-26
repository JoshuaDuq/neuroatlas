// H6: the phone bottom sheet with detents (viewer/ui/chrome/sheet.js, detents.js, index.html:187-205).
// Role and name locators run on `legacy` and `next`; each difference cites its deviation record in
// web/docs/decisions/deviations/ or decision 6/9/20 on #4. The geometry (rests, rubber band, flick,
// cancel paths) is proved in the component tests (src/features/sheet/Sheet.svelte.test.ts); this spec
// proves the sheet in the assembled app: the stage is told what it covers, and the criteria of WCAG 2.2.
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import enabled from './enabled/panels.ts';

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name === 'next' && !enabled, 'the panels region is not integrated');
});

const REGION = 'destrieux:left:38';
const PHONE = { width: 390, height: 844 };
const SIDEWAYS = { width: 844, height: 390 };

const handle = (page: Page) => page.getByRole('button', { name: /^(Expand|Collapse) panel$/ });
const strip = (page: Page) => page.getByRole('button', { name: /^Inspect / });
const clear = (page: Page) => page.getByRole('button', { name: 'Clear selection' });
const back = (page: Page) => page.getByRole('button', { name: /^Back to / });
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const sheet = (page: Page) => page.locator('#sheet');

const boxOf = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())!;

/** The sheet's drawn size along its axis, once its glide has finished. */
async function span(page: Page) {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished)),
  );
  const box = await boxOf(page, '#sheet');
  const { width, height } = page.viewportSize()!;
  // The phone query's landscape arm (max-height: 480px) is the side sheet.
  return width > height && height <= 480 ? box.width : box.height;
}

/** What the stage says the sheet covers: the margin legacy and next both write on the stage host. */
const covered = (page: Page, edge: 'bottom' | 'left') =>
  page
    .locator('#viewport')
    .evaluate(
      (host, name) => parseFloat(getComputedStyle(host).getPropertyValue(`--vis-${name}`)),
      edge,
    );

interface App {
  page: Page;
  gotoHash(state?: Record<string, string>): Promise<void>;
  ready(): Promise<void>;
  waitForCameraIdle(): Promise<unknown>;
}

async function load(app: App, size = PHONE, link: Record<string, string> = {}) {
  await app.page.setViewportSize(size);
  await app.gotoHash(link);
  await app.ready();
  await app.waitForCameraIdle();
}

test.describe('the rests', () => {
  test('on a phone it loads at peek: the handle, the one tablist, no panel', async ({ app }) => {
    const { page } = app;
    await load(app);
    await expect(handle(page)).toHaveAccessibleName('Expand panel');
    await expect(page.getByRole('tablist', { name: 'Explore the atlas' })).toBeVisible();
    await expect(page.getByRole('tabpanel')).toHaveCount(0);
    // Peek hugs the grip: the tabs end where the sheet does.
    const tabs = await boxOf(page, '[role=tablist]:visible');
    const rest = await boxOf(page, '#sheet');
    expect(rest.y + rest.height - (tabs.y + tabs.height)).toBeLessThan(3);
  });

  test('the handle steps peek, half, full, peek with no drag, and names what it does next', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await load(app);
    const stage = await boxOf(page, '#viewport');
    const rests = [
      { span: Math.round(stage.height * 0.5), name: 'Expand panel', announced: 'Panel half open' },
      { span: stage.height - 128, name: 'Collapse panel', announced: 'Panel fully open' },
    ];
    for (const rest of rests) {
      await handle(page).click();
      await expect.poll(() => span(page)).toBeCloseTo(rest.span, -1);
      await expect(handle(page)).toHaveAccessibleName(rest.name);
      // Decision 20 on #4: a detent change is announced; legacy says nothing.
      if (testInfo.project.name === 'next') {
        await expect(page.locator('[role=status]').first()).toHaveText(rest.announced);
      }
    }
    await handle(page).click();
    await expect(handle(page)).toHaveAccessibleName('Expand panel');
    await expect(page.getByRole('tabpanel')).toHaveCount(0);
  });

  test('Enter and Space step the handle without a glide; a pointer press restores motion', async ({
    app,
  }) => {
    const { page } = app;
    await load(app);
    await handle(page).focus();
    await page.keyboard.press('Enter');
    await expect(sheet(page)).toHaveAttribute('data-instant', '');
    await page.keyboard.press('Space');
    await expect(sheet(page)).toHaveAttribute('data-instant', '');
    await handle(page).click();
    await expect(sheet(page)).not.toHaveAttribute('data-instant');
  });

  test('a flick up on the handle raises one rest and one down lowers it', async ({ app }) => {
    const { page } = app;
    await load(app);
    const stage = await boxOf(page, '#viewport');
    const grip = (await handle(page).boundingBox())!;
    const x = grip.x + grip.width / 2;
    const y = grip.y + 6;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 120, { steps: 4 });
    await page.mouse.up();
    await expect.poll(() => span(page)).toBeCloseTo(Math.round(stage.height * 0.5), -1);
    const raised = (await handle(page).boundingBox())!;
    await page.mouse.move(x, raised.y + 6);
    await page.mouse.down();
    await page.mouse.move(x, raised.y + 126, { steps: 4 });
    await page.mouse.up();
    await expect(handle(page)).toHaveAccessibleName('Expand panel');
    await expect(page.getByRole('tabpanel')).toHaveCount(0);
  });

  test('choosing a tab raises a resting sheet', async ({ app }) => {
    const { page } = app;
    await load(app);
    await tab(page, 'Functions').click();
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
    const stage = await boxOf(page, '#viewport');
    await expect.poll(() => span(page)).toBeCloseTo(Math.round(stage.height * 0.5), -1);
  });
});

test.describe('the stage is told what the sheet covers', () => {
  test('the bottom margin follows each rest', async ({ app }) => {
    const { page } = app;
    await load(app);
    await expect.poll(() => covered(page, 'bottom'), { timeout: 30_000 }).toBeGreaterThan(60);
    await handle(page).click();
    const stage = await boxOf(page, '#viewport');
    await expect
      .poll(() => covered(page, 'bottom'), { timeout: 30_000 })
      .toBeCloseTo(Math.round(stage.height * 0.5), -1);
  });

  test('a window narrowed to a phone after load is set up, and is told', async ({
    app,
  }, testInfo) => {
    // Legacy's first inset report can stall at 0 for a minute on one load in five (G1 review on #4); next is the subject.
    test.skip(testInfo.project.name === 'legacy', 'legacy stalls intermittently (G1 review, #4)');
    test.slow();
    const { page } = app;
    await load(app, { width: 1280, height: 800 });
    await expect(handle(page)).toBeHidden();
    await page.setViewportSize(PHONE);
    await expect(handle(page)).toBeVisible();
    await expect.poll(() => covered(page, 'bottom'), { timeout: 30_000 }).toBeGreaterThan(60);
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(handle(page)).toBeHidden();
    await expect.poll(() => covered(page, 'bottom'), { timeout: 30_000 }).toBe(0);
  });

  test('held sideways it is a side sheet, and the stage loses its left edge', async ({ app }) => {
    const { page } = app;
    await load(app, SIDEWAYS);
    await expect(handle(page)).toBeVisible();
    const rest = await boxOf(page, '#sheet');
    expect(rest.x).toBe(0);
    expect(rest.width).toBeLessThan(SIDEWAYS.width / 2);
    await expect.poll(() => covered(page, 'left'), { timeout: 30_000 }).toBeGreaterThan(100);
    const tabs = await boxOf(page, '[role=tablist]:visible');
    expect(tabs.x + tabs.width).toBeLessThanOrEqual(rest.x + rest.width + 1);
  });
});

test.describe('the selection in the grip', () => {
  test.beforeEach(async ({ app }) => {
    await load(app, PHONE, { region: REGION });
  });

  test('it names the selection at peek, and opens the detail on Back with focus', async ({
    app,
  }) => {
    const { page } = app;
    await expect(strip(page)).toBeVisible();
    await expect(strip(page)).toHaveAccessibleName(/^Inspect .+/);
    await strip(page).click();
    await expect(back(page)).toBeFocused();
    await expect(handle(page)).toHaveAccessibleName('Expand panel');
    await expect.poll(() => span(page)).toBeGreaterThan(200);
  });

  test('clear clears the selection and focus goes to the tab in front', async ({ app }) => {
    const { page } = app;
    await clear(page).click();
    await expect(strip(page)).toBeHidden();
    await expect(tab(page, 'Anatomy')).toBeFocused();
  });

  test('Tab order: the handle, the name, its clear, then the tabs as one stop', async ({ app }) => {
    const { page } = app;
    await handle(page).focus();
    await page.keyboard.press('Tab');
    await expect(strip(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(clear(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(tab(page, 'Anatomy')).toBeFocused();
  });
});

test.describe('WCAG 2.2', () => {
  test('2.4.3 / 2.4.11: the handle is before the stage in the reading order, and no focus lands under the sheet', async ({
    app,
  }) => {
    const { page } = app;
    await load(app);
    await handle(page).click();
    const before = await page.evaluate(() => {
      const grip = document.querySelector('#sheet')!;
      const main = document.querySelector('main')!;
      return Boolean(grip.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(before).toBe(true);
    await handle(page).focus();
    for (let step = 0; step < 30; step += 1) {
      await page.keyboard.press('Tab');
      const obscured = await page.evaluate(() => {
        const focused = document.activeElement as HTMLElement;
        // The model's focus ring is drawn on the visible stage, not on the canvas under the sheet.
        if (focused === document.body || focused.tagName === 'CANVAS') return false;
        if (focused.closest('#sheet')) return false;
        const rect = focused.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return !(hit && (hit === focused || focused.contains(hit) || hit.contains(focused)));
      });
      expect(obscured, `Tab ${step + 1}`).toBe(false);
    }
  });

  test('2.5.8: every control of the grip is at least 44 px with a finger, 24 px at the least', async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      viewport: PHONE,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto(`./#region=${REGION}`);
    await expect(page.locator('#app')).toHaveAttribute('data-status', 'ready', { timeout: 90_000 });
    for (const control of [
      handle(page),
      strip(page),
      clear(page),
      ...['Anatomy', 'Functions', 'Deficits', 'Circuits'].map((name) => tab(page, name)),
    ]) {
      const box = (await control.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    await context.close();
  });

  test('1.4.4 / 1.4.12: 200 % text and loosened spacing grow the peek so the tabs are not cut off', async ({
    app,
  }) => {
    const { page } = app;
    await load(app);
    await page.addStyleTag({
      content:
        'html { font-size: 200% !important } * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important }',
    });
    await expect
      .poll(async () => {
        await page.evaluate(() =>
          Promise.all(document.getAnimations().map((animation) => animation.finished)),
        );
        const tabs = await boxOf(page, '[role=tablist]:visible');
        const rest = await boxOf(page, '#sheet');
        return rest.y + rest.height - (tabs.y + tabs.height);
      })
      .toBeLessThan(3);
    const tabs = await boxOf(page, '[role=tablist]:visible');
    expect(tabs.y + tabs.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  });

  test('1.4.10: at 320 px the page does not scroll sideways', async ({ app }) => {
    const { page } = app;
    await load(app, { width: 320, height: 640 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    await expect(tab(page, 'Tracts')).toBeVisible();
  });

  test('reduced motion leaves the sheet a fade, and it still reports what it covers', async ({
    app,
  }) => {
    const { page } = app;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await load(app);
    expect(await sheet(page).evaluate((el) => getComputedStyle(el).transitionProperty)).toBe(
      'opacity',
    );
    await handle(page).click();
    const stage = await boxOf(page, '#viewport');
    await expect
      .poll(() => covered(page, 'bottom'), { timeout: 30_000 })
      .toBeCloseTo(Math.round(stage.height * 0.5), -1);
  });

  test('4.1.2: the handle names its action in French', async ({ app }) => {
    const { page } = app;
    await load(app, PHONE, { lang: 'fr' });
    await expect(page.getByRole('button', { name: 'Déplier le panneau' })).toBeVisible();
  });

  test('the handle controls the panel, not its own ancestor (h6-handle-controls)', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await load(app);
    await expect(handle(page)).toHaveAttribute(
      'aria-controls',
      testInfo.project.name === 'legacy' ? 'sheet' : 'workspace-panel',
    );
  });

  test('axe: peek, half and the selection at phone width', async ({ app }) => {
    const { page } = app;
    await load(app, PHONE, { region: REGION });
    await app.expectAccessible('sheet');
    await handle(page).click();
    await app.expectAccessible('sheet-half');
  });
});
