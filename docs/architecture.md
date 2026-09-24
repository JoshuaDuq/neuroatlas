# System Architecture & Rendering Engine

NeuroAtlas is engineered as a decoupled pipeline: an offline Python processing compiler ([`brain_model`](../brain_model)) transforms raw FreeSurfer reconstructions into optimized, quantized binary deliverables, which are rendered interactively in real time by a client-side WebGL 2 Three.js engine ([`viewer`](../viewer)).

---

## 1. Coordinate Frames & Transformations

NeuroAtlas enforces strict coordinate provenance between FreeSurfer native neuroimaging spaces and real-time WebGL scenes.

### Coordinate Spaces

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

- **FreeSurfer Surface RAS**: Millimeter coordinates centered on the subject's 256³ conformed anatomical volume. $X$ is Right ($+R$), $Y$ is Anterior ($+A$), $Z$ is Superior ($+S$).
- **glTF 2.0 World Frame**: Standard right-handed Cartesian frame in **meters**:
  $$\begin{bmatrix} X_{\text{glTF}} \\ Y_{\text{glTF}} \\ Z_{\text{glTF}} \end{bmatrix} = \frac{1}{1000} \begin{bmatrix} R \\ S \\ -A \end{bmatrix}$$
- **Orientation**: This transformation is an exact rigid $90^\circ$ pitch rotation and uniform scaling. The anatomical origin is strictly preserved; model vertices are **never recentered** to an arbitrary bounding-box center.
- **Slice Positioning**: 2D/3D slice offsets and crosshair coordinates are always handled in **surface RAS millimeters**, ensuring direct numerical correspondence with clinical and neuroimaging tools.

---

## 2. Binary Asset Specifications

The compiled assets are stored in `public/models/{anatomy}/`:

| Asset | Format | Contents | Role |
| :--- | :--- | :--- | :--- |
| `cortex-destrieux.glb` | glTF 2.0 binary | 148 Destrieux parcels + medial walls | Native anatomical folding surface layer |
| `cortex-hcp-mmp.glb` | glTF 2.0 binary | 360 HCP-MMP1.0 cortical areas | Multimodal surface layer resampled from `fs_LR` |
| `learning.glb` | glTF 2.0 binary | 82 teaching overview structures (19 MB; NextBrain units at 0.4 mm) | Smoothed union solids grouped into 8 anatomical systems |
| `structures.glb` | glTF 2.0 binary | 35 FreeSurfer `aseg` subcortical structures | Smoothed marching-cubes deep anatomy reference level |
| `nextbrain.glb` | glTF 2.0 binary | 328 solid histological nuclei meshed at 0.4 mm (36 MB, loaded on demand) | Fine detail subcortical reference level |
| `tissue-envelopes.glb` | glTF 2.0 binary | Native pial and white surface boundaries | Closed envelopes driving stencil solid cuts |
| `spinal-cord.glb` | glTF 2.0 binary | 58 Z-Anatomy spinal structures | Reference anatomical assembly seated below brainstem |
| `tissues-*.volume` | Gzip R16 binary | Categorical 3D label grids (1 mm; NextBrain 0.8 mm blocks) | 3D label decoding on GPU cut planes |
| `mri.volume` / `aseg.volume`| Gzip R8/R16 | Native T1w intensities & segmentations | Volumetric reference and T1 cut relief |
| `manifest.json` | JSON | Regions, colors, networks, provenance | Master scene descriptor and metadata index |
| `volumes.json` | JSON | Dimensions, affines, affine matrices | Volumetric header and coordinate mapping sidecar |

> [!NOTE]
> The `.volume` extension is used intentionally instead of `.gz`. Web servers often interpret `.gz` extensions as HTTP content-encoding, causing unintended automatic browser decompression that breaks binary stream length assertions and WebGL byte alignments.

---

## 3. Quantization & Encoding Pipeline

Exported meshes undergo precision-bounded quantization implemented in [`brain_model/encode.py`](../brain_model/encode.py):

