# Engine E4b rules: the brain atlas model

Scope: chunk E4b (#28). This covers the model that loads the published anatomy and decides what is drawn: the manifest checks, the layers (cortical atlases, detail levels, the native envelopes, the spinal cord), the display settings and their events, the surface colours and the paint, selection, isolation and dissection, the exposed white matter, picking and centroids, the ribbon and glass solids the model holds, and download progress. Legacy sources: `viewer/model/brain-atlas.js`, `viewer/model/progress.js`, the legacy tests `viewer/model/{brain-atlas,assets,spinal-cord,progress}.test.js`, and the model's use of `viewer/tissues/glass-solids.js`. New code: `web/src/lib/engine/model/brain-atlas.ts`, `progress.ts`. Deviations: `e4b-joined-download-progress.md`, `e4b-load-hidden-regions-isolation.md`, `e4b-state-before-load.md`. The shared visibility rule (`core/catalog/visibility.ts`) is CAT-17 to CAT-21 (`core-catalogs.md`) and the dissection stack (`core/state/dissection.ts`) STATE-57 to STATE-59 (`core-state.md`); the cut that drives the model is in `engine-e4a.md`; the material shaders and the border-feather palette writer are in `engine-e1.md`.

Conventions: "the fixture" is the synthetic model of the legacy unit tests (atlases `a` with `a-left`, `a-right` and the medial wall `a-wall`, atlas `b` with `b-left`, the detail level `aseg` with `stem`, the cut-only region `n-left`; 1 cm boxes 3 cm apart on x; `config/model.yaml` appearance). "CDMD" is the published model `public/models/cdmd/`. World coordinates are metres (x = R, y = S, z = −A); centroids are surface RAS millimetres. Colours are sRGB hex.

## Opening the model

### ATLAS-01 · A stale or malformed manifest is refused, naming what is missing
- **Rule:** The model refuses a manifest that is not schema 1 or lacks atlases, regions, detail levels, the appearance, the native envelopes, the glass and see-through opacities its sidecars need, or the anatomy's subject, display name and `individual` flag. The message lists every missing field and says that a stale cached copy causes this. Region metadata must be complete and unique.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:70-103`
- **Expected:** No `detail_levels` → Error matching `/detail_levels/` and `/cache/i` ("… A stale cached copy will do this; reload ignoring the cache."). `atlases: []` → `/atlases/`. `schema_version: 2` → `/schema_version 1/`. `anatomy: { id: 'bert' }` or no `individual` → `/anatomy/`. With `functional_regions`, `glass_opacity` must lie in (0, 1); with `neuropsych_domains`, `see_through_opacity` must. A region with a duplicate id, no label, a hemisphere other than left/right/midline or an unknown kind → "Invalid or duplicate region metadata: <id>".
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R); the opacity and region-metadata checks are uncovered

### ATLAS-02 · Published sidecars must fit the model's regions
- **Rule:** The CAB-NP partition, the functional divisions and the neuropsychological domains are checked against the model's regions when the model is built. A partition that assigns a region of another atlas is refused.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:158-180`
- **Expected:** CAB-NP `{ atlas: 'a', regions: { 'b-left': 'Default' } }` → Error "Invalid CAB-NP assignment: b-left". The CDMD sidecars (`cab-np.json`, `functional-regions.json`, `neuropsych-domains.json`, `neurosynth-terms.json`) are accepted.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R, CAB-NP); `parity/E4b.test.ts` (D, CDMD sidecars accepted and read the same). The validators' own rules belong to the core catalogue area.

### ATLAS-03 · The model opens the first atlas and the learning overview by default
- **Rule:** With no choice given, the model opens the manifest's first atlas and the grouped learning overview when it is published, otherwise the first detail level. Before anything has loaded, the settings already name those two, and nothing is drawn.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:180,212-243`; deviation `e4b-state-before-load.md`
- **Expected:** Fixture, before `initialize`: `settings.atlas === 'a'`, `settings.detail === 'aseg'`, `visibleMeshes.length === 0`. `initialize()` → atlas `a`, detail `aseg`. CDMD `initialize('destrieux')` → `state.detail === 'learning'`.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R); `src/lib/engine/model/assets.test.ts` (S, CDMD learning)

### ATLAS-04 · An unknown atlas or detail level is refused before anything downloads
- **Rule:** Opening or switching to an atlas or detail level the manifest does not publish fails with an error the app can tell from a failed download, and starts no download.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:221-243,431-465`
- **Expected:** `BrainAtlas.load(url, 'missing')` → Error "Unknown atlas: missing" with `code === 'unknown-layer'`; atlas `null` → "Unknown atlas: null"; `{ detail: 'missing' }` → "Unknown detail level: missing"; `{ detail: null }` → "Unknown detail level: null". No layer file is fetched. `setAtlas('missing')` and `setDetail('missing')` reject the same way and change nothing.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R, `load`); `parity/E4b.test.ts` (D, `setAtlas`/`setDetail` in the replay)

### ATLAS-05 · The first frame downloads one atlas and one detail level together, and nothing else
- **Rule:** Opening downloads the chosen cortical atlas and the chosen detail level in parallel. The envelopes, the other atlas, the other detail levels and the cord wait until something needs them.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:221-243`
- **Expected:** Fixture `initialize('a')` with gated downloads: both downloads have started before either finishes; files fetched `['a.glb', 'structures.glb']`. `initialize('a', { detail: 'aseg' })` with `nextbrain` also published does not fetch `nextbrain.glb`. Two `initialize('a')` at once fetch each file once.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R)

