# Atlases and parcellations

NeuroAtlas places eight parcellation layers in one spatial frame. Each follows a specific route from its source, and each route is stated here so you can judge what the layer means.

The counts below describe `bert` unless a subject is named. `snail`, the published default, has 79 teaching solids, 32 aseg structures and 306 NextBrain meshes. The subject's `manifest.json` is authoritative for what is actually present.

## Layer matrix

| Layer | Type | Granularity | Source representation | Coordinate and mapping provenance |
| :--- | :--- | :--- | :--- | :--- |
| **Destrieux (`aparc.a2009s`)** | Cortical surface | 148 parcels and 2 walls | FreeSurfer `.annot` | Native subject folding; no projection |
| **HCP-MMP1.0** | Cortical surface | 360 areas | `fs_LR` → `fsaverage` | Resampled through `sphere.reg` by spherical nearest neighbour |
| **Learning anatomy** | Deep, internal | 82 teaching solids (79 in `snail`) | NextBrain and aseg unions | Taubin-smoothed, bounded to 0.6 mm displacement |
| **Aseg reference** | Subcortical | 35 structures (32 in `snail`) | `aseg.mgz` volume | Marching cubes, smoothed within 0.6 mm, every voxel centre kept on its side |
| **NextBrain histology** | Histological | 515 ROIs, 328 meshed (in `bert`) | Subject segmentation at 0.4 mm | FreeSurfer 8.2 NextBrain on `orig.mgz`; cut faces at 0.8 mm |
| **Gyral white matter** | Subcortical ribbon | 68 parcels | `wmparc.mgz` volume | Native, within 5 mm of cortex, nearest Desikan gyrus |
| **Spinal cord** | Neuroaxis reference | 58 tracts and horns | Z-Anatomy mesh | Canonical schematic assembly, translated below the brainstem; not on `snail` |
| **Yeo 7 networks** | Functional network | 7 networks | Schaefer 2018 on `fsaverage` | Vertex-level mapping across registered spheres |
| **CAB-NP networks** | Functional network | 12 networks | Ji et al. 2019 label key | One network per HCP-MMP area, by area name |
| **Functional divisions** | Published area groupings | 22 sections, 21 named regions | Glasser 2016 Table 1; Glasser 2016, Rolls 2022 and Rolls 2023 area lists | One section, and at most one named region, per HCP-MMP area, by area name |
| **Neuropsychological domains** | Meta-analytic | 11 domains | Neurosynth version 7 consistency maps | Every domain whose mean z reaches 3, per HCP-MMP area on `fsaverage`, by area name |

## Anatomical cortex (Destrieux)

- **Definition.** FreeSurfer's Destrieux atlas divides each hemisphere into 74 sulcal and gyral structures, 148 in total, plus two explicitly unlabelled medial-wall surfaces.
- **Source.** The labels come from each subject's own `lh.aparc.a2009s.annot` and `rh.aparc.a2009s.annot`. No projection, resampling or coordinate shift is applied.
- **Triangle partitioning.** A triangle that spans two or more regions is split deterministically into planar barycentric sub-cells. The cuts run from the face centroid to the edge midpoints. The partition keeps 100% of the pial surface area, and the boundaries stay crisp and discrete.

## Multimodal cortex (HCP-MMP1.0)

- **Definition.** 180 multimodal cortical areas per hemisphere, 360 in total, defined by Glasser et al. (2016) from structural MRI, resting-state fMRI, task fMRI and retinotopic mapping.
- **Route.**
  1. The labels originate in the Human Connectome Project's standard `fs_LR` mesh space.
  2. They are projected to `fsaverage` using the published Mills projection.
  3. They are resampled onto the subject through FreeSurfer's registered spherical space (`sphere.reg`): each subject vertex takes the label of the nearest `fsaverage` vertex on the registered spheres, found with SciPy's `cKDTree` in `scripts/prepare_subject.py`. Validation repeats the transfer and requires the committed annotation byte for byte.
