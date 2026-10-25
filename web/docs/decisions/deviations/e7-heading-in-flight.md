# E7 deviation: framing reads the heading and distance where an eased move is going

Chunk E7 (#31). A fix under the parity policy (one read of "where the camera is" per framing).

- **Legacy** (`viewer/app.js:264`, `519`, `1826`): `viewDirection()` (used by `frameRegions`,
  `frameInternal`, `frameWhole`), `focusSelection` and `rememberZoom` read the live camera and target.
  `heading()`, `refitDock`, `keepFraming` and `refitViewport` read `scene.destination`. During an eased
  move (240 ms) the live camera is part-way, so Focus, "pull back", or a gesture's end that lands in
  that window used a heading and distance the camera was never going to keep. The comment at
  `app.js:1846` already corrects one such path.
- **New** (`engine/framing.ts`): every framing reads `scene.destination`. At rest the destination is
  the camera, so the plans are bit-for-bit those of legacy (the differential test is `Object.is`
  over seeded poses); only a framing started mid-move differs, and it now continues from where the
  move lands.
- **Standard**: a bug fix, not a standards departure. The legacy already reads the destination for
  the sheet and the dock (`heading()`, `app.js:1496`) and says why at `app.js:1846`: a command takes
  the state the move is heading for. This makes the other readers agree with them.
- **Test**: `src/lib/engine/framing.test.ts`, "frames the whole brain along the heading the eased move
  is going to".
