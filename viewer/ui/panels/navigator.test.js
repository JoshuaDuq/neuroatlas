import assert from 'node:assert/strict';
import test from 'node:test';
import {
  controlKeyAction, createNavigator, groupDisplayName, labelledGroups, matchesElsewhere, nextEnabledIndex, regionGroup,
  rowStatesReason, sectionReasons, sharedGroupNames, treeKeyAction, vocabularyOf,
} from './navigator.js';
import { cutAtlasesOf, visibilityOf } from '../../catalog/visibility.js';
import { visibilityStateOf } from './visibility-control.js';

test('an arrow moves past a row that cannot be chosen', () => {
  assert.equal(nextEnabledIndex([false, true, false], 0, 1), 2);
  assert.equal(nextEnabledIndex([false, true, false], 2, -1), 0);
});

test('an arrow at the end of the list leaves the armed row where it is', () => {
  assert.equal(nextEnabledIndex([false, true], 0, 1), 0);
  assert.equal(nextEnabledIndex([true, false], 1, 1), 1);
  assert.equal(nextEnabledIndex([false], 0, -1), 0);
});

test('the first arrow from an empty field lands on the first choosable row', () => {
  assert.equal(nextEnabledIndex([true, false, false], -1, 1), 1);
});

const closed = { group: true, expanded: false };
const open = { group: true, expanded: true };
const leaf = { group: false, expanded: false };

test('the tree moves by row, and Home and End reach its ends', () => {
  for (const row of [closed, open, leaf]) {
    assert.equal(treeKeyAction('ArrowDown', row), 'next');
    assert.equal(treeKeyAction('ArrowUp', row), 'previous');
    assert.equal(treeKeyAction('Home', row), 'first');
    assert.equal(treeKeyAction('End', row), 'last');
    assert.equal(treeKeyAction('Enter', row), 'activate');
    assert.equal(treeKeyAction(' ', row), 'activate');
  }
});

test('right opens a group, then enters it; left closes it', () => {
  assert.equal(treeKeyAction('ArrowRight', closed), 'expand');
  assert.equal(treeKeyAction('ArrowRight', open), 'child');
  assert.equal(treeKeyAction('ArrowLeft', open), 'collapse');
  assert.equal(treeKeyAction('ArrowLeft', closed), null);
});

test('on a region, right reaches its eye control and left its group', () => {
  assert.equal(treeKeyAction('ArrowRight', leaf), 'controls');
  assert.equal(treeKeyAction('ArrowLeft', leaf), 'parent');
});

test('V hides or shows the focused row, whatever its kind', () => {
  for (const row of [closed, open, leaf]) {
    assert.equal(treeKeyAction('v', row), 'visibility');
    assert.equal(treeKeyAction('V', row), 'visibility');
  }
  assert.equal(treeKeyAction('x', leaf), null);
});

test('eye controls step sideways and hand back to their row', () => {
  const only = { first: true, last: true };
  const middle = { first: false, last: false };
  assert.equal(controlKeyAction('ArrowLeft', only), 'row');
  assert.equal(controlKeyAction('ArrowRight', only), null);
  assert.equal(controlKeyAction('ArrowLeft', middle), 'previousControl');
  assert.equal(controlKeyAction('ArrowRight', middle), 'nextControl');
  assert.equal(controlKeyAction('Escape', middle), 'row');
  assert.equal(controlKeyAction('ArrowDown', middle), 'next');
  assert.equal(controlKeyAction('ArrowUp', middle), 'previous');
  // The button activates itself.
  assert.equal(controlKeyAction('Enter', middle), null);
  assert.equal(controlKeyAction(' ', middle), null);
});

test('an eye is shown, hidden, or partial, so a group with hidden parts stays in view', () => {
  const hidden = new Set(['a', 'b']);
  assert.equal(visibilityStateOf(['c'], hidden), 'shown');
  assert.equal(visibilityStateOf(['a', 'b'], hidden), 'hidden');
  assert.equal(visibilityStateOf(['a', 'c'], hidden), 'partial');
});

