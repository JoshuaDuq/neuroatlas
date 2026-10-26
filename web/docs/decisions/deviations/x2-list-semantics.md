# Deficit groups are lists

Chunk: X2
Status: fix (standard cited)

## Legacy behaviour

clinical.js:224-260 builds each group as `div[role=group]` holding bare buttons, so a screen reader does not say how many deficits a group has.

## New behaviour

Each group is `div[role=group]` labelled by its `h3`, holding `ul > li > button`, as the Functions list does (x1-list-semantics). The reader hears "list, N items" and the position of each row.

## Standard cited

WCAG 2.2 SC 1.3.1 Info and Relationships (A); Technique H48 (lists for lists of items).
