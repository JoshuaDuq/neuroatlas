// Real-DOM checks of the treegrid against the APG Treegrid keyboard table, in Chromium.
import axe from 'axe-core';
import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import Fixture from './treegrid-fixture.svelte';

const mount = () => {
  const log: string[] = [];
  const screen = render(Fixture, { log });
  return { log, screen };
};
const grid = () => document.querySelector<HTMLElement>('[role="treegrid"]')!;
const rows = () => [...grid().querySelectorAll<HTMLElement>('[role="row"]')];
const ids = () => rows().map((row) => row.dataset.id);
const row = (id: string) => rows().find((r) => r.dataset.id === id)!;
const active = () => document.activeElement as HTMLElement;
const cellButtons = (id: string) =>
  [...row(id).querySelectorAll<HTMLElement>('[role="gridcell"]')].map((cell) =>
    cell.querySelector<HTMLElement>('button')!,
  );
const tabStops = () =>
  [...grid().querySelectorAll<HTMLElement>('[role="row"], button')].filter((e) => e.tabIndex === 0);
const focus = (id: string) => {
  row(id).focus();
  expect(active()).toBe(row(id));
};
const press = (keys: string) => userEvent.keyboard(keys);

describe('structure', () => {
  test('roles, name, levels and states: aria-expanded on parents only', async () => {
    mount();
    expect(grid().getAttribute('aria-label')).toBe('Anatomy');
    expect(ids()).toEqual(['frontal', 'insula', 'limbic']);
    expect(row('frontal').getAttribute('aria-expanded')).toBe('false');
    expect(row('limbic').getAttribute('aria-expanded')).toBe('false');
    expect(row('insula').hasAttribute('aria-expanded')).toBe(false);
    expect(row('insula').getAttribute('aria-posinset')).toBe('2');
    expect(row('insula').getAttribute('aria-setsize')).toBe('3');
    expect(row('insula').getAttribute('aria-level')).toBe('1');
    expect(row('insula').querySelectorAll('[role="gridcell"]').length).toBe(2);
  });

  test('children are rendered only while expanded, at level 2 with their own set size', async () => {
    mount();
    focus('frontal');
    expect(document.querySelector('[data-id="precentral"]')).toBeNull();
    await press('{ArrowRight}');
    expect(ids()).toEqual(['frontal', 'precentral', 'postcentral', 'insula', 'limbic']);
    expect(row('postcentral').getAttribute('aria-level')).toBe('2');
    expect(row('postcentral').getAttribute('aria-posinset')).toBe('2');
    expect(row('postcentral').getAttribute('aria-setsize')).toBe('2');
    await press('{ArrowLeft}');
    expect(ids()).toEqual(['frontal', 'insula', 'limbic']);
  });

  test('one Tab stop, at the first row; Tab leaves the grid and Shift+Tab returns to it', async () => {
    mount();
    expect(tabStops()).toEqual([row('frontal')]);
    (document.getElementById('before') as HTMLElement).focus();
    await press('{Tab}');
    expect(active()).toBe(row('frontal'));
    await press('{Tab}');
    expect(active()).toBe(document.getElementById('after'));
    await press('{Shift>}{Tab}{/Shift}');
    expect(active()).toBe(row('frontal'));
  });

  test('the stop follows focus and stays unique', async () => {
    mount();
    focus('frontal');
    await press('{ArrowDown}');
    expect(tabStops()).toEqual([row('insula')]);
    await press('{ArrowRight}');
    expect(tabStops()).toEqual([cellButtons('insula')[0]]);
  });
});

