# Validation and limits

NeuroAtlas checks its numerical fidelity with automated validation ([`brain_model/validate.py`](https://github.com/JoshuaDuq/neuroatlas/blob/main/brain_model/validate.py)), regression tests, and a written statement of the anatomical and numerical boundaries. Validation checks conversion fidelity: it shows that the published asset matches its source. It does not establish clinical accuracy for any brain.

The build writes its measurements to `public/models/<anatomy>/validation.json`. The status for each published anatomy is `passed`. Its `clinical_accuracy_validated` field is `false`.

## Geometric invariants

The cortical reconstruction conserves topology and geometry between the FreeSurfer source and the exported asset.

| Invariant | Native FreeSurfer | NeuroAtlas glTF export | Verification rule |
| :--- | :--- | :--- | :--- |
| Total pial vertices (`snail`) | 253,577 | 253,577 before partition | Bit-exact one-to-one vertex preservation |
| Total pial triangles (`snail`) | 507,146 | 507,146 before partition | Complete surface topology closure |
| Total pial vertices (`bert`) | 266,922 | 266,922 before partition | Bit-exact one-to-one vertex preservation |
| Total pial triangles (`bert`) | 533,836 | 533,836 before partition | Complete surface topology closure |
| Total pial vertices (`aomic`) | 271,009 | 271,009 before partition | Bit-exact one-to-one vertex preservation |
| Total pial triangles (`aomic`) | 542,010 | 542,010 before partition | Complete surface topology closure |
| Total pial vertices (`fsaverage`, not published) | 327,684 | 327,684 before partition | Bit-exact one-to-one vertex preservation |
| Total pial triangles (`fsaverage`, not published) | 655,360 | 655,360 before partition | Complete surface topology closure |
| Surface area conservation | Source area | Exported area, summed over parcels | Relative error below $10^{-6}$ across the partition |
| Surface normalisation | Unit vectors | Unit vectors, quantized to int16 | Each component within half an int16 step, $\approx 1.54 \times 10^{-5}$ |

### Barycentric regional partitioning

Atlas boundaries fall between vertices, not along triangle edges. The model does not re-mesh or smooth them:

- A triangle whose vertices carry more than one label is divided into deterministic barycentric sub-cells, using edge midpoints and the face centroid.
- The sub-triangles lie strictly within the original triangle's plane.
- Surface area is preserved to float64 precision, and the cortical surface is not displaced.

## Numerical quantization bounds

The build recomputes each round-trip error and records it in `validation.json`. The table gives the maximum across both cortical atlases for each published anatomy, to four significant figures.

| Quantity, and error units | `snail` | `bert` | `aomic` | Permitted bound |
| :--- | ---: | ---: | ---: | :--- |
| Position distance (mm), float32 | 4.298e-6 | 4.479e-6 | 4.441e-6 | 2e-5 mm |
| Normal component (dimensionless), int16 normalised | 1.529e-5 | 1.529e-5 | 1.529e-5 | 1.54e-5 per component |
| Sulcal depth (source field units), uint16 normalised | 2.338e-4 | 2.799e-5 | 2.380e-4 | Half a step in that atlas's source range |
| Concavity (dimensionless), uint16 normalised | 9.831e-6 | 1.164e-5 | 1.044e-5 | Half a step in that atlas's source range |
| Ribbon T1 intensity (native intensity units), uint16 normalised | 1.368e-3 | 1.070e-3 | 1.823e-3 | Half a step in that atlas's source range |

Coordinates are not quantized, but converting to float32 introduces rounding. Zero error is not guaranteed. Quantized normals require `KHR_mesh_quantization`.

For a scalar encoded across its recorded range $[\text{minimum}, \text{maximum}]$, half a uint16 step is $(\text{maximum} - \text{minimum}) / (2 \times 65535)$ in **source units**. Half a step in normalised $[0, 1]$ units is about $7.63 \times 10^{-6}$. The two must not be compared without conversion. The `_T1` errors above are in native intensity units, not normalised units.

`_CONCAVITY` uses the same scalar encoding. The cortical validator recomputes it from the source pial surface with the build's concavity function, holds the decoded field to the same half-step bound, and reports the error as `maximum_concavity_error`. Because that recomputation shares the build's function, it checks the encoding, not the concavity definition, which the encoder and shading tests cover.

## Automated validation suite

Run the three tiers from the repository root:

```bash
# Numerical validation of a built anatomy, against its raw sources
uv run python -m brain_model.validate --anatomy bert

# Python unit and regression tests
uv run pytest

# JavaScript tests for the viewer
npm test
```

Continuous integration runs all three on every pull request and before each deployment, validating `snail`, `bert` and `aomic` from their committed sources. On a development machine one build takes about two and a half minutes and 3.1 GB of memory, and one validation about two and a half minutes and at most 4.7 GB.

### What validation checks

1. **Source round-trips.** Each exported binary `.volume` grid is decoded back, after both its compressed and decoded checksums agree, and placed on its source grid by the affine it publishes. The MRI and aseg grids must equal `orig.mgz` and `aseg.mgz`. The Destrieux cut grid, read through its label table, must equal `aparc.a2009s+aseg.mgz`, and that table must be the one the source labels describe.
2. **Native grid registration.** Before native volumes are combined, their 3D shapes, scanner affines and full 4 × 4 tkregister voxel-to-surface-RAS transforms must all match. Matching dimensions and tkregister matrices alone do not prove scanner-space alignment.
3. **Region manifest integrity.** Every parcel identifier in `manifest.json` matches the glTF mesh name and the lookup-table entry.
4. **HCP cut labels.** The HCP-MMP cut grid must equal the Destrieux one everywhere outside the cortex, so it never relabels white matter or deep nuclei. Inside each hemisphere's cortex, every voxel of the native gray ribbon must hold the HCP label of its nearest pial or white vertex, recomputed for every voxel, and every other cortical voxel the hemisphere's unlabelled code. The counts are under `tissue_volumes` in `validation.json`.
5. **Solid voxel fidelity.** Every aseg, NextBrain and learning solid keeps the triangles of its marching-cubes surface, moves no vertex beyond the 0.6 mm display bound, and, when re-voxelised by ray parity, puts every source voxel centre on the same side as its label mask does. `misclassified_voxel_centres` is 0 for every solid in `validation.json`.
6. **NextBrain cut blocks.** Every published 0.8 mm NextBrain cut voxel is recounted from its $2 \times 2 \times 2$ source block. It must hold the block's most frequent label, and a tie must have gone to the rarer label. Labels too small to win any block are listed under `nextbrain_cut_labels`.
7. **CAB-NP assignments.** `cab-np.json` is rebuilt from the pinned label key and must match exactly. Every published HCP-MMP area has one network, every area the key assigns is published, and the licence and label key copied to `public/models/licenses/` are byte-identical to their sources.
8. **Functional divisions.** `functional-regions.json` is rebuilt from `config/functional-regions.yaml` and must match exactly. The 22 sections hold every HCP-MMP area once in each hemisphere, no area is in two named regions, every named area is in a section, and each contested area's recorded primary section is the one it is listed in.
9. **Neuropsychological domains.** `neuropsych-domains.json` is rebuilt from `config/neuropsych-domains.yaml` and the committed area scores and must match exactly. The scores must have been derived for the configured terms, name all 360 areas with finite values, and reach the threshold somewhere for every domain. Every lesion check must name an association in `data/neuropsychology.yaml`. The number of areas each domain reaches is under `neuropsych_domains`.
10. **Published colour space.** glTF `baseColorFactor` is linear. Each published sRGB display colour is written converted, and validation decodes it back to the exact palette entry.
11. **Declared layers.** Each anatomy lists its optional layers in `config/model.yaml`. Validation fails when a declared layer's source is missing, and when the manifest, the detail levels or the cut labels publish a layer that is not declared or leave out one that is. It also fails when the published directory holds a file that no manifest, volume or label record names, such as a dropped layer's mesh. The declared layers and the published files are under `layers` and `published_files`.
12. **Segmentation and reconstruction quality.** Each brain's NextBrain segmentation is compared with its own FreeSurfer aseg, as described under [the limitations](#scientific-limitations-and-boundaries). A Dice score below the floor in `config/model.yaml` fails validation. The scores are under `segmentation_agreement`. FreeSurfer's own count of topological defect holes before it repaired the surfaces is read from each brain's `stats/aseg.stats`, pinned in `data/sources.json`, and stored under `reconstruction_quality`: 81 for `snail` (38 left, 43 right), 59 for `bert` (26, 33) and 20 for `aomic` (11, 9).
13. **Derived transforms.** Each annotation projected from `fsaverage` is re-derived from the `fsaverage` annotation and both registered spheres, and must reproduce the committed file byte for byte. For SNAIL, the tract reference's scanner-to-surface transform is recomputed from `orig.mgz` and must also be the pure translation by $-c_{ras}$ that a conformed volume's header implies. Both are under `transforms`.
13. **Browser QA transcripts.** [`deliverables/gpu-browser-qa.json`](https://github.com/JoshuaDuq/neuroatlas/blob/main/deliverables/gpu-browser-qa.json), [`deliverables/gpu-cut-performance.json`](https://github.com/JoshuaDuq/neuroatlas/blob/main/deliverables/gpu-cut-performance.json) and [`deliverables/sections-browser-qa.json`](https://github.com/JoshuaDuq/neuroatlas/blob/main/deliverables/sections-browser-qa.json) log automated browser tests across cut modes, atlas switches and continuous drag frame rates. They are records from a development run. The docs build does not re-run them.

The figures in the rest of this page are recorded results from the development runs that produced each published anatomy. Where a figure comes from a run and is not stored in a repository file, the page says so.

### Atlas correspondence

[`tests/test_comparison.py`](https://github.com/JoshuaDuq/neuroatlas/blob/main/tests/test_comparison.py) checks the weighted overlap calculation against an explicit barycentric cell subdivision. Each triangle's area comes from Heron's formula. The tests cover unequal triangle areas, asymmetric denominators, unassigned cells, invalid inputs and source-identity mismatches. On real SNAIL data, each marginal is checked against the original published cortical region. Every joint GLB mesh is decoded to confirm its exact expected float32 coordinates and triangle indices.

The SNAIL publication contains 1,212 positive joint pairs and 512 cortical or non-region totals. Complete pair areas conserve both hemisphere surfaces: about 112,194.431 mm² on the left and 116,062.985 mm² on the right. The largest difference between source area and original cortical GLB area is about $9.51 \times 10^{-5}$ mm². The largest difference between joint area and the stored overlap-mesh area is about $6.52 \times 10^{-5}$ mm². Every case stays within a bound derived independently for float32 coordinate storage and summation rounding. These are numerical fidelity checks. They do not show that projected atlas boundaries are biologically exact.

The viewer tests check the complete directional marginal sums, the individual unassigned CSV rows, the tiny contributions, the original raw precision, the source and asset hashes, the citations, and the rejection of mismatched subjects or bytes. The overlay tests preserve positions and scientific material colours, cancel stale requests, and release geometry that arrives after disposal. The app regression test confirms that late geometry cannot restart a disposed renderer. Live downloads are checked against the exact sidecar denominator and the complete overlap totals.

### Diffusion geometry and performance

The bundled SNAIL tract reference is checked against its original archive and against NiBabel's RAS+ millimetre decoder. The tests in `viewer/diffusion/` verify byte-exact NIfTI files, lossless TRK compression, all 27 bundle counts, sampled RAS+ coordinates, and float64 polyline lengths at several thresholds.

The native-viewer tests keep every point and verify the same RAS+ samples after rotation and unit conversion. They prevent lines from joining across streamline boundaries, and they keep position and colour buffers intact while the line indices are filtered. The TRK decoder is checked against both the original gzip bytes and HTTP-decompressed response bodies. The outline's source and output hashes, affine, GLB counts and transformed bounds are checked independently.

`node scripts/benchmark-diffusion.mjs` compares CPU geometry generation and graphics buffer sizes, using identical original streamlines. Its output covers the former NiiVue tube renderer, NiiVue lines and the current native indexed lines. One development-machine run on the largest bundle (15,244 streamlines, 3,157,802 points) measured 2,037 ms and 692.9 MB for 0.3 mm tubes. Native lines measured 178 ms and 82.0 MB. That measures preparation and buffer size, not end-to-end latency or GPU frame rate. The browser defaults to lines, keeps every source point, and commits the minimum-length slider on release. The MRI navigator loads NiiVue only when it is opened and frees its engine and maps when it is closed, so reopening fetches the maps again and resumes at the same voxel, contrast and FA opacity. Each tract file is downloaded and decoded once and shared by the 3D view and the navigator. Contrast and FA changes are committed on release. It uses source Float64 arc lengths rather than NiiVue's integer-rounded defaults. No tube control is exposed.

The original scanner-RAS coordinates are kept in the tract buffers. A rigid group transform maps them into the matching SNAIL FreeSurfer surface RAS. The tests check that transform against independent NiBabel voxel anchors, reject scale and reflection, and confirm that rotation and unit conversion leave arc lengths unchanged. Matching anatomy keeps regions, cuts and MRI available while tracts load. Other specimens use the independent reference. Missing source identity fails rather than being treated as a match. The shared world-space clipping plane affects the line material without changing the source buffers or the length measurements.

SNAIL is the validated default anatomy. The viewer composes its cortical reconstruction, atlas regions and original streamlines. On other specimens the tract reference uses the T1-derived outline instead, and tracts are never placed on unrelated anatomy. That outline is a display isosurface at a documented threshold and a 2-voxel sampling step.

### SNAIL source-to-asset checks

The full SNAIL source-to-asset validation passed. The maximum cortical GLB coordinate error is 0.00000430 mm, for both Destrieux and HCP-MMP. The raw T1 import preserves voxel values exactly, and its affine agrees within 0.00001 mm. The reconstruction's completion, runtime and source and output hashes are recorded in `data/snail/reconstruction.json`, and `scripts/prepare_subject.py` refuses to record outputs that no longer match them. The explicit coarse structure set excludes the absent aseg labels 31, 63 and 85. No region is fabricated. SNAIL publishes no spinal cord: the scan ends at z = −75 mm with 183 brainstem voxels labelled on its last slice, so the lower end the cord is seated against was not imaged.

The learning overview also omits SNAIL's coarse callosal surface. Before that display exclusion, 59.1% of the finer septal estimate and 61.9% of the fornix estimate lay inside the displayed coarse units, mainly the callosal estimate. Without that conflicting surface, the overlaps are 10.6% and 2.47%. The native callosal subsegments remain in the aseg detail level. The learning validator now rejects any unit with at least half of its voxels covered by another displayed source. Source masks and measurements are unchanged.

The following manual checks were recorded for the SNAIL viewer. A fresh route selects SNAIL. Returning from Tracts to Anatomy keeps the streamlines, and a cortical region stays selectable. MRI source voxel `[128, 104, 75]` matched the independent NiBabel scanner coordinate and moved the normal coronal cut to surface A = −24 mm. Closing the navigator preserved that cut and restored focus. These checks concern conversion and viewer behaviour. The validation report does not claim clinical accuracy.

## Scientific limitations and boundaries

The model states its biological and numerical limits explicitly.

1. **Individual anatomy, not a group template.** The default depicts SNAIL `subj_1`. `bert` and `aomic` `sub-0022` are alternative specimens. Folds, sulcal depths and asymmetries belong to that individual alone and are **not clinically normative**.
2. **1 mm scan, 0.4 mm NextBrain grid.** The T1w MRI and the FreeSurfer segmentations are sampled on a 1 mm isotropic grid. NextBrain labels sit on a 0.4 mm grid, but they are estimated from that same 1 mm scan. The grid is finer than the image. Where neighbouring structures share their T1 contrast, the histological atlas prior, not the scan, places the boundary. Cortical layers and microscopic fibre tracts are not resolved at any level.
3. **HCP-MMP1.0 projection distance.** The HCP-MMP1.0 boundaries are resampled from `fsaverage` onto the subject through the registered spherical coordinates (`sphere.reg`). They sit **two registrations away** from the original HCP space.
4. **NextBrain is a model estimate.** Each brain's NextBrain labels are its own Bayesian segmentation (FreeSurfer 8.2, `mri_histo_atlas_segment_fireants` in `invivo` mode). They are not a histological delineation of that brain. Against each brain's own FreeSurfer aseg, the caudate, putamen, thalamus, hippocampus and amygdala score Dice 0.803–0.898 on `snail`, 0.817–0.886 on `bert` and 0.803–0.886 on `aomic`, over both sides. Each NextBrain structure is the union of labels its learning unit declares, compared with the aseg label of the same structure after aseg is resampled onto the 0.4 mm grid by nearest neighbour. Validation computes the ten scores per brain, stores them under `segmentation_agreement` in `validation.json`, and fails below the floor of 0.8 set in `config/model.yaml`. Two segmentations of the same scan agreeing bounds how far they differ, not how far either is from the anatomy. A development run found the `bert` and `aomic` scores above those of the MNI152 warps they replaced on all ten comparisons; the warps are not kept, so that comparison is not reproduced. The claustrum, a thin sheet, is still fragmented at 0.4 mm.
5. **Coarser cut faces.** NextBrain cut faces sample 0.8 mm blocks of the 0.4 mm labels, each block holding its most frequent label. A tie goes to the label that is rarer in the whole volume. Thin structures are therefore coarser on a cut than on their surfaces. Surfaces and every published volume measurement use the 0.4 mm grid.
6. **Non-manifold pinch points.** On `bert`, 133 of the 363 aseg and NextBrain solids touch themselves diagonally across voxel corners, which produces non-manifold edge contacts. Most of them are NextBrain's, whose 0.4 mm voxels meet at corners far more often. The contacts are not two-manifold, but the volume each surface encloses stays definite.
7. **Spinal cord coverage.** The reference cord is placed only where the scan images the lower end of the brainstem it is seated against: on `bert` and `aomic`, not on `snail`, whose scan ends inside the brainstem. See [Atlases](concepts/atlases.md#spinal-cord-neuroaxis-reference).
8. **Illustrative shading.** The T1-derived cut relief and the tissue colours are illustrative visualisation aids. They do not represent measured optical reflection properties or histological tissue density.
