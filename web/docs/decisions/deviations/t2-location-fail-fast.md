# A location with the wrong number of maps is an error

Chunk: T2
Status: fix (fix 10 (decision 41)); listed in the T2 PR

## Legacy behaviour

`navigation-ui.js:96` returned silently when a location's `values.length` differed from the catalog's number of maps, dropping the update.

## New behaviour

It throws a `RangeError`; the failure is logged and the alert shows the generic "could not be displayed".

## Standard cited

CLAUDE.md rule 3 (fail fast: no silent fallbacks).
