# Validation and limits

[`brain_model/validate.py`](https://github.com/JoshuaDuq/neuroatlas/blob/main/brain_model/validate.py) reads each built anatomy back and checks it against its sources. It establishes conversion fidelity, not clinical accuracy: every published `validation.json` has status `passed` and `clinical_accuracy_validated: false`.

```bash
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest
npm test
```

CI runs all three for `snail` and `cdmd` on every pull request and deployment. A validation takes about two and a half minutes and at most 4.7 GB.

## Geometry

| | `snail` | `cdmd` |
| :--- | ---: | ---: |
| Pial vertices, source = export | 253,577 | 216,726 |
| Pial triangles, source = export | 507,146 | 433,444 |
| Position error (mm), bound 2e-5 | 4.298e-6 | 5.038e-6 |
| Normal component, bound 1.54e-5 | 1.529e-5 | 1.529e-5 |
| Sulcal depth (source units) | 2.338e-4 | 2.399e-4 |
| Concavity | 9.831e-6 | 9.099e-6 |
| Ribbon T1 (intensity units) | 1.368e-3 | 1.259e-3 |

Counts are before barycentric partition; area is conserved across it to a relative $10^{-6}$. Scalar errors are within half a `uint16` step of each file's source range, $(\max - \min) / (2 \times 65535)$, in source units.

## What is checked

1. **Volumes round-trip.** Each `.volume` decodes, matches both checksums, and placed by its affine equals `orig.mgz`, `aseg.mgz` or `aparc.a2009s+aseg.mgz`.
2. **Grids register.** Native volumes share shape, scanner affine and the full tkregister transform before they are combined.
3. **Manifest.** Every region id matches its mesh name and lookup-table entry.
4. **HCP cut labels.** Equal to Destrieux outside cortex; inside, every ribbon voxel holds the HCP label of its nearest pial or white vertex.
5. **Solids.** No vertex beyond 0.6 mm, and re-voxelised by ray parity, `misclassified_voxel_centres` is 0 for every solid.
6. **NextBrain cut blocks.** Every 0.8 mm block recounted from source.
7. **Per-area layers.** `cab-np.json`, `functional-regions.json` and `neuropsych-domains.json` rebuilt from their sources must match exactly, with every area assigned and licences copied byte for byte.
8. **Colours.** Linear glTF colours decode back to the exact sRGB palette entries.
9. **Declared layers.** Nothing undeclared is published, nothing declared is missing, and no unnamed file sits in the directory.
10. **Segmentation agreement.** NextBrain against the subject's own aseg (below); a Dice under 0.8 fails.
11. **Transforms.** Projected annotations are re-derived byte for byte; SNAIL's scanner-to-surface transform is recomputed from `orig.mgz`.

Browser QA runs are recorded in [`deliverables/`](https://github.com/JoshuaDuq/neuroatlas/tree/main/deliverables); the docs build does not re-run them.

## Atlas comparison

[`tests/test_comparison.py`](https://github.com/JoshuaDuq/neuroatlas/blob/main/tests/test_comparison.py) checks the overlap calculation against explicit barycentric subdivision. SNAIL publishes 1,212 positive pairs. Pair areas conserve both hemispheres (about 112,194.431 mm² left, 116,062.985 mm² right); the largest discrepancy against the cortical meshes is $9.51 \times 10^{-5}$ mm², within the float32 bound. These are numerical checks, not proof that projected boundaries are biologically exact.

## Tracts

Tests in `viewer/diffusion/` verify byte-exact NIfTI, lossless TRK, all 27 bundle counts, sampled RAS+ coordinates against NiBabel, and float64 lengths. The scanner-to-surface transform is checked against independent voxel anchors and rejects scale and reflection.

## Limits

1. **One individual.** Folds, depths and asymmetries belong to that person and are not normative.
2. **1 mm scan.** The MRI and FreeSurfer labels are 1 mm. NextBrain's 0.4 mm grid is estimated from that same scan; where structures share T1 contrast, the atlas prior places the boundary. Cortical layers and fibres are not resolved.
3. **HCP-MMP is projected**, two registrations from HCP space.
4. **NextBrain is a model estimate.** Against each brain's own aseg, caudate, putamen, thalamus, hippocampus and amygdala score Dice 0.803–0.898 on `snail` and 0.772–0.892 on `cdmd`, whose left amygdala (0.772) is a documented exception to the 0.8 floor. Agreement bounds how far two segmentations differ, not how far either is from the anatomy. The claustrum is still fragmented.
5. **Cut faces are coarser** than NextBrain surfaces (0.8 mm blocks).
6. **Non-manifold contacts.** On `snail`, 134 of 338 solids touch themselves across voxel corners (116 of 324 on `cdmd`); enclosed volumes stay definite.
7. **FreeSurfer surface defects** before repair: 81 holes on `snail`, 8 on `cdmd`.
8. **Shading is illustrative.** T1 relief and tissue colours are not measured optical or histological properties.
