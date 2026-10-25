# Two legacy details the Treegrid primitive cannot carry yet

Chunk: A1
Status: not a standards fix; legacy behaviour that U7's `Treegrid` cannot express. Flagged on #4 for U7's owner. A1 does not decide it.

## Legacy behaviour

1. An open group's row is `position: sticky` inside its own `.tree-group` block, so its name stays in view while its regions scroll, and leaves with them (`viewer/styles/navigator.css:121-131`).
2. A region too small for the cut (`below-cut-resolution`) is `aria-disabled="true"` on its row (`viewer/ui/panels/navigator.js:360-363`).

## New behaviour

1. Not ported. `Treegrid` renders one flat list of rows, so a sticky group row has no per-group container to stop at: it would stay pinned for the rest of the tree. It needs a group wrapper (an APG `rowgroup`) from U7.
2. The row's name says it ("Name, side, not shown: reason."), it has no eye, no `aria-selected`, and Enter, Space and a click do nothing. `aria-disabled` itself needs a `disabled` flag on `TreegridNode`, which sets it on the row it owns.

## Standard cited

None: both are parity gaps, not departures from a standard.
