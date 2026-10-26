# The lists are real lists

Chunk: X3
Status: fix (standard cited)

## Legacy behaviour

`#circuit-list` was a `div` with `aria-label` and no role, which ARIA 1.2 does not allow a name on (circuits.js:328); `ol.circuit-steps` has `list-style: none`, which Safari and VoiceOver treat as not a list.

## New behaviour

The labelled list is `div role="group"` over a `ul` of `li` (as the Functions and Deficits lists), and the landmark sequence is `ol role="list"` labelled by its heading, so "1 of 5" navigation survives in Safari.

## Standard cited

WAI-ARIA 1.2, naming prohibited on `generic`; WebKit's list semantics for `list-style: none` and the established `role="list"` remedy; WCAG 2.2 SC 1.3.1.
