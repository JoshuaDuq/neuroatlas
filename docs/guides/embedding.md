# Embedding the JavaScript API

The two rendering classes can be used in a custom Three.js application without the viewer's DOM:

- [`BrainAtlas`](https://github.com/JoshuaDuq/neuroatlas/blob/main/viewer/model/brain-atlas.js) loads a published anatomy from its `manifest.json` and renders the cortex, internal structures and spinal cord as one group. It selects regions and picks them with a raycaster.
- [`BrainSections`](https://github.com/JoshuaDuq/neuroatlas/blob/main/viewer/slices/sections.js) cuts the model with a plane, caps the cut and samples the GPU label volumes on the cut face.

## Minimal integration

```javascript
import * as THREE from 'three';
import { BrainAtlas } from './viewer/model/brain-atlas.js';
import { BrainSections } from './viewer/slices/sections.js';

// 1. A stencil buffer and local clipping, which the cut uses.
const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true });
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 10);

// 2. Load a published anatomy from its manifest.
const manifestUrl = new URL('./models/bert/manifest.json', import.meta.url);
const brain = await BrainAtlas.load(manifestUrl, 'destrieux');
const sections = new BrainSections(brain, new URL('volumes.json', manifestUrl));
scene.add(brain.group, sections.group);

// 3. Draw again whenever either changes: parts of the anatomy arrive after the call that asked for them.
const render = () => renderer.render(scene, camera);
brain.addEventListener('change', render);
sections.addEventListener('change', render);

// 4. Cutting plane and detail level.
await sections.setMode('coronal');
sections.setOffset(-20);                 // 20 mm posterior to the origin
await sections.setCutAtlas('nextbrain'); // cut labels can differ from the surface atlas
await brain.setDetail('learning');       // the teaching overview

// 5. Picking respects clipping and the GPU label volumes.
const raycaster = new THREE.Raycaster();
window.addEventListener('pointerdown', (event) => {
  raycaster.setFromCamera({
    x: (event.clientX / window.innerWidth) * 2 - 1,
    y: -(event.clientY / window.innerHeight) * 2 + 1,
  }, camera);

  const region = sections.pick(raycaster);
  if (region) {
    brain.select(region.id);
    console.log(`Selected: ${region.label} (${region.id})`);
  }
});
```

The example expects the published `models/bert/` directory to be served next to the module. After `npm run build`, the viewer's `dist/` contains that layout.

The renderer needs `stencil: true`. Three.js r186 creates the canvas without a stencil buffer by default. Where a plane meets a solid in a non-manifold section, the cut draws that face through the stencil. Without the buffer that face fills the whole plane as a square of its colour.

## BrainAtlas

| Member | Purpose |
| :--- | :--- |
| `BrainAtlas.load(manifestUrl, atlasId, options)` | Fetches the manifest and the first frame's assets: one cortical atlas and one detail level. `atlasId` names the cortical atlas to show, such as `destrieux` or `hcp-mmp`; it defaults to the manifest's first atlas and throws for an unknown id. The third argument takes a progress callback or an options object, whose `detail` field sets the starting detail level. |
| `brain.group` | The Three.js group to add to your scene. |
| `brain.setDetail(id, onProgress)` | Shows an internal-anatomy detail level: `aseg`, `nextbrain` or `learning` (the set published for the anatomy). Each level is downloaded the first time it is shown. |
| `brain.setSpinalCordVisible(visible)` | Shows or hides the spinal cord. The first time it is shown, it is downloaded; await the call. |
| `brain.hideRegions(ids)`, `brain.showRegions(ids)` | Remove or restore regions. Hidden cortex exposes the white matter beneath it. That surface is downloaded the first time it is needed, and the model emits `change` when it is drawn. |
| `brain.select(id)` | Selects a region by its manifest id. Passing `null` clears the selection. It throws for an unknown, hidden or non-region id. |
| `brain.pick(raycaster)` | Returns the region record under the ray, or `null`. Non-region surfaces return `null`. |

A region record is the entry from the manifest's `regions` list. It carries `id`, `label` (the display name), `source_name` (the name in the source atlas), `hemisphere`, `atlas` and `kind`.

`change` fires whenever the display state changes, including when a download that a call started finishes. A download that the model started for itself and that then fails fires `loaderror`. Its `detail` is the error.

## BrainSections

| Member | Purpose |
| :--- | :--- |
| `new BrainSections(model, metadataUrl, tissues?)` | Binds the cut to a loaded `BrainAtlas`. `metadataUrl` points at the anatomy's `volumes.json`. |
| `setMode(mode)` | One of `off`, `sagittal`, `coronal`, `axial` or `oblique`. Any other value throws. The first non-`off` call downloads the label volumes, the MRI, the tissue envelopes and the cord. |
| `setOffset(mm)` | Moves the plane within `offsetRange`, in surface RAS millimetres, and rebuilds the cut faces on the calling thread. Out-of-range values throw a `RangeError`. |
| `setOffsetReady(mm)` | Moves the plane without blocking the pointer: the faces are built in a worker, and the plane and its faces move together when they are ready. Use it while dragging. |
| `offsetRange` | The `[minimum, maximum]` offset the current plane accepts. Every value in it is a legal cut. |
| `setCutAtlas(atlas)` | Chooses the label volume the cut face samples, independently of the surface atlas. |
| `pick(raycaster)` | Returns the region record under the ray, honouring the cut and the clipping plane. |

`change` fires whenever the cut, its status or its loading changes. `sections.state.error` is `null`, or a code when loading failed: `asset-fetch`, `asset-updated` or `cut-failed`.

The cut is in surface RAS, the same coordinate space the viewer's panel uses. See [Architecture](../concepts/architecture.md#coordinate-frames) for the transforms.

## Loading

Each download is verified against the map of published files that the viewer's build writes in. `asset-updated` means the bytes differ from that map: the files were redeployed after the page was built, and only a reload recovers. `asset-fetch` is a network or HTTP failure, with the HTTP `status` when there is one. A failed download is not remembered, so retrying the call that needed it downloads it again.

Without the viewer's build there is no map. A bundler other than this repository's Vite configuration, or none, sends requests without a version and does not verify them.

## Bundling

The modules import `three`, `three/addons/…` and `three-mesh-bvh` by bare specifier. The cut builds its faces in a module worker, `new Worker(new URL('./section-worker.js', import.meta.url), { type: 'module' })`, which imports the same packages.

Use a bundler that bundles module workers written that way, such as Vite, webpack 5, Rollup with a worker plugin, or esbuild with one. An import map does not reach a worker: Chrome 155 fails to start it. The cut then logs `Cut build failed` and builds every face on the calling thread, so a drag can stall.

## Notes

- Each `BrainAtlas` and `BrainSections` holds GPU buffers. Call `dispose()` on both when you discard them. The cut shares the model's geometry, and disposing the model is what frees it.
- `setDetail`, `setSpinalCordVisible`, `setMode` and `setCutAtlas` are asynchronous when the asset is not yet loaded. Await them before you read the state they change.
