# Workspace scroll-into-view selectors

Chunk: H5
Status: approved by the user on #4 (2026-10-25)

## Legacy behaviour

viewer/ui/chrome/workspace.js:9-12 builds CURRENT_ITEM from `[aria-pressed="true"]` for `#function-list`, `#deficit-list` and `#circuit-list`, and from `#circuit-landmarks [aria-current="step"]`. Circuit rows do use `aria-pressed` (circuits.js:331-334), so that part works. But function rows and deficit rows mark the current item with `aria-current` (functions.js:459, clinical.js:517), so those selectors never match. The landmark selector was dead twice over: `#circuit-landmarks` is a class (`.circuit-landmarks`, circuits.js:199), not an id, and those steps are built into `#circuit-notes` inside the detail view (index.html:418), not into a list, so the search of `#navigator` could never reach them. A list coming back into view therefore did not show its current function or deficit, and no landmark was ever revealed. Back's focus fallback (workspace.js:197) knows only the tree's selected row.

## New behaviour

The workspace no longer names any list's markup. Each list registers a function returning its current element (`registerCurrentItem`, `src/lib/core/workspace.ts`), and the workspace asks `currentItem()` and `revealSelected()`. A list coming back into view reveals its current item (`block: 'nearest'`), and Back's focus fallback (the opener, else the current item, else the tab in front) works for every list, not only the tree. Landmarks are not registered (they live in the detail, which is never the list coming back into view); X3 registers only the open circuit row. Circuit rows are whatever the circuits list registers (#4 decision 40 changes them from `aria-pressed` to `aria-current`; that part is a decision, not a bug fix).

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order and 2.4.11 Focus Not Obscured (the restored position must be visible); correct use of `aria-current` (WAI-ARIA 1.2); platform practice of not coupling a container to a feature's markup.
