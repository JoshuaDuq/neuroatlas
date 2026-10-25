# E6: the MRI navigator validates and serialises `syncTracts`

Chunk E6 (#30). A fix under the parity policy on #4.

- **Legacy** (`viewer/diffusion/navigation-viewer.js`, `syncTracts`):
  - A new mesh was added to the NiiVue viewer before `configureNavigationTract` checked the
    minimum. A minimum below 1 mm threw after the mesh was in the viewer but not in the navigator's
    own map, so the mesh could not be hidden or freed, and a retry added a duplicate.
  - Overlapping calls interleaved across `await loadTract`. Two calls for one tract both missed the
    map and each added a mesh, orphaning the first; `syncTracts([b])` followed at once by
    `syncTracts([])` left `b` visible, although the contract is to show exactly the enabled set.
    The panel serialised its own calls, so the engine never enforced it.
- **New** (`engine/diffusion/navigation-viewer.ts`):
  - A minimum that is not a finite number of at least 1 mm is rejected with a `RangeError` first,
    before visibility changes, a load or a mesh.
  - Calls are chained: each starts when the previous one settles (a failure does not block later
    calls), so a tract is added once and the last call decides what shows. A single call is
    unchanged.
- **Standard**: validate arguments before any side effect, and make an asynchronous state update
  atomic per call (project rule "fail fast", CLAUDE.md; the contract "show exactly these bundles",
  `api.ts`). Pinned by `navigation-viewer.test.ts`, which mocks `@niivue/niivue`.