- **Interpretation.** No coordinate is displaced, but the vertex labels are resampled. The individual cortical mesh remains native. The HCP labels are projected from a group atlas, so their placement in a subject is an estimate.

## Comparing Destrieux and HCP-MMP

The SNAIL inspector offers both directions of comparison. A row gives the area shared by the selected region and a region of the other atlas. That area is divided by the **whole** pial surface area of the selected region. The same intersection therefore has different percentages in the two directions. For example, SNAIL's left precentral gyrus shares about 563.0 mm² with HCP area 4. That is 22.7% of the gyrus and 33.9% of area 4.

The calculation uses the common source pial tessellation. Each triangle contributes one third of its area to each corner's barycentric vertex cell. Joint annotation pairs group those cells. This follows the same midpoint and centroid convention as the boundaries above, and a triangle whose three corners agree counts whole. All areas are accumulated in float64 mm². Unassigned and medial-wall cells stay in the denominator and appear as an explicit remainder. No small overlap is removed or renormalised.

The first four named overlaps stay visible, and a disclosure holds the rest. Surface overlap is not a statement of functional equivalence, and the HCP group-to-subject projection remains an estimate. The viewer's use of this comparison is described in [Comparing cortical atlases](../guides/atlas-comparison.md). The files and their checks are on the [validation](../validation.md#atlas-correspondence) page.

## Learning anatomy

Learning anatomy bridges the coarse 35-structure segmentation and the 515-region histological atlas. It organises the subcortical anatomy into eight systems:

1. **Basal ganglia**: caudate, putamen, globus pallidus (external and internal), nucleus accumbens and related nuclei.
2. **Diencephalon**: thalamic nuclei, epithalamus, hypothalamus and mammillary bodies.
3. **Limbic**: hippocampal formation, amygdaloid complex, fornix and cingulate connections.
4. **Brainstem**: midbrain, pons, medulla and red nuclei.
5. **Basal forebrain**: nucleus accumbens, septal nuclei and substantia innominata.
6. **Cerebellum**: cerebellar cortex, dentate and interposed nuclei.
7. **Ventricles and CSF**: lateral ventricles, third ventricle, cerebral aqueduct and fourth ventricle.
8. **White matter pathways**: corpus callosum, anterior commissure and optic tracts.

