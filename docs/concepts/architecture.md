# Architecture

An offline Python compiler ([`brain_model`](https://github.com/JoshuaDuq/neuroatlas/tree/main/brain_model)) turns FreeSurfer reconstructions into binary files. A WebGL 2 viewer on Three.js ([`viewer`](https://github.com/JoshuaDuq/neuroatlas/tree/main/web)) renders them. The viewer loads the compiled anatomy from `public/models/` and diffusion assets from `public/diffusion/`.

## Coordinate frames

Panel coordinates, cut positions and the MRI crosshair are FreeSurfer **surface RAS** in millimetres: $+R$ right, $+A$ anterior, $+S$ superior, centred on the conformed 256³ volume. glTF is right-handed and in metres:

$$\begin{bmatrix} X \\ Y \\ Z \end{bmatrix}_{\text{glTF}} = \frac{1}{1000} \begin{bmatrix} R \\ S \\ -A \end{bmatrix}$$

This is a rigid 90° rotation about $x$ with uniform scale. The origin is kept; vertices are never recentred.

## Published files

Each anatomy publishes `public/models/<anatomy>/`:

| File | Contents |
| :--- | :--- |
| `cortex-destrieux.glb`, `cortex-hcp-mmp.glb` | Cortical parcels of each atlas |
| `learning.glb`, `structures.glb`, `nextbrain.glb` | The three internal-anatomy levels |
| `tissue-envelopes.glb` | Native pial and white surfaces, for exposed white matter and cuts |
| `spinal-cord.glb` | PAM50 cord regions on the subject's cord (`cdmd`) |
| `tissues-*.volume`, `white-matter.volume` | Gzipped categorical label grids for cut faces |
| `mri.volume`, `aseg.volume` | T1 intensities and segmentation for relief and linked MRI |
| `manifest.json`, `volumes.json` | Regions, colours, provenance, limitations; volume shapes and affines |
| `cab-np.json`, `functional-regions.json`, `neuropsych-domains.json` | Per-area layers, kept apart for their licences |
| `validation.json` | The validator's measurements |

Volumes end in `.volume`, not `.gz`, so servers do not decode them in transit.

## Loading

The first frame needs the anatomy index, the manifest, one cortical atlas and one detail level; `web/index.html` starts those requests before the scripts parse. Everything else loads when a view first needs it: other levels and atlases when chosen, envelopes and label volumes with the first cut, the MRI with the first cut or T1 colour. A desktop with spare memory and a fast connection prefetches the other atlas.

Every request carries `?v=` and the first 16 hex digits of the file's SHA-256, recorded at build time. A download whose bytes differ fails with `asset-updated`, so a tab open across a deploy stops instead of mixing versions. The service worker caches files by versioned URL and evicts only those a new deploy drops. It does not make the site work offline.

## Encoding

| Attribute | Storage | Error |
| :--- | :--- | :--- |
| `POSITION` | `float32` | Rounding only, < $2 \times 10^{-5}$ mm |
| `NORMAL` | `int16` normalised, `KHR_mesh_quantization` | ≤ $1.54 \times 10^{-5}$ |
| `_SULC`, `_CONCAVITY`, `_T1` | `uint16` normalised, one range per file | ≤ ½ step |
| `_NETWORK` | `uint8` | None (Yeo 1–7, 0 unassigned) |
| Indices | `uint16` | None |

One range per file means the same sulcal depth decodes identically on either side of a region boundary. The extension is listed as required, so a reader without it fails rather than misreading integers.

## Cuts

A cut keeps the published surfaces and volumes; only the cap is built. Where the plane meets a closed solid, the intersection polygon, holes included, is triangulated and drawn. A non-manifold intersection falls back to a winding stencil cap. Dragging builds caps in a worker, and they appear together with the moved plane.

The cap samples integer 3D textures on the GPU (`R16UI` labels, `R8UI` white matter), so labels are never blended. Each label grid is cropped to its non-zero voxels and carries its own affine:

| Volume | Source grid | Published | GPU memory |
| :--- | :--- | :--- | ---: |
| `tissues-destrieux`, `tissues-hcp-mmp` | $256^3$ | $127 \times 138 \times 183$ | 6.12 MiB each |
| `tissues-nextbrain` | $323 \times 459 \times 323$ at 0.4 mm | $160 \times 228 \times 160$ at 0.8 mm | 11.13 MiB |
| `aseg` | $256^3$ | $127 \times 140 \times 183$ | 6.21 MiB |

Validation rebuilds the full grid from each crop and requires equality. NextBrain is the one resampling: each $2 \times 2 \times 2$ block takes its most frequent label, ties going to the rarer label. Its surfaces and measurements keep 0.4 mm. The MRI is not cropped.

In **Tissue** colour, trilinear T1 intensity modulates the lighting of the cut face. No geometry is displaced.
