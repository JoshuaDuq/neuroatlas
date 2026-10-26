# One live region, said after the crosshair rests

Chunk: G5
Status: fix (standard cited)

## Legacy behaviour

Every `<output>` is an implicit `role=status` live region: the three position readouts and the two window readouts speak on every change, on top of `#mpr-readout` (a `role=status` rewritten on every pointer frame) (index.html:613-620, sections.js:276, 557-561).

## New behaviour

The slider readouts are `aria-hidden` (the slider speaks its value itself). The position readout is a plain paragraph updated at once for the eye, and is said through the page's polite announcer 250 ms after the crosshair last moved, only when it differs from what was last said. Opening says nothing; the dialog's name and focus say it.

## Standard cited

WCAG 2.2 SC 4.1.3 Status Messages (status messages without excessive announcements); WAI-ARIA 1.2 `output` and `status`.
