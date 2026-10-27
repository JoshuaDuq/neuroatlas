# The Tracts MRI navigator speaks through a live region inside its dialog

Chunk: I2
Status: fix (standard cited)

## Legacy behaviour

The navigator said the voxel it moved to, and the readout after a key move, through the page's announcer (navigation-ui.js; ported unchanged by T2). The announcer is outside the modal `<dialog>`. `showModal()` makes everything outside the dialog inert, so a `role=status` outside an open modal drops out of the accessibility tree (confirmed in Chromium with `Accessibility.getFullAXTree` in the G5 review) and those messages are never spoken.

## New behaviour

One polite `role=status` inside the dialog carries them. A key move is said once the keys have rested (200 ms) and only when it differs from the last move said. A repeated sentence is cleared and written after the announcer's 100 ms gap so it is spoken again. Closing the dialog clears the region and forgets the last move.

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages; HTML Standard, modal dialogs (`showModal()` makes the rest of the document inert).
