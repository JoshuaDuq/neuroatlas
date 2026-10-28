# Engine E2 rules: materials, shader patches and lighting

Scope: chunk E2 (#25). It covers what colour and light every drawn surface gets: the tissue-class
colours, the cortical surface material with its fold shading and network blend, the per-vertex
network colours, the MRI appearance and its mark, the sampled cut face and its label lookup, the
cut-face lift, the cut palette, the solid cap material, gyral white matter on the cap, the cap
labels of cut-only atlases, the shader half of the border feather, the light rig, and how the nine
`onBeforeCompile` patches compose (decision 25 on #4). Legacy sources: `viewer/render/materials.js`,
`mri-material.js`, `network-colors.js`, `lighting.js`, `border-feather.js:202-249`,
`viewer/tissues/highlight.js`, `label-sampling.js`, `shader.js`, `solid-material.js`,
`cap-labels.js`, `palette.js`, `white-matter.js` (moved to E2 by decision 11). New code:
`web/src/lib/engine/render/{materials,mri-material,network-colors,lighting,border-feather}.ts`,
`web/src/lib/engine/tissues/{highlight,label-sampling,shader,solid-material,cap-labels,palette,white-matter}.ts`.
The feather's geometry half is RENDER-35 to RENDER-37 (`engine-e1.md`); the cut controller that
drives these materials is SLICE-29 to SLICE-36 (`engine-e4a.md`). No deviation records.

Values below come from the published CDMD manifest (`public/models/cdmd/manifest.json`
`appearance`, equal to `config/model.yaml` except that only the manifest carries `field_ranges`):
tissue cortex `#c4a897`, gray `#a68d80`, white `#e5dbc5`, fluid `#67777c`, unlabelled `#c4a897`;
roughness 0.62, clearcoat 0.08, clearcoat roughness 0.45, ior 1.38, specular intensity 0.55;
intensity low 85, high 180, surface strength 0.28, cut strength 0.5, solid relief 1.2 mm; folds
low −0.5, high 1.8, concavity −0.08 to 0.04, direct 0.48, indirect 0.78; lighting hemisphere 0.28,
key 1.8, fill 0.5, rim 0.7. Colours named "linear" are sRGB bytes / 255 decoded to linear RGB.
A rule about shader output is stated as the colour a fragment gets; it needs a real GL context
(Vitest browser mode, SwiftShader) to prove, and its uniform half can be checked in unit tests.
The legacy comparison file `parity/E2.test.ts` is deleted; a rule that lists no test needs a browser pixel test.

## Tissue colours

### SHADER-01 · Display colours name tissue classes, never a measured albedo

- **Rule:** A region is drawn in its tissue class colour. A declared `tissue` that the palette names wins. Otherwise a non-region is unlabelled and a cortex parcel is cortex. Otherwise the source name decides: a ventricle or CSF token is fluid, a white-matter or callosum name is white, and everything else, a nameless region included, is grey matter.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/materials.js:5-13`
- **Expected:** `{tissue:'white'}` → `#e5dbc5`; `{tissue:'bogus', kind:'cortex'}` → `#c4a897`; `{kind:'non-region'}` → `#c4a897` (unlabelled). Names → fluid `#67777c`: `Left-Lateral-Ventricle`, `Right-Inf-Lat-Vent`, `3rd-Ventricle`, `CSF`. Names → white `#e5dbc5`: `Left-Cerebral-White-Matter`, `CC_Body`, `corpus callosum`. Names → gray `#a68d80`: `Left-paraventricular_nucleus_of_hypothalamus`, `Right-periventricular_nucleus__supraoptic_portion`, `Left-juxtaparaventricular_lateral_hypothalamic_area`, `Left-Caudate`, `''`, no name. A cord cap with `tissue:'fluid'` named `Central canal` → fluid.
- **Covered by:** `src/lib/engine/tissues/palette.test.ts` (R, ventricle and nucleus names), `src/lib/engine/tissues/solid-assets.test.ts` (R, declared tissue), `src/lib/engine/render/materials.test.ts` (R)

## The cortical surface material

### SHADER-02 · A surface takes the manifest's tissue lighting and keeps its published colour

- **Rule:** Every anatomical surface is a physical material with the manifest's roughness, coat, index of refraction and specular intensity, and the colour of its published glTF material. On a phone it has no clear coat, because the second lighting pass is what drops frames there.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/materials.js:104-113`
- **Expected:** a glTF material `#336699` → `color` `#336699`, roughness 0.62, clearcoat 0.08, clearcoatRoughness 0.45, ior 1.38, specularIntensity 0.55. With `matchMedia` reporting a phone → clearcoat 0, the rest unchanged.
- **Covered by:** `src/lib/engine/render/materials.test.ts` (R)

### SHADER-03 · A cortical surface without its shading fields is refused

- **Rule:** A cortex or non-region mesh must carry `_sulc`, `_concavity` and `_t1`, one value per vertex. Anything else is an error naming the field and the region, not an unshaded surface. Structures and tissue regions take no fold shading and need no fields.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/materials.js:114-125`
- **Expected:** cortex region `r` without `_t1` → Error "Missing source shading attribute _t1: r". `_sulc` with itemSize 2, or a count other than the position count → the same error for `_sulc`. A `structure` mesh with no fields → a material, no error, no fold patch.
- **Covered by:** `src/lib/engine/render/materials.test.ts` (R)

### SHADER-04 · Shading fields are read back in their source units

- **Rule:** The published shading fields are normalised to 0..1 over a span the manifest records in `field_ranges`. The surface reads each value back as `stored × (high − low) + low`. A file without `field_ranges` is read straight through.
- **Kind:** scientific
- **Level:** unit (the decode uniforms); browser for the per-fragment result
- **Source:** `viewer/render/materials.js:15-26, 43-45`
- **Expected:** CDMD `_SULC` [−14.0466, 17.3979] → decode (−14.0466, 31.4445), stored 0.5 → 1.6756 mm ± 1e-4; `_T1` [38.9863, 203.2353] → decode (38.9863, 164.2490), stored 0.5 → 121.1108 ± 1e-4; `_CONCAVITY` [−0.6106, 0.5810]. Without `field_ranges` every decode is (0, 1).
- **Covered by:** `src/lib/engine/render/materials.test.ts` (R)

### SHADER-05 · The T1 signal varies the surface colour by up to the surface strength

- **Rule:** Under tissue colour, a surface is brighter where the registered T1 is high and darker where it is low: colour × (1 + s·(2i − 1)), with i = clamp((T1 − low) / (high − low), 0, 1). The model sets s to 0 under a published palette, so atlas, network and paint colours are not distorted.
- **Kind:** scientific
- **Level:** browser — real WebGL for the drawn colour; unit for the uniforms
- **Source:** `viewer/render/materials.js:36-38, 87-88`
- **Expected:** uniforms `t1Range` [85, 180], `tissueVariation` 0.28 at creation. Drawn (lights off, unit diffuse): T1 ≤ 85 → colour × 0.72; T1 132.5 → × 1.00; T1 ≥ 180 → × 1.28, each ± 1/255.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R, `tissueVariation` 0.28 under tissue and 0 under atlas and CAB-NP colours), `src/lib/engine/render/materials.test.ts` (R, uniforms)

### SHADER-06 · Folds darken the light that reaches the sulci

- **Rule:** A fold amount mixes sulcal concavity (three quarters) and sulcal depth (one quarter), each through a smoothstep over the manifest's range. Direct diffuse light is scaled by (1 − direct·fold); indirect diffuse and specular light by (1 − indirect·fold). Colour is not touched, only light.
- **Kind:** scientific
- **Level:** browser — real WebGL
- **Source:** `viewer/render/materials.js:92-97`
- **Expected:** a gyral crown (concavity ≤ −0.08, depth ≤ −0.5) → fold 0, light unchanged. A fundus (concavity ≥ 0.04, depth ≥ 1.8) → fold 1: direct diffuse × 0.52, indirect diffuse and specular × 0.22. Concavity ≥ 0.04 with depth ≤ −0.5 → fold 0.75: direct × 0.64.
- **Covered by:** `src/lib/engine/render/materials.test.ts` (R, the fold uniforms); the drawn darkening is uncovered (needs a browser pixel test)

### SHADER-07 · Network colours blend over the region colour, never on the medial wall

- **Rule:** On a surface built with the network layer, the region colour mixes toward the vertex's network colour by the network mix times the vertex's network presence. The medial wall has presence 0 and keeps its region colour at any mix. A surface built without the layer has no network mix at all.
- **Kind:** behaviour
- **Level:** browser for the drawn colour; unit for `userData`
- **Source:** `viewer/render/materials.js:36-39, 82-86`; mix set by `viewer/model/brain-atlas.js:548-549`
- **Expected:** geometry with `_network` → `userData.networkMix` `{ value: 0 }`; without → `null`. Drawn with mix 1: presence 1 → the network colour; presence 0 → the region colour. Mix 0.5, presence 1 → the midpoint ± 1/255.
- **Covered by:** `src/lib/engine/render/materials.test.ts` (R, userData)

## Network colours

### SHADER-08 · Each vertex takes its network's published colour, in linear RGB

- **Rule:** A vertex whose `_network` index is k (1 to 7) takes the colour the manifest publishes for the k-th network, decoded from sRGB, with presence 1. Interpolating colours rather than indices means a triangle between two networks blends those two only.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/render/network-colors.js:4, 19-36`
- **Expected:** CDMD networks `Vis, SomMot, DorsAttn, SalVentAttn, Limbic, Cont, Default`. Index 1 (Vis [120, 18, 134]) → [0.187821, 0.006049, 0.238398, 1] ± 1e-6; index 7 (Default [205, 62, 78]) → [0.610496, 0.048172, 0.076185, 1] ± 1e-6. Red 0.1878 < 120/255, so the palette is not drawn washed out.
- **Covered by:** `src/lib/engine/render/network-colors.test.ts` (R)

### SHADER-09 · A vertex in no network is left transparent

- **Rule:** An index that names no network (0, past the palette, negative or not a number) gives four zeros, so the region keeps its colour. Indices are rounded to the nearest integer first, never wrapped.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/network-colors.js:26-35`
- **Expected:** 0, 99, −1, NaN, 0.4, 7.5 → [0, 0, 0, 0]. 0.5 → Vis; 1.5 → SomMot; 6.5 and 7.49 → Default.
- **Covered by:** `src/lib/engine/render/network-colors.test.ts` (R, 0 and 99)

### SHADER-10 · Only geometry carrying the network field gets network colours

- **Rule:** A geometry with `_network` gets a four-channel `_networkColor` attribute, one item per vertex, and the call reports true. A geometry without it is left alone and the call reports false.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/network-colors.js:38-46`
- **Expected:** `_network` [1, 0, 7] → true; itemSize 4, count 3, presence [1, 0, 1]. Empty geometry → false, no `_networkColor`.
- **Covered by:** `src/lib/engine/render/network-colors.test.ts` (R)

## The MRI appearance

### SHADER-11 · One scan, window and mark colour are shared live by every material

- **Rule:** Every surface and cut material reads the same scan, contrast window and mark colour. Changing the window or the mark colour reaches every material at once, recompiles none and leaves each material's own colour alone. The scan starts off, with the theme's default mark colour.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/mri-material.js:15-24, 47-52`
- **Expected:** `createMriUniforms` → `scanEnabled` false, `scanVolume` the given texture, `scanShape` the volume shape [2, 2, 2], `scanWindow` (0, 0), mark bytes [0x4f, 0xb6, 0xe0]. Two materials (`#cc6633` and default), then `setMriWindow(110, 200)` → both compiled uniforms read (110, 200), `material.version` unchanged, colour still `cc6633`.
- **Covered by:** `src/lib/engine/render/mri-material.test.ts` (R)

### SHADER-12 · An MRI window needs a finite centre and a positive width

- **Rule:** A window with a non-finite centre, or a width that is not finite and positive, is refused, and the current window stays.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/mri-material.js:26-31`
- **Expected:** (NaN, 180), (90, 0), (90, −1), (90, ∞), (∞, 5) → RangeError "MRI window requires a finite center and positive width."; the window stays (90, 180). (0, 1e-9) and (−5.5, 1e6) are accepted.
- **Covered by:** `src/lib/engine/render/mri-material.test.ts` (R)

### SHADER-13 · The mark colour is a CSS colour, stored as the bytes it spells

- **Rule:** The mark colour comes from the theme as a CSS colour, trimmed. It is kept as the display bytes the token names, not converted to linear, because it is mixed into a display grey. An empty or non-string value is refused and the current colour stays.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/mri-material.js:33-44`
- **Expected:** `#4fb6e0` → bytes [0x4f, 0xb6, 0xe0]; `' red '` → [255, 0, 0]; `rgb(10, 200, 30)` → [10, 200, 30]. `''`, `'   '`, `null`, `42`, `undefined` → RangeError "MRI highlight requires a CSS colour."; bytes stay [0x4f, 0xb6, 0xe0]. An unknown name (`notacolour`) does not throw: three.js warns "THREE.Color: Unknown color notacolour" and the colour stays (kept as legacy).
- **Covered by:** `src/lib/engine/render/mri-material.test.ts` (R, refusals)

### SHADER-14 · Under MRI colour a surface shows the scan grey through the window

- **Rule:** With the scan on, a fragment shows the T1 sample at its world point, mapped through the scan's world-to-voxel matrix and sampled at voxel centres, as grey = clamp((signal − centre + width/2) / width, 0, 1). The output is decoded so that the displayed byte equals that grey, as on the linked MRI canvas. Outside the scan grid the signal is 0. With the scan off the material draws as it did.
- **Kind:** scientific
- **Level:** browser — real WebGL
- **Source:** `viewer/render/mri-material.js:53-90`
- **Expected:** constant signal 100, window (150, 200) → displayed R = G = B = 0.25 ± 0.01 (within 0.001 of each other). A point outside the grid with that window → 0. `scanEnabled` false → the unpatched material's colour.
- **Covered by:** `src/lib/engine/render/mri-material.svelte.test.ts` (R, the grey); outside-grid and scan-off are uncovered

### SHADER-15 · A mark on the scan lifts brightness a little and moves hue toward the accent

- **Rule:** A marked fragment's grey is lifted by 0.33 × mark and then tinted toward the accent normalised to unit luma, by min(1.8 × mark, 1). It survives greyscale and colour-blind reading without passing for white matter. The mark amount is 0 on an unmarked surface, the face's lift on a sampled cut face (`lift`) and the cap's lift on a solid cap (`capLift`).
- **Kind:** behaviour
- **Level:** browser — real WebGL
- **Source:** `viewer/render/mri-material.js:3-12, 75-84`
- **Expected:** grey 0.25, accent `#4fb6e0`: mark 1 → luma 0.58 ± 0.01, blue − red > 0.2, luma < 0.9. Selected lift 0.45 → luma 0.25 + 0.1485 = 0.3985 ± 0.01; hovered 0.26 → 0.3358 ± 0.01; mark 0 → the SHADER-14 grey.
- **Covered by:** `src/lib/engine/render/mri-material.svelte.test.ts` (R, mark 1 only); the lift-driven amounts are uncovered

## Sampled cut faces

### SHADER-16 · The GPU reads the same label the CPU reads

- **Rule:** On a sampled cut face, the label at a point is the label with the largest trilinear weight over the eight voxels around it, visiting corners in x-fastest order so ties break as on the CPU, with background 0 outside the grid. It equals `Volume.label` (SLICE-09) at every point.
- **Kind:** scientific
- **Level:** browser — real WebGL (`usampler3D`, `texelFetch`)
- **Source:** `viewer/tissues/label-sampling.js:9-59`; `viewer/slices/volume.js:33-54`
- **Expected:** the SLICE-09 fixtures drawn through `labelAt`: ramp `[1.4]³` → 51, `[1.6]³` → 102, `[1.5]³` → 51; corners `[4,9,9,9,4,9,9,9]` at `[0.4,0.4,0.5]` → 9, `[0.2,0.2,0.5]` → 4; all-7 cube at `[−0.4,.5,.5]` → 7, `[−0.6,.5,.5]` → 0.
- **Covered by:** `src/lib/engine/tissues/label-sampling.svelte.test.ts` (R, real WebGL against `Volume.label`)

### SHADER-17 · A cut face is drawn in its label's palette colour, lit as tissue, and absent where hidden

- **Rule:** A sampled cut face takes its label's palette colour, varied by the T1 at the point as in SHADER-05 with the cut's own strength. A label whose palette alpha is below 0.5 is not drawn at all. The face is double-sided and pushed forward in depth so it wins over the coplanar surface. Unlike surfaces, it keeps its clear coat on a phone.
- **Kind:** behaviour
- **Level:** browser for the drawn face; unit for the material settings
- **Source:** `viewer/tissues/shader.js:6-61`
- **Expected:** material: DoubleSide, roughness 0.62, clearcoat 0.08 on desktop and phone, polygonOffset factor −1 and units −1. Drawn: palette alpha 0 → no fragment; alpha 1 with `tissueVariation` 0 → the palette colour ± 1/255 (SLICE-31); T1 = 180 with strength 0.5 → palette colour × 1.5.
- **Covered by:** `src/lib/engine/tissues/gpu-sections.test.ts` (R, uniforms only)

### SHADER-18 · Only the pointed-at and the selected region are lifted, selection the stronger

- **Rule:** A cut face is lifted by 0.45 when its region is selected and by 0.26 when it is pointed at. A region that is both reads as selected. Tissue with no region, and anything while nothing is marked, is not lifted.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/highlight.js:8-17`
- **Expected:** marks {hovered `destrieux:left:2`, selected `destrieux:left:9`}: `:2` → 0.26, `:9` → 0.45, `:3` → 0. {hovered `x`, selected `x`}: `x` → 0.45. Region `null`, `undefined` or `''` → 0. No marks → 0.
- **Covered by:** `src/lib/engine/tissues/highlight.test.ts` (R)

### SHADER-19 · A lifted face moves toward white, never darker

- **Rule:** A lift mixes the face colour toward white by the lift amount, on sampled faces, solid caps and white-matter parcels alike, so a marked face reads as coming forward on the dark stage.
- **Kind:** behaviour
- **Level:** browser — real WebGL
- **Source:** `viewer/tissues/highlight.js:27-35`
- **Expected:** base grey 0.2 (linear): selected → 0.2 + 0.8 × 0.45 = 0.56; hovered → 0.408; lift 0 → 0.2; each ± 1/255.
- **Covered by:** uncovered (the legacy comparison is deleted; needs a browser pixel test)

### SHADER-20 · A region is lit by the code its cut face is painted from

- **Rule:** A region's code on a cut is its index in the atlas's label table. Labels without a region have no code. If a region appears twice, the last entry wins.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/tissues/highlight.js:19-25`
- **Expected:** [null, `destrieux:left:2`, `destrieux:left:9`] → `:2` → 1, `:9` → 2, no key for null. [`x`, null, `x`, `''`] → {`x` → 2}.
- **Covered by:** `src/lib/engine/tissues/highlight.test.ts` (R)

## The cut palette

### SHADER-21 · A cut shows only the labels the display shows

- **Rule:** A cut label is hidden when its region is removed, when the internal-system filter excludes it, when it is background (code 0, unless cortex), when another region is isolated, or when it lies in the hidden hemisphere (midline labels always pass). Cortex labels and the cerebral white matter codes 2 and 41 follow cortex visibility and need an opacity above 0. A hidden label has palette alpha 0, so it is neither drawn nor picked.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/palette.js:7-23`
- **Expected:** `destrieux:left:1` removed → alpha 0 at code 1, alpha 1 at code 2. Hemisphere `right` → the left label hidden. Isolating `destrieux:left:1` → it shows, white matter (code 2) does not. Code 0 tissue → hidden; code 2 with cortex opacity 0 → hidden. NextBrain system `Diencephalon` with constituent `nextbrain:left:219` → 219 shown, `nextbrain:left:108` hidden.
- **Covered by:** `src/lib/engine/tissues/palette.test.ts` (R)

### SHADER-22 · Under atlas colours a cut label has the published colour its surface has

- **Rule:** Under atlas colours a cut label takes its published sRGB table colour, decoded the way the surfaces' glTF colours are, so a parcel is one colour on the cut and on the surface. A cut-only label carries its table colour unchanged. A cortex label with no region is unlabelled.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/tissues/palette.js:65-67, 90, 95-103`
- **Expected:** [23, 220, 60] → linear [0.008568, 0.715694, 0.045186] ± 1e-6, alpha 1; background code 0 → alpha 0. Every CDMD label with a mesh (`cortex-destrieux.glb`, `cortex-hcp-mmp.glb`, `structures.glb`, `nextbrain.glb` where published) equals that mesh's material colour ± 1e-6; every NextBrain cut-only label equals its table colour ± 1e-6.
- **Covered by:** `src/lib/engine/tissues/palette.test.ts` (R), `src/lib/engine/tissues/assets.test.ts` (S, every published label)

### SHADER-23 · Network and CAB-NP colours reach the cut as they reach the surface

- **Rule:** Each colour mode applies only in its own `surfaceColor` (`network`, `cab-np`), over the tissue colour. Under network colour a label takes the colour of its region's dominant network, NextBrain cortical parcels included. CAB-NP colours apply to the areas the partition assigns. A label with no such colour keeps its tissue colour.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/palette.js:26-38, 40-58, 71-84`
- **Expected:** Default 0.6 / Vis 0.3 → Default [205, 62, 78] linear; white matter → tissue white. CAB-NP `{destrieux:left:1: Default}` with Default [255, 0, 0] → linear (1, 0, 0). `nextbrain:left:2001` (Default 0.8) → Default; `nextbrain:left:48` (no networks) → tissue gray. Published NextBrain `ctx-` labels under network colour: more than 0 differ from tissue colour. The predicates are true only for their own mode; `usesPaint` only with a paint.
- **Covered by:** `src/lib/engine/tissues/palette.test.ts` (R)

### SHADER-24 · Tissue colour and a paint override the published colours

- **Rule:** Outside atlas colours a label starts as its tissue class colour (SHADER-01). A panel's paint is drawn over any colour mode: a painted region takes the paint colour and every other label its tissue colour.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/palette.js:68-70, 85-89`
- **Expected:** tissue colour: `G_front_sup` cortex → `#c4a897`, `Left-Cerebral-White-Matter` → `#e5dbc5`, `Left-Lateral-Ventricle` → `#67777c`, three distinct palette entries. Paint {`destrieux:left:1` → [0, 0, 255]} under atlas colours → linear (0, 0, 1); white matter → tissue white.
- **Covered by:** `src/lib/engine/tissues/palette.test.ts` (R)

## Solid caps

### SHADER-25 · A solid cap is varied by the MRI and given relief by its gradient

- **Rule:** A solid's cap is lit as tissue. Its colour is varied by the registered T1 with the cut strength. Its normal is bent by the T1 gradient along the face, scaled by the solid relief, so boundaries inside the tissue read as relief. The coat follows the bent normal. The cap starts unlifted, is double-sided, and has no clear coat on a phone.
- **Kind:** scientific
- **Level:** browser for the lit cap; unit for the material settings
- **Source:** `viewer/tissues/solid-material.js:7-82`
- **Expected:** `userData.tissueVariation` 0.5, `tissueRelief` 0.0012 (m), `highlightLift` 0; DoubleSide; clearcoat 0.08, 0 on a phone. Drawn: a uniform T1 volume → the cap normal equals the face normal (no relief); `tissueRelief` 0 → no relief anywhere.
- **Covered by:** `src/lib/engine/tissues/solid-sections.test.ts` (R, `highlightLift`), `src/lib/engine/tissues/solid-assets.test.ts` (R, `tissueVariation` per colour mode); the relief is uncovered

## Gyral white matter on the cap

### SHADER-26 · A point on the white-matter cut names the parcel whose voxel holds it

- **Rule:** The white-matter parcels are FreeSurfer's gyral wmparc labels, stored as one byte per voxel. A point names the parcel of the label sampled there, or no region for background or outside the grid. Labels in any other storage are refused.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/tissues/white-matter.js:39-40, 72-73`
- **Expected:** fixture: shape [3, 2, 2], affine [[−1,0,0,10],[0,0,1,0],[0,−1,0,0]], voxel (2,0,0) = 1 (`wmparc:left:3024`), voxel (0,1,1) = 2 (`wmparc:right:4035`). RAS [8, 0, 0] → `wmparc:left:3024`; [10, 1, −1] → `wmparc:right:4035`; [9, 0, 0] → null; [40, 0, 0] → null. `Uint16Array` data → Error "Expected uint8 white-matter labels."; `holds('wmparc:left:3024')` true, `holds('nope')` false.
- **Covered by:** `src/lib/engine/tissues/white-matter.test.ts` (R)

### SHADER-27 · White matter is sampled only on the cuts of the atlases it was published for

- **Rule:** The parcels light, isolate and name only while the cut atlas is one the record `applies_to`. On any other atlas the white matter is plain.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/white-matter.js:74-75`
- **Expected:** `applies_to` [destrieux, hcp-mmp]: `hcp-mmp` → active true; `nextbrain` → active false.
- **Covered by:** `src/lib/engine/tissues/white-matter.test.ts` (R), `src/lib/engine/tissues/gpu-sections.test.ts` (R, SLICE-34)

### SHADER-28 · Isolation, removal and the marks reach the white-matter parcels by code

- **Rule:** While a white-matter parcel is isolated, the cap draws only that parcel; isolating anything else isolates no parcel. A removed parcel is not drawn and comes back when shown. The pointed-at and selected parcels are lifted by the SHADER-18 amounts; background is never lifted.
- **Kind:** behaviour
- **Level:** unit for the codes; browser for the discarded and lifted fragments
- **Source:** `viewer/tissues/white-matter.js:9-31, 74-90`
- **Expected:** isolate `wmparc:right:4035` → isolated code 2; isolate `destrieux:left:1` → −1. Hide `wmparc:left:3024` → visibility [255, 0, 255]; show all → [255, 255, 255]. Hover `:3024`, select `:4035` → codes (1, 2), lifts (0.26, 0.45); no marks → codes (−1, −1), lifts (0, 0).
- **Covered by:** `src/lib/engine/tissues/white-matter.test.ts` (R), `src/lib/engine/tissues/gpu-sections.test.ts` (R, SLICE-34/35); the drawn discard and lift are uncovered

### SHADER-29 · The cap addresses the cropped white-matter grid exactly as the pick does

- **Rule:** The shader's world-to-voxel matrix for the white-matter volume maps a world point to the same voxel the CPU pick reads, through the crop's own affine, so what is lit is what is named.
- **Kind:** scientific
- **Level:** unit
- **Source:** `viewer/tissues/white-matter.js:58`; `viewer/slices/coordinates.js:7-12`
- **Expected:** with the SHADER-26 fixture, `rasToWorld(p)` × matrix: [8, 0, 0] → (2, 0, 0); [10, 1, −1] → (0, 1, 1); [8.4, 0.3, −0.2] → (1.6, 0.2, 0.3), each ± 1e-9.
- **Covered by:** `src/lib/engine/tissues/white-matter.test.ts` (R)

## Cap labels of cut-only atlases

### SHADER-30 · Under MRI colour, caps of an atlas without parcel solids sample its labels

- **Rule:** Cap labels are on only under MRI colour and only when the cut atlas has no parcel solids. They read the cut layer's label volume, palette, world-to-voxel matrix and highlight codes and lifts as they stand, and know whether a region is isolated.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/tissues/cap-labels.js:5-27`
- **Expected:** new → off, no volume or palette, highlight codes (−1, −1), lifts (0, 0), not isolated. `surfaceColor` `mri`, not wedged → on; `atlas` or wedged → off; volume, palette, matrix, codes and lifts are the layer's own objects; `isolatedRegion` set → isolated true.
- **Covered by:** `src/lib/engine/tissues/gpu-sections.test.ts` (R, enabled and volume, SLICE-36), `src/lib/engine/tissues/cap-labels.test.ts` (R)

### SHADER-31 · A sampled cap hides removed labels and lifts the marked one

- **Rule:** Where a cap samples labels, a fragment whose label is hidden is not drawn, and background is not drawn while a region is isolated. The fragment takes the lift of its label's code. A cap that does not sample labels keeps its own colour and lift.
- **Kind:** behaviour
- **Level:** browser — real WebGL
- **Source:** `viewer/tissues/cap-labels.js:29-62`
- **Expected:** sampling on, label code 5 with palette alpha 0 → no fragment; code 0, alpha 0, not isolated → drawn in the cap colour; code 0 while isolated → no fragment; code 5 selected (codes (−1, 5), lifts (0, 0.45)) → cap colour lifted by 0.45 (SHADER-19).
- **Covered by:** uncovered (the legacy comparison is deleted; needs a browser pixel test)

## Border feather shader

### SHADER-32 · A feathered vertex blends in the colours of the parcels across the border

- **Rule:** A feathered vertex's colour is its own colour weighted by one minus the total neighbour weight, plus each neighbour's current colour times its weight (RENDER-35). A hidden neighbour has weight 0 (RENDER-37). The patch composes with whatever the material already draws.
- **Kind:** behaviour
- **Level:** browser — real WebGL
- **Source:** `viewer/render/border-feather.js:221-249`
- **Expected:** own blue (0, 0, 1), feather [slot 1, 0.5, 0, 0], slot 1 red (1, 0, 0) shown → (0.5, 0, 0.5); slot 1 hidden → (0, 0, 1); feather [1, 1/3, 2, 1/3] with slot 2 green → (1/3, 1/3, 1/3); zero weights → own colour; each ± 1/255 before lighting.
- **Covered by:** uncovered (the legacy comparison is deleted; needs a browser pixel test)

## Lighting

### SHADER-33 · The light rig follows the camera

- **Rule:** The scene is lit by a hemisphere light and three white directional lights (key, fill, rim) at fixed places in camera space, aimed just ahead of the camera, with intensities from the manifest. Because the rig rides on the camera, shape stays legible from every orbit. Disposing the lighting removes the rig.
- **Kind:** behaviour
- **Level:** browser — `PMREMGenerator` needs WebGL (decision 25); the rig half is pure and could be checked in unit if it were built apart from the environment
- **Source:** `viewer/render/lighting.js:12-25, 28-31`
- **Expected:** one group on the camera with 7 children: HemisphereLight sky 0xffffff, ground 0x777777 (sRGB hex), intensity 0.28; DirectionalLight 1.8 at (−1.5, 2, 1); 0.5 at (2, 0.3, 0.5); 0.7 at (0.4, 1, −2); each white with its target at (0, 0, −1). After `dispose()` the camera has no children.
- **Covered by:** `src/lib/engine/render/lighting.svelte.test.ts` (R, real WebGL)

### SHADER-34 · Surfaces reflect a soft studio room

- **Rule:** The environment is three.js's `RoomEnvironment`, prefiltered once with blur sigma 0.04, so metal and coat reflect a soft, non-black studio at every roughness. The generator and the room are released at once; the environment texture is released on dispose.
- **Kind:** behaviour
- **Level:** browser — real WebGL
- **Source:** `viewer/render/lighting.js:6-10, 26-31`
- **Expected:** the texture is a PMREM texture (`CubeUVReflectionMapping`). A white metal sphere with that environment, rendered at 64 × 64 at roughness 0, 0.5 and 1 → some non-alpha channel > 0 at each roughness.
- **Covered by:** `src/lib/engine/render/lighting.svelte.test.ts` (R, real WebGL)

## Patch composition

### SHADER-35 · Every combination of patches the app uses compiles and gets its own program

- **Rule:** Each patch keeps the material's earlier patches and adds its own, in either order, and extends the program cache key. So every combination the model builds compiles, two materials with different patch sets never share a compiled program, and materials with the same set do. The combinations are: anatomical surface (plain or networked; cortex, non-region, structure, tissue region) alone, with the feather, with the MRI patch at each mark (`0.0`, `lift`, `capLift`), and with both in either order; a plain material with the MRI patch (structures, white-matter surfaces); the cut material alone and with the MRI patch; the solid material with or without white matter, with the MRI patch and with cap labels plus the MRI patch; each on desktop and phone.
- **Kind:** behaviour
- **Level:** browser for "compiles" (real WebGL program link); unit for the cache keys
- **Source:** `viewer/render/materials.js:100-101`, `mri-material.js:47-52, 92-93`, `border-feather.js:221-247`, `viewer/tissues/cap-labels.js:29-33, 61`, `shader.js:59`, `solid-material.js:79-80`; orders from `viewer/model/brain-atlas.js:261, 399, 419, 838-840`
- **Expected:** each listed combination drawn once on SwiftShader → no shader compile or link error. Cache keys are pairwise distinct across the set and equal for two materials built the same way. On a cortical surface with the scan off, MRI-then-feather and feather-then-MRI draw the same colour ± 1/255.
- **Covered by:** `src/lib/engine/render/materials.test.ts` (R, cache keys), `src/lib/engine/render/shader-programs.svelte.test.ts` (links under WebGL)
