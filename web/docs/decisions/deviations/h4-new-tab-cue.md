# The Provenance links say they open a new tab

Chunk: H4 (K14)
Status: fix (decision 17 on #4; standard cited)

## Legacy behaviour

Each source link of the Provenance sheet has `target="_blank"` and `rel="noreferrer"` and no cue that it leaves the app (viewer/ui/panels/provenance.js:126-129).

## New behaviour

A visually hidden "(opens in a new tab)" / "(s’ouvre dans un nouvel onglet)" (`link.newTab`) follows each link's text, and the `external-link` icon (12 px, `lib/ui/icons.ts`) follows it, as on the circuit sources (x3-new-tab-cue.md) and the atlas comparison.

## Standard cited

WCAG 2.2 technique G201 (give advance warning when opening a new window).
