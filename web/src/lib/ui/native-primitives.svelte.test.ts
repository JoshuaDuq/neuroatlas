// U4: the native and content primitives against their keyboard tables and axe.
import axe from 'axe-core';
import { createRawSnippet, tick } from 'svelte';
import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { decimal, millimetres, percent } from '../core/format.ts';
import '../../styles/index.css';
import CheckboxGroup from './CheckboxGroup.svelte';
import Disclosure from './Disclosure.svelte';
import DrillRow from './DrillRow.svelte';
import EmptyState from './EmptyState.svelte';
import Progress from './Progress.svelte';
import RangeField from './RangeField.svelte';
import SearchBridge from './SearchBridge.svelte';
import Select from './Select.svelte';
import StatusLine from './StatusLine.svelte';
import Swatch from './Swatch.svelte';
import { scrollToTop, showOpenedRegion } from './scroll.ts';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

async function expectAxeClean() {
  const results = await axe.run(document.body, {
    runOnly: WCAG,
    rules: { region: { enabled: false } },
  });
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' ')}`)).toEqual(
    [],
  );
}

const focus = (locator: { element(): Element }) => (locator.element() as HTMLElement).focus();

describe('RangeField', () => {
  const props = (over: Record<string, unknown> = {}) => ({
    label: 'Position',
    value: 0,
    min: -128,
    max: 128,
    step: 0.5,
    format: (v: number) => millimetres(v, 'fr'),
    numberLabel: 'Exact position in millimetres',
    rangeMessage: 'Enter a value from −128 to 128 mm.',
    ...over,
  });

  test('aria-valuetext carries locale, minus sign and unit; the readout follows', async () => {
    render(RangeField, props({ value: -12.5 }));
    const range = page.getByRole('slider', { name: 'Position' });
    expect(range.element().getAttribute('aria-valuetext')).toBe('−12,5 mm');
    expect(document.querySelector('output')?.textContent).toBe('−12,5 mm');
  });

  test('arrows step, PageUp and PageDown take the larger step, input and change both report', async () => {
    const oninput = vi.fn();
    const onchange = vi.fn();
    render(RangeField, props({ min: 0, max: 100, step: 1, value: 50, oninput, onchange }));
    const range = page.getByRole('slider', { name: 'Position' });
    focus(range);
    await userEvent.keyboard('{ArrowRight}');
    expect(oninput).toHaveBeenLastCalledWith(51);
    expect(onchange).toHaveBeenLastCalledWith(51);
    await userEvent.keyboard('{PageUp}');
    const afterPageUp = (range.element() as HTMLInputElement).valueAsNumber;
    expect(afterPageUp).toBeGreaterThan(52);
    await userEvent.keyboard('{PageDown}');
    expect((range.element() as HTMLInputElement).valueAsNumber).toBeLessThan(afterPageUp);
    await userEvent.keyboard('{End}');
    expect((range.element() as HTMLInputElement).valueAsNumber).toBe(100);
    await userEvent.keyboard('{Home}');
    expect((range.element() as HTMLInputElement).valueAsNumber).toBe(0);
  });

  test('a value pushed in while the slider has focus does not move it; it catches up on blur', async () => {
    const live = $state(props({ min: 0, max: 100, step: 1, value: 10 }));
    render(RangeField, live);
    const range = page.getByRole('slider', { name: 'Position' });
    focus(range);
    await userEvent.keyboard('{ArrowRight}');
    live.value = 80;
    await tick();
    expect((range.element() as HTMLInputElement).valueAsNumber).toBe(11);
    (range.element() as HTMLElement).blur();
    await vi.waitFor(() => expect((range.element() as HTMLInputElement).valueAsNumber).toBe(80));
  });

  test('the number field commits a valid value and restores the value when emptied', async () => {
    const onchange = vi.fn();
    render(RangeField, props({ value: 3, onchange }));
    const number = page.getByRole('spinbutton', { name: 'Exact position in millimetres' });
    await number.fill('10');
    await userEvent.keyboard('{Enter}');
    expect(onchange).toHaveBeenLastCalledWith(10);
    expect((page.getByRole('slider').element() as HTMLInputElement).valueAsNumber).toBe(10);

    await number.fill('');
    await userEvent.keyboard('{Enter}');
    expect(onchange).toHaveBeenCalledTimes(1);
    expect((number.element() as HTMLInputElement).value).toBe('10.0');
  });

  test('a value out of range is not applied and is explained (WCAG 3.3.1)', async () => {
    const onchange = vi.fn();
    render(RangeField, props({ onchange }));
    const number = page.getByRole('spinbutton', { name: 'Exact position in millimetres' });
    await number.fill('900');
    await userEvent.keyboard('{Enter}');
    expect(onchange).not.toHaveBeenCalled();
    expect(number.element().getAttribute('aria-invalid')).toBe('true');
    const message = page.getByText('Enter a value from −128 to 128 mm.');
    await expect.element(message).toBeInTheDocument();
    expect(number.element().getAttribute('aria-describedby')).toBe(message.element().id);
    await expectAxeClean();
  });

  test('is axe clean, disabled and enabled', async () => {
    render(RangeField, props());
    await expectAxeClean();
    document.body.innerHTML = '';
    render(RangeField, props({ disabled: true, format: (v: number) => percent(v / 100, 'en') }));
    await expectAxeClean();
  });
});

describe('Select', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
  ];

  test('is a native combobox named by its label; the keyboard changes the value', async () => {
    const onchange = vi.fn();
    render(Select, { label: 'Atlas', options, value: 'a', onchange });
    const select = page.getByRole('combobox', { name: 'Atlas' });
    expect(select.element().tagName).toBe('SELECT');
    await userEvent.selectOptions(select, 'b');
    expect(onchange).toHaveBeenLastCalledWith('b');
    await expectAxeClean();
  });
});

describe('Disclosure', () => {
  const children = createRawSnippet(() => ({ render: () => '<p>Body</p>' }));

  test('is a native details: Enter and Space toggle, open is bindable and survives a rerender', async () => {
    const live = $state<{
      summary: string;
      children: typeof children;
      variant: 'inline' | 'section';
    }>({
      summary: 'Method and sources',
      children,
      variant: 'inline',
    });
    render(Disclosure, live);
    const summary = page.getByText('Method and sources');
    const details = document.querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    focus(summary);
    await userEvent.keyboard('{Enter}');
    expect(details.open).toBe(true);
    await userEvent.keyboard(' ');
    expect(details.open).toBe(false);
    await userEvent.keyboard('{Enter}');
    live.variant = 'section';
    await tick();
    expect((document.querySelector('details') as HTMLDetailsElement).open).toBe(true);
    await expectAxeClean();
  });
});

describe('Progress', () => {
  test('is a native progressbar with a name, determinate and indeterminate', async () => {
    render(Progress, { label: 'Anatomy download', value: 0.4 });
    const bar = page.getByRole('progressbar', { name: 'Anatomy download' });
    expect((bar.element() as HTMLProgressElement).value).toBe(0.4);
    await expectAxeClean();
    document.body.innerHTML = '';
    render(Progress, { label: 'Anatomy download' });
    expect(document.querySelector('progress')?.hasAttribute('value')).toBe(false);
    await expectAxeClean();
  });
});

describe('CheckboxGroup', () => {
  test('a fieldset named by its legend; Space toggles, Tab walks the boxes', async () => {
    const onchange = vi.fn();
    render(CheckboxGroup, {
      legend: 'Hemispheres',
      items: [
        { value: 'l', label: 'Left' },
        { value: 'r', label: 'Right' },
        { value: 'x', label: 'Locked', disabled: true },
      ],
      values: ['l'],
      onchange,
    });
    await expect.element(page.getByRole('group', { name: 'Hemispheres' })).toBeInTheDocument();
    const left = page.getByRole('checkbox', { name: 'Left' });
    const right = page.getByRole('checkbox', { name: 'Right' });
    expect((left.element() as HTMLInputElement).checked).toBe(true);
    focus(left);
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(right.element());
    await userEvent.keyboard(' ');
    expect(onchange).toHaveBeenLastCalledWith(['l', 'r']);
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).not.toBe(
      page.getByRole('checkbox', { name: 'Locked' }).element(),
    );
    await expectAxeClean();
  });
});

describe('content primitives', () => {
  test('DrillRow and SearchBridge are buttons: Enter and Space activate', async () => {
    const open = vi.fn();
    const bridge = vi.fn();
    render(DrillRow, { name: 'Aphasia', secondary: 'Language', onclick: open });
    render(SearchBridge, { text: '3 matches in Functions', onclick: bridge });
    focus(page.getByRole('button', { name: /Aphasia/ }));
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(open).toHaveBeenCalledTimes(2);
    focus(page.getByRole('button', { name: /3 matches/ }));
    await userEvent.keyboard('{Enter}');
    expect(bridge).toHaveBeenCalledTimes(1);
    await expectAxeClean();
  });

  test('StatusLine is a status region and an identical sentence is not rewritten', async () => {
    const live = $state({ text: '12 results' });
    render(StatusLine, live);
    const line = page.getByRole('status');
    const writes: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) writes.push(record.type);
    });
    observer.observe(line.element(), { childList: true, characterData: true, subtree: true });
    live.text = '12 results';
    await tick();
    expect(observer.takeRecords()).toEqual([]);
    live.text = `${decimal(3, 0, 'en')} results`;
    await tick();
    await vi.waitFor(() => expect(line.element().textContent).toBe('3 results'));
    observer.disconnect();
    await expectAxeClean();
  });

  test('EmptyState names the query and offers the action as a button', async () => {
    const onaction = vi.fn();
    render(EmptyState, {
      title: 'No match for "xyz"',
      message: 'See the other tab.',
      actionLabel: 'Search Functions',
      onaction,
    });
    await page.getByRole('button', { name: 'Search Functions' }).click();
    expect(onaction).toHaveBeenCalledOnce();
    await expectAxeClean();
  });

  test('Swatch is decorative: hidden from the accessibility tree', async () => {
    render(Swatch, { colour: '#336699' });
    render(Swatch, { kind: 'bar', share: 0.4 });
    for (const node of document.querySelectorAll('.network-swatch, .network-bar')) {
      expect(node.getAttribute('aria-hidden')).toBe('true');
    }
    const fill = document.querySelector('.network-bar > span') as HTMLElement;
    expect(fill.style.width).toBe('40%');
  });
});

describe('themes and phone width', () => {
  test.each([['light'], ['dark']])(
    'every primitive is axe clean in %s at 390 px',
    async (theme) => {
      document.documentElement.dataset.theme = theme;
      await page.viewport(390, 800);
      const children = createRawSnippet(() => ({ render: () => '<p>Body</p>' }));
      render(RangeField, {
        label: 'Opacité',
        value: 0.5,
        min: 0,
        max: 1,
        step: 0.05,
        format: (v: number) => percent(v, 'fr'),
        numberLabel: 'Valeur exacte',
      });
      render(Select, { label: 'Atlas', options: [{ value: 'a', label: 'Alpha' }], value: 'a' });
      render(Disclosure, { summary: 'Méthode et sources', children, open: true });
      render(CheckboxGroup, { legend: 'Hémisphères', items: [{ value: 'l', label: 'Gauche' }] });
      render(DrillRow, { name: 'Aphasie', secondary: 'Langage', onclick: () => {} });
      render(EmptyState, { message: 'Aucun résultat.' });
      await expectAxeClean();
      delete document.documentElement.dataset.theme;
    },
  );
});

describe('scroll helpers', () => {
  test('scrollToTop resets every scrolling ancestor', () => {
    const outer = document.createElement('div');
    outer.style.cssText = 'height:50px;overflow-y:auto';
    const inner = document.createElement('div');
    inner.style.height = '500px';
    const target = document.createElement('p');
    inner.append(target);
    outer.append(inner);
    document.body.append(outer);
    outer.scrollTop = 100;
    expect(outer.scrollTop).toBe(100);
    scrollToTop(target);
    expect(outer.scrollTop).toBe(0);
    outer.remove();
  });

  test('showOpenedRegion focuses a visible name and ignores a hidden or absent one', () => {
    const name = document.createElement('h2');
    document.body.append(name);
    showOpenedRegion(name);
    expect(document.activeElement).toBe(name);
    name.blur();
    name.hidden = true;
    showOpenedRegion(name);
    expect(document.activeElement).not.toBe(name);
    expect(() => showOpenedRegion(null)).not.toThrow();
    name.remove();
  });
});