const lobe = { kind: 'cortex', atlas: 'destrieux' };
const network = { kind: 'cortex', atlas: 'hcp-mmp' };
const structure = { kind: 'structure', atlas: 'learning' };
const group = (name, region) => ({ name, rows: [{ region }] });

test('a group name says which vocabulary it is from only when two vocabularies share it', () => {
  assert.equal(vocabularyOf(lobe), 'lobe');
  assert.equal(vocabularyOf(network), 'network');
  assert.equal(vocabularyOf(structure), 'system');
  assert.equal(vocabularyOf({ kind: 'tissue-region', atlas: 'nextbrain' }), 'system');
  const shared = sharedGroupNames([
    group('Limbic', lobe), group('Frontal', lobe), group('Limbic', structure), group('Brainstem', structure),
  ]);
  assert.deepEqual([...shared], ['Limbic']);
  assert.equal(groupDisplayName('Limbic', lobe, shared, 'en'), 'Limbic lobe');
  assert.equal(groupDisplayName('Limbic', network, shared, 'en'), 'Limbic network');
  assert.equal(groupDisplayName('Limbic', structure, shared, 'en'), 'Limbic system');
  assert.equal(groupDisplayName('Frontal', lobe, shared, 'en'), 'Frontal');
  assert.equal(groupDisplayName('Limbique', lobe, new Set(['Limbique']), 'fr'), 'Lobe limbique');
  assert.equal(groupDisplayName('Limbique', structure, new Set(['Limbique']), 'fr'), 'Système limbique');
});

test('two families in one vocabulary keep their names', () => {
  const tissue = { kind: 'tissue-region', atlas: 'nextbrain' };
  assert.equal(sharedGroupNames([group('Limbic', structure), group('Limbic', tissue)]).size, 0);
});

test('a qualified name is sorted by what the list shows, within its family', () => {
  const lobeFr = { kind: 'cortex', atlas: 'destrieux' };
  const groups = [
    { ...group('Insula', lobeFr), kind: 'cortex' }, { ...group('Limbique', lobeFr), kind: 'cortex' },
    { ...group('Cervelet', structure), kind: 'structure' }, { ...group('Limbique', structure), kind: 'structure' },
    { ...group('Tronc cérébral', structure), kind: 'structure' },
  ];
  assert.deepEqual(labelledGroups(groups, 'fr').map(entry => entry.label),
    ['Insula', 'Lobe limbique', 'Cervelet', 'Système limbique', 'Tronc cérébral']);
});

test('a region\'s group is the one the tree lists it under, qualified as the tree shows it', () => {
  const row = (id, region) => ({ region: { ...region, id } });
  const groups = [
    { name: 'Limbic', key: 'cortex:Limbic', kind: 'cortex', rows: [row('a', lobe)] },
    { name: 'Frontal', key: 'cortex:Frontal', kind: 'cortex', rows: [row('b', lobe), row('c', lobe)] },
    { name: 'Limbic', key: 'structure:Limbic', kind: 'structure', rows: [row('d', structure)] },
  ];
  assert.deepEqual(regionGroup(groups, 'c', 'en'), { key: 'cortex:Frontal', label: 'Frontal' });
  assert.deepEqual(regionGroup(groups, 'a', 'en'), { key: 'cortex:Limbic', label: 'Limbic lobe' });
  assert.deepEqual(regionGroup(groups, 'd', 'en'), { key: 'structure:Limbic', label: 'Limbic system' });
  assert.equal(regionGroup(groups, 'elsewhere', 'en'), null);
});

