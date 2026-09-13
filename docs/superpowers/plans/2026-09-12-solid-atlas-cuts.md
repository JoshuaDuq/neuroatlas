# Solid Atlas & Network Cuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make atlas-coloured and network-coloured cuts use the same smooth solid geometry that tissue cuts already use, so parcel boundaries on a cut stop showing 1 mm voxel steps while keeping the published colours byte-for-byte identical.

**Architecture:** The cortical ribbon is the volume between the native pial and white surfaces, which share triangles and vertex indexing exactly. Assigning each source triangle to a parcel by majority vertex vote yields, per parcel, a closed solid (pial patch + reversed white patch + a wall stitched along the patch's directed boundary edges). Those solids feed the existing `SolidSections` stencil-cap machinery, so a parcel's cut face is defined by geometry rather than by sampling a label volume. Only a small per-vertex label file ships; the viewer assembles the solids from `tissue-envelopes.glb`, which it already loads.

**Tech Stack:** Python (numpy, nibabel, trimesh) for the build and its validation; JavaScript (three.js 0.186, three-mesh-bvh) for the viewer; `node --test` and `pytest` for tests.

**Spec:** This document (the investigation and its measurements are recorded in "Validated facts" below).

## Global Constraints

- Published colours must not change. Atlas colour comes from the region's published colour; network colour from `dominantNetwork(region)` → `manifest.networks.colors`, exactly as `viewer/tissues/palette.js` does today.
- Source geometry is never smoothed, displaced, or re-indexed. Wedges reuse native pial/white coordinates verbatim.
- NextBrain is a cut-only atlas (`cut_atlases[].surface === false`) with no surface parcellation. It keeps the label-volume path.
- Vertex pinches are an accepted, documented condition in this repo. Holes are not: every wedge must have zero singly-used edges.
- `node --test` must stay green (224 tests at plan time).

## Validated facts

Measured during investigation; the plan depends on all of these.

| Fact | Value |
|---|---|
| `lh/rh.pial` and `lh/rh.white` share faces exactly | `np.array_equal(pf, wf) == True`, both hemispheres |
| Vertices | lh 133,103 · rh 133,819 (pial, white and annot all agree) |
| Wedges, Destrieux | 150; 0 holes; 150/150 winding-consistent; 0 non-positive volume; 1,156,776 triangles |
| Wedges, HCP-MMP | 362; 0 holes; 362/362 winding-consistent; 0 non-positive volume; 1,193,696 triangles |
| Pinch edges (used >2×) | 99 (Destrieux), 311 (HCP-MMP) — the documented, tolerated condition |
| Collapsed vertices (pial == white) | 6,258 lh / 6,249 rh, in the medial wall; wedges there are flat but closed |
| `cortex-*.glb` geometry | the **pial** surface, barycentrically partitioned (692,821 triangles) — **not** used here; its partition introduces T-junctions (46,659 singly-used edges) that would leak the stencil |

**Wall winding (the bug that cost an hour):** a wall triangle must traverse a shared edge opposite to the patch that owns it. For a directed boundary edge `a → b` on the pial patch, the wall is `(b, a, a+n)` and `(b, a+n, b+n)`, where `n` is the pial vertex count. The mirrored form leaves every wedge winding-inconsistent.

## File structure

| File | Responsibility |
|---|---|
| `brain_model/ribbons.py` (create) | Export + validate the per-vertex parcel label file for one atlas. Mirrors `brain_model/solids.py`. |
| `brain_model/build.py` (modify) | Call `export_ribbon_labels` per atlas; drop the two README/manifest limitations this change retires. |
| `brain_model/validate.py` (modify) | Call `validate_ribbon_labels` per atlas. |
| `tests/test_ribbons.py` (create) | Wedge closure invariant on a synthetic surface. |
| `viewer/tissues/ribbon-wedges.js` (create) | Pure function: (faces, pial, white, labels) → one closed `BufferGeometry` per parcel. |
| `viewer/tissues/ribbon-wedges.test.js` (create) | Closure, winding and wall-orientation tests on a synthetic patch. |
| `viewer/tissues/solid-assets.js` (modify) | Load the label file; build wedges; choose each solid's colour for the active colour mode. |
| `viewer/tissues/solid-sections.js` (modify) | Plane-straddle culling; per-solid colour updates; isolation. |
| `viewer/tissues/gpu-sections.js` (modify) | Route atlas/network modes to the solid path for surface-backed atlases. |
| `README.md` (modify) | Retire the "atlas colours retain native voxel steps" statements. |

---

### Task 1: Ribbon wedge builder (viewer, pure geometry)

**Files:**
- Create: `viewer/tissues/ribbon-wedges.js`
- Test: `viewer/tissues/ribbon-wedges.test.js`

**Interfaces:**
- Produces: `buildRibbonWedges({ faces, pial, white, labels })` → `Map<number, BufferGeometry>` keyed by parcel label. Each geometry is non-indexed-safe, has `position` only (the stencil masks need no normals), and is closed.

- [ ] **Step 1: Write the failing test**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRibbonWedges } from './ribbon-wedges.js';

