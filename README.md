# NeuroAtlas

[![WebGL 2](https://img.shields.io/badge/WebGL-2.0-blue.svg)](https://www.khronos.org/registry/webgl/specs/latest/2.0/)
[![Three.js](https://img.shields.io/badge/Three.js-r174-black.svg)](https://threejs.org/)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
[![glTF 2.0](https://img.shields.io/badge/glTF-2.0-green.svg)](https://www.khronos.org/gltf/)

**NeuroAtlas** is a source-faithful, selectable 3D brain model engineered for neuroscientific education and anatomical research. Anchored in individual FreeSurfer reconstructions at full native resolution, it combines real-time solid anatomical tissue cuts, categorical 3D label sampling, registered T1 material variation, multi-atlas parcellation layers, and linked orthogonal MRI reference sections.

---

## Anatomical & Functional Layers

| Parcellation Layer | Granularity | Source Representation | Scientific Route |
| :--- | :--- | :--- | :--- |
| [**Destrieux (`aparc.a2009s`)**](docs/atlases.md#1-anatomical-cortex-destrieux-aparca2009s) | 148 parcels + 2 walls | Native FreeSurfer `.annot` | Native subject folding; zero projection |
| [**HCP-MMP1.0**](docs/atlases.md#2-multimodal-cortex-hcp-mmp10) | 360 areas | `fs_LR` $\to$ `fsaverage` | Resampled via `sphere.reg` spherical nearest neighbor |
| [**Learning Anatomy**](docs/atlases.md#3-learning-anatomy-82-overview-structures) | 82 teaching solids | NextBrain + Aseg unions | Taubin smoothed ($\le 0.6\text{ mm}$ bounded displacement) |
| [**Aseg Reference Level**](docs/atlases.md#4-subcortical-reference-levels-aseg--nextbrain) | 35 structures | `aseg.mgz` volume | Marching cubes, smoothed $\le 0.6\text{ mm}$ with every voxel centre kept on its side |
| [**NextBrain Histology**](docs/atlases.md#4-subcortical-reference-levels-aseg--nextbrain) | 515 ROIs (328 3D) | Subject NextBrain segmentation, 0.4 mm | FreeSurfer 8.2 on `orig.mgz`; cut faces 0.8 mm |
| [**Gyral White Matter**](docs/atlases.md#5-gyral-white-matter-wmparc) | 68 parcels | `wmparc.mgz` volume | Native 5 mm nearest Desikan gyrus boundary |
| [**Spinal Cord**](docs/atlases.md#6-spinal-cord-neuroaxis-reference) | 58 tracts & horns | Z-Anatomy scene | Canonical schematic assembly seated below brainstem |
| [**Yeo 7 Networks**](docs/atlases.md#7-functional-networks-yeo-7-resting-state-networks) | 7 networks | Schaefer 2018 on `fsaverage` | Vertex-level mapping across registered spheres |

---

## Core Capabilities

- **Solid Anatomical Cuts**: Cut along sagittal/midsagittal, coronal, axial, or arbitrary oblique planes. GPU stencil caps fill closed anatomical envelopes at the cut interface in real time without generating ad-hoc meshes or re-uploading slices.
- **Categorical 3D Label Sampling**: Moving the cutting plane samples discrete label volumes (`Data3DTexture`) directly on the GPU, maintaining sub-millimeter label precision on cut faces.
- **T1 Material Relief**: Trilinearly sampled T1 MRI intensities subtly modulate lighting normals across cut surfaces, providing realistic tissue relief without displacing geometry.
- **Linked 2D/3D MRI Reference**: Interactive three-plane orthogonal sections synchronized with a 3D crosshair, contrast windowing, and voxel label readouts.
- **Precision-Bounded Mesh Quantization**: Normals quantized to int16 ($\le 1.54 \times 10^{-5}$ error) via `KHR_mesh_quantization`, while vertex coordinates remain untouched bit-exact float32.

---

## Quickstart

### 1. Interactive Web Viewer

```bash
# Install frontend dependencies and launch Vite development server
npm ci
npm run dev
```

Open the displayed URL (default `http://localhost:5173`) in any modern browser supporting WebGL 2.

### 2. Python Build Pipeline

```bash
# Synchronize exact Python environment
uv sync --locked

# Prepare subject files, then segment NextBrain on the subject (FreeSurfer 8.2, ~20 min CPU)
uv run python scripts/prepare_subject.py --anatomy bert
uv run python scripts/segment_nextbrain.py --anatomy bert --record

# Compile binary glTF and 3D volume textures
uv run python -m brain_model.build --anatomy bert

# Run full numerical validation against raw neuroimaging sources
uv run python -m brain_model.validate --anatomy bert
```

---

## Documentation Index

Explore the dedicated documentation modules for in-depth technical specifications:

| Guide | Focus | Description |
| :--- | :--- | :--- |
| [**Documentation Hub**](docs/README.md) | Navigation Hub | Central table of contents and system overview |
| [**System Architecture**](docs/architecture.md) | Rendering & Assets | Coordinate transforms, glTF layout, GPU stencil capping, volume textures |
| [**Atlases & Parcellations**](docs/atlases.md) | Anatomical Layers | Complete descriptions of all 8 cortical and subcortical parcellations |
| [**Subject Anatomies**](docs/anatomies.md) | Declared Anatomies | `bert`, `fsaverage`, and `aomic` (`sub-0022`), selection metrics, candidate audit |
| [**Viewer & API Usage**](docs/usage.md) | User Manual & APIs | Interactive navigation, Three.js headless API (`BrainAtlas`, `BrainSections`) |
| [**Validation & Invariants**](docs/validation.md) | Numerical Fidelity | Topological conservation, quantization bounds, QA transcripts, scientific limits |
| [**References & Licensing**](docs/references.md) | Legal & Bibliography | DOIs, citations, FreeSurfer terms, CC0, and Z-Anatomy CC BY-SA 4.0 terms |
| [**Model Design Spec**](docs/model-design.md) | Design Specification | Original engineering contract and deliverable acceptance criteria |

---

## Supported Anatomies

Configured via [`config/model.yaml`](config/model.yaml) and selectable in the viewer via URL hash (`#anatomy=bert`):

- **`bert`** (Default): FreeSurfer's canonical single-subject worked example (FreeSurfer 5.2.0, Jan 2013).
- **`aomic`**: AOMIC-PIOP1 `sub-0022` (FreeSurfer 6.0.1, 2021). Released under **CC0 (Public Domain)**; objectively selected from 216 subjects for highest contrast-to-noise ratio ($4.714$) and lowest joint variation ($0.258$).
- **`fsaverage`**: FreeSurfer's 40-subject group average surface template.

---

## Scientific Rigor & Transparent Boundaries

- **Single-Subject Individual Anatomy**: Reconstructions represent one human individual. Folding patterns, sulcal depths, and ventricular geometries are real features of that individual and are **not clinically normative**.
- **1 mm Scan, 0.4 mm NextBrain Labels**: The MRI and FreeSurfer segmentations are 1 mm isotropic. NextBrain is segmented at 0.4 mm, but from that 1 mm scan: where neighbouring structures share their T1 contrast, the histological atlas, not the image, places the boundary.
- **Zero Coordinate Smoothing**: Cortical surfaces are preserved exactly as tessellated by FreeSurfer without post-hoc decimation or geometric smoothing.
- **Explicit Limitations**: Read [Validation & Scientific Limits](docs/validation.md#4-scientific-limitations--boundaries) for detailed analysis of HCP spherical resampling distance, what bounds the NextBrain segmentation, and non-manifold corner contacts.

---

## References & Licensing

NeuroAtlas incorporates datasets and parcellations under multiple licensing terms:
- **FreeSurfer Reconstructions (`bert`, `fsaverage`)**: Governed by the [FreeSurfer Software License](public/models/licenses/FreeSurfer.html).
- **AOMIC `sub-0022` Data**: Dedicated to the public domain under [Creative Commons Zero (CC0)](https://openneuro.org/datasets/ds002785).
- **HCP-MMP1.0 Annotation**: Governed by the [HCP Open Access Data Use Terms](public/models/licenses/HCP-Data-Use-Terms.txt).
- **Spinal Cord Assembly**: Derived from [Z-Anatomy](https://www.z-anatomy.com/) under [CC BY-SA 4.0](public/models/licenses/Z-Anatomy.txt) (incorporating BodyParts3D, CC BY-SA 2.1 JP).
- **Software Code**: The build pipeline and web viewer code are released under the **MIT License**.

For full academic citations and DOIs, consult [References, Provenance & Licensing](docs/references.md).
