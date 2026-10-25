# Progress bar in forced colours

Chunk: U4
Status: fix under the parity policy (no prior approval needed); listed in the U4 PR

## Legacy behaviour

The stage's loading bar (`.progress`, stage.css:313-314, index.html:584) had no forced-colours rule: its translucent track and fill were replaced by system colours that could not be told apart.

## New behaviour

Under `forced-colors: active` the native `<progress>` has a `Canvas` track with a `CanvasText` outline and a `Highlight` fill, one rule per engine pseudo-element (`::-webkit-progress-value`, `::-moz-progress-bar`). A browser test checks the kept rules.

## Standard cited

WCAG 2.2 SC 1.4.11 Non-text Contrast (the progress indicator against its track); CSS Color Adjust `forced-color-adjust`, CSS system colours.
