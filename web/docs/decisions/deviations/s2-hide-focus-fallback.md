# S2 · Hide puts focus on a control that can take it, and says when none could

**Legacy behaviour.** The inspector's Hide ended with `document.getElementById('dissection-undo').focus()` (`app.js:719-722`). The call assumed the element exists and is enabled. A disabled or hidden button ignores `focus()`, so focus stayed on the Hide button that had just left with the selection, and fell to the document body. A missing element threw a `TypeError` after the dissection had already changed.

**New behaviour.** `hideSelection()` hides the selection, waits for the interface to update, then asks the focus registry for the dissection's Undo and, failing that, the tree's tab stop (`requestFocus(dissectionUndo, { fallback: treeStop })`). It returns whether focus landed, so the caller can tell (decision 35). The same wait precedes `clearSelection()`'s rescue of focus, because the control that held focus goes away when the interface updates, not when the command returns.

**Standard.** WCAG 2.2 SC 2.4.3 Focus Order (A) and the WAI-ARIA Authoring Practices "Developing a Keyboard Interface" guidance on focus management: when the focused element is removed, move focus to a logical element that is present, never to the document.
