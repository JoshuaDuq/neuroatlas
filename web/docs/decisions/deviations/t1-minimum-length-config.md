# The length filter’s range is one constant

Chunk: T1
Status: fix (decision 42); listed in the T1 PR

## Legacy behaviour

The slider's bounds were literals in the markup (`native-ui.js:55`: `min=1 max=250 step=1`).

## New behaviour

`MINIMUM_LENGTH` in `lib/core/tracts.ts` holds the same values (1, 250, 1) and the slider reads them. The engine's own floor (1 mm) is unchanged.

## Standard cited

Project rule (CLAUDE.md: configuration in one place); no behaviour changes.
