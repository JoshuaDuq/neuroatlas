# The key lists keep their list role

Chunk: G3
Status: fix (standard cited)

## Legacy behaviour

`.stage-key-list` is a `ul` with `list-style: none`. Safari with VoiceOver drops list semantics from such a list.

## New behaviour

The `ul` carries an explicit `role="list"`. A plain list is named by its plate's title (`aria-labelledby`); a pickable list sits inside the named toolbar.

## Standard cited

WCAG 2.2 SC 1.3.1 Info and Relationships; the documented WebKit behaviour for `list-style: none` lists.
