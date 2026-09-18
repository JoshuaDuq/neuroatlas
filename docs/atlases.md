# Atlases & Anatomical Parcellations

NeuroAtlas integrates eight distinct anatomical, histological, and functional parcellation layers into a unified spatial reference frame. Each layer follows a specific anatomical route and scientific provenance.

---

## Parcellation Layer Matrix

| Layer | Type | Granularity | Source Representation | Coordinate / Mapping Provenance |
| :--- | :--- | :--- | :--- | :--- |
| **Destrieux (`aparc.a2009s`)** | Cortical Surface | 148 parcels + 2 walls | FreeSurfer `.annot` | Native subject folding; zero projection |
| **HCP-MMP1.0** | Cortical Surface | 360 areas | `fs_LR` $\to$ `fsaverage` | Resampled via `sphere.reg` spherical nearest neighbor |
| **Learning Anatomy** | Deep / Internal | 82 teaching solids | NextBrain + Aseg unions | Taubin smoothed ($\le 0.6\text{ mm}$ bounded displacement) |
| **Aseg Reference** | Subcortical | 35 structures | `aseg.mgz` volume | Native marching cubes ($0.5$ isovalue) |
| **NextBrain Histology** | Histological | 483 ROIs (298 3D) | MNI152 histology | ANTs non-linear SyN warp to `orig.mgz` |
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

- **Pedagogical Goal**: Bridges the gap between coarse 35-structure segmentations and overwhelming 483-region histological atlases by organizing anatomy into **eight cohesive systems**:
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
[Level 3: NextBrain Detail]  ---> 298 solid histological nuclei
```

- **Aseg (Level 2)**: Extracted from `aseg.mgz` at native $1\text{ mm}$ voxel resolution using marching cubes at an isovalue of $0.5$.
- **NextBrain (Level 3)**:
  - 483 histological regions segmented on an ex-vivo MNI152 template.
  - Resampled onto the subject's native T1w volume via ANTs non-linear SyN warping (`scripts/warp_nextbrain.py`) using `genericLabel` interpolation.
  - 298 structures meet the `minimum_mesh_voxels` threshold and are rendered as 3D solids. The remaining 185 regions (e.g., thin lamina, deep white matter sheets) are preserved as interactive 3D cut labels.

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