describe('APG keys with focus on a row', () => {
  test('Down and Up move between visible rows and stop at the ends', async () => {
    mount();
    focus('frontal');
    await press('{ArrowUp}');
    expect(active()).toBe(row('frontal'));
    await press('{ArrowDown}');
    expect(active()).toBe(row('insula'));
    await press('{ArrowDown}{ArrowDown}');
    expect(active()).toBe(row('limbic'));
  });

  test('Home and End go to the first and last row', async () => {
    mount();
    focus('insula');
    await press('{End}');
    expect(active()).toBe(row('limbic'));
    await press('{Home}');
    expect(active()).toBe(row('frontal'));
  });

  test('Right expands a collapsed parent and keeps focus on it', async () => {
    mount();
    focus('frontal');
    await press('{ArrowRight}');
    expect(row('frontal').getAttribute('aria-expanded')).toBe('true');
    expect(active()).toBe(row('frontal'));
  });

  test('Right on an expanded parent or a leaf goes to the first cell, then the eye', async () => {
    mount();
    focus('frontal');
    await press('{ArrowRight}{ArrowRight}');
    expect(active()).toBe(cellButtons('frontal')[0]);
    await press('{ArrowRight}');
    expect(active()).toBe(cellButtons('frontal')[1]);
    focus('insula');
    await press('{ArrowRight}');
    expect(active()).toBe(cellButtons('insula')[0]);
  });

  test('Left collapses an expanded parent, else goes to the parent row', async () => {
    mount();
    focus('frontal');
    await press('{ArrowRight}{ArrowDown}{ArrowLeft}');
    expect(active()).toBe(row('frontal'));
    expect(row('frontal').getAttribute('aria-expanded')).toBe('true');
    await press('{ArrowLeft}');
    expect(row('frontal').getAttribute('aria-expanded')).toBe('false');
    focus('insula');
    await press('{ArrowLeft}');
    expect(active()).toBe(row('insula'));
  });

  test('Enter and Space activate the row', async () => {
    const { log } = mount();
    focus('insula');
    await press('{Enter}');
    await press(' ');
    expect(log).toEqual(['activate insula', 'activate insula']);
    expect(row('insula').getAttribute('aria-selected')).toBe('true');
    expect(row('frontal').getAttribute('aria-selected')).toBe('false');
  });

  test('* expands every sibling parent', async () => {
    mount();
    focus('frontal');
    await press('*');
    expect(row('frontal').getAttribute('aria-expanded')).toBe('true');
    expect(row('limbic').getAttribute('aria-expanded')).toBe('true');
  });

  test('V toggles the row’s visibility without selecting it', async () => {
    const { log } = mount();
    focus('insula');
    await press('v');
    expect(cellButtons('insula')[1].textContent?.trim()).toBe('off');
    expect(log).toEqual([]);
  });
});

describe('type-ahead', () => {
  test('a letter moves to the next row starting with it, a longer query refines', async () => {
    mount();
    focus('frontal');
    await press('i');
    expect(active()).toBe(row('insula'));
    await new Promise((resolve) => setTimeout(resolve, 600));
    await press('l');
    expect(active()).toBe(row('limbic'));
  });

  test('a prefix is matched in one query, and a pause starts a new one', async () => {
    mount();
    focus('frontal');
    await press('{ArrowRight}');
    await press('po');
    expect(active()).toBe(row('postcentral'));
    await new Promise((resolve) => setTimeout(resolve, 600));
    await press('l');
    expect(active()).toBe(row('limbic'));
  });

  test('a shortcut key still works when no query is being typed', async () => {
    mount();
    focus('insula');
    await press('v');
    expect(active()).toBe(row('insula'));
  });
});

