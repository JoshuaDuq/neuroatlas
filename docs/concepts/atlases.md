# Atlases and layers

Every layer shares one spatial frame. Counts are for CDMD. Each subject's `manifest.json` is authoritative.

| Layer | Granularity | Source | Route to the subject |
| :--- | :--- | :--- | :--- |
| Destrieux (`aparc.a2009s`) | 148 parcels | Subject `.annot` | Native; no projection |
| HCP-MMP1.0 | 360 areas | `fs_LR` → `fsaverage` | Nearest vertex on registered spheres |
| Julich-Brain 3.1 | 278 areas | Colin27 → `fsaverage` | Nearest vertex on registered spheres |
| Schaefer 2018 | 400 parcels | `fsaverage` (1,489 participants) | Nearest vertex on registered spheres |
| Teaching set | 106 solids | NextBrain, aseg and CerebNet unions | Bounded smoothing |
| FreeSurfer aseg | 32 structures | `aseg.mgz` | Marching cubes, bounded smoothing |
| NextBrain | 514 labels, 292 meshed | Subject segmentation at 0.4 mm | Native |
| Gyral white matter | 68 parcels | `wmparc.mgz` | Native; cut faces only |
| Spinal cord | 34 regions | PAM50 (Spinal Cord Toolbox) | Registered to this brain's segmented cord |
| Yeo 7 | 7 networks | Schaefer 2018 on `fsaverage` | Per vertex, registered spheres |
| CAB-NP | 12 networks | Ji et al. 2019 | One network per HCP-MMP area |
| Functional divisions | 22 sections, 21 named regions | Glasser 2016; Rolls 2022, 2023 | Per HCP-MMP area |
| Neuropsychological functions | 70 functions | Neurosynth 7 | Per HCP-MMP area and aseg structure |
| Receptor fingerprints | 36 fingerprints, 94 regions | Zilles and Palomero-Gallagher, EBRAINS | By the name of the area or structure measured |
| Arterial territories | 15 branches per hemisphere | Liu et al. 2023 (1,298 stroke patients) | Template registered with SynthMorph; nearest neighbour |
| Functional cerebellar regions | 16 regions per hemisphere, 4 domains | Nettekoven et al. 2024 (seven task fMRI datasets) | SUIT template registered with SynthMorph; nearest neighbour, kept to the cerebellar cortex |

## Destrieux

74 sulcal and gyral regions per hemisphere, from the subject's own annotation, plus two unlabelled medial walls. A triangle spanning several labels is split into barycentric cells by edge midpoints and the face centroid. The split keeps all of the pial area and none of the surface moves.

## HCP-MMP1.0

180 multimodal areas per hemisphere (Glasser et al. 2016), published on `fs_LR`, projected to `fsaverage` by the Mills projection, then to the subject: each vertex takes the label of the nearest `fsaverage` vertex on the registered spheres. Validation repeats the transfer and requires the committed annotation byte for byte. The mesh is native; the labels are a group-atlas estimate two registrations from HCP space.

## Julich-Brain

139 cytoarchitectonic areas per hemisphere (Amunts et al. 2020), defined from the histology of postmortem brains: Brodmann-style areas such as 3a, 3b, 1 and 2, 44 and 45, and hOc1 (V1). EBRAINS publishes version 3.1's maximum-probability map on `fsaverage`, resampled there from the Colin27 surface; `scripts/fetch_julich_brain.py` writes it unchanged as an annotation, and it reaches the subject like HCP-MMP1.0, by the nearest `fsaverage` vertex on the registered spheres. Each area joins the lobe its published location names, for example postcentral gyrus to Central, so its groups match Destrieux's.

About a quarter of each hemisphere (24% on CDMD) is in seven gap maps, cortex the atlas has not yet mapped, mostly prefrontal and temporo-parietal. They and the two medial masks are unassigned, like the medial wall. Cut faces take the label of the nearest pial or white vertex inside the ribbon, as for HCP-MMP. The atlas is CC BY-NC-SA 4.0: non-commercial, shared alike.

