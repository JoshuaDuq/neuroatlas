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
+-----------------------------------------------------------------------------+
| NeuroAtlas  Specimen · Atlas · Colour · Internal anatomy   Fullscreen PNG ⋯ |
+----------------------------+------------------------------------------------+
| Anatomy Deficits Circuits  |                                                |
| Tracts                     |           3D scene: orbit, zoom, pick          |
|                            |                                                |
| List, or a region/deficit/ |  [Default Left Right Front Back Top Bottom]    |
| circuit in detail          |  [Section ▾] [Display ▾]                       |
+----------------------------+------------------------------------------------+
| not clinical anatomy · region count · Provenance                            |
+-----------------------------------------------------------------------------+
```

Each part of the window has one job:

- **Masthead: what is loaded.** **Specimen**, cortical **Atlas** (Destrieux or
  HCP-MMP), **Colour** (Tissue, T1, Regions, Networks) and the **Internal
  anatomy** detail level sit beside the name, with fullscreen, PNG capture and
  **More settings** (language, theme, single-key shortcuts, keyboard shortcuts).
  Below 1280 px and on phones they collapse into one summary button, such as
  "bert · Destrieux · Regions", that opens the same controls.
- **Panel: what you are studying.** The tabs are **Anatomy**, **Deficits**,
  **Circuits** and **Tracts**. Search or browse a list; selecting a region,
  opening a deficit or starting a circuit shows its details in the same panel,
  under a **‹ Anatomy** (or Deficits, Circuits) row that returns to the list
  where you left it. While you browse, the selection strip at the top of the
  list leads back to the details. In the details, Escape also returns to the
  list. Hover a row to reveal its eye controls; a hidden part keeps its eye
  visible, and the dissection line at the foot of Anatomy undoes or restores.
- **Stage: how the picture is framed and cut.** The toolbar under the anatomy
  holds the camera presets, **Section** (cutting plane and cut labels) and
  **Display** (hemisphere, cortex and its opacity, internal anatomy, spinal
  cord, restore the opening view). While a plane is cut, a section bar above the
  toolbar holds its position, oblique angles, **Reverse side** and **Linked
  MRI**; its × returns to the full brain.

On phones the panel becomes a draggable sheet with peek, half and full
positions and the same four tabs; the stage toolbar stays above it. In short
landscape the sheet sits beside the anatomy.

- **Colour Modes**:
  - **Regions**: Displays distinct categorical region colors derived from the active parcellation palette, with soft specular highlights and sulcal relief.
  - **Tissue**: Renders natural gray/white matter coloration with trilinearly sampled T1 MRI relief shading across cut faces.
  - **T1**: Uses the specimen's registered T1 MRI in grayscale with region highlighting.
  - **Networks**: Uses the published Yeo 7 functional-network color mapping; its key appears on the stage.
- **Anatomical Sections** (stage **Section** tool):
  - **Planes**: Select full brain, Sagittal, Coronal, Axial, or arbitrary Oblique. A Sagittal offset of $0\text{ mm}$ is midsagittal.
  - **Offsets**: Slider and numerical input move the cutting plane in native surface RAS millimeters ($+A$ anterior, $+S$ superior, $+R$ right).
  - **Oblique Angles**: Controls tilt from axial and azimuth around superior axes.
- **Linked 2D MRI Reference Viewer**:
  - **Linked MRI** (region details, section bar, or **M**) opens three orthogonal T1 sections.
  - The shared 3D crosshair synchronizes with slice planes.
  - Includes window/center contrast controls, voxel-exact label inspection, and PNG snapshot export.
  - Coordinates read as a signed RAS triple in millimeters, the same in the panel and the MRI readout.

### Diffusion and tract exploration

New sessions open SNAIL subject 1, reconstructed from the tract dataset's own
T1. Choose the **Tracts** tab to enable three initial reconstructed bundles
in the normal 3D viewer. The built-in collection contains 27 named bundles
from subject 1 of DIPY's published SNAIL example dataset. Users need no files
or uploads; additional bundles load when a side (L | R, or a numbered corpus
callosum segment) is switched on in the searchable list.

Use the normal camera presets, orbit, zoom and PNG action. On the matching
SNAIL anatomy, Tracts enables a layer over the actual cortical reconstruction.
**Cortex opacity** is shared with the stage **Display** tool. Pick or browse atlas
regions, change the atlas or colouring in the masthead, and cut both layers
together with the stage **Section** tool.
Returning to **Anatomy** keeps the tracts visible; **Show tracts with anatomy**
turns that layer off. The minimum-length slider filters streamlines on release;
visibility changes retain their uploaded geometry.

On another anatomical subject, Tracts displays an independent SNAIL reference
with an outline derived from its skull-stripped T1. This is an MRI isosurface,
not a pial reconstruction or cortical atlas. Region details and the stage
Section and Display tools are hidden in this independent reference; SNAIL tracts
are never overlaid on another brain.

**MRI with tracts** in Tracts (or **M**) opens the published SNAIL T1 and
FA with linked sections, crosshair, exact zero-based source voxel inputs and
the selected tracts. Choose axial, coronal, sagittal or linked slices with 3D;
phones initially show one plane. Click to position the crosshair, scroll through
slices, or use arrow keys and Page Up/Down on the canvas to move one voxel.
Contrast and FA opacity updates commit on release. Closing preserves the loaded
maps and position. The crosshair also positions the normal cutting plane when
the selected anatomy is SNAIL, using the exact scanner-to-surface RAS transform.

The masthead's T1 colouring and the stage **Section** tool remain available
for the selected anatomical subject. T1 colouring is available with tracts when
the loaded anatomy is SNAIL, including during tract loading. Its Destrieux,
internal segmentations and registered HCP-MMP projection have passed
source-to-asset validation. The original T1 has cropped inferior coverage;
the manifest records that limit and the coarse aseg labels it does not contain.

SNAIL's learning overview omits the coarse callosal surface because it overlaps
the finer fornix and septal estimates. Select **FreeSurfer aseg** under
**Internal anatomy** to see the original callosal subsegments. The callosal clinical landmark
uses those same five native labels. Source segmentations and tractograms remain
unchanged.

The standard tract colors encode left–right in red, anterior–posterior in green,
and inferior–superior in blue. Each loaded row gives its streamline count (or
how many of them the length filter keeps), mean length and length range.
Counts describe reconstructed streamlines, not axons; lengths are polyline arc
lengths, not connectivity strength.
**Export lengths CSV** includes loaded bundles, total/enabled counts, the active
threshold and enabled mean/minimum/maximum lengths. Counts and lengths use full
source polylines after the length filter; cuts affect only the view. Spatial
proximity to an atlas region does not establish a measured connection.
**Restore default tracts**
restores the initial selection.

This diffusion subject is distinct from Bert and AOMIC. The workspace maps its
scanner RAS coordinates into its own FreeSurfer surface RAS using the exact
image-header transform, without registering it to those other specimens.
The rigid transform moves the outline and tracts together and preserves lengths.
Source TRK files are losslessly
compressed, retaining every original point and streamline, including source
points outside the image field of view. The collection occupies about 113 MB;
only selected bundles are requested. Load failures appear with a reload action.

The dataset is [published under CC0](https://hdl.handle.net/1773/38477).
Its original checksums, affine transforms, counts and independent NiBabel
geometry measurements are in
[`public/diffusion/snail-subject-1/provenance.json`](../public/diffusion/snail-subject-1/provenance.json).
To reproduce the assets, download the archive URL in `data/diffusion.yaml` and
run `python scripts/prepare_diffusion.py /path/to/bundles_2_subjects.tar.gz`
using the project's Python environment. The preparation script verifies DIPY's
published archive checksum before packaging the data.
Run `python scripts/prepare_diffusion_outline.py` afterward to reproduce the
brain outline. `data/diffusion.yaml` specifies the T1 intensity threshold (80)
and marching-cubes step size (2 voxels). The largest connected component
removes disconnected foreground; no registration is applied. Its method,
source checksum, affine, bounds and limitations are recorded in
`public/diffusion/snail-subject-1/t1-outline.json`.
After importing the exact T1 with FreeSurfer, run
`python scripts/prepare_diffusion_space.py` to reproduce the header-derived
coordinate mapping and independent voxel anchors in
`public/diffusion/snail-subject-1/surface-space.json`.

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

Choose the **Circuits** tab beside **Anatomy** and **Deficits**. Eight bilingual tours
cover vision, memory, basal ganglia motor loops, hearing, touch, language,
spatial attention and cerebellar output. Together they offer 33 landmarks
and eight learning questions. Choose a tour, then select a numbered landmark or
step with the arrows beside the landmark count at the top of the lesson. On a
phone, selecting a tour opens the lesson in the sheet; scroll it to reach the
notes.

Each landmark opens its source atlas, reveals its anatomy and prepares an
orientation. The landmark's own **Focus** returns to that prepared framing, and
its **Linked MRI** centres the linked sections on that brain's actual landmark
centroid, cuts the model on the authored plane and opens that plane on phones.
MRI volume labels may use a different or finer atlas than the selected teaching
solid; the centroid can fall outside a curved structure such as the fornix.
After selecting another region, **Return to landmark** restores the prepared
view.

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
