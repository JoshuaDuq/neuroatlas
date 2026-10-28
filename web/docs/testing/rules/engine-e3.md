# Engine E3 rules: tissue solids, cut geometry and the section worker

Scope: chunk E3 (#26). It covers the face a plane cuts through a closed solid (`plane-section`,
with the vendored earcut), the parcel solids closed from the cortical ribbon (`ribbon-wedges`), how
the cut's solids are loaded, coloured, shown and named (`solid-assets`), how their caps are drawn,
ordered, picked and lit (`solid-sections`), the off-thread cut (`section-worker`), the glass-brain
ribbon solids (`glass-solids`) and the exposed native white matter (`white-matter-surfaces`).
Legacy sources: `viewer/tissues/plane-section.js`, `earcut.js`, `ribbon-wedges.js`,
`solid-assets.js`, `solid-sections.js`, `section-worker.js`, `glass-solids.js`,
`white-matter-surfaces.js`. New code: `web/src/lib/engine/tissues/{plane-section,earcut,ribbon-wedges,solid-assets,solid-sections,section-worker,glass-solids,white-matter-surfaces}.ts`
(`earcut.js`). Deviations: `e3-cap-buffers-disposed.md`, `e3-earcut-formatting.md`,
`e3-exposed-white-matter-region.md`, `e3-ribbon-labels-length.md`, `e3-worker-errors.md`.
`slices/volume.ts` moved to E3 by decision 11, but its rules are SLICE-06 to SLICE-10
(`engine-e4a.md`); the cap and cut-face materials are SHADER-17 to SHADER-31 (`engine-e2.md`); the
GPU cut controller (`gpu-sections`) is E4a. World space is in metres. Published data is the CDMD
anatomy (`public/models/cdmd/`): `tissue-envelopes.glb` holds four envelopes (left and right, pial
and white), and the Destrieux and HCP-MMP atlases publish `ribbon_labels`. The legacy comparison file `parity/E3.test.ts` is deleted.

## The cut face of a solid

### TISSUE-01 · A cut through a closed solid is exactly its cross-section, in world space

- **Rule:** Cutting a closed mesh by a plane gives triangles that lie on the plane and cover exactly the part of the plane inside the solid, from either side of the plane, through the mesh's world matrix. Concave outlines keep their notches and holes in the solid stay holes.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/plane-section.js:39-88, 298-382, 415-446`
- **Expected:** every result vertex within 1e-6 m of the plane. On a 9 × 9 grid over the solid's bounds (points on the surface skipped, more than 16 compared), "covered by a result triangle" equals "inside the solid" for: a 0.1 m box cut at z = 0 with normal +z and −z; an L-shaped extrusion (notch 0.04 × 0.04) at z = 0.025; a 0.08 m square with a 0.03 m hole at z = 0.025; a 0.04 m box translated to (0.1, −0.2, 0.05) cut at x = 0.1. The box cut has area 0.01 m² ± 1e-12.
- **Covered by:** `src/lib/engine/tissues/plane-section.test.ts` (R)

### TISSUE-02 · A plane that misses gives no face

- **Rule:** A plane that does not meet the solid, or a geometry with no positions, gives an empty result, not a fallback and not an error.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/plane-section.js:53, 300, 353, 380`
- **Expected:** a 0.1 m box and the plane z = 2 → `{ empty: true }`; a geometry without `position` → `{ empty: true }`.
- **Covered by:** `src/lib/engine/tissues/plane-section.test.ts` (R)

### TISSUE-03 · A cut the sectioner cannot vouch for is reported, not filled wrongly

- **Rule:** When the intersection is not a set of closed, simple loops (an edge shared by more than two faces, an open loop, a broken cycle, no interior seed, or a triangulation whose area deviates by more than 1e-3), the result is a fallback with its reason, so the caller keeps the stencil cap.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/plane-section.js:298-350, 378, 434`
- **Expected:** three triangles sharing the edge (0,0,0)–(1,0,0) (positions `[0,0,0, 1,0,0, 0,1,0, 0,0,0, 1,0,0, 0,−1,0, 0,0,0, 1,0,0, 0,0,1]`) cut by x = 0.4 → `{ fallback: true, reason: 'branch' }`.
- **Covered by:** `src/lib/engine/tissues/plane-section.test.ts` (R, `fallback` only; the reason and the other four causes are uncovered)

