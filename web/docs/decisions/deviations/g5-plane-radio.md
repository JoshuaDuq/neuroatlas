# The phone's plane switch is a radio group

Chunk: G5
Status: fix (decision 6 on #4)

## Legacy behaviour

`#mpr-planes` is a `role=group` of three buttons with `aria-pressed`; the arrow keys, Home and End move focus only, and Enter or Space chooses (ui/chrome/sections.js:315-351, ui/roving.js).

## New behaviour

U3's `ChoiceGroup`, an APG radio group named "Section plane": one Tab stop on the checked plane, the arrow keys move focus and choose, wrapping. The group is drawn only while the phone layout shows one plane.

## Standard cited

WAI-ARIA APG Radio Group pattern; decision 6 on #4 (MPR planes are a cheap, mutually exclusive choice).
