# Atlases and layers

Every layer shares one spatial frame. Counts are for CDMD. Each subject's `manifest.json` is authoritative.

| Layer | Granularity | Source | Route to the subject |
| :--- | :--- | :--- | :--- |
| Destrieux (`aparc.a2009s`) | 148 parcels | Subject `.annot` | Native; no projection |
| HCP-MMP1.0 | 360 areas | `fs_LR` → `fsaverage` | Nearest vertex on registered spheres |
| Teaching set | 105 solids | NextBrain, aseg and CerebNet unions | Bounded smoothing |
| FreeSurfer aseg | 32 structures | `aseg.mgz` | Marching cubes, bounded smoothing |
| NextBrain | 514 labels, 292 meshed | Subject segmentation at 0.4 mm | Native |
| Gyral white matter | 68 parcels | `wmparc.mgz` | Native; cut faces only |
| Spinal cord | 58 structures | Z-Anatomy | Rigid translation below the brainstem |
| Yeo 7 | 7 networks | Schaefer 2018 on `fsaverage` | Per vertex, registered spheres |
| CAB-NP | 12 networks | Ji et al. 2019 | One network per HCP-MMP area |
| Functional divisions | 22 sections, 21 named regions | Glasser 2016; Rolls 2022, 2023 | Per HCP-MMP area |
| Neuropsychological functions | 70 functions | Neurosynth 7 | Per HCP-MMP area and aseg structure |

## Destrieux

74 sulcal and gyral regions per hemisphere, from the subject's own annotation, plus two unlabelled medial walls. A triangle spanning several labels is split into barycentric cells by edge midpoints and the face centroid. The split keeps all of the pial area and none of the surface moves.

## HCP-MMP1.0

180 multimodal areas per hemisphere (Glasser et al. 2016), published on `fs_LR`, projected to `fsaverage` by the Mills projection, then to the subject: each vertex takes the label of the nearest `fsaverage` vertex on the registered spheres. Validation repeats the transfer and requires the committed annotation byte for byte. The mesh is native; the labels are a group-atlas estimate two registrations from HCP space.

## Comparing Destrieux and HCP-MMP

The region detail lists overlaps with the other atlas. Each triangle gives one third of its area to each corner's cell, the same convention as the boundaries above, and joint label pairs sum those cells in float64 mm². A share is the pair area over the selected region's **whole** pial area, unassigned cells included, so the two directions differ: CDMD's left precentral gyrus shares about 447.8 mm² with area 4, 20.6% of the gyrus and 31.6% of area 4. Nothing is dropped or renormalised. Overlap is spatial, not functional equivalence.

## Internal anatomy

Three exclusive levels.

- **Teaching set.** Eight systems (basal ganglia, diencephalon, limbic, brainstem, basal forebrain, cerebellum, ventricles, white-matter pathways), each unit an explicit union of source labels in [`config/learning-anatomy.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/config/learning-anatomy.yaml). Midline units stay whole. The cerebellar cortex is FastSurfer CerebNet's 25 SUIT lobules (vermis VI–X midline; vermis I–V lies in lobules I–IV and V) where an anatomy declares them, and one aseg unit per side otherwise.
- **FreeSurfer aseg.** Marching cubes at 0.5 on the 1 mm `aseg.mgz`.
- **NextBrain.** This brain's own NextBrain segmentation (FreeSurfer 8.2, `invivo` mode), each hemisphere joined onto one 0.4 mm grid in surface RAS, moving no label more than 0.25 mm. Midline voxels both sides claim follow SuperSynth's MNI $x$, as FreeSurfer splits hemispheres. The volume is placed through `orig.mgz`'s transform, never its own header. Structures of at least 10 mm³ are meshed; the rest are cut labels. Cut faces sample 0.8 mm blocks, so fragments of ≤ 4.5 mm³ that win no block are absent from cuts but still searchable.

Every display surface uses a Taubin filter bounded to 0.6 mm of the raw surface, pulled back wherever it would cross a voxel centre, so each source voxel stays on its side. Reported volumes come from voxels, not meshes.

## Gyral white matter

`wmparc` labels each white-matter voxel within 5 mm of cortex with its nearest Desikan gyrus. Cut faces name the gyrus under the pointer; deeper white matter belongs to no region.

## Spinal cord

58 Z-Anatomy structures (roots, ganglia, cauda equina, 19 tracts, horns with Rexed laminae), translated to sit below the brainstem without rotation or scaling. It is a schematic reference, not registered to the MRI. The build refuses it when the scan ends inside the brainstem. Licensed CC BY-SA 4.0.

## Functional networks

- **Yeo 7.** Visual, somatomotor, dorsal and ventral attention, limbic, frontoparietal, default. Schaefer 2018 on `fsaverage`, transferred per vertex. Region shares count assigned vertices (or, for NextBrain cortex, voxels); shares under 5% are hidden without rescaling.
- **CAB-NP** v1.1.6. Each HCP-MMP area takes one of 12 networks by its Glasser name, per hemisphere; the 13 areas assigned differently on each side keep that difference. Non-commercial licence.

Both are group resting-state networks reaching this brain through registration, not its measured function.

## Functional divisions

Two levels of published HCP-MMP groupings, kept apart because they cross. Glasser's 22 sections (2016, supplementary Table 1) partition the cortex. 21 named regions are those a source defines as area lists: eleven from Glasser (V1, MT, fusiform face complex, M1, S1, SII, SMA, FEF, PEF, Broca's area, A1), six from Rolls et al. 2022 (orbitofrontal, subgenual and anterior cingulate, area 10 and vmPFC) and four from Rolls et al. 2023 (midcingulate and posterior cingulate). Names no source defines as area lists, such as dmPFC or TPJ, are not drawn.

Six areas (23c, 52, PFcm, TF, a47r, pOFC) sit in one section in Table 1 and another in the section texts. Planum follows Table 1, as HCPex does, and shows the alternative in the region detail.

The colour mode draws the divisions solid inside a glass brain, after Carlén (2017). Neighbouring colours differ by OKLab ΔE ≥ 15 under normal and simulated red-green vision.

## Neuropsychological functions

Each of 70 functions is one Neurosynth abstract term, used by at least 100 studies or, for eleven clinically pertinent ones, by 74 to 97, which the profile states. Its map is Neurosynth's uniformity (consistency) test, computed with NiMARE: MKDA chi-square, 6 mm kernel, studies whose abstract uses the term at TF-IDF ≥ 0.001. `scripts/derive_domain_scores.py` averages it between `fsaverage`'s white and pial surfaces per HCP-MMP area, and per grey-matter aseg structure. An area or structure belongs to every function whose mean z reaches 3.

- **Why consistency.** It answers which regions studies of a function reliably activate. The association test answers how specific an activation is, and leaves executive function nearly empty. NeuroQuery was rejected: its social-cognition map centred on face perception.
- **Overview.** Eleven assessment functions are shown together, each area in the one whose z is the largest share of that function's own cortical maximum, so a large literature does not take every shared area.
- **Lesion check.** Each function names lesion associations from the Deficits evidence, and the build reports how much of each cited parcel its map covers. The check is reported, never tuned.
- **Limits.** Healthy-group activation literature, not this brain and not a prediction of what damage impairs. Signal-dropout regions (orbitofrontal, anterior temporal) reach few functions. Neurosynth's MNI152 maps are sampled on `fsaverage`'s MNI305, a few millimetres apart. Subcortical scores are weaker evidence than cortical ones. Licensed ODbL 1.0.
