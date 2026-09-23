# Validation, Invariants & Scientific Limits

NeuroAtlas establishes software and numerical fidelity through rigorous automated validation suites ([`brain_model/validate.py`](../brain_model/validate.py)), regression tests, and transparent declarations of anatomical and numerical boundaries.

---

## 1. Geometric Invariants & Conservation

The cortical reconstruction enforces strict topological and geometric conservation between source FreeSurfer files and exported WebGL assets:

| Invariant | Native FreeSurfer | NeuroAtlas glTF Export | Verification Rule |
| :--- | :--- | :--- | :--- |
| **Total Pial Vertices (`bert`)** | 266,922 | 266,922 (pre-partition) | Bit-exact 1:1 vertex preservation |
| **Total Pial Triangles (`bert`)** | 533,836 | 533,836 (pre-partition) | Complete surface topology closure |
| **Total Pial Vertices (`fsaverage`)** | 327,684 | 327,684 (pre-partition) | Bit-exact 1:1 vertex preservation |
| **Total Pial Triangles (`fsaverage`)**| 655,360 | 655,360 (pre-partition) | Complete surface topology closure |
| **Surface Area Conservation** | Source area | Exported area ($\Sigma$ parcels)| Relative error $< 10^{-6}$ across partition |
| **Surface Normalization** | Unit vectors | Unit vectors ($\|\mathbf{n}\| = 1.0$) | $\|\mathbf{n}\| \in [0.9999, 1.0001]$ |

### Barycentric Regional Partitioning
Atlas label boundaries fall between vertices, not along triangle edges. Rather than re-meshing or smoothing:
- Mixed-label triangles are divided into deterministic barycentric sub-cells using edge midpoints and the face centroid.
- The resulting sub-triangles lie strictly within the original triangle's plane.
- Surface area is preserved to float64 machine precision, with zero displacement of the true anatomical cortical surface.

---

## 2. Numerical Quantization Bounds

Quantization errors are not assumed; they are recomputed from raw sources during build validation and logged in `public/models/{anatomy}/validation.json`:

```
Attribute               Encoding           Maximum Measured Error       Permitted Bound
--------------------------------------------------------------------------------------------------
Position (x, y, z)      float32            0.0000000000 (Bit-exact)     0.0 (Unquantized)
Normal Vector (nx, ny, nz) int16 normalized  0.0000153821                 <= 1.54e-05 per component
Sulcal Depth (_SULC)    uint16 normalized  0.0000076294                 <= 0.5 quantization step
Pial Concavity          uint16 normalized  0.0000076294                 <= 0.5 quantization step
T1 Intensity (_T1)      uint16 normalized  0.0010245120                 <= 0.5 quantization step
```

- `_T1` intensity's maximum error ($\approx 1 \times 10^{-3}$) sits four orders of magnitude below the 8-bit quantum ($1/256 \approx 3.9 \times 10^{-3}$) of the source MRI data.
- Quantized normals are enforced via `KHR_mesh_quantization`.

---

## 3. Automated Validation Suite

The test suite executes multi-tier verifications across Python and JavaScript:

```bash
# Execute Python numerical validation
uv run python -m brain_model.validate --anatomy bert

# Execute unit and regression test suite
uv run pytest

# Execute WebGL/Three.js frontend test suite
npm test
```

### What Validation Checks
1. **Source Round-Trips**: Decodes exported binary `.volume` grids back to original FreeSurfer `.mgz` arrays and asserts exact label matching.
2. **tkregister Affine Check**: Validates the full $4 \times 4$ voxel-to-surface-RAS transform against FreeSurfer header definitions.
3. **Region Manifest Integrity**: Ensures every parcel ID in `manifest.json` matches the binary glTF mesh name and LUT entry.
4. **HCP Non-Cortical Invariance**: Asserts that HCP cortical surface projection never relabels subcortical white matter or deep nuclei.
5. **Solid Voxel Fidelity**: Every aseg, NextBrain and learning solid keeps the triangles of its marching-cubes surface, moves no vertex beyond the $0.6\text{ mm}$ display bound, and, re-voxelized by ray parity, puts every source voxel centre on the same side as its label mask does (`misclassified_voxel_centres` is 0 in `validation.json`).
6. **NextBrain Cut Blocks**: Every published $0.8\text{ mm}$ NextBrain cut voxel is recounted from its $2 \times 2 \times 2$ source block: it must hold the block's most frequent label, a tie must have gone to the rarer label, and the labels too small to win any block are listed (`nextbrain_cut_labels` in `validation.json`).
7. **Published Colour Space**: glTF `baseColorFactor` is linear, so each published sRGB display colour is written converted, and validation decodes it back to the exact palette entry.
8. **Browser QA Transcripts**: [`deliverables/gpu-browser-qa.json`](../deliverables/gpu-browser-qa.json) and [`deliverables/gpu-cut-performance.json`](../deliverables/gpu-cut-performance.json) log automated browser tests across cut modes, atlas switches, and continuous drag frame rates.

---

## 4. Scientific Limitations & Boundaries

To preserve scientific rigor, the model explicitly defines its biological and numerical limits:

1. **Individual Anatomy, Not a Group Template**: The model depicts one individual human brain (`bert` or `aomic` `sub-0022`). Folds, sulcal depths, and asymmetries belong to that person alone and are **not clinically normative**.
2. **1 mm Scan, 0.4 mm NextBrain Grid**: The T1w MRI and FreeSurfer segmentations are sampled on a $1\text{ mm}$ isotropic grid. NextBrain labels sit on a $0.4\text{ mm}$ grid, but they are estimated from that same 1 mm scan: the grid is finer than the image, so where neighbouring structures share their T1 contrast the histological atlas prior, not the scan, places the boundary. Cortical layers and microscopic fibre tracts are not resolved at any level.
3. **HCP-MMP1.0 Projection Distance**: HCP-MMP1.0 boundaries are resampled from `fsaverage` onto the subject via registered spherical coordinates (`sphere.reg`). They sit **two registrations away** from original HCP space.
4. **NextBrain Is a Model Estimate**: Each brain's NextBrain labels are its own Bayesian segmentation (FreeSurfer 8.2, `mri_histo_atlas_segment_fireants` in `invivo` mode), not a histological delineation of that brain. Against each brain's own FreeSurfer aseg they score Dice 0.82–0.89 on bert and 0.80–0.89 on aomic for caudate, putamen, thalamus, hippocampus and amygdala, above the MNI warp they replaced on all ten comparisons in both brains. The claustrum, a thin sheet, is still fragmented at 0.4 mm.
5. **Coarser Cut Faces**: NextBrain cut faces sample $0.8\text{ mm}$ blocks of the $0.4\text{ mm}$ labels, each block holding its most frequent label (a tie goes to the label rarer in the whole volume). Thin structures are therefore coarser on a cut than on their surfaces; surfaces and every published volume measurement use the $0.4\text{ mm}$ grid.
6. **Non-Manifold Mesh Pinch Points**: On bert, 133 of the 363 aseg and NextBrain solids touch themselves diagonally across voxel corners, producing non-manifold edge contacts; most are NextBrain's, whose 0.4 mm voxels meet at corners far more often. While mathematically non-manifold, their enclosed volume remains strictly definite.
7. **Illustrative Shading**: T1-derived cut relief and tissue colors are illustrative visualization aids; they do not represent measured optical reflection properties or histological tissue density.
