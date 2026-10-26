# The browse scope is a radio group

Chunk: A2
Status: fix, standard cited.

## Legacy behaviour

"Whole brain" and "By system" are two `aria-pressed` buttons whose arrow keys only move focus (`viewer/ui/panels/internal-anatomy.js:9-60`, `viewer/ui/roving.js:2-12`). A mutually exclusive choice announced as two toggle buttons does not say that choosing one unchooses the other.

## New behaviour

One `radiogroup` named "Browse" of two radios (U3 `ChoiceGroup`): Tab enters on the checked one, arrows move and choose, Space chooses. While an atlas or detail level loads the group is `aria-disabled` (U3 `ChoiceGroup` `ariaDisabled`): the radios stay focusable and a choice is refused, so focus is not dropped to the page. Legacy set native `disabled` (`internal-anatomy.js:33`), which drops focus when choosing a scope is what starts the load.

## Standard cited

WAI-ARIA Authoring Practices, Radio Group pattern; decision 6 and decision 34 fix 10 on #4; WCAG 2.2 SC 2.4.3 Focus Order; `u3-segmented-controls.md`.
