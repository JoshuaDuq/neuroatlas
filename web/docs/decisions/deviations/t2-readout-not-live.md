# The readout is not a live region

Chunk: T2
Status: fix (D3 (decision 41)); listed in the T2 PR

## Legacy behaviour

`index.html:659` made the readout (`RAS: x y z · T1 · FA`) a `role="status"`, so every crosshair update, including each frame of a pointer drag, was announced.

## New behaviour

The readout is plain text. A move made with the canvas keys says the new readout through the page announcer once the key repeat pauses (200 ms); the voxel form says "Crosshair moved to voxel i, j, k.". A pointer move says nothing, as a drag has no keyboard reader.

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages (announce changes the reader caused, not a stream); React Aria `SliderOutput` keeps its value non-live for the same reason.
