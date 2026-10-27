# Focus never falls to the page when a key changes under it

Chunk: G3
Status: fix (standard cited)

## Legacy behaviour

The paint rows are rebuilt on every update; the focused pick is found again by id and re-focused. If its row, its plate or the plate's list goes (the legend ends, the colour changes, a long key folds), focus drops to `body`.

## New behaviour

Rows are persistent, keyed elements, so a pick needs no hand-off. If the focused row goes or is folded away, focus moves to its plate's toggle; if the plate goes, to the stage host (`#viewport`, tabindex -1).

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order; APG guidance to move focus to a logical place when the focused element is removed.