## Schaefer 2018

200 parcels per hemisphere from resting-state functional connectivity (Schaefer et al. 2018), estimated from 1,489 participants and published on `fsaverage`. They reach the subject like HCP-MMP1.0, by the nearest `fsaverage` vertex on the registered spheres; on CDMD every parcel survives the transfer, and no parcel leaves more than 1.6% of its area in a stray fragment.

Parcels keep their published 7-network colours and group by that Yeo network. The 17-network order divides the same 400 parcels, and its names say where 175 of each hemisphere's 200 lie, where the 7-network names locate no visual or somatomotor parcel; each parcel is named from it, with CBIG's abbreviation table spelled out, for example *Default mode A, dorsal prefrontal cortex 1*. The build pairs the two orders on `fsaverage` and fails unless every parcel pairs one to one. The parcels are a group estimate registered onto this brain, not its measured function. Licensed MIT.

## Comparing cortical atlases

The region detail lists overlaps with another cortical atlas: each pair of Destrieux, HCP-MMP, Julich-Brain and Schaefer is published as its own file and loaded when first chosen. Each triangle gives one third of its area to each corner's cell, the same convention as the boundaries above, and joint label pairs sum those cells in float64 mm². A share is the pair area over the selected region's **whole** pial area, unassigned cells included, so the two directions differ: CDMD's left precentral gyrus shares about 447.8 mm² with area 4, 20.6% of the gyrus and 31.6% of area 4. Nothing is dropped or renormalised. Julich-Brain's gap maps and medial masks, and Schaefer's medial wall, count as unassigned, so on CDMD 34 of the 148 Destrieux regions lie mostly in Julich-Brain's unassigned cortex. Overlap is spatial, not functional equivalence, and carries no measurement from one atlas's region to another's.

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

### Segmentation agreement

Validation scores NextBrain against aseg on NextBrain's 0.4 mm grid, where part of every disagreement is aseg's 1 mm staircase: on CDMD, NextBrain's own 1 mm copy scores only 0.93–0.96 against NextBrain, and 18–33% of the voxels where the two disagree are ones where aseg matches that copy. To show the disagreement rather than the grid, the build voxelises each compared NextBrain union (caudate, putamen, thalamus, hippocampal formation, and amygdala with its transition areas, on each side) onto aseg's grid: a 1 mm voxel belongs to a union when over half of the 0.4 mm voxels that fall in it do. Each voxel of a structure is then labelled by both segmentations, by aseg only or by NextBrain only.

On CDMD the 1 mm Dice is 0.79–0.91, only 0.01–0.02 above the 0.4 mm scores, so the disagreement is mostly the methods'. aseg labels more than NextBrain for every compared structure except the thalamus; the left amygdala has 461 mm³ that only aseg labels against 125 mm³ that only NextBrain does.

The **Segmentation agreement** section, on the aseg structure, NextBrain's union or any NextBrain label in it, gives the three volumes and their Dice, and **Show on linked MRI** inks them on the scan. Neither segmentation is the reference, and agreement is not accuracy. It is also separate from boundary certainty: the left amygdala is a confident NextBrain label (median winning posterior 0.975) and the structure the two agree on least.

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

They are not a surface colour: the region detail names an HCP-MMP area's section and named region, and the Functions tab names the division each area it lists belongs to.

## Receptor fingerprints

Densities of up to 17 neurotransmitter receptors, measured by quantitative in vitro autoradiography in two to six post-mortem brains (Zilles et al. 2015; Palomero-Gallagher and Zilles 2018) and published per area on EBRAINS. `scripts/fetch_receptor_fingerprints.py` reads each dataset's mean and SD, donors and sampled hemispheres, pinned by checksum, into `data/receptor-fingerprints.json`. A fingerprint reaches a region only through the name of what it was measured in: 30 Julich-Brain areas (Area 44 and hOc2 in a dorsal and a ventral part), and the putamen, globus pallidus, mediodorsal and anterior thalamic nuclei on their aseg, NextBrain and teaching-set structures. Both hemispheres show the same pooled values.

