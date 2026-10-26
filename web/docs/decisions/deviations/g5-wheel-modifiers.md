# The wheel leaves Ctrl and Meta to the browser, and the page when it cannot move

Chunk: G5
Status: fix (standard cited)

## Legacy behaviour

The wheel handler always calls `preventDefault`, whatever the modifiers, and even when the crosshair is at the end of its range (sections.js:294-300). Ctrl+wheel and trackpad pinch (browser zoom) do nothing over a picture, and a short phone dialog cannot be scrolled with the wheel over one.

## New behaviour

Ctrl or Meta with the wheel is ignored. A wheel notch that cannot move the crosshair (the end of the range, or a horizontal wheel) is left to the page. Otherwise one millimetre a notch, as before.

## Standard cited

WCAG 2.2 SC 1.4.4 Resize Text (zoom must not be blocked); platform practice that Ctrl+wheel is zoom in Chromium and Firefox.
