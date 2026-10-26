# The meta line is one persistent status region

Chunk: X2
Status: fix (standard cited)

## Legacy behaviour

clinical.js:331-334 creates `p#clinical-meta role=status` with its text each time the profile renders. A live region inserted already populated is often not announced.

## New behaviour

One `StatusLine` is mounted with the profile and its text is updated in place, never recreated per deficit or language. This helps changes made while a profile is shown: busy to count, a region failure, one deficit to another from the related list, and a language change. The first open from the list is unchanged from legacy: the profile is hidden (outside the accessibility tree) until its text is set in the same flush, and the heading takes focus.

## Standard cited

WCAG 2.2 SC 4.1.3; ARIA22 (role=status) and ARIA19 techniques.
