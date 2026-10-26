// Real-DOM checks of the treegrid against the APG Treegrid keyboard table, in Chromium.
import axe from 'axe-core';
import { describe, expect, onTestFinished, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import Fixture from './treegrid-fixture.svelte';

const mount = (
  props: {
    initialSelected?: string | null;
    wide?: boolean;
    blank?: boolean;
    pass?: ReadonlySet<string>;
  } = {},
) => {
  const log: string[] = [];
  const screen = render(Fixture, { log, ...props });
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
    expect(row('frontal').hasAttribute('aria-selected')).toBe(false);
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

describe('leaving the grid', () => {
  test('Tab out to a control that rebuilds the grid leaves focus on that control', async () => {
    mount();
    focus('frontal');
    await press('{ArrowRight}{ArrowDown}');
    expect(active()).toBe(row('precentral'));
    await press('{Tab}');
    expect(active()).toBe(document.getElementById('after'));
    // Collapse all rebuilds the grid; the reader is outside it.
    (document.getElementById('collapse-all') as HTMLElement).focus();
    (document.getElementById('collapse-all') as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(active()).toBe(document.getElementById('collapse-all'));
  });
});

describe('selection and the Tab stop', () => {
  test('Tab enters on the selected row', async () => {
    mount({ initialSelected: 'insula' });
    expect(tabStops()).toEqual([row('insula')]);
    (document.getElementById('before') as HTMLElement).focus();
    await press('{Tab}');
    expect(active()).toBe(row('insula'));
  });

  test('a selection made outside the grid moves the stop; one made inside does not steal it', async () => {
    mount();
    expect(tabStops()).toEqual([row('frontal')]);
    (document.getElementById('select-insula') as HTMLElement).click();
    await expect.poll(tabStops).toEqual([row('insula')]);
    focus('limbic');
    expect(tabStops()).toEqual([row('limbic')]);
  });

  test('aria-selected is on selectable rows only', async () => {
    mount({ initialSelected: 'insula' });
    expect(rows().map((r) => r.getAttribute('aria-selected'))).toEqual([null, 'true', null]);
    focus('frontal');
    await press('*');
    expect(rows().map((r) => r.getAttribute('aria-selected'))).toEqual([
      null,
      'false',
      'false',
      'true',
      null,
      'false',
    ]);
  });
});

describe('row names', () => {
  test('rowLabel names the row, not its cells', async () => {
    mount();
    expect(row('frontal').getAttribute('aria-label')).toBe('Frontal, 2 regions');
    expect(row('insula').getAttribute('aria-label')).toBe('Insula');
  });
});

describe('cells without a control, and disabled cells', () => {
  const open = async () => {
    mount({ wide: true });
    focus('frontal');
    await press('*');
    focus('limbic');
    await press('*');
  };

  test('Right and Left skip empty cells, and Right at the last control stays', async () => {
    await open();
    focus('insula');
    await press('{ArrowRight}{ArrowRight}');
    expect(active()).toBe(cellButtons('insula')[1]);
    await press('{ArrowRight}');
    expect(active()).toBe(cellButtons('insula')[1]);
    focus('cingulate');
    await press('{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(active()).toBe(cellButtons('cingulate')[2]);
    await press('{ArrowLeft}');
    expect(active()).toBe(cellButtons('cingulate')[1]);
  });

  test('a disabled cell is skipped, and Up and Down land on the nearest cell in the column', async () => {
    await open();
    focus('precentral');
    await press('{ArrowRight}{ArrowRight}');
    // The eye is disabled, the side cell empty: the first cell is the only stop.
    expect(active()).toBe(cellButtons('precentral')[0]);
    focus('frontal');
    await press('{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(active()).toBe(cellButtons('frontal')[1]);
    await press('{ArrowDown}');
    expect(active()).toBe(cellButtons('precentral')[0]);
    await press('{ArrowDown}');
    expect(active()).toBe(cellButtons('postcentral')[0]);
  });

  test('Up and Down keep the column across empty cells', async () => {
    await open();
    focus('cingulate');
    await press('{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(active()).toBe(cellButtons('cingulate')[2]);
    await press('{ArrowUp}');
    // The row above has no cell in column 2: the nearest is its eye (column 1).
    expect(active()).toBe(cellButtons('limbic')[1]);
  });
});

describe('cell focus across rows that have no cell', () => {
  test('Down and Up land on the row itself when its neighbour has no usable cell', async () => {
    mount({ blank: true });
    focus('insula');
    await press('{ArrowRight}');
    await press('{ArrowDown}');
    expect(active()).toBe(row('rule'));
    focus('limbic');
    await press('{ArrowRight}');
    await press('{ArrowUp}');
    expect(active()).toBe(row('rule'));
  });

  test('Ctrl+Home goes to the first row when it has no cell, Ctrl+End to the last row’s nearest cell', async () => {
    mount({ blank: true });
    focus('insula');
    await press('{ArrowRight}');
    await press('{Control>}{Home}{/Control}');
    expect(active()).toBe(row('top'));
    focus('insula');
    await press('{ArrowRight}');
    await press('{Control>}{End}{/Control}');
    expect(active()).toBe(cellButtons('limbic')[0]);
  });

  test('a disabled node is aria-disabled and takes no hover wash', async () => {
    document.documentElement.style.setProperty('--surface-hover', 'rgb(10, 20, 30)');
    onTestFinished(() => {
      document.documentElement.style.removeProperty('--surface-hover');
    });
    mount({ blank: true });
    expect(row('rule').getAttribute('aria-disabled')).toBe('true');
    expect(row('top').hasAttribute('aria-disabled')).toBe(false);
    const before = getComputedStyle(row('rule')).backgroundColor;
    await userEvent.hover(row('rule'));
    expect(getComputedStyle(row('rule')).backgroundColor).toBe(before);
    await userEvent.hover(row('insula'));
    expect(getComputedStyle(row('insula')).backgroundColor).not.toBe(before);
  });
});

describe('structure: blocks', () => {
  test('a top-level row and its open children share one role-less block', async () => {
    mount();
    focus('frontal');
    await press('{ArrowRight}');
    const block = row('frontal').parentElement!;
    expect(block.classList.contains('treegrid-block')).toBe(true);
    expect(block.hasAttribute('role')).toBe(false);
    expect(row('precentral').parentElement).toBe(block);
    expect(row('insula').parentElement).not.toBe(block);
  });
});

describe('passKeys', () => {
  const pressedOnWindow = async (keys: string[]) => {
    const reached: string[] = [];
    const listener = (event: KeyboardEvent) => {
      if (!event.defaultPrevented) reached.push(event.key);
    };
    window.addEventListener('keydown', listener);
    for (const key of keys) await press(key);
    window.removeEventListener('keydown', listener);
    return reached;
  };

  test('a listed key is left to the page, and starts no query', async () => {
    mount({ pass: new Set(['i', 'n']) });
    focus('frontal');
    expect(await pressedOnWindow(['i'])).toEqual(['i']);
    expect(active()).toBe(row('frontal'));
  });

  test('a listed key extends a query already being typed', async () => {
    mount({ pass: new Set(['n']) });
    focus('frontal');
    await press('i');
    expect(active()).toBe(row('insula'));
    expect(await pressedOnWindow(['n'])).toEqual([]);
    expect(active()).toBe(row('insula'));
  });

  test('unlisted keys still find rows', async () => {
    mount({ pass: new Set(['n']) });
    focus('frontal');
    await press('l');
    expect(active()).toBe(row('limbic'));
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