describe('APG keys with focus in a cell', () => {
  test('Right and Left walk the cells; Right on the last stays; Left from the first returns to the row', async () => {
    mount();
    focus('insula');
    await press('{ArrowRight}');
    expect(active()).toBe(cellButtons('insula')[0]);
    await press('{ArrowRight}');
    expect(active()).toBe(cellButtons('insula')[1]);
    await press('{ArrowRight}');
    expect(active()).toBe(cellButtons('insula')[1]);
    await press('{ArrowLeft}');
    expect(active()).toBe(cellButtons('insula')[0]);
    await press('{ArrowLeft}');
    expect(active()).toBe(row('insula'));
  });

  test('Escape returns to the row from any cell', async () => {
    mount();
    focus('insula');
    await press('{ArrowRight}{ArrowRight}{Escape}');
    expect(active()).toBe(row('insula'));
  });

  test('Home and End go to the first and last cell; Ctrl+Home and Ctrl+End to the first and last row', async () => {
    mount();
    focus('insula');
    await press('{ArrowRight}{End}');
    expect(active()).toBe(cellButtons('insula')[1]);
    await press('{Home}');
    expect(active()).toBe(cellButtons('insula')[0]);
    await press('{Control>}{End}{/Control}');
    expect(active()).toBe(cellButtons('limbic')[0]);
    await press('{Control>}{Home}{/Control}');
    expect(active()).toBe(cellButtons('frontal')[0]);
  });

  test('Up and Down keep the column', async () => {
    mount();
    focus('frontal');
    await press('{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(active()).toBe(cellButtons('frontal')[1]);
    await press('{ArrowDown}');
    expect(active()).toBe(cellButtons('precentral')[1]);
    await press('{ArrowUp}{ArrowUp}');
    expect(active()).toBe(cellButtons('frontal')[1]);
  });

  test('Enter and Space press the cell’s button; V works in a cell', async () => {
    const { log } = mount();
    focus('insula');
    await press('{ArrowRight}{Enter}');
    expect(log).toEqual(['select insula']);
    await press('{ArrowRight}');
    await press(' ');
    expect(cellButtons('insula')[1].textContent?.trim()).toBe('off');
    await press('v');
    expect(cellButtons('insula')[1].textContent?.trim()).toBe('on');
  });
});

describe('focus restoration', () => {
  test('collapsing a parent while focus is on a child moves the stop and focus to the parent', async () => {
    mount();
    focus('frontal');
    await press('{ArrowRight}{ArrowDown}');
    expect(active()).toBe(row('precentral'));
    // Collapse from the pointer-less path: the parent's own Left, after returning to it.
    await press('{ArrowLeft}{ArrowLeft}');
    expect(active()).toBe(row('frontal'));
    expect(tabStops()).toEqual([row('frontal')]);
  });

  test('a pointer collapse that removes the focused child puts focus and the stop on the parent', async () => {
    mount();
    focus('frontal');
    await press('{ArrowRight}{ArrowDown}');
    expect(active()).toBe(row('precentral'));
    row('frontal').querySelector<HTMLElement>('.toggle')!.click();
    await expect.poll(() => active()).toBe(row('frontal'));
    expect(tabStops()).toEqual([row('frontal')]);
  });

  test('a button replaced in place keeps focus on its cell and the stop', async () => {
    mount();
    focus('insula');
    await press('{ArrowRight}{ArrowRight}');
    const before = active();
    await press('{Enter}');
    expect(active()).not.toBe(before);
    expect(active()).toBe(cellButtons('insula')[1]);
    expect(tabStops()).toEqual([cellButtons('insula')[1]]);
  });

  test('focus on a row survives a state change elsewhere (patch in place)', async () => {
    mount();
    focus('limbic');
    cellButtons('insula')[1].click();
    expect(active()).toBe(row('limbic'));
    expect(tabStops()).toEqual([row('limbic')]);
  });
});

describe('axe', () => {
  const run = async () =>
    (
      await axe.run(grid().parentElement!, {
        runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
      })
    ).violations;

  test('collapsed and expanded grids have no violations', async () => {
    mount();
    expect(await run()).toEqual([]);
    focus('frontal');
    await press('*');
    expect(await run()).toEqual([]);
  });

  test('no violations in dark colours', async () => {
    document.documentElement.dataset.theme = 'dark';
    try {
      mount();
      expect(await run()).toEqual([]);
    } finally {
      delete document.documentElement.dataset.theme;
    }
  });
});