### TISSUE-04 · A plane through a vertex still gives a sound face

- **Rule:** A vertex exactly on the plane is moved off it by a tiny amount that depends only on its position, so every copy of that vertex moves alike and the cut never sits on a vertex. A plane through a row of vertices still gives a closed face.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/plane-section.js:147-157`
- **Expected:** `BoxGeometry(0.1, 0.1, 0.1, 2, 2, 2)` (vertices at z = 0) cut by z = 0 → positions, not a fallback, area 0.01 m² ± 1e-9, every vertex within 1e-6 m of the plane.
- **Covered by:** `src/lib/engine/tissues/plane-section.test.ts` (R)

### TISSUE-05 · The BVH changes only the speed of a cut

- **Rule:** Cutting with the geometry's indirect BVH, with a plain BVH, or by walking every triangle gives the same face.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/plane-section.js:50-88`
- **Expected:** a 48 × 32 sphere cut by 8 seeded planes (mulberry32 seed 31): the plain BVH cut, the indirect BVH cut and the brute-force cut on an unindexed clone have the same area ± 1e-9 m², none a fallback. The four published envelopes are not cut by this test.
- **Covered by:** `src/lib/engine/tissues/plane-section.test.ts` (R)

## Earcut

### TISSUE-06 · Faces with holes are triangulated without losing area

- **Rule:** The vendored earcut triangulates an outline with holes into triangles whose total area equals the outline's area minus the holes'.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/tissues/earcut.js`; deviation `e3-earcut-formatting.md`; decision 47 on #4
- **Expected:** 60 polygons from mulberry32 seed 41 (5 to 44 sides, radius 0.7 to 1, half with one reversed ring of radius ≤ 0.2 as a hole) → at least one triangle each, and `earcut.deviation` ≤ 1e-9.
- **Covered by:** `src/lib/engine/tissues/earcut.test.ts` (R)

### TISSUE-07 · The vendored earcut is upstream 2.2.4

- **Rule:** `earcut.js` is earcut 2.2.4 as published upstream; once `web/.prettierignore` lists it, its bytes are upstream's.
- **Kind:** hygiene
- **Level:** unit
- **Source:** deviation `e3-earcut-formatting.md`; decision 47 on #4
- **Expected:** the file's SHA-256 equals upstream `earcut@2.2.4/src/earcut.js` (whitespace-only differences allowed until the ignore entry lands).
- **Covered by:** uncovered

## Ribbon wedges

### TISSUE-08 · Each parcel of the ribbon becomes one closed solid

- **Rule:** The cortical ribbon between the pial and white surfaces is closed into one solid per parcel: its pial patch, its white patch reversed, and a wall along the patch boundary. Every solid is closed and consistently wound, which is what the stencil cap counts.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/ribbon-wedges.js:18-81`
- **Expected:** a unit square of two triangles, white one unit below: labels [7, 7, 7, 7] → keys [7]; [3, 3, 9, 9] → keys [3, 9]. Every wedge has 0 edges carried by other than two triangles, and no directed edge twice.
- **Covered by:** `src/lib/engine/tissues/ribbon-wedges.test.ts` (R)

### TISSUE-09 · A triangle belongs to its majority label, and a three-way tie to the lowest

- **Rule:** A triangle goes to the label two or more of its vertices share. When all three differ it goes to the lowest label, as the build does.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/ribbon-wedges.js:4-16`
- **Expected:** labels [8, 2, 5] on one triangle → keys [2].
- **Covered by:** `src/lib/engine/tissues/ribbon-wedges.test.ts` (R)

### TISSUE-10 · A wedge carries the pial and white coordinates unchanged

- **Rule:** A wedge's vertices are its patch's pial vertices followed by the same vertices on the white surface, copied exactly, with its bounding box computed. Surfaces that do not share one labelled vertex set are refused.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/ribbon-wedges.js:18-35, 63-70`
- **Expected:** the square → 8 vertices, vertex 0 = (0, 0, 1), vertex 4 = (0, 0, 0). Pial 12 values with white 9 values, or 5 labels for 4 vertices → Error "Ribbon surfaces must share one labelled vertex set.".
- **Covered by:** `src/lib/engine/tissues/ribbon-wedges.test.ts` (R, coordinates and the refusal)

