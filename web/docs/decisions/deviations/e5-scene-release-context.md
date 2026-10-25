# E5: disposing the scene releases its WebGL context

Chunk E5 (#29). A fix under the parity policy on #4.

- **Legacy** (`viewer/render/scene.js`): `dispose()` called `renderer.dispose()` and removed the
  canvas, but never released the context, which lived until garbage collection. Mounting the
  viewer again (route changes, hot reload, end-to-end tests) can exhaust the browser's cap on live
  contexts (about 16 in Chrome), which drops the oldest with a console warning.
- **New** (`engine/render/scene.ts`): `dispose()` calls `renderer.forceContextLoss()` after
  `renderer.dispose()`. The `webglcontextlost` listener is removed first, so `onContextLost` does
  not fire for a deliberate teardown.
- **Standard**: three.js guidance to call `forceContextLoss()` after `dispose()` when discarding a
  renderer; WebGL 1.0 spec, `WEBGL_lose_context` extension (the same release `detectIntegratedGpu`
  does for its probe, see `e1-render-primitives.md`).
