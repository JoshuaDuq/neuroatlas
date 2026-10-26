// The masthead against the APG Disclosure and Radio Group tables and the legacy header.js cases
// (header.test.js:124-169, chrome.contract.test.js:305-376), as behaviour in a real browser.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import { expectAxeClean, expectAxeCleanHere, withMedia } from '../../lib/ui/a11y-test-support.ts';
import Fixture from './masthead-test-support.svelte';

const button = (name: string) => page.getByRole('button', { name, exact: true });
const radio = (name: string) => page.getByRole('radio', { name, exact: true });
const el = (locator: { element(): Element }) => locator.element() as HTMLElement;
const more = () => button('More settings');
const panelOpen = () => el(more()).getAttribute('aria-expanded') === 'true';
const announced = () => document.getElementById('announcer')!.textContent;
const nameOf = (element: Element) =>
  element.getAttribute('aria-label') ?? element.textContent!.replace(/\s+/g, ' ').trim();
const checkedNames = () =>
  [...document.querySelectorAll('[role=radio][aria-checked=true]')].map(nameOf);

async function open() {
  await more().click();
  await expect.element(page.getByRole('radiogroup', { name: 'Language' })).toBeVisible();
}

// Vitest runs the page in an iframe without allowfullscreen, where the API reports itself off.
const setFullscreenEnabled = (value: boolean) =>
  Object.defineProperty(document, 'fullscreenEnabled', { value, configurable: true });

beforeEach(async () => {
  setFullscreenEnabled(true);
  await page.viewport(1280, 800);
});

afterEach(() => {
  cleanup();
  delete (document as { fullscreenEnabled?: boolean }).fullscreenEnabled;
  delete document.documentElement.dataset.singleKeys;
});

