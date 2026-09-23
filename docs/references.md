# References, Provenance & Licensing

NeuroAtlas combines published neuroimaging datasets, peer-reviewed cortical atlases, and open anatomical reference assets. This document records their academic citations, digital object identifiers (DOIs), and legal licensing terms.

---

## 1. Academic Bibliography

### Cortical & Subcortical Atlases
- **Destrieux Cortical Parcellation (`aparc.a2009s`)**:
  Destrieux, C., Fischl, B., Dale, A., & Halgren, E. (2010). Automatic parcellation of human cortical gyri and sulci using standard anatomical nomenclature. *NeuroImage*, 53(1), 1–15. [DOI: 10.1016/j.neuroimage.2010.06.010](https://doi.org/10.1016/j.neuroimage.2010.06.010)
- **HCP-MMP1.0 Multimodal Cortical Parcellation**:
  Glasser, M. F., Coalson, T. S., Robinson, E. C., Hacker, C. D., Harwell, J., Yacoub, E., Ugurbil, K., Andersson, J., Beckmann, C. F., Jenkinson, M., Smith, S. M., & Van Essen, D. C. (2016). A multi-modal parcellation of human cerebral cortex. *Nature*, 536(7615), 171–178. [DOI: 10.1038/nature18933](https://doi.org/10.1038/nature18933)
- **Yeo 7 Resting-State Functional Networks**:
  Yeo, B. T. T., Krienen, F. M., Sepulcre, J., Sabuncu, M. R., Lashkari, D., Hollinshead, M., Roffman, J. L., Smoller, J. W., Zöllei, L., Polimeni, J. R., Fischl, B., Liu, H., & Buckner, R. L. (2011). The organization of the human cerebral cortex estimated by intrinsic functional connectivity. *Journal of Neurophysiology*, 106(3), 1125–1165. [DOI: 10.1152/jn.00338.2011](https://doi.org/10.1152/jn.00338.2011)
- **Schaefer Multi-Scale Parcellation**:
  Schaefer, A., Kong, R., Gordon, E. M., Laumann, T. O., Zuo, X. N., Holmes, A. J., Eickhoff, S. B., & Yeo, B. T. T. (2018). Local-Global Parcellation of the Human Cerebral Cortex from Intrinsic Functional Connectivity MRI. *Cerebral Cortex*, 28(9), 3095–3114. [DOI: 10.1093/cercor/bhx179](https://doi.org/10.1093/cercor/bhx179)
- **FreeSurfer Automated Segmentation (`aseg`, `wmparc`)**:
  Fischl, B., Salat, D. H., Busa, E., Albert, M., Dieterich, M., Haselgrove, C., van der Kouwe, A., Killiany, R., Kennedy, D., Klaveness, S., Montillo, A., Makris, N., Rosen, B., & Dale, A. M. (2002). Whole brain segmentation: automated labeling of neuroanatomical structures in the human brain. *Neuron*, 33(3), 341–355. [DOI: 10.1016/S0896-6273(02)00569-X](https://doi.org/10.1016/S0896-6273(02)00569-X)
  Fischl, B., van der Kouwe, A., Destrieux, C., Halgren, E., Ségonne, F., Salat, D. H., Busa, E., Seidman, L. J., Goldstein, J., Kennedy, D., Caviness, V., Makris, N., Rosen, B., & Dale, A. M. (2004). Automatically parcellating the human cerebral cortex. *Cerebral Cortex*, 14(1), 11–22. [DOI: 10.1093/cercor/bhh079](https://doi.org/10.1093/cercor/bhh079)
- **NextBrain Probabilistic Histological Atlas**:
  Casamitjana, A., Mancini, M., Robinson, E., Peter, L., Annunziata, R., Althonayan, J., … Jaunmuktane, Z., & Iglesias, J. E. (2025). A probabilistic histological atlas of the human brain for MRI segmentation. *Nature*, 648(8094), 678–685. [DOI: 10.1038/s41586-025-09708-2](https://doi.org/10.1038/s41586-025-09708-2). Each brain's labels are its own segmentation with the atlas, run by `scripts/segment_nextbrain.py` through FreeSurfer 8.2's SuperSynth and `mri_histo_atlas_segment_fireants`.

### Reference Datasets & Tools
- **Amsterdam Open MRI Collection (AOMIC-PIOP1)**:
  Snoek, L., van der Miesen, M. M., Beemsterboer, T., van der Leij, A., Eigenhuis, A., & Scholte, H. S. (2021). The Amsterdam Open MRI Collection, a set of multimodal MRI datasets for individual difference research. *Scientific Data*, 8(1), 85. [DOI: 10.1038/s41597-021-00870-6](https://doi.org/10.1038/s41597-021-00870-6). OpenNeuro Dataset: [ds002785](https://openneuro.org/datasets/ds002785).
- **Z-Anatomy Open Anatomy Project**:
  Z-Anatomy open anatomical scene, licensed under CC BY-SA 4.0 (incorporating BodyParts3D, CC BY-SA 2.1 JP). [https://www.z-anatomy.com/](https://www.z-anatomy.com/)

---

## 2. Licensing & Redistribution Terms

Each asset layer carries specific legal obligations defined by its data origin:

```
+-----------------------------------------------------------------------------------+
| NeuroAtlas Deliverable       Source Origin             Governing License          |
+-----------------------------------------------------------------------------------+
| bert / fsaverage assets      FreeSurfer Distribution   FreeSurfer Software License|
| aomic assets (sub-0022)      OpenNeuro ds002785        CC0 1.0 (Public Domain)    |
| cortex-hcp-mmp.glb           Human Connectome Project  HCP Open Access Terms      |
| nextbrain / learning units   FreeSurfer 8.2 NextBrain  No separate licence named  |
| spinal-cord.glb              Z-Anatomy / BodyParts3D   CC BY-SA 4.0 (Copyleft)    |
| Viewer & Build Pipeline Code NeuroAtlas Repository     MIT License                |
+-----------------------------------------------------------------------------------+
```

### FreeSurfer Software License (`bert` & `fsaverage`)
Reconstructions derived from FreeSurfer's `bert` and `fsaverage` distributions are subject to the terms of The General Hospital Corporation:
> *"All or portions of this licensed product (such portions are the 'Software') have been obtained under license from The General Hospital Corporation..."*

The complete license text is preserved at [`public/models/licenses/FreeSurfer.html`](../public/models/licenses/FreeSurfer.html).

### CC0 1.0 Universal (`aomic`)
The `aomic` anatomy (`sub-0022`) is published under Creative Commons Zero (CC0). It is dedicated to the public domain and imposes no redistribution restrictions or proprietary license covenants.

### NextBrain (`nextbrain.glb`, NextBrain-sourced `learning.glb` units, `tissues-nextbrain.volume`)
The NextBrain atlas (`atlas_simplified.zip`) and the SuperSynth model are downloaded from FreeSurfer's distribution server, and the segmentation tool ships inside FreeSurfer 8.2. The NextBrain paper names no separate licence for the atlas: its code-availability statement says the segmentation tool "is integrated in our neuroimaging toolkit 'FreeSurfer'". NeuroAtlas therefore claims no terms for these files beyond FreeSurfer's own. The exact files used, with their SHA-256 checksums, are recorded in `data/sources.json`.

The earlier 1 mm NextBrain source, `compneurobilbao/nextbrain-mni-atlas`, published no licence and is no longer used for `bert` or `aomic`. The unpublished `fsaverage` anatomy still carries a volume warped from it.

### HCP Data-Use Terms (`cortex-hcp-mmp.glb`)
Redistribution of HCP-MMP1.0 annotations requires compliance with the Human Connectome Project Data Use Terms, requiring proper attribution and prohibiting any attempt to re-identify participants. Full terms are preserved at [`public/models/licenses/HCP-Data-Use-Terms.txt`](../public/models/licenses/HCP-Data-Use-Terms.txt).

### CC BY-SA 4.0 Copyleft (`spinal-cord.glb`)
`spinal-cord.glb` is derived from Z-Anatomy. Because Creative Commons Attribution-ShareAlike (CC BY-SA 4.0) is a copyleft license:
- Any adaptation or redistribution of `spinal-cord.glb` must provide attribution to Z-Anatomy and BodyParts3D.
- Derived assets must be shared under the same or compatible CC BY-SA license.
- To protect the rest of the project from copyleft contamination, `spinal-cord.glb` is distributed as a strictly isolated standalone binary asset. Full terms are preserved at [`public/models/licenses/Z-Anatomy.txt`](../public/models/licenses/Z-Anatomy.txt).
