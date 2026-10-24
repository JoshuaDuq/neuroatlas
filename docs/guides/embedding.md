# Embedding the API

Two classes work in any Three.js application, without the viewer's interface:

- [`BrainAtlas`](https://github.com/JoshuaDuq/neuroatlas/blob/main/viewer/model/brain-atlas.js) loads an anatomy from its `manifest.json`, renders it as one group, and selects and picks regions.
- [`BrainSections`](https://github.com/JoshuaDuq/neuroatlas/blob/main/viewer/slices/sections.js) cuts the model with a plane, caps the cut and samples the label volumes on the cut face.

```javascript
import * as THREE from 'three';
import { BrainAtlas } from './viewer/model/brain-atlas.js';
import { BrainSections } from './viewer/slices/sections.js';

// The cut needs a stencil buffer and local clipping.
const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true });
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.01, 10);

const manifestUrl = new URL('./models/cdmd/manifest.json', import.meta.url);
const brain = await BrainAtlas.load(manifestUrl, 'destrieux');
const sections = new BrainSections(brain, new URL('volumes.json', manifestUrl));
scene.add(brain.group, sections.group);

// Parts arrive after the call that asked for them: redraw on change.
const render = () => renderer.render(scene, camera);
brain.addEventListener('change', render);
sections.addEventListener('change', render);

await sections.setMode('coronal');
sections.setOffset(-20);                 // 20 mm posterior
await sections.setCutAtlas('nextbrain');
await brain.setDetail('learning');

const raycaster = new THREE.Raycaster();
addEventListener('pointerdown', event => {
  raycaster.setFromCamera({
    x: (event.clientX / innerWidth) * 2 - 1,
    y: -(event.clientY / innerHeight) * 2 + 1,
  }, camera);
  const region = sections.pick(raycaster);
  if (region) brain.select(region.id);
});
```

Serve a published `models/cdmd/` directory next to the module; `npm run build` produces that layout in `dist/`. Without `stencil: true`, a non-manifold cut face fills the whole plane.

## BrainAtlas

| Member | Purpose |
| :--- | :--- |
| `BrainAtlas.load(manifestUrl, atlasId, options)` | Loads the manifest, one cortical atlas (`destrieux`, `hcp-mmp`) and one detail level. The third argument is a progress callback or `{ detail }`. |
| `group` | The group to add to your scene. |
| `setDetail(id)` | Shows `learning`, `aseg` or `nextbrain`, downloading it the first time. |
| `setSpinalCordVisible(visible)` | Shows or hides the cord. |
| `hideRegions(ids)`, `showRegions(ids)` | Dissection. Hidden cortex exposes the white matter beneath. |
| `select(id)` | Selects by manifest id; `null` clears. Throws for an unknown or hidden id. |
| `pick(raycaster)` | The region record under the ray, or `null`. |

A region record is the manifest entry: `id`, `label`, `source_name`, `hemisphere`, `atlas`, `kind`. `change` fires on every display change; a background download that fails fires `loaderror`.

## BrainSections

| Member | Purpose |
| :--- | :--- |
| `new BrainSections(model, volumesUrl)` | Binds the cut to a loaded `BrainAtlas`. |
| `setMode(mode)` | `off`, `sagittal`, `coronal`, `axial` or `oblique`. |
| `setOffset(mm)` | Moves the plane in surface RAS mm, building the caps synchronously. Throws `RangeError` outside `offsetRange`. |
| `setOffsetReady(mm)` | Builds the caps in a worker; use it while dragging. |
| `offsetRange` | `[minimum, maximum]` for the current plane. |
| `setCutAtlas(atlas)` | The label volume the cut face samples, independent of the surface atlas. |
| `pick(raycaster)` | The region under the ray, honouring the cut. |

`sections.state.error` is `null` or one of `asset-fetch` (network or HTTP failure), `asset-updated` (the files were redeployed after the page was built; only a reload recovers) or `cut-failed`. Failed downloads are retried on the next call.

## Notes

- The modules import `three`, `three/addons/…` and `three-mesh-bvh` by bare specifier, and start a module worker with `new URL('./section-worker.js', import.meta.url)`. Use a bundler that handles module workers (Vite, webpack 5, or Rollup or esbuild with a worker plugin). Without one the cut builds on the main thread and drags stall.
- Await the asynchronous setters before reading the state they change.
- Call `dispose()` on both objects when you discard them.
