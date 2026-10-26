# Focus never falls to the page when the dissection bar empties

Chunk: A3
Status: fix, standard cited (approved in decision 36 on #4).

## Legacy behaviour

When the bar leaves (nothing hidden any more), focus moves to `document.querySelector('#tree [tabindex="0"]')` with optional chaining (`viewer/ui/panels/dissection.js:34`). While a search is open the tree is hidden (`viewer/ui/panels/navigator.js:756`), so its `[tabindex="0"]` row exists but cannot take focus, and focus drops to `body`.

## New behaviour

`DissectionBar.svelte` asks the focus registry for `tree-stop` and, if that has no element, for `active-tab` (the tab in front, always on screen). It does this before the update that removes the bar, and only when focus was inside the bar. When Undo disables itself while parts remain, focus moves to Restore all, as in legacy. The `dissection-undo` target resolves to Undo, or to Restore all while Undo is disabled, so the inspector's Hide never targets a disabled button.

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order and the WAI-ARIA APG focus-management guidance (when the focused element is removed, move focus to a logical place rather than losing it).
