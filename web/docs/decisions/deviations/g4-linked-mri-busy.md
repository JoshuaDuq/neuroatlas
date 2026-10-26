# The Linked MRI opener ignores a second press while it loads

Chunk: G4
Status: fix (decision 31 on #4)

## Legacy behaviour

`#mpr-open` awaits `sections.load()` before showing the dialog (ui/chrome/sections.js:219-236). A second press, or `M`, while the scan downloads starts a second load and a second `showModal()`; nothing says the first is still in progress.

## New behaviour

While an opening is in progress the opener is `aria-disabled="true"`, and further presses, and `M` when I2 routes the keymap's `openMpr` port to the same command, do nothing. It stays focusable, so focus is never lost, and becomes active again however the opening ends; a failure is said in the section's status line.

## Standard cited

Conductor decision 31 on #4 (a busy-state guard against double-activating an opener belongs to the opener's owner); WAI-ARIA 1.2 `aria-disabled` for a control that stays in the focus order while unavailable.
