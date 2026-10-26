# The functional level's buttons are at least 24 px high

Chunk: G3
Status: fix (standard cited)

## Legacy behaviour

`.stage-key .functional-level button` is `height: 20px` on a desktop pointer (stage.css:242), below the 24 px minimum.

## New behaviour

The radios have `min-height: 24px` (44 px on a coarse pointer or a phone, as in legacy). The title row has room for the larger track.

## Standard cited

WCAG 2.2 SC 2.5.8 Target Size (Minimum).
