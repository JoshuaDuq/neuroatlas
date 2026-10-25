# The settings trigger is a disclosure, not a dialog popup

Chunk: H2
Status: fix (standard cited)

## Legacy behaviour

No `aria-haspopup`: the trigger announces only its expanded state.

## New behaviour

Bits Popover adds `aria-haspopup="dialog"` to its trigger; H2 removes it, because the panel is a region of ordinary controls (not a dialog) and would be announced as one.

## Standard cited

APG Disclosure pattern (button with `aria-expanded` and `aria-controls`); ARIA 1.2 `aria-haspopup`.
