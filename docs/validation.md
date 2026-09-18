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
5. **Browser QA Transcripts**: [`deliverables/gpu-browser-qa.json`](../deliverables/gpu-browser-qa.json) and [`deliverables/gpu-cut-performance.json`](../deliverables/gpu-cut-performance.json) log automated browser tests across cut modes, atlas switches, and continuous drag frame rates.

---

## 4. Scientific Limitations & Boundaries

To preserve scientific rigor, the model explicitly defines its biological and numerical limits:

1. **Individual Anatomy, Not a Group Template**: The model depicts one individual human brain (`bert` or `aomic` `sub-0022`). Folds, sulcal depths, and asymmetries belong to that person alone and are **not clinically normative**.
2. **1 mm Voxel Grid Resolution**: The underlying T1w MRI and segmentation volumes are sampled on a $1\text{ mm}$ isotropic grid. Sub-millimeter structures (e.g., individual cortical layers, hippocampal subfields, microscopic fiber tracts) are not resolved.
3. **HCP-MMP1.0 Projection Distance**: HCP-MMP1.0 boundaries are resampled from `fsaverage` onto the subject via registered spherical coordinates (`sphere.reg`). They sit **two registrations away** from original HCP space.
4. **NextBrain Intersubject Warp**: NextBrain was delineated on an ex-vivo MNI152 template. ANTs non-linear SyN registration brings nuclei to the individual scan, but boundary precision is limited by intersubject morphological variation.
5. **Non-Manifold Mesh Pinch Points**: 34 of the 333 solid subcortical structures touch diagonally across voxel corners, producing non-manifold edge contacts. While mathematically non-manifold, their enclosed volume remains strictly definite.
6. **Illustrative Shading**: T1-derived cut relief and tissue colors are illustrative visualization aids; they do not represent measured optical reflection properties or histological tissue density.
