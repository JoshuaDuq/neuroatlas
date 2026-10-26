# An area button is named by its content

Chunk: X1
Status: fix (standard cited)

## Legacy behaviour

functions.js:181-182 sets `aria-label` to "Show area: <name> · <side>, <division>, z 3.2" on each area button. The label replaces the content, begins with a verb the button does not show, and a speech-control user who says the visible name finds no match at the start of the accessible name.

## New behaviour

No `aria-label`. The name is computed from the content: "<name> · <side>, <division>, z 3.2". The separators and the "z" are visually hidden text between the visible name, division and figure; the visible text is a subsequence of the name, in order, and begins it.

## Standard cited

WCAG 2.2 SC 2.5.3 Label in Name (A); SC 2.4.6 Headings and Labels; Technique G208.
