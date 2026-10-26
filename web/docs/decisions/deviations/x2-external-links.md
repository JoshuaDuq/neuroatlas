# External links say they open a new tab; English titles are marked

Chunk: X2
Status: fix (standard cited)

## Legacy behaviour

clinical.js:104-125 opens DOI, PubMed and correction links in a new tab without saying so, and writes English titles, authors and journals with no language in a French interface.

## New behaviour

Each link has visually hidden "(opens in a new tab)" / "(s'ouvre dans un nouvel onglet)" and an icon. English publication text carries `lang="en"` in French.

## Standard cited

WCAG 2.2 technique G201 (new-window warning); SC 3.1.2 Language of Parts; decision 17 on #4.
