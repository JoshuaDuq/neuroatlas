# A restored permalink's hidden count is spoken

Chunk: A3 (carried by S1's announcer; no A3 code)
Status: fix, standard cited (approved in decision 36 on #4).

## Legacy behaviour

The count sentence is spoken only when the count changed since the previous update, and the first update never speaks (`viewer/ui/panels/dissection.js:36-42`: `counted === null`). Opening a `#hidden=...` link shows the bar and says nothing.

## New behaviour

S1's `speech.ts` keeps the same rule (it starts with no count and compares settled counts, not microtasks). A restored count is spoken once because `announceView` is created before S4 applies the link, so the load changes the count it already knows. The bar itself does not announce: its count is a plain paragraph, so one announcer speaks it once. I1 and S4 must keep that order (contract on #4, S1).

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages.