- **Bars.** Each bar is the share of that receptor's highest mean among the 36 published fingerprints, so a cortical D1 bar is short beside the putamen's.
- **Left out.** Areas 9, 46 and 47 are published but name no Julich-Brain area.
- **Withheld.** Area ifs1's D1 SD is published as 863 fmol/mg, the same file's A1 mean; neighbouring areas measured in the same brains give 27–44. It is withheld with that reason, and the fetch fails if the source changes. Five parietal areas publish no α2 SD, and none is shown.
- **Limits.** Two to six brains, aged 61–79, and not this brain. Licensed CC BY-NC-SA 4.0.

## Arterial territories

Typical territories of the cerebral arteries (Liu et al. 2023): where acute infarcts of each artery fell in 1,298 stroke patients, traced on diffusion MRI and drawn on the JHU single-subject template. The atlas and its template b0 come from the authors' repository, pinned by commit and checksum. `scripts/register_arterial_territories.py` registers the skull-stripped b0 to CDMD's skull-stripped T1 with SynthMorph (FreeSurfer 8.2, joint affine and deformable) and carries the atlas across by nearest neighbour. The result is accepted only if CDMD's own segmentation agrees with it:

| Check | Limit | CDMD |
| :--- | :--- | :--- |
| Lateral ventricle Dice, left / right | ≥ 0.6 | 0.68 / 0.74 |
| Cerebellar cortex in the cerebellar territories | ≥ 95% | 97.3% |
| Cerebral cortex and white matter in no territory | ≤ 2% | 1.2% |
| Lateralised tissue in a territory of its own side | ≥ 98% | 99.6% |

The atlas's ventricle label is a coarse mask that spills into periventricular white matter, so its Dice is a floor rather than a target. The repository's header does not place the template in MNI space, about 18 mm forward and 19 mm low, which is why the template is registered image to image rather than through CDMD's MNI field.

- **Colour.** The Blood supply colouring paints the cortex per vertex, each taking the territory at the midpoint of its pial and white positions. A cut with the arterial cut labels shows each voxel's territory and recolours nothing else; any other cut labels show a region in the territory holding a majority of it, and in tissue colour without one.
- **Supply.** Each region carries its territory shares and, counted separately, the share in no territory: of its pial vertices for a cortical area, of its voxels otherwise, and for a teaching-set unit of its source labels' voxels on the grid the teaching set builds from (clipped where a unit stops at a NextBrain floor). Shares under 1% are left out of the list but not counted as unassigned. Ventricles, CSF and choroid plexus take no shares. The inspector lists them; a lesion reports the share of its territory-labelled volume in each territory.
- **Two levels.** Fifteen branches per hemisphere, each under one of four major arteries: anterior, middle and posterior cerebral, and vertebro-basilar. The atlas places the anterior choroidal and thalamoperforating territory under the posterior circulation, and Planum keeps it there.
- **Label table.** The published table repeats three left codes for right branches and swaps the PCA sides at level two. The volume itself numbers each branch's left side odd and its right side even, which the script checks by position, so names and levels come from the label values, not the codes.
- **Limits.** Typical territories, not this brain's vessels: collateral flow and variants such as a fetal posterior communicating artery move real territories by centimetres. The ACA rests on 29 cases, and the medial lenticulostriate and anterior thalamoperforating territories on anatomical knowledge. Border-zone probabilities are not published here. Licensed CC BY-SA 4.0.

## Functional cerebellar regions

