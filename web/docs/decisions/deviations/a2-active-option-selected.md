# The armed option is the selected one

Chunk: A2
Status: fix, standard cited.

## Legacy behaviour

`aria-selected` on a result option marks "this is the selected region" (`viewer/ui/panels/navigator.js:279`, `608-609`), and the armed option, the one Enter will choose, is shown only by an outline and `aria-activedescendant` (`456-459`). In a combobox's listbox a screen reader announces `aria-selected` as the highlighted option, so it announced the wrong one.

## New behaviour

`aria-selected="true"` is on the armed option only (U6's `SearchCombobox`). The selected region is marked on its row by weight and the accent wash, as before, but no longer in the accessibility tree: an option cannot carry both meanings, and `aria-current` on an option has no support in the screen readers this serves. A spoken cue needs a C1 string (requested on #4: a visually hidden "selected" suffix); until then the sighted mark stays.

## Standard cited

WAI-ARIA Authoring Practices, Combobox pattern, listbox popup: `aria-selected="true"` on the option that is visually indicated as focused (the "Editable Combobox With List Autocomplete" example); decision 34 on #4.
