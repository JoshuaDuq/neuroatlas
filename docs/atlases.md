# Atlases & Anatomical Parcellations

NeuroAtlas integrates eight distinct anatomical, histological, and functional parcellation layers into a unified spatial reference frame. Each layer follows a specific anatomical route and scientific provenance.

---

## Parcellation Layer Matrix

| Layer | Type | Granularity | Source Representation | Coordinate / Mapping Provenance |
| :--- | :--- | :--- | :--- | :--- |
| **Destrieux (`aparc.a2009s`)** | Cortical Surface | 148 parcels + 2 walls | FreeSurfer `.annot` | Native subject folding; zero projection |
| **HCP-MMP1.0** | Cortical Surface | 360 areas | `fs_LR` $\to$ `fsaverage` | Resampled via `sphere.reg` spherical nearest neighbor |
| **Learning Anatomy** | Deep / Internal | 82 teaching solids | NextBrain + Aseg unions | Taubin smoothed ($\le 0.6\text{ mm}$ bounded displacement) |
| **Aseg Reference** | Subcortical | 35 structures | `aseg.mgz` volume | Marching cubes, smoothed $\le 0.6\text{ mm}$ with every voxel centre kept on its side |
| **NextBrain Histology** | Histological | 515 ROIs (328 3D) | Subject segmentation, 0.4 mm | FreeSurfer 8.2 NextBrain on `orig.mgz`; cut faces 0.8 mm |
| **Gyral White Matter** | Subcortical Ribbon| 68 parcels | `wmparc.mgz` volume | Native 5 mm nearest Desikan gyrus boundary |
| **Spinal Cord** | Neuroaxis Reference| 58 tracts & horns | Z-Anatomy mesh | Canonical schematic assembly translated below brainstem |
| **Yeo 7 Networks** | Functional Network | 7 networks | Schaefer 2018 on `fsaverage`| Vertex-level mapping across registered spheres |

---

## 1. Anatomical Cortex: Destrieux (`aparc.a2009s`)

- **Anatomical Definition**: FreeSurfer's Destrieux atlas delineates 74 sulcal and gyral structures per hemisphere ($148$ total), plus two explicitly unlabelled medial wall surfaces.
- **Fidelity Guarantee**: Derived directly from the subject's native `lh.aparc.a2009s.annot` and `rh.aparc.a2009s.annot`. No projection, spatial resampling, or coordinate shifts are applied.
- **Triangle Partitioning**: Triangles spanning two or more regions are deterministically partitioned into planar barycentric sub-cells anchored at the face centroid and edge midpoints. This preserves $100\%$ of the pial surface area while maintaining crisp, discrete boundaries.

---

## 2. Multimodal Cortex: HCP-MMP1.0

- **Anatomical Definition**: 180 multimodal cortical areas per hemisphere ($360$ total) defined by Glasser et al. (2016) based on structural MRI, resting-state fMRI, task fMRI, and retinotopic mapping.
- **Provenance Route**:
  1. Originates in the Human Connectome Project's standard `fs_LR` mesh space.
  2. Projected to `fsaverage` via the published Mills projection.
  3. Resampled onto the native subject via FreeSurfer's registered spherical space (`sphere.reg`) using nearest-neighbor vertex transfer (`mri_surf2surf`).
- **Interpretation Boundary**: No coordinate is displaced, but vertex labels are resampled. It is native HCP geometry in neither `bert` nor `aomic`.

---

## 3. Learning Anatomy: 82 Overview Structures

- **Pedagogical Goal**: Bridges the gap between coarse 35-structure segmentations and overwhelming 515-region histological atlases by organizing anatomy into **eight cohesive systems**:
  1. **Basal Ganglia**: Caudate, putamen, globus pallidus (GPi/GPe), subthalamic nucleus, substantia nigra.
  2. **Diencephalon**: Thalamic nuclei complexes, epithalamus, hypothalamus, mammillary bodies.
  3. **Limbic System**: Hippocampal formation, amygdaloid complex, fornix, cingulate connections.
  4. **Brainstem**: Midbrain, pons, medulla oblongata, red nuclei.
  5. **Basal Forebrain**: Nucleus accumbens, septal nuclei, substantia innominata.
  6. **Cerebellum**: Cerebellar cortex (mantle), dentate nuclei, interposed nuclei.
  7. **Ventricular System**: Lateral ventricles, third ventricle, cerebral aqueduct, fourth ventricle.
  8. **White Matter Pathways**: Corpus callosum, anterior commissure, optic chiasm/tracts.
