# Engine E5 rules: scene, picking and comparison overlay

Scope: chunk E5 (#29). This covers the render scene and its loop, eased camera moves and the visible rectangle (`viewer/render/scene.js` → `web/src/lib/engine/render/scene.ts`), turning pointer events into hover, selection and focus (`viewer/render/picking.js` → `render/picking.ts`), and the atlas-comparison overlap outline (`viewer/comparison/overlay.js` → `comparison/overlay.ts`). The framing plans, held view and presentation that use the scene are in `engine-e7.md`. Named-view geometry, the visible-rectangle arithmetic and the camera path (`camera-views`, `effective-viewport`, `camera-path`) are in `engine-e1.md` (RENDER-01–RENDER-16). "Via contract suite" means a case of `src/lib/engine/fake/contract-suite.ts`, run on the real engine by `src/lib/engine/index.svelte.test.ts` and on the fake by `src/lib/engine/contract.test.ts`.

## Camera moves

### SCENE-01 · An eased camera move lasts 240 ms and lands exactly
- **Rule:** A framing that is not immediate eases the camera from where it is to the planned pose over 240 ms. It ends exactly on the plan, and the plan's orbit limits apply only on arrival, so a distant camera is not yanked by a tighter limit as it leaves.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/scene.js:20,24,304-336,345-379`
- **Expected:** `moveTo(plan)` at t0. At t0+120 ms the camera lies strictly between the start and the plan, and `controls.minDistance/maxDistance` are still the old ones. At t0+240 ms the position and target equal the plan (≤1e-12 m) and the limits equal the plan's. `scene.destination` returns the plan throughout.
- **Covered by:** `parity/E5.test.ts` (D)

### SCENE-02 · Immediate moves and reduced motion land at once
- **Rule:** A move asked for as immediate, and every move, inset slide or sheet settle while the reader prefers reduced motion, lands in one step with no intermediate frames.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/scene.js:41-42,317-324,493-500,516-519`
- **Expected:** With `matchMedia('(prefers-reduced-motion: reduce)').matches === true`, `moveTo(plan)` leaves the camera on the plan before the next frame. The same holds for `setFramingInset(…)` and `setChromeInsets(…, { settle: true })`, whose offsets are final on the next frame.
- **Covered by:** `parity/E5.test.ts` (D)

### SCENE-03 · A move beside a settling sheet rides the sheet's curve
- **Rule:** While the sheet settles on its own curve, a camera move or framing-inset slide started in that time uses the sheet's easing, so the picture and the sheet arrive together. Otherwise moves use a cubic ease-in-out.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/scene.js:24,26-39,333,494,521`
- **Expected:** The easing is `cubic-bezier(0.32, 0.72, 0, 1)` (the `--ease-sheet` token) over 240 ms beside a settle, and `t<0.5 ? 4t³ : 1-(-2t+2)³/2` otherwise. Sampled at 25/50/75 % of 240 ms, the progress matches the curve within 1e-6.
- **Covered by:** `parity/E5.test.ts` (D)

### SCENE-04 · Taking hold of the camera mid-move stops the move where it is drawn
- **Rule:** A pointer gesture that starts during an eased move cancels the move. The camera stays where it was drawn, roll included.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/scene.js:427-432`
- **Expected:** `moveTo(plan)`, then a frame at +100 ms, then `controls` `start`. Later frames do not move the camera towards the plan, and `camera.up` equals the drawn frame's up.
- **Covered by:** uncovered

## The visible rectangle

### SCENE-05 · The sheet covers the canvas without resizing it
- **Rule:** When the phone sheet covers part of the canvas, the visible rectangle shrinks and the frustum slides so the anatomy centres in what is visible. The canvas is not resized, and neither the camera nor the orbit target moves.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/scene.js:99-121,236-259,488-505`
- **Expected:** On a 1000×700 host, `setChromeInsets({ bottom: 200 })` gives `visibleRect.height === 500` while `hostSize` stays 1000×700. `camera.view` is enabled with the offset `viewOffset` gives, and `camera.position` and `controls.target` are unchanged.
- **Covered by:** `src/lib/engine/index.svelte.test.ts` (R, via contract suite: the rectangle shrinks and a `viewport` event carries the host size; could move down to unit with the fake renderer), `parity/E5.test.ts` (D). The unchanged canvas, camera and target: only D.

### SCENE-06 · Framing clears the dock and colour key without changing the visible rectangle
- **Rule:** A framing inset (the stage dock at the bottom, a colour key at the top or right) narrows the room framing may use, but not the visible rectangle that places those controls. It slides with the camera's move unless asked for at once, and it reports whether it changed.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/scene.js:110-121,507-533`
- **Expected:** `setFramingInset({ bottom: 80 })` returns `true`, the same call again returns `false`, `visibleRect` is unchanged, and `viewportFit.vertical` drops by 80 / host height. With `{ immediate: true }` the offset is final at once.
- **Covered by:** `parity/E5.test.ts` (D)

### SCENE-07 · A canvas resize refits; a sheet drag does not
- **Rule:** A change of the host's size is reported as a canvas change, which refits the framing. A sheet inset change is reported as not a canvas change, so a drag never fights the finger.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/scene.js:261-286,501-504`
- **Expected:** A ResizeObserver callback gives `onResize({ canvasChanged: true })`. `setChromeInsets(…)` gives `onResize({ canvasChanged: false })`. Setting the same insets again reports nothing.
- **Covered by:** `parity/E5.test.ts` (D); `src/lib/engine/framing.test.ts` (R, indirectly through resize)

## The render loop

### SCENE-08 · A moving camera draws at reduced resolution; the frame at rest is full resolution
- **Rule:** While the camera or an inset is moving, frames are drawn through a lower-resolution pipeline. A full-resolution frame is drawn once the camera has been at rest for 150 ms, and the loop then stops until something changes.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/scene.js:21-22,183-206,381-405`
- **Expected:** During a move the composer renders at the motion pixel ratio. 150 ms after the last motion one render at the settled ratio follows, then `setAnimationLoop(null)`. Any `invalidate()` restarts the loop.
- **Covered by:** `parity/E5.test.ts` (D)

## Outlines and theme

### SCENE-09 · Selection gets a two-tone outline, hover the halo alone
- **Rule:** An outlined selection is drawn with a light halo behind a dark core, which stays legible over every atlas colour. A hovered region gets the halo alone. Both outlines are off when nothing is outlined.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/scene.js:135-157,288-298`
- **Expected:** Halo `edgeThickness` 3 and core 1, both `edgeStrength` 6 and `edgeGlow` 0. `setOutlined({ selected:[a], hovered:[b] })` puts the halo on [a, b] and the core on [a]. `setOutlined()` turns both passes off.
- **Covered by:** `src/lib/engine/render/scene.test.ts` (R: thickness and off-at-start); the selected/hovered split is uncovered

### SCENE-10 · The theme sets background, outline colours and exposure, and exposure must be a number
- **Rule:** The scene takes its background, outline colours and exposure from the theme tokens. A missing or non-numeric exposure token is an error, not a silent exposure of 1.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/scene.js:217-227`; deviation `e5-scene-exposure-fail-fast.md`
- **Expected:** `--scene-exposure` of `''`, `'bright'` or `'1,2'` makes `applyTheme()` throw `/--scene-exposure/`. `'1.2'` gives `toneMappingExposure` 1.2. The halo, core and hidden edge colours equal `--scene-outline-halo`, `--scene-outline-core` and `--scene-outline-hidden`.
- **Covered by:** `src/lib/engine/render/scene.test.ts` (R, the three refusals; the `'1.2'` case asserts only that it does not throw, W: `toneMappingExposure` is not read); the colours are uncovered

### SCENE-11 · The scan on the surface is drawn without tone mapping
- **Rule:** While the MRI is shown on the surface, tone mapping is off and the MRI pixel ratio applies, so the scan's grey levels are not altered. Otherwise neutral tone mapping applies.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/scene.js:229-234,265`
- **Expected:** `setMriAppearance(true)` gives `NoToneMapping` and `quality.mriPixelRatio`. `false` gives `NeutralToneMapping` and `quality.pixelRatio`.
- **Covered by:** `src/lib/engine/index.test.ts` (I, spies that `setMriAppearance` is called with true and false); the tone mapping and pixel ratio it sets are uncovered

## Canvas and context

### SCENE-12 · The canvas is a focusable application
- **Rule:** The canvas is in the tab order and has role `application`, so its arrow keys reach the camera rather than a screen reader's browse mode. Its name is set by the facade (FACADE-31).
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/scene.js:70-76`; decision 28 on #4
- **Expected:** `canvas.tabIndex === 0` and `canvas.getAttribute('role') === 'application'`.
- **Covered by:** `src/lib/engine/index.svelte.test.ts` (R, role, in the snapshot case; could move down to unit); tabindex is uncovered

### SCENE-13 · A lost GPU context is reported and a restored one redrawn
- **Rule:** A context loss while the scene is alive is reported upward and prevented by default, so it can be restored. On restore, the lighting, theme and size are applied again.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/scene.js:407-421`
- **Expected:** `webglcontextlost` calls `onContextLost` once and the event's `defaultPrevented` is true. `webglcontextrestored` calls `onContextRestored` once after reapplying the theme and size.
- **Covered by:** `src/lib/engine/render/scene.test.ts` (R, loss reported once; `defaultPrevented` is not asserted); restore is uncovered

### SCENE-14 · Disposing the scene releases its context without reporting a loss
- **Rule:** Disposing frees the renderer and then releases the WebGL context, so remounting cannot exhaust the browser's context cap. That deliberate release is not reported as a loss.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/scene.js:570-586`; deviation `e5-scene-release-context.md`
- **Expected:** `dispose()` calls `renderer.dispose` and then `forceContextLoss`. A later `webglcontextlost` does not call `onContextLost`.
- **Covered by:** `src/lib/engine/render/scene.test.ts` (R)

## Picking

### SCENE-15 · Hover names the region under the pointer
- **Rule:** Moving a mouse or pen over the canvas names the region under it, with the pointer's position relative to the canvas. The cursor is `pointer` over a region and `grab` elsewhere.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/picking.js:89-108`
- **Expected:** `pointermove` at (120, 40) on a canvas at (0, 0), then one frame, gives `onHover(region, { x: 120, y: 40 })` and `cursor === 'pointer'`. With no region it gives `onHover(null, …)` and `cursor === 'grab'`.
- **Covered by:** `src/lib/engine/render/picking.test.ts` (R; the `pointer` cursor is asserted only in the camera-motion case), `parity/E5.test.ts` (D)

### SCENE-16 · Hover asks the anatomy at most once a frame, at the latest position
- **Rule:** However far the pointer travels between frames, hover casts one ray per frame, at the last position.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/picking.js:22-25,94-97`
- **Expected:** 20 `pointermove`s and then one frame give exactly one `pick`. Moves at x=20 then x=120 give a hover at x=120.
- **Covered by:** `src/lib/engine/render/picking.test.ts` (R)

### SCENE-17 · No hover for a finger, or while a button is held
- **Rule:** A touch pointer has no hover, and a move with a button down is an orbit that hover must not slow down.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/picking.js:90-93`
- **Expected:** `pointermove` with `pointerType: 'touch'`, or with `buttons: 1`, casts no ray.
- **Covered by:** `src/lib/engine/render/picking.test.ts` (R)

### SCENE-18 · A camera move clears the hover
- **Rule:** When the camera moves, a hover already shown is cleared once and a queued hover is cancelled. The cursor goes from `pointer` back to `grab` but stays `grabbing` during an active grab.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/picking.js:35-44,128`
- **Expected:** After a hover, two `change` events give exactly one `onHover(null, null)`. A move queued before a `change` casts no ray. `pointer` becomes `grab`, and `grabbing` is unchanged.
- **Covered by:** `src/lib/engine/render/picking.test.ts` (R)

### SCENE-19 · Leaving the canvas, or a cancelled pointer, clears hover and press
- **Rule:** When the pointer leaves the canvas or is cancelled, the hover name goes away and any pending press is dropped.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/picking.js:110-113,124-125`
- **Expected:** After a hover, `pointerleave` gives `onHover(null, null)`. `pointerdown`, `pointercancel` and then `pointerup` at the same spot select nothing.
- **Covered by:** `src/lib/engine/render/picking.test.ts` (R, leave); the cancel case is uncovered

### SCENE-20 · A click selects the region under it; a drag does not
- **Rule:** A primary-button press released within the tap slop selects the region under the release. The slop is under 5 px for a mouse or pen and under 12 px for a finger (near the platform's hit-slop).
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/picking.js:3-14,70-87`
- **Expected:** Touch drift of 11 px selects and 12 px does not. Mouse drift of 4 px selects and 5 px does not. A non-zero button never selects.
- **Covered by:** `src/lib/engine/render/picking.test.ts` (R), `parity/E5.test.ts` (D)

### SCENE-21 · A click on the empty stage keeps the selection
- **Rule:** A click that hits no region does not clear the selection; Escape is the deliberate clear.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/picking.js:82-86`
- **Expected:** A click with `pick` returning null calls no `onSelect`.
- **Covered by:** `src/lib/engine/render/picking.test.ts` (R)

### SCENE-22 · A second pointer cancels the tap
- **Rule:** A pinch or two-finger drag never ends as a selection, whichever finger lifts first.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/picking.js:70-75`; deviation `e5-picker-primary-pointer.md`
- **Expected:** Finger 1 down, finger 2 down (non-primary), then both up in either order within slop selects nothing.
- **Covered by:** `src/lib/engine/render/picking.test.ts` (R)

### SCENE-23 · Double-click focuses the surface point under the pointer
- **Rule:** A double-click on the surface moves the camera's focus onto the 3D point it hit. A double-click on empty stage does nothing.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/picking.js:115-120`
- **Expected:** With `intersect` returning `{ point: p }`, `dblclick` calls `onFocusPoint(p)` once. With `intersect` returning null, it is not called.
- **Covered by:** `src/lib/engine/render/picking.test.ts` (R, hit); the miss case is uncovered

### SCENE-24 · The pick ray goes through the pointer
- **Rule:** The ray used for hover, click and double-click passes through the pointer's position on the canvas, so the named or selected region is the one under the pointer. A canvas with no size picks nothing.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/picking.js:46-68`
- **Expected:** For a canvas at (left 10, top 5) of 200×100 and a pointer at client (110, 55), the ray equals `Raycaster.setFromCamera((0, 0), camera)` (direction ≤1e-12). Client (10, 5) maps to NDC (-1, 1). With a 0×0 rect, `pick` is never called and nothing is hovered or selected.
- **Covered by:** `parity/E5.test.ts` (D)

### SCENE-25 · Nothing is picked while the tract reference is shown alone
- **Rule:** While the tract reference of another anatomy is shown in place of the atlas, hover and click name and select nothing.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1802`; `web/src/lib/engine/index.ts:165-178`
- **Expected:** With the reference active, a hover or click over the canvas calls neither `hover` nor `select`.
- **Covered by:** uncovered

## Comparison overlay

### SCENE-26 · Highlighting an overlap outlines exactly that overlap, without painting
- **Rule:** Highlighting an overlap outlines only that pair's intersection mesh, and the others stay hidden. The overlap draws no colour and no depth, so atlas colours and depth are unchanged. It is never pickable, and its source geometry is not altered.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/comparison/overlay.js:16-40,42-87`
- **Expected:** After `highlight('pair-a')`, `outlined` is the single mesh whose `overlap_id` is `'pair-a'`. Its material has `colorWrite === false`, `depthWrite === false` and `side === DoubleSide`. The other meshes have `visible === false`, and the position arrays are byte-equal to the file's.
- **Covered by:** `src/lib/engine/comparison/overlay.test.ts` (R; `DoubleSide` and "never pickable" are not asserted), `parity/E5.test.ts` (D)

### SCENE-27 · The overlap geometry is loaded once
- **Rule:** The overlap file is fetched on the first highlight and reused for every later one.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/comparison/overlay.js:58-71`
- **Expected:** `highlight('pair-a')` and then `highlight('pair-b')` load the file once, and `outlined` is `['pair-b']`.
- **Covered by:** `src/lib/engine/comparison/overlay.test.ts` (R)

### SCENE-28 · A later highlight overtakes an earlier one, and clearing cancels a pending one
- **Rule:** When two highlights are in flight, only the later one is shown. A clear while one is loading cancels it.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/comparison/overlay.js:52-56,78-87`
- **Expected:** `highlight(a)` and `highlight(b)` resolve `[false, true]` and the outline is b. `highlight(a)` then `clear()` resolves `false` with no outline.
- **Covered by:** `src/lib/engine/comparison/overlay.test.ts` (R, clear); `src/lib/engine/index.svelte.test.ts` (R, via contract suite: supersede on the real engine, parsing the 16 MB `atlas-overlaps.glb`); `src/lib/engine/contract.test.ts` (W, fake: supersede); `parity/E5.test.ts` (D)

### SCENE-29 · A hidden overlay outlines nothing until shown again
- **Rule:** Hiding the comparison (for example when a cut opens) removes its outline. Showing it again restores the same overlap.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/comparison/overlay.js:75-77,89`
- **Expected:** After `setVisible(false)`, `outlined` is `[]`. After `setVisible(true)`, it is the highlighted mesh again.
- **Covered by:** `src/lib/engine/comparison/overlay.test.ts` (R), `src/lib/engine/index.test.ts` (R)

### SCENE-30 · Bad overlap data is an error, and the bad file is released
- **Rule:** An unknown overlap id is an error. A file with a missing or duplicate overlap identity, or with no overlap meshes, is rejected and its geometry and materials are released.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/comparison/overlay.js:16-27,60-64,83`
- **Expected:** `highlight('absent')` rejects `/Unknown overlap/`. A duplicate `overlap_id` rejects `/duplicate/i` and disposes every material. An empty group rejects `/no overlap meshes/`.
- **Covered by:** `src/lib/engine/comparison/overlay.test.ts` (R, unknown and duplicate); the empty file is uncovered

### SCENE-31 · A failed load is retried on the next highlight
- **Rule:** A failed overlap download is not cached. The next explicit highlight tries again.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/comparison/overlay.js:65-68`
- **Expected:** First load throws E, so `highlight` rejects with E. The second `highlight` loads again (2 attempts) and outlines the pair.
- **Covered by:** `src/lib/engine/comparison/overlay.test.ts` (R)

### SCENE-32 · Disposal releases everything, including geometry that arrives later
- **Rule:** After disposal no overlap is outlined. Geometry that arrives later is released at once, and a new highlight is refused.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/comparison/overlay.js:61,79,90-95`
- **Expected:** `highlight` then `dispose` before the load resolves: `highlight` resolves `false`, every geometry is disposed and `outlined` is `[]`. `highlight` after `dispose` rejects `/disposed/`.
- **Covered by:** `src/lib/engine/comparison/overlay.test.ts` (R, late arrival); `parity/E5.test.ts` (D, after-dispose refusal)

## Framing plans

### SCENE-33 · Planning a framing moves nothing on screen
- **Rule:** Working out where a framing will put the camera leaves the drawn camera and the orbit controls exactly as they were: position, rotation, target, clipping planes and orbit limits. Only the returned plan carries the new pose, which the move then eases to.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/scene.js:597-630`
- **Expected:** Camera at (0.2, 0.1, 0.3), minDistance 0.02, maxDistance 4, bounds (−0.07, −0.1, −0.06)..(0.07, 0.1, 0.08), direction (1, 0, 0), fit {1, 0.45}: the plan's target is the bounds centre and its position differs from the camera's; afterwards the camera position, quaternion, near, far, the controls' target and both limits are unchanged.
- **Covered by:** `src/lib/engine/render/scene.test.ts` (R), `parity/E5.test.ts` (D)
