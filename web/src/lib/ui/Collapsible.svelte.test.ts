// Collapsible against the APG Disclosure pattern.
import { createRawSnippet } from 'svelte';
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { expectAxeClean, withMedia } from './a11y-test-support.ts';
import Collapsible from './Collapsible.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>Provenance details</p>' }));
const trigger = () => page.getByRole('button', { name: 'Provenance' });
const el = () => trigger().element() as HTMLElement;
const props = (extra = {}) => ({ title: 'Provenance', children, ...extra });

describe('Collapsible', () => {
  test('closed: aria-expanded false and the content is not exposed', async () => {
    render(Collapsible, props());
    expect(el().getAttribute('aria-expanded')).toBe('false');
    await expect.element(page.getByText('Provenance details')).not.toBeVisible();
  });

  test('Enter and Space toggle it and aria-controls points at the region', async () => {
    render(Collapsible, props());
    el().focus();
    await userEvent.keyboard('{Enter}');
    expect(el().getAttribute('aria-expanded')).toBe('true');
    await expect.element(page.getByText('Provenance details')).toBeVisible();
    const region = document.getElementById(el().getAttribute('aria-controls') ?? '');
    expect(region?.textContent).toContain('Provenance details');
    await userEvent.keyboard(' ');
    expect(el().getAttribute('aria-expanded')).toBe('false');
    await expect.element(page.getByText('Provenance details')).not.toBeVisible();
  });

  test('a click toggles and focus stays on the trigger', async () => {
    render(Collapsible, props());
    await trigger().click();
    expect(el().getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(el());
  });

  test('can start open', async () => {
    render(Collapsible, props({ open: true }));
    expect(el().getAttribute('aria-expanded')).toBe('true');
    await expect.element(page.getByText('Provenance details')).toBeVisible();
  });

  test('reduced motion: the chevron turns at once', async () => {
    render(Collapsible, props());
    const chevron = document.querySelector('.collapsible-chevron') as HTMLElement;
    expect(getComputedStyle(chevron).transitionDuration).not.toBe('0s');
    await withMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }], () => {
      expect(getComputedStyle(chevron).transitionDuration).toBe('0s');
    });
  });

  test('axe: light and dark, desktop and 390 px, closed and open', async () => {
    render(Collapsible, props());
    await expectAxeClean();
    await trigger().click();
    await expectAxeClean();
  });
});
