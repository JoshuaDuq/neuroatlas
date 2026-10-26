# Restore and Export say what they did

Chunk: T1
Status: fix (decision 42, B9); listed in the T1 PR

## Legacy behaviour

Restore default tracts and Export lengths CSV changed the scene or saved a file without any message (`native-ui.js:240-246`).

## New behaviour

Restore says "Default tracts restored." and Export says "Lengths CSV exported." through the page's polite announcer, and focus stays on the button. A bundle that finishes downloading after a check says "Loaded: {name}".

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages; ARIA22.
