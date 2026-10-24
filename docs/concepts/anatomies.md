# Anatomies

Each anatomy is one real FreeSurfer reconstruction, declared in [`config/model.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/config/model.yaml). Nothing is synthesised.

| ID | Subject | Reconstruction | Licence | Status |
| :--- | :--- | :--- | :--- | :--- |
| `snail` | SNAIL `subj_1` | FreeSurfer 8.2, from the tract reference's own T1 | CC0 1.0 | Published |
| `cdmd` | MGH CDMD `sub_013` | FreeSurfer 8.2, from its own raw T1 | CC0 1.0 | Published default |
| `fsaverage` | FreeSurfer group template | 40 subjects, FreeSurfer 6 | FreeSurfer Software License | Builds locally; not published |

The viewer lists what [`public/models/anatomies.json`](https://github.com/JoshuaDuq/neuroatlas/blob/main/public/models/anatomies.json) lists.

- **`snail`** shares its T1 with the bundled tractography, so cortex and tracts share a frame. Its scan ends at z = −75 mm inside the brainstem, so it has no spinal cord. Its 25 pinned source files (about 39 MB of a 414 MB `recon-all` tree) are committed.
- **`cdmd`** is subject 13 of the [MGH Connectome Diffusion Microstructure Dataset](https://doi.org/10.6084/m9.figshare.c.5315474.v1), chosen from its 33 published FreeSurfer 6 reconstructions for the fewest surface defect holes. It is reconstructed here with FreeSurfer 8.2 from the T1 that run imported (8 holes), and its tracts are tracked from its own diffusion scan, so cortex and tracts share a frame. Its scan reaches below the brainstem, so it carries the spinal cord. NextBrain's left amygdala agrees with its aseg at Dice 0.772, under the 0.8 floor; the exception is recorded in `config/model.yaml` with its volumes and boundary.
- **`fsaverage`** is a template, not an individual. Its NextBrain volume has no licence, so it stays local.

## Selection rule

The first anatomies needed a complete published `recon-all` directory: pial, white, sulc and `sphere.reg` surfaces, Destrieux annotations, and conformed `orig`, `aseg`, `ribbon` and `aparc.a2009s+aseg` volumes. These were excluded under that rule:

| Candidate | Excluded because |
| :--- | :--- |
| FreeSurfer Maintenance Dataset (`ds004958`) | Raw BIDS only |
| Penn LEAD (`ds007089`) | fMRIPrep GIFTI, no `.annot` |
| Mindboggle-101 | VTK meshes with DKT labels only |
| FreeSurfer 2018 tutorial subjects | Incomplete; licence unstated |
| FreeSurfer 8.2 samples | Raw scans only |

A later survey looked for a CC0 individual with its own diffusion scan and a field of view below the brainstem, and allowed reconstructing the T1 here with FreeSurfer 8.2, as SNAIL had been. It chose CDMD `sub_013`. FreeSurfer's `bert` and AOMIC-PIOP1 `sub-0022`, published until then, were retired because CDMD surpasses both: fewer surface defects, an open licence, its own tracts and the spinal cord.

Licences per layer are in [References and licensing](../reference/references.md).
