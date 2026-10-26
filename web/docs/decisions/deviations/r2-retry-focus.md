# Retry hands focus to the panel's summary

Chunk: R2
Status: fix (decision 39, B4); listed in the R2 PR

## Legacy behaviour

Activating Retry hides the button (`atlas-comparison.js:125`), and keyboard focus falls to the page.

## New behaviour

Retry moves focus to the panel's `<summary>` before the button goes, and the status line says the load has started. Focus does not move again when loading finishes.

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order and 3.2.2 On Input; APG guidance that focus is never left on a removed element.
