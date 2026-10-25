# Network swatches keep their colours in forced colours

Chunk: U4
Status: fix under the parity policy (no prior approval needed); listed in the U4 PR

## Legacy behaviour

`.network-swatch` and `.network-bar` (detail.css:235-265) had no forced-colours rule. In forced colours the browser replaced their backgrounds with one system colour, so every network swatch looked the same and the share bar's fill vanished into its track.

## New behaviour

Under `forced-colors: active` the swatch keeps its network colour (`forced-color-adjust: none`). The share bar is drawn as a `CanvasText` fill on a `Canvas` track with a `CanvasText` outline. Both are decorative (`aria-hidden`); the row's text names the network.

## Standard cited

WCAG 2.2 SC 1.4.1 Use of Color (colour is not the only cue: the name is in the row text); SC 1.4.11 Non-text Contrast (the bar's fill and track stay distinguishable); CSS Color Adjust `forced-color-adjust`.
