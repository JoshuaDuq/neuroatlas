import assert from 'node:assert/strict';
import test from 'node:test';
import { compactSection, createStagePopovers, placePopover } from './stage-tools.js';

const desktop = { x: 0, y: 0, width: 1120, height: 824 };

test('a popover opens above its button with its left edge on the button', () => {
  const spot = placePopover({
    anchor: { left: 360 }, toolbar: { left: 16, top: 770 }, visible: desktop, width: 288,
  });
  assert.deepEqual(spot, { left: 344, width: 288, maxHeight: 746 });
});

test('a popover near the right edge slides left to stay inside the visible stage', () => {
  const spot = placePopover({
    anchor: { left: 1000 }, toolbar: { left: 16, top: 770 }, visible: desktop, width: 288,
  });
  assert.equal(spot.left + 16 + spot.width, 1120 - 16);
});

test('on a phone a popover fills the stage between 16px gutters and leaves the top third of it in sight', () => {
  // The sheet covers the lower canvas, so the visible rectangle is short.
  const visible = { x: 0, y: 0, width: 390, height: 600 };
  const spot = placePopover({
    anchor: { left: 300 }, toolbar: { left: 16, top: 540 }, visible, width: 288, fill: true,
  });
  assert.deepEqual(spot, { left: 0, width: 358, maxHeight: 352 });
});

test('a side sheet moves the visible stage, and the popover with it', () => {
  // Landscape phone: the sheet sits at the left and the stage starts after it.
  const visible = { x: 220, y: 0, width: 624, height: 338 };
  const spot = placePopover({
    anchor: { left: 120 }, toolbar: { left: 236, top: 282 }, visible, width: 288,
  });
  assert.equal(spot.left + 236, visible.x + 16, 'never under the sheet');
  assert.equal(spot.maxHeight, 258);
});

test('a stage too narrow for the popover never yields a negative size', () => {
  const spot = placePopover({
    anchor: { left: 0 }, toolbar: { left: 0, top: 10 }, visible: { x: 0, y: 0, width: 20, height: 20 }, width: 288,
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
