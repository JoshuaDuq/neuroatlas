# Tooltip drawn inside the open dialog or fullscreen element

Chunk: U5
Status: decided under the delegation on #4 (decision 33, standards-based)

## Legacy behaviour

ui/tooltip.js draws one `popover="manual"` element appended to `body`, in the top layer, so it clears an open dialog. Placement is a hand-written `placeTooltip` (below, else above, clamped to the viewport).

## New behaviour

Bits draws the content in a portal whose target is the trigger's open `<dialog>`, else `document.fullscreenElement`, else `body`. A body-level element would sit under a modal dialog's top layer and outside a fullscreen element, hiding the tooltip. Floating UI (inside Bits) places it below the trigger, flips it above where it does not fit and keeps it 8 px inside the viewport, which is what `placeTooltip` did.

## Standard cited

WCAG 2.2 SC 1.4.13 Content on Hover or Focus (the content must stay perceivable); HTML Standard, modal dialog and top layer; Fullscreen API (only descendants of the fullscreen element render); Floating UI `flip` and `shift` middleware.
