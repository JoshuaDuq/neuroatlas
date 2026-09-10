# NeuroAtlas viewer interface — design

Date: 2026-09-10
Status: approved for planning
Supersedes: nothing. Complements `docs/model-design.md`, which states that the
current viewer is a minimal inspection viewer and that the website interface is
still to be designed. This document is that interface.

## 1. Purpose

Turn the existing model inspector into a precise brain atlas for a general
audience, built and finished to a professional clinical standard. Approachable
for a non-expert arriving cold; never imprecise for someone who knows the
anatomy.

Two properties are non-negotiable, and every decision below defers to them:

1. **Nothing anatomical is invented.** Names, groupings and boundaries either
   come from the source data or are labelled explicitly as navigation aids.
2. **Nothing medically consequential is left untested.** Anatomical orientation
   in particular is a pure function with its own test.

## 2. Scope

In scope: the browser interface in `viewer/`, `index.html`, and the styles.

Out of scope, unchanged by this work:

- The Python pipeline (`brain_model/`), the GLB assets, `manifest.json`,
  `validation.json`, and the scientific contract in `docs/model-design.md`.
- `deliverables/` and `scripts/`.

Parked, deliberately undecided: `public/models/brain-anatomical.glb` is a
byte-equivalent merge of `cortex-destrieux.glb` + `structures.glb` (185 nodes,
1,116,406 triangles, identical). It is referenced by nothing and is 28 MB of the
81 MB deployed payload. It is left exactly as it is by this work. Section 13
records the options.

## 3. Decisions taken

| Question | Decision |
|---|---|
| Audience | Everyone, held to a professional/clinical standard of finish |
| Visual direction | Light primary, dark mode first-class, both from one token layer |
| Approach | Full interface redesign, not a restyle |
| HCP-MMP grouping | Hemisphere, then alphabetical sub-buckets. No invented anatomy |
| Atlas comparison view | Cut by YAGNI |
| Fuzzy subsequence search | Rejected; surprising matches erode trust in a precision tool |
| DOM component tests | Not worth a jsdom dependency; logic moves into pure modules instead |

## 4. Layout and information architecture

Three zones, one job each. No control ever appears in two places.

- **Left rail — Find.** Search plus a browsable tree.
- **Centre — See.** The viewport as hero.
- **Right rail — Know.** *Selected* above *Display*.

**Header.** Wordmark; atlas as a **segmented control**, not a dropdown, because
with two atlases a dropdown hides half the product; visible region count; theme
toggle; about.

**Left rail.**

- Search matches readable name, source name, area code, and curated aliases.
  Up/Down navigate, Enter selects, Escape clears.
- Regions that are currently hidden appear **dimmed, with the reason**
  ("hidden · cortex off"), never silently absent, in **both the search results
  and the browse tree**. Selecting one is a no-op until it is visible; the row
  offers the action that would reveal it. Silent absence is what makes a tool
  feel broken.
- Browse tree: cortex by lobe for Destrieux; hemisphere then alphabetical
  sub-buckets (A–C, D–F, …) for HCP-MMP; subcortical by the seven systems in
  section 6. Live counts on every group.

**Centre.**

- **Orientation markers** (L/R/A/P/S/I) at the canvas edges, tracking the
  camera. This is the DICOM convention and its absence is the single most
  conspicuously unprofessional thing about the current build.
- **Scale bar.** The model carries true anatomical scale in metres, so a live
  millimetre bar is both honest and cheap.
- View presets carry **word labels**; orientation markers are **thin edge
  glyphs**. Deliberately different weights so the `L` button never reads as the
  `L` marker.
- Hover tooltip follows the cursor.

**Right rail.**

- *Selected*: readable name, laterality, atlas, source label id, and the
  metrics already present in the manifest (`surface_area_mm2` for cortex,
  `segmentation_volume_mm3` for structures). Actions: Focus, Isolate.
- `Isolate` is a **toggle that releases itself**. Today the only exit is Reset,
  which also discards every other setting.
- *Display*: hemisphere, cortex visibility, cortex opacity, atlas colours.

**Responsive.** Below 1000px the rails become a bottom sheet with Find /
Selected / Display tabs. The viewport keeps the top 60%. Orientation markers
remain.

