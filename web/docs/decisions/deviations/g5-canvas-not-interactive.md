# The pictures are images, not controls

Chunk: G5
Status: fix (decision 31 on #4)

## Legacy behaviour

Each canvas is `tabindex=0` with `role=img` and its own `keydown` handler: the arrow keys move the crosshair one millimetre (sections.js:269-270, 301-307). Its name tells the reader to use the arrow keys, and the orientation letters drawn into the bitmap have no text twin.

## New behaviour

The canvas stays `role=img` but takes no focus and has no key handler; click and wheel stay for pointer users. The keyboard route is the plane's own slider (arrows one millimetre, Page Up and Page Down a larger step, Home and End the limits), which moved the same axis already. The canvas name says how to use it and spells out which way each edge faces ("Anterior at the top, patient right at the right, ..."). This also retires the modified-arrow bug (Alt+Left swallowed), since no handler remains.

## Standard cited

WAI-ARIA 1.2 `img` is not an interactive role; WCAG 2.2 SC 4.1.2 Name, Role, Value, SC 1.1.1 Non-text Content and SC 1.4.5 Images of Text (the letters are in the bitmap, so their meaning is in the name).
