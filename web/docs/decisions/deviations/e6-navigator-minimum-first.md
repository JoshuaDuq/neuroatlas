# E6: the MRI navigator checks the minimum before it adds a tract mesh

Chunk E6 (#30). A fix under the parity policy on #4.

- **Legacy** (`viewer/diffusion/navigation-viewer.js`, `syncTracts`): a new mesh was added to the
  NiiVue viewer before `configureNavigationTract` checked the minimum. A minimum below 1 mm threw
  after the mesh was in the viewer but not in the navigator's own map, so the mesh could not be
  hidden or freed, and a retry added a duplicate.
- **New** (`engine/diffusion/navigation-viewer.ts`): `syncTracts` rejects a minimum that is not a
  finite number of at least 1 mm with a `RangeError` first, before it changes visibility, loads a
  tract or adds a mesh. Valid calls are unchanged.
- **Standard**: validate arguments before any side effect, so a rejected call has none (project
  rule "fail fast", CLAUDE.md). The F2 fake navigator already rejects the same value at the same
  point. NiiVue and WebGL are not available in Node: covered by review and the browser tests of
  T2, not by a unit test.
