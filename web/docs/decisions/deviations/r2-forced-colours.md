# The pressed row and the unassigned rule survive forced colours

Chunk: R2
Status: fix (decision 39, B5); listed in the R2 PR

## Legacy behaviour

A pressed row is drawn with a background wash, accent ink and a bold name (`detail.css:165-168`), and the rule above Unassigned is a 1 px `background` (`detail.css:181-188`). Forced colours erase the wash, the accent and the background, leaving only the weight, and `a11y.css` has no comparison rule.

## New behaviour

Under `forced-colors: active` a pressed row gets a 4 px `Highlight` edge on its inline start, and the Unassigned rule is a `CanvasText` border. Under `prefers-contrast: more` the pressed row gets a 4 px accent edge. Both rules are in `@layer a11y`; normal rendering is unchanged.

## Standard cited

WCAG 2.2 SC 1.4.1 Use of Color and 1.4.11 Non-text Contrast; MDN forced-colors guidance (system colours for state).
