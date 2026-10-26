# The sheet reports what it covers from a laid-out grip, and drops the media-query fallbacks

Chunk: H6

## Legacy behaviour

`createSheet` measures and reports its first inset at construction (sheet.js:309), before the scene or the stage chrome may exist (`chrome?.setViewport`), and guards `matchMedia` and `ResizeObserver` with fallbacks (sheet.js:35-38, 245, 295). On the desktop to phone transition after load the stage's `--vis-bottom` stalled at 0 for a minute in one load in five (G1 review on #4, issuecomment-6405672591).

## New behaviour

The sheet is a component under the engine's composition: the shell is read from `createMedia`, the first measurement runs in an effect after the grip is in the DOM and laid out, and the probe's and the grip's `ResizeObserver` callbacks (which report once on `observe`, after layout) re-report the span. Every change of rest reports its target span through `onInsets`. Browsers without `matchMedia` or `ResizeObserver` are not supported, so the fallbacks are gone and a missing one throws.

## Standard cited

CLAUDE.md: fail fast, no silent fallbacks. WHATWG Resize Observer: the first observation is delivered after layout.
