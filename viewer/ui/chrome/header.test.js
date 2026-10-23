import assert from 'node:assert/strict';
import test from 'node:test';
import { createHeader, createSettings } from './header.js';

/** The settings controls and their events, without a renderer or downloaded anatomy. */
function settingsDocument(t) {
  const nodes = new Map();
  const previous = globalThis.document;
  const doc = { activeElement: null, fullscreenEnabled: true };
  function element(id) {
    const listeners = new Map();
    const attributes = new Map();
    const node = {
      id, ownerDocument: doc, children: [], dataset: {}, hidden: false, disabled: false,
      addEventListener(type, listener) {
        const group = listeners.get(type) ?? new Set();
        group.add(listener);
        listeners.set(type, group);
      },
      removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
      dispatch(type, event = {}) {
        event.target ??= node;
        event.stopPropagation ??= () => {};
        for (const listener of listeners.get(type) ?? []) listener(event);
      },
      getAttribute(name) { return attributes.get(name) ?? null; },
      setAttribute(name, value) { attributes.set(name, String(value)); },
      removeAttribute(name) { attributes.delete(name); },
      toggleAttribute(name, force = !attributes.has(name)) {
        if (force) attributes.set(name, ''); else attributes.delete(name);
      },
      hasAttribute(name) { return attributes.has(name); },
      querySelectorAll() { return this.children; },
      querySelector() { return null; },
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      contains(target) { return target === node || this.children.some(child => child.contains(target)); },
      matches(selector) { return selector === 'button' && this.tagName === 'BUTTON'; },
      focus() { doc.activeElement = node; },
      click() { this.dispatch('click', { detail: 0 }); },
    };
    return node;
  }
  doc.getElementById = id => {
    if (!nodes.has(id)) nodes.set(id, element(id));
    return nodes.get(id);
  };
  doc.createElement = element;
  doc.querySelectorAll = () => [];
  const events = element('document');
  doc.addEventListener = events.addEventListener;
  doc.removeEventListener = events.removeEventListener;
  doc.dispatch = events.dispatch;
  globalThis.document = doc;
  t.after(() => { globalThis.document = previous; });
  for (const [id, key, values] of [
    ['lang-switch', 'lang', ['en', 'fr']],
    ['theme-switch', 'themeOption', ['system', 'light', 'dark']],
    ['single-keys-switch', 'singleKeys', ['on', 'off']],
  ]) {
    const group = doc.getElementById(id);
    group.children = values.map((value, index) => {
      const button = element(`${id}-${value}`);
      button.tagName = 'BUTTON';
      button.dataset[key] = value;
      button.setAttribute('aria-pressed', String(index === 0));
      return button;
    });
  }
  const menu = doc.getElementById('masthead-menu');
  menu.children = ['lang-switch', 'theme-switch', 'single-keys-switch', 'shortcuts-open'].map(doc.getElementById);
  doc.getElementById('shortcuts-open').tagName = 'BUTTON';
  return { doc, byId: doc.getElementById };
}

function headerDocument(t) {
  const stub = settingsDocument(t);
  const listeners = new Map();
  const previousAdd = globalThis.addEventListener;
  const previousRemove = globalThis.removeEventListener;
  globalThis.addEventListener = (type, listener) => listeners.set(type, listener);
  globalThis.removeEventListener = type => listeners.delete(type);
  let header;
  t.after(() => {
    header.dispose();
    globalThis.addEventListener = previousAdd;
    globalThis.removeEventListener = previousRemove;
  });
  const data = stub.byId('masthead-data');
  data.children = ['anatomy-switch', 'atlas-switch', 'surface-switch', 'detail'].map(stub.byId);
  data.scrollWidth = 600;
  const wrap = stub.byId('masthead-data-wrap');
  wrap.children = [stub.byId('masthead-data-toggle'), data];
  wrap.clientWidth = 900;
  const masthead = stub.byId('masthead');
  masthead.clientWidth = masthead.scrollWidth = 1200;
  header = createHeader({ atlases: [], detailLevels: [], anatomy: { id: 'snail' }, manifest: {} });
  return { ...stub, resize: () => listeners.get('resize')() };
}

