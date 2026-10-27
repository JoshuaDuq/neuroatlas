// G2: the stage dock and its View and Display popovers, run on both apps through role and name locators.
// Differences between the apps each cite a deviation record in docs/decisions/deviations/ (g2-dock-toolbar,
// g2-orbit-step-buttons, u3-segmented-controls). The tract reference (Section and Display hidden) and every
// keyboard path are proved by the component tests (src/features/stage/Dock.svelte.test.ts).
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import enabled from './enabled/stage.ts';

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name === 'next' && !enabled, 'the next stage region is not enabled');
});

// Both apps open on the held oblique view, so the tool is "Anatomical view: Oblique" until the camera moves.
const VIEW = /^Anatomical view/;
const tool = (page: Page, name: string | RegExp) =>
  page.getByRole('button', typeof name === 'string' ? { name, exact: true } : { name });
const dialog = (page: Page, name: string) => page.getByRole('dialog', { name, exact: true });
const canvas = (page: Page) => page.locator('#viewport canvas');

test.describe('stage dock', () => {
  test.beforeEach(async ({ app }) => {
    await app.page.setViewportSize({ width: 1280, height: 800 });
    await app.gotoHash();
    await app.ready();
  });

  test('has three tools that open dialogs; only the next app makes them a labelled toolbar', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    for (const name of [VIEW, 'Section', 'Display']) {
      await expect(tool(page, name)).toHaveAttribute('aria-haspopup', 'dialog');
      await expect(tool(page, name)).toHaveAttribute('aria-expanded', 'false');
    }
    const toolbar = page.getByRole('toolbar', { name: '3D viewer tools' });
    // g2-dock-toolbar.md: the legacy dock has no toolbar role, so each tool is its own Tab stop.
    if (testInfo.project.name === 'legacy') await expect(toolbar).toHaveCount(0);
    else await expect(toolbar.getByRole('button')).toHaveCount(3);
  });

  test('one popover at a time, and Escape closes it with focus back on its tool', async ({
    app,
  }) => {
    const { page } = app;
    await tool(page, 'Display').click();
    await expect(dialog(page, 'Display')).toBeVisible();
    await tool(page, VIEW).click();
    await expect(dialog(page, 'Anatomical view')).toBeVisible();
    await expect(dialog(page, 'Display')).toBeHidden();
    await expect(tool(page, 'Display')).toHaveAttribute('aria-expanded', 'false');

    await page.keyboard.press('Escape');
    await expect(dialog(page, 'Anatomical view')).toBeHidden();
    await expect(tool(page, VIEW)).toBeFocused();
  });

  test('a preset names the view on the tool until the camera is turned off it', async ({ app }) => {
    const { page } = app;
    await tool(page, VIEW).click();
    await page.getByRole('button', { name: 'Left', exact: true }).click();
    await expect(dialog(page, 'Anatomical view')).toBeHidden();
    await expect(tool(page, 'Anatomical view: Left')).toBeFocused();

    // An arrow key on the focused model turns it away from the named view.
    await canvas(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect(tool(page, 'Anatomical view')).toBeVisible();
    await tool(page, 'Anatomical view').click();
    await expect(page.getByRole('button', { name: 'Left', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('the turn buttons are the single-pointer way to orbit, on the next app only', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await tool(page, VIEW).click();
    const group = page.getByRole('group', { name: 'Turn the model' });
    // g2-orbit-step-buttons.md, WCAG 2.5.7.
    if (testInfo.project.name === 'legacy') {
      await expect(group).toHaveCount(0);
      return;
    }
    await expect(group.getByRole('button')).toHaveCount(4);
    await page.keyboard.press('Escape');

    // A preset is held; one step turns the camera off it, the popover stays open for the next step.
    await tool(page, VIEW).click();
    await page.getByRole('button', { name: 'Anterior', exact: true }).click();
    await expect(tool(page, 'Anatomical view: Anterior')).toBeVisible();
    await tool(page, 'Anatomical view: Anterior').click();
    await page.getByRole('button', { name: 'Turn left', exact: true }).click();
    await expect(tool(page, 'Anatomical view')).toBeVisible();
    await expect(dialog(page, 'Anatomical view')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Turn left', exact: true })).toBeFocused();
  });

  test('Display: hemisphere, cortex, opacity and the other layers', async ({ app }, testInfo) => {
    const { page } = app;
    await tool(page, 'Display').click();
    const panel = dialog(page, 'Display');
    // u3-segmented-controls.md: radios on the next app, pressed buttons on the legacy one.
    const choice = testInfo.project.name === 'legacy' ? 'button' : 'radio';
    const hemisphere = page.getByRole(choice === 'radio' ? 'radiogroup' : 'group', {
      name: 'Hemisphere',
    });
    await expect(hemisphere.getByRole(choice)).toHaveCount(3);
    await hemisphere.getByRole(choice, { name: 'Left', exact: true }).click();
    await expect.poll(() => app.hash()).toMatch(/(^|&)hemi=left(&|$)/);

    const cortex = panel.getByRole('checkbox', { name: 'Show cortex' });
    const opacity = panel.getByRole('slider', { name: /Cortex opacity/ });
    await expect(opacity).toHaveAttribute('aria-valuetext', '100%');
    await cortex.uncheck();
    // The slider goes with the cortex rather than greying.
    await expect(opacity).toHaveCount(0);
    await cortex.check();
    await expect(opacity).toHaveCount(1);
    await expect(panel.getByRole('checkbox', { name: 'Show internal anatomy' })).toBeVisible();
    // The popover stays open while the display changes.
    await expect(dialog(page, 'Display')).toBeVisible();
  });

  test('Reset view closes the popover and returns focus to the tool', async ({ app }) => {
    const { page } = app;
    await tool(page, VIEW).click();
    await page.getByRole('button', { name: 'Reset view', exact: true }).click();
    await expect(dialog(page, 'Anatomical view')).toBeHidden();
    await expect(page.getByRole('button', { name: /^Anatomical view/ })).toBeFocused();
  });

  test('the popover is accessible with the Display tool open', async ({ app }) => {
    await tool(app.page, 'Display').click();
    await expect(dialog(app.page, 'Display')).toBeVisible();
    await app.expectAccessible('dock');
  });

  test('French words the tools and the popover', async ({ app }) => {
    const { page } = app;
    await app.gotoHash({ lang: 'fr' });
    await app.ready();
    await expect(tool(page, 'Coupe')).toBeVisible();
    await tool(page, 'Affichage').click();
    await expect(dialog(page, 'Affichage')).toBeVisible();
    await expect(
      dialog(page, 'Affichage').getByRole('slider', { name: /Opacité du cortex/ }),
    ).toHaveAttribute('aria-valuetext', /^100\s%$/u);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the popover fills the stage between its gutters, inside the screen', async ({ app }) => {
    const { page } = app;
    await app.gotoHash();
    await app.ready();
    await tool(page, 'Display').click();
    const box = (await dialog(page, 'Display').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.width).toBeGreaterThan(272);
  });
});
