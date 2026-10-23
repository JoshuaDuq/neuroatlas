import assert from 'node:assert/strict';
import test from 'node:test';
import { createInspector, sourceLabel } from './inspector.js';

test('a source label names its atlas and keeps the ids apart, in the code voice', () => {
  assert.deepEqual(sourceLabel({ atlas: 'destrieux', source_label_id: 16 }, 'en'),
    { atlas: 'Destrieux', ids: '16', stacked: false });
  assert.deepEqual(sourceLabel({ atlas: 'learning', source_atlas: 'nextbrain', source_label_ids: [161, 10161] }, 'en'),
    { atlas: 'NextBrain', ids: '161, 10161', stacked: false });
});

test('a list longer than two ids, or a reference without one, takes the line under its label', () => {
  assert.equal(sourceLabel({ atlas: 'learning', source_atlas: 'nextbrain', source_label_ids: [1, 2, 3] }, 'en').stacked, true);
  const reference = sourceLabel({ atlas: 'zanatomy' }, 'fr');
  assert.equal(reference.ids, null);
  assert.equal(reference.stacked, true);
});

test('past eight ids the row counts them and keeps the complete list', () => {
  const ids = Array.from({ length: 52 }, (_, index) => index + 100);
  const label = sourceLabel({ atlas: 'learning', source_atlas: 'nextbrain', source_label_ids: ids }, 'fr');
  assert.equal(label.atlas, 'NextBrain · 52 étiquettes');
  assert.equal(label.ids, null);
  assert.equal(label.all, ids.join(', '));
});

/** The inspector's document without a renderer or downloaded anatomy. */
function inspectorDocument(t) {
  const previous = globalThis.document;
  const nodes = new Map();
  function element(tagName) {
    const classes = new Set();
    return {
      tagName: tagName.toUpperCase(), children: [], dataset: {}, open: false,
      classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); } },
      addEventListener() {}, removeEventListener() {}, setAttribute() {}, removeAttribute() {},
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      closest() { return byId('actions'); },
    };
  }
  const byId = id => {
    if (!nodes.has(id)) nodes.set(id, element('div'));
    return nodes.get(id);
  };
  globalThis.document = { getElementById: byId, createElement: element };
  t.after(() => { globalThis.document = previous; });
  return byId;
}

test('the selection context is localized and leaves with the selection', t => {
  const byId = inspectorDocument(t);
  const inspector = createInspector({
    catalog: { label: (_id, state) => ({ name: 'Thalamus', group: state.lang === 'fr' ? 'Diencéphale' : 'Diencephalon' }) },
    onFocus() {}, onIsolate() {}, onHide() {}, onClear() {},
  });
  t.after(() => inspector.dispose());
  const empty = { selectedRegion: null, lang: 'en', explorer: 'anatomy' };
  inspector.update(empty);
  assert.equal(byId('selected-context').hidden, true);

  const region = { id: 'learning:left:thalamus', atlas: 'learning', kind: 'structure', hemisphere: 'left' };
  for (const [lang, side, group] of [['en', 'Left', 'Diencephalon'], ['fr', 'Gauche', 'Diencéphale']]) {
    inspector.update({ ...empty, selectedRegion: region, lang });
    assert.equal(byId('selected-context').hidden, false);
    assert.equal(byId('fact-hemisphere').textContent, side);
    assert.equal(byId('fact-group').textContent, group);
  }
  inspector.update(empty);
  assert.equal(byId('selected-context').hidden, true);
  assert.equal(byId('selected-facts').hidden, true);
});

test('long source lists use a native disclosure in both languages and stay open during view updates', t => {
  const byId = inspectorDocument(t);
  const inspector = createInspector({
    catalog: { label: () => ({ name: 'Thalamus', group: 'Diencephalon' }) },
    onFocus() {}, onIsolate() {}, onHide() {}, onClear() {},
  });
  t.after(() => inspector.dispose());
  const ids = Array.from({ length: 52 }, (_, index) => index + 100);
  const region = {
    id: 'learning:left:thalamus', atlas: 'learning', source_atlas: 'nextbrain',
    source_label_ids: ids, kind: 'structure', hemisphere: 'left',
  };
  for (const lang of ['en', 'fr']) {
    const state = { selectedRegion: region, lang, explorer: 'anatomy' };
    inspector.update(state);
    const disclosure = byId('fact-source').children[0];
    assert.equal(disclosure.tagName, 'DETAILS');
    assert.equal(disclosure.children[0].tagName, 'SUMMARY');
    assert.equal(disclosure.children[0].textContent, sourceLabel(region, lang).atlas);
    assert.equal(disclosure.children[1].textContent, ids.join(', '));
    assert.equal(disclosure.open, false);
    disclosure.open = true;
    inspector.update({ ...state, isolatedRegion: region });
    assert.equal(byId('fact-source').children[0], disclosure);
    assert.equal(disclosure.open, true);
  }
  inspector.update({ selectedRegion: { ...region, id: 'other', source_label_ids: [161] }, lang: 'en' });
  assert.equal(byId('fact-source').children[0], 'NextBrain · ');
  assert.equal(byId('fact-source').children[1].textContent, '161');
  assert.equal(byId('fact-source').dataset.tooltip, undefined);
});
