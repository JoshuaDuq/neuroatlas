# Core state rules

Scope: chunk C4 (#22), the pure state modules: the link's text format (`url-state`), the check of a
decoded link against the anatomy (`link-check`), the session and its notices, the keyboard
predicates, restoring a whole scene (`reader-state`), the scene commands that wait on downloads,
clinical navigation, the paint and stage key, dissection, the internal-anatomy door, the atlas
prefetch decision and the link writer. Legacy sources: `viewer/state/{url-state,link-check,session,reader-state,scene-commands,paint,dissection,internal-mode,boot,link-writer}.js`,
`viewer/clinical/navigation.js`, `viewer/ui/chrome/shortcuts.js:9-25`. New code:
`web/src/lib/core/state/*.ts`, `web/src/lib/core/keyboard.ts`. Deviations:
`c4-unbalanced-notice-release.md`. Restoring a link in the app (the order of hooks, the notice,
the address bar) is in `links.md`; the camera as a link carries it is in `engine-e7.md`
(FACADE-24 to FACADE-26); the keymap that uses the predicates is in `controller.md` (KEY-).
Link examples are hash bodies; a leading `#` is accepted wherever a hash is read. Copy quoted
is the English interface text.

## The link's text

### STATE-01 · A link carries only what differs from the default scene

- **Rule:** Writing a scene leaves out every field still at its default, so a default view is a bare link. Atlas, detail, cut atlas and language have no default and are written whenever given.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/url-state.js:8-33,201-218`
- **Expected:** Defaults: hemisphere `both`, cortex shown, opacity 1, internal anatomy shown, cord hidden, colour `atlas`, level `named`, view `oblique`, cut `off`, position 0, not reversed, tilt 30, azimuth 30, no region, no isolation, no system, no anatomy, tab `anatomy`, no function, deficit or circuit, step 0, no camera, no MRI window. `encodeState` of all those plus `atlas: 'destrieux'` → `atlas=destrieux`. `{ atlas: 'destrieux', spinalCordVisible: false }` → `atlas=destrieux`. `{ cut: 'off' }` writes no `cut=`.
- **Covered by:** `src/lib/core/state/url-state.test.ts` (R); `src/lib/core/state/reader-state.test.ts` (R, "the defaults are exactly what a link leaves out")

### STATE-02 · Each field travels under one short parameter, in a fixed order

- **Rule:** Every scene field has one link parameter. The hidden parts come first, then the other fields in a fixed order, so the same scene always writes the same link.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/url-state.js:145-218`
- **Expected:** Order and names: `hidden`, `anatomy`, `atlas`, `cuts` (cut atlas), `system`, `detail`, `region`, `isolate`, `view`, `cam`, `cut`, `pos`, `rev`, `tilt`, `az`, `hemi`, `cortex`, `internal`, `cord`, `colors`, `level`, `opacity`, `mri`, `tab`, `function`, `deficit`, `circuit`, `step`, `lang`. `{ explorer: 'circuits', selectedDeficit: 'aphasia', circuit: 'visual', circuitStep: 2 }` → `tab=circuits&deficit=aphasia&circuit=visual&step=3`. `{ surfaceColor: 'functional', functionalLevel: 'sections' }` → `colors=functional&level=sections`.
- **Covered by:** `src/lib/core/state/url-state.test.ts` (R, by examples; `STATE-02`: the whole name table and order)

### STATE-03 · Names pass through as readable, opaque strings

- **Rule:** The link does not know which atlases, regions, views, systems, functions or deficits exist; it passes them through for the link check. Colons in region ids and commas in lists stay readable rather than percent-encoded.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/url-state.js:150-165,216`
- **Expected:** `atlas=made-up&region=not:a:region&view=sideways` → `{ atlas: 'made-up', selectedRegion: 'not:a:region', view: 'sideways' }`, nothing rejected. `{ atlas: 'destrieux', selectedRegion: 'destrieux:left:75' }` → `atlas=destrieux&region=destrieux:left:75`. `{ detail: 'learning', internalSystem: 'Basal ganglia' }` reads back with the same system.
- **Covered by:** `src/lib/core/state/url-state.test.ts` (R)

### STATE-04 · A selected region is written by its id

- **Rule:** A selected or isolated region given as a region record is written as its id, never as text like "[object Object]".
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/url-state.js:141-143`
- **Expected:** `{ atlas: 'destrieux', selectedRegion: { id: 'destrieux:left:29', label: 'Precentral gyrus' } }` → `atlas=destrieux&region=destrieux:left:29`.
- **Covered by:** `src/lib/core/state/url-state.test.ts` (R)

### STATE-05 · Hidden parts travel sorted, once each

- **Rule:** The hidden parts are written sorted and comma separated; an empty set is not written. Reading drops repeats; an empty id in the list or a repeated `hidden` parameter rejects the field.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/url-state.js:203-206,229-235`
- **Expected:** `{ hiddenRegions: Set['destrieux:right:18', 'aseg:left:11'] }` → `hidden=aseg:left:11,destrieux:right:18`, read back as `['aseg:left:11', 'destrieux:right:18']`. Empty set → `''`. `hidden=a,a` → `['a']`. `hidden=a,,b` and `hidden=a&hidden=b` → rejected `['hidden']`.
- **Covered by:** `src/lib/core/state/url-state.test.ts` (R; `STATE-05`: the `a,a` case)

### STATE-06 · A field that does not parse, or appears twice, is named and left out

- **Rule:** Reading a link never guesses. A field whose value does not parse, or that is repeated, is left out of the state and its parameter is returned in `rejected`; the fields beside it still read. Unknown parameters and empty links carry nothing. Only a string can be read.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/url-state.js:220-239`
- **Expected:** `opacity=0.2&opacity=0.8&hemi=left` → `{ state: { hemisphere: 'left' }, rejected: ['opacity'] }`. `atlas` with no value → `['atlas']`. `anatomy=snail&lang=de` → `{ state: { anatomy: 'snail' }, rejected: ['lang'] }`. `''`, `#`, `???`, `#=&=&`, `#%%%%`, `#unrelated=1` → `{ state: {}, rejected: [] }`. `decodeState(null | 5 | {} | [])` throws a TypeError matching `/string/`. `rejected` lists fields in the order of STATE-02, `hidden` last.
- **Covered by:** `src/lib/core/state/url-state.test.ts` (R)

### STATE-07 · Flags are 1 or 0, and old colour flags keep their meaning

- **Rule:** Cortex, internal anatomy, cord and reversed side are `1` or `0`; nothing else. A link from when `colors` was a flag still opens with the colouring it meant; nothing writes the old form.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/url-state.js:39-50`
- **Expected:** `cortex=maybe`, `internal=true`, `cord=2`, `rev=yes` rejected. `colors=1` → `atlas`, `colors=0` → `tissue`; `colors=2`, `colors=true` rejected. `{ internalVisible: false }` writes `internal=0`; `{ spinalCordVisible: true }` writes `cord=1`.
- **Covered by:** `src/lib/core/state/url-state.test.ts` (R)

### STATE-08 · Closed lists take only their own values

- **Rule:** Colour, hemisphere, cut, functional level, tab and language accept only the values the app has.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/url-state.js:150-195`
- **Expected:** `colors` ∈ tissue, mri, atlas, network, cab-np, functional; `hemi` ∈ both, left, right; `cut` ∈ off, sagittal, coronal, axial, oblique; `level` ∈ named, sections; `tab` ∈ anatomy, functions, deficits, circuits, diffusion; `lang` ∈ en, fr. `hemi=banana`, `cut=sideways`, `level=lobes`, `tab=tracts`, `lang=es`, `lang=unknown` rejected. `colors=mri`, `colors=cab-np` and `colors=tissue` round trip.
- **Covered by:** `src/lib/core/state/url-state.test.ts` (R)

### STATE-09 · A cut position is read to a tenth and written toward zero

- **Rule:** The cut position lies within ±512 mm and is read to the nearest tenth. It is written rounded toward zero, so the written value stays inside the plane's range whenever the exact one did; a value a float error short of a tenth counts as that tenth.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/url-state.js:56-61,113-123`
- **Expected:** `pos=12.36` → 12.4; `pos=-512`, `pos=512` read; `pos=513`, `pos=9999`, `pos=`, `pos= `, `pos=abc` rejected. `towardZero(127.96)` = 127.9, `(-127.96)` = -127.9, `(12.3)` = 12.3, `(12.299999999999)` = 12.3. `{ cut: 'axial', cutOffset: 127.96 }` → `cut=axial&pos=127.9`; `cutOffset: -0.04` → `cut=axial&pos=0`.
- **Covered by:** `src/lib/core/state/url-state.test.ts` (R)

### STATE-10 · Cut angles are whole degrees in range

- **Rule:** Tilt is 0 to 90 degrees and azimuth -180 to 180, rounded to whole degrees.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/url-state.js:63-68,161-162`
- **Expected:** `tilt=0`, `tilt=90`, `az=-180`, `az=180` read; `tilt=44.6` → 45; `tilt=91`, `tilt=-1`, `az=181` rejected. `{ cut: 'oblique', cutTilt: 10, cutAzimuth: -20 }` round trips.
- **Covered by:** `src/lib/core/state/url-state.test.ts` (R; `STATE-10`: whole degrees, the range)

### STATE-11 · Cortex opacity is 0 to 1, written to hundredths

- **Rule:** Opacity is read when it is a number from 0 to 1 inclusive and written to two decimals.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/url-state.js:177-185`
- **Expected:** `opacity=0` → 0, `opacity=1` → 1, `opacity=0.456` → 0.456. `opacity=5`, `-0.1`, `1.01`, ``, ` `, `NaN`, `Infinity`, `true` rejected. `{ cortexOpacity: 0.456 }` writes `opacity=0.46`; `{ cortexOpacity: 0.35 }` round trips.
- **Covered by:** `src/lib/core/state/url-state.test.ts` (R; `STATE-11`: writing to hundredths)

### STATE-12 · The exact camera travels in tenths of a millimetre, its up only when it has its own

- **Rule:** `cam` is position and target in millimetres (six numbers), optionally followed by an up vector (nine numbers). Coordinates beyond 100 000 mm, other counts, non-numbers and a zero up are rejected. A hand-written up is normalised. Writing rounds coordinates to tenths and the up to thousandths.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/url-state.js:77-111,125-128`
- **Expected:** `{ position: [-312.44, 95.06, -140.61], target: [1.23, -10.27, 4.5] }` → `cam=-312.4,95.1,-140.6,1.2,-10.3,4.5`. Up `[0, 0.6, 0.8]` round trips. `cam=0,0,300,0,0,0,0,2,0` → up `[0, 1, 0]`. `cam=1,2,3`, `1,2,3,4,5,x`, `0,0,200000,0,0,0`, `1,2,3,4,5,6,0,0,0`, `1,2,3,4,5,6,7,8,9,10` rejected.
- **Covered by:** `src/lib/core/state/url-state.test.ts` (R)

### STATE-13 · A written camera reads back inside the orbit limit it was written under

- **Rule:** Writing to tenths can lengthen the camera's distance by at most `ORBIT_ROUNDING_MM` = 2·√(3·0.05²) ≈ 0.1732 mm. A camera read from a link counts as within an orbit limit when its distance is above zero and at most the limit plus that rounding.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/url-state.js:84-91`
- **Expected:** For region, brain and brain-with-cord frames, 500 cameras each between `minDistance` and `maxDistance` of `cameraConstraints(box)` (half of them exactly at the limit, fixed LCG seed 7): the written link reads back with nothing rejected and `orbitWithin(read, maxDistance·1000)` is true. Position equal to target → false. Distance 101 with limit 100 → false. Limit + 0.17 → true, limit + 0.18 → false.
- **Covered by:** `src/lib/core/state/url-state.test.ts` (R; `STATE-13`: the limit + 0.17 and + 0.18 cases)

### STATE-14 · The MRI window travels as level then width

- **Rule:** The MRI window is two numbers over the scan's 8-bit intensities: level 0 to 255, width 1 to 256. It is written in tenths.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/url-state.js:129-136,186`
- **Expected:** `{ mriWindow: { center: 90, width: 180 } }` → `mri=90,180`. `mri=128,256` → `{ center: 128, width: 256 }`; `mri=0,1` reads. `mri=90`, `300,100`, `90,0`, `256,1`, `-1,10`, `10,257`, `1,2,3`, `a,b` rejected.
- **Covered by:** `src/lib/core/state/url-state.test.ts` (R; `STATE-14`: the bounds and the tenths)

### STATE-15 · A lesson step is counted from one in the link

- **Rule:** The link counts lesson steps from one, as the stepper shows them; the scene counts from zero. The first step is the default and is not written.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/url-state.js:137-140,192`
- **Expected:** `circuitStep: 2` → `step=3`; `step=3` → 2. `{ circuit: 'visual', circuitStep: 0 }` → `circuit=visual`. `step=0`, `-1`, `1.5`, `2.5`, `x` rejected.
- **Covered by:** `src/lib/core/state/url-state.test.ts` (R)

### STATE-16 · The language is written whenever given, and the brain whenever named

- **Rule:** A link written with a language carries it, English included, so the reader's language survives sharing; an absent language is left out so startup can use the saved preference. A link names the brain when given; one that names none leaves the choice to the published default.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/url-state.js:147-149,194`
- **Expected:** `{ atlas: 'destrieux', lang: 'en' }` → `atlas=destrieux&lang=en`; `'fr'` → `…&lang=fr`; `lang` absent, `undefined` or `null` → `atlas=destrieux`. `{ atlas: 'destrieux', anatomy: 'cdmd', selectedRegion: 'destrieux:left:6' }` contains `anatomy=cdmd` and reads back both. `decodeState('atlas=destrieux').state.anatomy` is `undefined`.
- **Covered by:** `src/lib/core/state/url-state.test.ts` (R)

### STATE-17 · What a link writes reads back as the same scene

- **Rule:** Reading the link written from a decoded link gives the same state, except that fields at their default are omitted and numbers are rounded as written (STATE-09 to STATE-14).
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/url-state.js:201-239`
- **Expected:** `{ atlas: 'hcp-mmp', hemisphere: 'left', cortexVisible: false, cortexOpacity: 0.35, surfaceColor: 'network', view: 'superior', selectedRegion: 'aseg:left:11', isolatedRegion: 'aseg:left:11' }` round trips exactly. `{ atlas: 'destrieux', cut: 'sagittal', cutOffset: 12.5, cutReverse: true }` round trips. For the C4 corpus (every parameter of STATE-02 with its readable, near-miss and nonsense values, plus 80 seeded hashes, seeds 1-40 and 101-140), `decodeState(encodeState(decodeState(h).state)).state` equals `decodeState(h).state` without default-valued fields and with the written rounding.
- **Covered by:** `src/lib/core/state/url-state.test.ts` (R, single scenes; `STATE-17`: a fixed corpus of eleven links)

## Checking a link against the anatomy

### STATE-18 · A link may name only what this anatomy publishes

- **Rule:** Each name a decoded link carries is judged against the anatomy on screen. A name it does not publish is dropped and its parameter reported, so the reader can be told. Fields that name nothing (hemisphere, tab when known) pass.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/link-check.js:8-41`
- **Expected:** Known: atlases destrieux, hcp-mmp; details aseg, nextbrain, learning; cut atlases destrieux, hcp-mmp, nextbrain; the seven views; colours tissue, mri, atlas, network, cab-np; functions all, language; deficit aphasia; circuit visual with 4 steps. `atlas=yeo&detail=fine&cuts=x&view=Left&colors=functional&region=nope&isolate=destrieux:left:medial-wall&hidden=aseg:left:17,nope&tab=diffusion&function=praxis&deficit=x&circuit=y&step=2&hemi=left` → rejected `['atlas','detail','cuts','view','colors','region','isolate','hidden','function','deficit','circuit','step']`, state `{ explorer: 'diffusion', hemisphere: 'left' }`. A link naming only known ids passes whole.
- **Covered by:** `src/lib/core/state/link-check.test.ts` (R)

### STATE-19 · A non-region can be hidden but not selected or isolated

- **Rule:** The medial wall and other non-regions are published ids, so a link may hide them, but selecting or isolating one is refused. Every hidden id must be published.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/link-check.js:15-18,26`
- **Expected:** `isolate=destrieux:left:medial-wall` → rejected `isolate`; `hidden=destrieux:left:medial-wall` passes; `hidden=aseg:left:17,nope` → rejected `hidden`.
- **Covered by:** `src/lib/core/state/link-check.test.ts` (R)

### STATE-20 · A lesson step must exist in its circuit

- **Rule:** A step is applied only when the link names a circuit that has that step.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/link-check.js:33-36`
- **Expected:** circuit `visual` with 4 steps: `circuit=visual&step=4` → `circuitStep: 3`; `step=5` → rejected `step`; `step=2` without a circuit → rejected `step`.
- **Covered by:** `src/lib/core/state/link-check.test.ts` (R)

### STATE-21 · Showing the cord is refused where the subject publishes none; hiding it never is

- **Rule:** A subject publishes a spinal cord when its manifest lists the `pam50` supplemental layer. On a subject without one, a link that shows the cord has that field refused; a link that hides it always passes.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/link-check.js:37-39`; `viewer/state/scene-commands.js:6`
- **Expected:** `publishesSpinalCord(cdmd manifest)` = true; with `pam50` removed = false; `{}` and `{ supplemental_layers: [{ id: 'envelopes' }] }` = false. Cordless: `cord=1&hemi=left` → rejected `['cord']`, state `{ hemisphere: 'left' }`; `cord=0` → nothing rejected. With a cord, `cord=1` passes.
- **Covered by:** `src/lib/core/state/link-check.test.ts` (R)

## The session

### STATE-22 · Every panel renders from one snapshot

- **Rule:** The session merges the model's state with its own into one snapshot per change; derived lists (search results, groups, visible counts) are never stored in it. The session's own state is reachable only through that snapshot.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/session.js:39-72,172-175`
- **Expected:** A fresh session gives view `oblique`, query `''`, explorer `anatomy`, function query `''`, no function, clinical query `''`, no deficit, no finding, paint not lifted, no group expanded, theme `dark` unless given, lang `en` unless `'fr'`, status `loading`, no progress, error or notice. `assemble({ atlas: 'destrieux' })` after `setView('left')`, `setQuery('putamen')` carries `atlas`, `view: 'left'`, `query: 'putamen'`. No `results`, `groups` or `visibleCount` key. `session.state` is `undefined`.
- **Covered by:** `src/lib/core/state/session.test.ts` (R; the `session.state` case is I, it pins the absence of a property)

### STATE-23 · An unknown view is refused and an unknown tab is an error

- **Rule:** Setting a view the app does not know is refused and changes nothing; setting an unknown explorer tab throws.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/session.js:79-90`
- **Expected:** `setView('sideways')` → false, view stays `oblique`, a standing notice stays; `setView('superior')` → true. `setExplorer('unknown')` throws `/Unknown explorer/`.
- **Covered by:** `src/lib/core/state/session.test.ts` (R; `STATE-23`: the notice surviving a refused view)

### STATE-24 · Each tab keeps its own search and choice

- **Rule:** The anatomy search, the Functions search, the clinical search and their selections are independent: changing tab keeps them all. Choosing a deficit shows all its findings again.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/session.js:86-99`
- **Expected:** `setQuery('hippocampus')`, `setExplorer('deficits')`, `setClinicalQuery('memory')`, `setDeficit('amnesia')` → explorer `deficits`, query `hippocampus`, clinical query `memory`, deficit `amnesia`, no region selected; `setExplorer('anatomy')` keeps the deficit. `setFinding('naming')` then `setDeficit('aphasia')` → finding null.
- **Covered by:** `src/lib/core/state/session.test.ts` (R; `STATE-24`: the finding reset)

### STATE-25 · A masthead choice lifts the open paint until a function, deficit, finding or tab is chosen

- **Rule:** When the reader picks a colour or atlas over a function's or deficit's paint, the paint is lifted. Choosing a function, a deficit, a finding or a tab again puts the paint back.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/session.js:86-99`
- **Expected:** `liftPaint()` → `paintLifted: true`; each of `setFunction('all')`, `setDeficit('aphasia')`, `setExplorer('functions')`, `setFinding(x)` → false. The function query is kept.
- **Covered by:** `src/lib/core/state/session.test.ts` (R; `STATE-25`: `setFinding`)

### STATE-26 · Tree groups open and close one by one or all at once

- **Rule:** Toggling a group opens or closes only that group; a bulk set replaces the open set.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/session.js:100-110`
- **Expected:** toggle Frontal, Temporal, Frontal → `['Temporal']`. `setExpanded(['Frontal','Temporal','Parietal'])` → those three; `setExpanded([])` → none.
- **Covered by:** `src/lib/core/state/session.test.ts` (R)

### STATE-27 · The language is English or French, anything else English

- **Rule:** The session language is `en` or `fr`; any other value, at creation or later, gives English.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/session.js:37,113`
- **Expected:** created with `lang: 'en'` → `en`; `setLang('fr')` → `fr`; `setLang('invalid')` → `en`; created with `lang: 'xx'` → `en`.
- **Covered by:** `src/lib/core/state/session.test.ts` (R)

### STATE-28 · The stage status: loading, ready, error and a lost GPU context

- **Rule:** Loading carries its progress; becoming ready clears progress and error; an error is carried as the error, never as a ready viewer; a lost GPU context is a status of its own, said by the stage in the reader's language, with no English error text.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/session.js:116-121,134-140`
- **Expected:** `setProgress({ loaded: 12400000, total: 27900000 })` → status `loading` with that progress; `setStatus('ready')` → `ready`, progress null. `setError(new Error('Manifest request failed: HTTP 404'))` → status `error`, `error.message` that text. `setContextLost()` after ready → `context-lost`, error null.
- **Covered by:** `src/lib/core/state/session.test.ts` (R)

### STATE-29 · A download behind a model on screen is "switching", and is not an action

- **Rule:** A download after the first load leaves the model usable: the status is `switching` with its progress, and back to `ready` when it ends. During the first load a download keeps the `loading` status. Progress is not an action, so a standing notice outlives it.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/session.js:122-133`
- **Expected:** ready, `setSwitching({ loaded: 1, total: 4 })` → `switching` with that progress; `endSwitching()` → `ready`, progress null. Loading, `setSwitching(…)` and `endSwitching()` → still `loading`. A `reload` notice set before stays through both.
- **Covered by:** `src/lib/core/state/session.test.ts` (R)

### STATE-30 · A notice stands until the reader's next action, never on a timer

- **Rule:** A notice stays until the next deliberate action (any setter other than progress) or until it is dismissed. A notice must have text.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/session.js:73-77,142-150`
- **Expected:** `notify({ text: 'Selection cleared — cortex hidden.' })` → notice `{ text, action: null }`; `setQuery('a')` → null. `notify(null)` clears what is shown. `notify('bare text')` and `notify({})` throw `/needs text/`.
- **Covered by:** `src/lib/core/state/session.test.ts` (R)

### STATE-31 · Notices that meet join into one, each said once

- **Rule:** A notice arriving while another stands joins it in one sentence; a text already said is not repeated; the first action offered wins.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/session.js:44-52`
- **Expected:** `notify('Not applied from this link: view.')`, `notify('Could not show the white matter.', reload)`, the second again → `{ text: 'Not applied from this link: view. Could not show the white matter.', action: 'reload' }`.
- **Covered by:** `src/lib/core/state/session.test.ts` (R)

### STATE-32 · While a link is applied, notices wait and follow the link's own

- **Rule:** While a link is being applied its own steps are actions that would clear a notice, so notices are held until the last hold is released, then shown after the link's own notice as one notice. Releasing with nothing to say shows nothing. Releasing when nothing is held is an error that leaves the hold count intact.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/session.js:152-170`; deviation `c4-unbalanced-notice-release.md`
- **Expected:** hold; notify "Could not show the white matter."; notify "Planum was updated." (reload); `setExplorer('deficits')`, `setDeficit('aphasia')` → notice null; release with "Not applied from this link: language." → `{ text: 'Not applied from this link: language. Could not show the white matter. Planum was updated.', action: 'reload' }`. Two holds: the first release shows nothing; the second shows "Not applied from this link: view. A download failed.". `releaseNotices()` with nothing held throws `/No notices are held/`; a later hold and release still shows "Waits.".
- **Covered by:** `src/lib/core/state/session.test.ts` (R)

## Keyboard predicates

### STATE-33 · Shortcuts never act from a field the reader is typing in

- **Rule:** A single-key shortcut may not act from a text-type input (text, search, email, number, password, tel, url, or no type), a textarea, a select or an editable element, so `3b` (an HCP-MMP area) can be typed. A slider keeps its arrows, Home, End, PageUp and PageDown, and every key when the key is not known; other keys pass. Buttons, checkboxes, radios, the canvas and the page pass.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/session.js:13-37`
- **Expected:** `{ tagName: 'INPUT', type: 'text' }`, `TEXTAREA`, `SELECT`, `{ isContentEditable: true }` → false. `CANVAS`, `BUTTON`, `BODY`, `null`, checkbox → true. Range with ArrowUp…PageDown → false; range with no key → false; range with `c` or `3` → true.
- **Covered by:** `src/lib/core/state/session.test.ts` (R); dispatch: KEY-05 in `controller.md`

### STATE-34 · Character shortcuts can be turned off, and pressable controls in marked regions keep their keys

- **Rule:** A character key is one character long. One-character shortcuts stop when the reader turns them off (WCAG 2.1.4), and never act from a button, summary or tab inside a region that marks its keys as its own (`data-own-keys`). A tree row there, or a view preset outside those regions, keeps the shortcuts.
- **Kind:** accessibility
- **Level:** unit
- **Source:** `viewer/ui/chrome/shortcuts.js:9-25`
- **Expected:** `isCharacterKey`: `h`, `H`, `0`, `6`, `?`, `/`, `+` → true; `Escape`, `ArrowUp`, `Tab`, `Enter`, `''`, `undefined` → false. `characterShortcutAllowed(x, false)` → false for any target. Button, summary or `[role="tab"]` inside a marked region → false; a non-control inside → true; a button outside → true; `null` → true.
- **Covered by:** `src/lib/core/keyboard.test.ts` (R); dispatch: KEY-06 in `controller.md`

## Restoring a whole scene

### STATE-35 · A scene to restore leaves nothing implicit

- **Rule:** A scene built from a partial one takes, for every absent field, the default a link omits it for, so applying it turns a cut off and clears isolation. Layers a scene does not name stay as loaded; a scene with no layer at all is an error. False and zero are kept. Region records become ids, hidden parts a set, and the camera defaults to framing the named view. A link's exact camera and MRI window ride along as given.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/reader-state.js:1-33`
- **Expected:** `readerState({}, { atlas: 'destrieux', detail: 'learning', cutAtlas: 'destrieux' })` → the STATE-01 defaults on those layers, `hiddenRegions` empty set, `camera: 'view'`; it encodes to `atlas=destrieux&cuts=destrieux&detail=learning`. `{ cortexVisible: false, cortexOpacity: 0, cutOffset: 0 }` keeps them. `selectedRegion: { id: 'aseg:left:17' }` → `'aseg:left:17'`. Loaded cut atlas `''` → throws `/no cutAtlas/`. `camera: 'cut'` and an exact pose pass through by identity.
- **Covered by:** `src/lib/core/state/reader-state.test.ts` (R)

### STATE-36 · A captured scene writes the link it was captured from

- **Rule:** Decoding a link, building the scene from it and writing that scene gives back the same link fields.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/reader-state.js:19-33`; `viewer/state/url-state.js`
- **Expected:** `atlas=hcp-mmp&cuts=aseg&system=Basal+ganglia&detail=aseg&region=aseg:left:11&isolate=aseg:left:11&view=left&cut=coronal&pos=-12.5&rev=1&hemi=left&cortex=0&internal=0&cord=1&colors=tissue&opacity=0.4&hidden=aseg:left:12,aseg:left:13` → decode, `readerState`, encode, decode equals the first decode.
- **Covered by:** `src/lib/core/state/reader-state.test.ts` (R)

### STATE-37 · A scene is applied layers first, the camera last

- **Rule:** Restoring applies the atlas and detail level first, then system, hemisphere, cortex, internal anatomy, cord, opacity, hidden parts, functional level and colour, then the cut atlas and the cut (angles, plane, side, then position), then isolation, selection (opening its tree branch), the MRI window, the named view, and last the exact camera. A setting already as wanted is not touched, except the cord and the colour, which are always asked so a showing still downloading is overtaken. The cord is awaited before selection and framing. Hidden parts compare by membership.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/reader-state.js:42-128`
- **Expected:** A scene changing every field → events `atlas, detail, system, hemisphere, cord, hidden, color, cut-atlas, angles, cut, cut-display, cut-position, selection, isolation, tree, mri-load, mri-window, camera, orbit`. A scene without the cord asks `showSpinalCord(false)` once. With the cord download pending, no selection, tree or camera event happens until it lands. `sameRegions({a,b},{b,a})` true; `({a},{a,b})` false.
- **Covered by:** `src/lib/core/state/reader-state.test.ts` (R)

### STATE-38 · A failed step is reported with its link fields and the rest still apply

- **Rule:** Each step names the link parameters it applies. A step that fails is recorded with them and the following steps still run, so one bad field does not cost the reader the others.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/reader-state.js:44-55`
- **Expected:** atlas, detail and cut atlas failures → `[{ fields: ['atlas'] }]`, `['detail']`, `['cuts']` with the thrown error, and the camera is still framed last. Selection → `['region']`; system → `['system']`; framing → `['view']`. Step fields: atlas `atlas`, detail `detail`, system, hemi, cortex, internal, cord, opacity, hidden, level, colors, cuts, cut `cut, tilt, az, rev, pos`, position `pos`, isolate, region, mri, view, cam.
- **Covered by:** `src/lib/core/state/reader-state.test.ts` (R)

### STATE-39 · A cut position the plane cannot hold is the one field lost; a plane that cannot be cut takes its settings with it

- **Rule:** The position is applied after its plane is cut and judged against that plane's range; a position out of range fails alone. When the plane cannot be cut, its position, angles and side are not applied either.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/reader-state.js:92-106`
- **Expected:** coronal at 150 mm on a ±128 mm plane, region selected → failures `[['pos']]` with message `/between -128 and 128/`, events `cut, cut-display, selection, tree, camera`. Axial at 10 mm where `setMode` throws "Tissue volume unavailable" → failures `[['cut','tilt','az','rev','pos']]` and no position applied.
- **Covered by:** `src/lib/core/state/reader-state.test.ts` (R)

### STATE-40 · A restore that a later command overtakes stops

- **Rule:** Before each step the restore checks that no later scene command has taken over, and stops applying once one has. It reports no failures for the steps it skipped.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/reader-state.js:46-48`
- **Expected:** a target with a new atlas, hemisphere and region, where the atlas load ends the intent → failures `[]`, no event.
- **Covered by:** `src/lib/core/state/reader-state.test.ts` (R)

### STATE-41 · Without a window of its own, a loaded scan returns to its published window

- **Rule:** A scene with no MRI window shows the scan's published window. A window already shown is left alone, and a scan not loaded is not fetched for it.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/reader-state.js:113-122`
- **Expected:** published `{ 128, 256 }`, shown `60/120` → one `setWindow(128, 256)`. Shown `128/256` → none. No published window and nothing shown → none, no load.
- **Covered by:** `src/lib/core/state/reader-state.test.ts` (R)

## Scene commands

### STATE-42 · One intent orders the scene changes that wait on downloads

- **Rule:** Each scene change takes the current intent; a later one overtakes it. An overtaken change returns false, draws nothing, and its download does not land over the newer scene. A disposed model overtakes everything.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/scene-commands.js:19-30,145-166`
- **Expected:** atlas hcp-mmp; open deficit A (`destrieux:left:12`, needs a Destrieux download), then B (`aseg:left:11`, loaded) → B true; Destrieux lands → A false, atlas still hcp-mmp, regions drawn only `[['aseg:left:11']]`. A needs Destrieux and NextBrain, B needs NextBrain → `[false, true]`, atlas hcp-mmp, detail nextbrain.
- **Covered by:** `src/lib/core/state/scene-commands.test.ts` (R)

### STATE-43 · Downloads report in the status bar, then step aside

- **Rule:** A layer, detail level, envelope, cord, cut or MRI download started by a scene change shows the `switching` status with the summed progress of the downloads that report one, and the status returns to `ready` when the last ends. A layer already held is not reported as a download.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/scene-commands.js:45-75`
- **Expected:** opening a deficit that needs Destrieux → `switching`; progress `4/16` → `{ loaded: 4, total: 16 }`; done → `ready`. Detail `aseg`, envelopes (`5/15`), cord (`1/4`) and the first cut likewise. Two downloads reporting `1/4` and `5/15` → `{ loaded: 6, total: 19 }`.
- **Covered by:** `src/lib/core/state/scene-commands.test.ts` (R; `STATE-43`: summing two downloads)

### STATE-44 · Asking for the layer on screen is free, unless another is on its way

- **Rule:** Asking for the atlas or detail level already shown does nothing, unless another switch is still loading; then the shown one is asked for again so the older switch does not land. A current switch that the model did not apply is an error.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/scene-commands.js:76-101`
- **Expected:** atlas hcp-mmp: `loadAtlas('hcp-mmp')` → no request. `loadAtlas('destrieux')` pending, then `loadAtlas('hcp-mmp')` under a new intent, then Destrieux lands → atlas hcp-mmp. A current switch whose model stays elsewhere throws "Atlas not applied: <id>" (or "Detail level not applied: <id>").
- **Covered by:** `src/lib/core/state/scene-commands.test.ts` (R; `STATE-44`: the "not applied" errors)

### STATE-45 · A colouring defined on one atlas first shows that atlas

- **Rule:** CAB-NP colours HCP-MMP areas and the functional divisions colour their own atlas's areas, so choosing or restoring them first shows that atlas. A colour chosen later overtakes one still waiting or downloading: keeping the colour shown, a reset and an applied link all win.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/scene-commands.js:9-16,106-122`
- **Expected:** `requiredAtlas(model, 'cab-np')` = `model.cabNp.atlas` (hcp-mmp on cdmd), `'functional'` = `model.functionalRegions.atlas`, others null; with no CAB-NP or functional data → undefined. Destrieux, choose CAB-NP, HCP-MMP lands → atlas hcp-mmp, colour cab-np (also through `applySurfaceColor`, returning true). CAB-NP waiting, then Tissue → Tissue stays. MRI downloading, then Regions by any of the three routes → Regions stays, status ready.
- **Covered by:** `src/lib/core/state/scene-commands.test.ts` (R)

### STATE-46 · Entering the glass brain hides the internal anatomy and says how to show it

- **Rule:** Choosing the functional divisions from the masthead, when they were not shown, hides the internal anatomy and says how to bring it back. Restoring them from a link or scene does not.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/scene-commands.js:195-218`
- **Expected:** `chooseSurfaceColor('functional')` → internal anatomy hidden, notice "Internal anatomy is hidden; Display shows it again." (fr "L’anatomie interne est masquée ; Affichage la montre à nouveau."). `applySurfaceColor('functional', current)` → internal anatomy still shown.
- **Covered by:** `src/lib/core/state/scene-commands.test.ts` (R)

### STATE-47 · The cord's first showing is a download; an anatomy without one refuses

- **Rule:** Showing the cord the first time downloads it with progress. Asking to show it where the subject publishes none is an error; hiding it always works.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/scene-commands.js:124-131`
- **Expected:** progress `1/4` reported, then cord visible and `true`. Cordless: `showSpinalCord(true)` rejects "This anatomy does not publish a spinal cord."; `showSpinalCord(false)` → true.
- **Covered by:** `src/lib/core/state/scene-commands.test.ts` (R)

### STATE-48 · The first cut fetches what it caps, and can be overtaken

- **Rule:** The first cut downloads the tissue envelopes it caps, and the cord where one is published. A cut overtaken while it downloads returns false, so the caller does not face it.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/scene-commands.js:133-143`
- **Expected:** `cut('axial')`, a new intent, envelopes and cord land → false, status ready. Envelopes already loaded, no cord → `cut('coronal')` true and the plane is coronal.
- **Covered by:** `src/lib/core/state/scene-commands.test.ts` (R)

### STATE-49 · Masthead choices retire the standing notice, and a failure leaves one notice

- **Rule:** Choosing an atlas, detail level or colour in the masthead clears the notice an earlier choice left. A failed switch that is still current leaves one notice in the reader's language; an overtaken one says nothing. Leaving HCP-MMP drops CAB-NP to region colours, as its option said.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/scene-commands.js:168-218`
- **Expected:** fr, Destrieux fails with `asset-fetch` HTTP 503 → status ready, notice matches `/^Impossible de charger Destrieux\. Un fichier n’a pas pu être téléchargé/`. Overtaken failure → notice null. CAB-NP shown, choose Destrieux → colour `atlas`, notice null. `chooseDetail('nextbrain')` → notice null at once. Choosing the atlas already shown with nothing on its way changes nothing.
- **Covered by:** `src/lib/core/state/scene-commands.test.ts` (R)

### STATE-50 · Cited regions are drawn on the layers that hold most of them, without a cut

- **Rule:** Revealing a set of cited regions loads the atlas and detail level that hold most of them, closes any cut, then shows them (STATE-52). Opening one region does the same and selects it. An empty set does nothing.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/scene-commands.js:145-166`
- **Expected:** `revealRegions(['destrieux:left:12'])` on hcp-mmp → Destrieux loaded, cut off, regions shown, true. `revealRegions([])` → nothing changes. `openRegion('aseg:left:11')` → shown and selected.
- **Covered by:** `src/lib/core/state/scene-commands.test.ts` (R, through overtaking cases; `STATE-50`: the cut closing, the empty set and `openRegion`)

## Clinical navigation

### STATE-51 · Cited regions need their layers; the loaded one is kept while it draws any of them

- **Rule:** Cortical evidence needs its atlas: when the loaded atlas draws none of the cited cortical regions, the atlas holding most of them is chosen. Structures likewise choose the detail level holding most of them, since only one is drawn at a time. A layer that already draws some of them is kept (null). An unknown citation, or one that is not cortex or a structure, is an error.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/clinical/navigation.js:1-34`
- **Expected:** `destrieux:left:38` on hcp-mmp → `{ atlas: 'destrieux', detail: null }`; on destrieux → both null. `destrieux:right:26`, `aseg:right:49`, `aseg:right:50`, `nextbrain:right:7` on learning → `{ atlas: 'destrieux', detail: 'aseg' }`; on nextbrain → detail null. `a:1, b:1, b:2` → atlas `b`. `unknown` → "Unknown clinical region: unknown"; a non-region `wall` → "Unknown clinical region: wall". With no cortical or no structure citation that layer is `null` (`clinical-navigation.ts:48-56`, as legacy `navigation.js:29-33`).
- **Covered by:** `src/lib/core/state/clinical-navigation.test.ts` (R)

### STATE-52 · Cited regions are shown together with nothing hiding them

- **Rule:** Showing cited regions clears isolation and the system filter, shows both hemispheres, shows the cortex only if a cortical region is cited (making a fully transparent cortex opaque), shows the internal anatomy if a structure is cited, then shows the regions. An empty list changes nothing.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/clinical/navigation.js:36-50`
- **Expected:** cortical, opacity 0 → isolation cleared, system null, hemisphere both, cortex shown, opacity 1, regions shown. Structure only → cortex hidden, internal shown, no opacity change. `[]` → no change.
- **Covered by:** `src/lib/core/state/clinical-navigation.test.ts` (R; it pins the call sequence, of which only "regions shown last" is the rule)

## Paint and the stage key

### STATE-53 · A tab paints only while it is in front, on its own atlas, and not once lifted

- **Rule:** The open function paints the brain while Functions is in front and the atlas is the one its map is defined on; the open deficit (or one of its findings) paints while Deficits is in front. Nothing paints once the reader lifted the paint, or on another tab. A paint's id names its tab.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/paint.js:1-22`
- **Expected:** domains on hcp-mmp: Functions, all, hcp-mmp → `function:all`; on destrieux → null; no function, lifted, or Anatomy tab → null. Deficits `aphasia` on destrieux → `deficit:aphasia`; finding `naming` → `deficit:aphasia:naming`; no deficit → null. `paintKind` of `function:language` → `function`, of `deficit:aphasia:naming` → `deficit`, of null → null.
- **Covered by:** `src/lib/core/state/paint.test.ts` (R)

### STATE-54 · The function key lists the overview, or one function's z scale

- **Rule:** With the overview painted, the key lists the overview functions in order, as toggles, with the note on strongest functions. With one function painted, the key is its z scale, strongest band first, not pickable, with the scale note (or the Neurosynth-term note for a term).
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/paint.js:24-62`
- **Expected:** cdmd scale `[3, 5, 10]`: memory in fr → title "Mémoire", rows `z ≥ 10` [10,62,125], `z 5 à 10` [43,131,199], `z 3 à 5` [150,200,240] with no-break spaces (en "z ≥ 10", "z 5 to 10", "z 3 to 5"), `pickable: false`, note "Mean consistency z per area; darker is more consistent. Tissue-coloured areas fall below 3." Overview → title "Neuropsychological functions", note "Each area shows its strongest function; tissue-coloured areas reach none. Choose one to see all its areas.", the 11 cdmd overview functions (executive … emotion), none pressed. No paint → null.
- **Covered by:** `src/lib/core/state/paint.test.ts` (R, on a three-domain fixture; `STATE-54`: the cdmd bands in both languages and the overview, on the published data)

### STATE-55 · The deficit key lists each finding, and greys one the view does not colour

- **Rule:** With a deficit painted, the key is titled with the deficit and lists each finding in its colour; the finding shown alone is pressed. A finding whose colour no drawn region carries is keyed but marked absent, and the note says why. A finding not picked while another is shown alone is muted, not absent.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/paint.js:63-90`
- **Expected:** aphasia with findings naming and repetition → title "Aphasia", rows `naming`/"Naming", `repetition`/"Repetition", none pressed, none absent. With `destrieux:left:2` not drawn → `[false, true]` and the note ends "An outlined finding has no region coloured in this view." Picked `naming` → `[false, false]`. Notes: one finding "The regions this finding cites; tissue-coloured regions are not cited."; picked "Only this finding’s regions. Choose it again for every finding."; all "One colour per finding; …".
- **Covered by:** `src/lib/core/state/paint.test.ts` (R)

### STATE-56 · Every published function and deficit has a paint and a key in both languages

- **Rule:** Over the published data, every function a link may name and every deficit and finding has a paint on its tab and a stage key whose rows follow STATE-54 and STATE-55.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/state/paint.js`; `public/models/cdmd/neuropsych-domains.json`; `data/neuropsychology.yaml`
- **Expected:** cdmd: for `all`, each of the 70 domains and each Neurosynth term on hcp-mmp → paint id `function:<id>`, and null on destrieux; a single function's key has the three bands of STATE-54 and is titled with its name in en and fr. For each of the 70 deficits in `data/neuropsychology.yaml` and each of its findings → `deficit:<id>` or `deficit:<id>:<finding>`; the key title is the deficit's name in en and fr and has one row per finding. Lifted paint → null.
- **Covered by:** `src/lib/core/state/paint.test.ts` (S, `STATE-56`: all 70 domains, 277 terms, 70 deficits and their findings, in both languages)

## Dissection

### STATE-57 · Each change of the hidden parts is one undo step

- **Rule:** Hiding, showing and restoring all record one history entry with the reader context to return to, but only when the hidden set changes. Undo puts back the previous set and returns that context; with no history it returns null. Snapshots cannot change the live set.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/dissection.js:1-53`
- **Expected:** `hide(['left'], { selectedId: 'left' })` → true; adding `right` to the snapshot leaves the live set `['left']`; `undo()` → `{ selectedId: 'left' }`, nothing hidden, `dissectionCanUndo` false. Hiding what is hidden, showing what is shown, or restoring with nothing hidden → false, no entry. `undo()` with no history → null.
- **Covered by:** `src/lib/core/state/dissection.test.ts` (R; `STATE-57`: the no-change and empty-undo cases)

### STATE-58 · A shared mask is validated whole and starts with no history

- **Rule:** Loading hidden parts from a link checks every id and starts with no undo history; one unknown id rejects the whole load and keeps the previous set. Ids must come as an array of strings. Reset clears the set and history.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/dissection.js:6-14,44-52`
- **Expected:** `load(['right'])` → can't undo. `load(['left','unknown'])` throws `/Unknown region/`, set still `['right']`. `hide('left')` throws `/array/`. `reset()` → nothing hidden, can't undo.
- **Covered by:** `src/lib/core/state/dissection.test.ts` (R; `STATE-58`: reset)

### STATE-59 · The hidden count is said as a sentence in the reader's language

- **Rule:** The announcer says the dissection count as the panel shows it.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/dissection.js:21,31`
- **Expected:** en 0 → "All parts shown", 1 → "1 part hidden", 7 → "7 parts hidden"; fr 0 → "Tout est visible", 1 → "1 partie masquée", 7 → "7 parties masquées".
- **Covered by:** `src/lib/core/state/dissection.test.ts` (R)

## Internal anatomy

### STATE-60 · Leaving internal anatomy gives back what entering took, and nothing else

- **Rule:** The reader is inside exactly while the cortex is hidden. Entering records the colouring and detail level it overwrites; leaving shows the cortex, restores that colouring, restores the detail level unless the reader picked another while inside (or it is already the one), and clears the system filter. Hemisphere, opacity and selection are left alone. A session that opened inside still has a way out, with region colours.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/internal-mode.js:1-46`
- **Expected:** outside `{ tissue, destrieux }`, entering applies `learning`; leaving from learning → `{ cortexVisible: true, surfaceColor: 'tissue', detail: 'destrieux', internalSystem: null, colourLost: null }`. Left from nextbrain → detail null. Entered on learning already → detail null. `leaveInternal(null, …)` → cortex shown, colour `atlas`, detail null. Only the keys `colourLost, cortexVisible, detail, internalSystem, surfaceColor`.
- **Covered by:** `src/lib/core/state/internal-mode.test.ts` (R)

### STATE-61 · An atlas switched inside wins over a colouring defined on the atlas left behind

- **Rule:** When the colouring to restore is defined on another atlas than the one now shown, region colours return and the lost colouring is named.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/internal-mode.js:35-46`
- **Expected:** required `{ 'cab-np': 'hcp-mmp', functional: 'hcp-mmp' }`: entered with cab-np on hcp-mmp, left on destrieux → colour `atlas`, `colourLost: 'cab-np'`; left on hcp-mmp → colour `cab-np`, `colourLost: null`. The same for `functional`.
- **Covered by:** `src/lib/core/state/internal-mode.test.ts` (R)

## Boot decision

### STATE-62 · The other atlas is fetched ahead only when the GPU and connection allow it

- **Rule:** The cortical atlas worth fetching ahead is the first one not shown, and only on a GPU profile that can hold both and a connection that is neither metered nor slow.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/boot.js:16-19`
- **Expected:** atlases destrieux, hcp-mmp: shown destrieux → hcp-mmp; shown hcp-mmp on 4g → destrieux. `prefetchLayers: false` → null. `saveData: true` (even on 4g), `slow-2g`, `2g`, `3g` → null. One atlas only → null.
- **Covered by:** `src/lib/core/state/boot.test.ts` (R); the boot call: BOOT-11 in `boot-and-assets.md`

## The link writer

### STATE-63 · The link is written once the scene is still

- **Rule:** Every request to write restarts a wait; the link is written once no request came for the wait (250 ms by default, or the wait asked for). A cancelled write never lands.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/link-writer.js:7-17`; decision on link timing (comment 67 on #4)
- **Expected:** schedule, +200 ms, schedule, +200 ms → 0 writes; +50 ms → 1. schedule, cancel, +1000 ms → 0. `schedule(0)` writes on the next tick.
- **Covered by:** `src/lib/core/state/link-writer.test.ts` (R; `schedule(0)` via `src/lib/state/stores.svelte.test.ts`, see LINK-05)

### STATE-64 · While a link is applied the address bar keeps it

- **Rule:** A restore holds the writer with its own intent check: no write lands while that restore is current. A restore that is overtaken holds nothing. An older restore cannot release a newer one's hold.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/link-writer.js:13-24`
- **Expected:** hold(restoring), schedule, +1000 ms → 0 writes. Restoring overtaken, schedule, +250 ms → 1. hold(next), release(restoring), schedule, +250 ms → still 1; release(next), schedule, +250 ms → 2.
- **Covered by:** `src/lib/core/state/link-writer.test.ts` (R)

### STATE-65 · A link without a subject means the published default

- **Rule:** A link names the brain on screen when its anatomy, or the published default if it names none, is that brain.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/link-writer.js:26`
- **Expected:** default `cdmd`: `{}` on cdmd → true; `{}` on `other` → false; `{ anatomy: 'other' }` on other → true; `{ anatomy: 'other' }` on cdmd → false; `{ anatomy: null }` on cdmd → true.
- **Covered by:** `src/lib/core/state/link-writer.test.ts` (R, with retired anatomy ids as opaque strings)
