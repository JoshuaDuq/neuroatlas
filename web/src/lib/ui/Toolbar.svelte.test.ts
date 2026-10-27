// Toolbar against the APG Toolbar keyboard table.
import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { expectAxeClean } from './a11y-test-support.ts';
import Fixture from './toolbar-test-fixture.svelte';

const button = (name: string) => page.getByRole('button', { name });
const el = (name: string) => button(name).element() as HTMLElement;

describe('Toolbar', () => {
  test('has role toolbar and a name; a plain command has no aria-pressed', async () => {
    render(Fixture, { onpress: () => {} });
    await expect.element(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible();
    expect(el('Snapshot').hasAttribute('aria-pressed')).toBe(false);
    expect(el('Key').getAttribute('aria-pressed')).toBe('false');
  });

  test('one Tab stop; arrows and Home/End move focus (wrapping, skipping disabled)', async () => {
    render(Fixture, { onpress: () => {} });
    const stops = [...document.querySelectorAll<HTMLElement>('button')].filter(
      (b) => b.tabIndex === 0,
    );
    expect(stops).toHaveLength(1);
    stops[0].focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(el('Key'));
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(el('More'));
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(el('Snapshot'));
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(el('More'));
    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(el('Snapshot'));
    await userEvent.keyboard('{End}');
    expect(document.activeElement).toBe(el('More'));
  });

  test('Enter and Space activate; a toggle reflects its pressed state', async () => {
    const onpress = vi.fn();
    render(Fixture, { onpress });
    el('Snapshot').focus();
    await userEvent.keyboard('{Enter}');
    expect(onpress).toHaveBeenCalledWith('snapshot');
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard(' ');
    expect(el('Key').getAttribute('aria-pressed')).toBe('true');
    await userEvent.keyboard('{Enter}');
    expect(el('Key').getAttribute('aria-pressed')).toBe('false');
  });

  test('an icon-only button is named by label', async () => {
    render(Fixture, { onpress: () => {} });
    await expect.element(button('More')).toBeVisible();
  });

  test('axe: light and dark, desktop and 390 px', async () => {
    render(Fixture, { onpress: () => {} });
    await expectAxeClean();
  });
});
