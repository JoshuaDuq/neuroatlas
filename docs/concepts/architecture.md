# Architecture

NeuroAtlas is a decoupled pipeline. An offline Python compiler ([`brain_model`](https://github.com/JoshuaDuq/neuroatlas/tree/main/brain_model)) turns FreeSurfer reconstructions into quantized binary deliverables. A client-side WebGL 2 engine built on Three.js ([`viewer`](https://github.com/JoshuaDuq/neuroatlas/tree/main/viewer)) renders them in real time. The two meet only at the published files in `public/models/`.

## Coordinate frames

NeuroAtlas keeps the provenance of coordinates between FreeSurfer's native neuroimaging spaces and the real-time WebGL scene.

### Coordinate spaces

```
FreeSurfer Surface RAS (mm)                WebGL glTF Frame (meters)
       +S (Superior)                              +Y (Superior)
            ^                                          ^
            |   +A (Anterior)                          |   -Z (Anterior)
            |  /                                       |  /
            | /                                        | /
-R <--------+--------> +R (Right)          -X <--------+--------> +X (Right)
           /|                                         /|
          / |                                        / |
         v  v                                       v  v
      -A    -S                                    +Z    -Y
  (Posterior) (Inferior)                      (Posterior) (Inferior)
```

- **FreeSurfer surface RAS** is in millimetres, centred on the subject's 256³ conformed volume. $X$ is right ($+R$), $Y$ is anterior ($+A$), and $Z$ is superior ($+S$).
- **glTF 2.0 world frame** is a right-handed Cartesian frame in **metres**:

  $$\begin{bmatrix} X_{\text{glTF}} \\ Y_{\text{glTF}} \\ Z_{\text{glTF}} \end{bmatrix} = \frac{1}{1000} \begin{bmatrix} R \\ S \\ -A \end{bmatrix}$$

- **Orientation.** The transform is an exact rigid $90^\circ$ rotation about the x axis with uniform scaling. The anatomical origin is preserved, and vertices are **never recentred** on a bounding box.
- **Slice positions.** Slice offsets and crosshair coordinates are always in **surface RAS millimetres**. This matches the numbers that clinical and neuroimaging tools report.

## Binary assets

The compiled assets are stored in `public/models/{anatomy}/`.

| Asset | Format | Contents | Role |
| :--- | :--- | :--- | :--- |
| `cortex-destrieux.glb` | glTF 2.0 binary | 148 Destrieux parcels and medial walls | Native anatomical folding surface layer |
| `cortex-hcp-mmp.glb` | glTF 2.0 binary | 360 HCP-MMP1.0 cortical areas | Multimodal surface layer, projected from `fs_LR` |
| `learning.glb` | glTF 2.0 binary | 82 teaching overview structures for `bert` (19 MB; NextBrain units at 0.4 mm) | Smoothed union solids, grouped into 8 anatomical systems |
| `structures.glb` | glTF 2.0 binary | 35 FreeSurfer `aseg` subcortical structures for `bert` | Smoothed marching-cubes deep-anatomy reference level |
| `nextbrain.glb` | glTF 2.0 binary | 328 solid histological nuclei for `bert`, meshed at 0.4 mm (36 MB, loaded on demand) | Fine subcortical reference level |
| `tissue-envelopes.glb` | glTF 2.0 binary | Native pial and white surface boundaries | Closed envelopes that drive the stencil solid cuts |
| `spinal-cord.glb` | glTF 2.0 binary | 58 Z-Anatomy spinal structures | Reference assembly seated below the brainstem |
| `tissues-*.volume` | gzip R16 binary | Categorical label grids: 1 mm for Destrieux and HCP-MMP, 0.8 mm blocks for NextBrain | Label decoding on GPU cut planes |
| `white-matter.volume` | gzip R8 binary | Gyral white-matter parcels, cropped | Gyral names on white-matter cut faces |
| `mri.volume`, `aseg.volume` | gzip R8/R16 binary | Native T1w intensities and segmentation | Volumetric reference and T1 cut relief |
| `manifest.json` | JSON | Regions, colours, networks, provenance, limitations | Master scene descriptor and metadata index |
| `volumes.json` | JSON | Dimensions, affines, and voxel-to-RAS matrices | Volume header and coordinate mapping sidecar |
| `validation.json` | JSON | Measured errors and checks from `brain_model.validate` | Records how closely each asset matches its source |

```{note}
The `.volume` extension is deliberate, not `.gz`. Web servers often read a `.gz` file as HTTP content-encoding and decompress it in the browser. That breaks the binary stream lengths and the WebGL byte alignment.
```

## Quantization and encoding

The glTF encoder is in [`brain_model/gltf/encode.py`](https://github.com/JoshuaDuq/neuroatlas/blob/main/brain_model/gltf/encode.py). Each attribute has a stated storage type and error bound. The measured values are in [Validation](../validation.md#numerical-quantization-bounds).

| Attribute | Storage type | Maximum error | Constraint |
| :--- | :--- | :--- | :--- |
| `POSITION` | `float32` | Float32 rounding, below $2 \times 10^{-5}$ mm | No coordinate quantization. Partition points are checked against float64 construction. |
| Indices | `uint16` | None | No single parcel exceeds 65,536 vertices |
| `_NETWORK` | `uint8` | None | Yeo network index ($1$–$7$, $0$ unassigned) |
| `NORMAL` | `int16` normalised | $\le 1.54 \times 10^{-5}$ | Declared through `KHR_mesh_quantization` |
| `_SULC`, `_CONCAVITY`, `_T1` | `uint16` normalised | $\le \tfrac{1}{2}$ step | One range per file, recorded in the manifest |

The quantized normals need `KHR_mesh_quantization`. The encoder lists the extension in both `extensionsUsed` and `extensionsRequired`. A reader that lacks the extension is required to fail. It must not read the 16-bit integers as floats.

Scalars share one range per file, not one range per primitive, so the same sulcal depth decodes to the same value on either side of a region boundary. The decode ranges are written into the glTF beside the data that uses them.

## Rendering

The client is built on Three.js and WebGL 2. A cut keeps the published surfaces and label volumes as they are. Only the cap, the flat face the plane opens, is rebuilt.

### Cut caps

A closed solid meets the plane in a polygon. That polygon is triangulated and drawn as the cap, so moving or turning the view does not rasterise every triangle of every parcel. The boundary is the mesh–plane intersection, holes included.

A non-manifold intersection, which a pinch in the ribbon can produce, keeps the winding stencil cap. Back faces increment the stencil, front faces decrement it, and a quad fills wherever the stencil is non-zero.

Dragging the plane builds the next caps off the pointer thread. They appear together with the moved surface, so the gesture itself does not stall.

### Hardware label sampling

- Cut planes sample categorical atlas labels directly from 3D textures on the GPU.
- Integer textures keep the discrete identifiers: `R16UI` for the label volumes and `R8UI` for white matter. Linear filtering would blend them.
- The label texture stays in video memory. Moving the plane rebuilds the cap polygons and leaves the volume untouched.

#### Label grids are cropped to their labels

A conformed FreeSurfer grid is $256^3$, and a brain fills about a fifth of it. Each label volume is therefore published cropped to the bounding box of its non-zero voxels. The crop carries its own `voxel_to_surface_ras_mm`: the source grid translated to the crop corner.

| Volume | Full grid | Published | Video memory |
| :--- | :--- | :--- | ---: |
| `tissues-destrieux` | $256^3$ | $127 \times 138 \times 183$ | 6.12 MiB |
| `tissues-hcp-mmp` | $256^3$ | $127 \times 138 \times 183$ | 6.12 MiB |
| `tissues-nextbrain` | $323 \times 459 \times 323$ at 0.4 mm, cut in $0.8\text{ mm}$ blocks | $160 \times 228 \times 160$ | 11.13 MiB |
| `aseg` | $256^3$ | $127 \times 140 \times 183$ | 6.21 MiB |
| **Total** | | | **29.57 MiB** |

The saving is doubled in practice. Each grid is also held on the CPU for picking, so the four label volumes cost about 30 MiB of RAM. Uncropped grids at their source resolutions would take 187 MiB.

No label changes and no voxel moves. Both readers were already general over shape and affine, and already discarded out-of-range cells. A voxel outside the box therefore answers 0, exactly as an unlabelled voxel inside the full grid did. The `mri.volume` is **not** cropped. It is the whole head at 59% occupancy, and trimming it would change what the MRI reference views show.

Validation rebuilds the full source grid from the crop and its affine, then asserts equality. One comparison proves that every labelled voxel was carried, that nothing outside the box is labelled, and that the affine places the box where it was cut from.

NextBrain is the exception to "no label changes". Its source grid is 0.4 mm. Cropped, it would still be $320 \times 456 \times 318$, or 88.5 MiB. The cut therefore samples $2 \times 2 \times 2$ blocks, each holding its most frequent label. Its surfaces and measurements keep the 0.4 mm grid. Validation recounts every block from the source (`nextbrain_cut_labels`).

### T1 material relief

- In **Tissue** mode, trilinearly interpolated T1w intensity modulates the lighting normals of the cut face.
- Subtle contrast, such as white-matter tracts and subcortical boundaries, is conveyed through lighting relief. No synthetic geometry is displaced, and no boundary is invented.
