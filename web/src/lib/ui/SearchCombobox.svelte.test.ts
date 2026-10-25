// SearchCombobox in Chromium against the APG combobox (list autocomplete) keyboard table.
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import { attachAnnouncer } from './announcer.svelte.ts';
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

  test('Escape during IME composition leaves the text and the list alone', async () => {
    render(Fixture, { picks: [] });
    await type('am');
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      isComposing: true,
      bubbles: true,
      cancelable: true,
    });
    input().dispatchEvent(event);
    expect(input().value).toBe('am');
    expect(input().getAttribute('aria-expanded')).toBe('true');
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
});
