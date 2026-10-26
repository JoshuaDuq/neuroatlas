// ChoiceGroup against the APG Radio Group keyboard table (decision 0003).
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { expectAxeClean, withMedia } from './a11y-test-support.ts';
import ChoiceGroup from './ChoiceGroup.svelte';

const hemispheres = [
  { value: 'both', label: 'Both' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];
const radio = (name: string) => page.getByRole('radio', { name });
const el = (name: string) => radio(name).element() as HTMLElement;
const checked = () =>
  [...document.querySelectorAll('[role=radio]')]
    .filter((r) => r.getAttribute('aria-checked') === 'true')
    .map((r) => r.textContent?.trim());

describe('ChoiceGroup', () => {
  test('is a radiogroup named by its label with one Tab stop on the checked item', async () => {
    render(ChoiceGroup, { options: hemispheres, value: 'left', label: 'Hemisphere' });
    await expect.element(page.getByRole('radiogroup', { name: 'Hemisphere' })).toBeVisible();
    expect(checked()).toEqual(['Left']);
    expect(el('Left').tabIndex).toBe(0);
    expect(el('Both').tabIndex).toBe(-1);
    expect(el('Right').tabIndex).toBe(-1);
  });

  test('aria-labelledby names the group from a visible label', async () => {
    const visible = document.body.appendChild(document.createElement('span'));
    visible.id = 'cg-label';
    visible.textContent = 'Show hemisphere';
    render(ChoiceGroup, { options: hemispheres, value: 'both', labelledby: 'cg-label' });
    await expect.element(page.getByRole('radiogroup', { name: 'Show hemisphere' })).toBeVisible();
    visible.remove();
  });

  test('arrows move AND select, all four directions, wrapping', async () => {
    render(ChoiceGroup, { options: hemispheres, value: 'both', label: 'Hemisphere' });
    el('Both').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(el('Left'));
    expect(checked()).toEqual(['Left']);
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(el('Right'));
    expect(checked()).toEqual(['Right']);
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(el('Both'));
    expect(checked()).toEqual(['Both']);
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(el('Right'));
    expect(checked()).toEqual(['Right']);
    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(el('Left'));
    expect(checked()).toEqual(['Left']);
  });

  test('Tab leaves the group from the checked item; Shift+Tab re-enters on it', async () => {
    render(ChoiceGroup, { options: hemispheres, value: 'both', label: 'Hemisphere' });
    const after = document.body.appendChild(document.createElement('button'));
    after.textContent = 'After';
    el('Both').focus();
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.tab();
    expect(document.activeElement).toBe(after);
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(el('Left'));
    after.remove();
  });

  test('Space and a click select; a disabled option is skipped', async () => {
    render(ChoiceGroup, {
      options: [
        { value: 'axial', label: 'Axial' },
        { value: 'coronal', label: 'Coronal', disabled: true },
        { value: 'sagittal', label: 'Sagittal' },
      ],
      value: 'axial',
      label: 'Plane',
    });
    el('Axial').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(el('Sagittal'));
    expect(checked()).toEqual(['Sagittal']);
    await radio('Axial').click();
    expect(checked()).toEqual(['Axial']);
    el('Sagittal').focus();
    expect(checked()).toEqual(['Axial']);
    await userEvent.keyboard(' ');
    expect(checked()).toEqual(['Sagittal']);
  });

  test('an abbreviated label keeps its full accessible name, which contains the text', async () => {
    render(ChoiceGroup, {
      options: [
        { value: 'en', label: 'EN', name: 'English' },
        { value: 'fr', label: 'FR', name: 'Français' },
      ],
      value: 'en',
      label: 'Language',
    });
    await expect.element(radio('English')).toHaveTextContent('EN');
    await expect.element(radio('Français')).toHaveTextContent('FR');
  });

  test('items carry no own-keys marker: the region does (conductor decision 7)', async () => {
    render(ChoiceGroup, { options: hemispheres, value: 'both', label: 'Hemisphere' });
    expect(document.querySelectorAll('[data-own-keys]')).toHaveLength(0);
  });

  test('targets are at least 24 CSS px', async () => {
    render(ChoiceGroup, { options: hemispheres, value: 'both', label: 'Hemisphere' });
    for (const item of document.querySelectorAll('[role=radio]')) {
      const box = item.getBoundingClientRect();
      expect(box.width).toBeGreaterThanOrEqual(24);
      expect(box.height).toBeGreaterThanOrEqual(24);
    }
  });

  test('forced colours mark the checked item with a system-colour outline', async () => {
    render(ChoiceGroup, { options: hemispheres, value: 'left', label: 'Hemisphere' });
    await withMedia([{ name: 'forced-colors', value: 'active' }], () => {
      const style = getComputedStyle(el('Left'));
      expect(style.outlineStyle).toBe('solid');
      expect(style.outlineWidth).toBe('2px');
      expect(getComputedStyle(el('Both')).outlineStyle).not.toBe('solid');
    });
  });

  test('increased contrast insets a border in the track (a11y.css:43)', async () => {
    render(ChoiceGroup, { options: hemispheres, value: 'left', label: 'Hemisphere' });
    const track = document.querySelector('[role=radiogroup]')!;
    expect(getComputedStyle(track).boxShadow).toBe('none');
    await withMedia([{ name: 'prefers-contrast', value: 'more' }], () => {
      expect(getComputedStyle(track).boxShadow).toContain('inset');
    });
  });

  test('axe: light and dark, desktop and 390 px', async () => {
    render(ChoiceGroup, { options: hemispheres, value: 'left', label: 'Hemisphere' });
    await expectAxeClean();
  });
});
