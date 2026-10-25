import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { characterShortcutAllowed, isCharacterKey } from './keyboard.ts';

describe('keyboard', () => {
  it('counts one code point as a character key, and names and modifiers as not', () => {
    for (const key of ['a', '?', '3', '+', 'é', '😀']) assert.equal(isCharacterKey(key), true, key);
    for (const key of ['Escape', 'ArrowUp', 'Shift', '', 'Dead']) {
      assert.equal(isCharacterKey(key), false, key);
    }
    assert.equal(isCharacterKey(undefined), false);
  });

  it('refuses a one-character shortcut when turned off or from a control with own keys', () => {
    const plain = { closest: () => null };
    const owned = { closest: (selector: string) => (selector === '[data-own-keys]' ? {} : null) };
    assert.equal(characterShortcutAllowed(plain, true), true);
    assert.equal(characterShortcutAllowed(null, true), true);
    assert.equal(characterShortcutAllowed(plain, false), false);
    assert.equal(characterShortcutAllowed(owned, true), false);
  });
});
