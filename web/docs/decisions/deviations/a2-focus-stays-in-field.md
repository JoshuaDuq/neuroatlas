# Choosing a result, or a note button, leaves focus in the field

Chunk: A2
Status: fix, standard cited.

## Legacy behaviour

A result takes focus on pointer-down and is removed when the query empties, so focus falls to the page (`navigator.js:252-263`, `386`). The "Switch atlas" and "Switch cut labels" buttons are removed by the re-render their own click causes (`401-402`, `421-423`), and focus is lost the same way.

## New behaviour

A pointer-down on a result does not move focus off the field (U6), so after a click focus is still in the field. A note button moves focus to the field before it acts, so the re-render cannot strand it. Enter, Escape and the clear button already left focus in the field, and they still do.

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order and SC 3.2.2 On Input; WAI-ARIA Authoring Practices, Combobox: focus stays on the combobox when an option is accepted. Decision 34 on #4.
