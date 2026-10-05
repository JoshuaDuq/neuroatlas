import assert from 'node:assert/strict';
import test from 'node:test';
import { bindRoving, rovingStep, tabStop } from './roving.js';

function fakeGroup(specs) {
  const doc = { activeElement: null };
  const listeners = {};
  const items = specs.map(({ pressed = false, disabled = false, hidden = false } = {}, index) => ({
    index,
    disabled,
    hidden,
    tabIndex: 0,
    pressed,
    getAttribute(name) { return name === 'aria-pressed' ? String(this.pressed) : null; },
    focus() {
      const previous = doc.activeElement;
      doc.activeElement = this;
      if (previous) listeners.focusout?.({ target: previous, relatedTarget: this });
      listeners.focusin?.({ target: this });
    },
  }));
  const group = {
    ownerDocument: doc,
    querySelectorAll: () => items,
    contains: node => items.includes(node),
    addEventListener(type, fn) { listeners[type] = fn; },
    removeEventListener(type) { delete listeners[type]; },
  };
  const press = (key, target = doc.activeElement) => {
    let prevented = false;
    listeners.keydown({ key, target, preventDefault() { prevented = true; } });
    return prevented;
  };
  const leave = () => {
    const previous = doc.activeElement;
    doc.activeElement = null;
    listeners.focusout({ target: previous, relatedTarget: null });
  };
  return { doc, items, group, listeners, press, leave, stops: () => items.map(item => item.tabIndex) };
}

test('arrows, Home and End move through the group and wrap', () => {
  assert.equal(rovingStep('ArrowRight', 0, 4), 1);
  assert.equal(rovingStep('ArrowDown', 3, 4), 0);
  assert.equal(rovingStep('ArrowLeft', 0, 4), 3);
  assert.equal(rovingStep('ArrowUp', 2, 4), 1);
  assert.equal(rovingStep('Home', 2, 4), 0);
  assert.equal(rovingStep('End', 0, 4), 3);
  assert.equal(rovingStep('Enter', 1, 4), null);
  assert.equal(rovingStep(' ', 1, 4), null);
  assert.equal(rovingStep('ArrowRight', 0, 0), null);
});

test('the Tab stop is the focused member, else the chosen one, else the first usable', () => {
  const { items } = fakeGroup([{}, { pressed: true }, {}]);
  assert.equal(tabStop(items), items[1]);
  assert.equal(tabStop(items, items[2]), items[2]);
  const { items: none } = fakeGroup([{ disabled: true }, {}, {}]);
  assert.equal(tabStop(none), none[1]);
  const { items: off } = fakeGroup([{ disabled: true }, { disabled: true }]);
  assert.equal(tabStop(off), null);
});

test('a bound group is one Tab stop on its chosen button', () => {
  const { group, stops } = fakeGroup([{}, {}, { pressed: true }, {}]);
  bindRoving(group);
  assert.deepEqual(stops(), [-1, -1, 0, -1]);
});

test('arrow keys move focus without choosing, skipping disabled buttons', () => {
  const { group, items, doc, press, stops } = fakeGroup([{ pressed: true }, { disabled: true }, {}, {}]);
  bindRoving(group);
  items[0].focus();
  assert.equal(press('ArrowRight'), true);
  assert.equal(doc.activeElement, items[2]);
  assert.deepEqual(stops(), [-1, -1, 0, -1]);
  assert.equal(items[0].pressed, true, 'moving focus does not change the choice');
  press('End');
  assert.equal(doc.activeElement, items[3]);
  press('ArrowRight');
  assert.equal(doc.activeElement, items[0]);
  assert.equal(press('Enter'), false, 'Enter and Space stay with the button itself');
});

test('leaving the group hands the Tab stop back to the chosen button', () => {
  const { group, items, press, leave, stops } = fakeGroup([{}, { pressed: true }, {}]);
  bindRoving(group);
  items[1].focus();
  press('ArrowRight');
  assert.deepEqual(stops(), [-1, -1, 0]);
  leave();
  assert.deepEqual(stops(), [-1, 0, -1]);
});

test('sync follows a new choice and a disabled group', () => {
  const { group, items, stops } = fakeGroup([{ pressed: true }, {}]);
  const roving = bindRoving(group);
  items[0].pressed = false;
  items[1].pressed = true;
  roving.sync();
  assert.deepEqual(stops(), [-1, 0]);
  for (const item of items) item.disabled = true;
  roving.sync();
  assert.deepEqual(stops(), [-1, -1]);
});

test('dispose stops handling keys', () => {
  const { group, listeners } = fakeGroup([{}, {}]);
  bindRoving(group).dispose();
  assert.equal(listeners.keydown, undefined);
});
