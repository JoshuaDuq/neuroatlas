# E6: `setMinimum` validates before it stores

Chunk E6 (#30). A fix under the parity policy on #4.

- **Legacy** (`viewer/diffusion/native-viewer.js`, `setMinimum`): the value was checked only inside
  `filterTractGeometry`, once per loaded bundle. With no bundle loaded, any value (0, negative,
  `NaN`) was stored as the minimum and shown by `snapshot()`, and the next `loadBundle` then threw
  while building its geometry.
- **New** (`engine/diffusion/native-viewer.ts`): `setMinimum` rejects a value that is not a finite
  number of at least 1 mm with a `RangeError` before it touches any bundle or stores the value.
  Valid values behave as before; the message is the one `filterTractGeometry` gave.
- **Standard**: fail fast with the invariant checked at the boundary that owns the state (project
  rule, CLAUDE.md), so a rejected call leaves no partial state. Pinned by `native-viewer.test.ts`
  and `parity/E6.test.ts`.
