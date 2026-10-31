# Validation and limits

[`brain_model/validate.py`](https://github.com/JoshuaDuq/neuroatlas/blob/main/brain_model/validate.py) reads each built anatomy back and checks it against its sources. It establishes conversion fidelity, not clinical accuracy: every published `validation.json` has status `passed` and `clinical_accuracy_validated: false`.

The [circuit evidence audit](reference/circuit-evidence.md) records clinical-source provenance for all 29 tours, the material scientific qualifications, and the remaining clinical-use work. Deficit evidence and circuit background are labeled separately in the viewer, and published corrections are shown with their sources. The audit and software checks do not establish patient-level diagnostic or prognostic validity. The clinical catalogue still contains 88 abstract-based extraction records requiring full-text review before any patient-specific use is assessed.

```bash
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest
npm test --prefix web
```

CI runs all three for `cdmd` on every pull request and deployment. A validation takes about two and a half minutes and at most 4.7 GB.

## What is checked

1. **Volumes round-trip.** Each `.volume` decodes, matches both checksums, and placed by its affine equals `orig.mgz`, `aseg.mgz` or `aparc.a2009s+aseg.mgz`.
2. **Grids register.** Native volumes share shape, scanner affine and the full tkregister transform before they are combined.
3. **Manifest.** Every region id matches its mesh name and lookup-table entry.
4. **Projected cut labels.** For HCP-MMP, Julich-Brain and Schaefer: equal to Destrieux outside cortex; inside, every ribbon voxel holds the label of its nearest pial or white vertex.
5. **Solids.** No vertex beyond 0.6 mm, and re-voxelised by ray parity, `misclassified_voxel_centres` is 0 for every solid.
6. **NextBrain cut blocks.** Every 0.8 mm block recounted from source.
7. **Per-area layers.** `cab-np.json`, `functional-regions.json` and `neuropsych-domains.json` rebuilt from their sources must match exactly, with every area assigned and licences copied byte for byte.
8. **Colours.** Linear glTF colours decode back to the exact sRGB palette entries.
9. **Declared layers.** Nothing undeclared is published, nothing declared is missing, and no unnamed file sits in the directory.
10. **Segmentation agreement.** NextBrain against the subject's own aseg (below); a Dice under 0.8 fails unless a documented exception specifies a lower floor. CDMD’s left amygdala has a 0.77 floor (measured 0.772). Where lobules are declared, CerebNet's lobules together must reach Dice 0.85 against aseg's cerebellar cortex. The functional cerebellar atlas must keep its recorded registration checks (SUIT's lobules at a mean Dice of at least 0.6 with CerebNet's, 95% of the cerebellar cortex reached, 97% on its own side), and every lobule's published shares must recompute from the registered volume.
11. **Transforms.** Projected annotations are re-derived byte for byte; CDMD's tract scanner-to-surface transform is recomputed from `orig.mgz`.
12. **Spinal cord.** Every PAM50 region is re-voxelised from its mesh with no voxel centre crossed, and left regions lie left of their partners. The registered atlas's cord must meet SCT's own segmentation at Dice 0.95 or more on the slices it covers; `cdmd` measures 0.967 over 65 slices.
13. **Boundary certainty.** `boundary-certainty.json` recounted per voxel and the label it touches must equal the build's per-pair counts exactly. The near-tie volume must sit on the label grid, name a runner-up from its winner's own hemisphere and never the winner, and have been made with the configured margin.
14. **Segmentation agreement map.** The compared NextBrain volume, voxelised again point by point through the full affines rather than per axis, must equal the published one, and `segmentation-agreement.json`'s counts must equal a recount against aseg.

Browser QA runs are recorded in [`deliverables/`](https://github.com/JoshuaDuq/neuroatlas/tree/main/deliverables); the docs build does not re-run them.

## Geometry

| | `cdmd` |
| :--- | ---: |
| Pial vertices, source = export | 216,726 |
| Pial triangles, source = export | 433,444 |
| Position error (mm), bound 2e-5 | 5.038e-6 |
| Normal component, bound 1.54e-5 | 1.529e-5 |
| Sulcal depth (source units) | 2.399e-4 |
| Concavity | 9.099e-6 |
| Ribbon T1 (intensity units) | 1.259e-3 |

Counts are before barycentric partition; area is conserved across it to a relative $10^{-6}$. Scalar errors are within half a `uint16` step of each file's source range, $(\max - \min) / (2 \times 65535)$, in source units.

## Atlas comparison

[`tests/test_comparison.py`](https://github.com/JoshuaDuq/neuroatlas/blob/main/tests/test_comparison.py) checks the overlap calculation against explicit barycentric subdivision. CDMD publishes 1,202 positive Destrieux × HCP-MMP pairs, 1,056 Destrieux × Julich-Brain, 1,221 Destrieux × Schaefer, 1,537 HCP-MMP × Julich-Brain, 1,767 HCP-MMP × Schaefer and 1,556 Julich-Brain × Schaefer. Every pair file conserves both hemispheres to the same totals (about 85,619.412 mm² left, 85,458.887 mm² right); the largest discrepancy against the cortical meshes is $1.12 \times 10^{-4}$ mm², within the float32 bound. These are numerical checks, not proof that projected boundaries are biologically exact.

## Segmentation agreement map

On aseg's 1 mm grid, `cdmd`'s Dice is caudate 0.867 / 0.881 (left / right), putamen 0.902 / 0.908, thalamus 0.898 / 0.898, hippocampus 0.872 / 0.898 and amygdala 0.791 / 0.850, each 0.01–0.02 above its 0.4 mm score. NextBrain's own 1 mm copy scores 0.93–0.96 against NextBrain on the 0.4 mm grid, the most a perfect 1 mm segmentation of the same boundary could reach there.

## Boundary certainty

On `cdmd`, 1,061,305 voxels (7.5% of those labelled) are near ties, and 93.2% of them nearly went to a label that touches them across a face. 1,738 same-hemisphere pairs are rated, covering 99.1% of interface voxels; 2,387 smaller pairs are not. A rated boundary is nearly tied on a median 19% of its interface, 26% weighted by interface. The rerun that records the posteriors reproduces the published labels byte for byte.

## Tracts

Tests in `web/src/lib/engine/diffusion/` verify byte-exact NIfTI, lossless TRK, bundle counts, sampled RAS+ coordinates against NiBabel, and float64 lengths. The scanner-to-surface transform is checked against independent voxel anchors and rejects scale and reflection.

## Limits

1. **One individual.** Folds, depths and asymmetries belong to that person and are not normative.
2. **1 mm scan.** The MRI and FreeSurfer labels are 1 mm. NextBrain's 0.4 mm grid is estimated from that same scan; where structures share T1 contrast, the atlas prior places the boundary. Cortical layers and fibres are not resolved.
3. **HCP-MMP, Julich-Brain and Schaefer are projected**: HCP-MMP is two registrations from HCP space; Julich-Brain was resampled from Colin27 to `fsaverage`, then to this brain, and leaves about a quarter of the cortex unassigned. Schaefer's parcels are a group resting-state estimate on `fsaverage`, one registration from this brain.
4. **NextBrain is a model estimate.** Against each brain's own aseg, caudate, putamen, thalamus, hippocampus and amygdala score Dice 0.772–0.892 on `cdmd`, whose left amygdala (0.772) is a documented exception to the 0.8 floor. Agreement bounds how far two segmentations differ, not how far either is from the anatomy; on aseg's own grid the scores rise by only 0.01–0.02, so the disagreement is mostly the methods', not the grids'. The claustrum is still fragmented.
5. **Cerebellar lobules are a model estimate.** CerebNet's lobules together score Dice 0.918 against `cdmd`'s aseg cerebellar cortex.
6. **Functional cerebellar regions are a group map.** The Nettekoven et al. (2024) atlas is registered from the SUIT template; SUIT's own lobules, carried by the same warp, meet CerebNet's at a mean Dice of 0.65, so its borders lie a few millimetres off, and individual functional borders differ from the group's.
7. **Cut faces are coarser** than NextBrain surfaces (0.8 mm blocks).
8. **Non-manifold contacts.** On `cdmd`, 116 of 324 solids touch themselves across voxel corners; enclosed volumes stay definite.
9. **FreeSurfer surface defects** before repair: 8 holes on `cdmd`.
10. **Shading is illustrative.** T1 relief and tissue colours are not measured optical or histological properties.
11. **Boundary certainty is the model's own.** It rates how close NextBrain came to choosing the neighbouring label, given one registration. It is not agreement with aseg: CDMD's left amygdala, the Dice exception above, has a median winning posterior of 0.975. A firm boundary can be misplaced.
12. **The cord's tracts are an atlas.** The cord's outline and levels are this subject's, from the medulla to C5 where the scan ends; the tracts and grey matter inside it are PAM50's, registered to that outline, since a 1 mm scan does not resolve them. PAM50's lateral reticulospinal tract is never any voxel's most probable region and is not published.