/** A two-triangle square, extruded; one parcel. */
function square(labelA, labelB) {
  return {
    faces: new Uint32Array([0, 1, 2, 0, 2, 3]),
    pial: new Float32Array([0,0,1, 1,0,1, 1,1,1, 0,1,1]),
    white: new Float32Array([0,0,0, 1,0,0, 1,1,0, 0,1,0]),
    labels: new Uint16Array([labelA, labelA, labelB, labelB]),
  };
}

function edgeCounts(geometry) {
  const index = geometry.getIndex().array;
  const counts = new Map();
  for (let i = 0; i < index.length; i += 3) {
    for (const [a, b] of [[0,1],[1,2],[2,0]]) {
      const key = [index[i+a], index[i+b]].sort((x,y) => x-y).join(':');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

test('a single-parcel patch extrudes to a closed solid', () => {
  const wedges = buildRibbonWedges(square(7, 7));
  assert.deepEqual([...wedges.keys()], [7]);
  for (const count of edgeCounts(wedges.get(7)).values()) assert.equal(count, 2);
});

test('majority vote splits triangles between parcels without opening either', () => {
  const wedges = buildRibbonWedges(square(3, 9));
  assert.deepEqual([...wedges.keys()].sort((a,b) => a-b), [3, 9]);
  for (const wedge of wedges.values()) {
    for (const count of edgeCounts(wedge).values()) assert.equal(count, 2);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test viewer/tissues/ribbon-wedges.test.js`
Expected: FAIL — cannot find module `./ribbon-wedges.js`.

- [ ] **Step 3: Implement**

```js
import { BufferAttribute, BufferGeometry } from 'three';

/** The most common label on a triangle; the lowest wins a tie, as the build does. */
function owner(labels, a, b, c) {
  if (labels[a] === labels[b] || labels[a] === labels[c]) return labels[a];
  if (labels[b] === labels[c]) return labels[b];
  return Math.min(labels[a], labels[b], labels[c]);
}

/**
 * One closed solid per parcel: its pial patch, its white patch reversed, and a
 * wall along the patch boundary.
 *
 * Pial and white share triangles and vertex indexing, so a patch taken from one
 * is the same patch on the other and the wall is a quad per boundary edge. A
 * boundary edge is a directed edge whose reverse no triangle of the parcel
 * carries; the wall must traverse it the other way round, or the solid's
 * winding — which is what the stencil counts — comes out inconsistent.
 */
export function buildRibbonWedges({ faces, pial, white, labels }) {
  const parcels = new Map();
  for (let i = 0; i < faces.length; i += 3) {
    const label = owner(labels, faces[i], faces[i+1], faces[i+2]);
    let triangles = parcels.get(label);
    if (!triangles) parcels.set(label, triangles = []);
    triangles.push(faces[i], faces[i+1], faces[i+2]);
  }
  const wedges = new Map();
  for (const [label, triangles] of parcels) wedges.set(label, wedge(triangles, pial, white));
  return wedges;
}

function wedge(triangles, pial, white) {
  const local = new Map();
  const patch = new Uint32Array(triangles.length);
  for (const [at, source] of triangles.entries()) {
    let index = local.get(source);
    if (index === undefined) local.set(source, index = local.size);
    patch[at] = index;
  }
  const count = local.size;
  const position = new Float32Array(count * 6);
  for (const [source, index] of local) {
    for (let axis = 0; axis < 3; axis++) {
      position[index * 3 + axis] = pial[source * 3 + axis];
      position[(count + index) * 3 + axis] = white[source * 3 + axis];
    }
  }
  const directed = new Set();
  for (let i = 0; i < patch.length; i += 3) {
    directed.add(patch[i] * count + patch[i+1]);
    directed.add(patch[i+1] * count + patch[i+2]);
    directed.add(patch[i+2] * count + patch[i]);
  }
  const index = [];
  for (let i = 0; i < patch.length; i += 3) {
    index.push(patch[i], patch[i+1], patch[i+2]);
    index.push(patch[i+2] + count, patch[i+1] + count, patch[i] + count);
    for (const [a, b] of [[patch[i], patch[i+1]], [patch[i+1], patch[i+2]], [patch[i+2], patch[i]]]) {
      if (directed.has(b * count + a)) continue;
      index.push(b, a, a + count, b, a + count, b + count);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setIndex(index);
  return geometry;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test viewer/tissues/ribbon-wedges.test.js`
Expected: PASS, 2/2.

- [ ] **Step 5: Commit**

```bash
git add viewer/tissues/ribbon-wedges.js viewer/tissues/ribbon-wedges.test.js
git commit -m "Build closed per-parcel ribbon solids from the native pial/white pair"
```

---

### Task 2: Publish per-vertex parcel labels

**Files:**
- Create: `brain_model/ribbons.py`
- Create: `tests/test_ribbons.py`
- Modify: `brain_model/build.py` (call in `main`), `brain_model/validate.py` (call in `main`)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `export_ribbon_labels(config, atlas, regions)` → manifest record `{file, sha256, vertex_counts: {left, right}, region_ids: [...], source}`; `validate_ribbon_labels(config, atlas, record)` → validation record. Labels are `uint16` indices into `region_ids`, left hemisphere then right.

- [ ] **Step 1: Write the failing test**

```python
import numpy as np
import pytest
from brain_model.ribbons import wedge_defects


def test_a_closed_patch_has_no_holes():
    faces = np.array([[0, 1, 2], [0, 2, 3]])
    labels = np.array([5, 5, 5, 5])
    assert wedge_defects(faces, labels) == {"holes": 0, "pinches": 0, "wedges": 1}


def test_split_labels_still_close_every_wedge():
    faces = np.array([[0, 1, 2], [0, 2, 3]])
    labels = np.array([5, 5, 9, 9])
    defects = wedge_defects(faces, labels)
    assert defects["holes"] == 0
    assert defects["wedges"] == 2
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_ribbons.py -v`
Expected: FAIL — `ModuleNotFoundError: brain_model.ribbons`.

- [ ] **Step 3: Implement `brain_model/ribbons.py`**

Write `majority(values)` (reuse the tie rule from `geometry._majority`), `wedge_defects(faces, labels)` returning `{"wedges", "holes", "pinches"}` by counting undirected edge multiplicity of each parcel's wedge, then `export_ribbon_labels` / `validate_ribbon_labels`. `validate_ribbon_labels` must assert `holes == 0` for every atlas and record `pinches`, mirroring how `validate_solid_envelopes` reports.

- [ ] **Step 4: Run to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_ribbons.py -v`
Expected: PASS, 2/2.

- [ ] **Step 5: Run the build and validation for real**

Run: `.venv/bin/python -m brain_model.build && .venv/bin/python -m brain_model.validate`
Expected: `ribbon-destrieux.labels` and `ribbon-hcp-mmp.labels` written; validation reports `holes: 0`, `pinches: 99` and `311`.

- [ ] **Step 6: Commit**

```bash
git add brain_model/ribbons.py tests/test_ribbons.py brain_model/build.py brain_model/validate.py public/models/
git commit -m "Publish per-vertex parcel labels for solid atlas cuts"
```

---

### Task 3: Plane-straddle culling in SolidSections

**Files:**
- Modify: `viewer/tissues/solid-sections.js`
- Test: `viewer/tissues/solid-sections.test.js`

**Interfaces:**
- Produces: `SolidSections.update` skips solids whose world bounding box does not straddle the plane. 362 wedges must not become 1,086 draw calls per frame.

- [ ] **Step 1: Write the failing test**

```js
test('a solid clear of the plane is not drawn', () => {
  const { sections } = fixture();
  sections.update(new Plane(new Vector3(0, 0, -1), 0.4), state);
  assert.equal(sections.solids[0].group.visible, false);
  sections.update(new Plane(new Vector3(0, 0, -1), 0), state);
  assert.equal(sections.solids[0].group.visible, true);
  sections.dispose();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test viewer/tissues/solid-sections.test.js`
Expected: FAIL — the solid stays visible when the plane misses it.

- [ ] **Step 3: Implement**

In `add`, store `source.geometry.boundingBox` transformed by `source.matrixWorld` as `bounds`. In `update`, `group.visible = visibleSolid(...) && straddles(bounds, plane)`, where `straddles` tests the box's signed-distance interval against zero using the plane normal's component-wise extent.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test viewer/tissues/solid-sections.test.js`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add viewer/tissues/solid-sections.js viewer/tissues/solid-sections.test.js
git commit -m "Draw only the solids the cutting plane crosses"
```

---

### Task 4: Colour solids for the active colour mode

**Files:**
- Modify: `viewer/tissues/solid-assets.js`
- Test: `viewer/tissues/solid-assets.test.js` (create)

**Interfaces:**
- Consumes: `buildRibbonWedges` (Task 1); the label file (Task 2).
- Produces: `solidColor(source, state, model, appearance)` → a CSS colour string. Tissue mode keeps today's `tissueColor` result; atlas mode returns the region's published colour; network mode returns `dominantNetwork`'s colour and falls back to the tissue colour when the region is in no network — matching `palette.js` exactly.

- [ ] **Step 1: Write the failing test** asserting all three modes against a fixture region, including the no-network fallback and the `!region_id` → `unlabelled` rule.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement**, reusing `dominantNetwork` from `../catalog/networks.js` so the cut and the surface cannot drift apart.
- [ ] **Step 4: Run to verify it passes.**
- [ ] **Step 5: Commit.**

---

### Task 5: Route atlas and network cuts to the solid path

**Files:**
- Modify: `viewer/tissues/gpu-sections.js:163-203`
- Test: `viewer/tissues/gpu-sections.test.js`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: `update` selects the solid path when the active cut atlas has a surface (`cut_atlases[].surface`), for every colour mode. NextBrain and any surfaceless atlas keep the label-volume plane.

- [ ] **Step 1: Write the failing test** — replace the existing `tissue mode uses solid boundaries...` test with one asserting solids are used for `tissue`, `atlas` and `network` on `destrieux`, and the volume plane for `nextbrain`.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement.** `tissueVariation` stays 0 under a published palette, as the existing comment requires.
- [ ] **Step 4: Run the whole suite:** `npm test` — expected 224+ pass, 0 fail.
- [ ] **Step 5: Commit.**

---

### Task 6: Match the cut's T1 contrast to the cut it replaces

**Files:**
- Modify: `viewer/tissues/solid-material.js:17`

`createSolidMaterial` feeds `intensity.surface_strength` (0.28) where the cut it replaced used `intensity.cut_strength` (0.5), so tissue cuts lost roughly half their T1 modulation when the solid path landed.

- [ ] **Step 1:** Change the uniform to `intensity.cut_strength`.
- [ ] **Step 2:** Screenshot a coronal cut in tissue mode before and after; confirm the contrast matches the pre-solid cut.
- [ ] **Step 3: Commit.**

---

### Task 7: Retire the documented voxel-step limitation

**Files:**
- Modify: `README.md:9`, `README.md:243`, `brain_model/build.py:421-429` (the `limitations` list)

- [ ] **Step 1:** Replace "Atlas colours and isolated parcels sample exact native 3D labels" and "Atlas-colour boundaries and isolated parcels retain the native voxel steps" with what is now true: atlas and network cut faces are bounded by the native surfaces; only surfaceless cut atlases (NextBrain) sample the 1 mm grid.
- [ ] **Step 2:** Remove `"Cortical regions are surface patches, not closed anatomical solids."` from `limitations` and add the majority-vote convention: a source triangle belongs to the parcel holding most of its vertices, so a cut boundary can differ from the surface's barycentric boundary by at most one triangle.
- [ ] **Step 3:** Rebuild the manifest so `limitations` matches: `.venv/bin/python -m brain_model.build && .venv/bin/python -m brain_model.validate`.
- [ ] **Step 4: Commit.**

---

## Self-review

- **Spec coverage:** ribbon geometry (1), published labels (2), draw-call budget (3), colour parity (4), routing (5), contrast regression (6), documentation (7). The one requirement deliberately *not* implemented is per-vertex network colour on a cut face; `palette.js` already documents that a cut shows a parcel's dominant network only, and Task 4 preserves that.
- **Known gap to raise, not silently fix:** `loadSolidSources` hardcodes the `aseg` detail level, so a solid cut shows aseg structures even when the viewer is set to NextBrain detail. That predates this plan. Flag it; do not widen scope here.
- **Type consistency:** `buildRibbonWedges` is the only name Task 4 imports from Task 1; `solidColor` is the only name Task 5 imports from Task 4.
