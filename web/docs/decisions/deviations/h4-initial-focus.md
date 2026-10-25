# Provenance dialog initial focus

Chunk: H4
Status: fix (standard cited)

## Legacy behaviour

viewer/ui/panels/provenance.js:163-169 calls `showModal()`, which focuses the first focusable element: the Close button, above a definition list that is long and scrollable.

## New behaviour

The dialog title (`<h2 tabindex="-1" autofocus>`) takes focus on open. The list starts in view and a screen reader reads the dialog's name, then its content. Close stays the first Tab stop.

## Standard cited

WAI-ARIA APG Dialog (Modal) pattern, note on initial focus: when the content is semantic structure such as a list, or long enough that focusing a control could scroll the start out of view, give a static element at the top `tabindex="-1"` and focus it. WCAG 2.2 SC 2.4.3 Focus Order.
