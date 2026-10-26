// G1: the stage overlays, run on both apps. They are passive annotation: no role, no tab stop, no
// pointer target. Differences between the apps each cite a deviation record in
// docs/decisions/deviations/ (g1-hover-chip-dismiss, g1-touch-hints).
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import enabled from './enabled/stage.ts';

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name === 'next' && !enabled, 'the next stage region is not enabled');
});

const OVERLAYS = '#viewport-help, #viewport-focus-hint, #orientation, #scale-bar, #hover-label';
const LETTERS = /^[RLSIPAD]$/;
const MARK = /^\d+([.,]\d)?\s?mm$/u;

const chip = (page: Page) => page.locator('#hover-label');
const help = (page: Page) => page.locator('#viewport-help');

/** Moves the pointer over the model until the chip names a region. */
async function hoverModel(page: Page) {
  const box = (await page.locator('#viewport canvas').boundingBox())!;
  const points = [0.5, 0.42, 0.58, 0.35, 0.65].flatMap((x) =>
    [0.4, 0.5, 0.3, 0.6].map((y) => ({ x: box.x + box.width * x, y: box.y + box.height * y })),
  );
  for (const point of points) {
    await page.mouse.move(point.x, point.y, { steps: 3 });
    await page.waitForTimeout(150);
    if (await chip(page).isVisible()) return point;
  }
  throw new Error('No region under any probed point.');
}

