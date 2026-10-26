// IconButton and icons.ts.
import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { expectAxeClean, withMedia } from './a11y-test-support.ts';
import IconButton from './IconButton.svelte';
import { ICONS, type IconName } from './icons.ts';

const button = (name: string) => page.getByRole('button', { name });
const el = (name: string) => button(name).element() as HTMLElement;

describe('IconButton', () => {
  test('is a native button named by its label, with a decorative icon', async () => {
    render(IconButton, { icon: 'camera', label: 'Save image' });
    await expect.element(button('Save image')).toBeVisible();
    expect(el('Save image').tagName).toBe('BUTTON');
    expect(el('Save image').getAttribute('type')).toBe('button');
    const svg = el('Save image').querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');
    expect(el('Save image').textContent?.trim()).toBe('');
  });

  test('Enter, Space and a click activate it', async () => {
    const onclick = vi.fn();
    render(IconButton, { icon: 'close', label: 'Close', onclick });
    el('Close').focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    await button('Close').click();
    expect(onclick).toHaveBeenCalledTimes(3);
  });

  test('a disabled button is neither clickable nor in the Tab order', async () => {
    const onclick = vi.fn();
    render(IconButton, { icon: 'close', label: 'Close', disabled: true, onclick });
    await userEvent.tab();
    expect(document.activeElement).not.toBe(el('Close'));
    el('Close').click();
    expect(onclick).not.toHaveBeenCalled();
  });

  test('passes aria-expanded, aria-controls and aria-pressed through', async () => {
    render(IconButton, {
      icon: 'more',
      label: 'More',
      'aria-expanded': true,
      'aria-controls': 'menu',
      'aria-pressed': false,
    });
    expect(el('More').getAttribute('aria-expanded')).toBe('true');
    expect(el('More').getAttribute('aria-controls')).toBe('menu');
    expect(el('More').getAttribute('aria-pressed')).toBe('false');
  });

  test('draws the legacy path data, the legacy sizes and strokes', async () => {
    render(IconButton, { icon: 'search', label: 'Search' });
    const svg = el('Search').querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('14');
    expect(svg.getAttribute('stroke-width')).toBe('2');
    expect(svg.querySelector('path')?.getAttribute('d')).toBe('M20 20l-3.5-3.5');
    expect(svg.querySelector('circle')?.getAttribute('r')).toBe('7');
  });

  test('the target is at least 24 px', async () => {
    render(IconButton, { icon: 'close', label: 'Close' });
    const box = el('Close').getBoundingClientRect();
    expect(box.width).toBeGreaterThanOrEqual(24);
    expect(box.height).toBeGreaterThanOrEqual(24);
  });

  test('forced colours outline an expanded button', async () => {
    render(IconButton, { icon: 'more', label: 'More', 'aria-expanded': true });
    await withMedia([{ name: 'forced-colors', value: 'active' }], () => {
      expect(getComputedStyle(el('More')).outlineStyle).toBe('solid');
    });
  });

  test('every icon in icons.ts renders', async () => {
    const names = Object.keys(ICONS) as IconName[];
    expect(names).toHaveLength(23);
    for (const icon of names) {
      render(IconButton, { icon, label: icon });
      const svg = el(icon).querySelector('svg')!;
      expect(svg.querySelectorAll('path, circle').length, icon).toBe(ICONS[icon].shapes.length);
    }
  });

  test('axe: light and dark, desktop and 390 px', async () => {
    render(IconButton, { icon: 'close', label: 'Close' });
    await expectAxeClean();
  });
});
