# Workspace scroll-into-view selectors

Chunk: H5
Status: approved by the user on #4 (2026-10-25)

## Legacy behaviour

viewer/ui/chrome/workspace.js:9-12 builds CURRENT_ITEM from `[aria-pressed="true"]` for `#function-list`, `#deficit-list` and `#circuit-list`, and from `#circuit-landmarks [aria-current="step"]`. Circuit rows do use `aria-pressed` (circuits.js:331-334), so that part works. But function rows and deficit rows mark the current item with `aria-current` (functions.js:459, clinical.js:517), so those selectors never match; and `#circuit-landmarks` is a class (`.circuit-landmarks`, circuits.js:199), not an id. A list coming back into view therefore does not show its current function, deficit or landmark.

## New behaviour

The selector targets the attribute and element each list really uses: `aria-current` on function and deficit rows and on `.circuit-landmarks` steps. Circuit rows are matched by `aria-current="true"` because #4 decision 40 changes them from `aria-pressed` (they open a lesson rather than toggle); that part is a decision, not a bug fix. The current item scrolls into view.

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order and 2.4.11 Focus Not Obscured (the restored position must be visible); correct use of `aria-current` (WAI-ARIA 1.2).
