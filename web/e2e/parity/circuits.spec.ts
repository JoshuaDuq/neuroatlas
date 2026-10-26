// X3: the Circuits tab (viewer/ui/panels/circuits.js), run on both apps with role and name locators.
// Each difference between them cites its deviation record in web/docs/decisions/deviations/ or
// decision 40 on #4. The panels region is gated on `next` until I1 mounts it.
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures.ts';
import panelsEnabled from './enabled/panels.ts';

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name === 'next' && !panelsEnabled, 'the panels region is not mounted');
});

type App = Parameters<Parameters<typeof test>[2]>[0]['app'];

const circuit = (page: Page, name: string | RegExp) => page.getByRole('button', { name });
// The landmark's title: `#circuit-title` on legacy, `[data-circuit-title]` on next.
const title = (page: Page) => page.locator('#circuit-title, [data-circuit-title]');
const stepper = (page: Page) => page.getByRole('group', { name: /^(Landmarks|Repères)$/ });
const next = (page: Page) => page.getByRole('button', { name: /^(Next landmark|Repère suivant)$/ });
const previous = (page: Page) =>
  page.getByRole('button', { name: /^(Previous landmark|Repère précédent)$/ });

async function openCircuits(app: App, state = {}) {
  await app.gotoHash({ tab: 'circuits', ...state });
  await app.ready();
}

