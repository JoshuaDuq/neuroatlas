// A1: the anatomy tree and its visibility eyes, run on both apps. Role and name locators match the
// legacy `tree`/`treeitem` and the next `treegrid`/`row`; each difference between them cites its
// deviation record in docs/decisions/deviations/ (a1-*). The aria snapshots are the legacy baseline.
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import enabled from './enabled/panels.ts';

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name === 'next' && !enabled, 'the panels region is not integrated');
});

const tree = (page: Page) =>
  page
    .getByRole('tree', { name: /^(Browse anatomy|Parcourir l’anatomie)$/ })
    .or(page.getByRole('treegrid', { name: /^(Browse anatomy|Parcourir l’anatomie)$/ }));
/** A group or region row: a legacy `treeitem`, a next `row`. */
const rowNamed = (page: Page, name: string | RegExp) =>
  tree(page).getByRole('treeitem', { name }).or(tree(page).getByRole('row', { name }));
const eye = (page: Page, name: string | RegExp) =>
  tree(page).getByRole('button', { name, exact: typeof name === 'string' });
const isNext = () => test.info().project.name === 'next';
const focusedName = (page: Page) =>
  page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');

async function openFrontal(page: Page) {
  const frontal = rowNamed(page, /^Frontal, \d+ regions$/);
  await frontal.focus();
  await page.keyboard.press('Enter');
  await expect(frontal).toHaveAttribute('aria-expanded', 'true');
  return frontal;
}

