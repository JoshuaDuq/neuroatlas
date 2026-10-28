# Anatomies

An anatomy is a set of assets declared in [`config/model.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/config/model.yaml). The viewer lists published anatomies in `public/models/anatomies.json`.

| ID | Source | Availability |
| :--- | :--- | :--- |
| `cdmd` | MGH CDMD `sub_013`, reconstructed from its T1 with FreeSurfer 8.2 | Published default |
| `fsaverage` | FreeSurfer group template | Local builds only |

CDMD's source T1 was defaced before release: facial features were obscured, while the brain was not altered. Its tracts come from the same subject's diffusion scan. Its teaching set includes CerebNet cerebellar lobules and its own cervical cord, with PAM50's tracts and grey matter registered to it; see [Atlases and layers](atlases.md#spinal-cord). The individual anatomy is not normative, and segmentations are estimates; see [Validation and limits](../validation.md).

`fsaverage` is a template, not an individual. Its NextBrain source has no stated licence and is not published. See [References and licensing](../reference/references.md) for data terms.
