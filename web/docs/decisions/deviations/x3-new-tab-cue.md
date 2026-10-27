# The circuit source links say they open a new tab

Chunk: X3
Status: fix (decisions 17 and 40 on #4; X3 request, item 5)

## Legacy behaviour

The sources note of a circuit lists each reference as a link with `target="_blank"` and no cue that it leaves the app (circuits.js:198-226).

## New behaviour

A visually hidden "(opens in a new tab)" / "(s’ouvre dans un nouvel onglet)" (`link.newTab`) follows each link's text, the same cue as the other external links (T1, R2, decision 17). The `external-link` icon (12 px, `lib/ui/icons.ts`) follows the text, drawn by the shared icon snippet.

## Standard cited

WCAG 2.2 technique G201 (give advance warning when opening a new window).
