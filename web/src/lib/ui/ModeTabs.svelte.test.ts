// ModeTabs against the APG Tabs pattern with manual activation (decision 0004).
import { createRawSnippet } from 'svelte';
import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { expectAxeClean, withMedia } from './a11y-test-support.ts';
import ModeTabs from './ModeTabs.svelte';

const modes = [
  { value: 'anatomy', label: 'Anatomy' },
  { value: 'functions', label: 'Functions' },
  { value: 'deficits', label: 'Deficits' },
  { value: 'tracts', label: 'Tracts' },
];
const panel = createRawSnippet((mode: () => string) => ({
  render: () => `<p>${mode()} panel</p>`,
}));
const tab = (name: string) => page.getByRole('tab', { name, exact: true });
const el = (name: string) => tab(name).element() as HTMLElement;
const props = (extra = {}) => ({
  tabs: modes,
  value: 'anatomy',
  label: 'Explore the atlas',
  panel,
  ...extra,
});

describe('ModeTabs', () => {
  test('one tablist; the selected tab is the only Tab stop and labels its panel', async () => {
    render(ModeTabs, props());
    await expect.element(page.getByRole('tablist', { name: 'Explore the atlas' })).toBeVisible();
    expect(document.querySelectorAll('[role=tablist]')).toHaveLength(1);
    expect(el('Anatomy').getAttribute('aria-selected')).toBe('true');
    expect(el('Anatomy').tabIndex).toBe(0);
    for (const name of ['Functions', 'Deficits', 'Tracts']) expect(el(name).tabIndex).toBe(-1);
    const shown = page.getByRole('tabpanel');
    await expect.element(shown).toHaveTextContent('anatomy panel');
    expect(shown.element().getAttribute('aria-labelledby')).toBe(el('Anatomy').id);
    expect(el('Anatomy').getAttribute('aria-controls')).toBe(shown.element().id);
  });

  test('arrows and Home/End move focus, wrapping, without choosing a tab', async () => {
    render(ModeTabs, props());
    el('Anatomy').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(el('Functions'));
    expect(el('Anatomy').getAttribute('aria-selected')).toBe('true');
    await userEvent.keyboard('{End}');
    expect(document.activeElement).toBe(el('Tracts'));
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(el('Anatomy'));
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(el('Tracts'));
    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(el('Anatomy'));
    for (const name of ['Functions', 'Deficits', 'Tracts'])
      expect(el(name).getAttribute('aria-selected')).toBe('false');
    await expect.element(page.getByRole('tabpanel')).toHaveTextContent('anatomy panel');
  });

  test('Enter and Space choose the focused tab; a click chooses too', async () => {
    render(ModeTabs, props());
    el('Anatomy').focus();
    await userEvent.keyboard('{ArrowRight}{Enter}');
    expect(el('Functions').getAttribute('aria-selected')).toBe('true');
    await expect.element(page.getByRole('tabpanel')).toHaveTextContent('functions panel');
    await userEvent.keyboard('{ArrowRight}');
    expect(el('Functions').getAttribute('aria-selected')).toBe('true');
    await userEvent.keyboard(' ');
    expect(el('Deficits').getAttribute('aria-selected')).toBe('true');
    await tab('Tracts').click();
    expect(el('Tracts').getAttribute('aria-selected')).toBe('true');
    expect(el('Tracts').tabIndex).toBe(0);
    expect(el('Deficits').tabIndex).toBe(-1);
  });

  test('vertical arrows are not swallowed (decision 19: the global keymap gates them)', async () => {
    render(ModeTabs, props());
    const seen = vi.fn((event: KeyboardEvent) => event.defaultPrevented);
    document.addEventListener('keydown', seen);
    el('Anatomy').focus();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowUp}');
    document.removeEventListener('keydown', seen);
    expect(seen.mock.results.map((r) => r.value)).toEqual([false, false]);
    expect(document.activeElement).toBe(el('Anatomy'));
  });

  test('only the selected panel has content', async () => {
    render(ModeTabs, props({ value: 'deficits' }));
    await expect.element(page.getByRole('tabpanel')).toHaveTextContent('deficits panel');
    expect(document.body.textContent).not.toContain('anatomy panel');
  });

  test('forced colours underline the selected tab in a system colour', async () => {
    render(ModeTabs, props());
    await withMedia([{ name: 'forced-colors', value: 'active' }], () => {
      expect(getComputedStyle(el('Anatomy')).borderBottomStyle).toBe('solid');
      expect(getComputedStyle(el('Functions')).borderBottomStyle).not.toBe('solid');
    });
  });

  test('axe: light and dark, desktop and 390 px', async () => {
    render(ModeTabs, props());
    await expectAxeClean();
  });
});
