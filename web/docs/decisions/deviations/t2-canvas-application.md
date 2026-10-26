# The canvas is an application widget

Chunk: T2
Status: fix (D1 (decision 41)); listed in the T2 PR

## Legacy behaviour

`navigation-ui.js:65-66` and `index.html:633-668` made the canvas a focusable generic element with only an `aria-label`; its key handling (six keys on three axes) and its hint were not exposed.

## New behaviour

The canvas is `role="application"` with a localized `aria-roledescription` ("MRI viewer" / "Visionneuse IRM"), the catalog's `aria-label`, and `aria-describedby` pointing at the hint, which now lists Page Up and Page Down. It is focusable only with a loaded engine, and Tab leaves it. Every key it owns has an equivalent in the voxel form. The focus ring is drawn inside the canvas (`outline-offset: -2px`): the canvas fills a box with `overflow: hidden`, which clipped the global 2 px outside ring, so the legacy canvas showed no focus at all.

## Standard cited

WAI-ARIA 1.2 `application` (a widget that handles its own keys); WCAG 2.2 SC 4.1.2 Name, Role, Value, SC 1.3.1, SC 2.1.2 No Keyboard Trap and SC 2.4.7 Focus Visible. Same pattern as the stage canvas (decision 28).
