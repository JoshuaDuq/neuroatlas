// Ported key-action tests for the treegrid logic (viewer/ui/panels/navigator.js:10-36) and the
// pure helpers it adds. Departures from the legacy table are in deviations/u7-treegrid-keys.md.
import { describe, expect, test } from 'vitest';
import {
  cellKeyAction,
  expandableIds,
  isTypeAheadKey,
  movedIndex,
  rowKeyAction,
  survivingRowId,
  typeAheadMatch,
  visibleRows,
  type TreegridNode,
} from './treegrid.ts';

const leafRow = { expandable: false, expanded: false };
const collapsed = { expandable: true, expanded: false };
const open = { expandable: true, expanded: true };

describe('rowKeyAction', () => {
  test('vertical moves and ends', () => {
    expect(rowKeyAction('ArrowDown', leafRow)).toBe('next');
    expect(rowKeyAction('ArrowUp', leafRow)).toBe('previous');
    expect(rowKeyAction('Home', leafRow)).toBe('first');
    expect(rowKeyAction('End', leafRow)).toBe('last');
  });
  test('Enter and Space activate; other keys are not the grid’s', () => {
    expect(rowKeyAction('Enter', leafRow)).toBe('activate');
    expect(rowKeyAction(' ', leafRow)).toBe('activate');
    expect(rowKeyAction('v', leafRow)).toBeNull();
    expect(rowKeyAction('Escape', leafRow)).toBeNull();
  });
  test('Right expands a collapsed parent, else goes to the first cell', () => {
    expect(rowKeyAction('ArrowRight', collapsed)).toBe('expand');
    expect(rowKeyAction('ArrowRight', open)).toBe('firstCell');
    expect(rowKeyAction('ArrowRight', leafRow)).toBe('firstCell');
  });
  test('Left collapses an expanded parent, else goes to the parent row', () => {
    expect(rowKeyAction('ArrowLeft', open)).toBe('collapse');
    expect(rowKeyAction('ArrowLeft', collapsed)).toBe('parent');
    expect(rowKeyAction('ArrowLeft', leafRow)).toBe('parent');
  });
  test('* expands the siblings', () => {
    expect(rowKeyAction('*', collapsed)).toBe('expandSiblings');
  });
});

describe('cellKeyAction', () => {
  const middle = { first: false, last: false };
  test('Right and Left walk the cells and Left from the first returns to the row', () => {
    expect(cellKeyAction('ArrowRight', middle)).toBe('nextCell');
    expect(cellKeyAction('ArrowRight', { first: false, last: true })).toBeNull();
    expect(cellKeyAction('ArrowLeft', middle)).toBe('previousCell');
    expect(cellKeyAction('ArrowLeft', { first: true, last: false })).toBe('row');
  });
  test('Escape returns to the row', () => {
    expect(cellKeyAction('Escape', middle)).toBe('row');
  });
  test('Up and Down move to the adjacent row', () => {
    expect(cellKeyAction('ArrowDown', middle)).toBe('next');
    expect(cellKeyAction('ArrowUp', middle)).toBe('previous');
  });
  test('Home and End move to the first and last cell; with Ctrl, the first and last row', () => {
    expect(cellKeyAction('Home', middle)).toBe('firstCell');
    expect(cellKeyAction('End', middle)).toBe('lastCell');
    expect(cellKeyAction('Home', middle, true)).toBe('first');
    expect(cellKeyAction('End', middle, true)).toBe('last');
  });
  test('Enter, Space and letters stay the button’s own', () => {
    expect(cellKeyAction('Enter', middle)).toBeNull();
    expect(cellKeyAction(' ', middle)).toBeNull();
    expect(cellKeyAction('v', middle)).toBeNull();
  });
});

describe('movedIndex', () => {
  test('stays inside the rows', () => {
    expect(movedIndex('next', 2, 3)).toBe(2);
    expect(movedIndex('previous', 0, 3)).toBe(0);
    expect(movedIndex('next', 0, 3)).toBe(1);
    expect(movedIndex('first', 2, 3)).toBe(0);
    expect(movedIndex('last', 0, 3)).toBe(2);
  });
});

const leaf = (id: string, label = id): TreegridNode<null> => ({ id, label, data: null });
const tree: TreegridNode<null>[] = [
  {
    id: 'a',
    label: 'Alpha',
    data: null,
    children: [leaf('a1'), { ...leaf('a2'), children: [leaf('a2x')] }],
  },
  leaf('b'),
];

