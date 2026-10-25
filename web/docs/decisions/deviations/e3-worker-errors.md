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
  carrying the `ErrorEvent` as its `cause`, and every later `build()` returns a promise rejected
  with the same error (it does not throw synchronously).
- **Standard**: project rule "fail fast, no silent fallbacks" (CLAUDE.md), and the decision
  recorded as #26 on #4: "Fall back to the main thread only when `Worker` is unavailable (feature
  detection). Worker runtime errors propagate (fail fast)."
