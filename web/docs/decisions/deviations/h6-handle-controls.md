# The handle controls the panel, not its own ancestor

Chunk: H6

## Legacy behaviour

`#sheet-handle` carries `aria-controls="sheet"` (index.html:190), and `#sheet` contains the handle. The reference says nothing a screen reader can use: the control and what it controls are the same box.

## New behaviour

`aria-controls="workspace-panel"`, the panel region the handle expands and collapses. The handle has no `aria-expanded`: the sheet has three rests, not two states, so its name carries the action ("Expand panel", "Collapse panel").

## Standard cited

WAI-ARIA 1.2, `aria-controls`: it identifies the element whose contents or presence the control changes.