The symmetric 32-region map of Nettekoven et al. (2024): a group atlas fused from seven task-based fMRI datasets, with 16 regions per hemisphere in four domains, motor, action, multiple demand, and social, linguistic and spatial. The atlas, the SUIT template and SUIT's own lobules (Diedrichsen et al. 2009) come from the authors' atlas collection, pinned by commit and checksum. `scripts/register_cerebellar_functions.py` registers the SUIT template to CDMD's skull-stripped T1, kept to aseg's infratentorial compartment as SUIT normalisation does, with SynthMorph (joint affine and deformable). Both atlases are carried across by nearest neighbour; the functional atlas is kept to aseg's cerebellar cortex. SUIT's lobules, carried by the same warp, score the registration against CDMD's own CerebNet lobules:

| Check | Limit | CDMD |
| :--- | :--- | :--- |
| Lobule Dice with CerebNet, mean of 24 shared units | ≥ 0.6 | 0.65 (0.49 to 0.81) |
| Cerebellar cortex the atlas reaches | ≥ 95% | 98.5% |
| Labelled cortex on its own side | ≥ 97% | 99.5% |

- **Header trap.** SUIT stores its label images LAS beside its RAS template on the same box, and SynthMorph's `apply` reads an image on the template's voxel grid: read directly, the hemispheres swap (2.5% on their own side). The script resamples each label image onto the template's grid by world position first and checks that every label keeps its place.
- **Cut labels.** The Cerebellar functions cut labels give each cerebellar cortex voxel its region in the atlas's own colours, which group regions by functional similarity; other tissue keeps its FreeSurfer label. S3 and S4 are nearly as pale as FreeSurfer's cerebellar white matter.
- **Shares.** Each cerebellar lobule, and aseg's cerebellar cortex, carries its share in each region and, counted separately, the share in none, by its voxels. Shares under 1% are left out of the list but not counted as unassigned. Left lobule V is about half M3, the region for movements of the hand on its own side.
- **Names.** A region keeps its code with what holds on both sides of a symmetric atlas: M1 oculomotor, M2 tongue, M3 hand, M4 lower body, and the domain for the rest. What the paper found on one side only, such as right S1's language responses, stays in its description.
- **Limits.** A group map, not this brain's measured function; the authors show that an individual's own localizer data place functional borders better. Registration from a group template places lobule borders a few millimetres off. Licensed CC BY-NC 3.0.

## Neuropsychological functions

Each of 70 functions is one Neurosynth abstract term, used by at least 100 studies or, for eleven clinically pertinent ones, by 74 to 97, which the profile states. Its map is Neurosynth's uniformity (consistency) test, computed with NiMARE: MKDA chi-square, 6 mm kernel, studies whose abstract uses the term at TF-IDF ≥ 0.001. `scripts/derive_domain_scores.py` averages it between `fsaverage`'s white and pial surfaces per HCP-MMP area, and per grey-matter aseg structure. An area or structure belongs to every function whose mean z reaches 3.

- **Why consistency.** It answers which regions studies of a function reliably activate. The association test answers how specific an activation is, and leaves executive function nearly empty. NeuroQuery was rejected: its social-cognition map centred on face perception.
- **Overview.** Eleven assessment functions are shown together, each area in the one whose z is the largest share of that function's own cortical maximum, so a large literature does not take every shared area.
- **Teaching set.** Its caudate, putamen, both pallidal segments, accumbens, thalamus, hippocampus and amygdala are drawn with the score of the aseg structure that holds most of each on this brain (at least half; 0.57 for the accumbens, 0.84 or more for the rest, checked by the build). The geniculate bodies lie in aseg's ventral diencephalon, so no unit takes that structure's one score (reward).
- **Lesion check.** Each function names lesion associations from the Deficits evidence, and the build reports how much of each cited parcel its map covers. The check is reported, never tuned.
- **Limits.** Healthy-group activation literature, not this brain and not a prediction of what damage impairs. Signal-dropout regions (orbitofrontal, anterior temporal) reach few functions. Neurosynth's MNI152 maps are sampled on `fsaverage`'s MNI305, a few millimetres apart. Subcortical scores are weaker evidence than cortical ones. Licensed ODbL 1.0.
