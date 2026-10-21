# Embedding the JavaScript API

The two rendering classes can be used in a custom Three.js application without the viewer's DOM:

- [`BrainAtlas`](https://github.com/JoshuaDuq/neuroatlas/blob/main/viewer/model/brain-atlas.js) loads a published anatomy from its `manifest.json` and renders the cortex, internal structures and spinal cord as one group. It selects regions and picks them with a raycaster.
- [`BrainSections`](https://github.com/JoshuaDuq/neuroatlas/blob/main/viewer/slices/sections.js) cuts the model with a plane, caps the cut and samples the GPU label volumes on the cut face.

## Minimal integration

```javascript
import * as THREE from 'three';
import { BrainAtlas } from './viewer/model/brain-atlas.js';
import { BrainSections } from './viewer/slices/sections.js';

// 1. Renderer with local clipping, which the cut planes use.
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 10);

// 2. Load a published anatomy from its manifest.
const manifestUrl = new URL('./models/bert/manifest.json', import.meta.url);
const brain = await BrainAtlas.load(manifestUrl, 'destrieux');
const sections = new BrainSections(brain, new URL('volumes.json', manifestUrl));
scene.add(brain.group, sections.group);

// 3. Cutting plane and detail level.
await sections.setMode('coronal');
sections.setOffset(-20);                 // 20 mm posterior to the origin
await sections.setCutAtlas('nextbrain'); // cut labels can differ from the surface atlas
await brain.setDetail('learning');       // the teaching overview

// 4. Picking respects clipping and the GPU label volumes.
const raycaster = new THREE.Raycaster();
window.addEventListener('pointerdown', (event) => {
  raycaster.setFromCamera({
    x: (event.clientX / window.innerWidth) * 2 - 1,
    y: -(event.clientY / window.innerHeight) * 2 + 1,
  }, camera);

  const hit = sections.pick(raycaster);
  if (hit) {
    brain.select(hit.id);
    console.log(`Selected: ${hit.name} (${hit.id})`);
  }
});
```

The example expects the published `models/bert/` directory to be served next to the module. After `npm run build`, the viewer's `dist/` contains that layout.

## BrainAtlas

| Member | Purpose |
| :--- | :--- |
| `BrainAtlas.load(manifestUrl, atlasId, options)` | Fetches the manifest and its assets. `atlasId` names the cortical atlas to show, such as `destrieux` or `hcp-mmp`; it defaults to the manifest's first atlas and throws for an unknown id. The third argument takes a progress callback or an options object, whose `detail` field sets the starting detail level. |
| `brain.group` | The Three.js group to add to your scene. |
| `brain.setDetail(id, onProgress)` | Shows an internal-anatomy detail level: `aseg`, `nextbrain` or `learning` (the set published for the anatomy). Each level is loaded on demand. |
| `brain.select(id)` | Selects a region by its manifest id. Passing `null` clears the selection. It throws for an unknown, hidden or non-region id. |
| `brain.pick(raycaster)` | Returns the region record under the ray, or `null`. Non-region surfaces return `null`. |

A region record is the entry from the manifest's `regions` list, with at least `id` and `name`.

## BrainSections

| Member | Purpose |
| :--- | :--- |
| `new BrainSections(model, metadataUrl, tissues?)` | Binds the cut to a loaded `BrainAtlas`. `metadataUrl` points at the anatomy's `volumes.json`. |
| `setMode(mode)` | One of `off`, `sagittal`, `coronal`, `axial` or `oblique`. Any other value throws. The first non-`off` call prepares the label volumes. |
| `setOffset(mm)` | Moves the plane within the allowed range, in surface RAS millimetres. Out-of-range values throw a `RangeError`. |
| `setCutAtlas(atlas)` | Chooses the label volume the cut face samples, independently of the surface atlas. |
| `pick(raycaster)` | Returns the region under the ray, honouring the cut and the clipping plane. |

The cut is in surface RAS, the same coordinate space the viewer's panel uses. See [Architecture](../concepts/architecture.md#coordinate-frames) for the transforms.

## Notes

- Each `BrainAtlas` and `BrainSections` holds GPU buffers. Call `dispose()` on both when you discard them.
- `setDetail` and `setCutAtlas` are asynchronous when the asset is not yet loaded. Await them before you read the state they change.
