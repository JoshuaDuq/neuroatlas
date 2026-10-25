# Tooltip drawn inside the open dialog or fullscreen element

Chunk: U5
Kind: implementation note, not a fix (legacy was not broken)

Legacy ui/tooltip.js draws one `popover="manual"` element in the top layer, which already clears an open dialog and a fullscreen element. Bits draws the content in a portal, which is not in the top layer, so the portal target is the trigger's open `<dialog>`, else `document.fullscreenElement`, else `body`. The visible behaviour is unchanged. Floating UI (inside Bits) places the tooltip below the trigger, flips it above where it does not fit and keeps it 8 px inside the viewport, as `placeTooltip` did; browser tests assert both.
