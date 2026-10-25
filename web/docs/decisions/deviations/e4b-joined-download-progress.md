# E4b deviation: a caller that joins a download under way hears its progress

Chunk E4b (#28). Pinned by `brain-atlas.test.ts` ("a download joined while it is under way reports
its progress to every caller", "the envelope download fans progress out to a joining caller") and
`parity/E4b.test.ts` ("E4b-joined-download-progress").

- **Legacy** (`viewer/model/brain-atlas.js:245,291,364`): `loadLayer`, `ensureEnvelopes` and
  `ensureSpinalCord` returned the pending promise to a second caller and dropped that caller's
  `onProgress`. The boot prefetch of the other atlas asks for no progress, so a reader who switched
  to it mid-download got `setAtlas(id, progress)` with no events: the masthead said "Loading" with
  no percentage for the whole switch. A cut or the functional colour joining the envelope download
  that hiding the cortex started lost its progress the same way.
- **New** (`engine/model/brain-atlas.ts`): each pending download keeps a list of callers, and every
  progress event goes to all of them. A caller that joins hears the events from then on.
- **Standard**: the contract of the layer below. `fetchAsset` (`core/assets/asset-cache.ts`) keeps a
  listener list per in-flight request and fans progress out to every caller that joins it (legacy
  test `asset-cache.test.js`, "fetchAsset reuses an in-flight request and fans progress out to every
  listener"). The model sat on that contract and broke it one level up.
