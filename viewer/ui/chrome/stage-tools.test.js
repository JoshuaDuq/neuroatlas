import assert from 'node:assert/strict';
import test from 'node:test';
import { compactSection, createStagePopovers, placePopover } from './stage-tools.js';
import { createViewportChrome } from './viewport-chrome.js';

const desktop = { x: 0, y: 0, width: 1120, height: 824 };

test('a popover opens above the dock on its start edge, whichever tool opened it', () => {
  const spot = placePopover({ toolbar: { left: 16, top: 770 }, visible: desktop, width: 288 });
  assert.deepEqual(spot, { left: 0, width: 288, maxHeight: 746 });
});

test('a popover wider than the room right of the dock slides left to stay inside the visible stage', () => {
  const visible = { x: 0, y: 0, width: 420, height: 824 };
  const spot = placePopover({ toolbar: { left: 200, top: 770 }, visible, width: 288 });
  assert.equal(spot.left + 200 + spot.width, 420 - 16);
});

test('on a phone a popover fills the stage between 16px gutters and leaves the top third of it in sight', () => {
  // The sheet covers the lower canvas, so the visible rectangle is short.
  const visible = { x: 0, y: 0, width: 390, height: 600 };
  const spot = placePopover({
    toolbar: { left: 16, top: 540 }, visible, width: 288, fill: true,
  });
  assert.deepEqual(spot, { left: 0, width: 358, maxHeight: 352 });
});

test('a side sheet moves the visible stage, and the popover with it', () => {
  // Landscape phone: the sheet sits at the left and the stage starts after it.
  const visible = { x: 220, y: 0, width: 624, height: 338 };
  const spot = placePopover({
    toolbar: { left: 236, top: 282 }, visible, width: 288,
  });
  assert.equal(spot.left + 236, visible.x + 16, 'never under the sheet');
  assert.equal(spot.maxHeight, 258);
});

test('a stage too narrow for the popover never yields a negative size', () => {
  const spot = placePopover({
    toolbar: { left: 0, top: 10 }, visible: { x: 0, y: 0, width: 20, height: 20 }, width: 288,
  });
  assert.equal(spot.width, 0);
  assert.equal(spot.maxHeight, 0);
});

test('the section row folds its details behind the disclosure only where its one line would wrap', () => {
  assert.equal(compactSection({ room: 748, need: 700 }), false);
  assert.equal(compactSection({ room: 700, need: 700 }), false);
  assert.equal(compactSection({ room: 488, need: 700 }), true);
});

test('a phone always takes the compact section row', () => {
  assert.equal(compactSection({ room: 358, need: null }), true);
});

function popoverFixture(t, controls) {
  const previous = globalThis.document;
  const doc = new EventTarget();
  doc.activeElement = null;
  const button = new EventTarget();
  button.getAttribute = () => 'display-popover';
  button.setAttribute = () => {};
  button.contains = target => target === button;
  const popover = new EventTarget();
  popover.id = 'display-popover';
  popover.toggleAttribute = () => {};
  popover.contains = target => controls.includes(target);
  popover.querySelector = () => controls.find(control => control.pressed);
  popover.querySelectorAll = selector => selector.startsWith('.segmented') ? [] : controls.filter(control => !control.disabled);
  for (const control of controls) {
    control.getAttribute = () => String(Boolean(control.pressed));
    control.checkVisibility = () => !control.hidden;
    control.focus = () => { if (!control.hidden && !control.disabled) doc.activeElement = control; };
  }
  doc.getElementById = () => popover;
  globalThis.document = doc;
  const controller = createStagePopovers({ querySelectorAll: () => [button] }, {
    visibleRect: () => null, fill: () => false,
  });
  t.after(() => {
    controller.dispose();
    globalThis.document = previous;
  });
  return { doc, open: () => button.dispatchEvent(new Event('click')) };
}

for (const unavailable of [{ hidden: true }, { disabled: true }]) {
  test(`opening a stage popover skips a ${Object.keys(unavailable)[0]} selected choice`, t => {
    const fallback = {};
    const { doc, open } = popoverFixture(t, [{ ...unavailable, pressed: true }, fallback]);
    open();
    assert.equal(doc.activeElement, fallback);
  });
}

test('a stage popover focuses a visible selected choice before other controls', t => {
  const selected = { pressed: true };
  const { doc, open } = popoverFixture(t, [{}, selected]);
  open();
  assert.equal(doc.activeElement, selected);
});

function hoverFixture(t, bounds, size) {
  const previous = globalThis.document;
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });
  const doc = new EventTarget();
  const nodes = new Map();
  function element(id) {
    const node = new EventTarget();
    Object.assign(node, {
      id, children: [], dataset: {}, style: {},
      querySelectorAll: () => [],
      querySelector: selector => byId(`${id} ${selector}`),
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
    });
    return node;
  }
  function byId(id) {
    if (!nodes.has(id)) nodes.set(id, element(id));
    return nodes.get(id);
  }
  doc.getElementById = byId;
  doc.createElement = element;
  globalThis.document = doc;
  const hover = byId('hover-label');
  hover.parentElement = byId('viewport');
  hover.parentElement.getBoundingClientRect = () => bounds;
  hover.offsetWidth = size.width;
  hover.offsetHeight = size.height;
  const chrome = createViewportChrome({ onRetry() {} });
  t.after(() => {
    chrome.dispose();
    globalThis.document = previous;
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  });
  return { chrome, hover };
}

for (const { name, bounds, size, pointer, expected } of [
  {
    name: 'follows the pointer when there is room',
    bounds: { width: 320, height: 240 }, size: { width: 80, height: 40 },
    pointer: { x: 12, y: 14 }, expected: { left: '26px', top: '28px' },
  },
  {
    name: 'stays inside the right and bottom edges',
    bounds: { width: 320, height: 240 }, size: { width: 80, height: 40 },
    pointer: { x: 310, y: 230 }, expected: { left: '232px', top: '192px' },
  },
  {
    name: 'keeps its top and left visible when larger than the stage',
    bounds: { width: 120, height: 36 }, size: { width: 280, height: 60 },
    pointer: { x: 110, y: 30 }, expected: { left: '8px', top: '8px' },
  },
]) {
  test(`the region hover label ${name}`, t => {
    const { chrome, hover } = hoverFixture(t, bounds, size);
    chrome.showHover('Superior temporal sulcus', pointer);
    assert.equal(hover.hidden, false);
    assert.equal(hover.style.left, expected.left);
    assert.equal(hover.style.top, expected.top);
  });
}
