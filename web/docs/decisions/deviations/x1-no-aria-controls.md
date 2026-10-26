# The search field does not claim to control the list

Chunk: X1
Status: fix (standard cited)

## Legacy behaviour

index.html:269 sets `aria-controls="function-list"` on the search field. The target is a `role=group`, and a search field that is not a combobox controls nothing in the ARIA sense.

## New behaviour

No `aria-controls`.

## Standard cited

WAI-ARIA 1.2 `aria-controls`: relates a control to the content it controls (a combobox popup, a tab and its panel); not a plain search field.