### TISSUE-11 · The published ribbon closes into sound parcel solids

- **Rule:** For each atlas that publishes ribbon labels, each hemisphere's published pial and white envelopes and labels give one wedge per label that owns a triangle, every one closed and consistently wound.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/tissues/ribbon-wedges.js:67-81`; `viewer/tissues/solid-assets.js:57-81`
- **Expected:** CDMD `destrieux` and `hcp-mmp`, left and right (labels split by `vertex_counts`): the number of wedges equals the number of distinct TISSUE-09 owners, each wedge's bounding box lies inside its hemisphere's pial bounding box, every directed edge is carried as often as its reverse (so every undirected edge by an even number of triangles), and the wedges are named by their region in face order. The wedges are closed but pinched at some vertices: 51 of 150 destrieux and 128 of 362 hcp-mmp wedges have edges carried by more than two triangles where a parcel's patch pinches. A cut through a pinch falls back to the stencil cap (reason `branch`); TISSUE-24.
- **Covered by:** `src/lib/engine/tissues/ribbon-wedges.test.ts` (R)

## Loading the cut's solids

### TISSUE-12 · An atlas with ribbon labels gets one parcel solid per wedge, named by its region

- **Rule:** An atlas that publishes `ribbon_labels` gets, per hemisphere (left then right), one solid per wedge, tagged with its hemisphere, its atlas, kind `ribbon` and the region the label index names. An atlas without ribbon labels gets none. The envelopes are baked into world space first.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/solid-assets.js:41-81`
- **Expected:** CDMD `destrieux` → every solid's `userData` is `{ hemisphere, atlas: 'destrieux', kind: 'ribbon', region_id: region_ids[label] }`, left solids first. `nextbrain` → `[]`. A missing envelope → Error "Missing the left pial envelope.".
- **Covered by:** `src/lib/engine/tissues/ribbon-wedges.test.ts` (R)

### TISSUE-13 · A ribbon label file of the wrong length is refused

- **Rule:** The ribbon label file must hold two bytes per vertex of both hemispheres. Any other length is an error naming the atlas and both sizes, not a truncated or garbled cut.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/tissues/solid-assets.js:57-62`; deviation `e3-ribbon-labels-length.md`; decision 46 on #4
- **Expected:** atlas `a` with `vertex_counts` {left: 2, right: 2} and a 6-byte file → Error "Ribbon labels for a hold 6 bytes; the manifest publishes 8.".
- **Covered by:** `src/lib/engine/tissues/solid-assets.test.ts` (R)

### TISSUE-14 · Only the white envelope's cap samples gyral white matter

- **Rule:** Each cut solid gets a solid cap material (SHADER-25) with cap labels (SHADER-30) and the MRI appearance at the cap's lift. Only the white envelope's cap reads the gyral white-matter parcels. A solid not registered to the MRI (the reference cord) gets no relief.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/solid-assets.js:83-99`
- **Expected:** pial and white envelopes with a white-matter record → the white cap's compiled uniforms carry `whiteMatterVolume` (a 3D texture), the pial cap's do not. `mri_registered: false` → `tissueRelief` 0; otherwise 0.0012.
- **Covered by:** `src/lib/engine/tissues/solid-assets.test.ts` (R, white matter only; the relief is uncovered)

### TISSUE-15 · Nested solids reach the cut after the solids that enclose them

- **Rule:** Solids are ordered by segmentation volume, largest first, so an enclosing solid is drawn before what it holds. A solid without a volume counts as 0. Equal volumes keep their order.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/solid-assets.js:35-39`
- **Expected:** nucleus proprius 73, cord 45710, posterior horn 1180 mm³ → cord, posterior horn, nucleus proprius. [a: undefined, b: 5, c: 0, d: 5] → b, d, a, c.
- **Covered by:** `src/lib/engine/tissues/solid-assets.test.ts` (R)

## Painting the cut's solids

### TISSUE-16 · A cut shows only the solids that belong to it