### ATLAS-06 · Published meshes must match their regions and keep their geometry
- **Rule:** Every mesh of a layer must name a manifest region and agree with it on label, hemisphere, atlas, source label and kind. Its material must be the standard glTF one, cortex must carry its morphometry fields, and a layer must hold at least one mesh. The model never moves, scales or reorders the source geometry.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:364-430`
- **Expected:** A mesh with an unknown `region_id` → "Mesh has no manifest region: <name>"; a field mismatch → "Mesh metadata mismatch: <id>.<field>"; a cortex mesh without `_sulc` → rejects `/_sulc/`; an empty layer → "Empty brain model layer: <id>". After loading, positions and indices equal the file's byte for byte, every mesh has position [0, 0, 0] and scale [1, 1, 1], every mesh has normals, and on cortex and non-region meshes `_sulc`, `_concavity` and `_t1` have one finite value per vertex. A failed layer releases its geometry and materials.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R, `_sulc`, unchanged positions and indices); `src/lib/engine/model/assets.test.ts` (S, CDMD); the mismatch, unknown-region and empty-layer errors are uncovered

### ATLAS-07 · The published CDMD model has the counts its manifest declares
- **Rule:** Each published layer loads exactly the meshes its manifest entry counts, so every region the reader can find is drawn.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/model/assets.test.js:9-60`; `public/models/cdmd/manifest.json`
- **Expected:** `initialize('destrieux')` → 255 visible meshes (148 Destrieux parcels + 2 non-region surfaces + 105 learning structures). `setAtlas('hcp-mmp')` → 360 cortex meshes; destrieux → 148. Cortex hidden → 105. Cord shown → 255 + 58. `aseg` 32 meshes, `nextbrain` 292, `tissue-envelopes.glb` 4 (left and right pial and white).
- **Covered by:** `src/lib/engine/model/assets.test.ts` (S, all but the aseg, nextbrain and envelope counts); `parity/E4b.test.ts` (D)

### ATLAS-08 · Downloads share one progress bar
- **Rule:** The downloads one action starts are folded into one progress figure: the bytes loaded and the bytes expected, summed over the downloads that have announced a size. A download that has not yet announced one is left out, so the bar does not sit at zero.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/progress.js:7-27`; `viewer/model/brain-atlas.js:221-243,291-317`
- **Expected:** Parts a, b: a 10/20 → {10, 20}; b 5/20 → {15, 40}; a 20/20 → {25, 40}. A part reporting 0/0 emits nothing; then 4/8 → {4, 8}. An event missing `loaded` or `total` counts it as 0. Fixture `initialize('a', onProgress)` (each file reports 10/20 then 20/20) ends at {40, 40} and passes through {10, 20}.
- **Covered by:** `src/lib/engine/model/progress.test.ts` (R); `src/lib/engine/model/brain-atlas.test.ts` (R); `parity/E4b.test.ts` (D, 50 seeded trials)

### ATLAS-09 · A caller who joins a download under way hears its progress
- **Rule:** When a second caller asks for a layer, the envelopes or the cord while that download is already running, it receives the progress events from then on, like the caller that started it.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:245,291,364`; deviation `e4b-joined-download-progress.md`
- **Expected:** Prefetch `loadLayer('b', 'b.glb')` with no listener, then `setAtlas('b', onProgress)` before it finishes → `onProgress` hears loaded [10, 20] and the atlas is `b`. Two `ensureEnvelopes(listener)` calls at once → both listeners hear the same non-empty sequence.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R); `parity/E4b.test.ts` (D, also asserts the legacy bug `[]`)

### ATLAS-10 · A layer is downloaded once and kept
- **Rule:** A layer already loaded is shown again from memory. A layer still downloading is shared with the next caller. A failed download is forgotten so the next request tries again.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:364-430`
- **Expected:** Fixture `initialize('a')`, `setAtlas('b')`, `setAtlas('a')` → files fetched `['a.glb', 'b.glb', 'structures.glb']`, each once. A layer whose first download throws loads on the next request.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R); the layer retry is uncovered (the envelope and cord retries are ATLAS-41, ATLAS-48)

### ATLAS-11 · Loading from the published manifest reads its sidecars and cleans up on failure
- **Rule:** `BrainAtlas.load` reads the manifest, then the CAB-NP, functional, domain and term sidecars it names (relative to the manifest), then opens the requested atlas with progress. If opening fails, the half-built model is disposed and the error surfaces.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:130-156`
- **Expected:** CDMD `load('…/models/cdmd/manifest.json', 'hcp-mmp', { onProgress })` → `settings.atlas === 'hcp-mmp'`, `settings.detail === 'learning'`; `cabNp`, `functionalRegions` and `domains` equal the published JSON; the last progress event has `loaded === total > 0`. A rejected open (ATLAS-04) leaves `disposed === true`.
- **Covered by:** `parity/E4b.test.ts` (D); `src/lib/engine/model/brain-atlas.test.ts` (R, rejection only); the dispose-on-failure part is uncovered

## What is drawn

