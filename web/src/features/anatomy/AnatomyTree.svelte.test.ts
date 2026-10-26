// The anatomy tree against the APG Treegrid table, the legacy navigator.js cases
// (navigator.test.js; chrome.contract.test.js:431) and decision 32 on #4, as behaviour in Chromium.
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { cdp, page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import { currentItem } from '../../lib/core/workspace.ts';
import { expectAxeClean, withMedia } from '../../lib/ui/a11y-test-support.ts';
import { FOCUS_TARGETS, requestFocus } from '../../lib/ui/focus.ts';
import { GROUPS } from './anatomy-tree-test-support.ts';
import Fixture from './anatomy-tree-test-support.svelte';

type Props = Parameters<typeof render<typeof Fixture>>[1];

const ALL = GROUPS.map((group) => group.key);
const mount = (props: NonNullable<Props> = {}) => {
  const calls: string[] = [];
  render(Fixture, { calls, ...props });
  return calls;
};
const grid = () => document.querySelector<HTMLElement>('[role="treegrid"]')!;
const rows = () => [...grid().querySelectorAll<HTMLElement>('[role="row"]')];
const ids = () => rows().map((row) => row.dataset.id);
const row = (id: string) => rows().find((r) => r.dataset.id === id)!;
const eyes = (id: string) => [
  ...row(id).querySelectorAll<HTMLButtonElement>('.visibility-control'),
];
const active = () => document.activeElement as HTMLElement;
const focus = (id: string) => {
  row(id).focus();
  expect(active()).toBe(row(id));
};
const press = (keys: string) => userEvent.keyboard(keys);
const announced = () => document.getElementById('announcer')!.textContent;
const tabStops = () =>
  [...grid().querySelectorAll<HTMLElement>('[role="row"], button')].filter((e) => e.tabIndex === 0);

beforeEach(async () => {
  await page.viewport(1280, 800);
});
afterEach(() => cleanup());

describe('structure', () => {
  test('one named treegrid: a row per section and group, collapsed, with levels and states', () => {
    mount();
    expect(grid().getAttribute('aria-label')).toBe('Browse anatomy');
    expect(ids()).toEqual([
      'section:cortex',
      'cortex:Frontal',
      'cortex:Limbic',
      'section:structure',
      'structure:Basal ganglia',
      'section:tissue',
      'tissue:Cut labels',
    ]);
    expect(rows().every((r) => r.getAttribute('aria-level') === '1')).toBe(true);
    expect(row('cortex:Frontal').getAttribute('aria-label')).toBe('Frontal, 3 regions');
    expect(row('cortex:Limbic').getAttribute('aria-label')).toBe('Limbic, 1 region');
    expect(row('cortex:Frontal').getAttribute('aria-expanded')).toBe('false');
    for (const id of ['section:cortex', 'section:structure', 'section:tissue']) {
      expect(row(id).hasAttribute('aria-expanded')).toBe(false);
      expect(row(id).hasAttribute('aria-selected')).toBe(false);
    }
    expect(row('cortex:Frontal').hasAttribute('aria-selected')).toBe(false);
  });

  test('a section names the settings that hide its rows, so a screen reader hears them too', () => {
    mount();
    expect(row('section:cortex').getAttribute('aria-label')).toBe('Cortex (Hemisphere hidden)');
    expect(row('section:structure').getAttribute('aria-label')).toBe('Subcortical');
    expect(row('section:tissue').getAttribute('aria-label')).toBe(
      'Cut labels only (Visible in a section)',
    );
    expect(row('section:cortex').querySelector('.section-state')!.textContent).toBe(
      'Hemisphere hidden',
    );
  });

  test('regions: names say the side and, when hidden, why; only an own reason is printed', () => {
    mount({ open: ALL, hide: ['a:left:2'] });
    const name = (id: string) => row(id).getAttribute('aria-label');
    expect(name('d:left:1')).toBe('Precentral gyrus, left');
    expect(name('d:right:2')).toBe(
      'Superior frontal gyrus, right: Hemisphere hidden. Activate to reveal.',
    );
    expect(name('a:left:2')).toBe('Putamen, left: Hidden. Activate to reveal.');
    expect(name('a:left:3')).toMatch(/^Globus pallidus, left: In .+\. Activate to reveal\.$/);
    expect(name('t:left:1')).toBe('Small nucleus, left, not shown: Too small for the cut.');
    const printed = (id: string) => row(id).querySelector('.row-reason')?.textContent ?? null;
    expect(printed('d:right:2')).toBeNull();
    expect(printed('a:left:2')).toBeNull();
    expect(printed('a:left:3')).toMatch(/^In /);
    expect(printed('t:left:1')).toBe('Too small for the cut');
    for (const r of rows()) expect(r.hasAttribute('title')).toBe(false);
  });

  test('a region under a group is level 2 with its place in the group; an unavailable one is not selectable', () => {
    mount({ open: ALL });
    expect(row('d:right:1').getAttribute('aria-level')).toBe('2');
    expect(row('d:right:1').getAttribute('aria-posinset')).toBe('2');
    expect(row('d:right:1').getAttribute('aria-setsize')).toBe('3');
    expect(row('d:left:1').getAttribute('aria-selected')).toBe('false');
    expect(row('t:left:1').hasAttribute('aria-selected')).toBe(false);
    expect(row('t:left:1').querySelectorAll('button')).toHaveLength(0);
  });

  test('each eye stands in its own cell, in the column of its side', () => {
    mount({ open: ALL });
    const cell = (id: string, column: number) =>
      row(id).querySelectorAll<HTMLElement>('[role="gridcell"]')[column];
    expect(cell('d:left:1', 2).querySelector('.visibility-control')).not.toBeNull();
    expect(cell('d:right:1', 3).querySelector('.visibility-control')).not.toBeNull();
    expect(cell('a:mid:1', 1).querySelector('.visibility-control')).not.toBeNull();
    expect(
      eyes('cortex:Frontal').map(
        (eye) => eye.closest('[role="gridcell"]')!.parentElement === row('cortex:Frontal'),
      ),
    ).toEqual([true, true]);
    // The Mid slot is held open only where a section has a midline part.
    const slot = (id: string) => cell(id, 1).querySelector<HTMLElement>('.slot-mid');
    expect(getComputedStyle(slot('a:left:1')!).display).toBe('block');
    expect(getComputedStyle(slot('d:left:1')!).display).toBe('none');
  });

  test('a catalog still loading shows an aria-hidden skeleton, never an empty treegrid', () => {
    mount({ groups: [] });
    expect(document.querySelector('[role="treegrid"]')).toBeNull();
    expect(document.querySelector('.tree-skeleton')!.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('APG keys', () => {
  test('Down, Up, Home and End walk the visible rows, sections included', async () => {
    mount();
    focus('cortex:Frontal');
    await press('{ArrowDown}');
    expect(active()).toBe(row('cortex:Limbic'));
    await press('{End}');
    expect(active()).toBe(row('tissue:Cut labels'));
    await press('{Home}');
    expect(active()).toBe(row('section:cortex'));
    await press('{ArrowUp}');
    expect(active()).toBe(row('section:cortex'));
  });

  test('Right opens a collapsed group, then reaches its first eye; Left closes it and goes to the parent', async () => {
    mount();
    focus('cortex:Frontal');
    await press('{ArrowRight}');
    expect(row('cortex:Frontal').getAttribute('aria-expanded')).toBe('true');
    expect(active()).toBe(row('cortex:Frontal'));
    await press('{ArrowRight}');
    expect(active()).toBe(eyes('cortex:Frontal')[0]);
    await press('{Escape}');
    expect(active()).toBe(row('cortex:Frontal'));
    await press('{ArrowDown}{ArrowLeft}');
    expect(active()).toBe(row('cortex:Frontal'));
    await press('{ArrowLeft}');
    expect(row('cortex:Frontal').getAttribute('aria-expanded')).toBe('false');
  });

  test('every eye of a group row is reachable by Right and Left, in the order of the slots', async () => {
    mount({ open: ALL });
    focus('structure:Basal ganglia');
    expect(eyes('structure:Basal ganglia').map((eye) => eye.dataset.side)).toEqual([
      'midline',
      'left',
    ]);
    await press('{ArrowRight}');
    expect(active()).toBe(eyes('structure:Basal ganglia')[0]);
    await press('{ArrowRight}');
    expect(active()).toBe(eyes('structure:Basal ganglia')[1]);
    await press('{ArrowRight}');
    expect(active()).toBe(eyes('structure:Basal ganglia')[1]);
    await press('{ArrowLeft}{ArrowLeft}');
    expect(active()).toBe(row('structure:Basal ganglia'));
    focus('cortex:Frontal');
    await press('{ArrowRight}{ArrowRight}');
    expect(eyes('cortex:Frontal').map((eye) => eye.dataset.side)).toEqual(['left', 'right']);
    await press('{End}');
    expect(active()).toBe(eyes('cortex:Frontal')[1]);
  });

  test('a region’s Right goes to its eye, and Up or Down from it keeps its side', async () => {
    mount({ open: ALL });
    focus('d:left:1');
    await press('{ArrowRight}');
    expect(active()).toBe(eyes('d:left:1')[0]);
    await press('{ArrowDown}');
    expect(active().closest('[role="row"]')).toBe(row('d:right:1'));
    expect(active()).toBe(eyes('d:right:1')[0]);
    await press('{ArrowUp}');
    expect(active()).toBe(eyes('d:left:1')[0]);
  });

  test('Left from a region goes to its group; collapsing it with focus inside lands on the group row', async () => {
    mount({ open: ALL });
    focus('d:left:1');
    await press('{ArrowLeft}');
    expect(active()).toBe(row('cortex:Frontal'));
    await press('{ArrowLeft}');
    expect(row('cortex:Frontal').getAttribute('aria-expanded')).toBe('false');
    expect(active()).toBe(row('cortex:Frontal'));
  });

  test('Enter and Space open a group; on a region they choose it, or reveal it with its reason', async () => {
    const calls = mount({ open: ALL, hide: ['a:left:2'] });
    focus('cortex:Limbic');
    await press('{Enter}');
    expect(row('cortex:Limbic').getAttribute('aria-expanded')).toBe('false');
    await press(' ');
    expect(row('cortex:Limbic').getAttribute('aria-expanded')).toBe('true');
    focus('d:left:1');
    await press('{Enter}');
    focus('d:right:2');
    await press(' ');
    focus('a:left:2');
    await press('{Enter}');
    focus('t:left:1');
    await press('{Enter}');
    expect(calls).toEqual([
      'select d:left:1',
      'reveal hemisphere d:right:2',
      'reveal removed a:left:2',
    ]);
    expect(row('d:left:1').getAttribute('aria-selected')).toBe('true');
  });

  test('a click on a name chooses the region and a click on a group opens it; an eye does neither', async () => {
    const calls = mount({ open: ['cortex:Frontal'] });
    await userEvent.click(row('d:right:1').querySelector('.row-name')!);
    expect(calls).toEqual(['select d:right:1']);
    await userEvent.click(row('cortex:Limbic').querySelector('.row-name')!);
    expect(row('cortex:Limbic').getAttribute('aria-expanded')).toBe('true');
    await userEvent.click(eyes('d:left:1')[0]);
    expect(calls).toEqual(['select d:right:1', 'hide d:left:1']);
    expect(row('d:left:1').getAttribute('aria-selected')).toBe('false');
  });
});

describe('V', () => {
  test('on a region it presses the one eye and focus stays on the row', async () => {
    const calls = mount({ open: ALL });
    focus('d:left:1');
    await press('v');
    expect(calls).toEqual(['hide d:left:1']);
    expect(active()).toBe(row('d:left:1'));
    await press('V');
    expect(calls).toEqual(['hide d:left:1', 'show d:left:1']);
  });

  test('on a group with several eyes it goes to the first and presses nothing', async () => {
    const calls = mount({ open: ALL });
    focus('cortex:Frontal');
    await press('v');
    expect(calls).toEqual([]);
    expect(active()).toBe(eyes('cortex:Frontal')[0]);
  });

  test('on a group with one eye it presses it; on a focused eye it presses that eye', async () => {
    const calls = mount({ open: ALL });
    focus('cortex:Limbic');
    await press('v');
    expect(calls).toEqual(['hide d:left:3']);
    focus('cortex:Frontal');
    await press('{ArrowRight}{ArrowRight}');
    await press('v');
    expect(calls.at(-1)).toBe('hide d:right:1,d:right:2');
    expect(active()).toBe(eyes('cortex:Frontal')[1]);
  });

  test('on a row with no eye it does nothing', async () => {
    const calls = mount({ open: ALL });
    focus('t:left:1');
    await press('v');
    focus('section:cortex');
    await press('v');
    expect(calls).toEqual([]);
  });
});

describe('visibility eyes', () => {
  test('the name is the action; pressing flips it in place, says so, and keeps focus', async () => {
    const calls = mount({ open: ALL });
    const eye = eyes('d:left:1')[0];
    expect(eye.getAttribute('aria-label')).toBe('Hide Precentral gyrus, left');
    expect(eye.hasAttribute('aria-pressed')).toBe(false);
    expect(eye.dataset.state).toBe('shown');
    expect(eye.querySelector('path[d="m3 3 18 18"]')).toBeNull();
    eye.focus();
    await press('{Enter}');
    expect(calls).toEqual(['hide d:left:1']);
    expect(eyes('d:left:1')[0]).toBe(eye);
    expect(active()).toBe(eye);
    expect(eye.getAttribute('aria-label')).toBe('Show Precentral gyrus, left');
    expect(eye.dataset.state).toBe('hidden');
    expect(eye.querySelector('path[d="m3 3 18 18"]')).not.toBeNull();
    expect(eye.querySelector('.visibility-side')!.textContent).toBe('L');
    // What a press says is S1's sentence (decision 32); the tree writes none of its own.
    expect(announced()).toBe('');
    await press(' ');
    expect(calls).toEqual(['hide d:left:1', 'show d:left:1']);
    expect(announced()).toBe('');
  });

  test('a group’s side is partly hidden when one of its regions is, and says so in name and tooltip', async () => {
    mount({ open: ALL });
    const side = eyes('cortex:Frontal')[1];
    expect(side.getAttribute('aria-label')).toBe('Hide Frontal, right');
    await userEvent.click(eyes('d:right:1')[0]);
    expect(side.dataset.partial).toBe('true');
    expect(side.dataset.state).toBe('shown');
    expect(side.getAttribute('aria-label')).toBe('Hide Frontal, right, partially hidden');
    expect(side.dataset.tooltip).toBe('Hide Frontal, right · partially hidden');
    await userEvent.click(side);
    expect(side.dataset.state).toBe('hidden');
    expect(side.dataset.partial).toBe('false');
    expect(side.getAttribute('aria-label')).toBe('Show Frontal, right');
    expect(eyes('d:right:2')[0].dataset.state).toBe('hidden');
  });

  test('French: names, glyphs and the announcement', async () => {
    mount({ open: ALL, lang: 'fr' });
    const eye = eyes('d:right:1')[0];
    expect(eye.getAttribute('aria-label')).toBe('Masquer Precentral gyrus, droite');
    expect(eye.querySelector('.visibility-side')!.textContent).toBe('D');
    await userEvent.click(eye);
    expect(announced()).toBe('');
    expect(grid().getAttribute('aria-label')).toBe('Parcourir l’anatomie');
    expect(row('cortex:Frontal').getAttribute('aria-label')).toBe('Frontal, 3 régions');
  });

  test('the accessible name carries the visible letter’s meaning (2.5.3: side word, letter hidden from it)', () => {
    mount({ open: ALL });
    for (const eye of eyes('d:left:1')) {
      expect(eye.querySelector('.visibility-side')!.getAttribute('aria-hidden')).toBe('true');
      expect(eye.getAttribute('aria-label')).toContain('left');
    }
  });
});

describe('selection and focus', () => {
  test('one Tab stop: the first row, then the chosen row once it is in view', async () => {
    mount({ selected: 'd:left:3' });
    expect(tabStops()).toEqual([row('section:cortex')]);
    // The reader is outside the grid, like a pointer press on Expand all: the stop follows the choice.
    await userEvent.click(page.getByRole('button', { name: 'Expand all' }));
    expect(tabStops()).toEqual([row('d:left:3')]);
    page.getByRole('button', { name: 'Collapse all' }).element().focus();
    await press('{Tab}');
    expect(active()).toBe(row('d:left:3'));
    await press('{Tab}');
    expect(active()).toBe(document.getElementById('after'));
    await press('{Shift>}{Tab}{/Shift}');
    expect(active()).toBe(row('d:left:3'));
  });

  test('a choice made while the reader is moving through the grid leaves the stop where it is', async () => {
    mount({ open: ALL });
    focus('cortex:Frontal');
    await userEvent.click(page.getByRole('button', { name: 'pick cingulate' }));
    expect(row('d:left:3').getAttribute('aria-selected')).toBe('true');
    expect(tabStops()).toHaveLength(1);
  });

  test('the workspace finds the chosen row, and any list can focus the Tab stop by name', () => {
    mount({ open: ALL, selected: 'd:left:3' });
    expect(currentItem()).toBe(row('d:left:3'));
    (document.getElementById('before') as HTMLElement).focus();
    expect(requestFocus(FOCUS_TARGETS.treeStop)).toBe(true);
    expect(active()).toBe(row('d:left:3'));
    row('d:left:1').focus();
    expect(active()).toBe(row('d:left:1'));
  });

  test('the chosen row scrolls into view once per choice, even when its group opens later', async () => {
    const many: typeof GROUPS = [
      {
        ...GROUPS[0],
        rows: Array.from({ length: 80 }, (_, i) => ({
          ...GROUPS[0].rows[0],
          region: { ...GROUPS[0].rows[0].region, id: `n:left:${i}` },
          label: { ...GROUPS[0].rows[0].label, name: `Area ${i}` },
        })),
      },
    ];
    await page.viewport(1280, 400);
    mount({ groups: many, selected: 'n:left:70' });
    await userEvent.click(page.getByRole('button', { name: 'Expand all' }));
    const target = row('n:left:70').getBoundingClientRect();
    await expect.poll(() => row('n:left:70').getBoundingClientRect().top).toBeLessThan(400);
    expect(target.height).toBeGreaterThan(0);
    expect(row('n:left:70').getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);
  });

  test('moveFocus walks the rows from wherever focus is, and from the first when it is outside', async () => {
    mount({ open: ALL });
    const walk = (name: string) => userEvent.click(page.getByRole('button', { name }));
    await walk('walk down');
    expect(active()).toBe(row('section:cortex'));
    await walk('walk down');
    expect(active()).toBe(row('cortex:Frontal'));
    focus('cortex:Frontal');
    eyes('cortex:Frontal')[0].focus();
    await walk('walk down');
    expect(active()).toBe(row('d:left:1'));
    await walk('walk up');
    expect(active()).toBe(row('cortex:Frontal'));
  });
});

describe('Expand all', () => {
  test('opens every group and then closes them, and its label follows', async () => {
    mount();
    const button = () => page.getByRole('button', { name: /^(Expand|Collapse) all$/ });
    expect(button().element().textContent!.trim()).toBe('Expand all');
    await userEvent.click(button());
    expect(rows().filter((r) => r.getAttribute('aria-expanded') === 'true')).toHaveLength(4);
    expect(button().element().textContent!.trim()).toBe('Collapse all');
    await userEvent.click(button());
    expect(rows().filter((r) => r.getAttribute('aria-expanded') === 'true')).toHaveLength(0);
    expect(button().element().textContent!.trim()).toBe('Expand all');
  });

  test('French', () => {
    mount({ lang: 'fr' });
    expect(page.getByRole('button', { name: 'Tout déplier' }).element()).toBeTruthy();
  });
});

describe('shortcut keys on a row', () => {
  // Decision 7: a row leaves the page's own single characters to the keymap instead of type-ahead.
  const pressed = async (keys: string[]) => {
    const reached: string[] = [];
    const listener = (event: KeyboardEvent) => {
      if (!event.defaultPrevented) reached.push(event.key);
    };
    window.addEventListener('keydown', listener);
    for (const key of keys) await press(key);
    window.removeEventListener('keydown', listener);
    return reached;
  };

  test('f i c u s h m ? / and 0-6 reach the page from a row, and move no focus', async () => {
    mount({ open: ALL });
    focus('d:left:1');
    const keys = ['f', 'i', 'c', 'u', 's', 'h', 'm', '?', '/', '0', '3', '6'];
    expect(await pressed(keys)).toEqual(keys);
    expect(active()).toBe(row('d:left:1'));
  });

  test('a letter that is not the page’s still finds a row, and `f` after it extends the query', async () => {
    mount({ open: ALL });
    focus('section:cortex');
    // `p` is no shortcut: type-ahead takes it. `f` then extends the query ("pf"), so it never
    // reaches the page, which a lone `f` does (the test above).
    expect(await pressed(['p', 'f'])).toEqual([]);
    expect(active()).not.toBe(row('section:cortex'));
  });
});

describe('from a cell, across rows that have no cell', () => {
  const eyeOf = (id: string, side: string) => eyes(id).find((eye) => eye.dataset.side === side)!;

  test('Up from the first group goes to its section heading row; Down from a section’s last eye goes to the next heading', async () => {
    mount({ open: ALL });
    eyeOf('cortex:Frontal', 'left').focus();
    await press('{ArrowUp}');
    expect(active()).toBe(row('section:cortex'));
    eyes('d:left:3')[0].focus();
    await press('{ArrowDown}');
    expect(active()).toBe(row('section:structure'));
  });

  test('Down onto a region with no eye goes to that row', async () => {
    mount({ open: ALL });
    eyeOf('tissue:Cut labels', 'left').focus();
    await press('{ArrowDown}');
    expect(active()).toBe(row('t:left:1'));
  });

  test('Ctrl+Home goes to the first row and Ctrl+End to the last row’s nearest eye', async () => {
    mount({ open: ALL });
    eyeOf('cortex:Frontal', 'left').focus();
    await press('{Control>}{End}{/Control}');
    expect(active()).toBe(eyes('t:left:2')[0]);
    await press('{Control>}{Home}{/Control}');
    expect(active()).toBe(row('section:cortex'));
  });

  test('* opens every group among its siblings', async () => {
    mount();
    focus('cortex:Frontal');
    await press('*');
    expect(rows().filter((r) => r.getAttribute('aria-expanded') === 'true')).toHaveLength(4);
  });
});

describe('rows', () => {
  test('a region no control can reveal is aria-disabled, and takes no hover wash or pointer', async () => {
    mount({ open: ALL });
    expect(row('t:left:1').getAttribute('aria-disabled')).toBe('true');
    expect(row('t:left:2').hasAttribute('aria-disabled')).toBe(false);
    expect(getComputedStyle(row('t:left:1')).cursor).toBe('default');
    const before = getComputedStyle(row('t:left:1')).backgroundColor;
    await userEvent.hover(row('t:left:1'));
    expect(getComputedStyle(row('t:left:1')).backgroundColor).toBe(before);
  });

  test('a section caption is divided from the one above, except the first', () => {
    mount({ open: ALL });
    expect(getComputedStyle(row('section:cortex')).borderTopWidth).toBe('0px');
    expect(getComputedStyle(row('section:structure')).borderTopWidth).toBe('1px');
    expect(getComputedStyle(row('section:tissue')).borderTopWidth).toBe('1px');
  });

  test('a section caption takes no hover wash', async () => {
    mount({ open: ALL });
    await userEvent.hover(row('section:cortex'));
    expect(getComputedStyle(row('section:cortex')).backgroundColor).toBe('rgba(0, 0, 0, 0)');
  });

  test('an open group stays in view over its regions, and regions clear it when scrolled to', () => {
    mount({ open: ['cortex:Frontal'] });
    expect(getComputedStyle(row('cortex:Frontal')).position).toBe('sticky');
    expect(getComputedStyle(row('cortex:Limbic')).position).not.toBe('sticky');
    expect(getComputedStyle(row('d:left:1')).scrollMarginTop).not.toBe('0px');
    expect(row('d:left:1').parentElement!.className).toBe('treegrid-block');
    expect(row('d:left:1').parentElement).toBe(row('cortex:Frontal').parentElement);
  });

  test('a hidden row names itself in a tooltip, and a visible one has none; no title anywhere', () => {
    mount({ open: ALL });
    const tip = (id: string) => row(id).querySelector<HTMLElement>('.row-main')!.dataset.tooltip;
    expect(tip('d:right:2')).toBe(
      'Superior frontal gyrus, right: Hemisphere hidden. Activate to reveal.',
    );
    expect(tip('d:left:1')).toBeUndefined();
    expect(document.querySelector('[title]')).toBeNull();
  });

  test('a hidden row’s side letter is dimmed, a shown one’s is not', () => {
    mount({ open: ALL });
    const color = (id: string) =>
      getComputedStyle(row(id).querySelector('.visibility-side')!).color;
    expect(color('d:right:2')).not.toBe(color('d:left:1'));
  });

  test('a click anywhere on a row acts, even off its name; a button’s click is its own', async () => {
    const calls = mount({ open: ALL });
    // The row itself is what an empty side slot's area hits.
    row('d:left:1').click();
    expect(calls).toEqual(['select d:left:1']);
    row('cortex:Limbic').click();
    await tick();
    expect(row('cortex:Limbic').getAttribute('aria-expanded')).toBe('false');
    row('t:left:1').querySelector<HTMLElement>('.row-name')!.click();
    row('section:cortex').click();
    expect(calls).toEqual(['select d:left:1']);
    eyes('d:left:1')[0].click();
    expect(calls).toEqual(['select d:left:1', 'hide d:left:1']);
  });
});

describe('accessibility', () => {
  test('axe: expanded, with hidden, partial and unavailable rows, in English and French', async () => {
    mount({ open: ALL, selected: 'd:left:1', hide: ['a:left:2', 'd:right:1'] });
    await expectAxeClean();
    cleanup();
    mount({ open: ALL, selected: 'd:left:1', hide: ['a:left:2', 'd:right:1'], lang: 'fr' });
    await expectAxeClean();
  });

  test('forced colours: the chosen row keeps a system-colour edge and no control stays invisible', async () => {
    mount({ open: ALL, selected: 'd:left:1' });
    await withMedia([{ name: 'forced-colors', value: 'active' }], () => {
      const selected = getComputedStyle(row('d:left:1'));
      expect(selected.outlineStyle).toBe('solid');
      expect(selected.outlineWidth).toBe('1px');
      for (const eye of [...eyes('cortex:Frontal'), ...eyes('d:right:1')]) {
        expect(getComputedStyle(eye).opacity).toBe('1');
        expect(getComputedStyle(eye.querySelector('svg')!).opacity).toBe('1');
      }
      expect(
        getComputedStyle(row('cortex:Frontal').querySelector('.group-count')!).visibility,
      ).toBe('visible');
    });
  });

  test('increased contrast: the counts and eyes are both shown', async () => {
    mount({ open: ALL });
    await withMedia([{ name: 'prefers-contrast', value: 'more' }], () => {
      for (const eye of eyes('cortex:Frontal')) expect(getComputedStyle(eye).opacity).toBe('1');
      expect(
        getComputedStyle(row('cortex:Frontal').querySelector('.group-count')!).visibility,
      ).toBe('visible');
    });
  });

  test('reduced motion: the chevron turns at once', async () => {
    mount({ open: ALL });
    await withMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }], () => {
      const chevron = row('cortex:Frontal').querySelector('.chevron')!;
      expect(getComputedStyle(chevron).transitionDuration).toBe('0s');
    });
  });

  test('targets: an eye is at least 24 px square, and the row at least the row height', () => {
    mount({ open: ALL });
    for (const eye of [...eyes('d:left:1'), ...eyes('a:mid:1'), ...eyes('cortex:Frontal')]) {
      const box = eye.getBoundingClientRect();
      expect(box.width, eye.getAttribute('aria-label')!).toBeGreaterThanOrEqual(24);
      expect(box.height, eye.getAttribute('aria-label')!).toBeGreaterThanOrEqual(24);
    }
    expect(row('d:left:1').getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
  });

  test('reflow at 320 px and under WCAG 1.4.12 text spacing: nothing spills sideways, nothing is clipped', async () => {
    mount({
      open: ALL,
      groups: GROUPS.map((group) => ({
        ...group,
        name: `${group.name} with a very long and unbroken-looking group name`,
      })),
    });
    await page.viewport(320, 700);
    const spacing = document.head.appendChild(document.createElement('style'));
    spacing.textContent =
      '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }';
    try {
      const area = grid().getBoundingClientRect();
      const spill = [...document.body.querySelectorAll('*')].filter(
        (e) => e.getBoundingClientRect().right > window.innerWidth + 0.5,
      );
      expect(
        spill.map((e) => e.className || e.tagName),
        'spill',
      ).toEqual([]);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
      for (const r of rows()) {
        const box = r.getBoundingClientRect();
        expect(box.left, r.dataset.id).toBeGreaterThanOrEqual(area.left);
        expect(box.right, r.dataset.id).toBeLessThanOrEqual(area.right + 1);
        expect(r.scrollWidth, r.dataset.id).toBeLessThanOrEqual(r.clientWidth + 1);
      }
    } finally {
      spacing.remove();
    }
  });

  test('coarse pointer: each eye is 44 px square and a row is at least 44 px', async () => {
    mount({ open: ALL });
    const session = cdp();
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    try {
      expect(matchMedia('(pointer: coarse)').matches).toBe(true);
      for (const eye of [...eyes('d:left:1'), ...eyes('a:mid:1'), ...eyes('cortex:Frontal')]) {
        const box = eye.getBoundingClientRect();
        expect(box.width, eye.getAttribute('aria-label')!).toBeGreaterThanOrEqual(44);
        expect(box.height, eye.getAttribute('aria-label')!).toBeGreaterThanOrEqual(44);
      }
      expect(row('d:left:1').getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    } finally {
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  });

  test('200 % text: the names scale, and nothing spills or is clipped', async () => {
    mount({ open: ALL });
    await page.viewport(640, 800);
    const size = () =>
      parseFloat(getComputedStyle(row('d:left:1').querySelector('.row-name')!).fontSize);
    const normal = size();
    document.documentElement.style.fontSize = '200%';
    try {
      expect(size()).toBeGreaterThanOrEqual(normal * 1.9);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
      for (const r of rows()) {
        expect(r.scrollWidth, r.dataset.id).toBeLessThanOrEqual(r.clientWidth + 1);
        expect(r.scrollHeight, r.dataset.id).toBeLessThanOrEqual(r.clientHeight + 1);
      }
    } finally {
      document.documentElement.style.fontSize = '';
    }
  });

  test('a landscape phone (812 x 375): no sideways spill, and the eyes are 24 px or more', async () => {
    mount({ open: ALL });
    await page.viewport(812, 375);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    for (const eye of eyes('d:left:1')) {
      const box = eye.getBoundingClientRect();
      expect(box.width).toBeGreaterThanOrEqual(24);
      expect(box.height).toBeGreaterThanOrEqual(24);
    }
  });
});