## 5. Module architecture

Governing rule: **pure logic is separated from Three.js, and Three.js is
separated from the DOM.** Everything medically consequential is a pure function.

```
viewer/
  main.js                  entry, error boundary                    (~20 lines)
  app.js                   composition only                         (~80 lines)

  model/
    brain-atlas.js         model and selection state

  catalog/                 pure: no Three.js, no DOM
    catalog.js             memoised searchable and grouped index
    visibility.js          the single visibility rule
    labels.js              region -> { name, code, group }
    destrieux-labels.js    curated 75-entry table, with aliases
    structure-groups.js    curated 7-system aseg table

  render/                  Three.js, no DOM chrome
    scene.js               renderer, lights, composer, loop, resize, context loss
    camera-views.js        view directions, framing, derived camera constraints
    picking.js             pointer -> region
    orientation.js         camera -> edge letters                   pure
    scale-bar.js           camera -> millimetres per pixel          pure

  state/
    session.js             view state and state assembly            pure
    url-state.js           encode/decode shareable state            pure
    theme.js               light/dark preference and persistence

  ui/                      DOM only, never touches the model directly
    navigator.js           left rail
    inspector.js           right rail, selected region
    display.js             right rail, view settings
    viewport-chrome.js     orientation, scale bar, view presets, hover, loading
    header.js              wordmark, atlas control, theme, about

  styles/
    tokens.css  base.css  layout.css  components.css
```

### 5.1 State model

One assembled object. **No derived state is ever stored.**

```js
{
  status, progress, error, notice,          // lifecycle

  atlas, hemisphere, cortexVisible,         // owned by BrainAtlas
  cortexOpacity, atlasColors,
  selectedRegion, isolatedRegion,

  view, query, expanded, theme,             // owned by session
}
```

`results`, `groups` and `visibleCount` are computed by `catalog.js` at render
time. Storing them is how a list comes to disagree with the model.

### 5.2 Data flow

```
UI event -> callback -> app command -> BrainAtlas mutation
                                              |
              'change' -> session.assemble() -> render(state)
                                              |-> every ui module .update(state)
                                              '-> url-state (debounced, replaceState)
```

One-way, no exceptions. UI modules are constructed with callbacks, receive
`update(state)`, and are idempotent.

### 5.3 Invariants

1. **One writer per channel.** The model writes materials, from source colour
   and display settings only. The view owns the outline pass. Selection and
   hover never enter the material path at all (section 7.3), so there is no
   second writer on `emissive` and no way for the two to disagree.
2. **One visibility rule.** `catalog/visibility.js` is consumed by both
   `brain-atlas.js` and the navigator. Two implementations would drift, and the
   drift would be invisible.
3. **Hover never enters the state loop.** It updates tooltip, outline and the
   dirty flag only. Routing per-rAF hover through `render(state)` would rebuild
   every panel 60 times a second.
4. **Panels early-out on a local dirty key**, so a slider tick rebuilds nothing:
   `${atlas}|${hemisphere}|${cortexVisible}|${isolatedRegion}|${query}`.
5. **Dependencies are injected across layers, never imported.** `picking.js`
   receives `{ domElement, camera, model }`; it does not import `scene.js`.
   That is the edge that would otherwise create a cycle.
6. **Uniform lifecycle.** Every module is a factory returning
   `{ element, update(state), dispose() }`. `app.js` disposes in reverse
   construction order.
7. **mesh:region is 1:1** (verified: 150 GLB meshes = 150 manifest regions).
   Asserted by test so a pipeline change cannot silently break it.

### 5.4 Dependency graph

```
catalog/*, state/*, render/orientation, render/scale-bar   (leaves: pure)
        |
        +--> model/brain-atlas --+
        +--> render/scene       |
        +--> render/picking     +--> app.js --> main.js
        '--> ui/*             --+
```

Acyclic.

### 5.5 Changes to `brain-atlas.js`

Three additions and one removal. No public method changes signature
incompatibly, and all existing tests stay green.

1. Thread an optional `onProgress` through `loadLayer` / `setAtlas` /
   `initialize`, so a 28 MB load can show determinate progress.