test('a match in another cut atlas offers the cut atlas that draws it, not merely another one', () => {
  const cutAtlases = [{ id: 'destrieux' }, { id: 'hcp-mmp' }, { id: 'nextbrain' }];
  const row = (id, region) => ({ region: { id, kind: 'tissue-region', ...region } });
  const histological = row('nb', { atlas: 'nextbrain' });
  const gyral = row('wm', { atlas: 'wmparc', cut_atlases: ['destrieux', 'hcp-mmp'] });
  const offered = (rows, current) => matchesElsewhere(rows, cutAtlases, current, cutAtlasesOf)
    .map(({ atlas, rows: drawn }) => [atlas.id, drawn.map(entry => entry.region.id)]);
  assert.deepEqual(offered([histological], 'destrieux'), [['nextbrain', ['nb']]]);
  assert.deepEqual(offered([histological], 'hcp-mmp'), [['nextbrain', ['nb']]]);
  assert.deepEqual(offered([gyral], 'nextbrain'), [['destrieux', ['wm']]]);
  assert.throws(() => matchesElsewhere([histological], cutAtlases.slice(0, 2), 'destrieux', cutAtlasesOf),
    /No other atlas draws nb/);
});

test('a match in another surface atlas offers that atlas', () => {
  const atlases = [{ id: 'destrieux' }, { id: 'hcp-mmp' }];
  const rows = [{ region: { id: 'v1', atlas: 'hcp-mmp' } }];
  assert.deepEqual(matchesElsewhere(rows, atlases, 'destrieux', region => [region.atlas])
    .map(({ atlas }) => atlas.id), ['hcp-mmp']);
});

const shown = { visible: true, reason: null };
const hiddenBy = reason => ({ visible: false, reason });

test('a setting that hides rows is said once per section, in the order met', () => {
  const said = sectionReasons([
    { kind: 'cortex', rows: [hiddenBy('cortex-hidden'), hiddenBy('cortex-hidden')] },
    { kind: 'cortex', rows: [hiddenBy('cortex-hidden'), hiddenBy('hemisphere')] },
    { kind: 'structure', rows: [shown, hiddenBy('removed'), hiddenBy('no-mri')] },
    { kind: 'tissue', rows: [hiddenBy('no-cut')] },
  ]);
  assert.deepEqual([...said], [['cortex', ['cortex-hidden', 'hemisphere']], ['tissue', ['no-cut']]]);
});

test('a hidden row prints only a reason of its own', () => {
  assert.equal(rowStatesReason(shown), false);
  assert.equal(rowStatesReason(hiddenBy('hemisphere')), false, 'the caption says it');
  assert.equal(rowStatesReason(hiddenBy('removed')), false, 'the struck eye says it');
  assert.equal(rowStatesReason(hiddenBy('no-mri')), true);
  assert.equal(rowStatesReason(hiddenBy('below-cut-resolution')), true);
});

