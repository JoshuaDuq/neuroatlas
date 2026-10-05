import assert from 'node:assert/strict';
import test from 'node:test';
import { characterShortcutAllowed, createKeyPreference, isCharacterKey } from './shortcuts.js';

/** Just enough of an element for `matches` and `closest` against fixed answers. */
const element = ({ matches = false, inside = false } = {}) => ({
  matches: () => matches,
  closest: () => (inside ? {} : null),
});

test('character keys are the one-character ones', () => {
  for (const key of ['h', 'H', '0', '6', '?', '/', '+']) assert.equal(isCharacterKey(key), true, key);
  for (const key of ['Escape', 'ArrowUp', 'Tab', 'Enter', '', undefined]) {
    assert.equal(isCharacterKey(key), false, String(key));
  }
});

test('character shortcuts stop when the reader turns them off', () => {
  assert.equal(characterShortcutAllowed(element(), true), true);
  assert.equal(characterShortcutAllowed(element(), false), false);
  assert.equal(characterShortcutAllowed(null, false), false);
});

test('a panel control keeps its keys; the tree and the canvas do not', () => {
  // A hemisphere button in the View panel.
  assert.equal(characterShortcutAllowed(element({ matches: true, inside: true }), true), false);
  // A tree row is not a control with keys of its own.
  assert.equal(characterShortcutAllowed(element({ matches: false, inside: true }), true), true);
  // A view preset over the canvas is outside the panels.
  assert.equal(characterShortcutAllowed(element({ matches: true, inside: false }), true), true);
  assert.equal(characterShortcutAllowed(null, true), true);
});

test('the preference defaults on and survives a reload', () => {
  const store = {};
  const storage = { getItem: key => store[key] ?? null, setItem: (key, value) => { store[key] = value; } };
  const first = createKeyPreference(storage);
  assert.equal(first.enabled, true);
  first.set(false);
  assert.equal(first.enabled, false);
  assert.equal(createKeyPreference(storage).enabled, false);
  createKeyPreference(storage).set(true);
  assert.equal(createKeyPreference(storage).enabled, true);
});

test('blocked storage still gives a working preference', () => {
  const storage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const preference = createKeyPreference(storage);
  assert.equal(preference.enabled, true);
  preference.set(false);
  assert.equal(preference.enabled, false);
});
