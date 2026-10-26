# The deficit search field has a visible label

Chunk: X2
Status: fix (standard cited)

## Legacy behaviour

index.html:279-295 and clinical.js:412-415 give the field a visually hidden label and a placeholder.

## New behaviour

A visible label sits above the field ("Search deficits or cognitive functions"); the placeholder is dropped, since it would repeat the label. Same as the Functions field (x1-search-label); decision 37 on #4. `aria-controls` is kept, as legacy and the conductor decision have it.

## Standard cited

WCAG 2.2 SC 3.3.2 Labels or Instructions (A); placeholder text is not a substitute for a label.
