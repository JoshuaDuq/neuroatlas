# NeuroAtlas model

A source-faithful, selectable brain model with solid anatomical tissue cuts, registered MRI material variation, exact atlas cut labels and an optional MRI reference. The anatomy is one person's: FreeSurfer's published `bert` reconstruction at full native resolution, not an averaged template. Atlas boundaries divide existing triangles without moving their anatomical surface.

- **Anatomical cortex:** 148 Destrieux regions, plus two explicitly unlabelled medial surfaces.
- **Multimodal cortex:** 360 HCP-MMP1.0 areas, provided as a separate surface layer.
- **Learning anatomy:** 75 derived overview structures, with distinct teaching colours, bounded display smoothing, anatomical-system exploration and links to constituent source regions.
- **Internal anatomy:** 35 structures from the same subject's segmentation, including cerebellum, brainstem, thalami, basal ganglia, hippocampi, amygdalae and ventricles.
- **Histological detail:** 483 NextBrain regions. 298 of them are solid nuclei in a second internal-anatomy detail level; the remaining 185 stay cut labels. Optional.
- **Gyral white matter:** 68 parcels of the white matter nearest each Desikan gyrus, from the same subject's `wmparc.mgz`. Named, selectable and isolatable on Destrieux and HCP-MMP cuts.
- **Cuts:** sagittal/parasagittal, midsagittal, coronal, axial/transverse, and arbitrary oblique orientation. Reverse the retained side and move the plane numerically. GPU stencil caps fill closed anatomical surfaces at the cut: the pial and white-matter envelopes, the deep structures of the selected detail level, and — for an atlas with a cortical surface — one closed solid per parcel, cut from the ribbon between the native envelopes. Atlas colours, network colours and isolated parcels are therefore bounded by the reconstruction rather than by the label grid. A cut atlas with no surface of its own still samples exact native 3D labels. Moving either cut does not rebuild geometry or upload another slice image.
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

Open the URL printed by Vite. The brain opens in warm tissue colours with soft specular highlights, MRI-derived variation and source-derived fold relief. Enable **Atlas colours** in Display to show the region palette; selection and isolation work in either appearance. Reset restores the neutral view. The **Anatomical cuts** controls are in the right panel. **Open linked MRI slices** displays the three source-MRI sections. The model remains interactive when clipped. The MRI dialog shows the full reference volume independently of surface visibility.

## Model assets

`public/models/cortex-destrieux.glb`, `cortex-hcp-mmp.glb`, `structures.glb` and the optional `nextbrain.glb` are standard glTF 2.0 binary assets. Each region has a stable ID and source metadata. `manifest.json` links regions to their source atlas and scientific measurements. `deliverables/Brain-Atlas.blend`, when present, contains the editable full-resolution scene.

`tissue-envelopes.glb` preserves the four closed native pial/white surfaces without moving or decimating any vertex. Tissue-mode cuts use their winding counts to fill the cortical ribbon and white-matter interior with continuous surface-defined contours; the native `structures.glb` solids supply deep anatomy. These shapes remain independent of the selected cut atlas. MRI-driven material shading adds subtle relief, without displacing the cut or synthesizing anatomy. The surfaces and voxel segmentation are two representations of the same reconstruction and need not agree exactly at their edges.

`tissue-labels.json` and `tissues-{destrieux,hcp-mmp,nextbrain}.volume` provide compact categorical 3D grids for cut faces. WebGL 2 integer textures preserve discrete label IDs. The active atlas loads on first use; subsequent movement updates the plane transform and clipping equation, while the volume and palette remain on the GPU. Each atlas needs 32 MiB for its GPU label texture, plus the CPU copy used for picking. Switching atlases caches the second texture.

