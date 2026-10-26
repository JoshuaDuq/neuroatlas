// The system picker against the legacy internal-anatomy.js cases and decision 36 on #4, as
// behaviour in Chromium: the options, the choice, and a select that always shows the display's own
// system (deviations/a3-system-value-sync.md).
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import type { Region } from '../../lib/types/index.ts';
import { expectAxeClean } from '../../lib/ui/a11y-test-support.ts';
import { systemOptions } from './system-options.ts';
import Fixture from './system-picker-test-support.svelte';

type Props = Parameters<typeof render<typeof Fixture>>[1];

const structure = (id: string, source: string, atlas = 'aseg'): Region =>
  ({ id, label: id, hemisphere: 'left', kind: 'structure', source_name: source, atlas }) as Region;

const REGIONS: Region[] = [
  structure('a:ventricle', '3rd-Ventricle'),
  structure('a:left-caudate', 'Left-Caudate'),
  structure('a:right-caudate', 'Right-Caudate'),
  structure('a:hippocampus', 'Left-Hippocampus'),
  // Another detail level's structure, and a cortical area: neither is a system of this list.
  structure('n:cerebellum', 'Left-Cerebellum-Cortex', 'aseg-fine'),
  { id: 'd:1', label: 'd:1', hemisphere: 'left', kind: 'cortex', atlas: 'aseg' } as Region,
];

const mount = (props: Partial<NonNullable<Props>> = {}) => {
  const calls: string[] = [];
  render(Fixture, { calls, regions: REGIONS, ...props });
  return calls;
};
const select = () => page.getByRole('combobox', { name: /^(System|Système)$/ });
const field = () => select().element() as HTMLSelectElement;
const texts = () => [...field().options].map((option) => option.textContent);
const values = () => [...field().options].map((option) => option.value);

beforeEach(async () => {
  await page.viewport(1280, 800);
});
afterEach(() => cleanup());

describe('the options', () => {
  test('all systems first, then each system of this detail level once, sorted by its shown name', () => {
    expect(
      systemOptions(REGIONS, 'aseg', 'en', new Set()).map(({ value, label }) => [value, label]),
    ).toEqual([
      ['Basal ganglia', 'Basal ganglia'],
      ['Limbic', 'Limbic'],
      ['Ventricles and CSF', 'Ventricles and CSF'],
    ]);
    expect(systemOptions(REGIONS, 'aseg-fine', 'en', new Set()).map((o) => o.value)).toEqual([
      'Cerebellum',
    ]);
    mount();
    expect(texts()).toEqual([
      'All internal structures',
      'Basal ganglia',
      'Limbic',
      'Ventricles and CSF',
    ]);
    expect(values()).toEqual(['', 'Basal ganglia', 'Limbic', 'Ventricles and CSF']);
  });

  test('French: shown in French and sorted by it, still keyed by the English group name', () => {
    mount({ lang: 'fr' });
    expect(texts()).toEqual([
      'Toutes les structures internes',
      'Ganglions de la base',
      'Limbique',
      'Ventricules et LCS',
    ]);
    expect(values()).toEqual(['', 'Basal ganglia', 'Limbic', 'Ventricles and CSF']);
  });

  test('a name another vocabulary shares says which system it is, and sorts under that name', () => {
    mount({ shared: new Set(['Limbic']) });
    expect(texts()).toEqual([
      'All internal structures',
      'Basal ganglia',
      'Limbic system',
      'Ventricles and CSF',
    ]);
    cleanup();
    // The shared names are the language's own, as the tree names them.
    mount({ lang: 'fr', shared: new Set(['Limbique']) });
    expect(texts()).toEqual([
      'Toutes les structures internes',
      'Ganglions de la base',
      'Système limbique',
      'Ventricules et LCS',
    ]);
    expect(values()[2]).toBe('Limbic');
  });

  test('another detail level lists its own systems', () => {
    mount({ detail: 'aseg-fine' });
    expect(values()).toEqual(['', 'Cerebellum']);
  });
});

describe('the field', () => {
  test('a visible label names the select, and a click on the label focuses it', async () => {
    mount();
    expect(document.querySelector('label')!.textContent).toBe('System');
    (document.querySelector('label') as HTMLElement).click();
    expect(document.activeElement).toBe(field());
    cleanup();
    mount({ lang: 'fr' });
    expect(field().labels![0].textContent).toBe('Système');
  });

  test('it shows the display’s system, all of them when there is none', () => {
    mount();
    expect(field().value).toBe('');
    cleanup();
    mount({ value: 'Limbic' });
    expect(field().value).toBe('Limbic');
  });

  test('it follows the display when another control changes the system', async () => {
    mount();
    (document.getElementById('set-limbic') as HTMLElement).click();
    await expect.poll(() => field().value).toBe('Limbic');
  });

  test('choosing a system or all of them calls the command with it, or with null', async () => {
    const calls = mount({ value: 'Limbic' });
    await select().selectOptions('Basal ganglia');
    await select().selectOptions('');
    expect(calls).toEqual(['Basal ganglia', 'null']);
    expect(field().value).toBe('');
  });

  test('a choice the display did not take (a failed or overtaken command) is put back', async () => {
    const calls = mount({ value: 'Limbic', accepts: false });
    await select().selectOptions('Basal ganglia');
    expect(calls).toEqual(['Basal ganglia']);
    await expect.poll(() => field().value).toBe('Limbic');
  });

  test('it is disabled while an atlas or detail level loads', () => {
    mount({ switching: true });
    expect(field().disabled).toBe(true);
    cleanup();
    mount();
    expect(field().disabled).toBe(false);
  });

  test('Tab reaches it, and a letter chooses by type-ahead through the same command', async () => {
    const calls = mount();
    await userEvent.tab();
    expect(document.activeElement).toBe(field());
    await userEvent.keyboard('v');
    await expect.poll(() => field().value).toBe('Ventricles and CSF');
    expect(calls).toEqual(['Ventricles and CSF']);
  });
});

describe('size, reflow and accessibility', () => {
  test('the select is at least 24 px tall', () => {
    mount();
    expect(field().getBoundingClientRect().height).toBeGreaterThanOrEqual(24);
  });

  test('320 px, 200 % text and text spacing: label beside field, nothing spills or is clipped', async () => {
    mount({ lang: 'fr' });
    await page.viewport(320, 700);
    document.documentElement.style.fontSize = '200%';
    const spacing = document.head.appendChild(document.createElement('style'));
    spacing.textContent =
      '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }';
    try {
      const picker = document.querySelector<HTMLElement>('.system-picker')!;
      expect(picker.scrollWidth).toBeLessThanOrEqual(picker.clientWidth + 1);
      const box = field().getBoundingClientRect();
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(window.innerWidth);
      expect(box.width).toBeGreaterThan(0);
    } finally {
      spacing.remove();
      document.documentElement.style.fontSize = '';
    }
  });

  test('axe: light and dark, desktop and phone, in English and French', async () => {
    mount({ value: 'Limbic' });
    await expectAxeClean();
    cleanup();
    mount({ lang: 'fr' });
    await expectAxeClean();
  });
});
