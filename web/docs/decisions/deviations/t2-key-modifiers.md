# Modified arrow keys are left alone

Chunk: T2
Status: fix (D7 (decision 41)); listed in the T2 PR

## Legacy behaviour

`navigation-ui.js:167-173` moved the crosshair and cancelled the event for the arrow and Page keys whatever modifier was held, so Alt+Left (browser Back) and screen-reader and OS key combinations were swallowed on the canvas.

## New behaviour

The six canvas keys act only without Alt, Ctrl, Meta or Shift, and the event is cancelled only when they act.

## Standard cited

WCAG 2.2 SC 2.1.1 Keyboard and SC 2.1.4; platform key reservation (browser history and assistive-technology keys).
