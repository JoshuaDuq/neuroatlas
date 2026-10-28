# The functional level is an APG radio group

Chunk: G3
Status: approved (decision 6 on #4); retired 2026-10-28 with the functional colour, which took the level control with it

## Legacy behaviour

`#functional-level` is a `role=group` of two `aria-pressed` buttons (Named, Sections) with a custom roving tabindex (`ui/roving.js`): the arrows move focus only, Enter or Space chooses, and the group wraps.

## New behaviour

U3's `ChoiceGroup`: a `radiogroup` named "Functional division level" with two radios. Tab enters on the checked radio, the arrows move and choose (wrapping), Space chooses. The choice calls the same command as before.

## Standard cited

WAI-ARIA APG Radio Group pattern; WCAG 2.2 SC 4.1.2 Name, Role, Value. Choosing on arrow is APG-sanctioned and the result (the key's rows) is beside the control, so SC 3.2.2 On Input holds.
