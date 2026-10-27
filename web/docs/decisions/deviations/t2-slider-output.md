# Slider values are not live and not part of the name

Chunk: T2
Status: fix (D4 (decision 41)); listed in the T2 PR

## Legacy behaviour

`index.html:661-669` wrapped each slider and its `<output>` in one `<label>`, so the number leaked into the slider's accessible name, and `<output>` has an implicit `role="status"`, which announced the number on every `input` event on top of `aria-valuetext`.

## New behaviour

Window, Level and FA opacity use U4 `RangeField`: the label wraps only its text, the number is an `aria-hidden` readout and the value is carried by `aria-valuetext`. `input` previews the number and `change` applies it, as before.

## Standard cited

WCAG 2.2 SC 4.1.2 and SC 3.3.2; HTML-AAM `output` mapping; APG Slider.
