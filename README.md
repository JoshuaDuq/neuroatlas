# NeuroAtlas model

A source-faithful, selectable brain model with GPU-rendered labelled tissue cuts and an optional MRI reference. The anatomy is one person's: FreeSurfer's published `bert` reconstruction at full native resolution, not an averaged template. Atlas boundaries divide existing triangles without moving their anatomical surface.

- **Anatomical cortex:** 148 Destrieux regions, plus two explicitly unlabelled medial surfaces.
- **Multimodal cortex:** 360 HCP-MMP1.0 areas, provided as a separate surface layer.
- **Internal anatomy:** 35 structures from the same subject's segmentation, including cerebellum, brainstem, thalami, basal ganglia, hippocampi, amygdalae and ventricles.
- **Histological detail:** 483 NextBrain regions. 298 of them are solid nuclei in a second internal-anatomy detail level; the remaining 185 stay cut labels. Optional.
- **Cuts:** sagittal/parasagittal, midsagittal, coronal, axial/transverse, and arbitrary oblique orientation. Reverse the retained side and move the plane numerically. A persistent GPU plane samples native 3D tissue labels at the cut; moving it does not rebuild geometry or upload another slice image.
- **MRI:** three linked orthogonal sections, shared crosshair, native label readout, contrast window/center, segmentation overlay and PNG export.

## Whose brain this is

As published, FreeSurfer's `bert` subject: one person's T1 scan and the reconstruction
FreeSurfer distributes with it as its own worked example. It has an individual's
folding pattern, an individual's ventricles and an individual's asymmetries, and
it is nobody else's brain. `scripts/prepare_subject.py` extracts it from the
published archive by checksum.

Each atlas reaches that anatomy by a different route, and the route is what
bounds how much the labels can be trusted.

- **Destrieux** is this subject's own `aparc.a2009s`, drawn on these surfaces by
  the recon that produced them. Nothing is projected.
- **HCP-MMP1.0** arrives through two registrations, not one. It is published in
  the HCP's own `fs_LR` space; the Mills projection carries it to fsaverage, and
  `scripts/prepare_subject.py` resamples it again onto this subject, each vertex
  taking the label of the nearest fsaverage vertex in FreeSurfer's registered
  spherical space (`sphere.reg`) — `mri_surf2surf`'s forward nearest-neighbour
  rule. No coordinate moves and no label is interpolated; only labels travel.
  It is the loosest of the three surface routes.
- **NextBrain** is warped volumetrically, and is described below.

### Switching brains

`config/model.yaml` declares each anatomy and selects one. Change the selection,
rebuild, and the other is published; no conversion step knows which brain it is
reading.

```yaml
anatomy: bert        # or: fsaverage
```

Two are declared.

| `anatomy` | What it is | Reconstruction | Cortical labels |
| --- | --- | --- | --- |
| `bert` | FreeSurfer's published worked example: one ordinary 1 mm T1 | 5.2.0, Jan 2013 | its own Destrieux; HCP resampled on |
| `fsaverage` | FreeSurfer's averaged template | 6 | template Destrieux; HCP already native |

An anatomy's entry carries everything that differs — where its files live, which
archive to unpack and its checksum, which brain to resample HCP from, which
NextBrain warp belongs to it. `data/sources.json` tags every input with the
anatomy whose build reads it, so a checkout holding one brain's data still
verifies cleanly, and the manifest publishes only the sources that built it.

Preparing a brain does not require selecting it first:

```sh
uv run python scripts/prepare_subject.py --anatomy fsaverage
uv run python scripts/warp_nextbrain.py --anatomy fsaverage --atlas ... --record
```

### What is not declared, and why

Every step reads a complete `recon-all` output: pial, white, sulc and sphere.reg
per hemisphere, a Destrieux `.annot` per hemisphere, and orig, aseg, ribbon and
aparc.a2009s+aseg on FreeSurfer's conformed 256³ grid. That requirement, not
taste, is what excludes the more recent candidates:

