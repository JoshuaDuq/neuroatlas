# Treegrid key map: where it departs from the legacy tree

Chunk: U7 (primitive), A1 (anatomy tree)
Status: fix, standard cited. Follows the approved model in `u7-treegrid.md` and decision 0002; this file lists the key-by-key departures from `treeKeyAction` and `controlKeyAction` (`viewer/ui/panels/navigator.js:10-36`).

## Legacy behaviour

- Right on an expanded parent moved to its first child; on a leaf it went to the eye.
- Left on a collapsed parent did nothing.
- In an eye control, Home and End moved to the first and last row; Up and Down moved to the adjacent row without regard to which control was focused.
- No type-ahead and no expand-all key.
- `V` toggled visibility on a row or an eye control.

## New behaviour

- Right on an expanded parent or a leaf moves to the row's first cell (carry-forward on #19); a collapsed parent expands.
- Left on a collapsed parent or a leaf moves to the parent row.
- In a cell, Home and End move to the first and last cell of the row; Ctrl+Home and Ctrl+End move to the first and last row. Up and Down move to the same cell in the adjacent row (the last cell it has, if fewer).
- Type-ahead on a row: a printable character moves to the next row whose label starts with it; further characters within 500 ms extend the query; a repeated letter cycles.
- `*` on a row expands all its siblings.
- `V` still toggles visibility on a row or in a cell. A shortcut key does not start a type-ahead query: "v" toggles, but once a query is being typed, "v" extends it.

## Standard cited

WAI-ARIA APG Treegrid keyboard interaction (Right/Left/Up/Down/Home/End/Ctrl+Home/Ctrl+End in rows and cells); APG Tree View, "Type-ahead" and `*` (expand all siblings), which the treegrid pattern refers to for expansion and name matching.
