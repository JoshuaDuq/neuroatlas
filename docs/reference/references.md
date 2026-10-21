# References and licensing

NeuroAtlas combines published neuroimaging datasets, peer-reviewed cortical atlases and open anatomical reference assets. This page records their citations, DOIs and licence terms.

## Bibliography

### Cortical and subcortical atlases

- **Destrieux cortical parcellation (`aparc.a2009s`).**
  Destrieux, C., Fischl, B., Dale, A., & Halgren, E. (2010). Automatic parcellation of human cortical gyri and sulci using standard anatomical nomenclature. *NeuroImage*, 53(1), 1–15. [doi:10.1016/j.neuroimage.2010.06.010](https://doi.org/10.1016/j.neuroimage.2010.06.010)
- **HCP-MMP1.0 multimodal cortical parcellation.**
  Glasser, M. F., Coalson, T. S., Robinson, E. C., Hacker, C. D., Harwell, J., Yacoub, E., Ugurbil, K., Andersson, J., Beckmann, C. F., Jenkinson, M., Smith, S. M., & Van Essen, D. C. (2016). A multi-modal parcellation of human cerebral cortex. *Nature*, 536(7615), 171–178. [doi:10.1038/nature18933](https://doi.org/10.1038/nature18933)
- **Yeo 7 resting-state functional networks.**
  Yeo, B. T. T., Krienen, F. M., Sepulcre, J., Sabuncu, M. R., Lashkari, D., Hollinshead, M., Roffman, J. L., Smoller, J. W., Zöllei, L., Polimeni, J. R., Fischl, B., Liu, H., & Buckner, R. L. (2011). The organization of the human cerebral cortex estimated by intrinsic functional connectivity. *Journal of Neurophysiology*, 106(3), 1125–1165. [doi:10.1152/jn.00338.2011](https://doi.org/10.1152/jn.00338.2011)
- **Cole-Anticevic Brain-wide Network Partition (CAB-NP).**
  Ji, J. L., Spronk, M., Kulkarni, K., Repovš, G., Anticevic, A., & Cole, M. W. (2019). Mapping the human brain's cortical-subcortical functional network organization. *NeuroImage*, 185, 35–57. [doi:10.1016/j.neuroimage.2018.10.006](https://doi.org/10.1016/j.neuroimage.2018.10.006). Label key v1.1.6 from [ColeLab/ColeAnticevicNetPartition](https://github.com/ColeLab/ColeAnticevicNetPartition) at commit `e4ea9fd`.
- **Schaefer multi-scale parcellation.**
  Schaefer, A., Kong, R., Gordon, E. M., Laumann, T. O., Zuo, X. N., Holmes, A. J., Eickhoff, S. B., & Yeo, B. T. T. (2018). Local-global parcellation of the human cerebral cortex from intrinsic functional connectivity MRI. *Cerebral Cortex*, 28(9), 3095–3114. [doi:10.1093/cercor/bhx179](https://doi.org/10.1093/cercor/bhx179)
- **FreeSurfer automated segmentation (`aseg`, `wmparc`).**
  Fischl, B., Salat, D. H., Busa, E., Albert, M., Dieterich, M., Haselgrove, C., van der Kouwe, A., Killiany, R., Kennedy, D., Klaveness, S., Montillo, A., Makris, N., Rosen, B., & Dale, A. M. (2002). Whole brain segmentation: automated labeling of neuroanatomical structures in the human brain. *Neuron*, 33(3), 341–355. [doi:10.1016/S0896-6273(02)00569-X](https://doi.org/10.1016/S0896-6273(02)00569-X)

  Fischl, B., van der Kouwe, A., Destrieux, C., Halgren, E., Ségonne, F., Salat, D. H., Busa, E., Seidman, L. J., Goldstein, J., Kennedy, D., Caviness, V., Makris, N., Rosen, B., & Dale, A. M. (2004). Automatically parcellating the human cerebral cortex. *Cerebral Cortex*, 14(1), 11–22. [doi:10.1093/cercor/bhg087](https://doi.org/10.1093/cercor/bhg087)
- **NextBrain probabilistic histological atlas.**
  Casamitjana, A., Mancini, M., Robinson, E., Peter, L., Annunziata, R., Althonayan, J., … Jaunmuktane, Z., & Iglesias, J. E. (2025). A probabilistic histological atlas of the human brain for MRI segmentation. *Nature*, 648(8094), 678–685. [doi:10.1038/s41586-025-09708-2](https://doi.org/10.1038/s41586-025-09708-2). Each brain's labels are its own segmentation with the atlas, produced by `scripts/segment_nextbrain.py` through FreeSurfer 8.2's SuperSynth and `mri_histo_atlas_segment_fireants`.

### Reference datasets and tools

- **Amsterdam Open MRI Collection (AOMIC-PIOP1).**
  Snoek, L., van der Miesen, M. M., Beemsterboer, T., van der Leij, A., Eigenhuis, A., & Scholte, H. S. (2021). The Amsterdam Open MRI Collection, a set of multimodal MRI datasets for individual difference research. *Scientific Data*, 8(1), 85. [doi:10.1038/s41597-021-00870-6](https://doi.org/10.1038/s41597-021-00870-6). OpenNeuro dataset [ds002785](https://openneuro.org/datasets/ds002785).
- **Z-Anatomy Open Anatomy Project.**
  The Z-Anatomy open anatomical scene, licensed under CC BY-SA 4.0, incorporating BodyParts3D (CC BY-SA 2.1 JP). [z-anatomy.com](https://www.z-anatomy.com/)

## Licensing and redistribution

Each asset layer carries the obligations of its data origin.

```
+-----------------------------------------------------------------------------------+
| NeuroAtlas deliverable       Source origin             Governing licence          |
+-----------------------------------------------------------------------------------+
| bert / fsaverage assets      FreeSurfer distribution   FreeSurfer Software License |
| aomic assets (sub-0022)      OpenNeuro ds002785        CC0 1.0 (public domain)    |
| SNAIL tract reference        SNAIL / DIPY bundles      CC0 1.0 (public domain)    |
| cortex-hcp-mmp.glb           Human Connectome Project  HCP Open Access Terms       |
| cab-np.json                  CAB-NP (Rutgers / Yale)   CAB-NP non-commercial       |
| nextbrain / learning units   FreeSurfer 8.2 NextBrain  No separate licence named  |
| spinal-cord.glb              Z-Anatomy / BodyParts3D   CC BY-SA 4.0 (copyleft)     |
| Viewer and build code        NeuroAtlas repository     MIT License (see note)      |
+-----------------------------------------------------------------------------------+
```

### FreeSurfer Software License (`bert` and `fsaverage`)

Reconstructions derived from FreeSurfer's `bert` and `fsaverage` distributions are subject to the terms of The General Hospital Corporation:

> *"All or portions of this licensed product (such portions are the 'Software') have been obtained under license from The General Hospital Corporation..."*

The complete licence text is in [`public/models/licenses/FreeSurfer.html`](https://github.com/JoshuaDuq/neuroatlas/blob/main/public/models/licenses/FreeSurfer.html).

### CC0 1.0 Universal (`aomic`)

The `aomic` anatomy (`sub-0022`) is published under Creative Commons Zero (CC0). It is dedicated to the public domain and imposes no redistribution restriction or proprietary licence covenant.

### CC0 1.0 Universal (SNAIL diffusion reference)

`public/diffusion/snail-subject-1/` contains subject 1 of the [SNAIL `bundles_2_subjects` dataset](https://hdl.handle.net/1773/38477), published under CC0 and distributed through [DIPY's bundle visualisation example](https://docs.dipy.org/1.10.0/examples_built/visualization/viz_bundles.html). The original T1 and FA NIfTI files are kept byte for byte. All 27 original TRK bundles are gzip-compressed without geometric processing or decimation.

`provenance.json` records the archive MD5, the original SHA-256 checksums, the reference transforms, the source counts and the NiBabel geometry checks. Bundle labels follow the source names. The seven corpus-callosum subdivisions keep their source segment numbers, with no anatomical assignment inferred.

The browser reads the tracts with [NiiVue's official TRK decoder](https://niivue.com/docs/loading/) and draws them as native Three.js indexed line segments with local RAS direction colours. The optional MRI navigator uses NiiVue's linked slices and location callbacks with the same original T1 and FA maps and the same line geometry. Spatial checks follow the reference-space conventions in [DIPY's streamline formats example](https://docs.dipy.org/stable/examples_built/file_formats/streamline_formats.html).

The main canvas uses Three.js indexed line segments and an MRI-derived outline from the same T1. The outline follows scikit-image's [Lewiner marching-cubes implementation](https://scikit-image.org/docs/stable/api/skimage.measure.html#skimage.measure.marching_cubes), with NiBabel's source affine and the viewer's RAS millimetre-to-metre transform. Its extraction settings and limitations are recorded in `t1-outline.json`. The display outline supplies no pial surface and no cortical atlas labels. When SNAIL's reconstruction is selected, its actual cortical surfaces replace the outline, and the tracts are transformed by the exact [FreeSurfer scanner-to-surface RAS convention](https://surfer.nmr.mgh.harvard.edu/fswiki/CoordinateSystems). Shared cuts follow the world-space clipping-plane implementation in the pinned [Three.js r186 `Material` source](https://github.com/mrdoob/three.js/blob/r186/src/materials/Material.js).

### NextBrain (`nextbrain.glb`, NextBrain-sourced `learning.glb` units, `tissues-nextbrain.volume`)

The NextBrain atlas (`atlas_simplified.zip`) and the SuperSynth model are downloaded from FreeSurfer's distribution server. The segmentation tool ships inside FreeSurfer 8.2. The NextBrain paper names no separate licence for the atlas. Its code-availability statement says the segmentation tool "is integrated in our neuroimaging toolkit 'FreeSurfer'". NeuroAtlas therefore claims no terms for these files beyond FreeSurfer's own. The exact files used, with their SHA-256 checksums, are recorded in [`data/sources.json`](https://github.com/JoshuaDuq/neuroatlas/blob/main/data/sources.json).

The earlier 1 mm NextBrain source, `compneurobilbao/nextbrain-mni-atlas`, published no licence. It is no longer used for `bert` or `aomic`. The unpublished `fsaverage` anatomy still carries a volume warped from it.

### HCP data-use terms (`cortex-hcp-mmp.glb`)

Redistributing HCP-MMP1.0 annotations requires compliance with the Human Connectome Project Data Use Terms. These require attribution and prohibit any attempt to re-identify participants. The full terms are in [`public/models/licenses/HCP-Data-Use-Terms.txt`](https://github.com/JoshuaDuq/neuroatlas/blob/main/public/models/licenses/HCP-Data-Use-Terms.txt).

### CAB-NP License (`cab-np.json`)

The CAB-NP network assignments are the property of Rutgers University and Yale University and are distributed for non-commercial use only. The licence allows them to be reproduced or transmitted without further permission only when:

- No financial return is made.
- The licence's conditions pass to whoever receives them.
- The original files are included.

To meet these terms, each anatomy's `cab-np.json` holds only the assignments and is kept separate from the manifest and the meshes. The licence and the original, unmodified label key are published beside it as [`public/models/licenses/CAB-NP.txt`](https://github.com/JoshuaDuq/neuroatlas/blob/main/public/models/licenses/CAB-NP.txt) and [`public/models/licenses/CAB-NP-LabelKey.txt`](https://github.com/JoshuaDuq/neuroatlas/blob/main/public/models/licenses/CAB-NP-LabelKey.txt). The licence also disclaims all warranty and asks licensees to indemnify the universities. Commercial use needs a separate licence from the universities.

### CC BY-SA 4.0 copyleft (`spinal-cord.glb`)

`spinal-cord.glb` is derived from Z-Anatomy. Creative Commons Attribution-ShareAlike 4.0 is a copyleft licence, so:

- Any adaptation or redistribution of `spinal-cord.glb` must give attribution to Z-Anatomy and BodyParts3D.
- Derived assets must be shared under the same or a compatible CC BY-SA licence.
- To keep copyleft from reaching the rest of the project, `spinal-cord.glb` is distributed as a strictly isolated standalone binary asset.

The full terms are in [`public/models/licenses/Z-Anatomy.txt`](https://github.com/JoshuaDuq/neuroatlas/blob/main/public/models/licenses/Z-Anatomy.txt).

### Software code

The build pipeline and the web viewer are described as released under the MIT licence. The repository does not yet contain a `LICENSE` file. Add one before relying on this statement for redistribution.
