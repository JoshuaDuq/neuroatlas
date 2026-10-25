# A command closes the panel before its dialog opens

Chunk: H2
Status: fix (standard cited)

## Legacy behaviour

Keyboard shortcuts and Provenance open their dialog first; the menu's own click handler then tries to focus the More settings button behind the modal dialog, where it does nothing (shortcuts.js:121-125, provenance.js:171-176).

## New behaviour

The panel closes and focus returns to the More settings button first; only then is the command's action called, so the dialog captures that button as its invoker and returns focus to it.

## Standard cited

APG Dialog (Modal) pattern: focus returns to the element that invoked the dialog; WCAG 2.2 SC 2.4.3 Focus Order.
