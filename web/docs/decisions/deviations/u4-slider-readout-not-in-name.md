# Slider readout is not part of the accessible name

Chunk: U4
Status: fix under the parity policy (no prior approval needed); listed in the U4 PR

## Legacy behaviour

The slider's `<output>` sat inside its `<label>` (components.css:262-270, `label:has(output)`), so the accessible name of the slider was the label text plus the current value, for example "Opacity 85 %". `<output>` also has an implicit `role=status`, so each change was a live-region announcement on top of the slider's own value.

## New behaviour

The `<label for>` holds only the name. The visible readout is a sibling `<output aria-hidden="true">`; the value is spoken once, through `aria-valuetext`, which carries the same formatted text (locale, U+2212 minus, unit).

## Standard cited

WAI-ARIA APG Slider pattern (the value is conveyed by `aria-valuenow`/`aria-valuetext`, the label names the slider); WCAG 2.2 SC 4.1.2 Name, Role, Value; ARIA in HTML (a name should not include a changing value).
