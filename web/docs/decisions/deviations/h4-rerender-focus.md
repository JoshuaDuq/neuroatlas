# Focus when the Provenance sheet re-renders

Chunk: H4
Status: fix (standard cited)

## Legacy behaviour

viewer/ui/panels/provenance.js:154 replaces every row on a language or tract-reference change. A focused link is destroyed, and focus falls to `body`, outside the modal dialog.

## New behaviour

Rows are patched in place, so a link that still exists keeps focus. If the focused element has gone (a reference with fewer sources), focus moves to the dialog title.

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order; WAI-ARIA APG Dialog (Modal): focus stays inside the dialog while it is open.
