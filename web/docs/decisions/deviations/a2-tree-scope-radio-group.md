# The browse scope is a radio group

Chunk: A2
Status: fix, standard cited.

## Legacy behaviour

"Whole brain" and "By system" are two `aria-pressed` buttons whose arrow keys only move focus (`viewer/ui/panels/internal-anatomy.js:9-60`, `viewer/ui/roving.js:2-12`). A mutually exclusive choice announced as two toggle buttons does not say that choosing one unchooses the other.

## New behaviour

One `radiogroup` named "Browse" of two radios (U3 `ChoiceGroup`): Tab enters on the checked one, arrows move and choose, Space chooses. Both are disabled while an atlas or detail level loads, as before.

## Standard cited

WAI-ARIA Authoring Practices, Radio Group pattern; decision 6 on #4 (approved); `u3-segmented-controls.md`.
