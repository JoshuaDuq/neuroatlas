// The dissection bar against the legacy dissection.js cases and decision 36 on #4, as behaviour in
// Chromium: what it shows, what its buttons do, and where focus goes when a button disables
// itself or the bar leaves (deviations/a3-focus-fallback.md).
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { cdp, page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import { expectAxeClean } from '../../lib/ui/a11y-test-support.ts';
import { FOCUS_TARGETS, requestFocus } from '../../lib/ui/focus.ts';
import Fixture from './dissection-test-support.svelte';

type Props = Parameters<typeof render<typeof Fixture>>[1];

const mount = (props: NonNullable<Props>) => {
  const calls: string[] = [];
  render(Fixture, { calls, ...props });
  return calls;
};
const byId = (id: string) => document.getElementById(id) as HTMLButtonElement;
const group = () => document.querySelector<HTMLElement>('[role="group"]');
const undo = () => page.getByRole('button', { name: /^(Undo|Annuler)$/ }).element() as HTMLElement;
const restore = () =>
  page.getByRole('button', { name: /^(Restore all|Tout rétablir)$/ }).element() as HTMLElement;
const active = () => document.activeElement;
const press = (keys: string) => userEvent.keyboard(keys);

beforeEach(async () => {
  await page.viewport(1280, 800);
});
afterEach(() => cleanup());

describe('what the bar shows', () => {
  test('a group named Dissection, not a landmark, holds the count and the two commands in order', () => {
    mount({ count: 3, history: [0] });
    const bar = group()!;
    expect(bar.getAttribute('aria-labelledby')).toBe(bar.querySelector('h3')!.id);
    expect(bar.querySelector('h3')!.textContent).toBe('Dissection');
    expect(document.querySelector('section, [role="region"]')).toBeNull();
    expect([...bar.children].map((child) => child.textContent)).toEqual([
      'Dissection',
      '3 parts hidden',
      'Undo',
      'Restore all',
    ]);
    // The count is plain text: S1's announcer speaks it, so a live region here would say it twice.
    expect(bar.querySelector('[aria-live], [role="status"], [role="alert"]')).toBeNull();
  });

  test.each([
    ['en', 1, '1 part hidden', 'Undo', 'Restore all'],
    ['en', 12, '12 parts hidden', 'Undo', 'Restore all'],
    ['fr', 1, '1 partie masquée', 'Annuler', 'Tout rétablir'],
    ['fr', 12, '12 parties masquées', 'Annuler', 'Tout rétablir'],
  ] as const)('%s, %i hidden: the count and the buttons are worded', (lang, count, said, a, b) => {
    mount({ lang, count, history: [0] });
    expect(group()!.querySelector('p')!.textContent).toBe(said);
    expect(group()!.querySelector('h3')!.textContent).toBe('Dissection');
    expect([...group()!.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      a,
      b,
    ]);
  });

  test('nothing is hidden: there is no bar, and it comes back with the first hidden part', async () => {
    mount({ count: 0 });
    expect(group()).toBeNull();
    byId('hide-more').click();
    await expect.poll(group).not.toBeNull();
    expect(group()!.querySelector('p')!.textContent).toBe('1 part hidden');
  });

  test('Undo is disabled with nothing to undo, as after a permalink; Restore all never is', () => {
    mount({ count: 2 });
    expect((undo() as HTMLButtonElement).disabled).toBe(true);
    expect((restore() as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('commands', () => {
  test('Enter and Space on a button run its command', async () => {
    const calls = mount({ count: 3, history: [2, 1] });
    undo().focus();
    await press('{Enter}');
    expect(calls).toEqual(['undo']);
    await press(' ');
    expect(calls).toEqual(['undo', 'undo']);
    restore().focus();
    await press('{Enter}');
    expect(calls).toEqual(['undo', 'undo', 'restore']);
  });

  test('Tab runs from the tree stop to Undo, Restore all, then on; a disabled Undo is skipped', async () => {
    mount({ count: 2, history: [1] });
    byId('before').focus();
    const order = [];
    for (let i = 0; i < 4; i++) {
      await userEvent.tab();
      order.push(active()!.textContent);
    }
    expect(order).toEqual(['tree stop', 'Undo', 'Restore all', 'after']);
    cleanup();

    mount({ count: 2 });
    byId('stop').focus();
    await userEvent.tab();
    expect(active()).toBe(restore());
  });
});

describe('focus', () => {
  test('Undo spends the history while parts remain: focus moves to Restore all', async () => {
    mount({ count: 2, history: [1] });
    undo().focus();
    await press('{Enter}');
    await expect.poll(() => (undo() as HTMLButtonElement).disabled).toBe(true);
    expect(active()).toBe(restore());
  });

  test('Undo that leaves more to undo keeps focus on Undo', async () => {
    mount({ count: 3, history: [1, 2] });
    undo().focus();
    await press('{Enter}');
    await expect.poll(() => group()!.querySelector('p')!.textContent).toBe('2 parts hidden');
    expect(active()).toBe(undo());
  });

  test.each([
    ['Restore all', { count: 3, history: [1] }, restore],
    ['the last Undo', { count: 1, history: [0] }, undo],
  ])('%s empties the bar: focus goes to the tree stop, not to the page', async (_, props, from) => {
    mount(props);
    from().focus();
    await press('{Enter}');
    await expect.poll(group).toBeNull();
    expect(active()).toBe(byId('stop'));
  });

  test('the tree has no tab stop (a search with no rows): focus goes to the tab in front', async () => {
    mount({ count: 3, history: [], treeStop: false });
    restore().focus();
    await press('{Enter}');
    await expect.poll(group).toBeNull();
    expect(active()).toBe(byId('tab'));
  });

  test('a change from outside the bar takes no focus', async () => {
    mount({ count: 1, history: [0] });
    byId('undo-outside').focus();
    byId('undo-outside').click();
    await expect.poll(group).toBeNull();
    expect(active()).toBe(byId('undo-outside'));
  });

  test('the dissection-undo target is Undo, then Restore all while Undo is disabled, and none without the bar', () => {
    mount({ count: 2, history: [1] });
    expect(requestFocus(FOCUS_TARGETS.dissectionUndo)).toBe(true);
    expect(active()).toBe(undo());
    cleanup();

    mount({ count: 2 });
    expect(requestFocus(FOCUS_TARGETS.dissectionUndo)).toBe(true);
    expect(active()).toBe(restore());
    cleanup();

    mount({ count: 0 });
    expect(requestFocus(FOCUS_TARGETS.dissectionUndo)).toBe(false);
    expect(requestFocus(FOCUS_TARGETS.dissectionUndo, { fallback: FOCUS_TARGETS.treeStop })).toBe(
      true,
    );
    expect(active()).toBe(byId('stop'));
  });
});

describe('size, reflow and accessibility', () => {
  test('both buttons are at least 24 px, and 44 px on a coarse pointer', async () => {
    mount({ count: 2, history: [1] });
    for (const button of [undo(), restore()]) {
      expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(24);
      expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(24);
    }
    const session = cdp();
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    try {
      expect(matchMedia('(pointer: coarse)').matches).toBe(true);
      for (const button of [undo(), restore()]) {
        expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      }
    } finally {
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  });

  test('320 px, 200 % text and WCAG 1.4.12 text spacing: the French bar wraps, nothing spills or is clipped', async () => {
    mount({ lang: 'fr', count: 12, history: [1] });
    await page.viewport(320, 700);
    document.documentElement.style.fontSize = '200%';
    const spacing = document.head.appendChild(document.createElement('style'));
    spacing.textContent =
      '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }';
    try {
      const bar = group()!.getBoundingClientRect();
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
      expect(group()!.scrollHeight).toBeLessThanOrEqual(group()!.clientHeight + 1);
      for (const part of group()!.querySelectorAll('p, button')) {
        const box = part.getBoundingClientRect();
        expect(box.left, part.textContent!).toBeGreaterThanOrEqual(bar.left - 1);
        expect(box.right, part.textContent!).toBeLessThanOrEqual(bar.right + 1);
        expect(part.scrollWidth, part.textContent!).toBeLessThanOrEqual(part.clientWidth + 1);
      }
    } finally {
      spacing.remove();
      document.documentElement.style.fontSize = '';
    }
  });

  test('axe: light and dark, desktop and phone, in English and French', async () => {
    mount({ count: 2, history: [1] });
    await expectAxeClean();
    cleanup();
    mount({ lang: 'fr', count: 2 });
    await expectAxeClean();
  });
});
