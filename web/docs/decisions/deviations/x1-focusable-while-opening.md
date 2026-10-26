# Area buttons stay focusable while a run is in flight

Chunk: X1
Status: fix (standard cited)

## Legacy behaviour

functions.js:321 sets `disabled` on every area button while a run is in flight. The area the reader just pressed has focus, and a disabled button loses it: focus falls to the page.

## New behaviour

The buttons get `aria-disabled="true"` and stay focusable; the action is already refused while a run is in flight (functions.js:386, kept). They are drawn in the tertiary ink. Focus stays where it was.

## Standard cited

WAI-ARIA APG "Focusability of disabled controls" (keep a control focusable when focus would otherwise be lost); WCAG 2.2 SC 2.4.3 Focus Order.