### ATLAS-12 · One atlas and one detail level are drawn at a time, and shared anatomy stays
- **Rule:** Exactly one cortical atlas and one detail level are visible, plus the cord layer once loaded. Switching atlas swaps the cortex and keeps the internal anatomy.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:431-465,519-530`
- **Expected:** Fixture `initialize('a')` → 4 visible meshes (a-left, a-right, a-wall, stem). `setAtlas('b')` → 2 (b-left, stem). Back on `a` → 2 visible layer groups.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R); `parity/E4b.test.ts` (D)

### ATLAS-13 · Changing the atlas drops the selection and the isolation, and colours that need the old atlas
- **Rule:** A new atlas clears the selection and the isolation. CAB-NP and functional colours belong to one atlas, so leaving it returns to atlas colours.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:431-450`
- **Expected:** Fixture `select('a-right')`, `isolate()`, `setAtlas('b')` → `selectedRegion === null`, `isolatedRegion === null`, one `selectionchange` with `null`. CAB-NP on `a`, then `setAtlas('b')` → `surfaceColor === 'atlas'`; the same for `functional`.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R, colours); `parity/E4b.test.ts` (D, selection and isolation); the selection and isolation part is uncovered by rule tests

### ATLAS-14 · The latest atlas or detail request wins, and the two do not cancel each other
- **Rule:** When several atlas changes are in flight, the last one asked for is the one shown, whatever order the downloads finish in. Likewise for detail levels. An atlas change and a detail change are independent.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:431-465`
- **Expected:** `setAtlas('b')` (gated) then `setDetail('aseg')`, then release → atlas `b`, detail `aseg`. `setAtlas('b')` (gated) then `setAtlas('a')`, then release → atlas `a`.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R, independence); the last-wins part is uncovered

### ATLAS-15 · Changing the detail level clears the internal-system filter and the isolation
- **Rule:** A new detail level drops the internal-system filter and its constituents, and the isolation. A selection that belongs to the level being left is dropped.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:452-465`
- **Expected:** CDMD on `learning`, `setInternalSystem('Basal ganglia')`, select and isolate `learning:left:caudate`, `setDetail('aseg')` → `internalSystem === null`, `internalConstituents.size === 0`, `isolatedRegion === null`, `selectedRegion === null`.
- **Covered by:** `parity/E4b.test.ts` (D); uncovered by rule tests

### ATLAS-16 · The hemisphere filter
- **Rule:** The reader can show both hemispheres, the left or the right. Midline structures stay. A change clears the isolation and drops a selection that is no longer drawn.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:745-752`
- **Expected:** Fixture with `a-left` selected, `setHemisphere('right')` → visible ['a-right', 'stem'], `selectedRegion === null`, `selectionchange` with `null`. `setHemisphere('up')` → Error "Invalid hemisphere: up".
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R); `parity/E4b.test.ts` (D)

### ATLAS-17 · Cortex and internal anatomy can each be shown or hidden
- **Rule:** The cortex and the internal anatomy each have an on/off switch that takes only a boolean. Either change clears the isolation.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:754-775`
- **Expected:** Fixture `setInternalVisible(false)` → `visibleMeshCount` 4 → 3; back to 4. `setCortexVisible(false)` → visible ['stem']. `setCortexVisible('yes')` → TypeError "Cortex visibility must be boolean."; `setInternalVisible(0)` → TypeError "Internal anatomy visibility must be boolean.".
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R, visibility); `parity/E4b.test.ts` (D, type errors and isolation)

### ATLAS-18 · Cortex opacity makes the cortex see-through and keeps the isolation
- **Rule:** Cortex opacity runs from 0 to 1 and applies to cortex, the medial wall and exposed white matter, never to internal structures. A see-through surface is drawn transparent without depth writes. Changing it keeps the isolation and the selection.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:761-767,576-586`
- **Expected:** Fixture `setCortexOpacity(0.3)` → a-right `opacity` 0.3, `transparent === true`, `depthWrite === false`; `stem` opacity 1. Exposed white matter at 0.6 → 0.6. `setCortexOpacity(1.1)`, `-0.1` or `NaN` → RangeError "Cortex opacity must be between 0 and 1.". With `a-right` isolated, `setCortexOpacity(0.5)` keeps it isolated.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R, opacity and range); `parity/E4b.test.ts` (D, transparency flags and isolation)

### ATLAS-19 · Cut-only regions follow the cut
- **Rule:** A region that exists only on the cut (it has no mesh) can be selected while the cut is open on its atlas, and it stays selected across redraws. It still obeys the hemisphere filter. When the cut closes or shows another atlas, it is dropped and can no longer be selected. Reporting the same cut state again changes nothing.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:466-479,714-730`
- **Expected:** Fixture `setCutState({ atlas: 'n', active: true })`, `select('n-left')` → selected; `update()` → still selected, no `selectionchange` with null. `setHemisphere('right')` → selection null, and `select('n-left')` → /not visible/. `setCutState({ atlas: 'n', active: false })` → selection null, `select('n-left')` → /not visible/. The same `setCutState` twice → one `change` event.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R); `parity/E4b.test.ts` (D, CDMD cut atlases); the repeated-state no-op is uncovered

