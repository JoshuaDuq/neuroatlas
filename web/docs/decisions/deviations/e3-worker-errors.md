# E3 deviation: a cut-worker failure is not hidden

Chunk E3 (#26), decision 26 on #4. A fix under the parity policy ("do not port bugs"). The parity
test (`web/parity/E3.test.ts`) drives the worker handler directly and never produces a worker
error; the behaviour below is pinned by `solid-sections.test.ts`.

## `SolidSections.ensureWorker` falls back only when `Worker` does not exist

- **Legacy** (`viewer/tissues/solid-sections.js`): `new Worker(...)` was wrapped in a silent
  `catch { workerFailed = true; return null; }`, and `worker.onerror` logged to the console,
  marked the worker as failed and resolved every pending `build()` with `null`. Any failure of the
  worker, including a bug in the cut itself, therefore turned into the synchronous cut on the
  pointer thread without a trace, which is the frame drop the worker exists to avoid.
- **New** (`engine/tissues/solid-sections.ts`): `build()` returns `null` (the caller cuts on its
  own thread) only when `typeof Worker === 'undefined'`. Constructing the worker is not guarded.
  A runtime error in the worker terminates it, rejects every pending `build()` with an `Error`
  carrying the `ErrorEvent` as its `cause`, and makes every later `build()` throw the same error.
- **Standard**: project rule "fail fast, no silent fallbacks" (CLAUDE.md), and the decision
  recorded as #26 on #4: "Fall back to the main thread only when `Worker` is unavailable (feature
  detection). Worker runtime errors propagate (fail fast)."

# E3 deviations: cap buffers released, ribbon length checked, named region error

Conductor decision 46 on #4. Pinned by `solid-sections.test.ts`, and `solid-assets.test.ts`; the parity test uses only valid inputs.

## 1. `presentSection` disposes the attribute buffers it replaces

- **Legacy**: when a cut outgrew the cap geometry it called `setAttribute` with new `position` and
  `normal` attributes and dropped the old ones, whose GPU buffers stayed allocated.
- **New**: the old attributes are disposed first. Output is unchanged.
- **Standard**: three.js disposal practice ("How to dispose of objects", three.js manual): GPU
  resources are freed only by calling `dispose()`.

## 2. `loadRibbonSources` checks the published byte length

- **Legacy**: a short or long file was read as is; a short one failed only indirectly in
  `buildRibbonWedges`.
- **New**: the file must hold 2 bytes per vertex of both hemispheres, else it throws a named error.
- **Standard**: CLAUDE.md, "validate inputs at boundaries".

## 3. `exposedWhiteMatter` names an unknown region id

- **Legacy**: `regions.get(id).kind` threw an opaque `TypeError`.
- **New**: throws `Hidden region <id> is not in the region index.`
- **Standard**: CLAUDE.md, "fail fast".

## Note: `earcut.js` is prettier-formatted

The vendored 2.2.4 file is reformatted (whitespace only) so `prettier --check .` passes; the parity test now compares triangulations and deviation on seeded polygons with holes instead of bytes.