/** The tree's real render path, without a renderer or downloaded anatomy. */
function navigatorDocument(t, catalog) {
  const previous = globalThis.document;
  const previousCss = globalThis.CSS;
  const nodes = new Map();
  const doc = { activeElement: null };
  function element() {
    const attributes = new Map();
    const listeners = new Map();
    const node = {
      children: [], dataset: {}, value: '', classList: { add() {} },
      addEventListener(type, listener) { listeners.set(type, listener); },
      removeEventListener(type) { listeners.delete(type); },
      dispatch(type, event) { event.target ??= node; listeners.get(type)?.(event); },
      scrollIntoView() {},
      setAttribute(name, value) { attributes.set(name, String(value)); },
      getAttribute(name) { return attributes.get(name) ?? null; },
      removeAttribute(name) { attributes.delete(name); },
      append(...children) {
        for (const child of children) {
          child.parentNode = node;
          node.children.push(child);
        }
      },
      replaceChildren(...children) { node.children = []; node.append(...children); },
      contains(target) { return target === node || node.children.some(child => child.contains(target)); },
      closest(selector) {
        const matches = selector === '[role="treeitem"]' ? node.getAttribute('role') === 'treeitem'
          : node.className?.split(' ').includes(selector.slice(1));
        return matches ? node : node.parentNode?.closest(selector);
      },
      querySelector(selector) {
        if (selector === ':scope > .group-row') return node.children.find(child => child.className?.includes('group-row'));
        return node.querySelectorAll(selector)[0] ?? null;
      },
      querySelectorAll(selector) {
        const role = selector.match(/^\[role="(\w+)"\]$/)?.[1];
        const key = selector.match(/^\[data-group-key="([^"]+)"\]$/)?.[1];
        return node.children.flatMap(child => [
          ...((role && child.getAttribute('role') === role) || (key && child.dataset.groupKey === key) ? [child] : []),
          ...child.querySelectorAll(selector),
        ]);
      },
      remove() {
        if (node.parentNode) node.parentNode.children = node.parentNode.children.filter(child => child !== node);
        node.parentNode = null;
      },
      focus() { doc.activeElement = node; },
    };
    Object.defineProperty(node, 'childElementCount', { get: () => node.children.length });
    return node;
  }
  doc.getElementById = id => {
    if (id === 'tree-toggle-all') return null;
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  };
  doc.createElement = doc.createElementNS = doc.createDocumentFragment = element;
  doc.createTextNode = text => Object.assign(element(), { textContent: text });
  globalThis.document = doc;
  globalThis.CSS = { escape: value => value };
  t.after(() => { globalThis.document = previous; globalThis.CSS = previousCss; });
  const rows = ['a', 'b'].map(id => ({
    region: { id, kind: 'cortex', atlas: 'destrieux', hemisphere: 'left' },
    label: { name: id, group: 'Frontal lobe' }, visible: true,
  }));
  const group = { key: 'cortex:Frontal lobe', name: 'Frontal lobe', kind: 'cortex', rows };
  const state = { lang: 'en', query: '', expanded: new Set([group.key]), hiddenRegions: new Set() };
  const selected = [];
  const navigator = createNavigator({
    catalog: catalog ?? {
      groups: () => [group],
      search(query) {
        const found = rows.filter(row => row.label.name.includes(query.trim()));
        return { rows: found, total: found.length };
      },
    },
    atlases: [], cutAtlases: [],
    onSelect: id => selected.push(id),
    onQuery: query => navigator.update({ ...state, query }),
  });
  t.after(() => navigator.dispose());
  navigator.update(state);
  const tree = doc.getElementById('tree');
  return { navigator, state, tree, selected, byId: doc.getElementById,
    items: () => tree.querySelectorAll('[role="treeitem"]') };
}

test('expanded tree parents own their child groups across rerenders', t => {
  const { navigator, state, items } = navigatorDocument(t);
  const parent = items()[0];
  const children = parent.parentNode.children[1];
  assert.ok(children.id, 'the child group has an addressable id');
  assert.doesNotMatch(children.id, /\s/, 'an owned id is one token even for a multiword group');
  assert.equal(parent.getAttribute('aria-owns'), children.id);
  navigator.update({ ...state, lang: 'fr' });
  assert.equal(items()[0].getAttribute('aria-owns'), children.id, 'the same group keeps its id across a rerender');
  navigator.update({ ...state, expanded: new Set() });
  assert.equal(items()[0].getAttribute('aria-owns'), null, 'a collapsed parent has no missing owned group');
});

test('selectable tree regions expose both selected and unselected states', t => {
  const { navigator, state, items } = navigatorDocument(t);
  assert.deepEqual(items().map(item => item.getAttribute('aria-selected')), [null, 'false', 'false']);
  navigator.update({ ...state, selectedRegion: { id: 'a' } });
  assert.deepEqual(items().map(item => item.getAttribute('aria-selected')), [null, 'true', 'false']);
  navigator.update(state);
  assert.deepEqual(items().map(item => item.getAttribute('aria-selected')), [null, 'false', 'false']);
});