### ATLAS-20 · The internal-system filter
- **Rule:** The reader can narrow the internal anatomy to one named system of the current detail level, and the learning groups of that system bring their constituents. An unknown system is an error. A change clears the isolation and drops a selection outside the system.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:731-744`
- **Expected:** CDMD, cortex hidden, `setInternalSystem('Basal ganglia')` → 14 visible meshes, all with `system_names.en === 'Basal ganglia'`. `setInternalSystem('Imaginary system')` → Error "Unknown internal anatomy system: Imaginary system". With `learning:left:caudate` isolated, `setInternalSystem('Brainstem')` → selection and isolation null. `reset()` → `internalSystem === null`.
- **Covered by:** `src/lib/engine/model/assets.test.ts` (S, "> 5" meshes rather than 14); `src/lib/engine/model/spinal-cord.test.ts` (R, 'Spinal cord'); `parity/E4b.test.ts` (D)

### ATLAS-21 · Every mesh is drawn exactly when the shared visibility rule says so
- **Rule:** Whatever the settings, a mesh is drawn if and only if the shared visibility rule (`visibilityOf`) says its region is visible, so the list, the search and the 3D view agree.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:519-545`
- **Expected:** For every mesh of every layer and every reachable combination of atlas, detail, hemisphere, cortex/internal/cord visibility, internal system, cut, isolation and hidden set: `mesh.visible && layer.scene.visible === visibilityOf(region, settings).visible`.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R, one state: left hemisphere); `parity/E4b.test.ts` (D, 300 seeded commands); the other states are uncovered by rule tests (a seeded property sweep would keep them)

### ATLAS-22 · An invalid display command is refused and changes nothing
- **Rule:** Each display command checks its argument first. A refused command throws (an asynchronous one rejects) and leaves the settings, the materials and the events as they were.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:695-850`
- **Expected:** `setSurfaceColor('bogus')` → TypeError "Unknown surface colour: bogus". `setFunctionalLevel('lobes')` → TypeError "Unknown functional level: lobes". `setPaint({ id: 5, colors: new Map() })` or `{ id: 'x', colors: {} }` → TypeError "A paint needs an id and a Map of region colours.". `setClippingPlanes([plane with normal (2, 0, 0)])` → Error "Clipping requires normalized, finite Three.js planes.". `setSpinalCordVisible('yes')` rejects with TypeError "Spinal cord visibility must be boolean.". `isolate()` with nothing selected → "Select a region before isolating.". After each, `settings`, every material and the event log are unchanged.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R, functional level and paint messages); `parity/E4b.test.ts` (D, every refusal in the replay); "changes nothing" and the other messages are uncovered by rule tests

### ATLAS-23 · The model reports its whole display state, and every change
- **Rule:** The settings are the whole display state as a plain value; the state adds the selected region and the number of drawn meshes. Every redraw fires `change` with the state. `selectionchange` fires on every selection, with the region or `null`, and also when a redraw drops the selection.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:480-508,597-603,719-730`
- **Expected:** Fixture after `initialize('a')`: `settings` equals `{ atlas: 'a', detail: 'aseg', internalSystem: null, internalConstituents: Set{}, cutAtlas: null, cutActive: false, hemisphere: 'both', cortexVisible: true, cortexOpacity: 1, internalVisible: true, spinalCordVisible: false, surfaceColor: 'atlas', functionalLevel: 'named', paint: null, isolatedRegion: null, hiddenRegions: Set{}, dissectionCanUndo: false }`; `state.visibleMeshCount === 4`. `select('a-left')` → events `['change', 'selectionchange:a-left']`; the event's region has `source_label_id === 1`.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R, settings and selection payload; I, the "does not walk the scene" claim it cannot observe); `parity/E4b.test.ts` (D, event sequence)

## Colour

### ATLAS-24 · Surface colours and what each one needs
- **Rule:** The surface can be coloured as tissue, MRI, atlas, network, CAB-NP or functional divisions. A colour is refused when what it draws is missing: the scan for MRI, the network layer for network, the partition and its atlas for CAB-NP, the divisions, their atlas and the glass solids for functional.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:68,789-813`
- **Expected:** `SURFACE_COLORS` = ['tissue', 'mri', 'atlas', 'network', 'cab-np', 'functional']. Errors: "MRI must load before selecting MRI appearance."; "This model carries no network layer."; "This model carries no CAB-NP partition."; on atlas `b` "CAB-NP colours a areas; show that atlas first."; "This model carries no functional divisions."; "Functional divisions colour a areas; show that atlas first."; "Glass-brain solids must load before selecting functional divisions.". `'domains'` → "Unknown surface colour: domains".
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R, all but the network error); `parity/E4b.test.ts` (D)

### ATLAS-25 · Atlas colour shows the published colours; tissue colour shows tissue with its T1 relief
- **Rule:** Under atlas colour each parcel keeps its published colour and the medial wall is drawn in the unlabelled tissue colour. Under tissue colour every region takes its tissue colour, and only then does the cortex carry its T1 brightness variation, which would distort a published palette.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:543-575`
- **Expected:** Fixture atlas colour: a-right material colour 0xffffff (the published colour is per vertex), `tissueVariation` 0. Tissue: colour 0xc4a897 (`appearance.tissue.cortex`), `tissueVariation` 0.28 (`intensity.surface_strength`). Every other colour: `tissueVariation` 0. Atlas → tissue → atlas leaves positions, indices, picking, selection and isolation unchanged.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R)

### ATLAS-26 · Network colour draws the published network map
- **Rule:** Under network colour the cortex shows its per-vertex network colours, and where no network reaches (the medial wall) the tissue colour shows. A paint turns the network colours off.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:548-552,571-575`
- **Expected:** CDMD destrieux, `setSurfaceColor('network')` → `networkMix` 1 on every cortex material that carries network colours, material colour the tissue colour, `tissueVariation` 0. Any other colour, or a paint → `networkMix` 0.
- **Covered by:** `parity/E4b.test.ts` (D); uncovered by rule tests (the fixture has no network layer)

### ATLAS-27 · CAB-NP colour paints each area whole in its network's colour
- **Rule:** Under CAB-NP colour each area of the partition's atlas takes its network's published sRGB colour; an area in no network keeps its tissue colour.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:535,565-568`
- **Expected:** Fixture partition {a-left: Default [255, 0, 0], a-right: Visual1 [0, 0, 255]} → a-left 0xff0000, a-right 0x0000ff, a-wall 0xc4a897 (`tissue.unlabelled`), `tissueVariation` 0 on every mesh.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R)

