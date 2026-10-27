// ToggleToolbar against the APG Toolbar keyboard table with aria-pressed toggle buttons (decision 0003).
import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { expectAxeClean, withMedia } from './a11y-test-support.ts';
import ToggleToolbar from './ToggleToolbar.svelte';

const presets = [
  { value: 'front', label: 'Front' },
  { value: 'left', label: 'Left' },
  { value: 'top', label: 'Top', disabled: true },
  { value: 'back', label: 'Back' },
];
const button = (name: string) => page.getByRole('button', { name });
const el = (name: string) => button(name).element() as HTMLElement;
const props = (extra = {}) => ({
  items: presets,
  pressed: 'front',
  onpress: () => {},
  label: 'View presets',
  ...extra,
});

describe('ToggleToolbar', () => {
  test('is a toolbar of aria-pressed buttons, not radios', async () => {
    render(ToggleToolbar, props());
    await expect.element(page.getByRole('toolbar', { name: 'View presets' })).toBeVisible();
    expect(document.querySelectorAll('[role=radio]')).toHaveLength(0);
    expect(el('Front').getAttribute('aria-pressed')).toBe('true');
    expect(el('Left').getAttribute('aria-pressed')).toBe('false');
  });

  test('pressed null leaves every button unpressed (a held preset ended)', async () => {
    render(ToggleToolbar, props({ pressed: null }));
    for (const name of ['Front', 'Left', 'Back'])
      expect(el(name).getAttribute('aria-pressed')).toBe('false');
  });

  test('one Tab stop; arrows and Home/End move focus only and never press', async () => {
    const onpress = vi.fn();
    render(ToggleToolbar, props({ onpress }));
    const stops = [...document.querySelectorAll<HTMLElement>('button')].filter(
      (b) => b.tabIndex === 0,
    );
    expect(stops).toHaveLength(1);

    stops[0].focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(el('Left'));
    await userEvent.keyboard('{ArrowRight}');
    // the disabled Top is skipped
    expect(document.activeElement).toBe(el('Back'));
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(el('Front'));
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(el('Back'));
    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(el('Front'));
    await userEvent.keyboard('{End}');
    expect(document.activeElement).toBe(el('Back'));
    expect(onpress).not.toHaveBeenCalled();
  });

  test('Enter, Space and a click press the focused button', async () => {
    const onpress = vi.fn();
    render(ToggleToolbar, props({ onpress }));
    el('Left').focus();
    await userEvent.keyboard('{Enter}');
    expect(onpress).toHaveBeenLastCalledWith('left');
    await userEvent.keyboard(' ');
    expect(onpress).toHaveBeenCalledTimes(2);
    await button('Back').click();
    expect(onpress).toHaveBeenLastCalledWith('back');
  });

  test('the parent decides what is pressed', async () => {
    let pressed = $state('front');
    render(ToggleToolbar, {
      ...props(),
      get pressed() {
        return pressed;
      },
    });
    expect(el('Front').getAttribute('aria-pressed')).toBe('true');
    expect(el('Front').getAttribute('aria-pressed')).toBe('true');
    pressed = 'back';
    await vi.waitFor(() => expect(el('Back').getAttribute('aria-pressed')).toBe('true'));
    expect(el('Front').getAttribute('aria-pressed')).toBe('false');
  });

  test('an icon is decorative and the label names the button', async () => {
    render(
      ToggleToolbar,
      props({ items: [{ value: 'axial', label: 'Axial', icon: 'cut-axial' }], pressed: 'axial' }),
    );
    await expect.element(button('Axial')).toBeVisible();
    const svg = el('Axial').querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.querySelector('path')?.getAttribute('d')).toBe('M4 14.5 9 9.5h11l-5 5Z');
  });

  test('buttons carry no own-keys marker (the region does) and are at least 24 px', async () => {
    render(ToggleToolbar, props());
    expect(document.querySelectorAll('[data-own-keys]')).toHaveLength(0);
    for (const b of document.querySelectorAll('button')) {
      const box = b.getBoundingClientRect();
      expect(box.width).toBeGreaterThanOrEqual(24);
      expect(box.height).toBeGreaterThanOrEqual(24);
    }
  });

  test('forced colours mark the pressed button with a system-colour outline', async () => {
    render(ToggleToolbar, props({ pressed: 'left' }));
    await withMedia([{ name: 'forced-colors', value: 'active' }], () => {
      expect(getComputedStyle(el('Left')).outlineStyle).toBe('solid');
      expect(getComputedStyle(el('Front')).outlineStyle).not.toBe('solid');
    });
  });

  test('increased contrast insets a border in the track (a11y.css:43)', async () => {
    render(ToggleToolbar, props());
    const track = document.querySelector('[role=toolbar]')!;
    expect(getComputedStyle(track).boxShadow).toBe('none');
    await withMedia([{ name: 'prefers-contrast', value: 'more' }], () => {
      expect(getComputedStyle(track).boxShadow).toContain('inset');
    });
  });

  const stops = () => [...document.querySelectorAll<HTMLElement>('button')].map((b) => b.tabIndex);

  test('the Tab stop is the pressed button until focus moves it', async () => {
    render(ToggleToolbar, props({ pressed: 'back' }));
    expect(stops()).toEqual([-1, -1, -1, 0]);
  });

  test('the Tab stop follows a pointer click', async () => {
    render(ToggleToolbar, props());
    await button('Left').click();
    expect(stops()).toEqual([-1, 0, -1, -1]);
  });

  test('a disabled Tab stop moves to an enabled button', async () => {
    let disabled = $state(false);
    render(ToggleToolbar, {
      ...props({ pressed: 'left' }),
      get items() {
        return presets.map((p) => (p.value === 'left' ? { ...p, disabled } : p));
      },
    });
    expect(stops()).toEqual([-1, 0, -1, -1]);
    disabled = true;
    await vi.waitFor(() => expect(stops()).toEqual([0, -1, -1, -1]));
  });

  test('ArrowUp and ArrowDown move like Left and Right and are handled', async () => {
    render(ToggleToolbar, props());
    const handled = vi.fn((event: KeyboardEvent) => event.defaultPrevented);
    document.addEventListener('keydown', handled);
    el('Front').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(el('Left'));
    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(el('Front'));
    document.removeEventListener('keydown', handled);
    expect(handled.mock.results.map((r) => r.value)).toEqual([true, true]);
  });

  test('axe: light and dark, desktop and 390 px', async () => {
    render(ToggleToolbar, props());
    await expectAxeClean();
  });
});
