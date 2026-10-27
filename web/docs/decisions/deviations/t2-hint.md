# The hint names every key and uses touch verbs on touch

Chunk: T2
Status: fix (D10 (decision 41)); listed in the T2 PR

## Legacy behaviour

`index.html:633` said only "Click a slice… arrow keys move one voxel", on every device.

## New behaviour

On a fine pointer the hint adds Page Up and Page Down, and `M` while single-key shortcuts are on (the key list only; the existing C1 sentence is unchanged). On a coarse pointer it says "Tap a slice to position the crosshair, or enter a voxel below." The new sentences are `mri.dialog.hintKeys`, `hintClose` and `hintTouch` in i18n.

The hint is in the dialog body under the sticky header, not inside it (legacy `index.html:631-633` kept it in the header). A long hint in the sticky header would cover most of a phone or landscape window (WCAG 2.4.11), and the header stays one line of title plus Close.

## Standard cited

WCAG 2.2 SC 3.3.2 Labels or Instructions and SC 2.5.1 Pointer Gestures; decision 21 (touch verbs).
