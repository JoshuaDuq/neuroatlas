# NeuroAtlas model

A source-faithful, selectable brain model with GPU-rendered labelled tissue cuts and an optional MRI reference. The full-resolution FreeSurfer fsaverage cortex is preserved; atlas boundaries divide existing triangles without moving their anatomical surface.

- **Anatomical cortex:** 148 Destrieux regions, plus two explicitly unlabelled medial surfaces.
- **Multimodal cortex:** 360 HCP-MMP1.0 areas, provided as a separate surface layer.
- **Internal anatomy:** 35 structures from the same fsaverage segmentation, including cerebellum, brainstem, thalami, basal ganglia, hippocampi, amygdalae and ventricles.
- **Histological detail:** 487 NextBrain regions. 309 of them are solid nuclei in a second internal-anatomy detail level; the remaining 178 stay cut labels. Optional.
- **Cuts:** sagittal/parasagittal, midsagittal, coronal, axial/transverse, and arbitrary oblique orientation. Reverse the retained side and move the plane numerically. A persistent GPU plane samples native 3D tissue labels at the cut; moving it does not rebuild geometry or upload another slice image.
- **MRI:** three linked orthogonal sections, shared crosshair, native label readout, contrast window/center, segmentation overlay and PNG export.

## Use the viewer

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. The **Anatomical cuts** controls are in the right panel. **Open linked MRI slices** displays the three source-MRI sections. The model remains interactive when clipped. The MRI dialog shows the full reference volume independently of surface visibility.

## Model assets

`public/models/cortex-destrieux.glb`, `cortex-hcp-mmp.glb`, `structures.glb` and the optional `nextbrain.glb` are standard glTF 2.0 binary assets. Each region has a stable ID and source metadata. `manifest.json` links regions to their source atlas and scientific measurements. `deliverables/Brain-Atlas.blend`, when present, contains the editable full-resolution scene.

`tissue-labels.json` and `tissues-{destrieux,hcp-mmp,nextbrain}.volume` provide compact categorical 3D grids for cut faces. WebGL 2 integer textures preserve discrete label IDs. The active atlas loads on first use; subsequent movement updates the plane transform and clipping equation, while the volume and palette remain on the GPU. Each atlas needs 32 MiB for its GPU label texture, plus the CPU copy used for picking. Switching atlases caches the second texture.

