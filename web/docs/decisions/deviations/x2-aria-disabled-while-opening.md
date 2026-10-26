# Controls stay focusable while a run is in flight

Chunk: X2
Status: fix (standard cited)

## Legacy behaviour

clinical.js:389 sets native `disabled` on every region button while a deficit opens, which drops focus from the control just activated; Restore is hidden while it runs, with the same effect.

## New behaviour

Region buttons carry `aria-disabled="true"` and the handler ignores activation; Restore stays shown with `aria-disabled` and draws as unavailable (tertiary ink, default cursor, `GrayText` in forced colours) for any run in flight. The meta line says why ("Opening anatomy…" or "Restoring the previous view…").

## Standard cited

WCAG 2.2 SC 2.4.3; WAI-ARIA APG "Focusability of disabled controls": keep a control focusable, use aria-disabled and ignore activation.
