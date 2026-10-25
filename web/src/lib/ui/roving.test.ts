// Ported from viewer/ui/roving.test.js (same cases, same assertions), plus modifier keys.
import { describe, expect, test } from 'vitest';
import { bindRoving, rovingStep, tabStop } from './roving.ts';
import { fakeGroup } from './test-support.ts';

const members = (items: unknown) => items as Parameters<typeof tabStop>[0];

describe('roving', () => {
  test('arrows, Home and End move through the group and wrap', () => {
    expect(rovingStep('ArrowRight', 0, 4)).toBe(1);
    expect(rovingStep('ArrowDown', 3, 4)).toBe(0);
    expect(rovingStep('ArrowLeft', 0, 4)).toBe(3);
    expect(rovingStep('ArrowUp', 2, 4)).toBe(1);
    expect(rovingStep('Home', 2, 4)).toBe(0);
    expect(rovingStep('End', 0, 4)).toBe(3);
    expect(rovingStep('Enter', 1, 4)).toBeNull();
    expect(rovingStep(' ', 1, 4)).toBeNull();
    expect(rovingStep('ArrowRight', 0, 0)).toBeNull();
  });

  test('the Tab stop is the focused member, else the chosen one, else the first usable', () => {
    const { items } = fakeGroup([{}, { pressed: true }, {}]);
    expect(tabStop(members(items))).toBe(items[1]);
    expect(tabStop(members(items), items[2] as never)).toBe(items[2]);
    const { items: none } = fakeGroup([{ disabled: true }, {}, {}]);
    expect(tabStop(members(none))).toBe(none[1]);
    const { items: off } = fakeGroup([{ disabled: true }, { disabled: true }]);
    expect(tabStop(members(off))).toBeNull();
    const { items: hidden } = fakeGroup([{ hidden: true, pressed: true }, {}]);
    expect(tabStop(members(hidden))).toBe(hidden[1]);
  });

  test('a bound group is one Tab stop on its chosen button', () => {
    const { group, stops } = fakeGroup([{}, {}, { pressed: true }, {}]);
    bindRoving(group);
    expect(stops()).toEqual([-1, -1, 0, -1]);
  });

  test('arrow keys move focus without choosing, skipping disabled buttons', () => {
    const { group, items, doc, press, stops } = fakeGroup([
      { pressed: true },
      { disabled: true },
      {},
      {},
    ]);
    bindRoving(group);
    items[0].focus();
    expect(press('ArrowRight')).toBe(true);
    expect(doc.activeElement).toBe(items[2]);
    expect(stops()).toEqual([-1, -1, 0, -1]);
    expect(items[0].pressed, 'moving focus does not change the choice').toBe(true);
    press('End');
    expect(doc.activeElement).toBe(items[3]);
    press('ArrowRight');
    expect(doc.activeElement).toBe(items[0]);
    expect(press('Enter'), 'Enter and Space stay with the button itself').toBe(false);
  });

  test('a key from outside the group’s usable buttons is left alone', () => {
    const { group, items, press } = fakeGroup([{}, { disabled: true }]);
    bindRoving(group);
    items[0].focus();
    expect(press('ArrowRight', items[1])).toBe(false);
  });

  test('leaving the group hands the Tab stop back to the chosen button', () => {
    const { group, items, press, leave, stops } = fakeGroup([{}, { pressed: true }, {}]);
    bindRoving(group);
    items[1].focus();
    press('ArrowRight');
    expect(stops()).toEqual([-1, -1, 0]);
    leave();
    expect(stops()).toEqual([-1, 0, -1]);
  });

  test('sync follows a new choice and a disabled group', () => {
    const { group, items, stops } = fakeGroup([{ pressed: true }, {}]);
    const roving = bindRoving(group);
    items[0].pressed = false;
    items[1].pressed = true;
    roving.sync();
    expect(stops()).toEqual([-1, 0]);
    for (const item of items) item.disabled = true;
    roving.sync();
    expect(stops()).toEqual([-1, -1]);
  });

  test('dispose stops handling keys', () => {
    const { group, listeners } = fakeGroup([{}, {}]);
    bindRoving(group).dispose();
    expect(listeners.keydown).toBeUndefined();
  });

  test('a modified arrow is the browser’s or the platform’s, not the group’s', () => {
    const { group, items, doc, press } = fakeGroup([{}, {}]);
    bindRoving(group);
    items[0].focus();
    for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
      expect(press('ArrowRight', items[0], { [modifier]: true }), modifier).toBe(false);
      expect(doc.activeElement).toBe(items[0]);
    }
  });
});
