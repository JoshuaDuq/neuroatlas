# E7 deviation: the reader's magnification follows every framing, not only named views

Chunk E7 (#31). A fix under the parity policy (a state that contradicts the picture on screen).

- **Legacy** (`viewer/app.js:263`): `zoom` is the camera's distance as a multiple of the distance at
  which the whole brain just fills the stage, and a resize puts the camera back at
  `fittedDistance(whole) * zoom` (`refitViewport`, 122). Only `frameCurrent` (sets 1), a gesture's end
  and a keyboard zoom (`rememberZoom`), `placeOrbit`, `restoreCamera` and the tract switch write it.
  After Focus on a small region, a landmark, a deficit's regions, "pull back to the whole" or a cut
  face, the camera sits at a new distance while `zoom` still holds the old multiple, so the next canvas
  resize (a window resize, a phone turned) jumped the camera back to the old whole-brain magnification
  around the focused target.
- **New** (`engine/framing.ts`): `frameRegion`, `frameRegions`, `frameLandmark`, `frameInternal`,
  `frameWhole` and `faceCut` end by reading the magnification where the camera is going
  (`rememberZoom`), the way `placeOrbit` already does. The destination plans are unchanged (the
  differential test is `Object.is`-equal on them); only the stored multiple differs, and so only what
  the next resize does.
- **Standard**: a bug fix, not a standards departure. The legacy already keeps the magnification
  consistent with the picture in `placeOrbit` (`app.js:810`) and in the sheet's deferred refit
  (`app.js:1846`), and a resize that moves what the reader framed is the "viewport change moves
  the content" failure that WCAG 2.2 SC 1.4.10 (Reflow) asks a responsive view to avoid.
- **Test**: `src/lib/engine/framing.test.ts`, "keeps the distance Focus chose when the stage next
  resizes". `web/parity/E7.test.ts` gives the legacy side the same bookkeeping
  (`rememberZoom()` after those commands), so the comparison across later resizes stays exact.
