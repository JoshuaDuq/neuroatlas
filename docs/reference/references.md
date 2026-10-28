# References and licensing

## Bibliography

Every DOI and PMID here, and in the clinical and circuit data, is checked against the PubMed, Bookshelf and Crossref records that `scripts/fetch_references.py` writes to `data/reference-records.json`. Years are PubMed's journal-issue year.

### Cortical and subcortical atlases

- **Destrieux cortical parcellation (`aparc.a2009s`).**
  Destrieux, C., Fischl, B., Dale, A., & Halgren, E. (2010). Automatic parcellation of human cortical gyri and sulci using standard anatomical nomenclature. *NeuroImage*, 53(1), 1–15. [doi:10.1016/j.neuroimage.2010.06.010](https://doi.org/10.1016/j.neuroimage.2010.06.010). PMID 20547229.
- **HCP-MMP1.0 multimodal cortical parcellation.**
  Glasser, M. F., Coalson, T. S., Robinson, E. C., Hacker, C. D., Harwell, J., Yacoub, E., Ugurbil, K., Andersson, J., Beckmann, C. F., Jenkinson, M., Smith, S. M., & Van Essen, D. C. (2016). A multi-modal parcellation of human cerebral cortex. *Nature*, 536(7615), 171–178. [doi:10.1038/nature18933](https://doi.org/10.1038/nature18933). PMID 27437579.
- **Yeo 7 resting-state functional networks.**
  Yeo, B. T. T., Krienen, F. M., Sepulcre, J., Sabuncu, M. R., Lashkari, D., Hollinshead, M., Roffman, J. L., Smoller, J. W., Zöllei, L., Polimeni, J. R., Fischl, B., Liu, H., & Buckner, R. L. (2011). The organization of the human cerebral cortex estimated by intrinsic functional connectivity. *Journal of Neurophysiology*, 106(3), 1125–1165. [doi:10.1152/jn.00338.2011](https://doi.org/10.1152/jn.00338.2011). PMID 21653723.
- **Cole-Anticevic Brain-wide Network Partition (CAB-NP).**
  Ji, J. L., Spronk, M., Kulkarni, K., Repovš, G., Anticevic, A., & Cole, M. W. (2019). Mapping the human brain's cortical-subcortical functional network organization. *NeuroImage*, 185, 35–57. [doi:10.1016/j.neuroimage.2018.10.006](https://doi.org/10.1016/j.neuroimage.2018.10.006). PMID 30291974. Label key v1.1.6 from [ColeLab/ColeAnticevicNetPartition](https://github.com/ColeLab/ColeAnticevicNetPartition) at commit `e4ea9fd`.
- **Orbitofrontal, ventromedial prefrontal and anterior cingulate groupings of HCP-MMP areas.**
  Rolls, E. T., Deco, G., Huang, C.-C., & Feng, J. (2022). The human orbitofrontal cortex, vmPFC, and anterior cingulate cortex effective connectome: emotion, memory, and action. *Cerebral Cortex*, 33(2), 330–356. [doi:10.1093/cercor/bhac070](https://doi.org/10.1093/cercor/bhac070). PMID 35233615.
- **Posterior and midcingulate groupings of HCP-MMP areas.**
  Rolls, E. T., Wirth, S., Deco, G., Huang, C.-C., & Feng, J. (2023). The human posterior cingulate, retrosplenial, and medial parietal cortex effective connectome, and implications for memory and navigation. *Human Brain Mapping*, 44(2), 629–655. [doi:10.1002/hbm.26089](https://doi.org/10.1002/hbm.26089). PMID 36178249.
- **Glass-brain display of functional divisions.**
  Carlén, M. (2017). What constitutes the prefrontal cortex? *Science*, 358(6362), 478–482. [doi:10.1126/science.aan8868](https://doi.org/10.1126/science.aan8868). PMID 29074767. The display follows its Fig. 1 in concept only; none of its borders are used.
- **Neurosynth meta-analytic database (neuropsychological domains).**
  Yarkoni, T., Poldrack, R. A., Nichols, T. E., Van Essen, D. C., & Wager, T. D. (2011). Large-scale automated synthesis of human functional neuroimaging data. *Nature Methods*, 8(8), 665–670. [doi:10.1038/nmeth.1635](https://doi.org/10.1038/nmeth.1635). PMID 21706013. Database version 7, with consistency maps computed by NiMARE 0.22.1.
- **Schaefer multi-scale parcellation.**
  Schaefer, A., Kong, R., Gordon, E. M., Laumann, T. O., Zuo, X. N., Holmes, A. J., Eickhoff, S. B., & Yeo, B. T. T. (2018). Local-global parcellation of the human cerebral cortex from intrinsic functional connectivity MRI. *Cerebral Cortex*, 28(9), 3095–3114. [doi:10.1093/cercor/bhx179](https://doi.org/10.1093/cercor/bhx179). PMID 28981612.
- **FreeSurfer automated segmentation (`aseg`, `wmparc`).**
  Fischl, B., Salat, D. H., Busa, E., Albert, M., Dieterich, M., Haselgrove, C., van der Kouwe, A., Killiany, R., Kennedy, D., Klaveness, S., Montillo, A., Makris, N., Rosen, B., & Dale, A. M. (2002). Whole brain segmentation: automated labeling of neuroanatomical structures in the human brain. *Neuron*, 33(3), 341–355. [doi:10.1016/S0896-6273(02)00569-X](https://doi.org/10.1016/S0896-6273(02)00569-X). PMID 11832223.

  Fischl, B., van der Kouwe, A., Destrieux, C., Halgren, E., Ségonne, F., Salat, D. H., Busa, E., Seidman, L. J., Goldstein, J., Kennedy, D., Caviness, V., Makris, N., Rosen, B., & Dale, A. M. (2004). Automatically parcellating the human cerebral cortex. *Cerebral Cortex*, 14(1), 11–22. [doi:10.1093/cercor/bhg087](https://doi.org/10.1093/cercor/bhg087). PMID 14654453.
- **NextBrain probabilistic histological atlas.**
  Casamitjana, A., Mancini, M., Robinson, E., Peter, L., Annunziata, R., Althonayan, J., … Jaunmuktane, Z., & Iglesias, J. E. (2025). A probabilistic histological atlas of the human brain for MRI segmentation. *Nature*, 648(8094), 678–685. [doi:10.1038/s41586-025-09708-2](https://doi.org/10.1038/s41586-025-09708-2). PMID 41193801. Each brain's labels are its own segmentation with the atlas, produced by `scripts/segment_nextbrain.py` through FreeSurfer 8.2's SuperSynth and `mri_histo_atlas_segment_fireants`.

### Reference datasets and tools

- **MGH Connectome Diffusion Microstructure Dataset (CDMD).**
  Tian, Q., Fan, Q., Witzel, T., Polackal, M. N., Ohringer, N. A., Ngamsombat, C., Russo, A. W., Machado, N., Brewer, K., Wang, F., Setsompop, K., Polimeni, J. R., Keil, B., Wald, L. L., Rosen, B. R., Klawiter, E. C., Nummenmaa, A., & Huang, S. Y. (2022). Comprehensive diffusion MRI dataset for in vivo human brain microstructure mapping using 300 mT/m gradients. *Scientific Data*, 9(1), 7. [doi:10.1038/s41597-021-01092-6](https://doi.org/10.1038/s41597-021-01092-6). PMID 35042861. Figshare collection [10.6084/m9.figshare.c.5315474.v1](https://doi.org/10.6084/m9.figshare.c.5315474.v1).
- **DIPY.**
  Garyfallidis, E., Brett, M., Amirbekian, B., Rokem, A., van der Walt, S., Descoteaux, M., Nimmo-Smith, I., & Dipy Contributors (2014). Dipy, a library for the analysis of diffusion MRI data. *Frontiers in Neuroinformatics*, 8, 8. [doi:10.3389/fninf.2014.00008](https://doi.org/10.3389/fninf.2014.00008). PMID 24600385. CDMD's tracts are fitted, tracked and recognised with DIPY 1.12.1.
- **RecoBundles.**
  Garyfallidis, E., Côté, M.-A., Rheault, F., Sidhu, J., Hau, J., Petit, L., Fortin, D., Cunanne, S., & Descoteaux, M. (2018). Recognition of white matter bundles using local and global streamline-based registration and clustering. *NeuroImage*, 170, 283–295. [doi:10.1016/j.neuroimage.2017.07.015](https://doi.org/10.1016/j.neuroimage.2017.07.015). PMID 28712994.
- **HCP842 bundle atlas.**
  Yeh, F.-C., Panesar, S., Fernandes, D., Meola, A., Yoshino, M., Fernandez-Miranda, J. C., Vettel, J. M., & Verstynen, T. (2018). Population-averaged atlas of the macroscale human structural connectome and its network topology. *NeuroImage*, 178, 57–68. [doi:10.1016/j.neuroimage.2018.05.027](https://doi.org/10.1016/j.neuroimage.2018.05.027). PMID 29758339. Its RecoBundles curation ([figshare 7375883](https://doi.org/10.6084/m9.figshare.7375883.v2), CC BY 4.0) serves only as the recognition model; none of its streamlines are published.
- **TractSeg.**
  Wasserthal, J., Neher, P., & Maier-Hein, K. H. (2018). TractSeg - Fast and accurate white matter tract segmentation. *NeuroImage*, 183, 239–253. [doi:10.1016/j.neuroimage.2018.07.070](https://doi.org/10.1016/j.neuroimage.2018.07.070). PMID 30086412. CDMD's SLF I–III and seven callosal segments are TractSeg 2.10's (Apache-2.0), with its pretrained weights (CC BY 4.0, Zenodo).
- **MRtrix3.**
  Tournier, J.-D., Smith, R., Raffelt, D., Tabbara, R., Dhollander, T., Pietsch, M., Christiaens, D., Jeurissen, B., Yeh, C.-H., & Connelly, A. (2019). MRtrix3: A fast, flexible and open software framework for medical image processing and visualisation. *NeuroImage*, 202, 116137. [doi:10.1016/j.neuroimage.2019.116137](https://doi.org/10.1016/j.neuroimage.2019.116137). PMID 31473352. Version 3.0.8 (MPL-2.0) fits the CSD peaks TractSeg reads, aligns them to its template and fits CDMD's tensor FA.
- **CerebNet.**
  Faber, J., Kügler, D., Bahrami, E., Heinz, L.-S., Timmann, D., Ernst, T. M., … Diedrichsen, J., & Reuter, M. (2022). CerebNet: A fast and reliable deep-learning pipeline for detailed cerebellum sub-segmentation. *NeuroImage*, 264, 119703. [doi:10.1016/j.neuroimage.2022.119703](https://doi.org/10.1016/j.neuroimage.2022.119703). PMID 36349595. CDMD's cerebellar lobules are FastSurfer v2.6.0's CerebNet segmentation (Apache-2.0) of its own T1.
- **Spinal Cord Toolbox.**
  De Leener, B., Lévy, S., Dupont, S. M., Fonov, V. S., Stikov, N., Collins, D. L., Callot, V., & Cohen-Adad, J. (2017). SCT: Spinal Cord Toolbox, an open-source software for processing spinal cord MRI data. *NeuroImage*, 145, 24–43. [doi:10.1016/j.neuroimage.2016.10.009](https://doi.org/10.1016/j.neuroimage.2016.10.009). PMID 27720818. Version 7.3 (LGPL-3.0) segments CDMD's cord, labels its vertebrae and registers PAM50 to it.
- **Contrast-agnostic cord segmentation.**
  Bédard, S., Karthik, E. N., Tsagkas, C., Pravatà, E., Granziera, C., Smith, A., Weber II, K. A., & Cohen-Adad, J. (2025). Towards contrast-agnostic soft segmentation of the spinal cord. *Medical Image Analysis*, 101, 103473. [doi:10.1016/j.media.2025.103473](https://doi.org/10.1016/j.media.2025.103473). PMID 39874684.
- **PAM50.**
  De Leener, B., Fonov, V. S., Collins, D. L., Callot, V., Stikov, N., & Cohen-Adad, J. (2018). PAM50: Unbiased multimodal template of the brainstem and spinal cord aligned with the ICBM152 space. *NeuroImage*, 165, 170–179. [doi:10.1016/j.neuroimage.2017.10.041](https://doi.org/10.1016/j.neuroimage.2017.10.041). PMID 29061527.
- **PAM50 white-matter atlas.**
  Lévy, S., Benhamou, M., Naaman, C., Rainville, P., Callot, V., & Cohen-Adad, J. (2015). White matter atlas of the human spinal cord with estimation of partial volume effect. *NeuroImage*, 119, 262–271. [doi:10.1016/j.neuroimage.2015.06.040](https://doi.org/10.1016/j.neuroimage.2015.06.040). PMID 26099457.

## Licences

| Files | Source | Licence |
| :--- | :--- | :--- |
| `fsaverage` assets (built locally, not published) | FreeSurfer distribution | FreeSurfer Software License |
| `cdmd` assets and tracts | MGH CDMD, figshare | CC0 1.0 |
| `cdmd` SLF I–III and callosal segments | TractSeg pretrained weights | CC BY 4.0 (attribution) |
| HCP-MMP-derived files | Human Connectome Project | WU-Minn HCP Open Access Data Use Terms |
| `cab-np.json` | CAB-NP (Rutgers, Yale) | Non-commercial |
| `neuropsych-domains.json`, area scores | Neurosynth | ODbL 1.0 |
| NextBrain-derived files | FreeSurfer 8.2 | None named beyond FreeSurfer's |
| `spinal-cord.glb` | PAM50 (Spinal Cord Toolbox) on CDMD's cord | MIT |
| Viewer and pipeline code | This repository | MIT ([`LICENSE`](https://github.com/JoshuaDuq/neuroatlas/blob/main/LICENSE)) |

The MIT licence covers code only, not data.

### FreeSurfer Software License (`fsaverage`)

These are modified versions of FreeSurfer data: converted, resampled and re-encoded, not the original files. They are distributed under Part B of the FreeSurfer Software License Agreement (Version 1.0, February 2011), reproduced as it requires:

> All or portions of this licensed product (such portions are the "Software") have been obtained under license from The General Hospital Corporation and are subject to the following terms and conditions:
>
> License from MGH with Right to Sublicense ("Software License")
>
> As used in this Software License, "you" means the individual downloading and/or using, reproducing, modifying, displaying and/or distributing the Software and the institution or entity which employs or is otherwise affiliated with such individual in connection therewith. The General Hospital Corporation, Boston MA, USA ("MGH") hereby grants you, with right to sublicense, with respect to MGH's rights in the software, and data, if any, which is the subject of this Software License (collectively, the "Software"), a royalty-free, non-exclusive license to use, reproduce, make derivative works of, display and distribute the Software, provided that: (a) you accept and adhere to all of the terms and conditions of this Software License; (b) in connection with any copy of or sublicense of all or any portion of the Software, all of the terms and conditions in this Software License shall appear in and shall apply to such copy and such sublicense, including without limitation all source and executable forms and on any user documentation, prefaced with the following words: "All or portions of this licensed product (such portions are the "Software") have been obtained under license from The General Hospital Corporation and are subject to the following terms and conditions:" (c) you preserve and maintain all applicable attributions, copyright notices and licenses included in or applicable to the Software; (d) modified versions of the Software must be clearly identified and marked as such, and must not be misrepresented as being the original Software; and (e) you consider making, but are under no obligation to make, the source code of any of your modifications to the Software freely available to others on an open source basis. The license granted in this Software License includes without limitation the right to (i) incorporate the Software into proprietary programs (subject to any restrictions applicable to such programs), (ii) add your own copyright statement to your modifications of the Software, and (iii) provide additional or different license terms and conditions in your sublicenses of modifications of the Software; provided that in each case your use, reproduction or distribution of such modifications otherwise complies with the conditions stated in this Software License. This Software License does not grant any rights with respect to third party software, except those rights that MGH has been authorized by a third party to grant to you, and accordingly you are solely responsible for (i) obtaining any permissions from third parties that you need to use, reproduce, make derivative works of, display and distribute the Software, and (ii) informing your sublicensees, including without limitation your end-users, of their obligations to secure any such required permissions. The Software has been designed for research purposes only and has not been reviewed or approved by the Food and Drug Administration or by any other agency. YOU ACKNOWLEDGE AND AGREE THAT CLINICAL APPLICATIONS ARE NEITHER RECOMMENDED NOR ADVISED. Any commercialization of the Software is at the sole risk of the party or parties engaged in such commercialization. You further agree to use, reproduce, make derivative works of, display and distribute the Software in compliance with all applicable governmental laws, regulations and orders, including without limitation those relating to export and import control. The Software is provided "AS IS" and neither MGH nor any contributor to the software (each a "Contributor") shall have any obligation to provide maintenance, support, updates, enhancements or modifications thereto. MGH AND ALL CONTRIBUTORS SPECIFICALLY DISCLAIM ALL EXPRESS AND IMPLIED WARRANTIES OF ANY KIND INCLUDING, BUT NOT LIMITED TO, ANY WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL MGH OR ANY CONTRIBUTOR BE LIABLE TO ANY PARTY FOR DIRECT, INDIRECT, SPECIAL, INCIDENTAL, EXEMPLARY OR CONSEQUENTIAL DAMAGES HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY ARISING IN ANY WAY RELATED TO THE SOFTWARE, EVEN IF MGH OR ANY CONTRIBUTOR HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. TO THE MAXIMUM EXTENT NOT PROHIBITED BY LAW OR REGULATION, YOU FURTHER ASSUME ALL LIABILITY FOR YOUR USE, REPRODUCTION, MAKING OF DERIVATIVE WORKS, DISPLAY, LICENSE OR DISTRIBUTION OF THE SOFTWARE AND AGREE TO INDEMNIFY AND HOLD HARMLESS MGH AND ALL CONTRIBUTORS FROM AND AGAINST ANY AND ALL CLAIMS, SUITS, ACTIONS, DEMANDS AND JUDGMENTS ARISING THEREFROM. None of the names, logos or trademarks of MGH or any of MGH's affiliates or any of the Contributors, or any funding agency, may be used to endorse or promote products produced in whole or in part by operation of the Software or derived from or based on the Software without specific prior written permission from the applicable party. Any use, reproduction or distribution of the Software which is not in accordance with this Software License shall automatically revoke all rights granted to you under this Software License and render Paragraphs 1 and 2 of this Software License null and void. This Software License does not grant any rights in or to any intellectual property owned by MGH or any Contributor except those rights expressly granted hereunder.

The complete agreement is in [`public/models/licenses/FreeSurfer.html`](https://github.com/JoshuaDuq/neuroatlas/blob/main/public/models/licenses/FreeSurfer.html).

### CC0 1.0 (CDMD)

CDMD is dedicated to the public domain. Its T1 in `public/diffusion/cdmd-sub-013/` is the file its reconstruction imported, byte for byte; its 30 TRK bundles were tracked here from its own diffusion data (17 by RecoBundles, 13 by TractSeg) and resampled to 0.5 mm steps, and its FA map is the tensor FA of that diffusion data resampled onto the T1, as `provenance.json` records.

### NextBrain

The atlas and SuperSynth model come from FreeSurfer's distribution server; the segmentation tool ships in FreeSurfer 8.2. The NextBrain paper names no separate licence, so Planum claims none beyond FreeSurfer's. The earlier MNI-warped NextBrain source published no licence; the unpublished `fsaverage` still uses it, so that volume is not redistributed.

### HCP Open Access Data Use Terms

`cortex-hcp-mmp.glb`, `ribbon-hcp-mmp.labels`, `tissues-hcp-mmp.volume`, `functional-regions.json` and `cab-np.json` derive from HCP-MMP1.0. The terms pass to every recipient, require attribution and forbid identifying or contacting participants. Full terms: [`HCP-Data-Use-Terms.txt`](https://github.com/JoshuaDuq/neuroatlas/blob/main/public/models/licenses/HCP-Data-Use-Terms.txt).

> Data were provided [in part] by the Human Connectome Project, WU-Minn Consortium (Principal Investigators: David Van Essen and Kamil Ugurbil; 1U54MH091657) funded by the 16 NIH Institutes and Centers that support the NIH Blueprint for Neuroscience Research; and by the McDonnell Center for Systems Neuroscience at Washington University.

### CAB-NP licence

Non-commercial only. Redistribution is allowed without permission when no financial return is made, the conditions pass on, and the original files are included. Each `cab-np.json` therefore holds only the assignments, apart from the meshes, beside the unmodified [licence](https://github.com/JoshuaDuq/neuroatlas/blob/main/public/models/licenses/CAB-NP.txt) and [label key](https://github.com/JoshuaDuq/neuroatlas/blob/main/public/models/licenses/CAB-NP-LabelKey.txt). Commercial use needs a licence from the universities.

### Open Database License (`neuropsych-domains.json`)

Derived from Neurosynth under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) and shared under it. Public use must attribute Neurosynth (Yarkoni et al. 2011); derived databases must stay ODbL.

### MIT (`spinal-cord.glb`)

PAM50 and its white-matter atlas are distributed through the Spinal Cord Toolbox's OSF project, which declares the MIT licence; the PAM50 repository itself names none. Keep the copyright notice with the cord. Full terms: [`PAM50.txt`](https://github.com/JoshuaDuq/neuroatlas/blob/main/public/models/licenses/PAM50.txt).

## Intended use

Research and education only. Planum is not a medical device, has not been reviewed by any regulator, and must not be used for diagnosis, treatment or any clinical decision.
