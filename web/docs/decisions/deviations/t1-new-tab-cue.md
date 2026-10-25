# The two external links say they open a new tab

Chunk: T1
Status: fix (decision 17 and 42, B8); listed in the T1 PR

## Legacy behaviour

"Dataset source · CC0" and "Brain outline method and provenance" use `target="_blank"` with no cue (`native-ui.js:70-71`).

## New behaviour

A visually hidden "(opens in a new tab)" / "(s’ouvre dans un nouvel onglet)" follows each link's text, the same cue as the other external links (decision 17). The shared icon arrives with the shared string in C1's amendment.

## Standard cited

WCAG 2.2 technique G201 (give advance warning when opening a new window).