- **Rule:** A parcel solid belongs to its own atlas's cut only. A solid of a detail level belongs only while that level is shown. The pial envelope stands in only for an atlas without parcel solids. Under MRI colour, solids not registered to the MRI are left out.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/solid-assets.js:129-140, 164-186`
- **Expected:** an `hcp-mmp` ribbon solid on a `destrieux` cut → not visible. An `aseg` nucleus with detail `aseg` → visible, with detail `nextbrain` → not. Pial envelope: atlas with parcel solids → not visible; without → visible in cortex colour `#c4a897`. A cord cap with `mri_registered: false` under `surfaceColor: 'mri'` → not visible.
- **Covered by:** `src/lib/engine/tissues/solid-assets.test.ts` (R)

### TISSUE-17 · A solid is painted as the cut label it stands for

- **Rule:** A parcel solid is painted as its region's cut label. A ribbon parcel the segmentation never labelled (the medial wall) is painted as unlabelled cortex. The white envelope is painted as its hemisphere's cerebral white matter label (2 left, 41 right), never as a cortical parcel that reuses that code. The pial envelope and any solid without a label are painted from the solid itself.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/solid-assets.js:101-127`
- **Expected:** `destrieux:left:1` under atlas colours → linear [23, 220, 60]. `destrieux:left:-1` → visible, unlabelled `#c4a897`. Left white envelope with labels {2: Left-Cerebral-White-Matter [245, 245, 245], HCP-MMP area 2 `R_MST_ROI` [20, 30, 200]} on an `hcp-mmp` cut → linear [245, 245, 245].
- **Covered by:** `src/lib/engine/tissues/solid-assets.test.ts` (R)

### TISSUE-18 · A solid without a cut label keeps the colour its surface has

- **Rule:** An envelope with no label is cortex (pial) or white (white). A painted region takes its paint colour. Under atlas colours a nucleus the cut atlas never labelled keeps its own published mesh colour. Otherwise the solid takes its tissue class colour (SHADER-01), from its declared tissue for the reference cord.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/solid-assets.js:189-205`
- **Expected:** `nextbrain:left:7` with mesh colour [60, 180, 90]: atlas → linear [60, 180, 90]; tissue, network, cab-np → gray `#a68d80`. Paint {`nextbrain:left:7` → [0, 0, 255]} → linear (0, 0, 1); `nextbrain:left:8` → gray. Cord caps declared white, gray, fluid → `#e5dbc5`, `#a68d80`, `#67777c`. A parcel under network colour (Default 0.7) → linear [205, 62, 78]; under tissue colour → `#c4a897`.
- **Covered by:** `src/lib/engine/tissues/solid-assets.test.ts` (R)

### TISSUE-19 · Only tissue colour carries the T1 variation on a cap

- **Rule:** A cap carries the T1 brightness variation only under tissue (and MRI) colour. Under atlas, network, CAB-NP, functional colours or a paint it carries none, so the cap matches its key. A solid not registered to the MRI never carries it. Relief is light, not colour, and stays.
- **Kind:** scientific
- **Level:** unit
- **Source:** `viewer/tissues/solid-assets.js:167-178`
- **Expected:** `tissueVariation`: tissue → 0.5; atlas, network, cab-np, functional, paint → 0; `mri_registered: false` → 0 in every mode.
- **Covered by:** `src/lib/engine/tissues/solid-assets.test.ts` (R, tissue, atlas, network)

### TISSUE-20 · Display controls hide the solids they describe

- **Rule:** A cap is hidden with its removed region, with the hidden hemisphere, and with the cortex when the cortex is hidden or fully transparent. While a region is isolated only its solid stands, plus its own hemisphere's white envelope when the isolated region is a gyral white-matter parcel. Structures follow the internal anatomy's visibility and system filter, and stay up when they are the isolated region.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/solid-assets.js:142-162, 199-219`
- **Expected:** a left parcel: hemisphere `right`, cortex hidden, or cortex opacity 0 → not visible; hemisphere `left` → visible; removed → not visible. Isolating the parcel → parcel visible, caudate `aseg:left:11` not. Isolating `wmparc:left:3024` (left) → left white envelope visible, right not. `learning:left:caudate` with system `Brainstem` → not visible; system `Basal ganglia` and isolated → visible.
- **Covered by:** `src/lib/engine/tissues/solid-assets.test.ts` (R)

### TISSUE-21 · A cap answers for the region it was painted as

- **Rule:** Pointing at a cap names the region its colour came from: a parcel names itself, a nucleus the atlas never labelled names itself, the white envelope and an unlabelled wedge name no region, so nothing can light them.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/solid-assets.js:187-196`
- **Expected:** a `destrieux:left:1` wedge → `destrieux:left:1`; the white envelope → `null`; `destrieux:left:99` (not in the table) → `null`; `aseg:left:17` (not in the table) → `aseg:left:17`.
- **Covered by:** `src/lib/engine/tissues/solid-assets.test.ts` (R), `src/lib/engine/tissues/solid-sections.test.ts` (R, hit carries the painted region)

