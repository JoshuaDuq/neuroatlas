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
| Spinal cord | 36 regions | PAM50 (Spinal Cord Toolbox) | Registered to this brain's segmented cord |
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

- **Teaching set.** Eight systems (basal ganglia, diencephalon, limbic, brainstem, basal forebrain, cerebellum, ventricles, white-matter pathways), each unit an explicit union of source labels in [`config/learning-anatomy.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/config/learning-anatomy.yaml). Midline units stay whole. NextBrain labels no medulla below its lowest medullary voxels, though the scan does, so the caudal medulla is aseg's brainstem below the higher of the two sides' lowest voxel: it carries the medulla down to meet the cord. The cerebellar cortex is FastSurfer CerebNet's 25 SUIT lobules (vermis VI–X midline; vermis I–V lies in lobules I–IV and V) where an anatomy declares them, and one aseg unit per side otherwise.
- **FreeSurfer aseg.** Marching cubes at 0.5 on the 1 mm `aseg.mgz`.
- **NextBrain.** This brain's own NextBrain segmentation (FreeSurfer 8.2, `invivo` mode), each hemisphere joined onto one 0.4 mm grid in surface RAS, moving no label more than 0.25 mm. Midline voxels both sides claim follow SuperSynth's MNI $x$, as FreeSurfer splits hemispheres. The volume is placed through `orig.mgz`'s transform, never its own header. Structures of at least 10 mm³ are meshed; the rest are cut labels. Cut faces sample 0.8 mm blocks, so fragments of ≤ 4.5 mm³ that win no block are absent from cuts but still searchable.

Every display surface uses a Taubin filter bounded to 0.6 mm of the raw surface, pulled back wherever it would cross a voxel centre, so each source voxel stays on its side. Reported volumes come from voxels, not meshes.

### Boundary certainty

NextBrain computes each voxel's winning posterior but does not write it; `scripts/freesurfer/run_patched.py` writes it with the runner-up label and posterior, leaving the labels unchanged. A voxel is a **near tie** where the winner leads the runner-up by less than 0.2. For each pair of touching labels in one hemisphere, the interface is the voxels of either label with a face neighbour in the other on the 0.4 mm grid; the pair's rating is the share of them where the two most probable labels were this pair and nearly tied. Pairs with fewer than 50 interface voxels are not rated, nor are pairs across the midline, whose boundary is the hemisphere join's.

A boundary is **soft** when a third or more of it is a near tie. The selected region's outline on a NextBrain cut and its **Boundary certainty** section draw the same rating. Near ties sit in a band about one voxel wide along boundaries, so a per-voxel map would show only edges; rating the boundary keeps that measurement and names the pair.

It is the model's competition between its own labels, conditional on one registration. It is not agreement with another segmentation: CDMD's left amygdala, NextBrain's largest disagreement with aseg, is a confident label (median winning posterior 0.975). A firm boundary can still be misplaced.

## Gyral white matter

`wmparc` labels each white-matter voxel within 5 mm of cortex with its nearest Desikan gyrus. Cut faces name the gyrus under the pointer; deeper white matter belongs to no region.

## Spinal cord

This brain's own cervical cord, from the medulla to where the scan ends. `scripts/segment_spinal_cord.py` runs the Spinal Cord Toolbox 7.3 on the source T1: its contrast-agnostic model segments the cord, the vertebrae are labelled from the discs, and the PAM50 template is registered to the cord and its discs. PAM50's atlas of 30 white-matter tracts and 6 grey-matter regions, left and right, is warped onto a 0.5 mm grid around the cord, its own spacing; each voxel keeps its most probable region where the region probabilities sum to at least 0.5. Each region is meshed like the other solids, smoothed by at most 0.6 mm and never across a voxel centre.

The outline and the levels are this cord's. The tracts and grey matter inside it are the atlas's: a 1 mm scan of a cord about 12 mm across does not resolve them. There are no nerve roots, and nothing below the scan. Licensed MIT.

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
- **Teaching set.** Its caudate, putamen, both pallidal segments, accumbens, thalamus, hippocampus and amygdala are drawn with the score of the aseg structure that holds most of each on this brain (at least half; 0.57 for the accumbens, 0.84 or more for the rest, checked by the build). The geniculate bodies lie in aseg's ventral diencephalon, so no unit takes that structure's one score (reward).
- **Lesion check.** Each function names lesion associations from the Deficits evidence, and the build reports how much of each cited parcel its map covers. The check is reported, never tuned.
- **Limits.** Healthy-group activation literature, not this brain and not a prediction of what damage impairs. Signal-dropout regions (orbitofrontal, anterior temporal) reach few functions. Neurosynth's MNI152 maps are sampled on `fsaverage`'s MNI305, a few millimetres apart. Subcortical scores are weaker evidence than cortical ones. Licensed ODbL 1.0.