describe('visibleRows', () => {
  test('children appear only while their parent is expanded', () => {
    expect(visibleRows(tree, new Set()).map((r) => r.node.id)).toEqual(['a', 'b']);
    expect(visibleRows(tree, new Set(['a'])).map((r) => r.node.id)).toEqual(['a', 'a1', 'a2', 'b']);
    expect(visibleRows(tree, new Set(['a', 'a2'])).map((r) => r.node.id)).toEqual([
      'a',
      'a1',
      'a2',
      'a2x',
      'b',
    ]);
  });
  test('an expanded id under a collapsed ancestor stays hidden', () => {
    expect(visibleRows(tree, new Set(['a2'])).map((r) => r.node.id)).toEqual(['a', 'b']);
  });
  test('level, set size and position are among all siblings', () => {
    const rows = visibleRows(tree, new Set(['a']));
    expect(rows.map((r) => [r.level, r.posinset, r.setsize, r.parentId])).toEqual([
      [1, 1, 2, null],
      [2, 1, 2, 'a'],
      [2, 2, 2, 'a'],
      [1, 2, 2, null],
    ]);
  });
  test('only parents report expandable and expanded', () => {
    const [a, , a2] = visibleRows(tree, new Set(['a']));
    expect([a.expandable, a.expanded, a2.expandable, a2.expanded]).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(visibleRows(tree, new Set(['a']))[1].expandable).toBe(false);
  });
});

test('expandableIds lists every parent at every depth', () => {
  expect([...expandableIds(tree)].sort()).toEqual(['a', 'a2']);
});

describe('typeAheadMatch', () => {
  const labels = ['Frontal', 'Insula', 'Limbic', 'Lateral', 'Occipital'];
  test('finds the first label starting with the query, wrapping', () => {
    expect(typeAheadMatch(labels, 0, 'o')).toBe(4);
    expect(typeAheadMatch(labels, 4, 'f')).toBe(0);
  });
  test('is case-insensitive and keeps the current row while the query extends', () => {
    expect(typeAheadMatch(labels, 2, 'LI')).toBe(2);
    expect(typeAheadMatch(labels, 0, 'la')).toBe(3);
  });
  test('a repeated letter cycles through the labels that start with it', () => {
    expect(typeAheadMatch(labels, 2, 'l')).toBe(3);
    expect(typeAheadMatch(labels, 2, 'll')).toBe(3);
    expect(typeAheadMatch(labels, 3, 'l')).toBe(2);
  });
  test('no match is -1', () => {
    expect(typeAheadMatch(labels, 0, 'z')).toBe(-1);
  });
});

test('isTypeAheadKey is one printable character without a command modifier', () => {
  const key = (k: string, m = {}) => ({
    key: k,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    ...m,
  });
  expect(isTypeAheadKey(key('a'))).toBe(true);
  expect(isTypeAheadKey(key('A'))).toBe(true);
  expect(isTypeAheadKey(key(' '))).toBe(false);
  expect(isTypeAheadKey(key('*'))).toBe(false);
  expect(isTypeAheadKey(key('Enter'))).toBe(false);
  expect(isTypeAheadKey(key('a', { ctrlKey: true }))).toBe(false);
});

describe('survivingRowId', () => {
  const parents = new Map<string, string | null>([
    ['a', null],
    ['a1', 'a'],
    ['a2', 'a'],
    ['a2x', 'a2'],
    ['b', null],
  ]);
  const shown = (open: string[]) => visibleRows(tree, new Set(open));
  test('a row still shown keeps the stop', () => {
    expect(survivingRowId(shown(['a']), 'a1', parents)).toBe('a1');
  });
  test('a row that left the view hands the stop to the nearest ancestor shown', () => {
    expect(survivingRowId(shown([]), 'a2x', parents)).toBe('a');
    expect(survivingRowId(shown(['a']), 'a2x', parents)).toBe('a2');
  });
  test('a row that is gone, or no stop yet, falls to the first row', () => {
    expect(survivingRowId(shown([]), 'gone', parents)).toBe('a');
    expect(survivingRowId(shown([]), null, parents)).toBe('a');
  });
  test('an empty grid has no stop', () => {
    expect(survivingRowId([], 'a', parents)).toBeNull();
  });
});
