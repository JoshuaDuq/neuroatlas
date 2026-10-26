# A held angle slider keeps the reader's value

Chunk: G4
Status: fix (standard cited)

## Legacy behaviour

`update()` wrote `tilt.value` and `azimuth.value` from the cut's state on every render (ui/chrome/sections.js), whether or not the reader was holding one of the sliders. A change made elsewhere while a slider had focus moved the thumb under the reader's hand.

## New behaviour

While either angle slider has focus, a change to the cut's angles from elsewhere does not rewrite the sliders. When focus leaves, both sliders take the cut's angles. This is what the position slider and the exact field already do.

## Standard cited

WCAG 2.2 SC 3.2.2 On Input (a control's value is not changed under the reader without notice) and the APG Slider pattern (the thumb is the value the reader set).
