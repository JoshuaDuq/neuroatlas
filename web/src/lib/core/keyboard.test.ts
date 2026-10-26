import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { characterShortcutAllowed, isCharacterKey } from './keyboard.ts';

/** Just enough of an element for `matches` and `closest` against fixed answers. */
const element = ({ matches = false, inside = false, kind = 'button' } = {}) => ({
  matches: (selector: string) => matches && selector.split(', ').includes(kind),
  closest: () => (inside ? {} : null),
});

describe('keyboard', () => {
  it('STATE-34 character keys are one character long, counting an emoji as one', () => {
    for (const key of ['é', '😀']) assert.equal(isCharacterKey(key), true, key);
    for (const key of ['Dead', 5, null]) assert.equal(isCharacterKey(key), false, String(key));
  });

  it('character keys are the one-character ones', () => {
    for (const key of ['h', 'H', '0', '6', '?', '/', '+']) {
      assert.equal(isCharacterKey(key), true, key);
    }
    for (const key of ['Escape', 'ArrowUp', 'Tab', 'Enter', '', undefined]) {
      assert.equal(isCharacterKey(key), false, String(key));
    }
  });

  it('character shortcuts stop when the reader turns them off', () => {
    assert.equal(characterShortcutAllowed(element(), true), true);
    assert.equal(characterShortcutAllowed(element(), false), false);
    assert.equal(characterShortcutAllowed(null, false), false);
  });

  it('a control in a marked region keeps its keys; the tree and the canvas do not', () => {
    // A hemisphere button in the View panel.
    assert.equal(characterShortcutAllowed(element({ matches: true, inside: true }), true), false);
    // A tree row is not a control with keys of its own.
    assert.equal(characterShortcutAllowed(element({ matches: false, inside: true }), true), true);
    // A view preset over the canvas is outside the marked regions.
    assert.equal(characterShortcutAllowed(element({ matches: true, inside: false }), true), true);
    assert.equal(characterShortcutAllowed(null, true), true);
  });

  it('a summary and a tab in a marked region keep their keys, as a button does', () => {
    for (const kind of ['button', 'summary', '[role="tab"]']) {
      assert.equal(
        characterShortcutAllowed(element({ matches: true, inside: true, kind }), true),
        false,
        kind,
      );
    }
  });
});