### TISSUE-22 · Under MRI colour, caps of an atlas without parcel solids name the labels they sample

- **Rule:** Under MRI colour (no paint) on an atlas without parcel solids, a cap without a region samples the cut atlas's labels and answers for no region itself. Isolating a label that only the cut atlas has (no solid stands for it) makes every cap sample, with isolation left to the sampled labels, so the isolated label shows.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/solid-assets.js:179-198`
- **Expected:** a NextBrain nucleus cap isolated under MRI → visible, `sampledLabels` false, region the nucleus. Isolating `destrieux:left:1` on a cut without a solid for it → `sampledLabels` true, region `null`, the cap visible. With a paint, or on a wedged atlas → `sampledLabels` false.
- **Covered by:** `src/lib/engine/tissues/gpu-sections.test.ts` (R, SLICE-36)

## Drawing the caps

### TISSUE-23 · A cut draws each solid's cross-section, not a stencil of the whole solid

- **Rule:** A solid whose section is sound is capped with its cross-section triangles only. Its stencil masks are off and the cap writes no stencil, so a cut through hundreds of parcels does not draw every solid twice.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/solid-sections.js:174-199, 324-367`
- **Expected:** an 18 × 18 × 18 segment 0.1 m box cut at z = 0 → back and front masks hidden, cap `stencilWrite` false, drawn triangles > 0 and < 1/5 of the box's; a ray at (0, 0, 0.2) hits, one at (0.08, 0, 0.2) does not.
- **Covered by:** `src/lib/engine/tissues/solid-sections.test.ts` (R)

### TISSUE-24 · A cut the sectioner refuses keeps the stencil cap, picked only inside the solid

- **Rule:** When the section is a fallback, the cap is a quad covering the whole plane, centred on the cut's bounds and sized to their diagonal, drawn through the winding-count stencil. A hit on it counts only where the faces behind it along the ray wind to a nonzero count, so a zero-thickness ribbon is not mistaken for inside.
- **Kind:** behaviour
- **Level:** unit for placement and picking; browser for the stencil drawing
- **Source:** `viewer/tissues/solid-sections.js:20-23, 54-66, 369-393, 433-441`
- **Expected:** a front-faces-only ribbon box placed with `{ fallback: true }` → `sectioned` false, quad scale > 0.1; a ray at (0.012, 0.009, 0.2) names `destrieux:left:2`; one at (0.08, 0, 0.2) → `null`.
- **Covered by:** `src/lib/engine/tissues/solid-sections.test.ts` (R)

### TISSUE-25 · Solids the plane misses or the painter hid are not drawn

- **Rule:** A solid the plane misses, or one painted invisible, is not drawn. A solid shown again on a plane that has not moved is cut and drawn then. An unmoved plane reuses the cuts it already made.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/solid-sections.js:174-199`
- **Expected:** a box with plane z = 0.4 → group hidden; plane z = 0 → shown. Invisible then `update(plane)` → hidden; visible then `update(plane)` again → shown with drawn triangles > 0.
- **Covered by:** `src/lib/engine/tissues/solid-sections.test.ts` (R)

### TISSUE-26 · Later bands and nested solids cap over the solids around them, without z-fighting

