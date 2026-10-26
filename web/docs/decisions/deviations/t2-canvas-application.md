# The canvas is an application widget

Chunk: T2
Status: fix (D1 (decision 41)); listed in the T2 PR

## Legacy behaviour

`navigation-ui.js:65-66` and `index.html:633-668` made the canvas a focusable generic element with only an `aria-label`; its key handling (six keys on three axes) and its hint were not exposed.

## New behaviour

The canvas is `role="application"` with a localized `aria-roledescription` ("MRI viewer" / "Visionneuse IRM"), the catalog's `aria-label`, and `aria-describedby` pointing at the hint, which now lists Page Up and Page Down. It is focusable only with a loaded engine, and Tab leaves it. Every key it owns has an equivalent in the voxel form.

## Standard cited

WAI-ARIA 1.2 `application` (a widget that handles its own keys); WCAG 2.2 SC 4.1.2 Name, Role, Value, SC 1.3.1 and SC 2.1.2 No Keyboard Trap. Same pattern as the stage canvas (decision 28).
