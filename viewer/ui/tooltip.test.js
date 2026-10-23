import assert from 'node:assert/strict';
import test from 'node:test';
import { SHOW_DELAY, SKIP_WINDOW, createTooltipTiming, placeTooltip, startTooltips } from './tooltip.js';

// A clock and timers the test advances by hand.
function harness() {
  let time = 0;
  let timers = [];
  const shown = [];
  const hidden = [];
  const timing = createTooltipTiming({
    now: () => time,
    schedule: (callback, delay) => { const timer = { at: time + delay, callback }; timers.push(timer); return timer; },
    cancel: timer => { timers = timers.filter(other => other !== timer); },
    show: (trigger, instant) => shown.push([trigger, instant]),
    hide: trigger => hidden.push(trigger),
  });
  const advance = ms => {
    time += ms;
    const due = timers.filter(timer => timer.at <= time);
    timers = timers.filter(timer => timer.at > time);
    due.forEach(timer => timer.callback());
  };
  return { timing, shown, hidden, advance };
}

test('a first hover waits the delay, then shows with its entry', () => {
  const { timing, shown, advance } = harness();
  timing.enter('save');
  advance(SHOW_DELAY - 1);
  assert.deepEqual(shown, []);
  advance(1);
  assert.deepEqual(shown, [['save', false]]);
  assert.equal(timing.open, 'save');
});

test('leaving before the delay shows nothing', () => {
  const { timing, shown, advance } = harness();
  timing.enter('save');
  advance(200);
  timing.leave('save');
  advance(SHOW_DELAY);
  assert.deepEqual(shown, []);
});

test('moving within one trigger does not restart its delay', () => {
  const { timing, shown, advance } = harness();
  timing.enter('save');
  advance(300);
  timing.enter('save');
  advance(SHOW_DELAY - 300);
  assert.deepEqual(shown, [['save', false]]);
});

test('the next tooltip within the window after one closes appears at once, without its entry', () => {
  const { timing, shown, hidden, advance } = harness();
  timing.enter('save');
  advance(SHOW_DELAY);
  timing.leave('save');
  assert.deepEqual(hidden, ['save']);
  advance(SKIP_WINDOW - 1);
  timing.enter('fullscreen');
  assert.deepEqual(shown.at(-1), ['fullscreen', true]);
});

test('after the window the delay applies again', () => {
  const { timing, shown, advance } = harness();
  timing.enter('save');
  advance(SHOW_DELAY);
  timing.leave('save');
  advance(SKIP_WINDOW);
  timing.enter('fullscreen');
  assert.equal(shown.length, 1);
  advance(SHOW_DELAY);
  assert.deepEqual(shown.at(-1), ['fullscreen', false]);
});

test('keyboard focus shows at once, and moving focus hands over without a gap', () => {
  const { timing, shown, hidden } = harness();
  timing.enter('save', { immediate: true });
  assert.deepEqual(shown, [['save', true]]);
  timing.enter('fullscreen', { immediate: true });
  assert.deepEqual(hidden, ['save']);
  assert.deepEqual(shown.at(-1), ['fullscreen', true]);
  assert.equal(timing.open, 'fullscreen');
});

test('a dismissal hides the open tooltip and cancels a waiting one', () => {
  const { timing, shown, hidden, advance } = harness();
  timing.enter('save', { immediate: true });
  timing.dismiss();
  assert.deepEqual(hidden, ['save']);
  assert.equal(timing.open, null);
  advance(SKIP_WINDOW);
  timing.enter('fullscreen');
  timing.dismiss();
  advance(SHOW_DELAY);
  assert.equal(shown.length, 1);
});

test('the pointer can cross the gap and stay over the tooltip until it leaves', () => {
  const { timing, hidden, advance } = harness();
  timing.enter('save');
  advance(SHOW_DELAY);
  timing.leave('save', { delayed: true });
  advance(100);
  assert.equal(timing.open, 'save', 'crossing the gap keeps the tooltip open');
  timing.enter('save');
  advance(1000);
  assert.deepEqual(hidden, [], 'entering the tooltip cancels its pending close');
  timing.leave('save', { delayed: true });
  advance(1000);
  assert.deepEqual(hidden, ['save'], 'leaving the tooltip closes it');
});

test('returning to the trigger cancels its pending close without repeating its entry', () => {
  const { timing, shown, hidden, advance } = harness();
  timing.enter('save', { immediate: true });
  timing.leave('save', { delayed: true });
  advance(100);
  timing.enter('save');
  advance(1000);
  assert.deepEqual(shown, [['save', true]]);
  assert.deepEqual(hidden, []);
});

test('dismissal cancels a delayed close before another tooltip opens', () => {
  const { timing, hidden, advance } = harness();
  timing.enter('save', { immediate: true });
  timing.leave('save', { delayed: true });
  timing.dismiss();
  timing.enter('fullscreen', { immediate: true });
  advance(1000);
  assert.equal(timing.open, 'fullscreen');
  assert.deepEqual(hidden, ['save']);
});

test('tooltip disposal cancels a pending hover and removes its listeners and element', context => {
  const previous = globalThis.document;
  const previousElement = globalThis.Element;
  const listeners = new Map();
  let removed = false;
  const tip = { setAttribute() {}, contains: () => false, remove() { removed = true; } };
  class Trigger {
    dataset = { tooltip: 'Explain this control' };
    closest() { return this; }
    getAttribute() { return null; }
  }
  globalThis.Element = Trigger;
  globalThis.document = {
    createElement: () => tip,
    body: { append() {} },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) {
      assert.equal(listeners.get(type), listener);
      listeners.delete(type);
    },
  };
  context.after(() => { globalThis.document = previous; globalThis.Element = previousElement; });
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const tooltips = startTooltips();
  assert.equal(listeners.size, 7);
  listeners.get('pointerover')({ target: new Trigger(), pointerType: 'mouse' });
  tooltips.dispose();
  context.mock.timers.tick(SHOW_DELAY);
  assert.equal(listeners.size, 0);
  assert.equal(removed, true);
});

const viewport = { width: 1440, height: 900 };
const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

test('a tooltip sits centred under its trigger and grows from that edge', () => {
  const placed = placeTooltip(rect(1300, 8, 32, 32), { width: 100, height: 24 }, viewport);
  assert.deepEqual(placed, { side: 'bottom', left: 1266, top: 48, origin: '50px 0' });
});

test('with no room below it goes above, growing from the trigger’s top edge', () => {
  const placed = placeTooltip(rect(400, 850, 32, 32), { width: 60, height: 24 }, viewport);
  assert.deepEqual(placed, { side: 'top', left: 386, top: 818, origin: '30px 100%' });
});

test('it stays inside the viewport, its origin still at the trigger’s centre', () => {
  const placed = placeTooltip(rect(1420, 8, 16, 16), { width: 120, height: 24 }, viewport);
  assert.equal(placed.left, viewport.width - 8 - 120);
  assert.equal(placed.origin, `${1428 - placed.left}px 0`);
  assert.equal(placeTooltip(rect(0, 8, 16, 16), { width: 120, height: 24 }, viewport).left, 8);
});