- **FreeSurfer Maintenance Dataset** — OpenNeuro `ds004958`, CC0, collected by
  Greve and Fischl to test FreeSurfer itself. The best modern acquisition found:
  multi-echo MPRAGE with volumetric navigators, MP2RAGE, T2-SPACE. Raw BIDS
  only, no reconstruction, so it needs a `recon-all` this repository does not
  run.
- **Penn LEAD anatomical derivatives** — OpenNeuro `ds007089`, CC0, fMRIPrep
  25.0.0, processed May 2025, and the most recent reconstructions found
  anywhere. Its surfaces are GIFTI in fsnative while its volumes are in T1w
  space, and it publishes no cortical parcellation at all — three-tissue
  segmentations only, since fMRIPrep exports no FreeSurfer `.annot`. Using it
  means regenerating annotations and reconciling two grids, and reconciling
  grids quietly is the one thing this package refuses to do.
- **Mindboggle-101** — CC0, 101 brains whose cortical labels were drawn by hand
  under a published protocol. Those are the most valid cortical labels obtainable
  anywhere, and they are unusable here: the distribution is VTK surfaces carrying
  DKT labels, with no FreeSurfer subject directories, no registered spheres and
  no volumes. Its protocol is DKT, not Destrieux.
- **FreeSurfer's 2018 tutorial subjects** — incomplete, missing `sulc`, `aseg`
  and `aparc.a2009s+aseg`, and distributed without stated licence terms.
- **FreeSurfer 8.2 itself** (March 2026) — it ships no reconstruction to take.
  `distribution/subjects/CMakeLists.txt` in the source tree installs exactly
  three things: a `README`, `sample-001.mgz` and `sample-002.mgz`. The README
  tells you to run `recon-all` on those samples yourself. `bert.recon.tgz` and
  `ernie.recon.tgz` are present in that directory only as git-annex symlinks —
  test fixtures, not installed. That annexed bert is a different file from the
  published one (226,599,110 bytes against 352,245,116) and its annex log goes
  back to 2016, so it is not a modern reconstruction either; it has no public
  download route, as the annex branch registers no web URLs and no special
  remotes.

So bert's 2013 date is a ceiling, not an oversight: FreeSurfer has published no
complete reconstruction since, and its current release distributes raw samples
rather than a recon. *Most recent* and *usable as published* do not meet.

The published limitations, the colophon and the slice note all follow the
selection rather than being written for one brain.

These are not interchangeable, and the switch is a comparison tool rather than
a preference. An individual has real folds and a real scan and is nobody else's
brain. A template is nobody's anatomy, and is the space published parcellations
and group results are reported in.

## Use the viewer

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. The brain opens in neutral gray with matte tissue shading and source-derived fold relief. Enable **Atlas colours** in Display to show the region palette; selection and isolation work in either appearance. Reset restores the neutral view. The **Anatomical cuts** controls are in the right panel. **Open linked MRI slices** displays the three source-MRI sections. The model remains interactive when clipped. The MRI dialog shows the full reference volume independently of surface visibility.

## Model assets

`public/models/cortex-destrieux.glb`, `cortex-hcp-mmp.glb`, `structures.glb` and the optional `nextbrain.glb` are standard glTF 2.0 binary assets. Each region has a stable ID and source metadata. `manifest.json` links regions to their source atlas and scientific measurements. `deliverables/Brain-Atlas.blend`, when present, contains the editable full-resolution scene.

`tissue-labels.json` and `tissues-{destrieux,hcp-mmp,nextbrain}.volume` provide compact categorical 3D grids for cut faces. WebGL 2 integer textures preserve discrete label IDs. The active atlas loads on first use; subsequent movement updates the plane transform and clipping equation, while the volume and palette remain on the GPU. Each atlas needs 32 MiB for its GPU label texture, plus the CPU copy used for picking. Switching atlases caches the second texture.

