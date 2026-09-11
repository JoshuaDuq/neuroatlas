# NeuroAtlas model

A source-faithful, selectable brain model with registered MRI sections. The full-resolution FreeSurfer fsaverage cortex is preserved; atlas boundaries divide existing triangles without moving their anatomical surface.

- **Anatomical cortex:** 148 Destrieux regions, plus two explicitly unlabelled medial surfaces.
- **Multimodal cortex:** 360 HCP-MMP1.0 areas, provided as a separate surface layer.
- **Internal anatomy:** 35 structures from the same fsaverage segmentation, including cerebellum, brainstem, thalami, basal ganglia, hippocampi, amygdalae and ventricles.
- **Cuts:** sagittal/parasagittal, midsagittal, coronal, axial/transverse, and arbitrary oblique orientation. Reverse the retained side, move the plane numerically, and display the MRI on its face.
- **MRI:** three linked orthogonal sections, shared crosshair, native label readout, contrast window/center, segmentation overlay and PNG export.

## Use the viewer

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. The **Anatomical cuts** controls are in the right panel. **Open linked MRI slices** displays the three source-MRI sections. The model remains interactive when clipped. The MRI dialog shows the full reference volume independently of surface visibility.

## Model assets

`public/models/cortex-destrieux.glb`, `cortex-hcp-mmp.glb` and `structures.glb` are standard glTF 2.0 binary assets. Each region has a stable ID and source metadata. `manifest.json` links regions to their source atlas and scientific measurements. `deliverables/Brain-Atlas.blend`, when present, contains the editable full-resolution scene.

`volumes.json`, `mri.volume` and `aseg.volume` provide native MRI and segmentation arrays for dynamic cuts. The `.volume` files contain gzip payloads; their opaque extension prevents static servers from mistaking file compression for HTTP content encoding. Both compressed and decoded payloads are checksummed in the browser. Loading errors are surfaced.

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
sections.setOffset(-20);                 // A = −20 mm: posterior to the origin
sections.setDisplay({ showMRI: true });
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

Use `sections.pick()` while the MRI face is shown: it accounts for both discarded surfaces and occlusion by tissue on the MRI face. Calling the ordinary Three.js raycaster directly does not account for material clipping. Postprocessing passes with override materials must support clipping too; this viewer disables its ambient-occlusion and outline passes during cuts to prevent discarded geometry reappearing.

## Fidelity and validation

The surface model preserves all 327,684 source vertices and 655,360 source triangles across both hemispheres before region-boundary partitioning. Internal structure shading uses segmentation-gradient normals; it does not smooth or displace their geometry. Clipping changes rendered visibility, not mesh coordinates, indices or atlas boundaries.

MRI intensities are interpolated trilinearly. Segmentation labels use nearest-neighbour sampling, so intermediate label IDs are never invented. The 3D cut face is masked by the segmentation; the linked 2D views retain the entire source MRI, including unsegmented voxels. L/R and anatomical directions are explicitly marked. The 2D coronal and axial views use neurological orientation (patient left on screen left); 3D labels follow the actual camera direction.

**Limits:** this is reference-template anatomy, not patient-specific anatomy or a clinically validated model. The MRI and segmentation have a 1 mm source grid. Fractional slice positions and 512-pixel renderings do not increase source anatomical resolution. The template MRI is spatially averaged and looks softer than a single-subject scan. Fine cerebellar folia and tiny nuclei are not resolved by the internal segmentation. Cortical regions are surface patches, not closed tissue volumes; their labels are not extrapolated into MRI voxels. HCP-MMP1.0 uses the published Mills fsaverage projection. Mixed-label triangle boundaries are a documented visualization convention. Two native degenerate triangles per hemisphere are retained and reported.

```sh
uv sync --locked
uv run python -m brain_model.build
uv run python -m brain_model.validate
uv run python -m pytest -q
npm test
npm run build
```

`public/models/validation.json` records independent source comparisons, region metadata reconciliation and actual GLB round trips. The volume checks compare **every voxel and the full tkregister affine** with the native source files. Numerical coordinate conversion error is not a biological accuracy estimate. `deliverables/sections-browser-qa.json` records the browser interaction checks from this development session.

## Sources and terms

The generated mesh assets are modified derivatives of FreeSurfer data.

“All or portions of this licensed product (such portions are the "Software") have been obtained under license from The General Hospital Corporation and are subject to the following terms and conditions:”

The full terms are included in [FreeSurferSoftwareLicense](public/models/licenses/FreeSurfer.html). See the included [FreeSurfer terms](public/models/licenses/FreeSurfer.html) and [HCP data-use terms](public/models/licenses/HCP-Data-Use-Terms.txt) before redistributing source or derived data. Provenance and checksums are recorded in `data/sources.json` and the model manifest.

- [FreeSurfer coordinate systems](https://surfer.nmr.mgh.harvard.edu/fswiki/CoordinateSystems)
- [Destrieux et al., 2010](https://doi.org/10.1016/j.neuroimage.2010.06.010)
- [Glasser et al., 2016, HCP-MMP1.0](https://doi.org/10.1038/nature18933)
- [NiBabel FreeSurfer readers](https://nipy.org/nibabel/reference/nibabel.freesurfer.html)
- [Three.js material clipping](https://threejs.org/docs/#Material.clippingPlanes)