Destrieux cuts decode the original published `aparc.a2009s+aseg.mgz` volume without changing any voxel label. HCP cut labels are **derived**: each cortical voxel in the native gray ribbon receives its nearest pial/white vertex's HCP label in the same hemisphere. Cortical voxels outside that ribbon remain unlabelled; white matter and deep tissues retain their original labels. This follows the nearest-cortical-vertex principle documented by [FreeSurfer's aparc-to-aseg mapping](https://surfer.nmr.mgh.harvard.edu/fswiki/mri_aparc2aseg), but is not a native HCP volumetric atlas or a reproduction of that command's complete algorithm.

### Functional networks

Every cortical vertex carries the Yeo resting-state network it falls in, as a
`_NETWORK` attribute beside `_SULC` and `_T1`, and every cortical region in
`manifest.json` reports the share of its own source vertices each network holds.
Networks cut across gyri and across areal boundaries, so this is a layer under
both atlases rather than a third atlas: Destrieux keeps naming folds, HCP-MMP
keeps naming areas, and each reports what it is made of.

The source is [Schaefer2018](https://doi.org/10.1093/cercor/bhx179), whose
parcels are already matched to [Yeo's seven
networks](https://doi.org/10.1152/jn.00338.2011) and which is published on full
`fsaverage` — so it travels to a subject through the same registered spheres
HCP-MMP already does, with no extra machinery. The layer is optional: a checkout
without the annotation builds every other asset.

*Surface colour* in the viewer paints the cortex with the published Yeo palette,
which `manifest.json` carries and the build checks the annotation still agrees
with. Colour is applied per vertex rather than per region, so a network boundary
crossing the middle of a gyrus is drawn where it falls; the index itself is never
interpolated, because a triangle spanning Visual and Default would otherwise
sweep through five networks it does not touch. Cortex in no network — the medial
wall — keeps its tissue colour, and so does a cut face: a cut is sampled from a
label volume, and this layer has no volumetric counterpart.

A network share says which networks a region's surface falls in, not what the
region does. The networks are a group average of 1000 subjects; on an individual
reconstruction they are projected onto that person's folds and are not their
measured networks. Shares count source vertices, so they follow vertex density
rather than surface area, and shares below 5% are dropped in the interface as
registration spill. `manifest.json` states each of these beside the data.

### Gyral white matter

Destrieux and HCP-MMP cuts divide the white matter into FreeSurfer's gyral
parcels: `wmparc.mgz`, written by this subject's own recon with
`mri_aparc2aseg --labelwm`. Each white-matter voxel within 5 mm of cortex carries
the nearest Desikan cortical label, so parcels are named for Desikan gyri
whichever surface atlas is shown. Deeper white matter is unsegmented and stays
plain white matter. Nothing is projected or resampled.

The parcels have no geometry. `white-matter.volume` holds one code per voxel,
cropped to the parcels' bounding box (121×105×178 voxels for `bert`, 2.2 MiB on
the GPU), and the white envelope's cut face samples it: a parcel is named on
hover, lit when chosen and left alone when isolated, while white matter keeps
its tissue colour in every colour mode. NextBrain cuts keep their own labels.
`fsaverage` ships no `wmparc.mgz`, so that build has no white-matter parcels.

### Learning internal anatomy

Choose **Explore internal anatomy** to reveal and frame the interior, then use
**Study a system** to study basal ganglia, diencephalon, limbic structures,
brainstem, basal forebrain, cerebellar nuclei, ventricles or white-matter pathways.
Selecting a system narrows the navigation tree and frames those structures.
Selection, Focus, Isolate, hemisphere controls and cuts remain available. A shared
link preserves the chosen system. English and French use anatomical groups.

The 75 overview structures combine explicit constituent labels from NextBrain;
aseg supplies the ventricles and corpus callosum. This makes larger structures
such as thalamus, caudate and hippocampal formation readable while retaining
hypothalamus, mammillary nuclei, subthalamic nucleus, substantia nigra, red nucleus,
geniculate nuclei, fornix and other available pathways. The inspector lists the
source atlas and constituent IDs, with links to members that have a 3D surface.
The original 35 aseg structures and 298 NextBrain surfaces remain reference levels.

`config/learning-anatomy.yaml` defines each union, bilingual name and teaching
colour. `brain_model/learning.py` extracts its union surface and applies
[Trimesh Taubin smoothing](https://trimesh.org/trimesh.smoothing.html#trimesh.smoothing.filter_taubin),
bounding every vertex's displacement to 0.6 mm. No label volume is changed;
reported volumes count original voxels. The teaching palette distinguishes units
and is not the published source LUT. `learning.glb` and the manifest record this
provenance, and `validation.json` independently checks source membership,
constituent references, topology, colour and displacement for every overview mesh.

This is a display interpretation of the existing 1 mm data. It does not recover
missing nuclei, close segmentation gaps, resolve fibres, or fix registration
error. The brainstem territories omit separately drawn nuclei and pathways and
are not complete subdivisions. Only selected cerebellar nuclei appear in the
overview; FreeSurfer's cerebellar cortex remains in its reference level.

### NextBrain

The cut atlas is chosen separately from the cortical surface atlas, because a cut
atlas need not have a surface. NextBrain has none: it is a volumetric
histological atlas.

Internal anatomy has three **detail levels**, and exactly one is drawn. Learning anatomy is the default overview described below; the two original reference levels remain available: the coarse
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

`volumes.json`, `mri.volume` and `aseg.volume` provide native MRI and segmentation arrays for the separate MRI reference views. The native MRI supplies brightness variation for 3D cuts. The MRI reference views remain optional. The `.volume` files contain gzip payloads; their opaque extension prevents static servers from mistaking file compression for HTTP content encoding. The MRI and solid envelopes load when a cut is first requested. The MRI uses one shared 16 MiB R8 GPU texture; opening the separate MRI reference also loads its segmentation. Both compressed and decoded payloads are checksummed in the browser. Loading errors are surfaced.

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

Use `sections.pick()` for cut views: it accounts for discarded surfaces, tests solid containment in tissue mode, and samples the cut label using the native nearest-cell rule. A solid cut with no corresponding visible voxel label blocks selection of anatomy behind it. Cortex and selectable deep structures return stable region IDs; unselectable tissue blocks selection of surfaces behind it. Hemisphere filtering and isolation hide labels without reassigning them. Atlas colors use the same base-color values as the corresponding GLB materials; surface lighting can change their displayed brightness. Source LUT colors are identifiers, not natural tissue colors. Calling the ordinary Three.js raycaster directly does not account for material clipping. Postprocessing passes with override materials must support clipping too; this viewer disables its outline passes during cuts to prevent discarded geometry reappearing.

## Fidelity and validation

The surface model preserves every source vertex and triangle across both hemispheres before region-boundary partitioning — 266,922 and 533,836 for the published `bert` build, 327,684 and 655,360 for `fsaverage`. Cortical shading carries three continuous fields, interpolated across atlas partitions: source sulcal depth, dimensionless pial concavity, and T1 sampled at the midpoint of corresponding pial/white vertices. Concavity is calculated on each intact hemisphere and averaged only as a shading field. T1 brightness and tissue colours are illustrative, not measured optical properties; no vessels or unresolved anatomy are synthesized. The original internal reference layers use segmentation-gradient normals without moving geometry. The separate learning overview uses bounded display smoothing. Clipping changes rendered visibility, not mesh coordinates, indices or atlas boundaries.

MRI intensities are interpolated trilinearly. Segmentation labels use nearest-neighbour sampling, so intermediate label IDs are never invented. Atlas-colour cuts and isolated parcels use nearest-neighbour sampling; their label boundaries remain faithful to the 1 mm grid. Normal tissue cuts instead follow the native pial/white and internal structure geometry, while picking still reports the original voxel label. In tissue-colour mode, registered, trilinearly sampled T1 intensity modulates cut brightness without changing tissue membership or label IDs. The solid cut uses the same physical material and lighting as the surface, with native-resolution T1 gradients perturbing lighting normals only. This relief is illustrative material shading, not measured tissue topography. Atlas-colour mode disables T1 modulation. L/R and anatomical directions are explicitly marked. The 2D coronal and axial views use neurological orientation (patient left on screen left); 3D labels follow the actual camera direction.

**Limits** (as published, with `anatomy: bert`): this is one published individual's anatomy — exact for that person, nobody else's, and not a clinically validated model. The MRI and segmentation have a 1 mm source grid. White/gray contours in tissue mode follow the native reconstructed surfaces. Atlas-colour boundaries and isolated parcels follow the same native surfaces; a cut atlas published without a cortical surface, such as NextBrain, keeps the native voxel steps. Shading does not claim finer anatomical resolution. Fractional slice positions and 512-pixel renderings do not increase source anatomical resolution. Being a single scan rather than an average, the MRI carries that acquisition's own noise and partial-volume effects instead of a template's smoothness. Fine cerebellar folia and tiny nuclei are not resolved by the internal segmentation. The detailed cortical surface and the native voxel segmentation do not coincide exactly; small edge discrepancies and voxel steps remain visible. Surface-defined tissue contours do not smooth or reassign categorical atlas boundaries. Cortical GLB regions remain surface patches; the solids a cut caps them with are closed by extruding each patch to the corresponding white-surface vertices, and a source triangle joins the parcel holding most of its vertices, so a cut boundary can sit up to one triangle from the surface's own barycentric boundary. HCP-MMP1.0 uses the published Mills fsaverage projection, resampled again here through registered spheres: two registrations away from native HCP space. Mixed-label triangle boundaries are a documented visualization convention. Where a segmented structure meets itself at a corner its surface pinches there and is not a two-manifold; 34 of the 333 solid structures do, `validation.json` counts the edges, and the volume each surface encloses stays definite. The cut renderer does not alter surface topology. Gyral white-matter parcels divide white matter by distance to the nearest Desikan cortical label on the 1 mm grid; they are not fibre tracts.

```sh
uv sync --locked
uv run python scripts/prepare_subject.py   # once per anatomy; a no-op for fsaverage
uv run python -m brain_model.build
uv run python -m brain_model.validate
uv run python -m pytest -q
npm test
npm run build
```

`public/models/validation.json` records independent source comparisons, region metadata reconciliation and actual GLB round trips. Native MRI volume checks compare every voxel and the full tkregister affine. Tissue tests decode every Destrieux voxel back to its published source ID, verify unchanged noncortical HCP labels, and independently check HCP projection samples and ribbon exclusion. Validation decodes every white-matter code back to its `wmparc.mgz` label and checks that no parcel voxel lies outside the published crop. Numerical coordinate conversion error is not a biological accuracy estimate.

`deliverables/gpu-browser-qa.json` records browser checks of all cut orientations, atlas switching, filtering, isolation and optional MRI loading. `deliverables/gpu-cut-performance.json` records local continuous-drag measurements. JavaScript tests check GPU/CPU coordinate agreement, cut selection, surface/cut color consistency, and reuse of geometry, textures and clipping planes throughout dragging.

## Sources and terms

The generated mesh assets are modified derivatives of FreeSurfer data.

“All or portions of this licensed product (such portions are the "Software") have been obtained under license from The General Hospital Corporation and are subject to the following terms and conditions:”

The full terms are included in [FreeSurferSoftwareLicense](public/models/licenses/FreeSurfer.html). See the included [FreeSurfer terms](public/models/licenses/FreeSurfer.html) and [HCP data-use terms](public/models/licenses/HCP-Data-Use-Terms.txt) before redistributing source or derived data. Provenance and checksums are recorded in `data/sources.json` and the model manifest.

- [FreeSurfer coordinate systems](https://surfer.nmr.mgh.harvard.edu/fswiki/CoordinateSystems)
- [Destrieux et al., 2010](https://doi.org/10.1016/j.neuroimage.2010.06.010)
- [Glasser et al., 2016, HCP-MMP1.0](https://doi.org/10.1038/nature18933)
- [Yeo et al., 2011, cortical networks](https://doi.org/10.1152/jn.00338.2011)
- [Schaefer et al., 2018, local-global parcellation](https://doi.org/10.1093/cercor/bhx179) — MIT, via [ThomasYeoLab/CBIG](https://github.com/ThomasYeoLab/CBIG)
- [NiBabel FreeSurfer readers](https://nipy.org/nibabel/reference/nibabel.freesurfer.html)
- [Three.js material clipping](https://threejs.org/docs/#Material.clippingPlanes)
- [Trimesh sparse Laplacian operator](https://trimesh.org/trimesh.smoothing.html#trimesh.smoothing.laplacian_calculation)
- [SciPy trilinear coordinate sampling](https://docs.scipy.org/doc/scipy/reference/generated/scipy.ndimage.map_coordinates.html)

GPU volume sampling uses [Three.js Data3DTexture](https://threejs.org/docs/#Data3DTexture). The renderer requires WebGL 2; there is no geometry-worker fallback.
