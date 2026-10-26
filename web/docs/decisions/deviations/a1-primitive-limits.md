# Two legacy details the Treegrid primitive needed to carry

Chunk: A1 (with the U7 hand-over for `Treegrid.svelte`)
Status: ported. Recorded because the primitive changed to carry them.

## Legacy behaviour

1. An open group's row is `position: sticky` inside its own `.tree-group` block, so its name stays in view while its regions scroll, and leaves with them; its regions keep a `scroll-margin-block` so the sticky row does not cover a focused one (`viewer/styles/navigator.css:120-135`).
2. A region too small for the cut (`below-cut-resolution`) is `aria-disabled="true"` on its row, takes no hover wash and shows the default cursor (`viewer/ui/panels/navigator.js:360-363`, `navigator.css:27,31`).

## New behaviour

1. `Treegrid` renders each top-level row and the rows open under it inside one plain `<div class="treegrid-block">`. It has no role, so rows are still the grid's own children for ARIA and axe, and the key handling is unchanged. The tree makes the open group row sticky within its block and gives level-2 rows the scroll margin.
2. `TreegridNode.disabled` renders `aria-disabled="true"` on the row and removes the hover wash. The tree sets it for the unavailable region and gives the row the default cursor.

## Standard cited

WCAG 2.2 SC 2.4.11 Focus Not Obscured (the scroll margin); WAI-ARIA 1.2 `aria-disabled` on `row`. Parity with legacy otherwise.