test.describe('the list', () => {
  test.beforeEach(async ({ app }) => {
    await app.page.setViewportSize({ width: 1280, height: 800 });
  });

  test('offers each circuit with its landmark count and the scope of the list', async ({ app }) => {
    const { page } = app;
    await openCircuits(app);
    await expect(circuit(page, /^Visual pathway\s*,\s*4 landmarks$/)).toBeVisible();
    await expect(circuit(page, /^Memory landmarks\s*,\s*5 landmarks$/)).toBeVisible();
    await expect(page.getByText(/^\d+ guided circuits · \d+ landmarks$/)).toBeVisible();
  });

  test('a French interface names the rows and the scope in French', async ({ app }) => {
    const { page } = app;
    await openCircuits(app, { lang: 'fr' });
    await expect(circuit(page, /^Voie visuelle\s*,\s*4 repères$/)).toBeVisible();
    await expect(page.getByText(/^\d+ parcours guidés · \d+ repères$/)).toBeVisible();
  });

  test('ArrowDown and ArrowUp walk the rows without wrapping, and every row is a Tab stop', async ({
    app,
  }) => {
    const { page } = app;
    await openCircuits(app);
    const first = circuit(page, /^Visual pathway/);
    await first.focus();
    await page.keyboard.press('ArrowUp');
    await expect(first).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(circuit(page, /^Memory landmarks/)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(circuit(page, /^Basal ganglia motor loops/)).toBeFocused();
  });
});

test.describe('a lesson', () => {
  test.beforeEach(async ({ app }) => {
    await app.page.setViewportSize({ width: 1280, height: 800 });
  });

  test('opening a circuit marks it, shows its first landmark and focuses its title', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await openCircuits(app);
    await circuit(page, /^Visual pathway/).click();
    // The list is behind the lesson now, so the row is found by its data attribute.
    const row = page.locator('[data-circuit="vision"]');
    await expect(title(page)).toHaveText('Optic chiasm');
    await expect(title(page)).toBeFocused();
    // The open circuit is `aria-current` on next, `aria-pressed` on legacy (deviation x3-current-circuit).
    if (testInfo.project.name === 'legacy')
      await expect(row).toHaveAttribute('aria-pressed', 'true');
    else await expect(row).toHaveAttribute('aria-current', 'true');
    await expect(stepper(page)).toContainText('1 of 4');
    await expect(previous(page)).toBeHidden();
    await expect(next(page)).toBeVisible();
    await app.waitForCameraIdle();
    await expect.poll(() => app.hash()).toContain('circuit=vision');
  });

  test('Next moves on, keeps focus on Next, and Previous takes it at the last landmark', async ({
    app,
  }) => {
    const { page } = app;
    await openCircuits(app, { circuit: 'hearing', step: '2' });
    await expect(stepper(page)).toContainText('2 of 3');
    await next(page).focus();
    await page.keyboard.press('Enter');
    await expect(stepper(page)).toContainText('3 of 3');
    await expect(next(page)).toBeHidden();
    await expect(previous(page)).toBeFocused();
    await app.waitForCameraIdle();
    // The link counts landmarks from one.
    await expect.poll(() => app.hash()).toContain('step=3');
  });

  test('the sequence marks the current landmark with aria-current=step and the seen ones as seen', async ({
    app,
  }) => {
    const { page } = app;
    await openCircuits(app, { circuit: 'hearing' });
    const sequence = page.getByRole('list', { name: /^(Landmarks|Repères)$/ });
    await expect(sequence.getByRole('button')).toHaveCount(3);
    await expect(sequence.locator('[aria-current="step"]')).toHaveCount(1);
    await next(page).click();
    await expect(sequence.getByRole('button').first()).toHaveAccessibleName(/, seen$/);
    await expect(sequence.getByRole('button').nth(1)).toHaveAttribute('aria-current', 'step');
  });

  test('a landmark in the sequence opens it and focuses the title', async ({ app }) => {
    const { page } = app;
    await openCircuits(app, { circuit: 'hearing' });
    const sequence = page.getByRole('list', { name: /^(Landmarks|Repères)$/ });
    await sequence.getByRole('button').nth(2).click();
    await expect(stepper(page)).toContainText('3 of 3');
    await expect(title(page)).toBeFocused();
  });

  test('the notes are four disclosures; Sources links open in a new tab', async ({ app }) => {
    const { page } = app;
    await openCircuits(app, { circuit: 'hearing' });
    for (const name of [
      'Connections and scope',
      'What this atlas shows',
      'Clinical context',
      'Sources',
    ]) {
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
    await page.getByText('Sources', { exact: true }).click();
    const sources = page.locator('details', { has: page.getByText('Sources', { exact: true }) });
    const links = sources.locator('a[target="_blank"][rel~="noreferrer"]');
    await expect(links.first()).toBeVisible();
    await expect(page.getByText(/^Content checked: /)).toBeVisible();
  });

  test('a note the reader opened stays open on the next landmark (deviation x3-disclosure-state)', async ({
    app,
  }, testInfo) => {
    const { page } = app;
    await openCircuits(app, { circuit: 'hearing' });
    await page.getByText('Sources', { exact: true }).click();
    const note = page.locator('details', { has: page.getByText('Sources', { exact: true }) });
    await expect(note).toHaveAttribute('open', '');
    await next(page).click();
    await expect(stepper(page)).toContainText('2 of 3');
    if (testInfo.project.name === 'legacy') await expect(note).not.toHaveAttribute('open', '');
    else await expect(note).toHaveAttribute('open', '');
  });

  test('Open deficit evidence goes to the Deficits tab', async ({ app }) => {
    const { page } = app;
    await openCircuits(app, { circuit: 'hearing' });
    await page.getByText('Clinical context', { exact: true }).click();
    await page.getByRole('button', { name: 'Open deficit evidence' }).click();
    await expect.poll(() => app.hash()).toContain('tab=deficits');
  });
});

test.describe('related circuits', () => {
  test('a landmark’s region links to its circuits, and a row opens that lesson at that landmark', async ({
    app,
  }) => {
    const { page } = app;
    await app.page.setViewportSize({ width: 1280, height: 800 });
    await app.gotoHash({ tab: 'anatomy', region: 'learning:midline:optic-chiasm' });
    await app.ready();
    await expect(page.getByRole('heading', { level: 3, name: 'In guided circuits' })).toBeVisible();
    // The accessible name is "Name , Landmark 1 of 4" on legacy (flex items gain spaces) and "Name 1 of 4, Landmark"
    // on next (deviation x3-label-in-name).
    const link = page.getByRole('button', { name: /^Visual pathway\s*,?\s*(Landmark )?1 of 4/ });
    await link.click();
    await expect.poll(() => app.hash()).toContain('tab=circuits');
    await expect(title(page)).toHaveText('Optic chiasm');
    await expect(title(page)).toBeFocused();
  });
});

test.describe('accessibility', () => {
  test('axe: the list and an open lesson with its notes', async ({ app }) => {
    test.setTimeout(240_000);
    const { page } = app;
    await page.setViewportSize({ width: 1280, height: 800 });
    await openCircuits(app, { circuit: 'vision' });
    await expect(title(page)).toHaveText('Optic chiasm');
    await page.getByText('Sources', { exact: true }).click();
    await app.expectAccessible('circuits');
  });

  test('a phone width does not scroll the page sideways with a lesson open', async ({ app }) => {
    const { page } = app;
    await page.setViewportSize({ width: 390, height: 844 });
    await openCircuits(app, { circuit: 'cerebellar', lang: 'fr' });
    await expect(title(page)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});
