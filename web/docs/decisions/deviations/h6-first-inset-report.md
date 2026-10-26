# The sheet drops its media-query fallbacks and is mounted after the engine

Chunk: H6

## Legacy behaviour

`createSheet` reports its first inset from `onModeChange()` at construction (sheet.js:298) and guards `matchMedia` and `ResizeObserver` with fallbacks (sheet.js:35-38, 245, 295). On the desktop to phone transition after load, the stage's `--vis-bottom` stalled at 0 for a minute in one load in five (G1 review on #4, issuecomment-6405672591). The cause was not found: the scene and the chrome both exist before `createSheet` (app.js:118, 1465, 1516), and a measurement shows legacy and next both make three inset reports at mount.

## New behaviour

The fallbacks are gone: a browser without `matchMedia` or `ResizeObserver` is not supported and a missing one throws. The sheet is a component mounted under the composition after the engine (the I3a contract), takes `media` and `stage` as props, and reports the target span of every change of rest through `onInsets`. This record does not claim the stall is fixed; the `next` e2e test of the desktop to phone transition is the evidence.

## Standard cited

CLAUDE.md: fail fast, no silent fallbacks.
