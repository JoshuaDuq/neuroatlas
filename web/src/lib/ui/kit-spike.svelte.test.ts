// U0 spike: Bits UI 2.20.2 checked against the WAI-ARIA APG patterns the decision
// records (web/docs/decisions) rely on. Fixture: docs/decisions/kit-spike/Spike.svelte.
import axe from 'axe-core';
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import Spike from '../../../docs/decisions/kit-spike/Spike.svelte';

const radio = (name: string) => page.getByRole('radio', { name });
const attr = (locator: { element(): Element }, name: string) =>
  locator.element().getAttribute(name);

describe('Bits UI against the APG', () => {
  test('RadioGroup: arrows move and select, one tab stop on the checked item', async () => {
    render(Spike);
    const en = radio('English');
    const fr = radio('Francais');
    await expect.element(page.getByRole('radiogroup')).toBeInTheDocument();
    expect(attr(en, 'aria-checked')).toBe('true');
    expect(attr(en, 'tabindex')).toBe('0');
    expect(attr(fr, 'tabindex')).toBe('-1');

    (en.element() as HTMLElement).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(fr.element());
    expect(attr(fr, 'aria-checked')).toBe('true');
    expect(attr(en, 'aria-checked')).toBe('false');

    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(en.element());
    expect(attr(en, 'aria-checked')).toBe('true');
  });

  test('Toolbar.Button: roving focus moves without pressing, Enter presses', async () => {
    render(Spike);
    const front = page.getByRole('button', { name: 'front' });
    const left = page.getByRole('button', { name: 'left' });
    await expect.element(page.getByRole('toolbar', { name: 'View presets' })).toBeInTheDocument();
    expect(attr(front, 'tabindex')).toBe('0');
    expect(attr(left, 'tabindex')).toBe('-1');
    expect(attr(front, 'role')).toBeNull();

    (front.element() as HTMLElement).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(left.element());
    expect(attr(left, 'aria-pressed')).toBe('false');
    await userEvent.keyboard('{Enter}');
    expect(attr(left, 'aria-pressed')).toBe('true');
    expect(attr(front, 'aria-pressed')).toBe('false');
  });

  test('Tabs: manual activation moves focus on arrows and selects on Enter', async () => {
    render(Spike);
    const anatomy = page.getByRole('tab', { name: 'Anatomy' });
    const functions = page.getByRole('tab', { name: 'Functions' });
    expect(attr(anatomy, 'aria-selected')).toBe('true');
    expect(attr(anatomy, 'tabindex')).toBe('0');
    expect(attr(functions, 'tabindex')).toBe('-1');

    (anatomy.element() as HTMLElement).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(functions.element());
    expect(attr(functions, 'aria-selected')).toBe('false');
    await expect.element(page.getByRole('tabpanel')).toHaveTextContent('Anatomy panel');

    await userEvent.keyboard('{Enter}');
    expect(attr(functions, 'aria-selected')).toBe('true');
    await expect.element(page.getByRole('tabpanel')).toHaveTextContent('Functions panel');
    expect(attr(page.getByRole('tabpanel'), 'aria-labelledby')).toBe(functions.element().id);
  });

  test('Popover: disclosure state, Escape closes and returns focus to the trigger', async () => {
    render(Spike);
    const trigger = page.getByRole('button', { name: 'Settings' });
    expect(attr(trigger, 'aria-expanded')).toBe('false');
    await trigger.click();
    expect(attr(trigger, 'aria-expanded')).toBe('true');
    await expect.element(page.getByRole('button', { name: 'Provenance' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('button', { name: 'Provenance' })).not.toBeInTheDocument();
    expect(attr(trigger, 'aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger.element());
  });

  test('Tooltip: keyboard focus shows it, Escape hides it', async () => {
    render(Spike);
    const trigger = page.getByRole('button', { name: 'Snapshot' });
    await userEvent.tab();
    for (let i = 0; i < 20 && document.activeElement !== trigger.element(); i++)
      await userEvent.tab();
    expect(document.activeElement).toBe(trigger.element());
    await expect.element(page.getByRole('tooltip')).toHaveTextContent('Save a PNG');
    expect(attr(trigger, 'aria-describedby')).toBe(page.getByRole('tooltip').element().id);
    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('tooltip')).not.toBeInTheDocument();
  });

  test('Tooltip.Provider delays match the legacy timing', async () => {
    render(Spike);
    const trigger = page.getByRole('button', { name: 'Snapshot' }).element();
    expect(trigger.getAttribute('data-delay-duration')).toBe('500');
  });

  test('Combobox: focus stays on the input and aria-activedescendant names the option', async () => {
    render(Spike);
    const input = page.getByRole('combobox', { name: 'Search regions' });
    (input.element() as HTMLElement).focus();
    await userEvent.keyboard('{ArrowDown}');
    await expect.element(page.getByRole('listbox')).toBeInTheDocument();
    expect(attr(input, 'aria-expanded')).toBe('true');
    expect(attr(input, 'aria-autocomplete')).toBe('list');
    expect(document.activeElement).toBe(input.element());
    await userEvent.keyboard('{ArrowDown}');
    const active = attr(input, 'aria-activedescendant');
    expect(active).toBeTruthy();
    expect(document.getElementById(active!)?.getAttribute('role')).toBe('option');
    const label = document.getElementById(active!)!.textContent!.trim();
    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByText(label, { exact: true }).first()).toBeInTheDocument();
    expect(document.getElementById('picked')!.textContent).toBe(label);
  });

  test('axe finds no violations in any of the parts', async () => {
    render(Spike);
    await page.getByRole('button', { name: 'Settings' }).click();
    const results = await axe.run(document.body, { rules: { region: { enabled: false } } });
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' ')}`),
    ).toEqual([]);
  });
});
