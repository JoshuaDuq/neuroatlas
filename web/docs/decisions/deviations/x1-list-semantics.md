# Function groups are lists

Chunk: X1
Status: fix (standard cited)

## Legacy behaviour

functions.js:73-84,421-456 builds each group as `div[role=group]` holding bare buttons, so a screen reader does not say how many functions a group has.

## New behaviour

Each group is `div[role=group]` labelled by its `h3`, holding `ul > li > button`; the "All functions" row is its own list. The reader hears "list, N items" and the position of each row.

## Standard cited

WCAG 2.2 SC 1.3.1 Info and Relationships (A); Technique H48 (lists for lists of items).
