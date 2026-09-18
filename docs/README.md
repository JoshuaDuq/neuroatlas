# NeuroAtlas Documentation Hub

Welcome to the **NeuroAtlas** technical documentation. This repository provides an individual-specific, source-faithful 3D brain model featuring solid anatomical tissue cuts, categorical 3D label sampling, registered T1 material variation, multi-atlas parcellation layers, and linked orthogonal MRI reference views.

---

## Documentation Index

The documentation is organized into six core modules:

| Module | Focus Area | Key Contents |
| :--- | :--- | :--- |
| [**System Architecture**](architecture.md) | Rendering & Asset Pipelines | Coordinate frames, glTF 2.0 binary layout, GPU stencil capping, 3D volume texture sampling, mesh quantization |
| [**Atlases & Parcellations**](atlases.md) | Anatomical & Functional Layers | Destrieux (148), HCP-MMP1.0 (360), Learning Anatomy (82), Aseg (35), NextBrain (483), Gyral White Matter (68), Spinal Cord (58), Yeo Networks (7) |
| [**Subject Anatomies**](anatomies.md) | Multi-Anatomy Support & Rationale | Declared anatomies (`bert`, `fsaverage`, `aomic`), MRIQC selection metrics, subject preparation scripts, and excluded datasets |
| [**Viewer & API Usage**](usage.md) | Interactive UI & Programmatic APIs | WebGL viewer controls, anatomical cuts, Three.js headless API (`BrainAtlas`, `BrainSections`), Python build CLI |
| [**Validation & Invariants**](validation.md) | Numerical Fidelity & QA | Topological invariants, surface area conservation, quantization bounds, round-trip tests, and explicit scientific limitations |
| [**References & Licensing**](references.md) | Bibliography & Legal Provenance | Academic citations (DOIs), dataset provenance, FreeSurfer terms, HCP Data Use Terms, CC0, and Z-Anatomy CC BY-SA 4.0 |

---

## Core Principles

1. **Individual Source Fidelity**: Anatomy belongs to one published person (`bert` or `aomic` `sub-0022`), not an averaged synthetic template. Folds, ventricles, and asymmetries are real.
2. **Zero Coordinate Interpolation**: Coordinates are never smoothed, decimated, or artistically deformed. Vertices and triangle topology are preserved from native FreeSurfer reconstructions.
3. **Discrete Categorical Labeling**: Atlas boundaries never interpolate across integers. Mixed-label triangles are partitioned with deterministic barycentric vertex cells.
4. **GPU Stencil Solid Capping**: Cuts through closed native envelopes are rendered in real time using GPU stencil buffers without generating ad-hoc cut geometry or rebuilding meshes.
5. **Separation of Geometry and Labels**: Cortical meshes represent true anatomical surfaces, while cut faces sample 3D categorical label volumes (`Data3DTexture`) with nearest-cell precision.
