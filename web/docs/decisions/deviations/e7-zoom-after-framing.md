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
- **Standard**: a bug fix, not a standards departure. The legacy states the intent at `app.js:257-262`: the
  magnification is "held across a resize so that a stage which changes shape re-fits instead of clipping the
  anatomy off its sides or stranding it in the middle of a much larger field". A resize after Focus did the
  stranding it names. `placeOrbit` already keeps the magnification consistent (`app.js:809`) and so does the
  sheet's deferred refit (`app.js:1846`); this makes the other framings agree with them.
- **Test**: `src/lib/engine/framing.test.ts`, "keeps the distance Focus chose when the stage next
  resizes", and "FACADE-12 every framing command updates the magnification the next resize keeps"
  for the other commands.
