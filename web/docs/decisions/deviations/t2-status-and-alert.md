# Status and failure are persistent regions

Chunk: T2
Status: fix (D2 (decision 41)); listed in the T2 PR

## Legacy behaviour

`navigation-ui.js:68-71` and `index.html:638` switched one element between `role="status"` and `role="alert"` by assigning `role`, and toggled `hidden` on it. A live region whose role changes, or that is `display: none` until it has text, is announced unreliably.

## New behaviour

A polite `role="status"` line (U4 `StatusLine`) holds "Loading…", the outside-field-of-view note and, once the scan is up, "Reference MRI ready." (new, visually hidden); a separate `role="alert"` element is in the page from the start and receives only the failure sentence. Both stay in the DOM. The status line is remounted when the language changes, so a language switch does not read it again (decision 37).

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages; ARIA19 (alert) and ARIA22 (status).