### ATLAS-28 · Functional divisions are solid in their colour, the rest of the cortex is glass
- **Rule:** Under functional colour each area in a division of the chosen level takes the division's colour and is opaque. The rest of the cortex, the medial wall included, is glass at the published glass opacity, scaled by the cortex opacity.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:536-539,569-580,814-823`
- **Expected:** Fixture named level: a-left 0xff0000, opacity 1; a-right and a-wall opacity 0.1 (`glass_opacity`), transparent, colour 0xc4a897, `tissueVariation` 0. Sections level: a-right 0x00ff00 opacity 1, a-wall 0.1. `setCortexOpacity(0.5)` → a-right 0.5, a-wall 0.05.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R); `parity/E4b.test.ts` (D, CDMD hcp-mmp)

### ATLAS-29 · A glass solid closes only an opaque named division, while its patch is drawn
- **Rule:** Behind the glass, a named division's ribbon solid closes it so it reads as a volume. It shows only under functional colour at the named level with the cortex fully opaque, and only while the division's own patch is drawn. Otherwise the solids are hidden.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:590-596`
- **Expected:** Fixture functional/named: solid a-left visible, colour 0xff0000; a-right (no named division) hidden. Hemisphere right → a-left hidden. Opacity 0.6 → hidden. Sections → hidden. Atlas colour → solids group hidden.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R)

### ATLAS-30 · A paint colours its regions over any surface colour
- **Rule:** A paint (a panel's colours for named regions) draws each named region in its sRGB colour and every other region in its tissue colour, over whatever surface colour is set, which is kept underneath. Under a paint no cortex is glass. A painted area stays opaque when the cortex is see-through, and the unpainted cortex takes the cortex opacity. A paint is replaced whole by id; the same id again changes nothing; null lifts it.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:560-580,824-832`
- **Expected:** Fixture functional, `setPaint({ id: 'deficit:aphasia', colors: Map{a-left: [255, 0, 0]} })` → a-left 0xff0000, a-right 0xc4a897, opacity 1 and `glass === false` on a-left, a-right and a-wall; `state.paint.id === 'deficit:aphasia'`. The same id with other colours → no `change` event, colours unchanged. `surfaceColor` stays `functional`. `setPaint(null)` → a-wall glass again. With `setCortexOpacity(0.5)` and a paint: a-left opacity 1, a-right 0.5.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R; the see-through case is uncovered); `parity/E4b.test.ts` (D)

### ATLAS-31 · Selection never changes a region's colour
- **Rule:** The selection is drawn by the outline pass alone. The material's colour and emission stay as they were, because under atlas colour the colour is the datum.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:573-575`
- **Expected:** Fixture atlas colour, `select('a-left')` → a-left `color`, `emissive` and `emissiveIntensity` unchanged.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R)

### ATLAS-32 · The scan on the surface is shown only under MRI colour with no paint
- **Rule:** The scan the cut loads is attached to the model once. Every surface layer and the exposed white matter, including those loaded later, sample the same scan. It is drawn only while the colour is MRI and no paint is applied. Picking and the selection are unaffected.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:524-526,833-843`; deviation `e4b-state-before-load.md`
- **Expected:** `setMriAnatomy(anatomy)`, `select('a-right')`, `setSurfaceColor('mri')` → `scanEnabled` true, pick on the a-right ray still a-right, selection kept. After `setAtlas('b')` every visible material's compiled `scanVolume` is the scan's texture and `scanEnabled` true; the envelopes loaded afterwards too. A paint → `scanEnabled` false. Tissue colour → false. `setMriAnatomy(null)` → "MRI anatomy has not loaded."; another anatomy after one is attached → "MRI anatomy is already attached."; the same one again → no-op.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R; the paint and already-attached cases are uncovered); `src/lib/engine/index.test.ts` (R, FACADE-36 through the facade); `parity/E4b.test.ts` (D)

### ATLAS-33 · A parcel's border feather follows its current colour and visibility
- **Rule:** On a cortical layer the parcels blend into their neighbours at the borders. After every redraw the blend uses each parcel's current colour and stops at a parcel that is hidden. Layers that are not cortex are not feathered.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:412-424,588`; the palette writer is RENDER-37
- **Expected:** Fixture: layer `a` has a feather palette, `aseg` has none. Under CAB-NP colour, a-left's texel is (1, 0, 0, 1) in linear RGB. After `hideRegions(['a-left'])` its alpha is 0.
- **Covered by:** `parity/E4b.test.ts` (D, palette bytes in every state); uncovered by rule tests

### ATLAS-34 · Clipping planes reach every surface the model draws
- **Rule:** The cut's planes apply to every layer, to the exposed white matter and to the glass solids, including layers loaded later. Only normalized, finite planes are accepted. Reset removes them.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:553-556,592-596,695-713`
- **Expected:** `setClippingPlanes([p])` → white matter `material.clippingPlanes` equals [p]; after `setAtlas('b')` the visible material has 1 plane; glass-solid materials carry [p]. `reset()` → `clippingPlanes.length === 0`.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R; glass solids uncovered); `parity/E4b.test.ts` (D)

