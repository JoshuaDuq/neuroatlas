# Focused controls clear the sticky header

Chunk: T2
Status: fix (D9 (decision 41)); listed in the T2 PR

## Legacy behaviour

`dialogs.css:76-98` made the header sticky over scrolling content with no scroll margin: on a phone or a short landscape window a control that scrolled into view could sit under it.

## New behaviour

Every focusable control in the dialog has a `scroll-margin-top` of the header's height (plus the safe-area inset and a gap), so the browser's focus scroll leaves it clear.

## Standard cited

WCAG 2.2 SC 2.4.11 Focus Not Obscured (Minimum).