The mapping is defined in [`config/learning-anatomy.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/config/learning-anatomy.yaml). Units that cross the midline are declared `hemisphere: midline`, so the optic chiasm stays one unit rather than being split at the sagittal zero plane.

Each unit is a union of explicit source labels. Its display surface is smoothed with [trimesh's Taubin filter](https://trimesh.org/trimesh.smoothing.html#trimesh.smoothing.filter_taubin), bounded so that no vertex moves more than 0.6 mm from its raw marching-cubes position. Every source voxel centre keeps its inside or outside classification. The enclosed mesh volume can change, so the volumes reported are measured from the source voxels.

## Subcortical reference levels

NeuroAtlas offers three mutually exclusive internal detail levels. Only one is drawn at a time.

```
[Level 1: Learning anatomy] ---> 82 teaching overview solids in bert (default)
[Level 2: Aseg reference]   ---> 35 FreeSurfer segmentation structures in bert
[Level 3: NextBrain detail] ---> 328 solid histological nuclei in bert
```

**Aseg (level 2)** is extracted from `aseg.mgz` at its native 1 mm voxel size, by marching cubes at an isovalue of 0.5.

**Display smoothing (all three levels)** uses the same bounded Taubin filter as the learning solids. No vertex moves more than 0.6 mm. Wherever smoothing would carry a surface across a voxel centre, the surface is pulled back until none is crossed. Every source voxel therefore lies on the same side of the published surface as it does of the raw marching-cubes surface. Validation re-voxelises each solid to prove it.

**NextBrain (level 3)** has the following properties:

- It has 515 histological regions from this brain's own NextBrain segmentation for `bert`. `scripts/segment_nextbrain.py` runs FreeSurfer 8.2's SuperSynth and then NextBrain's Bayesian segmentation (`mri_histo_atlas_segment_fireants`, `invivo` mode, CPU) on each hemisphere of `orig.mgz`. That takes about 20 minutes per brain.
- FreeSurfer writes each hemisphere on its own 0.4 mm grid. The two are joined by nearest neighbour onto one 0.4 mm grid in the subject's surface RAS, and no label moves more than 0.25 mm. The few thousand midline voxels that both sides label go to the side given by SuperSynth's MNI $x$ coordinate. That is the rule FreeSurfer uses to split the hemispheres.
- The build places the volume through `orig.mgz`'s scanner-to-surface transform, never through the volume's own header. An MGH header's tkregister matrix is centred on that volume. It is a surface RAS transform only for the conformed 256³ grid.
- The 328 structures of at least $10\text{ mm}^3$ (`minimum_mesh_volume_mm3`) are meshed at 0.4 mm and drawn as 3D solids. The remaining 187 regions are cut labels only. They are white matter, cerebellar cortical layers, cortical parcels and smaller nuclei.
- Cut faces sample a 0.8 mm copy. Each $2 \times 2 \times 2$ block of source voxels takes its most frequent label. A tie goes to the label that is rarer in the whole volume. This keeps the GPU label texture at about 11 MiB instead of 88 MiB. The cost is that thin structures are coarser on a cut than on their surfaces. Cut-only fragments of at most $4.5\text{ mm}^3$ that win no block are lost on the cut. There are 20 such labels in `bert` and 29 in `aomic`. Search still finds them, marked as too small for the cut, and the manifest keeps their measured volumes.
- The workarounds that FreeSurfer 8.2 needs on macOS arm64 are in `scripts/freesurfer/`. Two change no computed value. The third, a sliced 3D convolution, sums the same products in a different order, so SuperSynth's outputs differ from stock torch in floating-point rounding, below $10^{-5}$ relative on its test cases. Whether that moves any label is not known, as the [build guide](../guides/building.md#freesurfer-82-workarounds) explains. `data/sources.json` records each one's justification, with the FreeSurfer build, the model and atlas checksums, and the crop.

## Gyral white matter (`wmparc`)

- **Definition.** 68 white-matter parcels adjacent to Desikan–Killiany cortical gyri, taken from `wmparc.mgz`.
- **Classification.** Each white-matter voxel within 5 mm of the cortical ribbon takes the label of the nearest Desikan gyrus. Deeper white matter is not segmented and belongs to no region.
- **Volume.** Published as a cropped 3D label volume (`white-matter.volume`), which is 2.2 MiB on the GPU as one byte per voxel. Cut through white matter, the viewer names the gyrus under the pointer and keeps the tissue colouring.

## Spinal cord neuroaxis reference

- **Definition.** 58 structures derived from the Z-Anatomy project. They include the cervical cord, the central canal, the dorsal and ventral roots, the spinal ganglia, the cauda equina, 19 white-matter tracts (such as the corticospinal and spinothalamic tracts and the posterior columns), and the grey-matter horns with Rexed laminae.
- **Placement.** The assembly is seated below the brainstem by a rigid translation, with no rotation or scaling. It is a canonical reference cross-section, not a registration to the subject's MRI.
- **Coverage.** The cord is seated against the lower end of aseg's brainstem, so it is placed only where the scan images that end. The build refuses it when the lowest brainstem slice is also the lowest slice holding any MRI signal. `bert` and `aomic` publish it: their brainstem labels stop at z = −67 mm and −75 mm, above signal reaching −125 mm and −120 mm. `snail` does not: its scan ends at z = −75 mm with 183 brainstem voxels labelled on that last slice.
- **Licence.** CC BY-SA 4.0. See [References and licensing](../reference/references.md#cc-by-sa-40-copyleft-spinal-cordglb).

## Functional networks (Yeo 7)

- **Definition.** The seven canonical resting-state networks of Yeo et al. (2011): visual, somatomotor, dorsal attention, ventral attention, limbic, frontoparietal and default mode.
- **Implementation.** Mapped with the Schaefer 2018 parcellation onto `fsaverage`, then transferred to the subject through the registered spheres. Stored per vertex as an unquantised `_NETWORK` `uint8` attribute, with values $1$–$7$.
- **Colouring.** Surfaces paint discrete network colours without interpolating across triangle faces. Medial-wall vertices stay uncoloured.
- **Composition.** Cortical parcel percentages count the source vertices assigned to each network. NextBrain cortical percentages count the cortical voxels assigned through their nearest pial or white surface vertex. Both exclude unassigned samples. Neither measures surface area or this individual's functional activity. The viewer hides contributions below 5% without rescaling the remaining percentages.

## Functional networks (CAB-NP)

- **Definition.** The Cole-Anticevic Brain-wide Network Partition of Ji et al. (2019), version 1.1.6. It assigns each of HCP-MMP1.0's 360 areas to one of 12 resting-state networks: primary visual, secondary visual, somatomotor, cingulo-opercular, dorsal attention, language, frontoparietal, auditory, default mode, posterior multimodal, ventral multimodal and orbito-affective.
- **Implementation.** `brain_model.layers.cab_np` reads the published label key, pinned by checksum in `data/sources.json`, and matches each area by its Glasser name in each hemisphere. The hemispheres are assigned separately, so the 13 areas that CAB-NP places in a different network on each side keep that difference. The assignments are published in `cab-np.json`, not in the manifest or the meshes.
- **Colouring.** An area is coloured whole with its network's published colour. The boundaries are therefore HCP-MMP's own, and the colours appear only while the HCP-MMP atlas is shown. Choosing CAB-NP switches to that atlas; switching to Destrieux returns to its region colours. A cut colours HCP-MMP labels by their network and leaves other labels in tissue colour.
- **Limits.** These are group networks from Human Connectome Project participants, not this brain's measured function. They reach an individual brain through the same projection as HCP-MMP, so they inherit its registration error.
- **Licence.** Non-commercial only. See [References and licensing](../reference/references.md#cab-np-license-cab-npjson).

## Functional divisions

- **Definition.** Two levels of published groupings of HCP-MMP1.0 areas, kept apart because they cross: the 22 sections of Glasser et al. (2016, Neuroanatomical Supplementary Results, Table 1), which partition the cortex, and 21 named regions that a source defines as lists of HCP-MMP areas. Eleven come from Glasser's own correspondences (V1, MT, the fusiform face complex, M1, S1, SII, SMA, FEF, PEF, Broca's area and A1). Six come from Rolls et al. (2022, *Cereb Cortex*): lateral and medial orbitofrontal cortex, subgenual cingulate, pregenual and supracallosal anterior cingulate, and area 10 with related ventromedial prefrontal regions. Four come from Rolls et al. (2023, *Hum Brain Mapp*): the midcingulate cortex and the three posterior cingulate groups.
- **No invented borders.** A name no source defines as a set of HCP-MMP areas is not drawn: dorsomedial prefrontal cortex, a dorsolateral prefrontal cortex narrower than Glasser's section 22, the temporoparietal junction and the intraparietal sulcus exist here only within Glasser's sections.
- **Contested areas.** Glasser's supplement places six areas (23c, 52, PFcm, TF, a47r, pOFC) in one section in Table 1's bold primary column and in another in each section's opening text. The sections follow Table 1, as HCPex v1.1 does. MNE's `fetch_hcp_mmp_parcellation(combine=True)` follows the texts. The alternative is published beside each area and shown in the inspector.
- **Implementation.** `brain_model.layers.functional_regions` reads `config/functional-regions.yaml` and matches each area by its Glasser name in each hemisphere. It checks that the sections hold all 180 areas once, that no area is in two named regions, and that every named area is in a section. The assignments are published in `functional-regions.json`.
- **Display.** The *Functional* colour mode draws the divisions of the level on show solid, in display colours chosen so neighbouring divisions differ by an OKLab ΔE of at least 15 under normal and simulated red-green colour vision. The rest of the cortex is glass at `appearance.glass_opacity` of the cortex opacity, after the glass-brain figures of Carlén (2017). An opaque named region is closed behind its surface by its ribbon solid, cut from the native pial and white envelopes, so it reads as a piece of cortex from any side. A division seen through the glass is picked through it.
- **Limits.** These are published groupings of whole areas, reaching an individual brain through the HCP-MMP projection and inheriting its registration error. They are not this brain's measured function.

## Neuropsychological domains

- **Definition.** Eleven domains a neuropsychological assessment reports: executive functions, working memory, long-term (episodic) memory, language, attention, visuospatial abilities and social cognition, then visual perception, motor functions, auditory perception and emotion. Each is one Neurosynth abstract term: `executive function`, `working memory`, `episodic memory`, `language`, `attention`, `visuospatial`, `social cognition`, `visual`, `motor`, `auditory` and `emotion`. The last four were added so that sensory, motor and limbic cortex is not left blank; narrower terms (`visual perception`, `decision making`, `semantic memory`) reached almost no area the first seven did not.
- **Maps.** Neurosynth's uniformity (consistency) test, computed with NiMARE as Neurosynth computes it: MKDA chi-square with a 6 mm kernel, the studies whose abstract uses the term at a TF-IDF of at least 0.001 against all others. A consistency map shows where studies of a domain reliably report activation, which is the question "which regions contribute to this domain". Neurosynth's association test answers a different one, how specific an activation is to the term, and it leaves executive function almost empty, because executive regions are engaged by nearly every demanding task. NeuroQuery was also compared; its map for social cognition centred on face perception, because its maps for these terms are inferred from related words rather than from reported coordinates.
- **Areas.** `scripts/derive_domain_scores.py` samples each map between `fsaverage`'s white and pial surfaces with nilearn and averages it per HCP-MMP area into `data/neuropsych-domains/area-scores.json`, with the Neurosynth files' checksums and each term's study count. An area belongs to every domain whose mean z reaches 3, so the frontoparietal, insular and cingulate regions that most demanding tasks engage belong to several.
- **Strongest domain.** Consistency z grows with a term's study count: 154 studies use executive function, 1,831 attention. When all domains are shown, an area takes the domain whose z there is the largest share of that domain's own cortical maximum, so a large literature does not take every shared area.
- **Lesion check.** Each domain names the lesion associations in `data/neuropsychology.yaml` that bear on it. For each Destrieux parcel those associations map, the build reports the share of its `fsaverage` vertices that lie in the domain's areas. Subcortical parcels are reported as off the cortical surface. Working memory has no lesion association yet.
- **Display.** The *Neuropsychological domains* colour mode draws each area in its domain's colour on opaque cortex; the areas that reach no domain stay plain grey. Most are orbitofrontal, frontopolar and anterior temporal cortex, where fMRI loses signal near the sinuses and few studies report activation for any term, and parts of dorsal prefrontal and medial parietal cortex that many tasks engage but none consistently enough. Domains whose areas share a border differ by an OKLab ΔE of at least 14, and any two by at least 11, under normal and simulated red-green colour vision.
- **Limits.** These maps describe the activation literature in healthy groups, reaching an individual brain through the HCP-MMP projection. They are not this brain's measured function and not a prediction of what damage would impair. A study counts when its abstract uses the term, whatever task it ran. The maps are cortical, and Neurosynth's MNI152 maps are sampled on `fsaverage`, whose MNI305 space differs by a few millimetres.
- **Licence.** Neurosynth's data are under the Open Database License 1.0; the derived area scores and `neuropsych-domains.json` are shared under the same licence. See [References and licensing](../reference/references.md#open-database-license-neuropsych-domainsjson).