test.describe('stage overlays', () => {
  test.beforeEach(async ({ app }) => {
    await app.page.setViewportSize({ width: 1280, height: 800 });
    await app.gotoHash();
    await app.ready();
  });

  test('none of them is exposed to assistive technology, focusable or a pointer target', async ({
    app,
  }) => {
    const { page } = app;
    const report = await page.evaluate((selector) => {
      const nodes = [...document.querySelectorAll<HTMLElement>(selector)];
      return nodes.map((node) => ({
        id: node.id,
        hidden: node.closest('[aria-hidden="true"]') !== null,
        focusable: [node, ...node.querySelectorAll<HTMLElement>('*')].some((n) => n.tabIndex >= 0),
        pointerEvents: getComputedStyle(node).pointerEvents,
      }));
    }, OVERLAYS);
    expect(report.map(({ id }) => id).sort()).toEqual(
      ['hover-label', 'orientation', 'scale-bar', 'viewport-focus-hint', 'viewport-help'].sort(),
    );
    for (const overlay of report) {
      expect(overlay, overlay.id).toMatchObject({
        hidden: true,
        focusable: false,
        pointerEvents: 'none',
      });
    }
    // Their words are not in the accessibility tree: the canvas carries the instructions.
    const tree = await page.getByRole('main').ariaSnapshot();
    expect(tree).not.toMatch(/Drag to rotate|3D view|\bmm\b/);
  });

  test('the orientation letters are the six anatomical letters, one at each edge', async ({
    app,
  }) => {
    const { page } = app;
    const letters = await page.locator('#orientation [data-edge]').allTextContents();
    expect(letters).toHaveLength(4);
    for (const letter of letters) expect(letter).toMatch(LETTERS);
    expect(new Set(letters).size).toBe(4);
  });

  test('French words the right and left letters D and G, and the bar with a decimal comma', async ({
    app,
  }) => {
    const { page } = app;
    const english = await page.locator('#orientation [data-edge]').allTextContents();
    await app.gotoHash({ lang: 'fr' });
    await app.ready();
    const french = await page.locator('#orientation [data-edge]').allTextContents();
    expect(french).toEqual(english.map((letter) => ({ R: 'D', L: 'G' })[letter] ?? letter));
    await expect(page.locator('#scale-bar .measure')).toHaveText(MARK);
  });

  test('the scale bar is a rule with its length in millimetres', async ({ app }) => {
    const { page } = app;
    await expect(page.locator('#scale-bar')).toBeVisible();
    await expect(page.locator('#scale-bar .measure')).toHaveText(MARK);
    const rule = await page.locator('#scale-bar .scale-bar-rule').boundingBox();
    expect(rule!.width).toBeGreaterThanOrEqual(60);
    expect(rule!.width).toBeLessThanOrEqual(150);
  });

  test('the hover chip names the region beside the pointer, inside the stage', async ({ app }) => {
    const { page } = app;
    const point = await hoverModel(page);
    await expect(chip(page)).toContainText(/ · (Left|Right|Midline)$/);
    const box = (await chip(page).boundingBox())!;
    const stage = (await page.locator('#viewport').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(stage.x + 8 - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(stage.x + stage.width - 8 + 1);
    expect(Math.abs(box.x - (point.x + 14))).toBeLessThanOrEqual(2);
    // Any camera move takes it away.
    await page.mouse.wheel(0, 120);
    await expect(chip(page)).toBeHidden();
  });

  test('Escape dismisses the chip on the next app; the legacy one has no way to', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await hoverModel(page);
    await page.keyboard.press('Escape');
    if (testInfo.project.name === 'legacy') await expect(chip(page)).toBeVisible();
    else await expect(chip(page)).toBeHidden(); // g1-hover-chip-dismiss.md, WCAG 1.4.13
  });

  test('the navigation hint retires for good at the first gesture on the model', async ({
    app,
  }) => {
    const { page } = app;
    await expect(help(page)).toHaveText('Drag to rotate · Scroll to zoom · Click to inspect');
    await expect(help(page)).not.toHaveAttribute('data-dismissed', 'true');
    const box = (await page.locator('#viewport canvas').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await expect(help(page)).toHaveAttribute('data-dismissed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('planum.stage-hint'))).toBe('retired');
    await page.reload();
    await app.ready();
    await expect(help(page)).toHaveAttribute('data-dismissed', 'true');
  });

  test('the keyboard hint and the focus ring appear with keyboard focus on the model', async ({
    app,
  }) => {
    const { page } = app;
    const focusHint = page.locator('#viewport-focus-hint');
    await expect(focusHint).toHaveCSS('opacity', '0');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('CANVAS');
    await expect(focusHint).toHaveCSS('opacity', '1');
    await expect(focusHint).toHaveText('3D view · Arrow keys rotate · + − zoom');
    // The ring runs round the visible rectangle (--vis-*), 2 px wide.
    const ring = await page.evaluate(() => {
      const host = document.getElementById('viewport')!;
      const after = getComputedStyle(host, '::after');
      const vars = getComputedStyle(host);
      return {
        width: after.borderTopWidth,
        inset: [after.top, after.right, after.bottom, after.left],
        vis: ['top', 'right', 'bottom', 'left'].map((edge) =>
          vars.getPropertyValue(`--vis-${edge}`),
        ),
      };
    });
    expect(ring.width).toBe('2px');
    expect(ring.inset).toEqual(ring.vis.map((value) => value.trim()));
  });

  test('reduced motion leaves the markings only an opacity transition', async ({ app }) => {
    const { page } = app;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const selector of ['#orientation', '#scale-bar']) {
      await expect(page.locator(selector)).toHaveCSS('transition-property', 'opacity');
    }
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the ring and the overlays follow the visible rectangle, and are accessible', async ({
    app,
  }) => {
    await app.gotoHash();
    await app.ready();
    const { page } = app;
    await expect(page.locator('#orientation')).toBeVisible();
    // The sheet covers the lower canvas: the visible rectangle is not the whole canvas.
    await expect
      .poll(() =>
        page.evaluate(() =>
          parseFloat(
            getComputedStyle(document.getElementById('viewport')!).getPropertyValue('--vis-bottom'),
          ),
        ),
      )
      .toBeGreaterThan(0);
    await app.expectAccessible('stage-overlay');
  });
});

test.describe('on a touch device', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test('the hint names touch gestures on the next app only', async ({ app }, testInfo) => {
    const { page } = app;
    await app.gotoHash();
    await app.ready();
    if (testInfo.project.name === 'legacy') {
      await expect(help(page)).toHaveText('Drag to rotate · Scroll to zoom · Click to inspect');
    } else {
      // g1-touch-hints.md, conductor decision 21
      await expect(help(page)).toHaveText('Drag to rotate · Pinch to zoom · Tap to inspect');
    }
  });
});
