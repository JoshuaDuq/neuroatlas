# Engine E1 rules: render primitives

Scope: chunk E1 (#24), the render primitives that sit under the scene. Legacy sources:
`viewer/render/camera-views.js`, `camera-path.js`, `effective-viewport.js`, `orbit-controls.js`,
`keyboard-orbit.js`, `orientation.js`, `scale-bar.js`, `quality.js`, `device.js`, `outline-edges.js`,
`outline-occluders.js`, `border-feather.js` (geometry half; its shader patch is SHADER-32), and
`viewer/slices/coordinates.js`. Deviations: `e1-render-primitives.md` (fixes 1-5). The section-coordinate rules RENDER-38–RENDER-42 are restated in `engine-e4a.md` as SLICE-01–SLICE-05; this file owns them, so test each once. World space is in
metres with x = right, y = superior, z = posterior; source RAS is in millimetres. Tests named
below are relative to `web/`. `parity/E1.test.ts` was deleted once each rule had its own rule test.

## Camera views

### RENDER-01 · Named views look from fixed anatomical directions

- **Rule:** Each named view puts the camera on a fixed side of the subject. The direction is the unit vector from subject to camera.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/camera-views.js:8-16`
- **Expected:** left (-1, 0, 0); right (1, 0, 0); anterior (0, 0, -1); posterior (0, 0, 1); superior (0, 1, 0); inferior (0, -1, 0); oblique = normalize(-1, 0.3, -0.45) ≈ (-0.8796, 0.2639, -0.3958) ± 1e-4, so the opening view shows the left hemisphere from slightly above and in front.
- **Covered by:** `src/lib/engine/render/camera-views.test.ts` (R)

### RENDER-02 · Polar views keep a readable up

- **Rule:** Looking straight down or up, the screen's up is anterior (superior view) or posterior (inferior view); every other view keeps superior up.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/camera-views.js:19-23`
- **Expected:** upFor(superior) = (0, 0, -1); upFor(inferior) = (0, 0, 1); any other view → (0, 1, 0).
- **Covered by:** `src/lib/engine/render/camera-views.test.ts` (R)

### RENDER-03 · A cut is faced from the side it keeps

- **Rule:** Turning on a cut faces the camera onto the cut surface; the reverse flag flips which side is faced.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/camera-views.js:25-33`
- **Expected:** sagittal → right / left (reverse); coronal → anterior / posterior; axial → superior / inferior; oblique → oblique (either way); off or an unknown mode → null.
- **Covered by:** `src/lib/engine/render/camera-views.test.ts` (R)

### RENDER-04 · A restored link faces its cut unless it names a view

- **Rule:** A link that carries a cut but no view opens facing the cut. A link that names a view keeps that view.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/camera-views.js:36-38`
- **Expected:** {cut: axial} → superior; {cut: coronal, reverse} → posterior; {cut: axial, view: left} → null (keep left); {view: left} → null; {} → null.
- **Covered by:** `src/lib/engine/render/camera-views.test.ts` (R)

### RENDER-05 · Clipping planes and zoom limits follow what is framed

- **Rule:** Near/far planes and orbit distance limits come from the framed bounds every time, so focusing a small structure lets the camera come close, and returning to the whole brain restores the limits. Elongated structures take their closest approach from their thinnest span.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/camera-views.js:50-60`
- **Expected:** With r = bounding-sphere radius and s = smallest box side: near = 0.01 r, far = 100 r (far/near = 10 000 exactly), minDistance = min(0.25 r, max(0.5 s, 0.005 m)), maxDistance = 25 r. Brain box (-0.08,-0.07,-0.1)..(0.08,0.11,0.1): r ≈ 0.1565 m, near ≈ 1.565 mm, minDistance ≈ 39.1 mm, maxDistance ≈ 3.91 m (≥ 2 m). Cord box 12 × 500 × 20 mm: minDistance = 6 mm (≤ 15 mm).
- **Covered by:** `src/lib/engine/render/camera-views.test.ts` (R)

### RENDER-06 · Framed anatomy spans four fifths of the stage

- **Rule:** Framing places the camera so the anatomy's silhouette spans FRAME_FILL = 0.8 of the visible stage on its tighter axis. Fitting to the vertex silhouette never crops what fitting to the bounding box kept, and stands closer than the box when the box's corners are empty.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/camera-views.js:63, 103-146`
- **Expected:** After frameBounds with a point cloud, max |NDC x|, |NDC y| over the cloud = 0.8 ± 1e-3 for every named view. Box corners all project within ±0.8 (+1e-9) for aspect 1.7 and 0.6. Silhouette distance ≤ box distance (+1e-9). An inscribed ellipsoid on the oblique view frames at < 0.95 × the box distance. Given the box corners as points, both fits agree to within 1e-6 relative.
- **Covered by:** `src/lib/engine/render/camera-views.test.ts` (R)

### RENDER-07 · Framing fits the part of the canvas the reader can see

- **Rule:** When chrome covers part of the canvas (a phone sheet), framing narrows the frustum slopes by the visible fraction per axis, so the anatomy fits the uncovered rectangle.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/camera-views.js:93-116`; `viewer/render/effective-viewport.js:64-71`
- **Expected:** With fit {vertical: v, horizontal: h}, the framed silhouette spans 0.8·v of the full canvas height or 0.8·h of its width, whichever binds. E.g. a sheet covering half the height (v = 0.5) puts the anatomy within ±0.4 NDC vertically. Fit {} behaves as v = h = 1.
- **Covered by:** `src/lib/engine/framing.test.ts` (R), `src/lib/engine/render/scene.test.ts` (R), `src/lib/engine/render/camera-views.test.ts` (R)

### RENDER-08 · A small landmark is framed with its neighbourhood

- **Rule:** Bounds whose bounding sphere is smaller than 50 mm in radius are grown by the same margin on every side until the radius is 50 mm, so a small structure is shown in context. Larger bounds are left unchanged.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/camera-views.js:66-78`
- **Expected:** A chiasm box of 38 × 28 × 32 mm grows to a sphere radius of 0.05 m ± 1e-9 around the same centre, with equal growth on x, y and z (±1e-12). The brain box is returned unchanged.
- **Covered by:** `src/lib/engine/render/camera-views.test.ts` (R)

### RENDER-09 · Fitting to an empty point list is refused

- **Rule:** Framing an empty silhouette is an error, not a zero distance that would put the camera on its target. `null` still means "fit the box corners".
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/camera-views.js:117-126`; deviation `e1-render-primitives.md` #3
- **Expected:** fitDistance(…, new Float32Array()) throws RangeError "Fitting to an empty point list.".
- **Covered by:** `src/lib/engine/render/camera-views.test.ts` (R)

### RENDER-10 · Planning a framing announces nothing

- **Rule:** Planning a framing sets the camera limits, the destination pose and the orbit target, but sends no 'change' event. The orientation letters listen for that event and would otherwise show the destination's letters over the picture being left.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/camera-views.js:148-163`
- **Expected:** frameTo fires 0 'change' events; afterwards controls.target = bounds centre, and (camera − centre) normalised equals the view direction to within 1e-9; near/far/min/max follow RENDER-05.
- **Covered by:** `src/lib/engine/render/camera-views.test.ts` (R)

### RENDER-11 · A view along the up axis still frames

- **Rule:** When the view direction is parallel to the camera's up (an orbit onto a pole), framing still gives a finite distance and pose.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/camera-views.js:85-91`
- **Expected:** Direction (0, 1, 0) with up (0, 1, 0), and direction (0, 0, 1) with up (0, 0, 1): fitDistance is finite and > 0, and the camera position contains no NaN.
- **Covered by:** `src/lib/engine/render/camera-views.test.ts` (R)

## Camera path

### RENDER-12 · Animated view changes orbit round the anatomy

- **Rule:** An animated move turns the camera by the shortest rotation between its start and end orientations, interpolating the distance and the target, so the camera swings round the anatomy instead of cutting through it and its roll turns with it. The move ends exactly on the pose an immediate move gives.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/camera-path.js:7-40`
- **Expected:** path(0) = the drawn pose (position within 1e-12, quaternion within 1e-9 rad). path(t ≥ 1) equals the destination bit for bit: position, quaternion, up and target are the same as an immediate move. Left → right: distance to target is constant (0.42 m ± 1e-9) and height is level (±1e-9) at every step. Anterior → superior: at t = 0.03 up·(0,1,0) > 0.99, and up turns by < π/10 per 1/20 step. At t = 0.5 the target is the midpoint and the distance is the mean of start and end. The path keeps its own copy of the start pose, so moving the camera along it does not move the start.
- **Covered by:** `src/lib/engine/render/camera-path.test.ts` (R)

## Effective viewport

### RENDER-13 · The visible rectangle is the canvas minus the chrome

- **Rule:** The visible part of the canvas is the canvas inset by the chrome on each side. Insets that would cover the canvas are scaled down in proportion so that a tenth of each axis stays visible. Negative insets count as zero.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/effective-viewport.js:18-56`
- **Expected:** On a 400 × 800 canvas: no insets → {0, 0, 400, 800}; bottom 300 → {0, 0, 400, 500}; left 160 → {160, 0, 240, 800}; top 52 + bottom 148 → {0, 52, 400, 600}; bottom 900 → height 80, y 0; top 400 + bottom 1200 → y ≈ 180, height 80; bottom −50 → full canvas. A 0 × 0 or missing canvas → {0, 0, 0, 0}.
- **Covered by:** `src/lib/engine/render/effective-viewport.test.ts` (R)

### RENDER-14 · Fit scale is the visible fraction of each axis

- **Rule:** The share of each axis left visible, capped at 1, is what RENDER-07 narrows the framing by.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/effective-viewport.js:64-71`
- **Expected:** 400 × 800 with bottom 400 → {horizontal 1, vertical 0.5}; uncovered → {1, 1}; degenerate canvas → {1, 1}.
- **Covered by:** `src/lib/engine/render/effective-viewport.test.ts` (R)

### RENDER-15 · The image is centred in the visible rectangle by shifting the frustum

- **Rule:** When the visible rectangle is off-centre, the projection is shifted so the model sits in the middle of what the reader sees. The camera is not moved, and the frustum keeps its size.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/effective-viewport.js:86-102`
- **Expected:** 400 × 800 with bottom 300 → offsetY 150, offsetX 0, fullHeight 800, height 800. Left 160 → offsetX −80, offsetY 0. A centred rectangle (within 0.5 px), or a degenerate canvas → null. The offsets are never −0.
- **Covered by:** `src/lib/engine/render/effective-viewport.test.ts` (R)

### RENDER-16 · Framing keeps the anatomy off the orientation letters and the scale bar

- **Rule:** The framed band of anatomy lies between the top marking and the dock plus bottom marking, and inside the side markings. A stage too short for its markings still frames a sliver of anatomy.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/effective-viewport.js:112-126`
- **Expected:** Phone 390 × 329, dock 66, clear {top 60, bottom 32, left/right 28}, fill 0.8: band top = 60 ± 1e-9 and band bottom = 329 − 66 − 32 ± 1e-9; horizontal scale 1. Desktop 1120 × 824, dock 54: band height = 0.8 × (824 − 54) ± 1e-9; horizontal 1. Nothing to clear → inset = dock (60) and scale {1, 1}. A stage 390 × 90 → a finite vertical scale > 0 and inset ≥ 0.
- **Covered by:** `src/lib/engine/render/effective-viewport.test.ts` (R)

## Orbit controls

### RENDER-17 · Every view orbits about its own screen axes

- **Rule:** The superior and inferior views (whose up is not +y) respond to sideways and vertical drags in both directions. A sideways drag from above rolls the brain about its anterior–posterior axis. Views with a superior up orbit exactly as the stock controls do.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/orbit-controls.js:22-35`
- **Expected:** From superior or inferior, rotateLeft(±0.3) and rotateUp(±0.3) each move the camera > 0.1 m and keep its distance to within 1e-9. From superior, rotateLeft(π/2) gives |offset.x| = 1 ± 1e-6 with up still (0, 0, −1). Oblique, left and anterior give positions bit-identical to the stock controls.
- **Covered by:** `src/lib/engine/render/orbit-controls.test.ts` (R)

### RENDER-18 · Zoom closes on the surface under the pointer and never passes it

- **Rule:** Zooming scales the camera and the target together about the first surface point under the pointer (or the centre of the view for a zoom key), so that point stays still on screen and the camera approaches the surface without crossing it. Over empty stage, zoom scales the distance to the target. The distance always stays within the orbit limits.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/orbit-controls.js:37-84`
- **Expected:** 200 pointer zooms at ×0.8: the gap to the surface stays > 0, never grows, and ends with distance = minDistance ± 1e-9. The point under the pointer reprojects to the same NDC (±1e-9). Zoom keys keep the heading (±1e-9) and stop outside the surface. Empty stage: ×1/1.1 gives distance 0.42/1.1, ×1.1 returns to 0.42 (±1e-9), with the target unchanged. zoomAbout clamps to [min, max] (0.2 and 4 ± 1e-12).
- **Covered by:** `src/lib/engine/render/orbit-controls.test.ts` (R)

### RENDER-19 · A zoom ray that misses the level plane is a named error

- **Rule:** If neither a surface nor the plane level with the target is under the zoom ray, zooming fails with a named error rather than a TypeError deep inside.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/orbit-controls.js:74`; deviation `e1-render-primitives.md` #5
- **Expected:** Error "The zoom ray never meets the level plane."
- **Covered by:** uncovered

### RENDER-20 · Turning or panning close in never carries the camera into tissue

- **Rule:** A turn or pan that would bring the camera within minDistance/4 of a surface, along its path or its line of sight, is refused, and the camera backs away from the target instead. Once moves are free again, the camera returns to the distance the reader last chose by zooming. Moves that stay clear, moves that leave a structure, and framing jumps are not touched.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/orbit-controls.js:86-156`
- **Expected:** Close in (target 20 mm under the surface, camera 30 mm outside), rotateLeft(1.2): the camera backs away along its line to the target (y, z = 0 ± 1e-12) with orientation unchanged (±1e-9). Skimming a 30 mm sphere: gap ≥ minDistance/4 (6.25 mm). Turning away and back returns to the start (±1e-9). A pan of 40 mm toward the surface backs away and leaves the target in place. A clear turn, or one that leaves a structure, gives the same position as the stock controls. A framing jump through the surface stays where it was put (±1e-12). Zooming in with both adapters still reaches minDistance, with the gap at 0.2 × minDistance.
- **Covered by:** `src/lib/engine/render/orbit-controls.test.ts` (R)

## Keyboard orbit

### RENDER-21 · Arrow keys turn the model five degrees, like a drag

- **Rule:** Each arrow press turns the orbit by ORBIT_STEP = π/36 (5°) at once, without damping, in the direction a drag would. Damping stays on for pointer drags. Holding a key never flips the horizon over a pole, and the distance to the target is kept.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/keyboard-orbit.js:13-24, 30-40`
- **Expected:** One press sweeps 0.08727 rad ± 1e-9 and keeps the distance (±1e-9). enableDamping is still true afterwards. ArrowLeft and ArrowRight move to opposite sides. ArrowUp equals a drag of rotateUp(−π/36) (±1e-12) and moves the camera below (y < 0); ArrowDown moves it above. 200 presses stay on the same side of the pole. From the superior view, ArrowLeft moves the camera > 10 mm.
- **Covered by:** `src/lib/engine/render/keyboard-orbit.test.ts` (R)

### RENDER-22 · Zoom keys step by the wheel's proportion

- **Rule:** `+` and `=` (one key on most layouts) zoom in, and `-` zooms out, by a factor of 1.1 per press. Only the four arrows and these three keys are bound.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/keyboard-orbit.js:16, 27`
- **Expected:** DOLLY_KEYS = {'+': 1/1.1, '=': 1/1.1, '-': 1.1}; ORBIT_KEYS keys = ArrowDown/Left/Right/Up.
- **Covered by:** `src/lib/engine/render/keyboard-orbit.test.ts` (R)

## Orientation markers

### RENDER-23 · Edge letters name the anatomical direction toward each edge

- **Rule:** Each viewport edge is labelled with the anatomical direction most aligned with the camera's screen axis toward it. The letters are worked out from the camera itself, so a freely orbited view stays correct. Opposite edges always carry opposite letters. Given the orbit target, the letters are those of the pose about to be drawn, including inside the controls' own 'change' event.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/orientation.js:15-61, 72-76`
- **Expected:** {right, left, top, bottom}: left view P A S I; right A P S I; anterior L R S I; posterior R L S I; superior R L A P; inferior R L P A. Oblique: top = S, four distinct letters. Moving to anterior inside 'change' gives L R S I. With target (0,0,0), a left-view camera turned toward anterior still reads P A S I.
- **Covered by:** `src/lib/engine/render/orientation.test.ts` (R)

### RENDER-24 · Edge letters are translated without asking the camera again

- **Rule:** French readers see D (droite) for R and G (gauche) for L; S, I, A and P are unchanged. Any other language is English.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/orientation.js:63-69`
- **Expected:** Anterior in fr → {right G, left D, top S, bottom I}; superior in fr with a target → D G A P; en → unchanged.
- **Covered by:** `src/lib/engine/render/orientation.test.ts` (R)

## Scale bar

### RENDER-25 · The scale bar is a true 1-2-5 measurement

- **Rule:** The bar shows a length in anatomical millimetres at the target distance. The length is the largest value in the 1-2-5 sequence from 0.1 mm to 1000 mm whose bar is 60 to 150 px long.
- **Kind:** scientific/data
- **Level:** unit
- **Source:** `viewer/render/scale-bar.js:9-41`
- **Expected:** mm/px = 2·d·tan(fov/2)·1000 / height. 35°, 0.5 m, 800 px → 0.3941 mm/px, bar 50 mm at ≈ 126.9 px. 35°, 0.15 m, 800 px → 10 mm. pixels × mm/px = mm (±1e-9). For every distance 0.03..1.5 m and height 400/800/1600 px, the bar is 60..150 px and a 1-2-5 value.
- **Covered by:** `src/lib/engine/render/scale-bar.test.ts` (R)

### RENDER-26 · No scale bar without a measurable viewport

- **Rule:** A hidden or background tab (zero height) or a non-positive or non-finite distance shows no bar, rather than a false length.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/scale-bar.js:29-33`
- **Expected:** height 0 or NaN, distance 0, NaN or −1 → null.
- **Covered by:** `src/lib/engine/render/scale-bar.test.ts` (R)

## Quality and device

### RENDER-27 · Presentation quality scales with the device; the anatomy never does

- **Rule:** Pixel ratio, MSAA and prefetching of the other atlas scale with the device. Meshes, labels and coordinates are the same on every device.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/quality.js:10-35`
- **Expected:** Cap: phone 1; handheld (coarse pointer) or an integrated GPU that is not Apple silicon 1.5; otherwise 2. pixelRatio = min(device ratio, cap). mriPixelRatio = device ratio (the MRI keeps native pixels; integrated + ratio 2 → pixelRatio 1.5, mriPixelRatio 2). motionPixelRatio = min(pixelRatio, 1). Fill-bound = handheld or Save-Data or deviceMemory ≤ 4 GB or integrated GPU → MSAA 2 and no prefetch; otherwise MSAA 4 and prefetch. Apple silicon Mac at ratio 2 → 2 with MSAA 2; iPad (coarse + Apple) → 1.5.
- **Covered by:** `src/lib/engine/render/quality.test.ts` (R)

### RENDER-28 · A moving picture keeps to a pixel budget

- **Rule:** While the camera moves, the pixel ratio is lowered so that a frame fills at most 2 000 000 device pixels, rounded to 0.01 and never above the cap.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/quality.js:38-44`
- **Expected:** motionRatio(1, 1120, 824) = 1; (2, 1120, 824) = 1.47; (1, 2240, 1392) = 0.8; a 0 × 0 canvas → the cap.
- **Covered by:** `src/lib/engine/render/quality.test.ts` (R)

### RENDER-29 · Phone layout and phone rendering budget are separate questions

- **Rule:** The compact shell applies at width ≤ 800 px, or height ≤ 480 px in landscape. The phone rendering budget applies only at width ≤ 640 px, or height ≤ 480 px in landscape. Tablets and narrow desktop windows get the compact layout without the phone's lower pixel ratio.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/device.js:13-21, 79-83`
- **Expected:** At device ratio 2: 390×844 → compact, phone, cap 1 (also 1 when integrated); 681×900 and 800×900 → compact, not phone, cap 2 (1.5 integrated); 821×900, 1000×900 → not compact, cap 2; 844×390 → compact, phone, cap 1.
- **Covered by:** `src/lib/engine/render/device.test.ts` (R, through a hand-written `matchMedia` fake that parses `max-width`; the real media-query strings are not evaluated)

### RENDER-30 · Only named discrete GPUs count as discrete

- **Rule:** A GPU counts as discrete only when its name is NVIDIA/GeForce/Quadro/RTX/GTX, Radeon RX/Pro, or Intel Arc. Everything else (Apple, Intel iGPU, plain "AMD Radeon Graphics", a withheld or empty name) is integrated. Apple silicon is recognised from the name.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/device.js:30-54`
- **Expected:** integrated: "Apple M4 Pro", ANGLE Apple M5, "Intel(R) UHD Graphics 770", "AMD Radeon Graphics", "". Discrete: "NVIDIA GeForce RTX 4090/PCIe/SSE2", ANGLE GTX 1080, "AMD Radeon RX 6800 XT", "AMD Radeon Pro 5500M OpenGL Engine", "Intel Arc A770". isAppleSilicon is true only for the two Apple names.
- **Covered by:** `src/lib/engine/render/device.test.ts` (R)

### RENDER-31 · The GPU probe releases its context and lets failures surface

- **Rule:** Probing the GPU name releases the throwaway WebGL context, and a failure to create it propagates instead of being reported as "integrated". Without a document (server-side or test), the GPU is not integrated.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/device.js:56-66`; deviation `e1-render-primitives.md` #1
- **Expected:** With a stub reporting "NVIDIA GeForce RTX 4090": returns false and calls loseContext once. A getContext that throws "no context" → the same error is thrown. No `document` → false.
- **Covered by:** `src/lib/engine/render/device.test.ts` (R)

## Outline helpers

### RENDER-32 · The outline depth pass draws only what can occlude the selection

- **Rule:** While the outline mask renders, meshes whose bounds cannot overlap the selection's projected box (padded by one pixel) are hidden, and every mesh is restored afterwards, even if rendering throws. A selection that crosses the near plane keeps the whole scene. A mesh with children is never hidden. Elongated meshes are rejected by their box even when their bounding sphere overlaps.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/outline-occluders.js:14-71`
- **Expected:** A selected box at the origin, a blocker in front, a box behind and a box 4 units beside it: during render the selected box, the blocker and the box behind are visible, and the box beside is hidden; after render it is visible again. On throw, the box beside is restored and an already-hidden mesh stays hidden. A touching neighbour stays visible. Camera at z = 0.55 → nothing is hidden. A parent with an overlapping child is not hidden. The box beside, scaled ×20 in y, is hidden.
- **Covered by:** `src/lib/engine/render/outline-occluders.test.ts` (R)

### RENDER-33 · The halo and the core reuse one mask when they outline the same meshes

- **Rule:** Two outline lists naming the same meshes, in any order, count as the same set, so the core reuses the halo's mask instead of drawing the scene again.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/outline-edges.js:10-16`
- **Expected:** [a,b]~[b,a], [a]~[a] and []~[] → true; [a]~[b], [a,b]~[a] and [a]~[] → false.
- **Covered by:** `src/lib/engine/render/outline-edges.test.ts` (R), `src/lib/engine/render/scene.test.ts` (I)

### RENDER-34 · Painting outline edges leaves the renderer as it found it

- **Rule:** Drawing outline edges from an existing mask gives the same edges as OutlinePass's own tail. The clear colour, clear alpha, autoClear and the stencil test are restored afterwards, also when a draw throws.
- **Kind:** behaviour
- **Level:** browser — the drawn edges equal OutlinePass's own only on real WebGL pixels; the state restore on throw is provable at unit
- **Source:** `viewer/render/outline-edges.js:27-104`; deviation `e1-render-primitives.md` #2
- **Expected:** With a mask active and a quad render that throws "GPU lost": the error propagates, stencil.setTest is called with [false, true], and autoClear is still true.
- **Covered by:** `src/lib/engine/render/outline-edges.test.ts` (R)

## Border feather

### RENDER-35 · Parcel borders fade over 1.5 mm of surface

- **Rule:** Along the cortex, a parcel's colour blends into its neighbour's over FEATHER_RADIUS = 1.5 mm of geodesic (edge-path) distance, which hides the zig-zag of borders cut at the ~0.8 mm vertex spacing. On a border vertex the parcels that meet share it evenly (n + 1 parcels: 1/(n + 1) each). The share of the neighbour falls linearly to 0 at the radius. A parcel that shares no vertex is not blended.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/border-feather.js:10-13, 20-68, 92-199`
- **Expected:** Two strips meeting at x = 0 with 1 mm spacing: border vertices → [neighbour slot, 0.5, 0, 0]; 1 mm in → weight (1 − 1/1.5)/2 = 1/6 ± 1e-6; ≥ 1.5 mm in → 0. Three parcels at one point → [other, 1/3, other, 1/3]. Disjoint strips → all zeros. Shared vertices are matched on exact float bits.
- **Covered by:** `src/lib/engine/render/border-feather.test.ts` (R), `parity/E2.test.ts` (D; also on the published destrieux and hcp-mmp cortex)

### RENDER-36 · Feathering refuses input it cannot feather

- **Rule:** Feathering needs indexed geometry, a positive radius, and at most three parcels meeting at a point.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/border-feather.js:64, 173-176`
- **Expected:** Unindexed mesh → Error "Feathering needs indexed geometry: <name>". Radius 0, −1 or NaN → RangeError. Four parcels sharing a point → Error "More than three parcels meet at one surface point."
- **Covered by:** `src/lib/engine/render/border-feather.test.ts` (R, unindexed only), `parity/E2.test.ts` (D, radius); the four-parcel error is uncovered

### RENDER-37 · A hidden parcel lends no colour to its neighbours

- **Rule:** The feather palette holds each parcel's current colour, in linear RGB, with alpha 1 when the parcel is shown and 0 when it is hidden. A neighbour therefore never blends toward a parcel the reader removed.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/border-feather.js:202-214`
- **Expected:** A shown parcel with colour (0.25, 0.5, 0.75) → texel [0.25, 0.5, 0.75, 1]; a hidden parcel → alpha 0.
- **Covered by:** `src/lib/engine/render/border-feather.test.ts` (R), `parity/E2.test.ts` (D)

## Section coordinates

### RENDER-38 · Source RAS millimetres map to world metres

- **Rule:** RAS (right, anterior, superior) in mm maps to world (x = R/1000, y = S/1000, z = −A/1000), and back.
- **Kind:** scientific/data
- **Level:** unit
- **Source:** `viewer/slices/coordinates.js:3-5`
- **Expected:** rasToWorld([21, 37, 49]) = (0.021, 0.049, −0.037); worldToRas gives [21, 37, 49] back.
- **Covered by:** `src/lib/engine/slices/coordinates.test.ts` (R)

### RENDER-39 · Section frames have fixed axes and edge letters

- **Rule:** Standard section planes have fixed normals, in-plane axes and edge letters. An oblique plane's normal comes from tilt and azimuth. All frames are orthonormal and pass through the requested point.
- **Kind:** scientific/data
- **Level:** unit
- **Source:** `viewer/slices/coordinates.js:14-18, 34-53`
- **Expected:** sagittal normal (1,0,0), u (0,−1,0), v (0,0,1), edges [S,P,I,A]; coronal (0,1,0), u (1,0,0), v (0,0,1), [S,R,I,L]; axial (0,0,1), u (1,0,0), v (0,1,0), [A,R,P,L]. Oblique: n = (sin t cos a, sin t sin a, cos t), u = (−sin a, cos a, 0), v = n × u, no edge letters; defaults t = a = 30° → n ≈ (0.4330, 0.2500, 0.8660). Orthonormal to 1e-10; tilt must be in 0..90 and |azimuth| ≤ 180, else RangeError "Oblique angles are out of range.".
- **Covered by:** `src/lib/engine/slices/coordinates.test.ts` (R), `parity/f2.test.ts` (D)

### RENDER-40 · A cut removes the positive half unless reversed

- **Rule:** The clipping plane passes through the frame centre and removes the half on the positive side of the source normal; reverse keeps that half instead.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/slices/coordinates.js:56-59`
- **Expected:** Centre +1 mm along the normal: distance < 0 without reverse and > 0 with reverse. The centre lies on the plane (±1e-10). A fractional offset is kept exactly: coronal offset 0.5 mm → plane through world z = −0.0005 (± 1e-12).
- **Covered by:** `src/lib/engine/slices/coordinates.test.ts` (R), `src/lib/engine/slices/sections.test.ts` (R)

### RENDER-41 · A cut through a point stays inside the volume

- **Rule:** The offset of a plane through a RAS point is the point's projection on the normal, clamped to the volume's range. Non-finite input is an error.
- **Kind:** scientific/data
- **Level:** unit
- **Source:** `viewer/slices/coordinates.js:24-31`
- **Expected:** [30, −10, 20] on x → 30, on y → −10; [200,0,0] → 128 and [−200,0,0] → −128 for range [−128, 128]. Infinity or a NaN range → Error "A cut through a point needs finite coordinates and a finite range.".
- **Covered by:** `src/lib/engine/slices/coordinates.test.ts` (R)

### RENDER-42 · Only real section planes and finite points make a frame

- **Rule:** A frame needs three finite RAS values and one of the four plane names. Names inherited from Object are not planes.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/slices/coordinates.js:35-37, 49-50`; deviation `e1-render-primitives.md` #4
- **Expected:** "banana", "off", "constructor", "toString" and "**proto**" → Error "Unknown section plane: …". NaN or a two-value point → Error "Slice coordinates must be three finite RAS values.".
- **Covered by:** `src/lib/engine/slices/coordinates.test.ts` (R)

### RENDER-43 · Slice canvas points and centred frames

- **Rule:** A canvas fraction (x, y) with a top-left origin maps to centre + u·(x − 0.5)·fov + v·(0.5 − y)·fov. A centred frame moves the centre to the normal's line through the origin, at the same offset. The world-to-voxel matrix composes the volume's inverse affine with world → RAS mm.
- **Kind:** scientific/data
- **Level:** unit
- **Source:** `viewer/slices/coordinates.js:7-12, 61-72`
- **Expected:** Axial frame at [10, 20, 30], fov 256: (0, 0) → [−118, 148, 30]; (0.5, 0.5) → the centre. centeredFrame(axial, [10,20,30]).center = [0, 0, 30].
- **Covered by:** `src/lib/engine/slices/sampling.test.ts` (R), `src/lib/engine/tissues/gpu-sections.test.ts` (S), `src/lib/engine/tissues/white-matter.test.ts` (R), `src/lib/engine/slices/coordinates.test.ts` (R)
