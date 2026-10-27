# Engine E6 rules: the diffusion engine

Scope: chunk E6 (#30), with the tracts domain of the engine that E7 built on it. This covers streamline lengths and their summary, decoding the published TRK files, the 3D tract lines and their direction colours, the exact scanner-to-surface reference space, the voxel and point conversions of the MRI navigator, the NiiVue navigator wrapper, the native tract viewer, the engine's `tracts` domain, and the published diffusion data itself. Legacy sources: `viewer/diffusion/{streamlines,tract-file,native-geometry,reference-space,navigation-data,native-viewer,navigation-viewer}.js` and the engine half of `viewer/diffusion/native-ui.js:78-294`; legacy tests `viewer/diffusion/*.test.js`. New code: `web/src/lib/engine/diffusion/*.ts`. Deviations: `e6-concurrent-bundle-load.md`, `e6-minimum-validation.md`, `e6-navigator-minimum-first.md`, `e6-opacity-before-load.md`, `e7-navigator-source-voxel.md`. Decisions 29 and 41 on #4, and the conductor decision of 2026-10-26 00:47 ("the MRI navigator reports source voxels"). The tract catalogue and volume validation (`core/diffusion/`) belong to the core catalogue area; the Tracts panel and the MRI dialog are in `tracts.md`.

Conventions: points are RAS millimetres. World coordinates are metres with x = R, y = S, z = −A. "CDMD" is the published reference `public/diffusion/cdmd-sub-013/` (catalogue `data/diffusion-cdmd.yaml`, anatomy `cdmd`); its expected values come from `provenance.json`, `surface-space.json` and `brain-outline.json`, which the packaging scripts computed with NiBabel.

## Streamline lengths

### DIFF-01 · A streamline's length is the length of its path

- **Rule:** Each streamline's length is the sum of its segment lengths in millimetres, not the distance between its ends, kept at full precision.
- **Kind:** scientific
- **Level:** unit
- **Source:** `viewer/diffusion/streamlines.js:3-30`
- **Expected:** Points (0,0,0) (3,4,0) (3,4,12) and (0,0,0) (1,1,1) with offsets [0, 3, 5] → Float64Array [17, √3], exact.
- **Covered by:** `src/lib/engine/diffusion/streamlines.test.ts` (R)

### DIFF-02 · Malformed streamlines are refused

- **Rule:** Points that are not whole triples, offsets that do not start at 0 and end at the point count, a streamline of fewer than two points, a non-finite coordinate or a streamline of zero length is a diffusion input error, so a bad file never draws.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/streamlines.js:3-30`
- **Expected:** `DiffusionInputError` with `code === 'streamlines'`. Offsets [1, 2], [0, 1, 2], [0, 3], [0], [0, 2, 1] on two points, empty points, or 4 values → "Invalid streamline points or offsets." or "Each streamline must contain at least two points."; a NaN → "Streamline coordinates must be finite."; two equal points → "A streamline must have nonzero length.".
- **Covered by:** `src/lib/engine/diffusion/streamlines.test.ts` (R)

### DIFF-03 · The length summary counts the streamlines at or above the minimum

- **Rule:** At a minimum length, the summary gives the total number of streamlines, how many are at least that long, and the mean, shortest and longest of those, or null when none qualify. The minimum must be a finite number of at least 0.
- **Kind:** scientific
- **Level:** unit
- **Source:** `viewer/diffusion/streamlines.js:32-48`
- **Expected:** Lengths [17, √3]: minimum 2 → {total 2, shown 1, mean 17, min 17, max 17}; minimum 20 → {total 2, shown 0, mean null, min null, max null}; minimum 17 → shown 1 (inclusive). Minimum −1, NaN → RangeError "Invalid minimum length.".
- **Covered by:** `src/lib/engine/diffusion/streamlines.test.ts` (R)

## Tract files

### DIFF-04 · A TRK file decodes the same compressed or already decompressed

- **Rule:** A published `.trk.gz` decodes whether the body arrives gzip-compressed or already decompressed by the HTTP layer.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/diffusion/tract-file.js:4-7`
- **Expected:** `af.left.trk.gz` as stored and gunzipped → identical `pts` and `offsetPt0`, 3,639 streamlines, 850,570 points.
- **Covered by:** `src/lib/engine/diffusion/tract-file.test.ts` (S)

### DIFF-05 · One download and decode per tract file, shared by the lines and the navigator

- **Rule:** Each tract file is downloaded and decoded once; the 3D lines and the MRI navigator get the same record, which carries one length per streamline. A failed download is not kept, so a retry downloads again.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/tract-file.js:14-27`
- **Expected:** Two concurrent loads of `cdmd-sub-013/callosum_1.trk.gz` → 1 read, the same object; a later load → the same object; `lengths.length === offsetPt0.length − 1` (2,000). A reader throwing "HTTP 503" → two loads reject /503/ and read twice.
- **Covered by:** `src/lib/engine/diffusion/tract-file.test.ts` (R)

## 3D tract lines

### DIFF-06 · The lines draw the source points in RAS millimetres

- **Rule:** The 3D lines use the decoded points themselves, unchanged, and one fixed matrix maps RAS millimetres to world metres; no registration is applied here. Their bounds are the bounds of the source points.
- **Kind:** scientific
- **Level:** unit
- **Source:** `viewer/diffusion/native-geometry.js:1-11,62-72`
- **Expected:** `RAS_MM_TO_WORLD` maps (R, A, S) mm to (R/1000, S/1000, −A/1000) m: (100, 200, 300) → (0.1, 0.3, −0.2) ± 1e-7. The source array is unchanged after building. The geometry's bounding box equals the min and max of the points.
- **Covered by:** `src/lib/engine/diffusion/native-geometry.test.ts` (R; I, the asserts that the attribute is the very source array), `src/lib/engine/diffusion/published-data.test.ts` (S)

### DIFF-07 · Streamlines are never joined, and the length filter hides whole streamlines

- **Rule:** Each streamline is drawn as its own segments, never joined to the next. The minimum-length filter hides every streamline shorter than the minimum, whole, and keeps those at least as long.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/native-geometry.js:12-27`
- **Expected:** Streamlines of 10 and 20 mm (points 0–2 and 3–4): segments [0, 1, 1, 2, 3, 4]; minimum 15 → [3, 4]; minimum 25 → none drawn; minimum 20 → [3, 4] (inclusive).
- **Covered by:** `src/lib/engine/diffusion/native-geometry.test.ts` (R; I, attribute identity after filtering)

### DIFF-08 · A minimum below 1 mm is refused

- **Rule:** The drawn filter needs a minimum of at least 1 mm.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/native-geometry.js:12-16`
- **Expected:** 0, −1, NaN → RangeError "Minimum streamline length must be at least 1 mm.".
- **Covered by:** `src/lib/engine/diffusion/native-geometry.test.ts` (R)

### DIFF-09 · Direction colours show |R|, |A|, |S| as displayed

- **Rule:** Each point is coloured by its local direction: red for left–right, green for front–back, blue for up–down, from the neighbouring points (one-sided at the ends). The values are the display levels after sRGB output, as NiiVue shows them. A point with no direction is black.
- **Kind:** scientific
- **Level:** unit
- **Source:** `viewer/diffusion/native-geometry.js:29-55`
- **Expected:** Line (0,0,0) (3,4,0) (6,8,0): point 1 displays (0.6, 0.8, 0) within 1/255. Line along S: (0, 0, 1). Points (1,1,1) ×3 then (4,5,1): point 0 and point 1 (zero central difference) are (0, 0, 0).
- **Covered by:** `src/lib/engine/diffusion/native-geometry.test.ts` (R)

## Reference space

### DIFF-10 · Scanner RAS maps to surface RAS by the exact published rigid transform

- **Rule:** The tracts, tracked in the scanner frame, are placed on the surface by the published scanner-to-surface transform, applied in the viewer's world metres. It is a coordinate change, not a registration, so distances are kept.
- **Kind:** scientific
- **Level:** unit
- **Source:** `viewer/diffusion/reference-space.js:4-24`
- **Expected:** Rows [[0, −1, 0, 12], [1, 0, 0, −25], [0, 0, 1, 40], [0, 0, 0, 1]]: scanner (100, 200, 300) mm → surface (−188, 75, 340) mm, i.e. world (0.1, 0.3, −0.2) → (−0.188, 0.34, −0.075) within 1e-12 m; a 5 mm offset stays 5 mm within 1e-12 m.
- **Covered by:** `src/lib/engine/diffusion/reference-space.test.ts` (R)

### DIFF-11 · Only a finite, rigid, orientation-preserving transform is accepted

- **Rule:** A missing, malformed or non-finite transform, one with a bottom row other than [0, 0, 0, 1], one that scales, or one that mirrors is refused.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/reference-space.js:4-16`
- **Expected:** `null`, [[1]], a NaN, bottom row [0, 0, 1, 1] → TypeError "The reference requires a finite rigid RAS transform."; x scaled by 2, x mirrored (−1) → RangeError "The reference requires a rigid, orientation-preserving RAS transform." (tolerance 1e-5 on the determinant and on RᵀR).
- **Covered by:** `src/lib/engine/diffusion/reference-space.test.ts` (R)

### DIFF-12 · The published CDMD reference space reproduces NiBabel's voxel anchors

- **Rule:** The published transform belongs to the `cdmd` anatomy, is derived from the T1 file it names (checked by hash), and carries three voxel anchors computed independently with NiBabel, which it must reproduce.
- **Kind:** scientific
- **Level:** unit
- **Source:** `viewer/diffusion/reference-space.test.js`; `public/diffusion/cdmd-sub-013/surface-space.json`
- **Expected:** `anatomy === 'cdmd'`; sha256 of `data/cdmd/input/sub_013_t1w.nii.gz` = `16e9137160f20c3dfb39fbd04ce1299415c5252ba96e8b0266f5f9402c60730b`; translation (−2.5373077, −2.6237411, 14.0663681) mm with identity rotation. Anchors scanner → surface within 1e-7 mm: (90.5373, −107.3763, −124.0664) → (88, −110, −110); (2.5373, 2.6237, −14.0664) → (0, 0, 0); (−84.4627, 111.6237, 94.9336) → (−87, 109, 109).
- **Covered by:** `src/lib/engine/diffusion/reference-space.test.ts` (S; needs `data/cdmd/input`)

## Published diffusion data

### DIFF-13 · The scalar maps keep their original bytes and grid

- **Rule:** The T1 and FA maps are published as the original NIfTI files, read as valid 3D scalar maps on the declared grid.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/diffusion/data.test.js`; `public/diffusion/cdmd-sub-013/provenance.json`
- **Expected:** For `sub_013_t1w.nii.gz` and `fa.nii.gz`: sha256 = provenance `source_sha256`; `validateVolume` passes; dims 176 × 220 × 220; affine equal to provenance within 1e-4.
- **Covered by:** `src/lib/engine/diffusion/published-data.test.ts` (S)

### DIFF-14 · Every published bundle decodes in NiBabel's RAS+ space with its recorded geometry

- **Rule:** The catalogue's 30 bundles each have provenance. Each file is the packaged file recorded (gzip of the 0.5 mm resampled TRK, or of the source when lossless), and decodes to the recorded point and streamline counts, with the recorded RAS millimetre samples, also after the world matrix.
- **Kind:** scientific
- **Level:** unit
- **Source:** `viewer/diffusion/data.test.js`; `public/diffusion/cdmd-sub-013/provenance.json`
- **Expected:** 30 bundles with unique ids. Per bundle: sha256 of the file = `published_sha256`; of its gunzipped body = `resampled_sha256` or `source_sha256`; `pts.length / 3 === points`; `offsetPt0.length − 1 === streamlines`; each `rasmm_samples` position within 1e-4 mm, and within 0.001 mm through `RAS_MM_TO_WORLD`. Example af-left: 850,570 points, 3,639 streamlines, sample 0 at (−39.32349, −17.50410, −8.83125). cc: 6,366,902 points, 31,605 streamlines. The 0.5 mm resample step itself is not checked.
- **Covered by:** `src/lib/engine/diffusion/published-data.test.ts` (S; the resample step is uncovered)

### DIFF-15 · Length summaries match the packaging's NiBabel values

- **Rule:** The summary the Tracts panel shows equals the one the packaging computed for each bundle at 1, 100 and 200 mm.
- **Kind:** scientific
- **Level:** unit
- **Source:** `public/diffusion/cdmd-sub-013/provenance.json` (`length_summaries`)
- **Expected:** Counts exact, statistics within 0.001 mm. af-left: 1 mm → shown 3,639, mean 115.2591, min 58.4695, max 180.3032; 100 mm → 2,787, mean 122.7890, min 100.0092; 200 mm → 0, nulls. cst-right: 1 mm → 964, mean 132.4795. cc: 200 mm → 28, mean 207.1075, min 200.2318, max 220.0362.
- **Covered by:** `src/lib/engine/diffusion/published-data.test.ts` (S)

### DIFF-16 · The brain outline is an MRI-derived display surface with its own provenance

- **Rule:** The translucent outline is a marching-cubes surface of the skull-stripped brain in the scanner frame, published with its source, its processing parameters and a limitation note, and its bounds are its RAS bounds in world metres.
- **Kind:** data
- **Level:** unit
- **Source:** `public/diffusion/cdmd-sub-013/brain-outline.json`
- **Expected:** Source `data/cdmd/mri/brain.mgz`, sha256 `2d9d847b16bc29ac94dff4960ef1d83ce9282a0075bcb9d9c4d0f50654599abe`; published sha256 `8f416398ca5e51aefe65b2bf6c6e7cb6cf58cee222b41a67b2773787e5a128be`; `intensity_threshold` 1, `step_size_voxels` 2 (= catalogue); limitations match /not a pial or labeled/; GLB magic 0x46546c67, version 2, length = file size; 25,461 vertices, 50,526 triangles; POSITION min/max = (R, S, −A)/1000 of `ras_bounds_mm` within 1e-7 m.
- **Covered by:** `src/lib/engine/diffusion/published-data.test.ts` (S; needs `data/cdmd/mri/brain.mgz`)

## Native tract viewer

### DIFF-17 · Opening the tracts places the outline and the initial bundles on the surface

- **Rule:** Loading reads the outline and the reference space, refuses a reference space of another anatomy, places the whole group by the reference transform, draws the outline translucent without depth writes, then loads the catalogue's initial bundles in order.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/native-viewer.js:19-46,83-86`
- **Expected:** CDMD `load()` → `ready === true`; the group matrix is the published transform (DIFF-12) and not auto-updated; outline material colour 0xb3babf, roughness 0.8, transparent, `depthWrite === false`, opacity 0.16 (`brain_outline.opacity`); `snapshot()` ids ['af-left', 'cst-right'] with totals 3,639 and 964. `bounds` = the outline box moved by the published transform, read right after `load()`: min (−0.067971, −0.053958, −0.067933), max (0.065900, 0.091946, 0.085333) m within 1e-6. Legacy read the unplaced box (deviation `e6-reference-bounds-placed.md`). Catalogue anatomy `another-anatomy` → rejects "The tract reference space belongs to a different anatomy.".
- **Covered by:** `src/lib/engine/diffusion/tracts.test.ts` (R, only `snapshot().length > 0`), `src/lib/engine/diffusion/native-viewer.test.ts` (R)

### DIFF-18 · Scanner and surface points convert both ways

- **Rule:** A scanner RAS point converts to surface RAS and back through the group's transform, exactly inverse.
- **Kind:** scientific
- **Level:** unit
- **Source:** `viewer/diffusion/native-viewer.js:78-79`
- **Expected:** CDMD after `load()`: `scannerToSurface([10, −20, 30])` = [7.4626923, −22.6237411, 44.0663681] within 1e-6 mm; `surfaceToScanner` of that gives [10, −20, 30] within 1e-9 mm. Any rotation and translation of the group: round trip within 1e-9 mm.
- **Covered by:** `src/lib/engine/diffusion/native-viewer.test.ts` (R, round trip), `src/lib/engine/index.contract.test.ts` (R, round trip via contract suite)

### DIFF-19 · The snapshot summarises each loaded bundle at the current minimum

- **Rule:** For each loaded bundle the snapshot gives its id, English name, both names, file name, whether it is shown, and its length summary at the current minimum.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/native-viewer.js:116-122`
- **Expected:** One bundle of 17 mm and 30 mm streamlines: `{ id, catalogId: id, name: bundle.name.en, label: bundle.name, file: 'af.left.trk.gz', visible: true, total: 2, shown: 2 }`; `setMinimum(20)` → shown 1.
- **Covered by:** `src/lib/engine/diffusion/native-viewer.test.ts` (R)

### DIFF-20 · The minimum applies to every bundle, and a bad one is refused before it is kept

- **Rule:** Setting the minimum length filters every loaded bundle and every bundle loaded later. A minimum below 1 mm, or not a number, is refused before anything changes, also when no bundle is loaded yet.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/native-viewer.js:109-115`; deviation `e6-minimum-validation.md`
- **Expected:** Empty viewer: `setMinimum(0)`, `−1`, `NaN` → RangeError "Minimum streamline length must be at least 1 mm."; a bundle loaded afterwards shows all 2 streamlines (minimum still 1). `setMinimum(20)` then load → the new bundle shows 1.
- **Covered by:** `src/lib/engine/diffusion/native-viewer.test.ts` (R)

### DIFF-21 · A bundle requested twice at once is added once

- **Rule:** Concurrent requests for one bundle share one load, so its lines are added once. Asking for a bundle already loaded shows it. A failed load is forgotten, so the next request loads again.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/native-viewer.js:48-67`; deviation `e6-concurrent-bundle-load.md`
- **Expected:** `loadBundle(first)` twice and `loadBundle(second)` at once → 2 tract loads, 2 group children, 2 snapshot rows. A hidden loaded bundle requested again → `visible === true`, no new load.
- **Covered by:** `src/lib/engine/diffusion/native-viewer.test.ts` (R)

### DIFF-22 · Bundles are shown or hidden by id

- **Rule:** The reader can show or hide each loaded bundle. An unknown id is an error. The viewer says whether any bundle is shown.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/native-viewer.js:68-74`
- **Expected:** `setVisible(first.id, false)` → `anyVisible === false`; `setVisible('missing', true)` → RangeError "Unknown tract bundle: missing". `hasBundle(first.id)` true after loading.
- **Covered by:** `src/lib/engine/diffusion/native-viewer.test.ts` (R), `src/lib/engine/index.contract.test.ts` (R, via contract suite)

### DIFF-23 · The outline's opacity and visibility can be set at any time

- **Rule:** The brain outline's opacity runs from 0 to 1 and its visibility is on or off. Both can be set before the outline has loaded; they apply when it arrives.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/native-viewer.js:90-108`; deviation `e6-opacity-before-load.md`
- **Expected:** `setOpacity(0.5)` before `load()` → outline opacity 0.5 after load; then 0, 0.16, 1 apply at once. `setOpacity(−0.1)`, `1.1`, `NaN` → RangeError "Brain opacity must be between 0 and 1.". `setOutlineVisible(false)` before `load()` → outline hidden after load, at opacity 0.16.
- **Covered by:** `src/lib/engine/diffusion/native-viewer.test.ts` (W: only that `setOpacity(0.4)` does not throw and 2 throws)

### DIFF-24 · The cut's planes clip every bundle

- **Rule:** The cut's clipping planes apply to the lines of every loaded bundle and of bundles loaded later.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/native-viewer.js:95-103`
- **Expected:** `setClippingPlanes([p])` → each bundle's `material.clippingPlanes` is [p]; a bundle loaded afterwards has [p].
- **Covered by:** uncovered

### DIFF-25 · Disposal frees the lines and the outline, and refuses late loads

- **Rule:** Disposing frees every geometry and material and removes the group. An outline or bundle that arrives afterwards is refused.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/native-viewer.js:30,54,123-131`
- **Expected:** `dispose()` → group removed from its parent, every geometry and material disposed. A bundle resolving after dispose → rejects "Tract viewer disposed during bundle loading."; the outline → "Tract viewer disposed during outline loading.".
- **Covered by:** uncovered

## The engine's tracts domain

### DIFF-26 · The tracts overlay their own anatomy and are a separate reference on another

- **Rule:** The tracts belong to one anatomy (CDMD). On that anatomy, they show only while the overlay is on, without the outline. On another anatomy the outline and streamlines are an independent reference that shows only while the Tracts tab is active; turning that on or off is announced. Overlaying another anatomy is refused.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/native-ui.js:78-294`; `viewer/app.js:1045-1065`
- **Expected:** `anatomy` is `cdmd` for any anatomy. Own anatomy: one group added, not ready, `streamlinesVisible` false; `setOverlay(true)` → event `tractsVisibility`, group shown; after `setActive(true)`, still `streamlinesVisible === false` until the overlay is on. Another anatomy: `setOverlay(true)` → Error "Tracts can only overlay their own anatomy."; `setActive(true)` → events [`tractsActive {active: true}`, `tractsReady`], `streamlinesVisible` true; `setActive(false)` → `tractsActive {active: false}`, not visible.
- **Covered by:** `src/lib/engine/diffusion/tracts.test.ts` (R)

### DIFF-27 · The tracts load once, on first opening, and say so once

- **Rule:** The first activation loads the outline and the initial bundles. Activations while it loads share that load, and readiness is announced once. Showing, hiding and loading a bundle each announce a visibility change. An unknown bundle id is an error.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/native-ui.js:78-294`
- **Expected:** Two `setActive(true)` at once → one `tractsReady`; off and on again → still one. `loadBundle(id)` and `setVisible(id, …)` → `tractsVisibility`. `loadBundle('missing')` → RangeError "Unknown tract bundle: missing".
- **Covered by:** `src/lib/engine/diffusion/tracts.test.ts` (R); `src/lib/engine/index.contract.test.ts` (R, via contract suite on the real engine)

## MRI navigator

### DIFF-28 · A source voxel maps to scanner RAS through the published affine

- **Rule:** The navigator speaks zero-based source voxels of the published T1 grid. A voxel converts to its scanner RAS point through the file's affine. A voxel outside the grid, fractional, not a number or not three values is refused.
- **Kind:** scientific
- **Level:** unit
- **Source:** `viewer/diffusion/navigation-data.js:4-13`
- **Expected:** Header dims [3, 256, 256, 150], affine identity with translation (−120.5538330078125, −104.4605712890625, −28.359909057617188): voxel [128, 104, 75] → [7.4461669921875, −0.4605712890625, 46.64009094238281] exactly. [256, 0, 0], [0, −1, 0], [0, 0, 150], [1.5, 0, 0], [NaN, 0, 0], [0, 0] → RangeError "Choose a zero-based source voxel inside the MRI grid.".
- **Covered by:** `src/lib/engine/diffusion/navigation-data.test.ts` (R)

### DIFF-29 · A scanner point goes to its nearest source voxel, or none outside the scan

- **Rule:** A scanner RAS point (for example an atlas point converted from the surface) goes to the nearest source voxel, rounding a half voxel up. A point beyond the cropped scan has no voxel. A point that is not three finite numbers is refused.
- **Kind:** scientific
- **Level:** unit
- **Source:** `viewer/diffusion/navigation-data.js:14-20`
- **Expected:** Same header: [7.4461669921875, −0.4605712890625, 46.64009094238281] → [128, 104, 75]; [7.9, −0.9, 46.2] → [128, 104, 75]; the point of [255, 0, 149] → [255, 0, 149]; z −30 or 121.2 → null. At the grid origin offset along x by −0.5, −0.49, 0.49, 0.5, 0.51 voxels → x = 0, 0, 0, 1, 1. [0, NaN, 0], [Infinity, 0, 0], [0, 0] → RangeError "A scanner point needs three finite RAS values.".
- **Covered by:** `src/lib/engine/diffusion/navigation-data.test.ts` (R)

### DIFF-30 · The navigator draws every streamline as a line at the current minimum, with exact lengths

- **Rule:** In the MRI navigator, tracts are drawn as plain lines coloured by local direction, every streamline kept (no decimation), filtered at the panel's minimum against full-precision lengths rather than NiiVue's rounded ones. A minimum below 1 mm is refused, since NiiVue would keep the previous filter at 0.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/navigation-data.js:21-31`
- **Expected:** A 17 mm streamline, minimum 16 → `fiberLengths` Float64Array [17], `fiberLength` 16, `fiberRadius` 0, `fiberDither` 0, `fiberDecimationStride` 1, `fiberColor` 'Local'. Minimum 0 or −1 → RangeError "Minimum tract length must be at least 1 mm.".
- **Covered by:** `src/lib/engine/diffusion/navigation-data.test.ts` (R; I, it pins NiiVue's field names, which are the only observable here)

### DIFF-31 · The navigator shows exactly the tracts the last call asked for

- **Rule:** `syncTracts(enabled, minimum)` shows exactly the enabled tracts at the minimum. Overlapping calls run one after another, so a tract is added once and the last call decides what shows; a failed call does not block later ones. A bad minimum is refused before anything changes. An unknown tract is an error.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/navigation-viewer.js:71-96`; deviation `e6-navigator-minimum-first.md`
- **Expected:** Two concurrent `syncTracts([first], 1)` → 1 mesh, visible. `syncTracts([second], 1)` and `syncTracts([], 1)` at once → 1 mesh, hidden. `syncTracts([first], 0)` → RangeError, 0 meshes; then `syncTracts([first], 1)` → 1 mesh. `syncTracts(['missing'], 1)` → RangeError "Unknown MRI tract bundle: missing". A loaded tract at a new minimum is refiltered, not re-added.
- **Covered by:** `src/lib/engine/diffusion/navigation-viewer.test.ts` (R, NiiVue mocked; the unknown id and refilter are uncovered); `src/lib/engine/index.svelte.test.ts` (R, real NiiVue via contract suite, minimum 0 rejected)

### DIFF-32 · The crosshair is reported as the source voxel and a three-component point

- **Rule:** Wherever the crosshair moves (a voxel typed, a scanner point, an arrow key, a click), the report gives the scanner point as three values and the source voxel under it, so "Source voxel (0-based)" means one thing, plus the value of every map there. No report is made before the volumes load; a point outside the grid is an error. A step moves one voxel along one axis, in the display's direction.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/navigation-viewer.js:18,40-60`; deviation `e7-navigator-source-voxel.md`; conductor decision on #4 (2026-10-26 00:47)
- **Expected:** Grid 176 × 220 × 220, affine x −1 (+87), y +1 (−100), z +1 (−100): NiiVue report `mm [81.54, −87.38, −94.07, 1]`, `vox [166, 20, 30]`, values with extra fields → `{ mm: [81.54, −87.38, −94.07], vox: [5, 13, 6], values: [{ name: 'FA', value: 0.4 }] }`. With no volumes → no report. Grid 2 × 2 × 2, mm (50, 0, 0) → RangeError. `setVoxel([5, 6, 7])` → last report `vox` [5, 6, 7], three-component `mm`; `moveVoxel([1, 0, 0])` → `vox` differs by 1 on x only. `setScannerPoint([1e6, 0, 0])` → false, no move.
- **Covered by:** `src/lib/engine/diffusion/navigation-viewer.test.ts` (R, NiiVue mocked); `src/lib/engine/index.svelte.test.ts` (R, real NiiVue on the published scan, via contract suite)

### DIFF-33 · The navigator's maps must share one grid, and contrast needs a positive width

- **Rule:** The navigator loads each catalogue map as a validated volume, and all maps must share the reference grid and affine; otherwise it refuses and frees the viewer. The T1 window is set from a finite centre and a positive width. An unknown plane is refused. The FA opacity sets the second map's opacity.
- **Kind:** behaviour
- **Level:** unit — with NiiVue mocked, as `navigation-viewer.test.ts` does; the contract suite repeats it on real NiiVue in the browser
- **Source:** `viewer/diffusion/navigation-viewer.js:19-38,51-70`
- **Expected:** A map whose dims or affine differ by more than 1e-5 → Error "The reference MRI maps must share the same source grid and RAS transform." and `cleanup()` called. `setWindow(c, w)` → `cal_min = c − w/2`, `cal_max = c + w/2`; `setWindow(0, 0)` or a NaN → RangeError "MRI contrast requires a finite center and positive width.". `setPlane('OBLIQUE')` → RangeError "Unknown MRI plane: OBLIQUE".
- **Covered by:** `src/lib/engine/index.svelte.test.ts` (R, window and plane errors via contract suite); the grid check and the window values are uncovered

### DIFF-34 · Closing the navigator frees its GPU context

- **Rule:** Disposing the navigator frees its tract meshes and volumes and releases the WebGL context, so reopening it cannot exhaust the browser's context limit. A tract that arrives after disposal is not added.
- **Kind:** behaviour
- **Level:** unit — with NiiVue and its `gl` mocked; the release itself is real WebGL only in the browser
- **Source:** `viewer/diffusion/navigation-viewer.js:97-107`
- **Expected:** After `dispose()`: every mesh unloaded, `volumes` empty, `WEBGL_lose_context.loseContext()` called once; a `syncTracts` whose load resolves afterwards adds nothing.
- **Covered by:** `src/lib/engine/index.contract.test.ts` (R, dispose runs; the context release is not asserted); uncovered
