# The overlays' text measurements follow text size and spacing

Chunk: G1
Status: fix (standard cited)

## Legacy behaviour

The hints' widths, the scale bar's label width and the hover chip's size are each read once per wording and kept (viewport-chrome.js:455-460, 478-489, 857-859); only a webfont arrival clears the first two (551-558). Larger text, a zoomed page or the WCAG text-spacing override applied after load leave the old widths in force: at 200 % text on a 1280 px window the hint ends at 882 px over a top letter that begins at 812 px, with text spacing at 1100 px it ends at 730 over 725, and a chip placed with its old size can be clipped by the stage's edge.

## New behaviour

Each size comes from a `ResizeObserver` border box: the two hints, the chip and the stage in `HoverChip`, and the whole scale bar (rule, gap and label), so no width is remembered per wording. A hint that no longer fits one line clear of the top letter or a colour key is hidden, the chip is re-clamped inside the stage, and the dock and the bar are refitted. `document.fonts` `loadingdone` still reaches the store (`fontEpoch`) for measurements other chunks make.

## Standard cited

WCAG 2.2 SC 1.4.4 Resize Text and SC 1.4.12 Text Spacing (no loss of content or function), SC 1.4.10 Reflow.
