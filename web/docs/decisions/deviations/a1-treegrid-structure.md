# Anatomy tree structure: treegrid rows and cells

Chunk: A1
Status: fix, standard cited. Follows decision 8 on #4 (approved) and `u7-treegrid.md`.

## Legacy behaviour

`#tree` is `role="tree"`. Between it and its `treeitem` rows sit a `role="group"` per section (labelled by an `aria-hidden` heading) and, inside each group row, an `aria-owns` pointing at a sibling `role="group"` of children (`viewer/ui/panels/navigator.js:489-540`). Each `treeitem` also holds focusable `button`s (the eyes). ARIA 1.2 does not allow that: a `tree` owns `treeitem`s and `group`s of `treeitem`s, and an interactive control cannot nest inside a `treeitem`, whose children are presentational.

## New behaviour

One `role="treegrid"` named "Browse anatomy". Rows are `role="row"` with `aria-level` 1 (group) and 2 (region), `aria-posinset`/`aria-setsize`, `aria-expanded` on groups and `aria-selected` on regions. Each row's cells are `role="gridcell"`: the name, then one cell per side (Mid, L, R) that holds the visibility eye. Each eye is a native button in its own cell.

U7's `Treegrid` is a flat list of rows with no `rowgroup`, so a section heading ("Cortex", "Subcortical", "Cut labels only") becomes a level-1 row of its own: one cell, no `aria-expanded`, no `aria-selected`. It is a stop for Up and Down, which a legacy `aria-hidden` heading was not. Its `aria-posinset`/`aria-setsize` count the headings among the level-1 siblings. The legacy visual layout is kept.

## Standard cited

WAI-ARIA 1.2 required owned elements and `treegrid`; WAI-ARIA APG Treegrid pattern; WCAG 2.2 SC 1.3.1 and 4.1.2.
