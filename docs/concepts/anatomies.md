# Anatomies

NeuroAtlas builds from real MRI acquisitions and complete FreeSurfer reconstructions. It does not synthesise a generic template. Each declared anatomy is one individual's brain, or the FreeSurfer group average, and each one is configured in [`config/model.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/config/model.yaml).

```yaml
# config/model.yaml
anatomy: snail       # the default build selection
```

## Declared anatomies

| Anatomy ID | Subject | Acquisition and reconstruction | Licence | Role |
| :--- | :--- | :--- | :--- | :--- |
| **`snail`** | SNAIL `subj_1` | FreeSurfer 8.2 reconstruction of the bundled tractography reference T1w | CC0 1.0, as its source | Published viewer default |
| **`bert`** | FreeSurfer's canonical worked example | Single-subject 1 mm T1w, FreeSurfer 5.2.0 (January 2013) | FreeSurfer Software License | Published reference anatomy |
| **`aomic`** | AOMIC-PIOP1 `sub-0022` | Single-subject 3T T1w, FreeSurfer 6.0.1 (2021) | **CC0 (public domain)** | Permissively licensed individual |
| **`fsaverage`** | FreeSurfer group average template | 40-subject surface template, FreeSurfer 6 | FreeSurfer Software License | Configured build; not published in the viewer |

The viewer reads [`public/models/anatomies.json`](https://github.com/JoshuaDuq/neuroatlas/blob/main/public/models/anatomies.json). That file currently lists SNAIL, `bert` and `aomic`, with SNAIL as the default. Changing the build selection alone does not add a subject to the index.

`snail` is reconstructed from the same reference MRI as the bundled tractography, so the cortex and the tracts share a frame. [Diffusion and tracts](../guides/tracts.md) describes that link. Its scan ends inside the brainstem, at z = −75 mm, so `snail` publishes no spinal cord: the reference cord has no imaged lower end to be seated against.

`fsaverage` is a template, not an individual. It has a build configuration, and the atlases it carries are published in its space. It is not published in the viewer, so its assets do not appear in the index. Its NextBrain volume has no published licence and is kept locally, so it builds only where that volume exists.

Every source file a build reads for `snail`, `bert` and `aomic` is committed and pinned in `data/sources.json`, so each can be rebuilt and validated from a fresh clone. For `snail` that is its 25 pinned files and the two surfaces its `?h.pial` links point to, about 39 MB out of a 414 MB `recon-all` tree; the rest of the tree stays local.

## Why `aomic` (`sub-0022`)

NeuroAtlas includes the Amsterdam Open MRI Collection ([AOMIC-PIOP1, OpenNeuro ds002785](https://openneuro.org/datasets/ds002785)) as a public-domain individual reconstruction. It complements the historical `bert` reference and the SNAIL subject, which is used for anatomy and tractography correspondence.

### Image quality and reconstruction fidelity

[MRIQC's structural image-quality metrics](https://mriqc.readthedocs.io/en/stable/iqms/t1w.html), including CJV and CNR, describe the MRI acquisition. They do not establish the anatomical accuracy of a FreeSurfer reconstruction. This repository does not include the cohort metric table or the ranking procedure needed to support a best-in-cohort claim, so no such rank is asserted for `sub-0022`. Reconstruction fidelity is assessed against its own recorded source files and scan, within the limits on the [validation](../validation.md#scientific-limitations-and-boundaries) page.

## Candidates that were excluded

Every candidate had to meet one requirement: a **complete, published `recon-all` directory**. That means the pial, white, sulc and `sphere.reg` surfaces, native Destrieux `.annot` parcellations, and the conformed 256³ `orig.mgz`, `aseg.mgz`, `ribbon.mgz` and `aparc.a2009s+aseg.mgz` volumes.

| Dataset | Status | Reason |
| :--- | :--- | :--- |
| FreeSurfer Maintenance Dataset (`ds004958`) | Excluded | Raw BIDS MRI only. It has no precomputed `recon-all` derivatives. |
| Penn LEAD anatomical derivatives (`ds007089`) | Excluded | fMRIPrep derivatives only. They publish GIFTI surfaces in fsnative space and T1w volumes, but no FreeSurfer `.annot` parcellation. Reconciling the grids would mean re-running the parcellations. |
| Mindboggle-101 | Excluded | VTK surface meshes with DKT labels only. No FreeSurfer directory structure, no `sphere.reg`, and no native conformed volumes. |
| FreeSurfer 2018 tutorial subjects | Excluded | Incomplete reconstruction directories, missing `sulc`, `aseg.mgz` and `aparc.a2009s+aseg.mgz`. Licence unstated. |
| FreeSurfer 8.2 distribution (2026) | Excluded | Ships no reconstruction, only raw sample files (`sample-001.mgz`) that need a local `recon-all`. The annexed `bert` is an unversioned test fixture. |

## Licence and provenance per anatomy

- `bert` and `fsaverage` are distributed under the FreeSurfer Software License. Their notice is in `public/models/licenses/FreeSurfer.html`.
- `aomic` is CC0. Its source is OpenNeuro ds002785. The checksum of every file fetched is recorded in `data/sources.json`.
- `snail`'s tract reference, which shares its T1 with the reconstruction, is published under CC0. See [References and licensing](../reference/references.md#cc0-10-universal-snail-diffusion-reference). The reconstruction is derived from that T1 alone, and `data/snail/reconstruction.json` records it as CC0 1.0.

The full licence terms for each asset layer are in [References and licensing](../reference/references.md).