## Selection, isolation and dissection

### ATLAS-35 · Only a drawn region can be selected
- **Rule:** The reader can select any region that is drawn now (or shown on the cut). Selecting an unknown region, the medial wall or a region that is not drawn is an error and leaves the selection.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:714-730`
- **Expected:** Fixture on `a`: `select('missing')` → "Unknown region: missing"; `select('a-wall')` → "Cannot select a non-region: a-wall"; `select('b-left')` → "Region is not visible: b-left". `select(null)` clears and fires `selectionchange` with null.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R); `parity/E4b.test.ts` (D)

### ATLAS-36 · Isolation shows the selected region alone
- **Rule:** Isolating shows only the selected region. Releasing the isolation keeps the selection and every other setting. Changing the atlas, detail level, hemisphere, cortex, internal-anatomy or cord visibility, or the internal system, releases it; opacity, colour, paint and planes keep it. Coordinates never change.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:844-858`
- **Expected:** Fixture `select('a-right')`, `isolate()` → visible [a-right], position unchanged. `clearIsolation()` → isolation null, selection a-right, opacity 0.5 kept, 4 visible. `setHemisphere('both')` while isolated → isolation null.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R); `parity/E4b.test.ts` (D, which commands release it)

### ATLAS-37 · Dissection hides regions in undoable batches
- **Rule:** Hiding and showing regions works in batches that are applied whole or not at all, and can be undone step by step. Restore brings every hidden region back as one undoable step. The hidden set survives atlas switches. Other settings are untouched. Reset empties the set and the history.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:860-884`
- **Expected:** Fixture opacity 0.7, `hideRegions(['a-left', 'stem'])` → hidden {a-left, stem}; the same again → no change; `showRegions(['a-left'])` → {stem}; undo → {a-left, stem}; undo → {} and `dissectionCanUndo === false`; opacity still 0.7. `hideRegions(['a-left', 'missing'])` → /Unknown region/, nothing hidden, nothing to undo. Hidden a-left stays hidden after `setAtlas('b')`, `setAtlas('a')`.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R); `parity/E4b.test.ts` (D)

### ATLAS-38 · Hiding the isolated region releases the isolation, and undo brings back what it can
- **Rule:** Hiding the isolated region releases the isolation, since nothing would be left to see. Undo restores the region, and restores the isolation and the selection only when the region can still be selected under the current atlas and hemisphere, which undo does not change. A restored selection is announced.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:860-884`
- **Expected:** Fixture select, isolate, `hideRegions(['a-left'])` → isolation null; with envelopes, 4 visible. Undo → isolation and selection a-left. After `setAtlas('b')` then undo → atlas b, isolation null, selection null. After `setHemisphere('right')` then undo → hemisphere right, null, null. `selectionchange` sequence for select, hide, undo: ['a-left', null, 'a-left'].
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R)

### ATLAS-39 · Loading a hidden set releases an isolation it hides
- **Rule:** Replacing the whole hidden set (a permalink restore) follows the same rule as hiding: an isolated region that ends up hidden is released; an isolation the set leaves alone is kept.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:885-888`; deviation `e4b-load-hidden-regions-isolation.md`
- **Expected:** Fixture a-left isolated, `loadHiddenRegions(['a-left', 'stem'])` → isolation null, hidden {a-left, stem}; `loadHiddenRegions(['a-left'])` alone → 3 visible meshes. a-right isolated, `loadHiddenRegions(['stem'])` → a-right stays isolated.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R); `parity/E4b.test.ts` (D, also asserts the legacy bug)

### ATLAS-40 · Reset restores the default view and keeps what was loaded and painted
- **Rule:** Reset returns every display setting to its default: no dissection, no planes, no internal system, both hemispheres, cortex and internal anatomy shown and opaque, the cord hidden (cancelling a pending show), atlas colour, the named functional level, no isolation, no selection. It keeps the current atlas, the detail level, the loaded layers and the paint, which belongs to the panel.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:890-905`
- **Expected:** After any sequence, `reset()` → `settings` equals ATLAS-23's defaults except `atlas`, `detail` and `paint`, which are unchanged; 4 visible on the fixture; a-right colour back to 0xffffff; one `selectionchange` with null.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R, piecewise across cases); `parity/E4b.test.ts` (D); the kept paint and the cancelled cord show are uncovered

### ATLAS-41 · Removing cortex exposes the native white matter beneath
- **Rule:** When a cortical parcel of the shown atlas is hidden while the cortex is drawn and nothing is isolated, the native white surface of that hemisphere is drawn beneath it. The envelopes download the first time this happens, once, and the model redraws when they arrive. The white matter follows the hemisphere, cortex visibility, atlas, isolation, opacity and planes. It is not a region: it blocks picks through it and cannot be selected. A failed download is reported as a load error and retried by the next exposure.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:245-290,519-523`
- **Expected:** Fixture `hideRegions(['a-left'])` → no white mesh until `ensureEnvelopes()` resolves; then one white mesh, hemisphere left, kind non-region, position [0, 0, 0.015], one "Native exposed white matter" group; `tissue-envelopes.glb` fetched once. Hidden for hemisphere right, cortex hidden, atlas b, a-right isolated; shown again after each is undone; hidden after `restoreHiddenRegions()`. A ray through the hidden a-left → `intersect` boundary `white`, `pick` null. First download throws "HTTP 503" → `loaderror` with that error; the next exposure loads.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R); `parity/E4b.test.ts` (D)

## Picking

### ATLAS-42 · Picking names the nearest drawn region under the ray
- **Rule:** A pick returns the nearest drawn region the ray hits. The medial wall and other non-regions answer nothing. Hidden regions, hidden hemispheres and undrawn layers are not hit. The caller's ray settings are left as they were, and the geometry is not changed.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:613-675`
- **Expected:** Fixture, ray from (0.03, 0, 0.1) along (0, 0, −1) → `a-right`; with `firstHitOnly = true` → `a-right` and `firstHitOnly` still true. `setHemisphere('left')` → null. Ray at x = 0.06 (the medial wall) → null. A ray that misses → null.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R; I, "every loaded mesh must have a spatial index" and the raycast counts of "picking stops at the first surface"); `parity/E4b.test.ts` (D)

