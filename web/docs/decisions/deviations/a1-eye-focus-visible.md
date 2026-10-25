# Eyes stay visible on focus, in forced colours and with increased contrast

Chunk: A1
Status: fix, standard cited.

## Legacy behaviour

On a fine pointer the group eyes are `opacity: 0` and a region's eye icon too, until the row is hovered, holds `:focus-visible` or `:has(:focus-visible)`, or is selected or hidden (`viewer/styles/navigator.css:195-208`). `:focus-visible` does not match an eye focused by a mouse press, so the eye can vanish under the pointer that just pressed it. Forced colours and `prefers-contrast: more` do not override `opacity`, so a control can stay invisible there.

## New behaviour

The reveal uses `:focus-within` (the row or any control in it holds focus, however it got there). Under `forced-colors: active` and `prefers-contrast: more` every eye is drawn and the count stays beside it; in forced colours the hidden and partial states also take a system-colour border, so state is never colour alone, and the chosen row keeps its `Highlight` edge (legacy `a11y.css:80`).

## Standard cited

WCAG 2.2 SC 2.4.7 Focus Visible, SC 1.4.11 Non-text Contrast and SC 1.4.1 Use of Color.
