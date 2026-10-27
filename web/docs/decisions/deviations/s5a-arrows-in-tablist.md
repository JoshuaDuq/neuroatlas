# The page's arrow keys leave a focused tab alone

Chunk: S5a
Status: fix (no approval needed; parity policy of 2026-10-25 on #4; decision 19 on #4)

## Legacy behaviour

ArrowUp and ArrowDown walk the region tree from anywhere on the page that is not a form field (app.js:1941-1944). To keep them from leaving the horizontal tab row for the tree, the workspace tablist cancelled both keys itself (ui/chrome/workspace.js:84-87), which made the global handler skip them. With focus on a tab, ArrowUp and ArrowDown therefore did nothing at all.

## New behaviour

H5 no longer cancels the vertical arrows in the tablist (decision 19). The keymap gates the tree walk by focus context instead: with focus on a tab (`[role="tab"]`), ArrowUp and ArrowDown are neither handled nor cancelled by the page. The visible effect: on a focused tab they now do what the browser does by default (scroll the page or panel), where legacy did nothing. From every other target the dispatch is unchanged; the S5a parity test compares the whole key x focus x state matrix with the legacy handler, with tabs left out.

## Standard cited

WAI-ARIA Authoring Practices, Tabs pattern, Keyboard Interaction, https://www.w3.org/WAI/ARIA/apg/patterns/tabs/#keyboardinteraction : a horizontal tablist assigns Left Arrow and Right Arrow, and optionally Home and End; it does not use Up Arrow or Down Arrow, so a tab has no reason to cancel them (Bits Tabs leaves them unhandled). Decision 19 on #4 approves the change.