### ATLAS-43 · A cut does not hide what it leaves
- **Rule:** With planes set, a face the cut removes neither answers a pick nor masks a kept face behind it, and a region the cut removes entirely cannot be picked.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:623-669`
- **Expected:** Fixture a-right ray with plane ((0, 0, −1), 0) → `a-right` (its kept back face); plane ((0, 0, −1), −0.02) → null. Ray from (−0.1, 0, 0) along +x with plane ((1, 0, 0), −0.02) → `a-right`. Every hit point lies on the kept side of every plane (distance ≥ −1e-9).
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R); `parity/E4b.test.ts` (D)

### ATLAS-44 · A division behind the glass is picked through it
- **Rule:** Under functional colour the glass cortex does not catch the pointer: a division behind it, its patch or its ribbon solid, is what the reader is pointing at. Glass answers only when nothing else is on the ray.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:613-622`
- **Expected:** Fixture, internal anatomy hidden, glass a-right in front of a-left: atlas colour → `a-right`; functional → `a-left`; with a-left's patch moved off the ray its solid still answers `a-left`; sections level (a-right is a division) → `a-right`.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R); `parity/E4b.test.ts` (D)

### ATLAS-45 · Picks on the published model land on drawn regions of the right side
- **Rule:** On the published model, picks agree with what is drawn: the region is drawn and selectable, it is on a shown hemisphere, it is not cortex while the cortex is hidden, it is the isolated region when one is isolated, and it is never a hidden region.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:613-675`; `scripts/benchmark-picking.mjs` (ray layout)
- **Expected:** CDMD destrieux: the ray from (0.25, 0, 0) along −x picks a destrieux cortex region with hemisphere `right`; from (−0.25, 0, 0) along +x, one with hemisphere `left`. Over 100 Fibonacci-sphere rays at 0.25 m aimed at the centre (fixed seed), more than 30 % hit, and for every pick: `canSelect(region)`, `kind !== 'non-region'`; with hemisphere left none is `right`; with the cortex hidden none is cortex; with region r isolated every pick is r or null; after `hideRegions([r])` none is r. Under functional colour on hcp-mmp with glass solids, picks are divisions or glass.
- **Covered by:** `parity/E4b.test.ts` (D, 9,000+ rays compared with legacy); uncovered by rule tests

### ATLAS-46 · A region's centroid is its box centre in surface RAS millimetres, to 0.1 mm
- **Rule:** The centroid the inspector shows is the centre of the region's bounding box over every loaded layer, in surface RAS millimetres (R, A, S), rounded to 0.1 mm. It is computed once and reused. A region with no mesh, or none, has no centroid.
- **Kind:** scientific
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:676-694`
- **Expected:** Fixture: a-left → [0, 0, 0]; a-right (box at x = 0.03 m) → [30, 0, 0]; the second call returns the same array. `centroidOf('n-left')`, `centroidOf('nonexistent')` and `centroidOf(null)` → null. CDMD with destrieux, hcp-mmp, learning, aseg and nextbrain loaded: at least 400 regions have a centroid; each value is a multiple of 0.1; for every destrieux pair `destrieux:left:N` / `destrieux:right:N`, the right one's R is greater than the left one's.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (W: asserts only three finite numbers and the cache; an axis swap would pass); `parity/E4b.test.ts` (D, every CDMD region); fixed values are uncovered

## Spinal cord

### ATLAS-47 · The cord downloads the first time it is shown, once
- **Rule:** The reference cord is a hidden layer: nothing of it downloads until the reader first shows it. After that it is shown again from memory. Its load state reads unloaded, loading, ready or error.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:291-317,776-788`
- **Expected:** After `initialize()`, `cord.glb` not fetched, `spinalCordLoadState === 'unloaded'`, no `zanatomy` layer. `setSpinalCordVisible(true)` → fetched once, cord selectable. Hide, show → still fetched once.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R); `src/lib/engine/model/spinal-cord.test.ts` (R, CDMD)

### ATLAS-48 · Showing the cord waits for it; hiding cancels; a failure is retried
- **Rule:** Showing the cord resolves once it has downloaded, and until then the cord is neither shown nor selectable. Hiding it while it downloads cancels the show. A failed download leaves the brain as it was, records the error and is retried by the next show. An anatomy that publishes no cord says so.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:291-317,776-788`
- **Expected:** Pending show → state `loading`, `spinalCordVisible === false`, `select(cord)` → /not visible/ (also when the flag is forced on). Finished → `ready`, visible, selectable, isolatable, and hide/undo restore it. Show then hide before the download ends → `spinalCordVisible === false`. First download throws "Spinal cord request failed: HTTP 503" → `setSpinalCordVisible(true)` rejects with it, state `error`, `spinalCordLoadError` that error, cortex still drawn; second attempt → `ready`. No `zanatomy` layer published → rejects `/does not publish a spinal cord/`.
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R); `src/lib/engine/model/assets.test.ts` (S, published-or-not)

