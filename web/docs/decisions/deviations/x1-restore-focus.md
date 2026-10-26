# Restore is not hidden while it runs

Chunk: X1
Status: fix (standard cited)

## Legacy behaviour

functions.js:323 hides Restore while any run is in flight (`restore.hidden = ... || opening`), including the run Restore itself started. The control that was just pressed disappears with focus on it, and when the restore fails focus is not returned anywhere.

## New behaviour

Restore stays in the page while a run is in flight and says it is unavailable with `aria-disabled="true"`; it is removed only when there is nothing to restore (no function open, or the scene was put back). On success focus goes to the function's row, or the field when the row is gone, as in legacy; on failure it stays on Restore.

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order; SC 3.2.2 On Input; WAI-ARIA APG "Focusability of disabled controls".
