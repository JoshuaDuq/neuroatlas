# E7 deviation: a failed outline warm-up is not swallowed

Chunk E7 (#31). A fix under the parity policy (CLAUDE.md: fail fast, no silent fallbacks).

- **Legacy** (`viewer/app.js:2122-2123`): `try { scene.warmOutlines(model.group); } catch (error)
{ console.error(error); }` before the stage reports ready. A warm-up that cannot compile the outline
  programs was logged and the app started anyway, so the first hover compiled them (or failed) in the
  frame the pointer arrived.
- **New** (`engine/index.ts`): `scene.warmOutlines(atlas.group)` is called directly. A failure rejects
  `createEngine`, the same way a failed model load does, and the application's start-up error path
  reports it.
- **Standard**: project rule "fail fast; no broad exception swallowing" (CLAUDE.md). The outline is
  the selection's only mark on a surface, so a stage that cannot draw it is not ready.
- **Test**: `src/lib/engine/index.test.ts`, "rejects when the outline programs cannot be compiled, freeing the scene and the model"; the contract boot (`index.svelte.test.ts`) covers the success path.