function keyEvent(key, target) {
  return { key, target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
}

test('arrow keys in Settings stay out of the page anatomy-tree navigation', t => {
  const { byId } = settingsDocument(t);
  const settings = createSettings({});
  t.after(() => settings.dispose());
  const item = byId('shortcuts-open');
  byId('masthead-more').click();
  item.focus();
  for (const key of ['ArrowDown', 'ArrowUp']) {
    const event = keyEvent(key, item);
    byId('masthead-menu').dispatch('keydown', event);
    assert.equal(event.defaultPrevented, true, `${key} must not move the anatomy-tree focus`);
    assert.equal(byId('masthead-menu').hidden, false);
  }
  for (const key of ['Enter', ' ', 'Tab']) {
    const event = keyEvent(key, item);
    byId('masthead-menu').dispatch('keydown', event);
    assert.equal(event.defaultPrevented, false, `${key} remains the control's native action`);
  }
});

test('Settings opened by a keyboard appears immediately; a pointer keeps the popover transition', t => {
  const { byId } = settingsDocument(t);
  const settings = createSettings({});
  t.after(() => settings.dispose());
  const more = byId('masthead-more');
  const menu = byId('masthead-menu');
  more.dispatch('click', { detail: 0 });
  assert.equal(menu.hidden, false);
  assert.equal(menu.hasAttribute('data-instant'), true);
  more.dispatch('click', { detail: 0 });
  more.dispatch('click', { detail: 1 });
  assert.equal(menu.hidden, false);
  assert.equal(menu.hasAttribute('data-instant'), false);
});

test('a focused data field remains available when the masthead collapses', t => {
  const { byId, doc, resize } = headerDocument(t);
  const field = byId('atlas-switch');
  field.focus();
  byId('masthead-data-wrap').clientWidth = 400;
  resize();
  assert.equal(byId('masthead').hasAttribute('data-collapsed'), true);
  assert.equal(byId('masthead-data-toggle').getAttribute('aria-expanded'), 'true');
  assert.equal(byId('masthead-data').hasAttribute('data-open'), true);
  assert.equal(doc.activeElement, field);
});

test('a masthead collapse leaves the data disclosure closed when focus is elsewhere', t => {
  const { byId, resize } = headerDocument(t);
  byId('masthead-more').focus();
  byId('masthead-data-wrap').clientWidth = 400;
  resize();
  assert.equal(byId('masthead-data-toggle').getAttribute('aria-expanded'), 'false');
});

test('widening a focused data summary hands focus to the first visible native choice', t => {
  const { byId, doc, resize } = headerDocument(t);
  byId('anatomy-switch').hidden = true;
  byId('masthead-data-wrap').clientWidth = 400;
  resize();
  byId('masthead-data-toggle').focus();
  byId('masthead-data-wrap').clientWidth = 900;

  resize();

  assert.equal(byId('masthead').hasAttribute('data-collapsed'), false);
  assert.equal(doc.activeElement, byId('atlas-switch'));
});

test('the data disclosure uses an immediate keyboard open and a pointer transition', t => {
  const { byId } = headerDocument(t);
  const data = byId('masthead-data');
  const toggle = byId('masthead-data-toggle');
  toggle.dispatch('click', { detail: 0 });
  assert.equal(data.hasAttribute('data-open'), true);
  assert.equal(data.hasAttribute('data-instant'), true);
  toggle.dispatch('click', { detail: 0 });
  toggle.dispatch('click', { detail: 1 });
  assert.equal(data.hasAttribute('data-open'), true);
  assert.equal(data.hasAttribute('data-instant'), false);
});

test('a compact masthead drops internal anatomy and colouring when its settings line overflows', t => {
  const { byId, resize } = headerDocument(t);
  const summary = byId('masthead-data-summary');
  const context = {
    clientWidth: 160,
    get scrollWidth() {
      const omitted = summary.dataset.short?.split(' ') ?? [];
      return 220 - omitted.length * 30;
    },
  };
  summary.querySelector = selector => selector.includes('context') ? context : {};
  byId('masthead-data-wrap').clientWidth = 400;

  resize();

  assert.equal(summary.dataset.short, 'detail colour');
  assert.equal(context.clientWidth, context.scrollWidth);
});

test('a compact masthead without internal anatomy omits colouring before its atlas', t => {
  const { byId, resize } = headerDocument(t);
  const summary = byId('masthead-data-summary');
  const context = {
    clientWidth: 160,
    get scrollWidth() { return summary.dataset.short ? 160 : 220; },
  };
  summary.querySelector = selector => selector.includes('context') ? context
    : selector.includes('detail') ? null : {};
  byId('masthead-data-wrap').clientWidth = 400;

  resize();

  assert.equal(summary.dataset.short, 'colour');
  assert.equal(context.clientWidth, context.scrollWidth);
});

test('a compact masthead keeps fitting settings even when the subject must shorten on its own line', t => {
  const { byId, resize } = headerDocument(t);
  const summary = byId('masthead-data-summary');
  const subject = { scrollWidth: 360, clientWidth: 160 };
  const context = { scrollWidth: 160, clientWidth: 160 };
  summary.querySelector = selector => selector.includes('context') ? context
    : selector.includes('subject') ? subject : {};
  byId('masthead-data-wrap').clientWidth = 400;

  resize();

  assert.equal(summary.dataset.short, undefined);
});

test('a compact masthead omits the atlas last when even one setting cannot fit', t => {
  const { byId, resize } = headerDocument(t);
  const summary = byId('masthead-data-summary');
  const context = {
    clientWidth: 40,
    get scrollWidth() {
      const omitted = summary.dataset.short?.split(' ') ?? [];
      return 220 - omitted.length * 60;
    },
  };
  summary.querySelector = selector => selector.includes('context') ? context : {};
  byId('masthead-data-wrap').clientWidth = 400;

  resize();

  assert.equal(summary.dataset.short, 'detail colour atlas');
  assert.equal(context.scrollWidth, 40);
});
