# The two source links say they open a new tab

Chunk: R2
Status: fix (decision 17 and 39, B6); listed in the R2 PR

## Legacy behaviour

"Destrieux" and "HCP-MMP" in Method and sources use `target="_blank" rel="noopener"` with no cue (`atlas-comparison.js:149-152`).

## New behaviour

A visually hidden "(opens in a new tab)" / "(s’ouvre dans un nouvel onglet)" follows each link's text, then the shared `external-link` icon; `rel="noopener noreferrer"`. The text is T1's `newTab` string (decision 17), held in the component until C1 moves it.

## Standard cited

WCAG 2.2 technique G201 (give advance warning when opening a new window).