2. Split the `state` getter into cheap plain **`settings`** and **`state`**
   (`settings` plus derived). Required: the visibility rule cannot receive
   `state`, because `state` reads `visibleMeshCount` -> `visibleMeshes` ->
   `mesh.visible`, and would recurse through the value it is computing.
3. Consume `catalog/visibility.js` instead of its own inline predicate.
4. **Remove the selection emissive** at lines 184-185. Selection is signalled
   by the outline pass alone, so the material must not be altered to show it
   (section 7.3). No existing test asserts `emissive`, so this stays green.

### 5.6 Bootstrap order

`BrainAtlas.load(manifestUrl, atlasId)` already accepts an initial atlas.

```
decode URL -> load model with that atlas -> compose UI
```

Never load-then-switch: a shared HCP link would otherwise download 21 MB of
Destrieux for nothing.

## 6. Region catalog and labelling

`createCatalog(manifest)` builds the index once. Search is then cheap.

**Search ranking**, deterministic, tie-broken alphabetically then left before
right:

1. exact match on name or code
2. prefix match
3. word-boundary match (`post` matches `Postcentral`)
4. substring match

No subsequence matching. Typo tolerance is not worth surprising results in a
precision instrument. Abbreviations are handled as **data** instead: the curated
Destrieux table carries an `aliases` field, so `STG` finds *Superior temporal
gyrus* by record, not by guesswork.

**Labels.**

- **Destrieux (75 names):** curated table of readable names, lobe, and aliases.
  Verifiable against the shipped `data/FreeSurferColorLUT.txt`.
- **HCP-MMP (180 areas):** mechanical cleanup only. `L_V1_ROI` becomes `V1`.
  **No expansions are invented.** There is no name table in the repository, and
  an atlas advertising precision must not guess at one. The label layer is
  data-driven, so the published Glasser table drops in later with no refactor.
- **Subcortical (35 structures):** curated table of readable names and system.

**Subcortical grouping** (35 = 8 + 4 + 4 + 8 + 4 + 2 + 5, verified complete):

| System | Members |
|---|---|
| Basal ganglia | Caudate, Putamen, Pallidum, Accumbens (L/R) |
| Limbic | Hippocampus, Amygdala (L/R) |
| Diencephalon | Thalamus, VentralDC (L/R) |
| Ventricles and CSF | Lateral, Inferior lateral, 3rd, 4th, Choroid plexus |
| Cerebellum | Cortex, White matter (L/R) |
| Brainstem | Brain-Stem, Optic chiasm |
| Corpus callosum | Anterior, Mid-anterior, Central, Mid-posterior, Posterior |

Lobe and system groupings are **navigation aids**, and are labelled as such in
the interface, consistent with how `manifest.json` already documents
`boundary_convention` and `limitations`.

## 7. Visual system

### 7.0 Restraint rules

These are the constraints that keep the result an instrument rather than a
generic dashboard. They are stated first because everything below obeys them,
and because anything left unstated gets invented at implementation time.

1. **Colour carries meaning; chrome is achromatic.** The accent appears on
   exactly four things: the focus ring, the selected row, the active segment,
   and links. Nowhere else. Every other surface, border and label is neutral.
2. **The anatomy never receives a colour that is not source data.** See 7.3.
3. **Nothing floats.** No drop shadows anywhere. Depth is expressed by hairline
   rules and one-step surface value shifts.
4. **Words before icons.** No emoji, ever. Icons only where an icon is faster
   to read than its label.
5. **Nothing animates except the camera.** See the motion rule in 7.2.
6. **Every number carries a unit and a fixed precision.** See 7.5.
7. **No decorative element may be added that does not encode information.**
   Not badges, not pills, not gradients, not illustrated empty states.

### 7.1 Palette

The model is warm bone (`#D6CFC2`) and today's chrome is warm beige
(`#F4F3EF`). Everything shares one temperature, so nothing separates — this is
the cause of the flatness in the current build. The chrome becomes cool-neutral
so that **the anatomy is the only warm thing on screen.**

