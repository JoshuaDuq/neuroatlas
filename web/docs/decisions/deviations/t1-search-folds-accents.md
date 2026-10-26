# The tract search ignores accents

Chunk: T1
Status: fix (decision 42); listed in the T1 PR

## Legacy behaviour

The filter lower-cased the query and the names and tested a substring, so "arque" did not find "arqué" (`native-ui.js:108-109`).

## New behaviour

Query and names are lower-cased and have their accents folded (NFD, combining marks removed) before the substring test, as the anatomy search does.

## Standard cited

Established search practice (Unicode normalisation for diacritic-insensitive matching, as in the anatomy and Functions searches).