Destrieux cuts decode the original published `aparc.a2009s+aseg.mgz` volume without changing any voxel label. HCP cut labels are **derived**: each cortical voxel in the native gray ribbon receives its nearest pial/white vertex's HCP label in the same hemisphere. Cortical voxels outside that ribbon remain unlabelled; white matter and deep tissues retain their original labels. This follows the nearest-cortical-vertex principle documented by [FreeSurfer's aparc-to-aseg mapping](https://surfer.nmr.mgh.harvard.edu/fswiki/mri_aparc2aseg), but is not a native HCP volumetric atlas or a reproduction of that command's complete algorithm.

### NextBrain

The cut atlas is chosen separately from the cortical surface atlas, because a cut
atlas need not have a surface. NextBrain has none: it is a volumetric
histological atlas.

Internal anatomy has two **detail levels**, and exactly one is drawn: the coarse
level is FreeSurfer's 35 structures, the fine level NextBrain's 309 nuclei. Both
segment the same anatomy, so drawing them together would put two thalami in the
same place. 178 further ROIs stay cut labels only — NextBrain's white matter, its
cerebellar cortical layers and its cortical parcels are excluded from geometry
because the first two enclose everything else and the third is already published
as real surfaces by the Destrieux and HCP-MMP layers, while anything under
`minimum_mesh_voxels` is too small for a surface to mean anything. All 487 remain
named, searchable and selectable on a cut face.

Its labels are **not** produced by this package. `scripts/warp_nextbrain.py` runs
once, registering the MNI152 template NextBrain was segmented on to fsaverage
with ANTs (`pip install antspyx`) and resampling the label volume along that
transform with `genericLabel`. Only the template is registered, so no label value
is ever interpolated. The result is committed as a checksummed optional entry in
`data/sources.json`; a checkout without it builds every other asset unchanged.

487 of the published 496 ROIs survive resampling to the 1 mm grid. 30 of the 309
solid nuclei are fragmented by the warp into components that touch only at
corners, so their surfaces are not closed; `validation.json` reports which, and
no mesh volume is claimed for them. Their segmentation volumes, which are counted
from voxels, remain exact. Both the
template and fsaverage are averaged brains, so the warp is much better than an
affine and still not subject-level: registration error, not the published
histological delineation, bounds what these labels can support. NextBrain names
every cortical parcel `ctx-rh-` on both sides, an artefact of the reused
FreeSurfer label block; the hemisphere field is authoritative, and the fragment
is dropped from display names while `source_published_name` retains the original.

`volumes.json`, `mri.volume` and `aseg.volume` provide native MRI and segmentation arrays for the separate MRI reference views. These optional assets are not loaded for 3D cuts. The `.volume` files contain gzip payloads; their opaque extension prevents static servers from mistaking file compression for HTTP content encoding. Both compressed and decoded payloads are checksummed in the browser. Loading errors are surfaced.

The exported glTF frame is in **meters**: X right, Y superior, Z posterior. The conversion from FreeSurfer surface RAS millimeters is `(R, A, S) → (R, S, −A) / 1000`. Model vertices and internal structures are never independently recentered. Slice positions are in **surface RAS millimeters**, not scanner RAS or MNI coordinates.

## Reuse without the interface

```js
import { BrainAtlas } from './viewer/model/brain-atlas.js';
import { BrainSections } from './viewer/slices/sections.js';

const manifestUrl = new URL('./models/manifest.json', location.href);
const brain = await BrainAtlas.load(manifestUrl, 'destrieux');
const sections = new BrainSections(brain, new URL('volumes.json', manifestUrl));
scene.add(brain.group, sections.group);
renderer.localClippingEnabled = true;

await sections.setMode('coronal');
await sections.setCutAtlas('nextbrain');   // independent of the surface atlas
await brain.setDetail('nextbrain');        // solid nuclei instead of the 35 aseg structures
sections.setOffset(-20);                 // A = −20 mm: posterior to the origin
sections.setDisplay({ reverse: false });
// Other modes: sagittal, axial, oblique, off.
// Midsagittal: setMode('sagittal'), then setOffset(0).
// Oblique: setAngles(tiltFromAxial, azimuthAroundSuperior), in degrees.

raycaster.setFromCamera(pointer, camera);
const region = sections.pick(raycaster);
if (region) brain.select(region.id);

brain.addEventListener('selectionchange', event => {
  console.log(event.detail);             // source region record or null
});
sections.addEventListener('change', render);
```

`setCrosshair([R,A,S])` moves linked section coordinates. For oblique offset browsing, the crosshair moves along the plane normal through the origin; standard plane offsets preserve the other two coordinates. `setWindow(center,width)` changes MRI display contrast. `load()` initializes MRI for orthogonal inspection without activating a cut. Dispose sections before disposing the model.

Use `sections.pick()` for cut views: it accounts for discarded surfaces and samples the cut label using the same nearest-cell rule as the shader. Cortex and selectable deep structures return stable region IDs; unselectable tissue blocks selection of surfaces behind it. Hemisphere filtering and isolation hide labels without reassigning them. Atlas colors use the same base-color values as the corresponding GLB materials; surface lighting can change their displayed brightness. Source LUT colors are identifiers, not natural tissue colors. Calling the ordinary Three.js raycaster directly does not account for material clipping. Postprocessing passes with override materials must support clipping too; this viewer disables its ambient-occlusion and outline passes during cuts to prevent discarded geometry reappearing.

## Fidelity and validation

The surface model preserves all 327,684 source vertices and 655,360 source triangles across both hemispheres before region-boundary partitioning. Internal structure shading uses segmentation-gradient normals; it does not smooth or displace their geometry. Clipping changes rendered visibility, not mesh coordinates, indices or atlas boundaries.

MRI intensities are interpolated trilinearly. Segmentation labels use nearest-neighbour sampling, so intermediate label IDs are never invented. The categorical 3D cut also uses nearest-neighbour sampling; tissue boundaries remain faithful to the 1 mm grid. No MRI intensity image is painted onto the cut. L/R and anatomical directions are explicitly marked. The 2D coronal and axial views use neurological orientation (patient left on screen left); 3D labels follow the actual camera direction.

**Limits:** this is reference-template anatomy, not patient-specific anatomy or a clinically validated model. The MRI and segmentation have a 1 mm source grid. Fractional slice positions and 512-pixel renderings do not increase source anatomical resolution. The template MRI is spatially averaged and looks softer than a single-subject scan. Fine cerebellar folia and tiny nuclei are not resolved by the internal segmentation. The detailed cortical surface and the native voxel segmentation do not coincide exactly; small edge discrepancies and voxel steps remain visible. Smoothing categorical boundaries would imply unsupported spatial precision. Cortical GLB regions remain surface patches; their cut labels are supplied by the separate labelled volume. HCP-MMP1.0 uses the published Mills fsaverage projection. Mixed-label triangle boundaries are a documented visualization convention. Two native degenerate pial triangles per hemisphere are retained and reported in source-faithful exports. The cut renderer does not alter surface topology.

```sh
uv sync --locked
uv run python -m brain_model.build
uv run python -m brain_model.validate
uv run python -m pytest -q
npm test
npm run build
```

`public/models/validation.json` records independent source comparisons, region metadata reconciliation and actual GLB round trips. Native MRI volume checks compare every voxel and the full tkregister affine. Tissue tests decode every Destrieux voxel back to its published source ID, verify unchanged noncortical HCP labels, and independently check HCP projection samples and ribbon exclusion. Numerical coordinate conversion error is not a biological accuracy estimate.

`deliverables/gpu-browser-qa.json` records browser checks of all cut orientations, atlas switching, filtering, isolation and optional MRI loading. `deliverables/gpu-cut-performance.json` records local continuous-drag measurements. JavaScript tests check GPU/CPU coordinate agreement, cut selection, surface/cut color consistency, and reuse of geometry, textures and clipping planes throughout dragging.

## Sources and terms

The generated mesh assets are modified derivatives of FreeSurfer data.

“All or portions of this licensed product (such portions are the "Software") have been obtained under license from The General Hospital Corporation and are subject to the following terms and conditions:”

The full terms are included in [FreeSurferSoftwareLicense](public/models/licenses/FreeSurfer.html). See the included [FreeSurfer terms](public/models/licenses/FreeSurfer.html) and [HCP data-use terms](public/models/licenses/HCP-Data-Use-Terms.txt) before redistributing source or derived data. Provenance and checksums are recorded in `data/sources.json` and the model manifest.

- [FreeSurfer coordinate systems](https://surfer.nmr.mgh.harvard.edu/fswiki/CoordinateSystems)
- [Destrieux et al., 2010](https://doi.org/10.1016/j.neuroimage.2010.06.010)
- [Glasser et al., 2016, HCP-MMP1.0](https://doi.org/10.1038/nature18933)
- [NiBabel FreeSurfer readers](https://nipy.org/nibabel/reference/nibabel.freesurfer.html)
- [Three.js material clipping](https://threejs.org/docs/#Material.clippingPlanes)

GPU volume sampling uses [Three.js Data3DTexture](https://threejs.org/docs/#Data3DTexture). The renderer requires WebGL 2; there is no geometry-worker fallback.
