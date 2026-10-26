# The open circuit is `aria-current`, not `aria-pressed`

Chunk: X3
Status: fix (decision 40 on #4, overrides the issue text)

## Legacy behaviour

A circuit row carried `aria-pressed` set to whether its lesson was open (circuits.js:330-334), announcing a toggle button. Pressing the row opens a lesson; it does not toggle anything, and pressing it again does not close it.

## New behaviour

The row of the open circuit has `aria-current="true"` and the others none, as the function and deficit rows do; `data-selected` is kept for styling. The workspace's current-item registry (`registerCurrentItem`) finds the row by that attribute.

## Standard cited

WAI-ARIA 1.2, `aria-current`; APG Button (`aria-pressed` is for toggle buttons).
