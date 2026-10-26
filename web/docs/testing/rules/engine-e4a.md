# Engine E4a rules: slices, volumes and GPU sections

Scope: chunk E4a (#27), plus the plane rules of F2 that `parity/f2.test.ts` checks against the fake
engine. It covers the coordinate frames of a cut, CPU sampling of the published MRI and label volumes,
the linked MRI slice images and their point readout, the cut controller (`BrainSections`: modes,
range, crosshair, cut atlas, status) and the GPU cut faces (`TissueSections`: caps, the sampled label
plane, picking, highlight). Legacy sources: `viewer/slices/coordinates.js`, `viewer/slices/sampling.js`,
`viewer/slices/volume.js`, `viewer/slices/sections.js`, `viewer/tissues/gpu-sections.js`. New code:
`web/src/lib/engine/slices/*.ts`, `web/src/lib/engine/tissues/gpu-sections.ts`. Deviations:
`e4a-cut-atlas-rollback.md`, `e4a-fail-fast-sections.md`, `e4a-model-change-single-report.md`,
`e4a-offset-ready-while-off.md`. RAS is the source surface RAS in millimetres throughout. SLICE-01–SLICE-05 restate the coordinate rules that `engine-e1.md` owns as RENDER-38–RENDER-42; they keep their IDs, but each is tested once, under the RENDER ID. "The contract suite" below is `src/lib/engine/fake/contract-suite.ts`, run on the real engine by `src/lib/engine/index.svelte.test.ts` and on the fake by `src/lib/engine/contract.test.ts`.

## Coordinates and frames

### SLICE-01 · Source RAS and scene coordinates

- **Rule:** Stated once as RENDER-38 (`engine-e1.md`); this entry only points there, so the rule is tested once.
- **Kind:** scientific/data
- **Level:** unit
- **Source:** see RENDER-38
- **Expected:** see RENDER-38
- **Covered by:** see RENDER-38

### SLICE-02 · Standard section planes and their orientation letters

- **Rule:** Stated once as RENDER-39 (`engine-e1.md`), RENDER-42 (`engine-e1.md`); this entry only points there, so the rule is tested once. No business-rule test checks the edge letters yet.
- **Kind:** behaviour
- **Level:** unit
- **Source:** see RENDER-39, RENDER-42
- **Expected:** see RENDER-39, RENDER-42
- **Covered by:** see RENDER-39, RENDER-42

### SLICE-03 · Oblique angles

- **Rule:** An oblique cut accepts a tilt from 0 to 90° and an azimuth from −180 to 180°, rejecting anything else with a RangeError. The normal is (sin t·cos a, sin t·sin a, cos t), and the frame is orthonormal and anchored to the crosshair.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/slices/coordinates.js:39-47`; `viewer/slices/sections.js:357-361`; the frame half is RENDER-39 (`engine-e1.md`)
- **Expected:** tilt 38°, azimuth 71° → unit u, v, n, mutually orthogonal, and the plane passes through the crosshair (distance 0 ± 1e-10); `setAngles(120, 0)` and azimuth 200 → RangeError.
- **Covered by:** `src/lib/engine/slices/coordinates.test.ts` (R, orthonormal and anchored; the normal formula is not checked); the contract suite (R, `setAngles(120, 0)` RangeError and stored angles); `src/lib/engine/slices/sections.test.ts` (R, every tilt × azimuth step accepted); `parity/E1.test.ts` (D, formula); `parity/f2.test.ts` (D, fake only). Azimuth 200: only D.

### SLICE-04 · Which half a cut removes

- **Rule:** Stated once as RENDER-40 (`engine-e1.md`); this entry only points there, so the rule is tested once.
- **Kind:** behaviour
- **Level:** unit
- **Source:** see RENDER-40
- **Expected:** see RENDER-40
- **Covered by:** see RENDER-40

### SLICE-05 · A cut through a point

- **Rule:** Stated once as RENDER-41 (`engine-e1.md`); this entry only points there, so the rule is tested once.
- **Kind:** behaviour
- **Level:** unit
- **Source:** see RENDER-41
- **Expected:** see RENDER-41
- **Covered by:** see RENDER-41

## Volumes

### SLICE-06 · Volume header checks

- **Rule:** A volume is accepted only with three positive integer dimensions in Fortran order, data whose length is their product, and a finite, non-singular 4×4 voxel-to-RAS affine.
- **Kind:** scientific/data
- **Level:** unit
- **Source:** `viewer/slices/volume.js:6-19`
- **Expected:** shape `[2, 3, 4]` with 1 value → `/length/`; order `'C'`, a singular affine or a non-finite entry → error.
- **Covered by:** `src/lib/engine/slices/volume.test.ts` (S, length only). Order, affine and shape checks: uncovered.

### SLICE-07 · Volume download integrity

- **Rule:** A volume file is used only if the SHA-256 of the compressed bytes, the decoded byte length and the SHA-256 of the decoded bytes all match the header, and its dtype is `|u1` or little-endian `<u2`. Anything else is an error, not a partial volume.
- **Kind:** scientific/data
- **Level:** unit
- **Source:** `viewer/slices/volume.js:70-86`
- **Expected:** a one-byte change in the file → "Volume file checksum mismatch."; wrong decoded length or hash → "Decoded volume integrity check failed."; dtype `<f4` → "Unsupported volume data type".
- **Covered by:** uncovered for every failure. The success path runs on the published files in `src/lib/engine/model/brain-atlas.cut.test.ts` and the contract suite (W: a matching checksum is not a check of the refusal).

### SLICE-08 · MRI intensity is trilinear

- **Rule:** The MRI intensity at a RAS point is the trilinear interpolation of the eight surrounding voxels. It is exact at voxel centres and 0 outside the grid.
- **Kind:** scientific/data
- **Level:** unit
- **Source:** `viewer/slices/volume.js:56-67`
- **Expected:** with ramp `x + 10y + 40z` and the identity affine: `[1,2,3]` → 141, `[1.5,1.5,1.5]` → 76.5, `[3,3,3]` → 153, `[-1,0,0]` → 0 (exact).
- **Covered by:** `src/lib/engine/slices/volume.test.ts` (S)

### SLICE-09 · Label sampling never invents a label

- **Rule:** The label at a point is the label with the largest summed trilinear weight over the eight surrounding voxels (ANTs genericLabel). It is exact at voxel centres, never a label absent from those eight, and ties go to the first corner in x-fastest order. Outside the grid counts as background 0.
- **Kind:** scientific/data
- **Level:** unit
- **Source:** `viewer/slices/volume.js:33-54`
- **Expected:** ramp: `[1.4]³` → 51, `[1.6]³` → 102, `[1.5]³` → 51; corner `[4,9,9,9,4,9,9,9]`: `[0.4,0.4,0.5]` → 9, `[0.2,0.2,0.5]` → 4; all-7 cube: `[-0.4,.5,.5]` → 7, `[-0.6,.5,.5]` → 0.
- **Covered by:** `src/lib/engine/slices/volume.test.ts` (S)

### SLICE-10 · Each volume is read through its own affine

- **Rule:** Every sampler (CPU label, CPU intensity, GPU label, GPU MRI) maps RAS to voxels through that volume's own affine, so flipped or anisotropic axes keep hemisphere and spacing.
- **Kind:** scientific/data
- **Level:** unit
- **Source:** `viewer/slices/volume.js:6-31`; `viewer/slices/coordinates.js:7-12`
- **Expected:** affine `[[-2,0,0,11],[0,0,4,-7],[0,-3,0,13]]`, voxel (1,2,3) = 73 → `label([9,5,7])` = `linear([9,5,7])` = 73; the GPU MRI matrix maps RAS `[1,5,1]` to voxel (1,1,1) ± 1e-12.
- **Covered by:** `src/lib/engine/slices/volume.test.ts` (S), `src/lib/engine/tissues/gpu-sections.test.ts` (S)

## Linked MRI slice images

### SLICE-11 · Slice image geometry

- **Rule:** A slice image is a square grid sampled at pixel centres across the field of view. Rows run from superior/anterior at the top to inferior/posterior, and the canvas origin is top-left.
- **Kind:** scientific/data
- **Level:** unit
- **Source:** `viewer/slices/coordinates.js:67-72`; `viewer/slices/sampling.js:2-29`
- **Expected:** 4×4 ramp, axial at `[1.5, 1.5, 1]`, FOV 4, size 4, window 127.5/255: first pixel `[70,70,70,255]`, last `[43,43,43,255]`; `pointOnFrame(frame, .125, .125, 4)` = `[0, 3, 1]`.
- **Covered by:** `src/lib/engine/slices/sampling.test.ts` (S); `parity/E4a.test.ts` (D, seeded sweep)

### SLICE-12 · MRI window

- **Rule:** The grey level is `clamp((I − centre + width/2) · 255 / width, 0, 255)`. The default window comes from `volumes.json`, and the reader can change it.
- **Kind:** scientific/data
- **Level:** unit
- **Source:** `viewer/slices/sampling.js:18-20`; `viewer/slices/sections.js:162-170`
- **Expected:** centre 127.5, width 255 → grey = I (see SLICE-11); I = 100, centre 90, width 20 → 255; I = 70 → 0.
- **Covered by:** `src/lib/engine/slices/sampling.test.ts` (S, identity window only); `parity/E4a.test.ts` (D, seeded windows). Non-identity windows: only D.

### SLICE-13 · Label overlay

- **Rule:** With the overlay on, a labelled pixel is 0.55 × grey + 0.45 × the label's published colour; with it off, the pixel is grey. A pixel whose label is 0 is fully transparent (alpha 0); every other pixel is opaque.
- **Kind:** scientific/data
- **Level:** unit
- **Source:** `viewer/slices/sampling.js:21-27`
- **Expected:** grey 70 under red `[255,0,0]` → `[153, 38, 38, 255]` (153.25 and 38.5, rounded by `Uint8ClampedArray`, ties to even); a plane outside the head → alpha 0.
- **Covered by:** `src/lib/engine/slices/sampling.test.ts` (S, weak: only `pixels[0] > pixels[1]` and alpha 0; the mutation 0.55/0.45 → 0.3/0.7 survives); `parity/E4a.test.ts` (D). The blend weights are effectively covered only by D.

### SLICE-14 · Invalid slice display is refused

- **Rule:** A slice is drawn only for an integer size from 2 to 2048, a positive field of view, a finite window centre and a positive window width; otherwise RangeError.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/slices/sampling.js:4-9`
- **Expected:** size 1, size 2.5, FOV 0, width 0 → RangeError.
- **Covered by:** `parity/E4a.test.ts` (R part of a D file); no unit test

### SLICE-15 · Point readout under the crosshair

- **Rule:** Sampling a point returns the segmentation label id, that label's name from `volumes.json`, the structure region whose `source_label_id` matches (or none), the trilinear MRI intensity and the point. Before the linked MRI has loaded, it fails with "The linked MRI has not loaded." and so does drawing a slice.
- **Kind:** scientific/data
- **Level:** unit
- **Source:** `viewer/slices/sections.js:414-430`; deviation `e4a-fail-fast-sections.md`
- **Expected:** on the published CDMD volumes, fixed points with known aseg labels give fixed `{labelId, name, region.id, intensity}` (to be tabulated from the data); `sample()` before `load()` → Error "The linked MRI has not loaded."
- **Covered by:** `parity/E4a.test.ts` (D, 2003 points against legacy). The contract suite (R for the precondition: `sample` and `pixels` throw before `load()`, message not asserted; W for the result: only `ras` is checked, and `labelId`/`name` by type). No fixed published point is tabulated: uncovered.

## The cut controller

### SLICE-16 · Cut modes and the latest request

- **Rule:** The cut is off, sagittal, coronal, axial or oblique, and any other mode is an error. When modes are chosen while a load is pending, the last choice wins. The model is told whether a cut is active and which atlas it shows, so cut-only regions follow it (see ATLAS-19).
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/slices/sections.js:7`, `:241-256`, `:467-472`
- **Expected:** `setMode('coronal')` pending, then `setMode('off')` → mode `off`; `setMode('diagonal')` → "Unknown cut mode: diagonal".
- **Covered by:** `src/lib/engine/slices/sections.test.ts` (R, latest mode wins); the contract suite (R, "Unknown cut mode", cut reported to the model); `parity/f2.test.ts` (D, fake only)

### SLICE-17 · Coordinate bounds

- **Rule:** The cut and crosshair may move within ±128 mm on each axis, widened (floor/ceil) to every supplemental layer's published bounds. The spinal cord's bounds count only while the cord is shown, so a hidden cord does not stretch the axial range.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/slices/sections.js:107-126`
- **Expected:** cord bounds z −550…−60, cord hidden → axial range `[-128, 128]`; cord shown → `[-550, 128]`; the limit is the largest absolute bound.
- **Covered by:** `src/lib/engine/slices/sections.test.ts` (R); `parity/E4a.test.ts` (D)

### SLICE-18 · Offset range

- **Rule:** A standard cut's offset range is the coordinate bounds on its axis (off uses axial). An oblique range is the bounds projected on the normal, cut back to where the crosshair foot stays within the limit. Every offset the slider can reach in 0.5 mm steps, and its maximum, is a legal cut.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/slices/sections.js:128-144`
- **Expected:** published manifest, cord hidden, oblique 30°/30° → `[-147.8, 147.8]` (rounded to 0.1); every tilt 0..90 step 5 × azimuth −180..180 step 15, cord hidden or shown: `crosshairFor(maximum + 0.01)` → RangeError and every in-range step succeeds.
- **Covered by:** `src/lib/engine/slices/sections.test.ts` (R); the contract suite (R, weak: the sagittal range contains ±128 and `setOffset(maximum + 1)` is a RangeError); `parity/E4a.test.ts` (D); `parity/f2.test.ts` (D, fake only)

### SLICE-19 · Crosshair and offset validation

- **Rule:** A crosshair must be three finite values within ± the coordinate limit. Moving the offset of a standard cut changes only the coordinate along its normal; an oblique offset puts the crosshair at the foot of the plane on its normal. An out-of-range offset is a RangeError naming the range.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/slices/sections.js:258-304`
- **Expected:** cord shown, axial `setOffset(-500)` → crosshair z −500; then sagittal `setOffset(0)` keeps z −500; oblique 45°/0° from `[100, 0, -100]` with offset 60 → crosshair·normal = 60 ± 1e-10, all coordinates within ±128; `setCrosshair([1e6,0,0])`, NaN → RangeError.
- **Covered by:** `src/lib/engine/slices/sections.test.ts` (R); the contract suite (R, `setCrosshair([1e6, 0, 0])` and NaN RangeError, `setOffset(10)` and `setOffsetReady(-20)`); `parity/f2.test.ts` (D, fake only)

### SLICE-20 · A shrinking range pulls the crosshair in

- **Rule:** When a display change (such as hiding the cord) shrinks the range under an open cut, the crosshair moves to the nearest legal offset.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/slices/sections.js:76-82`
- **Expected:** axial at z −500 with the cord shown; hide the cord → range `[-128, 128]`, crosshair z −128.
- **Covered by:** `src/lib/engine/slices/sections.test.ts` (R)

### SLICE-21 · Choosing the cut atlas

- **Rule:** The cut samples its own atlas, which starts at the surface atlas and then changes independently. If a cut atlas fails to load, the choice goes back to the last cut atlas that finished loading, but only while the state still names the one that failed. Only the latest request reports the failure.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/slices/sections.js:332-355`; deviation `e4a-cut-atlas-rollback.md`
- **Expected:** a failing `hcp-mmp`, overtaken by `nextbrain` which loads → cut atlas `nextbrain`, status `ready`; a lone failing `hcp-mmp` → `destrieux`, status `error`; two failures, older first → `nextbrain` after the first, `destrieux` after the second; failure overtaken by `setMode` → `destrieux`.
- **Covered by:** `src/lib/engine/slices/sections.test.ts` (R); the contract suite (R, a failed `setCutAtlas('no-such-atlas')` leaves the previous cut atlas)

### SLICE-22 · Surface colour chosen through the cut

- **Rule:** MRI surface colour waits for the T1 to load. A later colour choice, or another scene command, overtakes a pending one: the download lands without changing the colour, and the status goes back from loading to ready.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/slices/sections.js:203-239`
- **Expected:** `mri` pending, then `tissue` → colour `tissue`; `mri` pending, then the command ends → colour stays `atlas`, status `ready`.
- **Covered by:** `src/lib/engine/slices/sections.test.ts` (R); the contract suite (R, an overtaken `functional` download lands without a colour change)

### SLICE-23 · Setting the MRI window

- **Rule:** A window needs a finite centre and a positive width, and only once the linked MRI has loaded. It applies to both the MRI surface renderer and the linked slices.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/slices/sections.js:377-385`
- **Expected:** `setWindow(100, 120)` → slices and renderer both at 100/120; width 0 → RangeError.
- **Covered by:** `src/lib/engine/slices/sections.test.ts` (R); the contract suite (R, a window before `load()` and a width of 0 are RangeErrors)

### SLICE-24 · Linked MRI views download only what they lack

- **Rule:** Opening the linked MRI views reuses the T1 the cut or the MRI colour already holds and downloads only the segmentation. A failure leaves the cut status `error` with code `asset-fetch` or `asset-updated` passed through, and `cut-failed` otherwise.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/slices/sections.js:146-183`, `:460-466`
- **Expected:** after a coronal cut on CDMD, `load()` fetches exactly `['aseg.volume']` and the MRI views hold the cut's T1 volume; an HTTP 503 → rejects with code `asset-fetch` and `state.error === 'asset-fetch'`.
- **Covered by:** `src/lib/engine/model/brain-atlas.cut.test.ts` (R), `src/lib/engine/slices/sections.test.ts` (R); the contract suite (W, only that `load()` resolves and `volumesLoaded` turns true). `cut-failed`: uncovered.

### SLICE-25 · Dragging the plane

- **Rule:** While the reader drags, the picture stays on the last complete cut until the next caps are ready. A build that lands after the cut has closed, or after a newer build, changes nothing. The offset can also be set while the cut is off, which only stores the crosshair.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/slices/sections.js:274-330`; deviation `e4a-offset-ready-while-off.md`
- **Expected:** axial, drag to 10, `setMode('off')`, build lands → group hidden, no clipping planes, crosshair `[0,0,0]`; mode off, `setOffsetReady(10)` → crosshair `[0,0,10]`, mode still `off`.
- **Covered by:** `src/lib/engine/slices/sections.test.ts` (R)

### SLICE-26 · A failure is reported once

- **Rule:** One failed reload of the cut after a model change produces one error report and one status change to `error`.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/slices/sections.js:83-88`, `:241-251`; deviation `e4a-model-change-single-report.md`
- **Expected:** cut atlas layer gone, reload rejects → exactly one `console.error`, status `error`.
- **Covered by:** `src/lib/engine/slices/sections.test.ts` (R)

### SLICE-27 · Picking with a cut open

- **Rule:** The pick is whichever is nearer: the visible surface or the cut face (ties within 1e-9 go to the cut face). A cut face that is not selectable blocks the surface behind it. Picking a cut face never needs the linked MRI.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/slices/sections.js:437-458`
- **Expected:** a surface at 0.2 and an unselectable cap at 0.1 → `null`; no cap → the surface region; a coronal cut with the MRI unloaded picks the cap's region and leaves `volumes` null.
- **Covered by:** `src/lib/engine/slices/sections.test.ts` (R)

### SLICE-28 · An open cut follows the display

- **Rule:** An open cut redraws when hemisphere, cortex visibility or opacity, isolation, internal system or visibility, surface colour, functional level, paint, detail, cord visibility or the hidden set changes. If the cut atlas or the detail level's caps are not loaded, it hides and reloads first.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/slices/sections.js:57-93`
- **Expected:** hiding the internal anatomy under an axial cut → one redraw.
- **Covered by:** `src/lib/engine/slices/sections.test.ts` (R, counted as stub calls)

## GPU cut faces

### SLICE-29 · Solid caps or the sampled label plane

- **Rule:** The cut is capped by solids when the atlas has parcel solids, under tissue colour, or under MRI colour without a paint. Otherwise it shows the sampled label plane. Supplemental anatomy (the cord) is always capped.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/gpu-sections.js:290-338`
- **Expected:** a surfaceless atlas: tissue → caps, label plane hidden; atlas or network → label plane; a wedged atlas → caps in every mode and under isolation; the cord cap visible and pickable in tissue, atlas and network.
- **Covered by:** `src/lib/engine/tissues/gpu-sections.test.ts` (R); `parity/E4a.test.ts` (D)

### SLICE-30 · The cut shows only what the display shows

- **Rule:** On the cut face, a removed region, a region of the hidden hemisphere and anything other than the isolated region are not drawn and cannot be picked. Changing the display refreshes the cut's colours.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/gpu-sections.js:346-365`, `:387-434`
- **Expected:** label 11101 alpha 1, then hidden → alpha 0 and the pick is `null`; hemisphere `right` → the left label's pick is `null`; isolating another region → `null`; a hidden region's cap → not visible.
- **Covered by:** `src/lib/engine/tissues/gpu-sections.test.ts` (R); `parity/E4a.test.ts` (D)

### SLICE-31 · Published colours are not shaded

- **Rule:** The T1 brightness modulation of the cut applies only under tissue colour. Under atlas, network, CAB-NP, functional or paint colours it is 0, so the cut matches its key.
- **Kind:** scientific/data
- **Level:** unit
- **Source:** `viewer/tissues/gpu-sections.js:339-345`
- **Expected:** atlas → `tissueVariation` 0; tissue → `appearance.intensity.cut_strength` (> 0).
- **Covered by:** `src/lib/engine/tissues/gpu-sections.test.ts` (R); `parity/E4a.test.ts` (D)

### SLICE-32 · GPU and CPU agree on the voxel

- **Rule:** The GPU cut reads the same voxel the CPU sampler reads for every RAS point.
- **Kind:** scientific/data
- **Level:** unit
- **Source:** `viewer/slices/coordinates.js:7-12`; `viewer/tissues/gpu-sections.js:265`
- **Expected:** over a 0.25 mm grid around the fixture volume, the GPU matrix voxel = `volume.voxel(ras)` ± 1e-12.
- **Covered by:** `src/lib/engine/tissues/gpu-sections.test.ts` (S)

### SLICE-33 · A cap names the anatomy it drew

- **Rule:** Pointing at a solid cap names the region that cap was drawn from, not the label voxel underneath. A sampled face names the visible label's region, and background is no region.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/gpu-sections.js:401-434`
- **Expected:** a NextBrain nucleus cap over a Destrieux voxel → `nextbrain:right:10119`; the sampled face over label 11101 → `destrieux:left:1`.
- **Covered by:** `src/lib/engine/tissues/gpu-sections.test.ts` (R); `parity/E4a.test.ts` (D)

### SLICE-34 · Gyral white matter on the cut

- **Rule:** For an atlas the white-matter parcellation serves, a white-matter cap names the wmparc parcel under the pointer. For other atlases the white matter is plain. Isolating one parcel leaves only that parcel pickable.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/gpu-sections.js:387-399`, `:436-440`
- **Expected:** a destrieux cut → `wmparc:left:3035` (insula); a nextbrain cut → `destrieux:left:1`; precentral isolated → `null`, insula isolated → insula.
- **Covered by:** `src/lib/engine/tissues/gpu-sections.test.ts` (R)

### SLICE-35 · Highlighting on the cut

- **Rule:** The pointed-at region and the selected region are lit on cut faces (sampled faces, caps and white-matter parcels) with the hover and selection lifts. The lift clears when the pointer leaves and survives a redraw.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/gpu-sections.js:369-385`
- **Expected:** hovered `destrieux:left:1` → codes `[1, -1]`, lifts `[HIGHLIGHT_LIFT.hovered, 0]`; `{}` → `[-1, -1]`; selected, then a redraw → `[-1, 1]`; a white-matter parcel selected → `[-1, 2]`.
- **Covered by:** `src/lib/engine/tissues/gpu-sections.test.ts` (R, through uniforms); `src/lib/engine/slices/sections.test.ts` (I, the highlight is passed through to a stub); `parity/E4a.test.ts` (D)

### SLICE-36 · A cut-only atlas under MRI colour

- **Rule:** Under MRI colour, a cap drawn from a structure keeps that structure's identity and isolation. Isolating a label that exists only in the cut atlas switches the caps to that atlas's labels, so the isolated label shows and picks.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/gpu-sections.js:290-300`, `:387-415`
- **Expected:** nucleus isolated → the pick is the nucleus, `sampledLabels` false; isolating `destrieux:left:1` → `sampledLabels` true, the pick is `destrieux:left:1`; isolating another region → `null`.
- **Covered by:** `src/lib/engine/tissues/gpu-sections.test.ts` (R)

### SLICE-37 · The first cut reuses what the model holds

- **Rule:** The first cut builds its solids from the model's own envelopes, detail meshes, cord and ribbon wedges, and downloads none of them twice. The wedges are kept per atlas, and a nucleus cap keeps its published colour.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/gpu-sections.js:132-181`, `:216-240`
- **Expected:** CDMD, destrieux, first coronal cut → GLBs parsed exactly `cortex-destrieux, learning, spinal-cord, tissue-envelopes`, none fetched by the cut; number of solids = envelopes + learning + cord + wedges; a second `ensureRibbonWedges('destrieux')` fetches no `.labels`.
- **Covered by:** `src/lib/engine/model/brain-atlas.cut.test.ts` (R)

### SLICE-38 · Moving the cut uploads nothing new

- **Rule:** Dragging the plane or changing its orientation moves the existing clipping plane and cut face. It does not rebuild the face geometry, re-upload the label volume or palette, or send a display change that would repaint every surface material, so the drag stays fluid.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/slices/sections.js:274-304`; `viewer/tissues/gpu-sections.js:290-338`
- **Expected:** With an axial cut open, 121 `setOffset` calls from −30 to 30 mm keep the same `clippingPlanes` array, emit 0 model `change` events, and leave the plane through world y = 0.03 at the last offset (± 1e-12). Updating the cut face through every orientation at 201 offsets each keeps the same face geometry (6 indices), the same volume and palette data, and unchanged texture versions.
- **Covered by:** `src/lib/engine/slices/sections.test.ts` (R), `src/lib/engine/tissues/gpu-sections.test.ts` (R)
