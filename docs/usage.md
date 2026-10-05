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
+-----------------------------------------------------------------------+
| NeuroAtlas · current source                 Fullscreen · PNG · Settings |
+----------------------------+------------------------------------------+
| Explore Region Sections View|                                          |
|                            |          3D Interactive Scene            |
| One task panel             |         Orbit, Pan, Zoom, Pick           |
| changes with your task     |                                          |
+----------------------------+------------------------------------------+
```

- **Explore** contains **Anatomy**, **Deficits**, and **Circuits**. Search or
  browse anatomy here; use the eye controls and dissection actions to hide or
  restore parts.
- **Region** contains anatomical measurements, source information, available
  network and clinical context, and selected deficit or circuit details. On
  desktop, a new anatomical selection from Explore opens Region. Region is
  disabled until context exists and returns to Explore when that context
  clears. Selecting anatomy while working in Sections or View keeps that task
  open; the selection strip opens Region when you want its details.
- **Sections** contains the cutting plane, cut-label source, position, oblique
  angles, reverse cut, and linked MRI action.
- **View** contains anatomy/specimen, cortical atlas, internal anatomy detail,
  appearance, hemisphere, visibility, cortex opacity, and reset.

The header keeps the current source, fullscreen, and PNG capture visible on
desktop. **More settings** opens language, theme, and keyboard shortcuts. On
phones, the same four destinations live in the draggable sheet with peek,
half, and full positions. Region remains available with an empty hint before
a selection. In short landscape, the sheet sits beside the anatomy; its tabs
use two rows at peek and half and one row at full. The source readout moves out
of the compact phone header; the source controls remain in View.

- **Appearance Modes**:
  - **Atlas**: Displays distinct categorical region colors derived from the active parcellation palette, with soft specular highlights and sulcal relief.
  - **Tissue**: Renders natural gray/white matter coloration with trilinearly sampled T1 MRI relief shading across cut faces.
  - **MRI**: Uses the specimen's registered T1 MRI in grayscale with region highlighting.
  - **Networks**: Uses the published Yeo 7 functional-network color mapping.
- **Anatomical Sections**:
  - **Planes**: Select full brain, Sagittal, Coronal, Axial, or arbitrary Oblique. A Sagittal offset of $0\text{ mm}$ is midsagittal.
  - **Offsets**: Slider and numerical input move the cutting plane in native surface RAS millimeters ($+A$ anterior, $+S$ superior, $+R$ right).
  - **Oblique Angles**: Controls tilt from axial and azimuth around superior axes.
- **Linked 2D MRI Reference Viewer**:
  - Clicking **Open linked MRI slices** opens three orthogonal T1 sections.
  - The shared 3D crosshair synchronizes with slice planes.
  - Includes window/center contrast controls, voxel-exact label inspection, and PNG snapshot export.

### Selective dissection

Use the eye controls in the anatomy list to hide a region or an entire group.
Group controls marked **L** and **R** operate on the two sides separately.
The **Hide** action in anatomical details removes the selected region.
Hiding cortical parcels exposes the subject's native white-matter surface
beneath them. This tissue remains in place and blocks selection of deeper
structures behind it. Hemisphere, cortex transparency and plane cuts apply
to the exposed tissue too. Restoring the cortex closes the exposure.

**Undo** reverses one dissection action. **Restore all** brings back every
explicitly removed part while keeping the current hemisphere, appearance and
cut settings. Hidden entries remain searchable; select one to reveal it, or
use its eye control to restore only its dissection visibility.

Dissection also applies to 3D cut faces, including sampled white-matter
parcels. MRI reference slices continue to show the original scan. Hidden
region identifiers travel in the URL; undo history lasts for the current visit.
Switching anatomical subjects clears the dissection because their parcels differ.

### Guided circuit learning

Choose **Circuits** beside **Anatomy** and **Deficits** in **Explore**. Eight bilingual tours
cover vision, memory, basal ganglia motor loops, hearing, touch, language,
spatial attention and cerebellar output. Together they offer 33 landmarks
and eight learning questions. Choose a tour, then select a numbered landmark or use
**Previous** and **Next** in the region panel. On a phone, selecting a tour
opens the region sheet; scroll it to reach the controls and notes.

Each landmark opens its source atlas, reveals its anatomy and prepares an
orientation. **MRI at landmark** centres the linked sections on that brain's
actual landmark centroid and opens the authored plane on phones. MRI volume
labels may use a different or finer atlas than the selected teaching solid;
the centroid can fall outside a curved structure such as the fornix.
**Return to landmark** restores the prepared view after free exploration.

**Connections and scope**, **What this atlas shows**, **Clinical context** and
**Sources** distinguish teaching relationships from the actual source geometry
and published evidence. The tours do not measure functional connectivity or
reconstruct axons. The memory tour stops at a coarse thalamic union, and the
motor tour explicitly changes from the direct to the indirect branch.
The hearing tour identifies the displayed **dorsal** geniculate division and
distinguishes it from the ventral relay to A1. The touch tour separates a whole
thalamic union from the specific sensory relays within it. Language and
attention tours visit interacting network territories rather than implying
a serial chain; the right attention landmarks do not make the dorsal network
exclusively right-sided. The cerebellar tour changes from left dentate and
superior peduncle to right thalamus and motor cortex after the explained crossing.
Its dentate step hides the covering cerebellar cortex to expose the deep
nucleus. Returning to the cortex landmark restores that layer; linked MRI
always retains the complete source volume.

The final landmark offers a question with explanatory feedback. Answers stay
available while navigating that tour. Starting a tour again resets its answer;
reloading the page or switching brains resets learning progress. The existing
anatomical URL still records the selected region and display state. English
and French are available through the language control. In Circuits, **/**
focuses the tour list, and **↑/↓** moves between its buttons.

Lesson text, mappings, source links, orientations, questions and context margin
live in `data/circuits.yaml`. The catalog validates their exact source names
against each published anatomy; missing landmarks or translations cause an
error rather than substitution. Scientific-content tests cover both brains.

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
