# Out-of-range exact value is explained, not silently accepted

Chunk: U4
Status: fix under the parity policy (no prior approval needed); listed in the U4 PR

## Legacy behaviour

The exact-position number field (`#cut-number`, ui/chrome/sections.js:196-202) applied whatever was typed on `change`. A value outside min..max (for example 900 mm) was passed to `sections.setOffset`, the plane ended up elsewhere, and nothing told the reader their entry had not been used as typed. An empty field restored the current value.

## New behaviour

`RangeField` keeps the empty-field restore. A value outside min..max is not applied: the field gets `aria-invalid="true"`, `aria-describedby` points at a visible message built by the caller (EN/FR, for example "Enter a value from −128 to 128 mm.") and the typed text stays so it can be corrected. A valid entry, or any slider movement, clears the error.

## Standard cited

WCAG 2.2 SC 3.3.1 Error Identification (an input error is identified and described in text); SC 3.3.3 Error Suggestion (the allowed range is stated); GOV.UK Design System "Error message" and "Text input" patterns (do not silently correct an entry).
