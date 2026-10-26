// SearchCombobox in Chromium against the APG combobox (list autocomplete) keyboard table.
import axe from 'axe-core';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { cdp, page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import { attachAnnouncer } from './announcer.svelte.ts';
import '../../styles/index.css';
import Fixture from './search-combobox-test-support.svelte';

let region: HTMLElement;
let detach: () => void;
beforeEach(() => {
  region = document.body.appendChild(document.createElement('div'));
  region.setAttribute('aria-live', 'polite');
  detach = attachAnnouncer(region);
});
afterEach(() => {
  // Unmount first: the component stops its pending announcement, which needs the region.
  cleanup();
  detach();
  region.remove();
});

const field = () => page.getByRole('combobox', { name: 'Search regions' });
const input = () => field().element() as HTMLInputElement;
const armed = () => document.getElementById(input().getAttribute('aria-activedescendant') ?? '');

async function type(text: string) {
  input().focus();
  await userEvent.keyboard(text);
}

describe('SearchCombobox', () => {
  test('arms the first enabled option on render; arrows skip disabled ones and do not wrap', async () => {
    render(Fixture, { picks: [] });
    // "h" matches Hippocampus (disabled), Hypothalamus and Thalamus.
    await type('h');
    await expect.poll(() => armed()?.textContent).toBe('Hypothalamus');
    await userEvent.keyboard('{ArrowDown}');
    expect(armed()?.textContent).toBe('Thalamus');
    await userEvent.keyboard('{ArrowDown}');
    expect(armed()?.textContent).toBe('Thalamus');
    await userEvent.keyboard('{ArrowUp}');
    expect(armed()?.textContent).toBe('Hypothalamus');
    await userEvent.keyboard('{ArrowUp}');
    expect(armed()?.textContent).toBe('Hypothalamus');
    expect(document.activeElement).toBe(input());
  });

  test('move() arms as the arrows do, from wherever focus is', async () => {
    const { component } = await render(Fixture, { picks: [] });
    await type('h');
    await expect.poll(() => armed()?.textContent).toBe('Hypothalamus');
    input().blur();
    flushSync(() => component.move(1));
    expect(armed()?.textContent).toBe('Thalamus');
    flushSync(() => component.move(1));
    expect(armed()?.textContent).toBe('Thalamus');
    // Up skips the disabled Hippocampus and stops at the first enabled option.
    flushSync(() => component.move(-1));
    expect(armed()?.textContent).toBe('Hypothalamus');
    flushSync(() => component.move(-1));
    expect(armed()?.textContent).toBe('Hypothalamus');
  });

  test('with only disabled options the arrows arm nothing and throw nothing', async () => {
    render(Fixture, { picks: [] });
    const errors: unknown[] = [];
    const record = (event: ErrorEvent) => errors.push(event.error);
    window.addEventListener('error', record);
    await type('hippo');
    await expect.element(page.getByRole('option', { name: 'Hippocampus' })).toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}{ArrowUp}{Enter}');
    window.removeEventListener('error', record);
    expect(errors).toEqual([]);
    expect(input().hasAttribute('aria-activedescendant')).toBe(false);
  });

  test('an option marked current says so, whether or not it is the armed one', async () => {
    render(Fixture, { picks: [] });
    // "h" matches Hippocampus (disabled), Hypothalamus (armed) and Thalamus (current).
    await type('h');
    await expect.poll(() => armed()?.textContent).toBe('Hypothalamus');
    const states = [...document.querySelectorAll('[role=option]')].map((o) => [
      o.textContent,
      o.getAttribute('aria-current'),
      o.getAttribute('aria-selected'),
    ]);
    expect(states).toEqual([
      ['Hippocampus', null, 'false'],
      ['Hypothalamus', null, 'true'],
      ['Thalamus', 'true', 'false'],
    ]);
  });

  test('Enter chooses the armed option and leaves the search as typed', async () => {
    const picks: string[] = [];
    render(Fixture, { picks });
    await type('am');
    await expect.poll(() => armed()?.textContent).toBe('Amygdala');
    await userEvent.keyboard('{Enter}');
    expect(picks).toEqual(['amygdala']);
    expect(input().value).toBe('am');
    expect(document.activeElement).toBe(input());
    expect(input().getAttribute('aria-expanded')).toBe('true');
  });

  test('a disabled option does nothing when clicked', async () => {
    const picks: string[] = [];
    render(Fixture, { picks });
    await type('hippo');
    const row = page.getByRole('option', { name: 'Hippocampus' });
    await expect.element(row).toBeInTheDocument();
    (row.element() as HTMLElement).click();
    expect(picks).toEqual([]);
  });

  test('clicking an option chooses it', async () => {
    const picks: string[] = [];
    render(Fixture, { picks });
    await type('thal');
    await page.getByRole('option', { name: 'Thalamus' }).click();
    expect(picks).toEqual(['thalamus']);
  });

  test('Escape empties a filled field and is handled; an empty field leaves Escape to the page', async () => {
    render(Fixture, { picks: [] });
    const seen: boolean[] = [];
    const record = (event: KeyboardEvent) => seen.push(event.defaultPrevented);
    document.addEventListener('keydown', record);
    await type('am');
    await userEvent.keyboard('{Escape}');
    expect(input().value).toBe('');
    expect(seen.at(-1)).toBe(true);
    await userEvent.keyboard('{Escape}');
    expect(seen.at(-1)).toBe(false);
    document.removeEventListener('keydown', record);
  });

  test('Escape during IME composition is not handled, leaves the text and keeps the armed option', async () => {
    render(Fixture, { picks: [] });
    await type('am');
    await expect.poll(() => armed()?.textContent).toBe('Amygdala');
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      isComposing: true,
      bubbles: true,
      cancelable: true,
    });
    input().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(input().value).toBe('am');
    expect(input().getAttribute('aria-expanded')).toBe('true');
    expect(armed()?.textContent).toBe('Amygdala');
  });

  test('while results show, Escape outside the field is not handled', async () => {
    render(Fixture, { picks: [] });
    await type('h');
    await expect.poll(() => armed()).not.toBeNull();
    page.getByRole('button', { name: 'Switch atlas' }).element().focus();
    const seen: boolean[] = [];
    const record = (event: KeyboardEvent) => seen.push(event.defaultPrevented);
    document.addEventListener('keydown', record);
    await userEvent.keyboard('{Escape}');
    document.removeEventListener('keydown', record);
    expect(seen).toEqual([false]);
    expect(input().value).toBe('h');
  });

  test('while results show, a modal dialog still closes on Escape', async () => {
    render(Fixture, { picks: [] });
    await type('h');
    await expect.poll(() => armed()).not.toBeNull();
    const dialog = document.body.appendChild(document.createElement('dialog'));
    dialog.innerHTML = '<button type="button">Close</button>';
    dialog.showModal();
    await userEvent.keyboard('{Escape}');
    expect(dialog.open).toBe(false);
    dialog.remove();
  });

  test('the armed option survives Enter, so Down moves it again', async () => {
    const picks: string[] = [];
    render(Fixture, { picks });
    await type('h');
    await expect.poll(() => armed()?.textContent).toBe('Hypothalamus');
    await userEvent.keyboard('{Enter}');
    expect(picks).toEqual(['hypothalamus']);
    await userEvent.keyboard('{ArrowDown}');
    expect(armed()?.textContent).toBe('Thalamus');
  });

  test('the armed option survives Tab out and back, so Down moves it again', async () => {
    render(Fixture, { picks: [] });
    await type('h');
    await expect.poll(() => armed()?.textContent).toBe('Hypothalamus');
    await userEvent.tab();
    expect(document.activeElement).not.toBe(input());
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(input());
    await userEvent.keyboard('{ArrowDown}');
    expect(armed()?.textContent).toBe('Thalamus');
  });

  test('the clear button empties the field and returns focus to it', async () => {
    render(Fixture, { picks: [] });
    await type('am');
    await page.getByRole('button', { name: 'Clear search' }).click();
    expect(input().value).toBe('');
    expect(document.activeElement).toBe(input());
    await expect
      .element(page.getByRole('button', { name: 'Clear search' }))
      .not.toBeInTheDocument();
  });

  test('the / hint shows only while the field is empty', async () => {
    render(Fixture, { picks: [] });
    await expect.element(page.getByText('/', { exact: true })).toBeInTheDocument();
    await type('a');
    await expect.element(page.getByText('/', { exact: true })).not.toBeInTheDocument();
  });

  test('the / hint is absent when single keys are off', async () => {
    render(Fixture, { picks: [], showShortcut: false });
    expect(document.querySelector('kbd')).toBeNull();
  });

  test('notes sit outside the listbox; the count is announced once typing pauses, and again after a clear', async () => {
    render(Fixture, { picks: [] });
    await type('h');
    const listbox = page.getByRole('listbox', { name: 'Matching regions' }).element();
    expect(listbox.contains(page.getByRole('button', { name: 'Switch atlas' }).element())).toBe(
      false,
    );
    expect([...listbox.children].every((child) => child.getAttribute('role') === 'group')).toBe(
      true,
    );
    expect(region.textContent).toBe('');
    await expect.poll(() => region.textContent, { timeout: 2000 }).toBe('3 matches.');
    await userEvent.keyboard('{Escape}');
    region.textContent = '';
    await type('h');
    await expect.poll(() => region.textContent, { timeout: 2000 }).toBe('3 matches.');
  });

  test('no matches: the field is collapsed and the note is shown', async () => {
    render(Fixture, { picks: [] });
    await type('zzz');
    await expect.element(page.getByText('No match for zzz.')).toBeInTheDocument();
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(input().hasAttribute('aria-activedescendant')).toBe(false);
  });

  test('axe is clean with the listbox expanded', async () => {
    render(Fixture, { picks: [] });
    await type('h');
    await expect.poll(() => armed()).not.toBeNull();
    expect(input().getAttribute('aria-controls')).toBe(
      page.getByRole('listbox').element().getAttribute('id'),
    );
    const { violations } = await axe.run(document.body, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
    });
    expect(violations).toEqual([]);
  });

  test('scrolls the armed option to the top on new results, and to the nearest edge on arrows', async () => {
    render(Fixture, { picks: [], tall: true });
    const scroller = document.querySelector('[data-scroller]')!;
    const gap = () => ({
      top: armed()!.getBoundingClientRect().top - scroller.getBoundingClientRect().top,
      bottom: scroller.getBoundingClientRect().bottom - armed()!.getBoundingClientRect().bottom,
    });
    await type('h');
    await expect.poll(() => armed()?.textContent).toBe('Hypothalamus');
    await expect.poll(() => Math.round(gap().top)).toBe(0);
    // "nearest" brings the option in by the edge it came from; "start" would put its top at 0.
    await userEvent.keyboard('{ArrowDown}');
    expect(armed()?.textContent).toBe('Thalamus');
    await expect.poll(() => Math.round(gap().bottom)).toBe(0);
    await userEvent.keyboard('{ArrowUp}');
    expect(armed()?.textContent).toBe('Hypothalamus');
    await expect.poll(() => Math.round(gap().top)).toBe(0);
  });

  describe('axe with the U1 stylesheets, listbox expanded', () => {
    afterEach(() => {
      delete document.documentElement.dataset.theme;
    });
    const cases = [
      ['light', 'light', 1000],
      ['dark', 'dark', 1000],
      ['light at 390 px', 'light', 390],
      ['dark at 390 px', 'dark', 390],
    ] as const;
    for (const [name, theme, width] of cases) {
      test(name, async () => {
        document.documentElement.dataset.theme = theme;
        await page.viewport(width, 800);
        render(Fixture, { picks: [] });
        await type('h');
        await expect.poll(() => armed()).not.toBeNull();
        const { violations } = await axe.run(document.body, {
          runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
        });
        expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' ')}`)).toEqual(
          [],
        );
      });
    }
  });

  test('forced colours: the focused field takes the Highlight outline', async () => {
    const session = cdp() as unknown as {
      send(method: string, params: object): Promise<unknown>;
    };
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'forced-colors', value: 'active' }],
    });
    try {
      render(Fixture, { picks: [] });
      await userEvent.keyboard('{Tab}');
      expect(document.activeElement).toBe(input());
      const probe = document.body.appendChild(document.createElement('div'));
      probe.style.color = 'Highlight';
      expect(getComputedStyle(input()).outlineColor).toBe(getComputedStyle(probe).color);
      probe.remove();
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] });
    }
  });
});
