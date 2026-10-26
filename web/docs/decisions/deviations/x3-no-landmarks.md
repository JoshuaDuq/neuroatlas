# The lesson profile and its sections are not landmarks

Chunk: X3
Status: fix (standard cited, decision 13 on #4)

## Legacy behaviour

`section#circuit-profile`, `#circuit-region` and the landmark list's section carry `aria-labelledby` (index.html:341, 423; circuits.js:167-227), each becoming a `region` landmark nested inside the panel.

## New behaviour

They are plain `div`s under their headings. The panel `<aside>` is the one landmark.

## Standard cited

WAI-ARIA APG Landmark Regions ("use landmarks sparingly"); axe `landmark-unique` and `region`; decision 13 on #4. Same as `x1-no-landmarks.md`.
