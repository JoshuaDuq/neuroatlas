# An absent colour is said in words, not only drawn faint

Chunk: G3
Status: fix (standard cited)

## Legacy behaviour

A finding whose colour no drawn region carries gets `li[data-absent]`: its swatch is an outline, its text the faintest ink. Nothing in the accessibility tree says so; the note under the list ("An outlined finding has no region coloured in this view") is hidden on a narrow stage or when folded.

## New behaviour

The row's name ends with visually hidden text, "Not shown in this view" / "Absent de cette vue". The outline and faint ink stay. The words are `viewport.keyAbsent` in i18n.

## Standard cited

WCAG 2.2 SC 1.4.1 Use of Color, 1.3.1 Info and Relationships, 4.1.2 Name, Role, Value; Carbon data-visualization legends (text-labelled, never colour alone).
