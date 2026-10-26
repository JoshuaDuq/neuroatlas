# Status and failure are separate live regions

Chunk: T1
Status: fix (decision 42, B1); listed in the T1 PR

## Legacy behaviour

`native-ui.js:145` switched one element between `role="status"` and `role="alert"` by assigning `role`, and `render()` rewrote its `textContent` on every call, which every opacity `input` event triggers. Changing the role of a live region is not reliably announced, and rewriting identical text made some screen readers read "Reference dataset ready." again with each slider move.

## New behaviour

A polite `role="status"` element (U4 `StatusLine`) shows "Loading reference dataset…" and "Reference dataset ready."; Svelte writes its text only when the text changes. A failure mounts a separate `role="alert"` element, removed when a load starts again, so the next failure is announced again.

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages; ARIA19 (role=alert) and ARIA22 (role=status).