| Attribute | Storage Type | Maximum Error | Validation Constraint |
| :--- | :--- | :--- | :--- |
| `POSITION` | `float32` | **None** ($0.0$) | Untouched bit-exact float32 coordinates |
| Indices | `uint16` | **None** ($0.0$) | No single parcel exceeds 65,536 vertices |
| `_NETWORK` | `uint8` | **None** ($0.0$) | Yeo network index ($1-7$, $0$ unassigned) |
| `NORMAL` | `int16` normalized | $\le 1.54 \times 10^{-5}$ | Declared via `KHR_mesh_quantization` |
| `_SULC`, `_CONCAVITY`, `_T1` | `uint16` normalized | $\le \frac{1}{2} \text{ step}$ | Bounds verified in `validation.json` |

Quantized normals are declared under `extensionsRequired` rather than `extensionsUsed` in the glTF manifest. Any reader that does not support `KHR_mesh_quantization` fails fast instead of misinterpreting 16-bit integers as floats.

---

## 4. GPU Real-Time Rendering Engine

The client viewer is built on Three.js and WebGL 2. A cut keeps the published surfaces and label volumes as they are; only the cap, the flat face the plane opens, is rebuilt.

### Cut caps
A closed solid meets the plane in a polygon. That polygon is triangulated and drawn as the cap, so moving or turning the view does not rasterize every triangle of every parcel. The boundary is the mesh–plane intersection, holes included. A non-manifold intersection, which a pinch in the ribbon can produce, keeps the winding stencil cap: back faces increment, front faces decrement, and a quad fills where the stencil is non-zero.

### Hardware 3D Label Sampling (`Data3DTexture`)
- Cut planes sample categorical atlas labels directly from 3D textures on the GPU.
- WebGL 2 integer textures (`R16UI` or `R8UI`) preserve discrete anatomical identifiers without linear filtering artifacts.
- The label texture stays in VRAM. Moving the plane rebuilds the cap polygons and leaves the volume untouched.

#### Label grids are cropped to what they label

A conformed FreeSurfer grid is $256^3$, and a brain occupies about a fifth of
it. Each label volume is therefore published cropped to the bounding box of its
non-zero voxels, carrying that box's own `voxel_to_surface_ras_mm` — the source
grid translated to the crop corner.

| Volume | Full grid | Published | VRAM |
| :--- | :--- | :--- | ---: |
| `tissues-destrieux` | $256^3$ | $127 \times 138 \times 183$ | 6.12 MiB |
| `tissues-hcp-mmp` | $256^3$ | $127 \times 138 \times 183$ | 6.12 MiB |
| `tissues-nextbrain` | $323 \times 459 \times 323$ at 0.4 mm, cut in $0.8\text{ mm}$ blocks | $160 \times 228 \times 160$ | 11.13 MiB |
| `aseg` | $256^3$ | $127 \times 140 \times 183$ | 6.21 MiB |
| **Total** | | | **29.57 MiB** |

The saving is doubled in practice: each grid is also held on the CPU for
picking, so the four label volumes cost about 30 MiB of RAM, where the uncropped
grids at their source resolutions would take 187 MiB.

No label changes and no voxel moves. Both readers were already general over
shape and affine and already discarded out-of-range cells, so a voxel outside
the box answers 0 exactly as an unlabelled voxel inside the full grid did. The
`mri.volume` is **not** cropped: it is the whole head at 59% occupancy, and
trimming it would change what the MRI reference views show.

Validation reconstructs the full source grid from the crop and its published
affine and asserts equality, which proves in one comparison that every labelled
voxel was carried, that nothing outside the box was labelled, and that the
affine places the box exactly where it was cut from.

NextBrain is the exception to "no label changes". Its source grid is 0.4 mm,
and cropped it would still be $320 \times 456 \times 318$, or 88.5 MiB. The cut
therefore samples $2 \times 2 \times 2$ blocks, each holding its most frequent
label, while its surfaces and measurements keep the 0.4 mm grid. Validation
recounts every block from the source (`nextbrain_cut_labels`).

### T1 Material Relief Shading
- In **Tissue** mode, trilinearly interpolated T1w MRI intensity modulates the lighting normals of the cut face.
- Subtle anatomical contrast (distinguishing white matter tracts and subcortical boundaries) is conveyed through lighting relief rather than synthetic geometry displacement or hallucinated boundaries.
