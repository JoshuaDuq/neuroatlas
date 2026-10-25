// Real-DOM checks for Dialog, Popover and Tooltip in Chromium: keyboard paths, focus hand-offs,
// Escape consumption and axe (wcag2a/aa/21aa/22aa), against the fixture a feature would write.
import axe from 'axe-core';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import '../../styles/index.css';
import Fixture from './overlay-test-support.svelte';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
const button = (name: string) => page.getByRole('button', { name, exact: true });
const el = (name: string) => button(name).element() as HTMLElement;
const attr = (name: string, attribute: string) => el(name).getAttribute(attribute);
const tooltip = () => document.querySelector<HTMLElement>('[role="tooltip"]');
const dialog = () => document.querySelector('dialog') as HTMLDialogElement;

async function violations() {
  const results = await axe.run(document.body, {
    runOnly: WCAG,
    rules: { region: { enabled: false } },
  });
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' ')}`);
}

// The theme change and an entry animation both pass through blended colours; axe reads them after.
async function useTheme(theme: 'light' | 'dark') {
  document.documentElement.dataset.theme = theme;
  await new Promise((resolve) => setTimeout(resolve, 400));
}

// The pointer stays where the last test left it, over whichever control is there.
const parkPointer = () => userEvent.hover(el('After popovers'));

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('Popover', () => {
  test('the menu keeps focus on the trigger; a keyboard open is instant, a pointer open is not', async () => {
    render(Fixture);
    expect(attr('Settings', 'aria-expanded')).toBe('false');
    await button('Settings').click();
    expect(attr('Settings', 'aria-expanded')).toBe('true');
    await expect.element(button('Light')).toBeInTheDocument();
    expect(document.activeElement).toBe(el('Settings'));
    expect(document.querySelector('.popover')?.hasAttribute('data-instant')).toBe(false);

    await userEvent.keyboard('{Escape}');
    await expect.element(button('Light')).not.toBeInTheDocument();

    el('Settings').focus();
    await userEvent.keyboard('{Enter}');
    await expect.element(button('Light')).toBeInTheDocument();
    expect(document.querySelector('.popover')?.hasAttribute('data-instant')).toBe(true);
  });

  test('Escape closes, returns focus to the trigger and is handled before the page keymap', async () => {
    render(Fixture);
    const seen: boolean[] = [];
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') seen.push(event.defaultPrevented);
    };
    window.addEventListener('keydown', listener);
    await button('Settings').click();
    await expect.element(button('Light')).toBeInTheDocument();
    el('Light').focus();
    await userEvent.keyboard('{Escape}');
    window.removeEventListener('keydown', listener);

    await expect.element(button('Light')).not.toBeInTheDocument();
    expect(attr('Settings', 'aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(el('Settings'));
    expect(seen).toEqual([true]);
  });

  test('Escape with the popover closed is left to the page', async () => {
    render(Fixture);
    const seen: boolean[] = [];
    const listener = (event: KeyboardEvent) => seen.push(event.defaultPrevented);
    window.addEventListener('keydown', listener);
    el('Settings').focus();
    await userEvent.keyboard('{Escape}');
    window.removeEventListener('keydown', listener);
    expect(seen).toEqual([false]);
  });

  test('Tab out of the last control closes it and focus stays where Tab put it', async () => {
    render(Fixture);
    await button('Settings').click();
    el('Provenance').focus();
    await userEvent.tab();
    // Tab from the last control goes to the next popover's trigger, which is not this popover's own.
    expect(document.activeElement).toBe(el('Data'));
    await vi.waitFor(() => expect(attr('Settings', 'aria-expanded')).toBe('false'));
    expect(document.activeElement).toBe(el('Data'));
  });

  test('Shift+Tab from the trigger closes it and focus is not pulled back', async () => {
    render(Fixture);
    el('Fullscreen').focus();
    await button('Settings').click();
    el('Settings').focus();
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(el('Fullscreen'));
    await vi.waitFor(() => expect(attr('Settings', 'aria-expanded')).toBe('false'));
    expect(document.activeElement).toBe(el('Fullscreen'));
  });

  test('focus moving to another popover trigger closes this one, so only one stays open', async () => {
    render(Fixture);
    await button('Settings').click();
    el('Light').focus();
    await button('Data').click();
    await expect.element(button('Subject')).toBeInTheDocument();
    await vi.waitFor(() => expect(attr('Settings', 'aria-expanded')).toBe('false'));
    expect(attr('Data', 'aria-expanded')).toBe('true');
    await expect.element(button('Light')).not.toBeInTheDocument();
  });

  test('opening one with no focus change still closes the other', async () => {
    render(Fixture);
    await button('Settings').click();
    // An owner opening the other one (a command), while focus stays inside this one.
    el('Open data').click();
    await expect.element(button('Subject')).toBeInTheDocument();
    await vi.waitFor(() => expect(attr('Settings', 'aria-expanded')).toBe('false'));
    expect(attr('Data', 'aria-expanded')).toBe('true');
  });

  test('focus moving to its own trigger keeps it open', async () => {
    render(Fixture);
    await button('Settings').click();
    el('Light').focus();
    el('Settings').focus();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(attr('Settings', 'aria-expanded')).toBe('true');
  });

  test('a window switch (no related target) keeps it open', async () => {
    render(Fixture);
    await button('Settings').click();
    el('Light').dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(attr('Settings', 'aria-expanded')).toBe('true');
  });

  test('a press outside closes it without moving focus to the trigger', async () => {
    render(Fixture);
    await button('Settings').click();
    await button('Fullscreen').click();
    await vi.waitFor(() => expect(attr('Settings', 'aria-expanded')).toBe('false'));
    expect(document.activeElement).not.toBe(el('Settings'));
  });

  test('a command inside closes it and returns focus to the trigger', async () => {
    render(Fixture);
    await button('Settings').click();
    await button('Provenance').click();
    await vi.waitFor(() => expect(attr('Settings', 'aria-expanded')).toBe('false'));
    expect(document.activeElement).toBe(el('Settings'));
    expect(document.getElementById('picked')!.textContent).toBe('provenance');
  });

  test('axe finds no violations with the popover open, light and dark', async () => {
    render(Fixture);
    await button('Settings').click();
    await expect.element(button('Light')).toBeInTheDocument();
    await useTheme('light');
    expect(await violations()).toEqual([]);
    await useTheme('dark');
    expect(await violations()).toEqual([]);
  });
});

describe('Popover keys and stage variant', () => {
  test('↑ and ↓ on a control inside are handled; other keys are left to the control', async () => {
    render(Fixture);
    await button('Settings').click();
    el('Provenance').focus();
    const seen: Record<string, boolean> = {};
    const listener = (event: KeyboardEvent) => (seen[event.key] = event.defaultPrevented);
    window.addEventListener('keydown', listener);
    for (const key of ['ArrowDown', 'ArrowUp', 'a']) {
      await userEvent.keyboard(key.length > 1 ? `{${key}}` : key);
    }
    window.removeEventListener('keydown', listener);
    expect(seen).toEqual({ ArrowDown: true, ArrowUp: true, a: false });
  });

  test('the stage popover moves focus to the pressed control and ↑ ↓ on a checkbox are handled', async () => {
    render(Fixture);
    await button('Stage').click();
    await vi.waitFor(() => expect(document.activeElement).toBe(el('Orbit')));
    const seen: boolean[] = [];
    const listener = (event: KeyboardEvent) => seen.push(event.defaultPrevented);
    window.addEventListener('keydown', listener);
    (page.getByRole('checkbox', { name: 'Grid' }).element() as HTMLElement).focus();
    await userEvent.keyboard('{ArrowDown}');
    window.removeEventListener('keydown', listener);
    expect(seen).toEqual([true]);
  });

  test('an outside press fades the stage popover out; Escape closes it at once', async () => {
    render(Fixture);
    await button('Stage').click();
    await expect.element(button('Orbit')).toBeInTheDocument();
    // A press with no wait for the click's own latency, so the fade can be watched.
    await new Promise((resolve) => setTimeout(resolve, 300));
    const outside = el('Fullscreen');
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
    outside.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' }));
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const closed = performance.now();
    let faded = false;
    while (document.querySelector('.popover') && performance.now() - closed < 1000) {
      faded ||= document.querySelector('.popover')!.hasAttribute('data-ending-style');
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(faded).toBe(true);
    expect(document.querySelector('.popover')).toBeNull();
    expect(performance.now() - closed).toBeGreaterThanOrEqual(90);

    await button('Stage').click();
    await expect.element(button('Orbit')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(attr('Stage', 'aria-expanded')).toBe('false'));
    expect(document.querySelector('.popover')).toBeNull();
  });
});

describe('Dialog', () => {
  test('a keyboard open is instant and Escape returns focus to the opener', async () => {
    render(Fixture);
    el('Shortcuts').focus();
    await userEvent.keyboard('{Enter}');
    await vi.waitFor(() => expect(dialog().open).toBe(true));
    expect(dialog().hasAttribute('data-instant')).toBe(true);
    expect(dialog().getAttribute('aria-labelledby')).toBe(
      page.getByRole('heading', { name: 'Keyboard shortcuts' }).element().id,
    );
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(dialog().open).toBe(false));
    expect(document.activeElement).toBe(el('Shortcuts'));
    expect(dialog().hasAttribute('data-instant')).toBe(true);
  });

  test('a pointer open and the close button animate, and focus returns to the opener', async () => {
    render(Fixture);
    await button('Shortcuts').click();
    await vi.waitFor(() => expect(dialog().open).toBe(true));
    expect(dialog().hasAttribute('data-instant')).toBe(false);
    await button('Close').click();
    await vi.waitFor(() => expect(dialog().open).toBe(false));
    expect(dialog().hasAttribute('data-instant')).toBe(false);
    expect(document.activeElement).toBe(el('Shortcuts'));
  });

  test('the background is inert: Tab never reaches the page behind', async () => {
    render(Fixture);
    await button('Shortcuts').click();
    await vi.waitFor(() => expect(dialog().open).toBe(true));
    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      // The cycle passes through the browser's own UI, where nothing in the page has focus.
      expect([dialog(), document.body]).toContain(
        document.activeElement === document.body
          ? document.body
          : document.activeElement?.closest('dialog'),
      );
    }
  });

  test('with the opener gone, focus goes to the fallback', async () => {
    render(Fixture);
    await button('Shortcuts').click();
    await vi.waitFor(() => expect(dialog().open).toBe(true));
    el('Shortcuts').style.display = 'none';
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(dialog().open).toBe(false));
    expect(document.activeElement).toBe(el('Fallback'));
  });

  test('isolateKeys keeps the page keymap out; Escape still closes', async () => {
    render(Fixture, { isolateKeys: true });
    const seen: string[] = [];
    const listener = (event: KeyboardEvent) => seen.push(event.key);
    window.addEventListener('keydown', listener);
    await button('Shortcuts').click();
    await vi.waitFor(() => expect(dialog().open).toBe(true));
    el('Inside').focus();
    await userEvent.keyboard('h');
    await userEvent.keyboard('{Escape}');
    window.removeEventListener('keydown', listener);
    expect(seen).toEqual([]);
    await vi.waitFor(() => expect(dialog().open).toBe(false));
  });

  test('without isolateKeys the page keymap hears the keys', async () => {
    render(Fixture);
    const seen: string[] = [];
    const listener = (event: KeyboardEvent) => seen.push(event.key);
    window.addEventListener('keydown', listener);
    await button('Shortcuts').click();
    await vi.waitFor(() => expect(dialog().open).toBe(true));
    el('Inside').focus();
    await userEvent.keyboard('h');
    window.removeEventListener('keydown', listener);
    expect(seen).toEqual(['h']);
  });

  test('axe finds no violations with the dialog open, light and dark, desktop and phone', async () => {
    render(Fixture);
    await button('Shortcuts').click();
    await vi.waitFor(() => expect(dialog().open).toBe(true));
    await useTheme('light');
    expect(await violations()).toEqual([]);
    await useTheme('dark');
    expect(await violations()).toEqual([]);
    await page.viewport(390, 844);
    try {
      expect(await violations()).toEqual([]);
      expect(dialog().getBoundingClientRect().width).toBe(390);
    } finally {
      await page.viewport(414, 896);
    }
  });
});

describe('Tooltip placement and disposal', () => {
  const fixed = (name: string, css: string) => {
    const target = el(name);
    target.style.cssText = `position: fixed; ${css}`;
    return target;
  };
  const shown = async () => {
    await vi.waitFor(() => expect(tooltip()).not.toBeNull(), { timeout: 1500, interval: 10 });
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { tip: tooltip()!.getBoundingClientRect(), root: document.documentElement };
  };

  test('with no room below, the tooltip is drawn above its trigger', async () => {
    render(Fixture);
    const trigger = fixed('Snapshot', 'left: 100px; bottom: 4px');
    await userEvent.hover(trigger);
    const { tip } = await shown();
    expect(tip.bottom).toBeLessThanOrEqual(trigger.getBoundingClientRect().top);
  });

  test('a trigger at the right edge keeps the tooltip 8 px inside the viewport', async () => {
    render(Fixture);
    const trigger = fixed('Snapshot', 'right: 0; top: 100px');
    await userEvent.hover(trigger);
    const { tip, root } = await shown();
    expect(tip.right).toBeLessThanOrEqual(root.clientWidth - 8 + 0.5);
    expect(tip.right).toBeGreaterThan(root.clientWidth - 40);
  });

  test('unmounting during a pending hover shows nothing and leaves no aria-describedby', async () => {
    render(Fixture);
    const trigger = el('Snapshot');
    await userEvent.hover(trigger);
    await new Promise((resolve) => setTimeout(resolve, 200));
    cleanup();
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(tooltip()).toBeNull();
    expect(trigger.hasAttribute('aria-describedby')).toBe(false);
  });
});

describe('Tooltip', () => {
  test('hover waits 500 ms, names the trigger by aria-describedby, and the next one skips the wait', async () => {
    render(Fixture);
    await button('Snapshot').hover();
    const hovered = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(tooltip()).toBeNull();
    await vi.waitFor(() => expect(tooltip()).not.toBeNull(), { timeout: 1500, interval: 10 });
    const delay = performance.now() - hovered;
    expect(delay).toBeGreaterThanOrEqual(450);
    expect(delay).toBeLessThan(800);
    expect(tooltip()!.textContent).toBe('Save a PNG');
    expect(attr('Snapshot', 'aria-describedby')).toBe(tooltip()!.id);

    await userEvent.unhover(el('Snapshot'));
    await vi.waitFor(() => expect(tooltip()).toBeNull(), { timeout: 1000, interval: 10 });
    expect(attr('Snapshot', 'aria-describedby')).toBeNull();
    const closed = performance.now();
    await button('Fullscreen').hover();
    await vi.waitFor(() => expect(tooltip()).not.toBeNull(), { timeout: 1000, interval: 5 });
    expect(performance.now() - closed).toBeLessThan(300);
    expect(tooltip()!.textContent).toBe('Enter full screen');
    expect(tooltip()!.hasAttribute('data-instant')).toBe(true);
  });

  test('keyboard focus shows it at once and Escape dismisses it', async () => {
    render(Fixture);
    await parkPointer();
    await userEvent.tab();
    for (let i = 0; i < 10 && document.activeElement !== el('Snapshot'); i++) {
      await userEvent.tab();
    }
    expect(document.activeElement).toBe(el('Snapshot'));
    await vi.waitFor(() => expect(tooltip()?.textContent).toBe('Save a PNG'));
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(tooltip()).toBeNull());
  });

  test('the pointer can cross to the tooltip and read it, and leaving closes it', async () => {
    render(Fixture);
    await button('Snapshot').hover();
    await vi.waitFor(() => expect(tooltip()).not.toBeNull(), { timeout: 1500, interval: 10 });
    const tip = tooltip()!;
    await userEvent.hover(tip);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(tooltip()).toBe(tip);
    await userEvent.unhover(tip);
    await vi.waitFor(() => expect(tooltip()).toBeNull(), { timeout: 1000, interval: 10 });
  });

  test('a touch pointer shows none', async () => {
    render(Fixture);
    el('Snapshot').dispatchEvent(
      new PointerEvent('pointerover', { bubbles: true, pointerType: 'touch' }),
    );
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(tooltip()).toBeNull();
  });

  test('a tooltip for a control inside a modal dialog is drawn inside it', async () => {
    render(Fixture);
    await button('Shortcuts').click();
    await vi.waitFor(() => expect(dialog().open).toBe(true));
    await button('Hint').hover();
    await vi.waitFor(() => expect(tooltip()).not.toBeNull(), { timeout: 1500, interval: 10 });
    expect(dialog().contains(tooltip())).toBe(true);
  });

  test('axe finds no violations with a tooltip open, light and dark', async () => {
    render(Fixture);
    await parkPointer();
    await userEvent.tab();
    for (let i = 0; i < 10 && document.activeElement !== el('Snapshot'); i++) {
      await userEvent.tab();
    }
    await vi.waitFor(() => expect(tooltip()).not.toBeNull());
    await useTheme('light');
    expect(await violations()).toEqual([]);
    await useTheme('dark');
    expect(await violations()).toEqual([]);
  });
});
