// The coordinate entry: every published space and the unstated choice are offered, and what cannot
// be read or lies beyond the template's brain is said under the field instead of being placed.
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import type { LesionStore } from '../../lib/state/lesion.svelte.ts';
import type { CoordinateSpaces } from '../../lib/types/index.ts';
import CoordinatePopover from './CoordinatePopover.svelte';

const metadata = {
  spaces: [
    { id: 'mni152nlin2009casym', label: 'MNI152NLin2009cAsym', description: 'fMRIPrep' },
    { id: 'spm12', label: 'SPM12 (TPM)', description: 'SPM12' },
  ],
} as unknown as CoordinateSpaces;

const lesion = {
  kind: 'lesion',
  sphere: null,
  coordinate: null,
  remove() {},
} as unknown as LesionStore;

afterEach(() => cleanup());

function mount(place: (entered: number[], space: string) => Promise<boolean>) {
  const spy = vi.fn(place);
  render(CoordinatePopover, {
    lesion,
    placement: { metadata, place: spy },
    lang: 'en',
    onReport() {},
  });
  const field = document.querySelector<HTMLInputElement>('input[type="text"]')!;
  const select = document.querySelector('select')!;
  const button = [...document.querySelectorAll('button')].find((b) => b.type === 'submit')!;
  return { spy, field, select, button };
}

const alert = () => document.querySelector('[role="alert"]')?.textContent ?? null;

test('offers each published space by its label, then the unstated choice, which it starts on', () => {
  const { select } = mount(async () => true);
  expect([...select.options].map((option) => [option.value, option.text])).toEqual([
    ['mni152nlin2009casym', 'MNI152NLin2009cAsym'],
    ['spm12', 'SPM12 (TPM)'],
    ['unstated', 'MNI, template not stated'],
  ]);
  expect(select.value).toBe('unstated');
  expect(document.body.textContent).toContain(
    'MNI152 coordinates only; Talairach and other spaces are not accepted.',
  );
});

test('places a pasted coordinate in the chosen space', async () => {
  const { spy, field, select, button } = mount(async () => true);
  await userEvent.fill(field, '(−42\t22\t6)');
  await userEvent.selectOptions(select, 'spm12');
  await userEvent.click(button);
  expect(spy).toHaveBeenCalledWith([-42, 22, 6], 'spm12');
  expect(alert()).toBe(null);
});

test('says what it could not read, and does not place it', async () => {
  const { spy, field, button } = mount(async () => true);
  await userEvent.fill(field, '-42, 22');
  await userEvent.click(button);
  expect(alert()).toBe('Enter three numbers, x, y, z, in millimetres.');
  expect(field.getAttribute('aria-invalid')).toBe('true');
  expect(spy).not.toHaveBeenCalled();
});

test('says when the coordinate lies beyond the template’s brain', async () => {
  const { field, button } = mount(async () => false);
  await userEvent.fill(field, '90, 0, 0');
  await userEvent.click(button);
  await expect
    .poll(alert)
    .toBe('This coordinate lies beyond the template’s brain, so it is not placed.');
});
