# A held angle slider keeps the reader's value

Chunk: G4
Status: fix (bug)

## Legacy behaviour

`update()` wrote `tilt.value` and `azimuth.value` from the cut's state on every render (ui/chrome/sections.js), whether or not the reader was holding one of the sliders. A change made elsewhere while a slider had focus moved the thumb under the reader's hand, so the next arrow key started from a value the reader never set.

## New behaviour

While either angle slider has focus, a change to the cut's angles from elsewhere does not rewrite the sliders. When focus leaves, both sliders take the cut's angles, unless a slide is still queued or building: the cut's angles then lag the sliders, and the sliders keep the reader's values until the build lands and the cut catches up.

## Standard cited

Bug fix (the thumb moved under the reader's hand). The bar's own precedent: the position slider and the exact field already hold their draft while focused and take the cut's value when left.