- **Rule:** Caps are drawn by band (envelopes, then parcel solids, then structures) and within a band larger solids first, whatever order they were loaded in. Each later cap is pushed one step further forward, and every cap lies on the same plane at the same place, so what draws last is what shows.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/solid-sections.js:145-160`; `viewer/tissues/solid-assets.js:17`
- **Expected:** bands envelope 0, ribbon 1, structure 2. `tract` (125 mm³) added before `cord` (8000 mm³), both band 2 → order cord, tract; group render order 1, 2; cap polygon offset units −1, −2 (factor −1). After a cut both caps have equal position, quaternion and scale.
- **Covered by:** `src/lib/engine/tissues/solid-sections.test.ts` (R); the order across bands is uncovered (the only case uses band 2 twice)

### TISSUE-27 · A cut hit names the nearest drawn cap and the solid it landed in

- **Rule:** A pick on the cut returns the nearest visible cap hit inside its solid; among caps within 1e-5 m of each other, the one drawn last (the one on top) wins. A caller can skip hits, which then fall through to the next cap. The hit names the solid and the region it answers for. The cord is pickable down its whole length in every orientation and retained side.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/solid-sections.js:407-431`
- **Expected:** two coplanar boxes, the later in band 2 → the later; skipping it → the first. The cord box (0.012 × 0.48 × 0.01 at (0.002, −0.3, 0.038)) cut through (0.002, −0.5, 0.038) along ±x, ±y, ±z and ±(1, 1, 1)/√3 → `pam50:midline:cord` each time. From either side of z = 0 a ray at (0.012, 0.009) hits, at x = 0.08 it does not; plane z = 0.06 → no hit.
- **Covered by:** `src/lib/engine/tissues/solid-sections.test.ts` (R)

### TISSUE-28 · Hover and selection lift the cap of the region they name, and leave its colour

- **Rule:** A cap's lift follows SHADER-18 for the region the cap answers for. The painted colour is not touched, so a repaint during a drag cannot wipe the lift. Leaving the region puts the lift back to 0.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/solid-sections.js:395-405`
- **Expected:** hover `destrieux:left:9` → its cap's `highlightLift` 0.26, `destrieux:left:2`'s 0; its colour stays `#123456`. `highlight({})` → 0.
- **Covered by:** `src/lib/engine/tissues/solid-sections.test.ts` (R)

### TISSUE-29 · The cut shares the model's geometry and BVH and never disposes them

- **Rule:** A solid draws from its source mesh's geometry and BVH, building the BVH only if the source has none, and leaves both to their owner on dispose. The BVH must be indirect, because the sectioner relies on triangles keeping their source order.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/solid-sections.js:87-92, 443-461`
- **Expected:** the probe's geometry is the source's; a second `SolidSections` keeps the same `boundsTree`; disposing both fires no `dispose` on the source geometry. A source with a non-indirect BVH → Error "Solid sources need an indirect BVH.".
- **Covered by:** `src/lib/engine/tissues/solid-sections.test.ts` (R; the indirect-BVH error is uncovered)

### TISSUE-30 · A cap that outgrows its buffers frees the old ones

- **Rule:** When a cut needs more cap vertices than the buffers hold, the old buffers are released before larger ones (at least twice the old size, and at least 96 values) take their place.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/solid-sections.js:324-333`; deviation `e3-cap-buffers-disposed.md`; decision 46 on #4
- **Expected:** after a cut, placing 9 more values than the buffer holds → the section geometry fires `dispose` once and has a new `position` attribute.
- **Covered by:** `src/lib/engine/tissues/solid-sections.test.ts` (R)

## The section worker

### TISSUE-31 · The worker cuts exactly what the main thread cuts

- **Rule:** A cut built off the pointer thread gives the same cap, bit for bit, as the synchronous cut, and installing it draws the same vertices. A job for a solid the worker does not hold comes back as a fallback. Solids whose positions cannot be sent (interleaved, normalised, or not three per vertex) are cut on the caller side and merged into the reply.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/section-worker.js:1-35`; `viewer/tissues/solid-sections.js:201-230, 305-322`
- **Expected:** a rotated, offset 18-segment box cut by z = 0, x = 0.01 and the (1, 1, 1) plane at −0.02 → worker positions equal `sectionTriangles` positions; after `applyBuild` and after `update` the cap vertices are equal. A cut message with job id 99 → `{ id: 99, fallback: true }`.
- **Covered by:** `src/lib/engine/tissues/solid-sections.test.ts` (R, through the worker module run in-thread); the caller-side merge is uncovered

### TISSUE-32 · A late build never overwrites a newer cut

