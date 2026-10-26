# E1 deviations from the legacy render primitives

Chunk E1 (#24). Each entry is a fix under the parity policy on #4 ("do not port bugs"). The
parity test (`web/parity/E1.test.ts`) excludes these inputs; fixes 1-4 are pinned by tests in
`camera-views.test.ts`, `coordinates.test.ts`, `outline-edges.test.ts` and `device.test.ts`.

## 1. `detectIntegratedGpu` no longer swallows errors and releases its probe context

- **Legacy** (`viewer/render/device.js`): `catch { return true; }` around the probe, so any failure
  was reported as "integrated GPU". The throwaway WebGL context was never released, and
  `qualityProfile` creates one on every call that lacks `input.integrated`.
- **New** (`engine/render/device.ts`): no `try`/`catch`; the context is lost with
  `WEBGL_lose_context` once the renderer name is read. A missing `document` still returns `false`,
  and a missing renderer name still counts as integrated (both unchanged).
- **Standard**: project rule "fail fast, no silent fallbacks" (CLAUDE.md); WebGL practice of
  releasing contexts you create, since browsers cap live contexts (WebGL 1.0 spec,
  `WEBGL_lose_context` extension).

## 2. `paintOutlineEdges` restores the stencil test when it throws

- **Legacy** (`viewer/render/outline-edges.js`): the stencil test is switched off for the
  downsample and blur passes and switched back on only on the success path. An exception in
  between left it off for the rest of the frame, while colour and `autoClear` were restored.
- **New** (`engine/render/outline-edges.ts`): the `finally` block turns it back on if it is still
  off. The call sequence on the success path is unchanged.
- **Standard**: exception safety, i.e. the ECMAScript `try...finally` cleanup idiom. Legacy's own
  `finally` already restores the clear colour and `autoClear`; the stencil test was the one piece
  of renderer state it left out.

## 3. `fitDistance` refuses an empty point list

- **Legacy** (`viewer/render/camera-views.js`): an empty `Float32Array` is truthy, so the loop
  ran zero times and `fitDistance` returned `0`. `frameBounds` then placed the camera on its
  target and `lookAt` was degenerate.
- **New** (`engine/render/camera-views.ts`): `RangeError('Fitting to an empty point list.')`.
  `null` still means "fit the box corners".
- **Standard**: "fail fast" (CLAUDE.md); validating inputs at boundaries.

## 4. `createFrame` accepts only its own section planes

- **Legacy** (`viewer/slices/coordinates.js`): `BASES[mode]` looked the mode up on a plain object,
  so `'constructor'`, `'toString'` and similar passed the unknown-plane check and then threw
  `TypeError: basis.normal is not iterable`.
- **New** (`engine/slices/coordinates.ts`): `Object.hasOwn(BASES, mode)` guards the lookup, so
  they throw `Error('Unknown section plane: …')` like any other unknown name, instead of that
  `TypeError`.
- **Standard**: ECMAScript own-property lookup (`Object.hasOwn`, ES2022) for dictionary access
  with untrusted keys; restored links reach this boundary.

## 5. `zoomAboutSurface` names the failure when the zoom ray misses the level plane

- **Legacy** (`viewer/render/orbit-controls.js`): `ray.intersectPlane` returned `null`, which was
  passed on and threw `TypeError` at `point.clone()` inside `zoomAbout`.
- **New** (`engine/render/orbit-controls.ts`): an explicit
  `Error('The zoom ray never meets the level plane.')` at the point of failure.
- **Standard**: "fail fast" (CLAUDE.md): validate at the boundary and report the cause.

## Kept as in legacy, for the record

- `quality.ts` still does not read a `hardwareConcurrency` input; the legacy test passed one and
  nothing used it, so the field is dropped from the type and from the ported test.
- French edge letters (`D G S I P A`) now live in the `orientation` i18n namespace; `orientation.ts` reads them from there.
- `VIEW_DIRECTIONS` keeps sharing mutable `Vector3`s; consumers clone, as before.
- `outline-edges.ts` depends on private `OutlinePass` fields (`_oldClearColor`, `_fsQuad`); the
  exact-pinned `three` must be re-checked on any upgrade.