- **Geometric Construction**:
  - Derived from explicit label unions defined in [`config/learning-anatomy.yaml`](../config/learning-anatomy.yaml).
  - Subjected to volume-preserving [Trimesh Taubin smoothing](https://trimesh.org/trimesh.smoothing.html#trimesh.smoothing.filter_taubin) with an absolute maximum displacement ceiling of $0.6\text{ mm}$ from source voxel boundaries.
  - Structures crossing the central axis declare `hemisphere: midline` and remain unified (e.g., optic chiasm) rather than being split arbitrarily at the sagittal zero plane.

---

## 4. Subcortical Reference Levels: Aseg & NextBrain

NeuroAtlas supports three mutually exclusive internal detail levels:

```
[Level 1: Learning Anatomy] ---> 82 pedagogical overview solids (Default)
[Level 2: Aseg Reference]   ---> 35 FreeSurfer native segmentation structures
[Level 3: NextBrain Detail]  ---> 328 solid histological nuclei
```

- **Aseg (Level 2)**: Extracted from `aseg.mgz` at native $1\text{ mm}$ voxel resolution using marching cubes at an isovalue of $0.5$.
- **Display smoothing (all three levels)**: The voxel staircase is smoothed with the same bounded Taubin filter as the learning solids: no vertex moves more than $0.6\text{ mm}$, and wherever smoothing would carry the surface across a voxel centre it is pulled back until none is crossed. Every source voxel therefore lies on the same side of the published surface as it does of the raw marching-cubes surface; validation re-voxelizes each solid to prove it.
- **NextBrain (Level 3)**:
  - 515 histological regions from this brain's own NextBrain segmentation (bert). `scripts/segment_nextbrain.py` runs FreeSurfer 8.2's SuperSynth and then NextBrain's Bayesian segmentation (`mri_histo_atlas_segment_fireants`, `invivo` mode, CPU) on each hemisphere of `orig.mgz`, which takes about 20 minutes per brain.
  - FreeSurfer writes each hemisphere on its own 0.4 mm grid. The two are joined by nearest neighbour onto one 0.4 mm grid in the subject's surface RAS, moving no label more than 0.25 mm. The few thousand midline voxels both sides label go to the side given by SuperSynth's MNI $x$, the rule FreeSurfer splits the hemispheres by.
  - The build places the volume through `orig.mgz`'s scanner-to-surface transform, never through the volume's own header: an MGH header's tkregister matrix is centred on that volume, and it is surface RAS only for the conformed 256³ grid.
  - 328 structures of at least $10\text{ mm}^3$ (`minimum_mesh_volume_mm3`) are meshed at 0.4 mm and rendered as 3D solids. The remaining 187 regions (white matter, cerebellar cortical layers, cortical parcels and smaller nuclei) are cut labels only.
  - Cut faces sample a 0.8 mm copy: each $2 \times 2 \times 2$ block of source voxels takes its most frequent label, a tie going to the label rarer in the whole volume. This keeps the GPU label texture at 11 MiB, not 88 MiB. The cost is thin structures coarser on a cut than on their surfaces, and cut-only fragments of at most $4.5\text{ mm}^3$ that win no block (20 on bert, 29 on aomic). Search still finds them, marked as too small for the cut, and the manifest keeps their measured volumes.
  - Workarounds needed to run FreeSurfer 8.2 on macOS arm64 live in `scripts/freesurfer/`. There are three: a sliced 3D convolution replacing torch's 90 GB im2col path, two earlier memory releases in SuperSynth, and a stand-in for an unused OpenCV import. None changes a computed value. `data/sources.json` records each one's justification, together with the FreeSurfer build, the model and atlas checksums, and the crop.

---

## 5. Gyral White Matter (`wmparc`)

- **Anatomical Definition**: 68 white-matter parcels adjacent to Desikan-Killiany cortical gyri, extracted from `wmparc.mgz`.
- **Classification**: Each white-matter voxel within $5\text{ mm}$ of the cortical ribbon carries the label of the nearest Desikan gyrus.
- **Volumetric Representation**: Stored as a compact $2.2\text{ MiB}$ cropped 3D volume texture (`white-matter.volume`) on the GPU. When cutting through white matter, voxels sample gyral names on hover and selection while maintaining natural tissue coloration.

---

## 6. Spinal Cord Neuroaxis Reference

- **Anatomical Definition**: 58 detailed structures derived from the Z-Anatomy project, encompassing the cervical cord, central canal, dorsal/ventral roots, spinal ganglia, cauda equina, 19 white matter tracts (e.g., corticospinal, spinothalamic, posterior columns), and gray matter horns with Rexed laminae.
- **Spatial Alignment**: The spinal assembly is seated beneath the brainstem via rigid translation. It represents a canonical reference cross-section rather than an individual subject registration.
- **Licensing**: Distributed under **CC BY-SA 4.0** (see [References & Licensing](references.md)).

---

## 7. Functional Networks: Yeo 7 Resting-State Networks

- **Definition**: The 7 canonical resting-state functional networks defined by Yeo et al. (2011): Visual, Somatomotor, Dorsal Attention, Ventral Attention, Limbic, Frontoparietal, and Default Mode.
- **Implementation**: Mapped via the Schaefer 2018 parcellation onto `fsaverage` and transferred to the subject via registered spheres. Stored per vertex as an unquantized `_NETWORK` uint8 attribute ($1-7$).
- **Coloring**: Surfaces paint discrete network colors without interpolating across triangle faces. Medial wall vertices remain uncolored.
