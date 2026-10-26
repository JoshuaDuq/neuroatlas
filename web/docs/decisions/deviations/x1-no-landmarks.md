# The profile and its sections are not landmarks

Chunk: X1
Status: fix (standard cited)

## Legacy behaviour

index.html:338 and functions.js:196-199,225-228,254-256,284-286 give the profile `section` and each of its sections `aria-labelledby`, so each becomes a `region` landmark nested inside the panel.

## New behaviour

The profile is a plain `div`; the sections are plain `div`s under their `h3` headings. The panel `<aside>` is the one landmark (decision 13 on #4).

## Standard cited

WAI-ARIA APG Landmark Regions ("use landmarks sparingly"); axe `landmark-unique` and `region`; decision 13 on #4.
