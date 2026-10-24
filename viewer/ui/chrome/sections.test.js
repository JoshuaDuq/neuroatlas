import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import { createSectionControls } from './sections.js';

/** The linked MRI dialog's actual controls, without downloading or drawing a volume. */
function sectionFixture(t) {
  const previous = globalThis.document;
  const nodes = new Map();
  const doc = { activeElement: null };
  function element(id) {
    const listeners = new Map();
    const attributes = new Set();
    return {
      id, dataset: {}, children: [], options: [], ownerDocument: doc, open: false,
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      querySelectorAll(selector) { return selector === 'button' ? this.children : []; },
      querySelector(selector) { return byId(`${id} ${selector}`); },
      closest(selector) { return byId(`${id} ${selector}`); },
      contains(node) { return this.children.includes(node); },
      setAttribute() {},
      getAttribute() { return null; },
      toggleAttribute(name, force) { if (force) attributes.add(name); else attributes.delete(name); },
      hasAttribute(name) { return attributes.has(name); },
      addEventListener(type, callback) {
        const callbacks = listeners.get(type) ?? new Set();
        callbacks.add(callback);
        listeners.set(type, callbacks);
      },
      removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
      async dispatch(type, event = {}) {
        event.target ??= this;
        for (const callback of listeners.get(type) ?? []) await callback(event);
      },
      showModal() { this.open = true; },
      close() { this.open = false; },
    };
  }
  function byId(id) {
    if (!nodes.has(id)) nodes.set(id, element(id));
    return nodes.get(id);
  }
  doc.getElementById = byId;
  doc.createElement = element;
  globalThis.document = doc;
  const sections = {
    state: { mode: 'off', cutAtlas: 'destrieux', crosshair: [0, 0, 0], tilt: 0, azimuth: 0 },
    frame: { normal: new Vector3(0, 0, 1) },
    model: {},
    offsetRange: [-128, 128],
    active: false,
    load: async () => {},
  };
  const controls = createSectionControls(sections, { anatomy: {}, cutAtlases: [] });
  t.after(() => {
    controls.dispose();
    globalThis.document = previous;
  });
  return { byId, sections };
}

for (const button of ['mpr-open', 'region-mpr']) {
  test(`${button} keeps keyboard entry immediate after MRI preparation`, async t => {
    const { byId } = sectionFixture(t);
    await byId(button).dispatch('click', { detail: 0 });
    assert.equal(byId('mpr-dialog').open, true);
    assert.equal(byId('mpr-dialog').hasAttribute('data-instant'), true);
    await byId('mpr-close').dispatch('click', { detail: 1 });
    assert.equal(byId('mpr-dialog').hasAttribute('data-instant'), false);
    await byId(button).dispatch('click', { detail: 1 });
    assert.equal(byId('mpr-dialog').hasAttribute('data-instant'), false);
  });
}

test('Linked MRI closes immediately from the keyboard and native Escape', async t => {
  const { byId } = sectionFixture(t);
  const dialog = byId('mpr-dialog');
  await byId('mpr-open').dispatch('click', { detail: 1 });
  await byId('mpr-close').dispatch('click', { detail: 0 });
  assert.equal(dialog.open, false);
  assert.equal(dialog.hasAttribute('data-instant'), true);
  await byId('mpr-open').dispatch('click', { detail: 1 });
  await dialog.dispatch('cancel');
  assert.equal(dialog.hasAttribute('data-instant'), true);
});

test('clearing the exact cut position restores its current value without moving the cut', async t => {
  const { byId, sections } = sectionFixture(t);
  sections.state.crosshair = [10, 20, 37.5];
  const offsets = [];
  sections.setOffset = offset => offsets.push(offset);
  const number = byId('cut-number');
  number.ownerDocument.activeElement = number;
  number.value = '';

  await number.dispatch('change');

  assert.deepEqual(offsets, []);
  assert.deepEqual(sections.state.crosshair, [10, 20, 37.5]);
  assert.equal(number.value, '37.5');
});

test('valid exact cut positions keep their signed numeric values, including zero', async t => {
  const { byId, sections } = sectionFixture(t);
  const offsets = [];
  sections.setOffset = offset => offsets.push(offset);
  const number = byId('cut-number');

  for (const value of ['-12.5', '0', '18.75']) {
    number.value = value;
    await number.dispatch('change');
  }

  assert.deepEqual(offsets, [-12.5, 0, 18.75]);
});
