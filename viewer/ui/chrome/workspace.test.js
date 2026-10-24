import assert from 'node:assert/strict';
import test from 'node:test';
import { MODES, createWorkspace, detailAvailable, locationCrumbs, stripVisible, viewAfterUpdate } from './workspace.js';
import { t } from '../../i18n/translations.js';

test('the tab row is the five content modes, in session order', () => {
  assert.deepEqual(MODES, ['anatomy', 'functions', 'deficits', 'circuits', 'diffusion']);
});

/** The workspace DOM, without a renderer or downloaded anatomy. */
function workspaceDocument(t) {
  const previousDocument = globalThis.document;
  const previousMatchMedia = globalThis.matchMedia;
  const nodes = new Map();
  const doc = { activeElement: null };
  function element(id) {
    const attributes = new Map();
    const listeners = new Map();
    const node = {
      id, children: [], dataset: {}, parentElement: null, isConnected: true,
      addEventListener(type, listener) { listeners.set(type, listener); },
      removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
      dispatch(type, event) { listeners.get(type)?.(event); },
      setAttribute(name, value) { attributes.set(name, String(value)); },
      getAttribute(name) { return attributes.get(name) ?? null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      closest() { return element('li'); },
      contains(target) { return target === node || node.children.some(child => child.contains(target)); },
      checkVisibility() { return !node.hidden && (!node.parentElement || node.parentElement.checkVisibility()); },
      scrollIntoView() {},
      append(...children) {
        for (const child of children) {
          if (child.parentElement) {
            child.parentElement.children = child.parentElement.children.filter(item => item !== child);
            if (child.contains(doc.activeElement)) doc.activeElement = null;
          }
          child.parentElement = node;
          node.children.push(child);
        }
      },
      prepend(child) { node.append(child); node.children.unshift(node.children.pop()); },
      replaceChildren() { node.children = []; },
      focus() { doc.activeElement = node; },
    };
    return node;
  }
  doc.createElement = element;
  doc.getElementById = id => {
    if (!nodes.has(id)) nodes.set(id, element(id));
    return nodes.get(id);
  };
  globalThis.document = doc;
  globalThis.matchMedia = () => ({ matches: false });
  const byId = doc.getElementById;
  byId('workspace-panel').append(byId('workspace-tabs'), byId('navigator'), byId('inspector'));
  byId('inspector').append(byId('detail-back'));
  t.after(() => {
    globalThis.document = previousDocument;
    globalThis.matchMedia = previousMatchMedia;
  });
  return { doc, byId };
}

test('desktop navigation stays in the task panel with a separate phone mirror', context => {
  const { byId } = workspaceDocument(context);
  const workspace = createWorkspace();
  context.after(() => workspace.dispose());
  workspace.activate();
  assert.equal(byId('workspace-tabs').parentElement, byId('workspace-panel'));
  assert.equal(byId('workspace-tabs').hidden, false);
  assert.deepEqual(byId('workspace-tabs').children.map(button => button.dataset.mode), MODES);
  assert.deepEqual(byId('sheet-tabs').children.map(button => button.dataset.mode), MODES);
});

test('desktop and phone navigation follow the workspace language', context => {
  const { byId } = workspaceDocument(context);
  const workspace = createWorkspace();
  context.after(() => workspace.dispose());
  for (const lang of ['en', 'fr']) {
    workspace.update({ lang, explorer: 'anatomy' });
    for (const id of ['workspace-tabs', 'sheet-tabs']) {
      assert.equal(byId(id).getAttribute('aria-label'), t(lang, 'workspace').tabsAria);
      assert.deepEqual(byId(id).children.map(button => button.textContent),
        MODES.map(mode => t(lang, 'workspace').modes[mode]));
    }
  }
});

test('vertical arrows on a mode tab stay out of the page anatomy-tree navigation', t => {
  const { doc, byId } = workspaceDocument(t);
  const modes = [];
  const workspace = createWorkspace({ onMode: mode => modes.push(mode) });
  t.after(() => workspace.dispose());
  for (const id of ['workspace-tabs', 'sheet-tabs']) {
    const bar = byId(id);
    const tab = bar.children[0];
    tab.focus();
    for (const key of ['ArrowUp', 'ArrowDown']) {
      const event = { key, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      bar.dispatch('keydown', event);
      assert.equal(event.defaultPrevented, true, `${id}: ${key} must not move anatomy-tree focus`);
      assert.equal(doc.activeElement, tab);
    }
  }
  assert.deepEqual(modes, [], 'vertical arrows never choose a mode');
});

for (const selectedRow of [true, false]) {
  test(`Back from the phone detail focuses ${selectedRow ? 'the selected list row' : 'the current tab when no row is available'}`, t => {
    const { doc, byId } = workspaceDocument(t);
    const workspace = createWorkspace({ catalog: { groups: () => [] } });
    t.after(() => workspace.dispose());
    const row = selectedRow ? byId('selected-row') : null;
    if (row) byId('navigator').append(row);
    byId('navigator').querySelector = () => row;
    byId('navigator').querySelectorAll = () => row ? [row] : [];
    workspace.update({ lang: 'en', explorer: 'anatomy', selectedRegion: { id: 'left:1' } },
      { kind: 'region', label: 'Precentral gyrus' });
    byId('detail-back').focus();
    workspace.back();
    assert.equal(workspace.view, 'list');
    assert.equal(doc.activeElement, row ?? byId('sheet-tabs').children[0]);
  });
}

const tracts = { explorer: 'diffusion', anatomy: 'bert', referenceAnatomy: 'bert' };

test('a selected region is detail in any mode', () => {
  for (const explorer of ['anatomy', 'functions', 'deficits', 'circuits']) {
    assert.equal(detailAvailable({ explorer, selectedRegion: { id: 'a' } }), true, explorer);
  }
  assert.equal(detailAvailable({ ...tracts, selectedRegion: { id: 'a' } }), true);
});

test('a function, a deficit or a lesson is detail only in its own mode', () => {
  assert.equal(detailAvailable({ explorer: 'functions', selectedFunction: 'all' }), true);
  assert.equal(detailAvailable({ explorer: 'functions', selectedFunction: null }), false);
  assert.equal(detailAvailable({ explorer: 'deficits', selectedFunction: 'language' }), false);
  assert.equal(detailAvailable({ explorer: 'deficits', selectedDeficit: 'aphasia' }), true);
  assert.equal(detailAvailable({ explorer: 'anatomy', selectedDeficit: 'aphasia' }), false);
  assert.equal(detailAvailable({ explorer: 'circuits', lesson: { circuit: 'motor' } }), true);
  assert.equal(detailAvailable({ explorer: 'circuits', lesson: { circuit: null } }), false);
  assert.equal(detailAvailable({ explorer: 'anatomy', lesson: { circuit: 'motor' } }), false);
});

test('tract reference data offers no detail view', () => {
  const reference = { ...tracts, anatomy: 'aomic', selectedRegion: { id: 'a' } };
  assert.equal(detailAvailable(reference), false);
  assert.equal(view({ view: 'detail', reference: true, available: false, selection: 'a' }), 'list');
  assert.throws(() => detailAvailable({ explorer: 'diffusion' }), /anatomy/);
});

function view(state) {
  return viewAfterUpdate({
    view: 'list', reference: false, wasAvailable: false, available: false,
    previousSelection: null, selection: null, ...state,
  });
}

test('a new region selection drills into the detail view', () => {
  assert.equal(view({ selection: 'left:1', available: true }), 'detail');
  assert.equal(view({ previousSelection: 'left:1', selection: 'left:2', available: true, wasAvailable: true }), 'detail');
});

test('going back keeps the list for the same selection', () => {
  assert.equal(view({
    previousSelection: 'left:1', selection: 'left:1', available: true, wasAvailable: true,
  }), 'list');
});

test('clearing the last context returns to the list', () => {
  assert.equal(view({ view: 'detail', previousSelection: 'left:1', wasAvailable: true }), 'list');
});

test('a deficit or lesson keeps the detail open once the region is cleared', () => {
  assert.equal(view({
    view: 'detail', previousSelection: 'left:1', wasAvailable: true, available: true,
  }), 'detail');
});

test('a detail opened ahead of its context waits for it rather than closing', () => {
  assert.equal(view({ view: 'detail' }), 'detail');
});

test('the selection strip never repeats the detail it would open', () => {
  const region = { kind: 'region', label: 'Precentral gyrus' };
  for (const mode of MODES) assert.equal(stripVisible({ view: 'detail', mode, selection: region }), false);
});

test('the selection strip leads only from a list that does not show the selection', () => {
  const strip = (mode, kind) => stripVisible({ view: 'list', mode, selection: { kind, label: 'x' } });
  assert.equal(strip('anatomy', 'region'), false, 'the tree shows the selected row');
  assert.equal(strip('deficits', 'region'), true);
  assert.equal(strip('circuits', 'region'), true);
  assert.equal(strip('diffusion', 'region'), true);
  assert.equal(strip('circuits', 'landmark'), false, 'the step list shows the current landmark');
  assert.equal(strip('deficits', 'deficit'), false);
  assert.equal(strip('functions', 'function'), false);
  assert.equal(strip('anatomy', 'function'), true);
  assert.equal(strip('circuits', 'lesson'), false);
  assert.equal(stripVisible({ view: 'list', mode: 'deficits', selection: {} }), false);
  assert.throws(() => strip('anatomy', 'atlas'), /kind/);
});

test('a region read from Anatomy carries its tree group in the location bar', () => {
  const labels = t('en', 'workspace').modes;
  const frontal = { key: 'cortex:Frontal', label: 'Frontal' };
  assert.deepEqual(locationCrumbs({ mode: 'anatomy', place: null, group: frontal, labels }), [
    { kind: 'list', label: 'Anatomy' },
    { kind: 'group', key: 'cortex:Frontal', label: 'Frontal' },
  ]);
  assert.deepEqual(locationCrumbs({ mode: 'anatomy', place: null, group: null, labels }),
    [{ kind: 'list', label: 'Anatomy' }], 'a region the tree does not list has no group to return to');
});

test('every mode reads Mode › Place: the way back is the mode, and a tree group belongs to Anatomy alone', () => {
  const labels = t('fr', 'workspace').modes;
  const group = { key: 'cortex:Frontal', label: 'Frontal' };
  assert.deepEqual(locationCrumbs({ mode: 'deficits', place: 'Langage', group, labels }),
    [{ kind: 'list', label: 'Déficits' }, { kind: 'group', label: 'Langage' }]);
  assert.deepEqual(locationCrumbs({ mode: 'diffusion', place: null, group, labels }), [{ kind: 'list', label: 'Faisceaux' }]);
  assert.deepEqual(locationCrumbs({ mode: 'circuits', place: 'Voie motrice', group, labels }),
    [{ kind: 'list', label: 'Circuits' }, { kind: 'group', label: 'Voie motrice' }]);
});

test('the path and its group crumb are named in both languages', () => {
  for (const lang of ['en', 'fr']) {
    const copy = t(lang, 'workspace');
    assert.ok(copy.path);
    assert.match(copy.showInList('Frontal'), /^Frontal\b/, 'the spoken name starts with the visible one');
  }
});
