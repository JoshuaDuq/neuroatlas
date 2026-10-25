# Range focus outline in forced colours

Chunk: U4
Status: fix under the parity policy (no prior approval needed); listed in the U4 PR

## Legacy behaviour

`input[type="range"]` had `forced-color-adjust: none` in forced colours (a11y.css:67-76) and no focus rule, so the page's focus ring was dropped with the other adjusted colours and a focused slider showed no system-coloured focus indicator.

## New behaviour

`RangeField` draws `outline: 2px solid Highlight` on `input[type="range"]:focus-visible` in forced colours.

## Standard cited

WCAG 2.2 SC 2.4.7 Focus Visible and SC 2.4.11 Focus Not Obscured; CSS system colour `Highlight`.