test.describe('anatomy tree', () => {
  test.beforeEach(async ({ app }) => {
    await app.page.setViewportSize({ width: 1280, height: 800 });
    await app.gotoHash();
    await app.ready();
  });

  test('legacy baseline: sections of groups, each with a count and an eye per side', async ({
    app,
  }) => {
    const { page } = app;
    if (isNext()) {
      // a1-treegrid-structure: a treegrid whose section headings are rows.
      await expect(rowNamed(page, /^Cortex/)).toBeVisible();
      await expect(rowNamed(page, /^Subcortical/)).toBeVisible();
      await expect(rowNamed(page, /^Cut labels only/)).toBeVisible();
    } else {
      await expect(tree(page)).toMatchAriaSnapshot(`
        - tree "Browse anatomy":
          - group "Cortex":
            - treeitem "Central, 6 regions" [level=1]:
              - text: Central 6
              - button "Hide Central, left"
              - button "Hide Central, right"
          - group "Subcortical":
            - treeitem "Cerebellum, 31 regions" [level=1]:
              - text: Cerebellum 31
              - button "Hide Cerebellum, midline"
              - button "Hide Cerebellum, left"
              - button "Hide Cerebellum, right"
          - group "Cut labels only"
      `);
    }
    const frontal = rowNamed(page, /^Frontal, \d+ regions$/);
    await expect(frontal).toHaveAttribute('aria-expanded', 'false');
    await expect(frontal).toHaveAttribute('aria-level', '1');
    await expect(eye(page, 'Hide Frontal, left')).toBeVisible();
    await expect(eye(page, 'Hide Frontal, right')).toBeVisible();
    await expect(eye(page, 'Hide Cerebellum, midline')).toBeVisible();
  });

  test('legacy baseline: an open group lists its regions at level 2, each named with its side', async ({
    app,
  }) => {
    const { page } = app;
    await openFrontal(page);
    const region = rowNamed(page, 'Middle frontal gyrus, left');
    await expect(region).toHaveAttribute('aria-level', '2');
    await expect(region).toHaveAttribute('aria-selected', 'false');
    await expect(eye(page, 'Hide Middle frontal gyrus, left')).toBeVisible();
    if (!isNext()) {
      await expect(tree(page)).toMatchAriaSnapshot(`
        - treeitem "Frontal, 38 regions" [expanded] [level=1]:
          - group:
            - treeitem "Frontomarginal gyrus and sulcus, left" [level=2]:
              - text: Frontomarginal gyrus and sulcus
              - button "Hide Frontomarginal gyrus and sulcus, left"
      `);
    }
  });

  test('arrows: Right opens a group and then goes to its eyes; Left comes back', async ({
    app,
  }) => {
    const { page } = app;
    const frontal = rowNamed(page, /^Frontal, \d+ regions$/);
    await frontal.focus();
    await page.keyboard.press('ArrowRight');
    await expect(frontal).toHaveAttribute('aria-expanded', 'true');
    await expect(frontal).toBeFocused();
    if (isNext()) {
      // a1-treegrid-structure: Right on an open group goes to its first cell, as on a leaf; legacy
      // went to the first child (docs/decisions/deviations/u7-treegrid-keys.md).
      await page.keyboard.press('ArrowRight');
      expect(await focusedName(page)).toBe('Hide Frontal, left');
      await page.keyboard.press('ArrowRight');
      expect(await focusedName(page)).toBe('Hide Frontal, right');
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowLeft');
      await expect(frontal).toBeFocused();
    } else {
      await page.keyboard.press('ArrowRight');
      await expect(rowNamed(page, 'Frontomarginal gyrus and sulcus, left')).toBeFocused();
    }
    await page.keyboard.press('ArrowLeft');
    await frontal.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(frontal).toHaveAttribute('aria-expanded', 'false');
  });

  test('a region’s Right goes to its eye, Escape returns to the row, Up and Down walk rows', async ({
    app,
  }) => {
    const { page } = app;
    await openFrontal(page);
    const first = rowNamed(page, 'Frontomarginal gyrus and sulcus, left');
    const second = rowNamed(page, 'Frontomarginal gyrus and sulcus, right');
    await first.focus();
    await page.keyboard.press('ArrowRight');
    expect(await focusedName(page)).toBe('Hide Frontomarginal gyrus and sulcus, left');
    await page.keyboard.press('Escape');
    await expect(first).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(second).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(first).toBeFocused();
    await page.keyboard.press('End');
    await expect(tree(page).locator(':focus')).toHaveAttribute('aria-level', '1');
    await page.keyboard.press('Home');
    if (isNext()) await expect(rowNamed(page, /^Cortex/)).toBeFocused();
    else await expect(rowNamed(page, /^Central, \d+ regions$/)).toBeFocused();
  });

  test('the tree is one Tab stop', async ({ app }) => {
    const { page } = app;
    await openFrontal(page);
    const stops = await tree(page).evaluate(
      (root) =>
        [...root.querySelectorAll<HTMLElement>('[role="treeitem"], [role="row"], button')].filter(
          (element) => element.tabIndex === 0,
        ).length,
    );
    expect(stops).toBe(1);
  });

  test('Enter chooses a region: it is in the link, and the one aria-selected row when the list returns', async ({
    app,
  }) => {
    const { page } = app;
    await openFrontal(page);
    const region = rowNamed(page, 'Middle frontal gyrus, left');
    await region.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => app.hash()).toContain('region=');
    // Choosing a region drills in to its detail; Back returns to the list with the choice marked.
    await page.getByRole('button', { name: 'Back to Anatomy' }).click();
    await expect(region).toHaveAttribute('aria-selected', 'true');
    await expect(tree(page).locator('[aria-selected="true"]')).toHaveCount(1);
  });

  test('V presses a region’s eye without moving focus, and goes to the first eye of a group', async ({
    app,
  }) => {
    const { page } = app;
    await openFrontal(page);
    const region = rowNamed(page, 'Middle frontal gyrus, left');
    await region.focus();
    await page.keyboard.press('v');
    await expect(eye(page, 'Show Middle frontal gyrus, left')).toBeVisible();
    await expect(region).toBeFocused();
    await page.keyboard.press('V');
    await expect(eye(page, 'Hide Middle frontal gyrus, left')).toBeVisible();
    await rowNamed(page, /^Frontal, \d+ regions$/).focus();
    await page.keyboard.press('v');
    expect(await focusedName(page)).toBe('Hide Frontal, left');
    await expect(eye(page, 'Hide Frontal, left')).toBeVisible();
  });

  test('a group’s side reads as partly hidden once one of its regions is hidden', async ({
    app,
  }) => {
    const { page } = app;
    await openFrontal(page);
    await eye(page, 'Hide Middle frontal gyrus, left').click();
    const partial = eye(page, /^Hide Frontal, left/);
    await expect(partial).toHaveAttribute('data-partial', 'true');
    if (isNext()) {
      // a1-partial-state-name: the partial state is in the name, not only in the tooltip.
      await expect(partial).toHaveAccessibleName('Hide Frontal, left, partially hidden');
    } else {
      await expect(partial).toHaveAccessibleName('Hide Frontal, left');
    }
    await eye(page, 'Show Middle frontal gyrus, left').click();
    await expect(eye(page, 'Hide Frontal, left')).toHaveAttribute('data-partial', 'false');
  });

  test('hiding by eye is announced', async ({ app }) => {
    // a1-eye-announcement: the tree writes no sentence of its own; S1 joins the part with the count
    // (K2). Until then next announces nothing here, so this waits for it.
    test.fixme(isNext(), 'the part sentence with the count is K2 (a1-eye-announcement)');
    const { page } = app;
    await openFrontal(page);
    await eye(page, 'Hide Middle frontal gyrus, left').click();
    // Legacy speaks the count at once (app.js:1676).
    await expect(page.locator('#announcer')).toHaveText('1 part hidden');
  });

  test('Expand all opens every group and becomes Collapse all', async ({ app }) => {
    const { page } = app;
    const toggle = page.getByRole('button', { name: /^(Expand|Collapse) all$/ });
    await expect(toggle).toHaveText('Expand all');
    await toggle.click();
    await expect(toggle).toHaveText('Collapse all');
    await expect(tree(page).locator('[aria-expanded="false"]')).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveText('Expand all');
    await expect(tree(page).locator('[aria-expanded="true"]')).toHaveCount(0);
  });

  test('a hemisphere that is hidden says so on the section, and on each of its rows', async ({
    app,
  }) => {
    const { page } = app;
    await openFrontal(page);
    await page.keyboard.press('Escape');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('h');
    await expect(tree(page).getByText('Hemisphere hidden').first()).toBeVisible();
    await expect(
      rowNamed(page, 'Middle frontal gyrus, right: Hemisphere hidden. Activate to reveal.'),
    ).toBeVisible();
    if (isNext()) {
      // a1-section-reason-name: the caption is in the section row's name.
      await expect(rowNamed(page, /^Cortex \(Hemisphere hidden/)).toBeVisible();
    }
    const hidden = rowNamed(
      page,
      'Middle frontal gyrus, right: Hemisphere hidden. Activate to reveal.',
    );
    // a1-drop-title: legacy duplicates the name in a native title; next shows it in U5's tooltip.
    if (isNext()) {
      await expect(hidden).not.toHaveAttribute('title', /.+/);
      await expect(hidden.locator('.row-main')).toHaveAttribute(
        'data-tooltip',
        /Hemisphere hidden/,
      );
    } else {
      await expect(hidden).toHaveAttribute('title', /.+/);
      // The legacy baseline of a section with a hidden hemisphere.
      await expect(tree(page)).toMatchAriaSnapshot(`
        - tree "Browse anatomy":
          - group "Cortex":
            - treeitem "Frontal, 38 regions" [expanded] [level=1]:
              - group:
                - treeitem /Middle frontal gyrus, right/ [level=2]
      `);
    }
  });

  test('a part that is hidden: its eye offers Show, and its group is partly hidden', async ({
    app,
  }) => {
    const { page } = app;
    await openFrontal(page);
    await eye(page, 'Hide Middle frontal gyrus, left').click();
    await expect(eye(page, 'Show Middle frontal gyrus, left')).toBeVisible();
    if (!isNext()) {
      await expect(tree(page)).toMatchAriaSnapshot(`
        - tree "Browse anatomy":
          - group "Cortex":
            - treeitem "Frontal, 38 regions" [expanded] [level=1]:
              - button "Hide Frontal, left"
              - group:
                - treeitem /Middle frontal gyrus, left/ [level=2]
      `);
    }
  });

  test('French: the names, the counts and the eyes', async ({ app }) => {
    const { page } = app;
    await app.gotoHash({ lang: 'fr' });
    await app.ready();
    await expect(tree(page)).toHaveAccessibleName('Parcourir l’anatomie');
    await expect(rowNamed(page, /^Frontal, \d+ régions$/)).toBeVisible();
    await expect(eye(page, 'Masquer Frontal, gauche')).toBeVisible();
    await expect(eye(page, 'Masquer Frontal, droite')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Tout (déplier|replier)$/ })).toBeVisible();
    if (!isNext()) {
      await expect(tree(page)).toMatchAriaSnapshot(`
        - tree "Parcourir l’anatomie":
          - group "Cortex":
            - treeitem "Frontal, 38 régions" [level=1]:
              - button "Masquer Frontal, gauche"
              - button "Masquer Frontal, droite"
      `);
    }
  });

  test('targets: each eye is at least 24 px square', async ({ app }) => {
    const { page } = app;
    await openFrontal(page);
    for (const name of [
      'Hide Frontal, left',
      'Hide Frontal, right',
      'Hide Middle frontal gyrus, left',
      'Hide Cerebellum, midline',
    ]) {
      const box = (await eye(page, name).boundingBox())!;
      expect(box.width, name).toBeGreaterThanOrEqual(24);
      expect(box.height, name).toBeGreaterThanOrEqual(24);
    }
  });

  test('the tree has no WCAG 2.2 AA violations (the legacy baseline is recorded for information)', async ({
    app,
  }) => {
    await openFrontal(app.page);
    await app.expectAccessible('anatomy-tree');
  });

  test.describe('coarse pointer', () => {
    test.use({ hasTouch: true });

    test('each eye is 44 px square', async ({ app }) => {
      const { page } = app;
      await openFrontal(page);
      await expect
        .poll(() => page.evaluate(() => matchMedia('(pointer: coarse)').matches))
        .toBe(true);
      for (const name of [
        'Hide Frontal, left',
        'Hide Frontal, right',
        'Hide Middle frontal gyrus, left',
        'Hide Cerebellum, midline',
      ]) {
        const box = (await eye(page, name).boundingBox())!;
        expect(box.width, name).toBeGreaterThanOrEqual(44);
        expect(box.height, name).toBeGreaterThanOrEqual(44);
      }
    });
  });
});
