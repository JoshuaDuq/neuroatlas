# A position slider is named by its visible label

Chunk: G5
Status: fix (standard cited)

## Legacy behaviour

The slider has `aria-label="Sagittal MRI position"` while the visible label reads "Sagittal position" (FR "Position IRM sagittale" against "Position sagittale"), so the name does not contain the visible words (sections.js:540-541).

## New behaviour

U4's `RangeField` names the slider by its visible `<label>`: "Sagittal position" / "Position sagittale". `aria-valuetext` is the signed millimetre value.

## Standard cited

WCAG 2.2 SC 2.5.3 Label in Name; SC 4.1.2.
