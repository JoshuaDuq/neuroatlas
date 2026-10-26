# The meta line is one persistent status region

Chunk: X2
Status: fix (standard cited)

## Legacy behaviour

clinical.js:269-275 creates `p#clinical-meta role=status` with its text each time the profile renders. A live region inserted already populated is often not announced.

## New behaviour

The heading and a `StatusLine` stay mounted while no deficit is open and the text is updated in place; the rest of the profile mounts once per deficit.

## Standard cited

WCAG 2.2 SC 4.1.3; ARIA22 (role=status) and ARIA19 techniques.
