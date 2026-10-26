# Focus after closing the shortcuts dialog opened from the keyboard

Chunk: S5b (composition with H2's menu item is I3b's)
Status: fix (standard cited)

## Legacy behaviour

Opening the dialog with Enter on the settings menu's "Keyboard shortcuts" item and closing it with Escape leaves focus on `<body>` (measured in Chromium on `legacy`): the menu closes behind the dialog, and `shortcuts.js:122-128` focuses the ⋯ button only after the platform has already dropped focus. A pointer or touch open lands on ⋯.

## New behaviour

`Dialog` (U5) returns focus to the opener while it is connected and visible, else to `fallbackFocus`, which I3b sets to the ⋯ button. The result is the same for keyboard and pointer opens: focus is on ⋯.

## Standard cited

WAI-ARIA APG Dialog (Modal): on close, focus returns to the element that invoked it, or to a logical alternative when that no longer exists. WCAG 2.2 SC 2.4.3 Focus Order.