| Token | Light | Dark | Measured |
|---|---|---|---|
| `--text-primary` | `#1F2933` | `#E8ECF1` | 14.8:1 / 14.7:1 |
| `--text-secondary` | `#52606D` | `#A7B0BC` | 6.5:1 / 8.0:1 |
| `--text-tertiary` | `#616C7A` | `#8B95A3` | 4.9:1 / 5.8:1 |
| `--accent` | `#0B6E99` | `#4FB6E0` | 5.7:1 / 7.6:1 |
| `--border-control` | `#828D99` | `#5F6B7D` | 3.1:1 / 3.2:1 |
| `--border-subtle` | `#E4E7EB` | `#262C35` | decorative, exempt |
| `--surface-base` | `#FFFFFF` | `#161A20` | panels |
| `--surface-sunken` | `#F5F6F8` | `#10141A` | inputs, insets |
| `--surface-canvas` | `#EEF0F2` | `#0E1116` | viewport |

Ratios are measured against the harder of the two surfaces the token sits on.

`--border-subtle` and `--border-control` are separate tokens on purpose.
Dividers are decorative and exempt; an input's edge **is** its affordance and
owes 3:1. One token for both is how design systems quietly fail WCAG 1.4.11.

The focus ring reuses `--accent` and clears 3:1 on all three surfaces in both
themes (measured 4.96:1 to 8.19:1), so one ring token works everywhere.

### 7.2 Type, density, motion

**Families.** Interface text uses the platform grotesque:
`ui-sans-serif, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial,
sans-serif`. **Every measured quantity is set in mono**
(`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`), which is both an
instrument convention and the reason columns of figures align.

**Scale.** Four sizes, in rem so OS font scaling works, nothing below 12px:

| Size | Weight | Use |
|---|---|---|
| 12px | 500 | section labels, orientation markers, provenance |
| 13px | 400 | tree rows, control labels, metadata |
| 14px | 400 | body text, search input |
| 17px | 600 | selected region name |

Three weights only: 400, 500, 600. No 300, no 700. Section labels are
**sentence case above a hairline rule, never all-caps** — repeated all-caps
micro-labels are a template tic, and four of them on one screen is noise.
The 17px title carries `-0.01em` tracking; nothing else is tracked.

**Density.** A 4px baseline governs everything:

| Element | Size |
|---|---|
| Baseline unit | 4px |
| Tree and list row | 28px |
| Control height | 32px |
| Panel padding | 16px |
| Rail width | 320px each |
| Header | 52px |
| Footer | 28px |

**Radius.** 2px on controls, 3px on panels. Nothing rounder.
**Elevation.** None. No shadows anywhere, including popovers; a popover is a
`--surface-base` panel with a `--border-control` hairline.
**Motion.** Interface state changes are **instant**. The only animation in the
product is the camera view transition, 240ms `cubic-bezier(.4,0,.2,1)`, which
earns its place because spatial continuity genuinely aids anatomical
orientation. It jump-cuts under `prefers-reduced-motion`. No slide, scale or
bounce exists anywhere.

**Icons.** One 16px stroke set at 1.5px, used for exactly five things: search
affordance, disclosure triangle, close, external link, theme. Every other
control is a word.

### 7.3 What the anatomy may be coloured

**Rule: the 3D model displays source data and user display settings, and
nothing else.** No interface colour is ever applied to it.

This is a correctness requirement, not an aesthetic preference. With atlas
colours enabled the region's colour **is** the datum — it encodes atlas
identity from the FreeSurfer lookup table. Tinting the selected region with an
accent emissive would alter the value the user is reading. An instrument does
not modify the measurement in order to indicate selection.

Selection and hover are therefore signalled **entirely by the outline pass**,
which composites over the render without touching a material:

| | Material | Outline |
|---|---|---|
| Hover | unchanged | 1px, halo tone only |
| Selected | unchanged | 2px, two-tone core + halo |

This also simplifies invariant 1 in section 5.3: the model writes materials
from source colour and display settings alone, and selection never enters the
material path.

**Why two-tone, and why it is not a preference.** With atlas colours enabled
the cortex takes 512 source colours spanning the gamut. Measured against all of
them, no single outline colour survives: near-black reaches only 1.42:1 against
`#5F0044`, near-white 1.01:1 against `#E1FDEA`, and the accent 1.00:1 against
`#6B6757`. Selection would be invisible on those regions.

