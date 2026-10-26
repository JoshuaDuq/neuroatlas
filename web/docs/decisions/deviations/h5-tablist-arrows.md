# The tablist no longer swallows vertical arrows, and ignores modified arrows

Chunk: H5, S5a
Status: decided on #4 (decision 19)

## Legacy behaviour

workspace.js:83-87 calls `preventDefault` on ArrowUp and ArrowDown inside the tablist, so the page's global arrow handler does not walk the anatomy tree. It also blocks page scroll. ArrowLeft and ArrowRight with Alt, Ctrl, Meta or Shift are taken as tab navigation.

## New behaviour

The tablist handles only unmodified ArrowLeft, ArrowRight, Home and End. Vertical arrows are left alone: the global keymap (S5a) ignores them when focus is in a tab. Alt+Arrow (browser history) and Ctrl/Cmd+Arrow (platform) are not taken.

## Standard cited

WAI-ARIA APG Tabs keyboard table (a horizontal tablist uses Left/Right and Home/End only); platform practice for modified arrows, as `u2-roving-modifier-keys.md`.
