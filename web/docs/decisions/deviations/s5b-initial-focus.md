# Shortcuts dialog initial focus

Chunk: S5b
Status: fix (standard cited)

## Legacy behaviour

viewer/ui/chrome/shortcuts.js:107-116 calls `showModal()`, which focuses the first focusable element: the Close button, above a list of 21 rows that scrolls at 200 % text or on a phone.

## New behaviour

The dialog title (`<h2 tabindex="-1" autofocus>`) takes focus on open, as in the Provenance dialog (h4-initial-focus). A screen reader reads the dialog's name, then its content. Close stays the first Tab stop.

## Standard cited

WAI-ARIA APG Dialog (Modal) pattern, note on initial focus: when the content is semantic structure such as a list, or long enough that focusing a control could scroll the start out of view, give a static element at the top `tabindex="-1"` and focus it. WCAG 2.2 SC 2.4.3 Focus Order.
