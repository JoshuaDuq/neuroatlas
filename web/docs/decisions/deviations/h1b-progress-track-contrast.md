# The empty part of the download bar passes 3:1

Chunk: H1b
Status: fix (standard cited)

## Legacy behaviour

The bar's track (`.progress`, stage.css:313) is `--overlay-border` (#3d4046) on the scene (#0e1116), 1.8:1, so the extent of the download is not visible.

## New behaviour

On the themed stage the track is `--border-control` and the fill `--accent`, both at least 3:1 against `--surface-base` in light and dark. `StageStatus` re-points the primitive's two overlay custom properties on its own wrapper; U4's `Progress` is unchanged.

## Standard cited

WCAG 2.2 SC 1.4.11 Non-text Contrast.