Destrieux cuts decode the original published `aparc.a2009s+aseg.mgz` volume without changing any voxel label. HCP cut labels are **derived**: each cortical voxel in the native gray ribbon receives its nearest pial/white vertex's HCP label in the same hemisphere. Cortical voxels outside that ribbon remain unlabelled; white matter and deep tissues retain their original labels. This follows the nearest-cortical-vertex principle documented by [FreeSurfer's aparc-to-aseg mapping](https://surfer.nmr.mgh.harvard.edu/fswiki/mri_aparc2aseg), but is not a native HCP volumetric atlas or a reproduction of that command's complete algorithm.

### NextBrain

The cut atlas is chosen separately from the cortical surface atlas, because a cut
atlas need not have a surface. NextBrain has none: it is a volumetric
histological atlas.

Internal anatomy has two **detail levels**, and exactly one is drawn: the coarse
level is FreeSurfer's 35 structures, the fine level NextBrain's 298 nuclei. Both
segment the same anatomy, so drawing them together would put two thalami in the
same place. 185 further ROIs stay cut labels only — NextBrain's white matter, its
cerebellar cortical layers and its cortical parcels are excluded from geometry
because the first two enclose everything else and the third is already published
as real surfaces by the Destrieux and HCP-MMP layers, while anything under
`minimum_mesh_voxels` is too small for a surface to mean anything. All 483 remain
named, searchable and selectable on a cut face.

Its labels are **not** produced by this package. `scripts/warp_nextbrain.py` runs
once, registering the MNI152 template NextBrain was segmented on to this
subject's `orig.mgz` with ANTs (`pip install antspyx`) and resampling the label
volume along that transform with `genericLabel`. Only the template is registered,
so no label value is ever interpolated. The result is committed as a checksummed
optional entry in `data/sources.json`; a checkout without it builds every other
asset unchanged.

483 of the published 496 ROIs survive resampling to the 1 mm grid. This is the
loosest join in the model, and in the harder direction: an averaged template is
registered onto one individual, so the nuclei land where that inter-subject warp
puts them, not where a histological delineation of this brain would. The warp is
far better than an affine and nowhere near subject-level. Registration error, not
the published histological delineation, bounds what these labels can support. NextBrain names
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

The surface model preserves every source vertex and triangle across both hemispheres before region-boundary partitioning — 266,922 and 533,836 for the published `bert` build, 327,684 and 655,360 for `fsaverage`. Internal structure shading uses segmentation-gradient normals; it does not smooth or displace their geometry. Clipping changes rendered visibility, not mesh coordinates, indices or atlas boundaries.

MRI intensities are interpolated trilinearly. Segmentation labels use nearest-neighbour sampling, so intermediate label IDs are never invented. The categorical 3D cut also uses nearest-neighbour sampling; tissue boundaries remain faithful to the 1 mm grid. No MRI intensity image is painted onto the cut. L/R and anatomical directions are explicitly marked. The 2D coronal and axial views use neurological orientation (patient left on screen left); 3D labels follow the actual camera direction.

**Limits** (as published, with `anatomy: bert`): this is one published individual's anatomy — exact for that person, nobody else's, and not a clinically validated model. The MRI and segmentation have a 1 mm source grid. Fractional slice positions and 512-pixel renderings do not increase source anatomical resolution. Being a single scan rather than an average, the MRI carries that acquisition's own noise and partial-volume effects instead of a template's smoothness. Fine cerebellar folia and tiny nuclei are not resolved by the internal segmentation. The detailed cortical surface and the native voxel segmentation do not coincide exactly; small edge discrepancies and voxel steps remain visible. Smoothing categorical boundaries would imply unsupported spatial precision. Cortical GLB regions remain surface patches; their cut labels are supplied by the separate labelled volume. HCP-MMP1.0 uses the published Mills fsaverage projection, resampled again here through registered spheres: two registrations away from native HCP space. Mixed-label triangle boundaries are a documented visualization convention. Where a segmented structure meets itself at a corner its surface pinches there and is not a two-manifold; 34 of the 333 solid structures do, `validation.json` counts the edges, and the volume each surface encloses stays definite. The cut renderer does not alter surface topology.

```sh
uv sync --locked
uv run python scripts/prepare_subject.py   # once per anatomy; a no-op for fsaverage
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