A two-tone outline of `#0B1114` core plus `#F2F6FA` halo measures **4.19:1
worst case across all 512 colours** — 440 carried by the dark tone, 72 by the
light. The floor across the entire greyscale ramp is also 4.19:1, so the
guarantee is structural rather than a property of these particular colours: a
colour cannot be close to both black and white.

Because the outline is achromatic in both themes, it behaves identically
whether atlas colours are on or off. There is no mode switch to get wrong.

### 7.4 Scene tokens

CSS remains the single source of truth. `scene.js` reads these via
`getComputedStyle(document.documentElement)` on theme change, so a colour is
changed in exactly one place.

```
--scene-background     #EEF0F2 / #0E1116
--scene-cortex         #D6CFC2 / #DCD5C8
--scene-structure      #C7BEB0 / #CFC6B8
--scene-nonregion      #B0ACA5 / #6E6A63
--scene-outline-core   #0B1114 (both themes)
--scene-outline-halo   #F2F6FA (both themes)
--scene-outline-hidden #6F7A86 / #46505E
--scene-exposure       0.98    / 1.12
```

`--accent` is deliberately absent: no interface colour reaches the scene.
`hiddenEdgeColor` must be a per-theme token; the current `0x000000` is
invisible against a dark background.

### 7.5 Quantities

Measured values are the reason the product exists, so their rendering is
specified rather than left to the implementer.

- **Four significant figures**, always. `3214 mm²`, not `3214.153 mm²`.
- **Mono, tabular**, so columns align and digits do not jitter on update.
- A **thin space** separates value and unit; the unit uses the real superscript
  character (`mm²`, `mm³`), never `mm2`.
- **No thousands separator** below five digits; a thin space above.
- Precision is **uniform within a column**. Mixed precision reads as an error.
- A quantity that is absent renders as `—`, never as `0` or an empty cell.

**Scale bar.** The bar snaps to the nearest 1–2–5 sequence value
(1, 2, 5, 10, 20, 50, 100 mm) that keeps its drawn length between 60 and 140px.
An arbitrary value such as `37 mm` is the mark of a scale bar nobody designed.

### 7.6 Viewport overlays

Orientation markers, scale bar and hover label sit over rendered geometry whose
luminance runs from near-black crevices to near-white speculars, so none of the
UI ratios above apply to them by default.

Overlays therefore render on `--surface-base` chips at **0.90 alpha with a
backdrop blur**. Measured against both extremes the model can present:
**11.0:1 to 15.1:1** in both themes. Chips carry a `--border-subtle` hairline
and no shadow.

## 8. States

1. **Loading.** Determinate, from `GLTFLoader.onProgress`:
   `Loading anatomy · 12.4 / 27.9 MB`. A static "Loading…" over 28 MB reads as
   frozen.
2. **Atlas switching.** Spinner on the target segment; the rest of the UI stays
   live; **the control reverts on failure.** Today a failure leaves a disabled
   fieldset with no way forward.
3. **No search results.** Includes the exit:
   *"No match for 'amyg'. 2 matches are hidden — cortex is off."* with an inline
   **Show cortex** action.
4. **No selection.** The inspector guides rather than sitting empty.
5. **Error.** Real message, working Retry, provenance link still reachable.
6. **Context lost.** `webglcontextlost` is intercepted, an overlay explains, and
   `webglcontextrestored` rebuilds the passes. Currently unhandled: a blank
   canvas and no explanation.

Selection cleared as a side effect (hiding the cortex drops the selected region)
raises a `notice`: *"Selection cleared — cortex hidden."*

A notice renders as an **inline status line at the foot of the rail it
concerns**, in `--text-secondary`, and is cleared by the user's next action.
It is never a floating toast and never dismisses on a timer: a timed message
is one the user can miss, which in an instrument is a defect.

## 9. Accessibility

- **A polite live region announces every selection**: "Selected: Precentral
  gyrus, left hemisphere." A screen-reader user cannot see the 3D, so the text
  state **is** the product for them. This is the highest-value item here.