describe('Masthead', () => {
  test('the skip link is the first Tab stop and hands the model its focus', async () => {
    const calls: string[] = [];
    await render(Fixture, { calls });
    await userEvent.keyboard('{Tab}');
    const skip = page.getByRole('link', { name: 'Skip to model' });
    expect(document.activeElement).toBe(el(skip));
    expect(el(skip).getAttribute('href')).toBe('#viewport');
    await userEvent.keyboard('{Enter}');
    expect(calls).toEqual(['skip']);
    expect(location.hash).toBe('');
  });

  test('names: a banner, the Planum h1, three named icon buttons with matching tooltips', async () => {
    await render(Fixture);
    await expect.element(page.getByRole('banner')).toBeVisible();
    await expect.element(page.getByRole('heading', { level: 1, name: 'Planum' })).toBeVisible();
    for (const name of ['Full screen', 'Save image (PNG)', 'More settings']) {
      const control = el(button(name));
      expect(control.dataset.tooltip).toBe(name);
      expect(control.hasAttribute('title')).toBe(false);
      expect(control.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    }
  });

  test('Full screen and Save image are disabled until the anatomy is on screen; ⋯ is not', async () => {
    await render(Fixture, { ready: false });
    expect(el(button('Full screen')).hasAttribute('disabled')).toBe(true);
    expect(el(button('Save image (PNG)')).hasAttribute('disabled')).toBe(true);
    expect(el(more()).hasAttribute('disabled')).toBe(false);
  });

  test('the masthead is a region whose controls keep their own keys', async () => {
    await render(Fixture);
    await open();
    expect(document.querySelector('header')!.hasAttribute('data-own-keys')).toBe(true);
    for (const control of document.querySelectorAll(
      'header .icon-button, .settings-menu .menu-item, .settings-menu [role=radio]',
    )) {
      expect(control.closest('[data-own-keys]'), control.outerHTML).not.toBeNull();
    }
  });

  test('text at 200 % stays inside the skip link and the radios (WCAG 1.4.4, 1.4.12)', async () => {
    await render(Fixture);
    await open();
    document.documentElement.style.fontSize = '200%';
    const spacing = document.head.appendChild(document.createElement('style'));
    spacing.textContent =
      '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }';
    try {
      el(page.getByRole('link', { name: 'Skip to model' })).focus();
      const spilling = [
        ...document.querySelectorAll<HTMLElement>('.skip-link, .settings-menu [role=radio]'),
      ].filter((control) => {
        const text = document.createRange();
        text.selectNodeContents(control);
        const box = control.getBoundingClientRect();
        const inner = text.getBoundingClientRect();
        return inner.height > box.height + 0.5;
      });
      expect(spilling.map((control) => control.outerHTML)).toEqual([]);
    } finally {
      spacing.remove();
      document.documentElement.style.fontSize = '';
    }
  });

  test('Full screen and Save image only emit', async () => {
    const calls: string[] = [];
    await render(Fixture, { calls });
    await button('Full screen').click();
    await button('Save image (PNG)').click();
    expect(calls).toEqual(['fullscreen', 'snapshot']);
  });

  test('without document.fullscreenEnabled neither Full screen control is offered', async () => {
    setFullscreenEnabled(false);
    await render(Fixture);
    await open();
    expect(page.getByText('Full screen').elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: 'Full screen' }).elements()).toHaveLength(0);
  });

  test('the fullscreen labels follow the state', async () => {
    const view = await render(Fixture, { fullscreen: true });
    await expect.element(button('Exit full screen')).toBeVisible();
    expect(el(button('Exit full screen')).dataset.tooltip).toBe('Exit full screen');
    await view.rerender({ fullscreen: false });
    await expect.element(button('Full screen')).toBeVisible();
  });

  test('the panel is a disclosure: aria-expanded and aria-controls, no menu role', async () => {
    await render(Fixture);
    const trigger = el(more());
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.hasAttribute('aria-haspopup')).toBe(false);
    await open();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const controlled = document.getElementById(trigger.getAttribute('aria-controls')!)!;
    expect(controlled.querySelector('[role=radiogroup]')).not.toBeNull();
    expect(document.querySelector('[role=menu], [role=menuitem]')).toBeNull();
  });

  test('Enter and Space toggle it and focus stays on ⋯; a pointer open animates', async () => {
    await render(Fixture);
    el(more()).focus();
    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByRole('radiogroup', { name: 'Language' })).toBeVisible();
    expect(document.activeElement).toBe(el(more()));
    await userEvent.keyboard('{Enter}');
    expect(panelOpen()).toBe(false);
    await userEvent.keyboard(' ');
    expect(panelOpen()).toBe(true);
    await userEvent.keyboard(' ');
    await more().click();
    expect(document.querySelector('.settings-menu')!.hasAttribute('data-instant')).toBe(false);
  });

  test('a keyboard open carries no entry animation', async () => {
    await render(Fixture);
    el(more()).focus();
    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByRole('radiogroup', { name: 'Language' })).toBeVisible();
    expect(document.querySelector('.settings-menu')!.hasAttribute('data-instant')).toBe(true);
  });

  test('three radio groups, each one Tab stop on its checked radio, with lang on English and Français', async () => {
    await render(Fixture);
    await open();
    for (const group of ['Language', 'Theme', 'Single-key shortcuts']) {
      await expect.element(page.getByRole('radiogroup', { name: group })).toBeVisible();
    }
    expect(checkedNames()).toEqual(['English', 'System', 'On']);
    expect(el(radio('English')).getAttribute('lang')).toBe('en');
    expect(el(radio('Français')).getAttribute('lang')).toBe('fr');
    expect(el(radio('English')).tabIndex).toBe(0);
    expect(el(radio('Français')).tabIndex).toBe(-1);
    // WCAG 2.5.3: the drawn text is in the name.
    expect(el(radio('English')).textContent!.trim().toLowerCase()).toBe('en');
  });

  test('Tab order inside the panel: language, theme, single keys, Keyboard shortcuts', async () => {
    await render(Fixture);
    el(more()).focus();
    await userEvent.keyboard('{Enter}');
    const order: string[] = [];
    for (let i = 0; i < 4; i++) {
      await userEvent.keyboard('{Tab}');
      order.push(nameOf(document.activeElement!));
    }
    expect(order.slice(0, 3)).toEqual(['English', 'System', 'On']);
    expect(order[3]).toMatch(/^Keyboard shortcuts/);
  });

  test('arrows move and select and wrap; a keyboard choice keeps the panel open', async () => {
    const calls: string[] = [];
    await render(Fixture, { calls });
    await open();
    el(radio('System')).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(el(radio('Light')));
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(document.activeElement).toBe(el(radio('System')));
    expect(calls).toEqual(['theme:light', 'theme:dark', 'theme:system']);
    expect(panelOpen()).toBe(true);
    await userEvent.keyboard('{ArrowLeft}');
    expect(checkedNames()).toContain('Dark');
    expect(panelOpen()).toBe(true);
  });

  test('a pointer choice applies it, closes the panel and focuses ⋯', async () => {
    const calls: string[] = [];
    await render(Fixture, { calls });
    await open();
    await radio('Dark').click();
    expect(calls).toEqual(['theme:dark']);
    await expect.poll(panelOpen).toBe(false);
    expect(document.activeElement).toBe(el(more()));
  });

  test('choosing the checked radio again does not call back', async () => {
    const calls: string[] = [];
    await render(Fixture, { calls });
    await open();
    await radio('English').click();
    expect(calls).toEqual([]);
  });

  test('every choice is announced in the language it leaves the page in', async () => {
    await render(Fixture);
    await open();
    el(radio('System')).focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(announced()).toBe('Theme: Dark');
    el(radio('On')).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(announced()).toBe('Single-key shortcuts: Off');
    expect(document.documentElement.dataset.singleKeys).toBe('off');
    el(radio('English')).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(announced()).toBe('Langue : Français');
    expect(document.documentElement.lang).toBe('fr');
    // The panel's own text follows.
    await expect.element(page.getByRole('radiogroup', { name: 'Langue' })).toBeVisible();
    await expect.element(radio('Sombre')).toBeVisible();
    await expect.element(radio('Non')).toBeVisible();
  });

  test('the System note is a permanent description and the tooltip text', async () => {
    await render(Fixture);
    await open();
    const system = el(radio('System'));
    expect(system.dataset.tooltip).toBe('Follow the device’s light or dark setting');
    const note = document.getElementById(system.getAttribute('aria-describedby')!)!;
    expect(note.textContent).toBe(system.dataset.tooltip);
  });

  test('the checked item holds its bold width', async () => {
    await render(Fixture);
    await open();
    expect(el(radio('Dark')).dataset.label).toBe('Dark');
    // Layout widths: the panel is still scaling in, which moves bounding boxes.
    const widths = () => ['System', 'Light', 'Dark'].map((name) => el(radio(name)).offsetWidth);
    const before = widths();
    el(radio('System')).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(widths()).toEqual(before);
  });

  test('Escape closes, focuses ⋯ and is marked handled, wherever focus is', async () => {
    await render(Fixture);
    await open();
    el(radio('Dark')).focus();
    let handled = false;
    const watch = (event: KeyboardEvent) => (handled = event.defaultPrevented);
    document.addEventListener('keydown', watch);
    await userEvent.keyboard('{Escape}');
    document.removeEventListener('keydown', watch);
    expect(handled).toBe(true);
    expect(panelOpen()).toBe(false);
    expect(document.activeElement).toBe(el(more()));
  });

  test('Tab out closes it without taking focus; an outside press closes it where the user pressed', async () => {
    await render(Fixture);
    await open();
    el(button('Keyboard shortcuts')).focus();
    await userEvent.keyboard('{Tab}');
    expect(panelOpen()).toBe(false);
    expect(document.activeElement).toBe(el(button('Canvas')));
    await open();
    await button('Canvas').click();
    expect(panelOpen()).toBe(false);
    expect(document.activeElement).toBe(el(button('Canvas')));
  });

  test('arrows on a command do not reach the page (the tree must not move)', async () => {
    await render(Fixture);
    await open();
    el(button('Keyboard shortcuts')).focus();
    let reached = false;
    const watch = (event: KeyboardEvent) => (reached = !event.defaultPrevented);
    document.addEventListener('keydown', watch);
    await userEvent.keyboard('{ArrowDown}');
    document.removeEventListener('keydown', watch);
    expect(reached).toBe(false);
  });

  test('Keyboard shortcuts closes the panel and acts with focus already on ⋯', async () => {
    const calls: string[] = [];
    await render(Fixture, { calls });
    await open();
    await button('Keyboard shortcuts').click();
    expect(calls).toEqual(['shortcuts:More settings']);
    expect(panelOpen()).toBe(false);
  });

  test('Provenance waits for the manifest', async () => {
    const view = await render(Fixture, { provenanceReady: false });
    await page.viewport(390, 844);
    await open();
    expect(page.getByRole('button', { name: 'Provenance' }).elements()).toHaveLength(0);
    await view.rerender({ provenanceReady: true });
    expect(el(button('Provenance')).getAttribute('aria-haspopup')).toBe('dialog');
  });

  test('opening the data popover closes the panel', async () => {
    await render(Fixture);
    await open();
    await button('Atlas and display settings').click();
    expect(panelOpen()).toBe(false);
  });

  test('phone: the menu offers Full screen and Provenance; the masthead hides its Full screen button', async () => {
    const calls: string[] = [];
    await render(Fixture, { calls });
    await page.viewport(390, 844);
    try {
      await open();
      const items = [...document.querySelectorAll<HTMLElement>('.settings-menu .menu-item')].map(
        (item) => item.textContent!.replace(/\s+/g, ' ').trim(),
      );
      expect(items).toEqual(['Full screen', 'Provenance', 'Keyboard shortcuts ?']);
      // The masthead's own button is display:none, so only the menu item is in the tree.
      expect(page.getByRole('button', { name: 'Full screen' }).elements()).toHaveLength(1);
      await button('Full screen').click();
      expect(calls).toEqual(['fullscreen']);
    } finally {
      await page.viewport(1280, 800);
    }
  });

  test('targets are at least 24 px', async () => {
    await render(Fixture);
    await open();
    for (const control of document.querySelectorAll<HTMLElement>(
      'header button, .settings-menu [role=radio], .settings-menu .menu-item',
    )) {
      // Phone-only commands are not drawn on a desktop.
      if (!control.checkVisibility()) continue;
      const box = control.getBoundingClientRect();
      expect(box.width, control.outerHTML).toBeGreaterThanOrEqual(24);
      expect(box.height, control.outerHTML).toBeGreaterThanOrEqual(24);
    }
  });

  test('axe: panel open, light and dark, desktop and 390 px', async () => {
    await render(Fixture);
    await open();
    await expectAxeClean();
  });

  test('axe: French, panel open', async () => {
    await render(Fixture);
    await open();
    el(radio('English')).focus();
    await userEvent.keyboard('{ArrowRight}');
    await expectAxeCleanHere();
  });

  test('forced colours: the checked radio keeps an edge', async () => {
    await render(Fixture);
    await open();
    await withMedia([{ name: 'forced-colors', value: 'active' }], () => {
      const checked = getComputedStyle(el(radio('English')));
      expect(checked.outlineStyle).toBe('solid');
      expect(checked.outlineWidth).toBe('2px');
    });
  });

  test('reduced motion: the panel fades, it does not scale', async () => {
    await render(Fixture);
    await open();
    await withMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }], () => {
      expect(getComputedStyle(document.querySelector('.settings-menu')!).transitionProperty).toBe(
        'opacity',
      );
    });
  });
});
