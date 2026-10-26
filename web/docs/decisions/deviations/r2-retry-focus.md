# Retry hands focus to the panel's summary

Chunk: R2
Status: fix (decision 39, B4); listed in the R2 PR

## Legacy behaviour

Activating Retry hides the button (`atlas-comparison.js:125`), and keyboard focus falls to the page.

## New behaviour

Retry moves focus to the panel's `<summary>` before the button goes, and the status line says the load has started. Focus does not move again when loading finishes.

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order: focus moves to a control that is still there, in a meaningful order, instead of falling to the page when the focused button goes.