- Search is a `combobox` with `aria-expanded` and `aria-activedescendant`; the
  browse tree is a `tree` with WAI-ARIA arrow-key navigation.
- **Arrow keys move focus; Enter selects.** Selecting on focus would announce
  once per keypress while arrowing through 360 items.
- **Global shortcuts are suppressed while a text input holds focus**, otherwise
  `3` cannot be typed into search — and `3b` is a real HCP area.
- Shortcuts: `/` focuses search; `Escape` clears the search query when search
  holds focus, and otherwise clears the selection; `1`–`6` select the Left,
  Right, Anterior, Posterior, Superior and Inferior views respectively, and `0`
  returns to the default oblique view; `C` toggles cortex; `H` cycles
  hemisphere; `?` opens the shortcut sheet.
- **Colour is never the only signal.** Hemisphere is the word "Left".
- Orientation markers are real text, so they scale and are read aloud.
- `prefers-reduced-motion` jump-cuts camera transitions, not only CSS.
- `prefers-contrast: more` promotes tertiary text to secondary and control
  borders to primary.
- `forced-colors: active` adapts the chrome through system keywords; the canvas
  cannot adapt and is accompanied by its text state.
- Focus is never removed, only restyled.

## 10. Defects in existing code, fixed by this work

1. **`Focus` permanently degrades depth precision.** `main.js:162` sets
   `minDistance = 0.001` and `camera.near = 0.00005` and nothing restores them.
   After one click the near plane stays at 50 µm against `far = 10` — a
   200,000:1 depth ratio, and z-fighting territory on the full-brain view.
   **Fix:** camera constraints are derived from the bounds being framed, inside
   `camera-views.js`, as a pure computation with a test.
2. **The opacity slider rebuilds 397 `<option>` elements per pointer tick**
   (`input` -> `setCortexOpacity` -> `update()` -> `change` ->
   `replaceChildren`), while also touching 397 materials.
   **Fix:** invariant 4, the per-panel dirty key.
3. **No WebGL context-loss handling at all.** **Fix:** section 8, item 6.
4. **Selections are dropped silently** (`brain-atlas.js:195`). **Fix:** the
   `notice` in section 8.

## 11. Testing

`node --test`, no new dependencies. The `test` glob becomes
`viewer/**/*.test.js`.

| Suite | Guards |
|---|---|
| `orientation.test.js` | six canonical views plus oblique produce the correct edge letters |
| `labels.test.js` | **every region in the real manifest resolves to a name and a group**, no silent fallthrough |
| `catalog.test.js` | search ranking tiers, tie-breaks, group counts, hidden-region reasons |
| `visibility.test.js` | the shared rule, including that `brain-atlas` and the navigator agree |
| `camera-views.test.js` | derived near/far/minDistance restore correctly after Focus |
| `scale-bar.test.js` | known camera distance produces known millimetres |
| `url-state.test.js` | round-trip, and malformed hashes rejected safely |
| `session.test.js` | state assembly, notices, and shortcut suppression rules |
| existing four suites | kept green; import paths updated |

`labels.test.js` is the one that keeps the atlas honest: it fails the build if
the data ever grows a region the interface cannot name.

**Accepted trade-off.** `node --test` has no DOM and jsdom is not worth adding
for this. UI modules therefore stay deliberately thin, with all logic pushed
into the pure modules above, and the panels are verified in a real browser.

## 12. Risks

| Risk | Response |
|---|---|
| Two `OutlinePass` instances plus `GTAOPass` may be too costly on integrated GPUs | Measure in the manner of `scripts/benchmark-picking.mjs`. Fallback: one pass with a custom two-tone edge shader |
| A 360-item tree may be slow to render | Measure. Fallback: lazy-render group children on expand |
| `backdrop-filter` unsupported on older browsers | Degrades to flat 0.90 alpha, which is already the measured case |

## 13. Parked

`public/models/brain-anatomical.glb`, 28 MB, unreferenced, 35% of the deployed
payload. Options, to be decided separately: ship it as a single-file download
(adds a `downloads` entry with checksum to `brain_model/build.py`); delete it;
or leave it. This work changes nothing about it.