### ATLAS-49 · The published cord assembly is one supplemental system
- **Rule:** CDMD publishes the cord as the `zanatomy` supplemental layer: every region of it is supplemental, not registered to the subject's MRI, and in the "Spinal cord" system. It carries what a straightened template cannot: grey horns, roots, ganglia and the cauda equina.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/model/spinal-cord.test.js:47-62`; `public/models/cdmd/manifest.json`
- **Expected:** 58 `zanatomy` regions = `supplemental_layers[0].region_count`; each `supplemental === true`, `mri_registered === false`, `system_names.en === 'Spinal cord'`. Present: `zanatomy:midline:cord`, `zanatomy:left:anterior-horn`, `zanatomy:left:posterior-horn`, `zanatomy:left:anterior-root`, `zanatomy:right:posterior-root`, `zanatomy:left:spinal-ganglion`, `zanatomy:midline:cauda-equina`.
- **Covered by:** `src/lib/engine/model/spinal-cord.test.ts` (S)

### ATLAS-50 · The cord can be selected and isolated at every detail level, and a root follows its side
- **Rule:** Once shown, the cord is drawn, selectable and isolatable whatever the detail level, also with the cortex hidden, one hemisphere and the "Spinal cord" system chosen. The cord is midline, so no hemisphere hides it; a lateral root follows the hemisphere it belongs to. A hidden cord is not visible for the reason `spinal-cord-hidden` and cannot be selected.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/spinal-cord.test.js:63-132`
- **Expected:** CDMD cord shown, for each of aseg, nextbrain, learning: the cord mesh is drawn; cortex hidden, hemisphere left, system 'Spinal cord', select and isolate → visible [`zanatomy:midline:cord`]. Hemisphere left → `zanatomy:left:anterior-root` visible, `zanatomy:right:anterior-root` not; right → the reverse; the cord visible in both. Cord hidden → `visibilityOf(cord).reason === 'spinal-cord-hidden'`, `select` → "Region is not visible: zanatomy:midline:cord".
- **Covered by:** `src/lib/engine/model/spinal-cord.test.ts` (R; its search assertions belong to the core catalogue area)

### ATLAS-51 · Cord caps on the cut are tissue-coloured, unshaded and pickable down to the conus
- **Rule:** Cut through, the cord's grey horns cap as grey matter and the cord as white matter, or in the published atlas colour under atlas colour. The cord is not the subject's tissue, so its caps carry no MRI shading or relief. A cut anywhere along the cord, even near the conus where the cord curves away from its box centre, can be picked.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/spinal-cord.test.js:133-200`
- **Expected:** Horn cap colour `tissue.gray` (#a68d80). Cord cap colour `tissue.white` (#e5dbc5) under tissue and network colour, the source material colour under atlas colour; `tissueVariation` 0 and `tissueRelief` 0 in all three. At 12 % of the cord's height, planes along x, y, z and (1, 1, 1)/√3, from both sides, a ray onto the plane picks `zanatomy:midline:cord`.
- **Covered by:** `src/lib/engine/model/spinal-cord.test.ts` (R). These exercise the cut's solids (`SolidSections`, `paintSolids`) and overlap the tissue area (TISSUE-).

## Solids the model holds, and disposal

### ATLAS-52 · Ribbon solids are cut once per atlas and shared; glass solids need the divisions
- **Rule:** The ribbon solid of each parcel is cut from the envelopes once per atlas and kept, so the glass brain and the cut share it. The glass solids are built once from the functional atlas's ribbons, for the named divisions only. A model without functional divisions refuses them.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:318-363`
- **Expected:** CDMD `ensureRibbonWedges('destrieux', base)` twice → the same array and no second `ribbon-destrieux.labels` fetch; envelopes are loaded first. `loadGlassSolids(base)` → solids only for regions in `functional_regions.regions.named` of hcp-mmp; a second call adds nothing. Fixture without divisions → rejects "This model carries no functional divisions.".
- **Covered by:** `src/lib/engine/model/brain-atlas.cut.test.ts` (R, wedges kept); `src/lib/engine/model/brain-atlas.test.ts` (R, refusal); `parity/E4b.test.ts` (D, glass solids on CDMD); the named-only and load-once parts are uncovered

### ATLAS-53 · Disposal releases everything and refuses later work
- **Rule:** Disposing removes the model from the scene and frees every layer, the white matter, the ribbon solids and the glass materials. A download that finishes later is released at once. Later loads are refused. The model reports that it is disposed.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:907-931`
- **Expected:** `dispose()` → `group.children.length === 0`, `disposed === true`, `layers.size === 0`. A layer download resolving after `dispose` rejects "BrainAtlas was disposed during loading." and its geometry is disposed. `ensureEnvelopes()`, `ensureSpinalCord()`, `ensureRibbonWedges()`, `loadGlassSolids()`, `loadLayer()` and `setSpinalCordVisible(true)` after dispose reject "BrainAtlas has been disposed.".
- **Covered by:** `src/lib/engine/model/brain-atlas.test.ts` (R, children and flag); the late-arrival and refusal parts are uncovered
