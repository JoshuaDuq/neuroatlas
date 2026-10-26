# The paint rows are a named toolbar of toggle buttons

Chunk: G3
Status: approved (decision 6 on #4)

## Legacy behaviour

A paint key with more than one pickable row puts a `button[aria-pressed]` in each `li` of a plain `ul`, with a roving tabindex bound to the list. The group has no role and no name, and the rows are rebuilt on every update, so the pressed button is replaced as it changes state.

## New behaviour

The rows sit in `role=toolbar` named by the plate's title, `aria-orientation=vertical`, with U2's roving (one Tab stop on the pressed row, else the first; arrows, Home and End move and wrap). Rows are keyed by id and are the same elements across updates, so a pick changes `aria-pressed` on the focused button instead of replacing it, and focus needs no hand-off. A legend with one row, or `pickable: false` (a z scale), is a plain list with no buttons.

## Standard cited

WAI-ARIA APG Toolbar pattern (toggle buttons, one Tab stop); ARIA practice that a state change is made on the same element (WCAG 2.2 SC 4.1.2).
