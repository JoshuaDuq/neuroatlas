# The profile's meta line is announced when it changes

Chunk: X1
Status: fix (standard cited)

## Legacy behaviour

functions.js:290-318,303-305 rebuilds the profile with `replaceChildren()` and creates the `p[role=status]` for each opened function, so the live region is inserted already holding its text, or is recreated per profile. Live regions inserted with content are not reliably announced.

## New behaviour

One `p[role=status]` stays in the page across profiles, and only its text changes ("Preparing the HCP-MMP areas…", the count, the failure). Svelte writes the text node only when the text differs, so an identical sentence is never rewritten (the legacy rule of functions.js:333 is kept). A language switch makes a new element, so the translated sentence is not announced again (decision 37). "Preparing the HCP-MMP areas…" is heard only when the profile is already showing; when the inspector is still hidden as the text appears, the result that follows is the first thing announced. The heading takes focus and names the function, so the status carries progress and the count only.

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages (AA); ARIA22 (role=status for status messages); the live region must exist before its content changes.
