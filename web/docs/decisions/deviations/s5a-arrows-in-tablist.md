# The page's arrow keys leave a focused tab alone

Chunk: S5a
Status: fix (no approval needed; parity policy of 2026-10-25 on #4; decision 19 on #4)

## Legacy behaviour

ArrowUp and ArrowDown walk the region tree from anywhere on the page that is not a form field (app.js:1930-1935). To keep them from leaving the horizontal tab row, the workspace tablist cancelled both keys itself (ui/chrome/workspace.js:82-86), which made the global handler skip them. The tablist consumed keys that are not its own.

## New behaviour

H5 no longer cancels the vertical arrows in the tablist. The keymap gates the tree walk by focus context instead: with focus on a tab (`[role="tab"]`), ArrowUp and ArrowDown are neither handled nor cancelled by the page. Everywhere else the dispatch is unchanged (the S5a parity test compares the whole key x focus x state matrix with the legacy handler, with tabs left out).

## Standard cited

WAI-ARIA Authoring Practices, "Developing a Keyboard Interface" > Keyboard Shortcuts, https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#keyboardshortcuts : a page-level shortcut must not take over a key from the widget that has focus; and a widget should handle only the keys of its own pattern (Tabs pattern, https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