for (const searching of [false, true]) {
  test(`spinal cord visibility refreshes ${searching ? 'search results' : 'the anatomy tree'}`, t => {
    const cord = { id: 'cord', kind: 'structure', atlas: 'zanatomy', hemisphere: 'midline', supplemental: true };
    const rows = state => [{ region: cord, label: { name: 'Spinal cord', group: 'Spinal cord' },
      ...visibilityOf(cord, state) }];
    const catalog = {
      groups: state => [{ key: 'cord', name: 'Spinal cord', kind: 'structure', rows: rows(state) }],
      search: (query, state) => ({ rows: rows(state), total: 1 }),
    };
    const { navigator, state, items, byId } = navigatorDocument(t, catalog);
    const current = { ...state, query: searching ? 'cord' : '', expanded: new Set(['cord']), spinalCordVisible: false };
    const row = () => searching ? byId('results').querySelector('[role="option"]') : items().at(-1);

    navigator.update(current);
    assert.equal(row().dataset.visible, 'false');
    assert.equal(row().dataset.reason, 'spinal-cord-hidden');

    navigator.update({ ...current, spinalCordVisible: true });
    assert.equal(row().dataset.visible, 'true');
    assert.equal(row().dataset.reason, undefined);

    navigator.update(current);
    assert.equal(row().dataset.visible, 'false');
    assert.equal(row().dataset.reason, 'spinal-cord-hidden');
  });
}

const searchKey = key => ({ key, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } });

test('Enter in an anatomy search still chooses its visible active result', t => {
  const { navigator, state, byId, selected } = navigatorDocument(t);
  navigator.update({ ...state, query: 'a' });
  const event = searchKey('Enter');

  byId('search').dispatch('keydown', event);

  assert.deepEqual(selected, ['a']);
  assert.equal(event.defaultPrevented, true);
});

test('Enter used to confirm composition cannot select an active anatomy result', t => {
  const { navigator, state, byId, selected } = navigatorDocument(t);
  navigator.update({ ...state, query: 'a' });
  const event = { ...searchKey('Enter'), isComposing: true };

  byId('search').dispatch('keydown', event);

  assert.deepEqual(selected, []);
  assert.equal(event.defaultPrevented, false);
});

test('clearing an anatomy search removes its active result from the combobox', t => {
  const { navigator, state, byId } = navigatorDocument(t);
  navigator.update({ ...state, query: 'a' });
  const search = byId('search');
  assert.ok(search.getAttribute('aria-activedescendant'));
  search.focus();

  search.dispatch('keydown', searchKey('Escape'));

  assert.equal(search.value, '');
  assert.equal(search.getAttribute('aria-expanded'), 'false');
  assert.equal(search.getAttribute('aria-activedescendant'), null);
  assert.equal(byId('results').querySelectorAll('[role="option"]').some(option => option.dataset.active === 'true'), false);
});

test('Enter in an empty anatomy search cannot activate a previous result', t => {
  const { navigator, state, byId, selected } = navigatorDocument(t);
  navigator.update({ ...state, query: 'a' });
  const search = byId('search');
  search.focus();
  search.dispatch('keydown', searchKey('Escape'));
  const event = searchKey('Enter');

  search.dispatch('keydown', event);

  assert.deepEqual(selected, []);
  assert.equal(event.defaultPrevented, false);
});

test('arrow keys in an empty anatomy search cannot arm hidden results', t => {
  const { navigator, state, byId } = navigatorDocument(t);
  navigator.update({ ...state, query: 'a' });
  const search = byId('search');
  search.focus();
  search.dispatch('keydown', searchKey('Escape'));

  for (const key of ['ArrowDown', 'ArrowUp']) {
    const event = searchKey(key);
    search.dispatch('keydown', event);
    assert.equal(event.defaultPrevented, false);
    assert.equal(search.getAttribute('aria-activedescendant'), null);
  }
});

test('whitespace in an anatomy search remains clearable while the tree is shown', t => {
  const { navigator, state, byId } = navigatorDocument(t);
  navigator.update({ ...state, query: '   ' });

  assert.equal(byId('results').hidden, true);
  assert.equal(byId('search-clear').hidden, false);
  byId('search-clear').dispatch('click', {});
  assert.equal(byId('search').value, '');
  assert.equal(byId('search-clear').hidden, true);
});
