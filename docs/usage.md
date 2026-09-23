# Viewer & API Usage Guide

This guide covers interactive exploration in the WebGL viewer, headless integration using the Three.js JavaScript API, and offline Python model generation.

---

## 1. Interactive WebGL Viewer

### Launching the Development Server

```bash
# Install frontend dependencies
npm ci

# Start Vite live development server
npm run dev
```

Navigate to the local URL printed in your terminal (default `http://localhost:5173`).

### Viewer Controls & Modes

```
+------------------------------------------------------------------------------------+
|  [NeuroAtlas]   Appearance: [Atlas | Tissue]   Detail: [Learning | Aseg | Next]    |
+------------------------------------------------------+-----------------------------+
|                                                      |  Anatomical Cuts            |
|                                                      |  Mode: [Coronal / Axial..]  |
|                                                      |  Offset: [  -20 mm  ]       |
|                 3D Interactive Scene                 |  Reverse Cut: [X]           |
|               (Orbit, Pan, Zoom, Pick)               |  -------------------------  |
|                                                      |  Study a System             |
|                                                      |  > Basal Ganglia            |
|                                                      |  > Brainstem                |
|                                                      |  -------------------------  |
|                                                      |  [ Open Linked 2D MRI ]     |
+------------------------------------------------------+-----------------------------+
```

- **Appearance Modes**:
  - **Atlas**: Displays distinct categorical region colors derived from the active parcellation palette, with soft specular highlights and sulcal relief.
  - **Tissue**: Renders natural gray/white matter coloration with trilinearly sampled T1 MRI relief shading across cut faces.
- **Anatomical Cuts Panel**:
  - **Planes**: Select Sagittal, Midsagittal (Sagittal offset $0\text{ mm}$), Coronal, Axial, or arbitrary Oblique.
  - **Offsets**: Slider and numerical input move the cutting plane in native surface RAS millimeters ($+A$ anterior, $+S$ superior, $+R$ right).
  - **Oblique Angles**: Controls tilt from axial and azimuth around superior axes.
- **Linked 2D MRI Reference Viewer**:
  - Clicking **Open linked MRI slices** opens three orthogonal T1 sections.
  - The shared 3D crosshair synchronizes with slice planes.
  - Includes window/center contrast controls, voxel-exact label inspection, and PNG snapshot export.

### Keyboard Navigation

Every part of the viewer is reachable without a pointer, including the model
itself. Press <kbd>?</kbd> in the app for the live list.

| Keys | Action |
| :--- | :--- |
| <kbd>/</kbd> | Focus the search field |
| <kbd>↑</kbd> <kbd>↓</kbd> | Move through results or the region tree |
| <kbd>Enter</kbd> | Select the focused region |
| <kbd>Tab</kbd> | Move focus to the model |
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Turn the model, once it holds focus |
| <kbd>+</kbd> <kbd>−</kbd> | Zoom the model in or out |
| <kbd>1</kbd>–<kbd>6</kbd> | Left, right, front, back, top, bottom view |
| <kbd>0</kbd> | Return to the default oblique view |
| <kbd>F</kbd> / <kbd>I</kbd> | Focus / isolate the selected region |
| <kbd>C</kbd> / <kbd>S</kbd> | Show or hide the cortex / spinal cord |
| <kbd>H</kbd> | Cycle hemisphere: both, left, right |
| <kbd>M</kbd> | Open or close the linked MRI slices |

The arrow keys turn the model the way dragging turns it — the anatomy follows
the arrow — so the pointer and the keyboard share one mental model. Rotation is
clamped short of the poles so the horizon cannot flip, and zoom obeys the same
near and far limits as the scroll wheel.

---

## 2. Headless Three.js JavaScript API

The core rendering classes ([`BrainAtlas`](../viewer/model/brain-atlas.js) and [`BrainSections`](../viewer/slices/sections.js)) can be integrated into custom Three.js applications without the default DOM interface:

```javascript
import * as THREE from 'three';
import { BrainAtlas } from './viewer/model/brain-atlas.js';
import { BrainSections } from './viewer/slices/sections.js';

// 1. Initialize Three.js WebGL 2 renderer with local clipping
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 10);

// 2. Load model from manifest descriptor
const manifestUrl = new URL('./models/bert/manifest.json', import.meta.url);
const brain = await BrainAtlas.load(manifestUrl, 'destrieux');
const sections = new BrainSections(brain, new URL('volumes.json', manifestUrl));
scene.add(brain.group, sections.group);

// 3. Configure cutting plane and detail levels
await sections.setMode('coronal');
sections.setOffset(-20); // 20 mm posterior to origin
await sections.setCutAtlas('nextbrain'); // Decoupled cut label volume
await brain.setDetail('learning');      // Pedagogical overview level

// 4. Handle picking with stencil and clipping awareness
const raycaster = new THREE.Raycaster();
window.addEventListener('pointerdown', (event) => {
  raycaster.setFromCamera({
    x: (event.clientX / window.innerWidth) * 2 - 1,
    y: -(event.clientY / window.innerHeight) * 2 + 1
  }, camera);

  // sections.pick() correctly accounts for clipped surfaces and 3D volume labels
  const hit = sections.pick(raycaster);
  if (hit) {
    brain.select(hit.id);
    console.log(`Selected: ${hit.name} (${hit.id})`);
  }
});
```

---

## 3. Python Model Build Pipeline

The model generation toolchain compiles raw neuroimaging datasets into web-ready glTF and volume binaries.

### Commands

```bash
# Synchronize exact pinned dependencies
uv sync --locked

# Prepare subject files (verify hashes, extract recon-all)
uv run python scripts/prepare_subject.py --anatomy bert

# Segment NextBrain on the subject's own T1 (needs FreeSurfer 8.2; ~20 min on CPU)
uv run python scripts/segment_nextbrain.py --anatomy bert --record

# Compile glTF 2.0 meshes and 3D categorical textures
uv run python -m brain_model.build --anatomy bert

# Run full numerical validation against source neuroimaging
uv run python -m brain_model.validate --anatomy bert
```

### Production Build & Bundle

To build the static web application for deployment:

```bash
npm run build
```

This compiles all JavaScript modules into `dist/`, ready for hosting on any static HTTP/2 server.
