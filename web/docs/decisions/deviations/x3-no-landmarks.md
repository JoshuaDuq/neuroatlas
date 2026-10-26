# The lesson profile and its sections are not landmarks

Chunk: X3
Status: fix (standard cited, decision 13 on #4)

## Legacy behaviour

`section#circuit-profile` and `section#circuit-region` carry `aria-labelledby` (index.html:341, 423; circuits.js:167-227, 229-257), each becoming a `region` landmark nested inside the panel. (The landmark list's section is labelled only on its `ol`, so it was never one.)

## New behaviour

The profile and the related section are plain `div`s under their headings; the landmark list's section is a plain `div` as before. The panel `<aside>` is the one landmark.

## Standard cited

WAI-ARIA APG Landmark Regions ("use landmarks sparingly"); axe `landmark-unique` and `region`; decision 13 on #4. Same as `x1-no-landmarks.md`.
