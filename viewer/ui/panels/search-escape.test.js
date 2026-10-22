import assert from 'node:assert/strict';
import test from 'node:test';
import { createClinicalExplorer } from './clinical.js';
import { createNavigator } from './navigator.js';

/** Just enough of a document for a panel to bind its listeners. */
function stubDocument(t) {
  const elements = new Map();
  const element = () => {
    const listeners = new Map();
    return {
      value: '',
      addEventListener: (type, listener) => listeners.set(type, listener),
      removeEventListener() {},
      append() {},
      dispatch: (type, event) => listeners.get(type)?.(event),
    };
  };
  const previous = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    },
    createElement: element,
  };
  t.after(() => { globalThis.document = previous; });
  return id => globalThis.document.getElementById(id);
}

const escape = () => ({ key: 'Escape', defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } });

// The field keeps focus, and the render that follows leaves a focused field's text alone.
for (const [panel, id, create] of [
  ['deficit', 'deficit-search', onQuery => createClinicalExplorer({ onQuery })],
  ['anatomy', 'search', onQuery => createNavigator({ onQuery })],
]) {
  test(`Escape in the ${panel} search empties the field as well as the query`, t => {
    const byId = stubDocument(t);
    const queries = [];
    create(query => queries.push(query));
    const search = byId(id);
    search.value = 'aphas';
    const event = escape();
    search.dispatch('keydown', event);
    assert.equal(search.value, '');
    assert.deepEqual(queries, ['']);
    assert.ok(event.defaultPrevented, 'and the page does not go on to clear the selection');
  });
}
