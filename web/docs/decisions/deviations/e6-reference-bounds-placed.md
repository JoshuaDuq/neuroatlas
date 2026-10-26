# E6: the tract reference is framed on its placed box

Chunk E6 (#30). A bug fix under the parity policy on #4.

- **Legacy** (`viewer/diffusion/native-viewer.js:44`): `load()` copies the scanner-to-surface
  transform into the group's matrix and calls `group.updateWorldMatrix(true, true)`. The group has
  `matrixAutoUpdate` false, and in three 0.186 that call never sets `matrixWorldNeedsUpdate`, so
  the world matrix stays at the identity until the next render. `bounds` read right after `load()`
  was the outline's own box, about 14 mm away from where the outline is drawn.
- **New** (`engine/diffusion/native-viewer.ts`): `updateWorldMatrix(true, true, true)` forces the
  update, so `bounds` is the placed box the moment `load()` resolves, which is what the camera
  framing reads (`onReferenceReady`).
- **Standard**: the framing must use the box that is drawn. Pinned by `native-viewer.test.ts`
  (DIFF-17).
