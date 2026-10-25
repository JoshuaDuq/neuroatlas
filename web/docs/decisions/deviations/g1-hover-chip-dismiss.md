# The hover chip can be dismissed with Escape

Chunk: G1
Status: fix (standard cited)

## Legacy behaviour

The chip naming the region under the pointer stays until the pointer leaves the region or the camera moves (viewport-chrome.js:850-866). There is no way to dismiss it without moving the pointer.

## New behaviour

Escape hides the chip while it is showing, without moving focus. It comes back when the pointer is over another region, or has left the stage and returned; a still pointer over the same region keeps it hidden. The handler calls `preventDefault()` and never stops propagation, so the keymap (S5a skips an event that is already `defaultPrevented`) runs its Escape cascade on the next press, not the same one. An Escape that another handler already took, or with no chip showing, is left alone. The chip is not hoverable (`pointer-events: none`), so the Hoverable condition does not arise; it persists until the pointer or the camera moves.

## Standard cited

WCAG 2.2 SC 1.4.13 Content on Hover or Focus (Dismissible); the same Escape dismissal is in IBM Carbon and React Aria tooltips.
