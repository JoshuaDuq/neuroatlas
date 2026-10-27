# The selection strips are named by the words they show

Chunk: K20
Status: fix (standard cited)

## Legacy behaviour

The strip's `aria-label` is `Inspect <label>` on the desktop (workspace.js:185) and `Inspect <label>, <side word>` on the phone (sheet.js:319). It shows `<label> <side glyph>` ("Middle temporal gyrus L"). The visible words are not the start of the name, and the glyph is not in it at all, so axe reports `label-content-name-mismatch`. H5 added the side word to both names (h5-strip-name-side.md) but kept the prefix.

## New behaviour

Both strips are named `<label> <side glyph>, <side word>` ("Middle temporal gyrus L, left"; "Gyrus précentral G, gauche"): the visible text first, then the side said as a word. A selection with no side is named by its label. The `Inspect`/`Examiner` prefix is gone, with its string; the chevron and the button role already say that it opens the selection.

## Standard cited

WCAG 2.2 SC 2.5.3 Label in Name (the accessible name contains, and best starts with, the visible text).
