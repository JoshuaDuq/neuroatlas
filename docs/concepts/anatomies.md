# Anatomies

Each anatomy is one real FreeSurfer reconstruction, declared in [`config/model.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/config/model.yaml). Nothing is synthesised.

| ID | Subject | Reconstruction | Licence | Status |
| :--- | :--- | :--- | :--- | :--- |
| `snail` | SNAIL `subj_1` | FreeSurfer 8.2, from the tract reference's own T1 | CC0 1.0 | Published default |
| `bert` | FreeSurfer's worked example | 1 mm T1, FreeSurfer 5.2.0 | FreeSurfer Software License | Published |
| `aomic` | AOMIC-PIOP1 `sub-0022` | 3T T1, FreeSurfer 6.0.1 | CC0 1.0 | Published |
| `fsaverage` | FreeSurfer group template | 40 subjects, FreeSurfer 6 | FreeSurfer Software License | Builds locally; not published |

The viewer lists what [`public/models/anatomies.json`](https://github.com/JoshuaDuq/neuroatlas/blob/main/public/models/anatomies.json) lists.

- **`snail`** shares its T1 with the bundled tractography, so cortex and tracts share a frame. Its scan ends at z = −75 mm inside the brainstem, so it has no spinal cord. Its 25 pinned source files (about 39 MB of a 414 MB `recon-all` tree) are committed.
- **`bert`** is the historical FreeSurfer reference.
- **`aomic`** adds a public-domain individual from [OpenNeuro ds002785](https://openneuro.org/datasets/ds002785). No best-in-cohort claim is made: MRIQC metrics describe the scan, not reconstruction accuracy.
- **`fsaverage`** is a template, not an individual. Its NextBrain volume has no licence, so it stays local.

## Selection rule

A candidate needed a complete published `recon-all` directory: pial, white, sulc and `sphere.reg` surfaces, Destrieux annotations, and conformed `orig`, `aseg`, `ribbon` and `aparc.a2009s+aseg` volumes.

| Candidate | Excluded because |
| :--- | :--- |
| FreeSurfer Maintenance Dataset (`ds004958`) | Raw BIDS only |
| Penn LEAD (`ds007089`) | fMRIPrep GIFTI, no `.annot` |
| Mindboggle-101 | VTK meshes with DKT labels only |
| FreeSurfer 2018 tutorial subjects | Incomplete; licence unstated |
| FreeSurfer 8.2 samples | Raw scans only |

Licences per layer are in [References and licensing](../reference/references.md).
