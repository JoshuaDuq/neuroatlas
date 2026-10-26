# The visible rectangle follows a host that changes size alone

Chunk: G1
Status: fix (standard cited)

## Legacy behaviour

`setViewport` returns early when the visible rectangle equals the last one (viewport-chrome.js:710-713), without looking at the host's size. With the phone sheet at its full detent the rectangle is `H - 128` tall, so a resize that changes only the host's height leaves the rectangle as it was; `--vis-bottom`, which is `host height - rectangle bottom`, is never rewritten. Measured at 390 x 844: `--vis-bottom` is 664 px on a 792 px host, and after a resize to 700 px (host 648 px) it stays 664 px. The visible rectangle then has negative height and the canvas focus ring, drawn from it, collapses.

## New behaviour

`setViewport` returns early only when both the rectangle and the host size are unchanged, so `--vis-*` is rewritten (here to 520 px) and the ring keeps its place round the visible stage.

## Standard cited

WCAG 2.2 SC 2.4.7 Focus Visible and SC 2.4.11 Focus Not Obscured (Minimum): the focus indicator must stay visible and unobscured.
