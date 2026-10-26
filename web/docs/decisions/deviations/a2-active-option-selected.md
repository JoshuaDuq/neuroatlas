# The armed option is the selected one

Chunk: A2
Status: fix, standard cited.

## Legacy behaviour

`aria-selected` on a result option marks "this is the selected region" (`viewer/ui/panels/navigator.js:279`, `608-609`), and the armed option, the one Enter will choose, is shown only by an outline and `aria-activedescendant` (`456-459`). In a combobox's listbox a screen reader announces `aria-selected` as the highlighted option, so it announced the wrong one.

## New behaviour

`aria-selected="true"` is on the armed option only (U6's `SearchCombobox`). The option for the selected region carries `aria-current="true"` (U6's `current` flag), beside the weight and accent wash it already had, so the state is in the accessibility tree and is not a second meaning of `aria-selected`.

## Standard cited

WAI-ARIA 1.2: `aria-current` is a global state, valid on an `option`; WAI-ARIA Authoring Practices, Combobox pattern, listbox popup: `aria-selected="true"` on the option that is visually indicated as focused (the "Editable Combobox With List Autocomplete" example); decision 34 and decision 40 (`aria-current` for the current row) on #4.
