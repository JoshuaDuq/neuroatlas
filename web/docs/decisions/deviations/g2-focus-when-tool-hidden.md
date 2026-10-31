# Focus is kept when a stage tool or its popover goes away

Chunk: G2
Status: fix (standard cited)

## Legacy behaviour

When the tract reference hides Section and Display, or the dock stops being visible, `settlePopovers` (viewport-chrome.js:635-640) closes the open popover without moving focus. If focus was inside the popover, or on the tool that was hidden, it falls to `<body>`.

## New behaviour

A popover whose tool is hidden, or whose dock is not drawn (loading, an error, a lost context) or is covered by the raised phone sheet, closes. If focus was on the tool or inside the popover, it moves to the first tool that is still shown; when the tract reference hides every tool, to the model (the canvas), as the section row's focus does. While the dock itself is not drawn or is covered nothing can take focus, and the owner of that change places it.

## Standard cited

WCAG 2.2 SC 2.4.3 Focus Order; WAI-ARIA APG Dialog (Modal) practice that focus is never left on a removed element, applied to this non-modal dialog.