- **Rule:** A background build is installed only if no synchronous cut ran since it started; otherwise it is dropped.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/solid-sections.js:232-248`
- **Expected:** `generation = sections.generation`, `build(plane)`, then `update(plane)`, then `applyBuild(plane, built, generation)` → false and the caps unchanged. Without the `update` → true.
- **Covered by:** `src/lib/engine/tissues/solid-sections.test.ts` (R, the true case); the stale drop is uncovered

### TISSUE-33 · Without `Worker` the caller cuts on its own thread

- **Rule:** The worker is used only where the platform has `Worker`. Without it a build declines, and the caller cuts synchronously. This is the only fallback.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/solid-sections.js:275-281`; deviation `e3-worker-errors.md`; decision 26 on #4
- **Expected:** no `Worker` global → `build(plane)` resolves `null`.
- **Covered by:** `src/lib/engine/tissues/solid-sections.test.ts` (R)

### TISSUE-34 · A worker failure is an error, not a silent main-thread cut

- **Rule:** A runtime error in the worker terminates it and rejects the pending build and every later one with that error.
- **Kind:** behaviour
- **Level:** unit
- **Source:** deviation `e3-worker-errors.md`; decision 26 on #4
- **Expected:** a worker whose cut raises "cut failed" → `build(plane)` rejects `/cut failed/`, the worker is terminated, and a second `build(plane)` rejects `/cut failed/`.
- **Covered by:** `src/lib/engine/tissues/solid-sections.test.ts` (R)

### TISSUE-35 · A disposed cut starts no worker and leaves no build waiting

- **Rule:** A warm-up scheduled before dispose starts no worker. Dispose terminates the worker and resolves pending builds with null.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/solid-sections.js:250-257, 443-450`
- **Expected:** `warm()`, `dispose()`, one tick → no `Worker` constructed. A pending `build` at dispose → resolves `null`.
- **Covered by:** `src/lib/engine/tissues/solid-sections.test.ts` (R, the warm-up); the pending build is uncovered

## Glass-brain ribbon solids

### TISSUE-36 · A solid region of the glass brain is closed by its ribbon solid

- **Rule:** Behind each region the glass brain draws solid, its ribbon wedge is drawn in the region's published colour while its patch is drawn, so the region does not read as a shell from behind. The wedge is pushed back in depth so the patch and its fold shading show on the shared pial face, and it is clipped by the cut. The group is visible only while one wedge is.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/glass-solids.js:12-52`
- **Expected:** material DoubleSide, polygon offset factor 1 and units 1, clearcoat 0.08 (0 on a phone). `solidOf(id)` {color: [255, 0, 0]} and shown → visible, linear (1, 0, 0); not shown or no record → hidden. Clipping planes are the ones passed (or null). No visible wedge → group hidden.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R, through the model), `src/lib/engine/tissues/glass-solids.test.ts` (R)

## Exposed native white matter

### TISSUE-37 · Hiding cortex lays open the white matter of that hemisphere

- **Rule:** A hemisphere's native white surface is shown when a removed region is a cortical parcel of the shown atlas in a shown hemisphere. Nothing is laid open while the cortex is hidden or transparent, or while a region is isolated. A removed id missing from the region index is a named error.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/white-matter-surfaces.js:5-17`; deviation `e3-exposed-white-matter-region.md`; decision 46 on #4
- **Expected:** a left `destrieux` parcel removed on `destrieux`, hemisphere `both` → {left}; hemisphere `right` → {}; on `hcp-mmp` → {}; cortex opacity 0 or isolation → {}. Removed `nope` → Error "Hidden region nope is not in the region index.".
- **Covered by:** `src/lib/engine/tissues/solid-assets.test.ts` (R, the error), `src/lib/engine/model/brain-atlas.test.ts` (R, through the model), `src/lib/engine/tissues/white-matter-surfaces.test.ts` (R)

### TISSUE-38 · The exposed white surface is white tissue that follows the cortex opacity

- **Rule:** The exposed surfaces are drawn as white tissue (double-sided, manifest lighting, no clear coat on a phone), with the cortex's opacity, transparent and without depth writes below 1, and clipped by the cut. The envelope group must hold exactly one white surface per hemisphere; its meshes start hidden.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/white-matter-surfaces.js:19-65`
- **Expected:** colour `#e5dbc5`, kind `non-region`. Cortex opacity 0.4 → opacity 0.4, transparent, no depth write; 1 → opaque with depth write. An empty group → Error "Expected one native left white-matter surface.".
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R, visibility through the model), `src/lib/engine/tissues/white-matter-surfaces.test.ts` (R)
