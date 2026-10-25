# Language, theme and single keys are radio groups

Chunk: H2
Status: approved by the user on #4 (decision 6)

## Legacy behaviour

Each is a `role=group` of `aria-pressed` buttons. Arrows move focus only (wrapping, with Home and End); the choice is made on click (viewer/ui/roving.js, header.js:152-163).

## New behaviour

Each is an APG radio group (`radiogroup` labelled by its row label): one Tab stop on the checked radio, arrows move and select and wrap, Space selects. Home and End are dropped because the pattern does not define them. Built with U3 ChoiceGroup.

## Standard cited

WAI-ARIA APG Radio Group; WCAG 2.2 SC 4.1.2. See decision 0003 and u3-segmented-controls.
