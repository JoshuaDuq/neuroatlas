# State rules: rune stores, preferences and the stage layout

Scope: chunk S1 (#32), the reactive stores over the pure session (`state/session.svelte.ts`), the one
view every panel reads and the effects that keep the engine, the catalog, the announcer and the link in
step with it (`view.svelte.ts`, `engine-sync.svelte.ts`, `catalog.svelte.ts`, `link.svelte.ts`); the
U2 (#14) preference services (`prefs.ts`, `theme.svelte.ts`, `language.svelte.ts`, `media.svelte.ts`);
and the G1 stage-layout store (`stage-layout.svelte.ts`). Legacy sources: `viewer/app.js` (the render
effect, 1612-1693), `viewer/state/{session,theme,boot}.js`, `viewer/learning/session.js`,
`viewer/ui/chrome/{viewport-chrome,stage-tools,shortcuts,sheet}.js`, `viewer/styles/phone.css`. New code:
`web/src/lib/state/`. Deviations: `u2-theme-switch-frames.md`, `c4-unbalanced-notice-release.md`.
The announcer's sentences are KEY-17 to KEY-21 in `controller.md`; the session's own command semantics
(refused views, notice joining, switching status) are C4 rules in `core-state.md`. Lengths are CSS px.

## The view

### STORE-01 · Every panel reads one view: the model, the session over it, the lesson and the anatomies

- **Rule:** The view is the engine's display state with the session's state laid over it, plus the lesson's progress, the anatomy on screen and the anatomy the tracts belong to. A session or lesson command shows in the view at the next flush.
- **Kind:** behaviour
- **Level:** unit (runes, no DOM)
- **Source:** `viewer/app.js:1612-1640`; `viewer/state/session.js` (`assemble`)
- **Expected:** Published `cdmd` manifest, fake engine. `view.anatomy === 'cdmd'`, `view.referenceAnatomy` is the engine's tract anatomy, `view.atlas` the model's atlas, `view.lang === 'en'`. After `setLang('fr')`, `lesson.start('circuit')`, `lesson.go(2)` and a flush: `lang === 'fr'`, `lesson` equals `{ circuit: 'circuit', step: 2, visited: [0, 2] }`.
- **Covered by:** `src/lib/state/stores.svelte.test.ts` (R, could move down)

### STORE-02 · The view follows every engine change, as a copy, until disposed

- **Rule:** Each engine `change` replaces the mirrored model and sections state with fresh copies, at once, so a section state mutated in place still counts as a change. After dispose, engine changes are no longer followed.
- **Kind:** behaviour
- **Level:** unit (runes, fake engine)
- **Source:** `viewer/app.js:1612`; new `engine-sync.svelte.ts`
- **Expected:** `engine.model.setHemisphere('left')` → `engineState.model.hemisphere === 'left'` before any flush, `view.hemisphere === 'left'` after. `engine.sections.setDisplay({ reverse: true })` → `engineState.sections` is a new object with `reverse: true`; the previous object still has `reverse: false`. After `dispose()`, `setHemisphere('right')` leaves `engineState.model.hemisphere` unchanged.
- **Covered by:** `src/lib/state/stores.svelte.test.ts` (R, could move down)

### STORE-03 · A session command shows at once and keeps the session's answer

- **Rule:** Every session command, accepted or refused, leaves the reactive state equal to the session's assembled state. It returns what the session returns and throws what the session throws.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/session.js`; new `session.svelte.ts`
- **Expected:** Views `['oblique', 'left']`. `setView('left')` → `true`, `state.view === 'left'`; `setView('nowhere')` → `false`, `state.view` stays `'left'`; `setExplorer('nowhere')` throws `Error('Unknown explorer: nowhere')`. Over a seeded run of the 22 commands (seeds 1–8, 400 steps, mulberry32), after each step `store.state` deep-equals the session's `assemble({})` and the return or throw is the session's. The command semantics themselves are C4 (`core-state.md`).
- **Covered by:** `src/lib/state/session-store.test.ts` (R) (fixed commands; the state equals the core session's after each); `src/lib/state/stores.svelte.test.ts` (R, three commands)

### STORE-04 · The lesson store shows each step taken, and refuses a step that does not exist

- **Rule:** Starting, stepping and closing a lesson show in the reactive lesson state at once. A refused step throws and leaves the state as it was.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/learning/session.js`
- **Expected:** A lesson of 4 steps. `start('c')` → `{ circuit: 'c', step: 0, visited: [0] }`; `go(2)` → `{ circuit: 'c', step: 2, visited: [0, 2] }`; `go(2)` again keeps `visited: [0, 2]`; `go(4)`, `go(-1)` and `go(1.5)` throw `RangeError('Invalid landmark index: …')` and the state is unchanged; `close()` → `{ circuit: null, step: 0, visited: [] }`.
- **Covered by:** `src/lib/state/session-store.test.ts` (R); `src/lib/state/stores.svelte.test.ts` (R, start and go, through STORE-01); `src/lib/core/learning/session.test.ts` (R, the core rules)

### STORE-05 · Notices held while a link applies show only at the last release

- **Rule:** The store passes notice holding through unchanged: notices raised while held do not show; the last release shows them after the link's own notice, as one notice; the next action clears it.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/session.js` (`holdNotices`, `releaseNotices`); deviation `c4-unbalanced-notice-release.md`
- **Expected:** `holdNotices()`, `notify({ text: 'First.' })`, `notify({ text: 'Second.', action: 'reload' })` → `state.notice === null`; `releaseNotices({ text: 'Link.' })` → `{ text: 'Link. First. Second.', action: 'reload' }`; `setQuery('x')` → `null`. Two holds, `notify({ text: 'Waiting.' })`, one release → `null`; the second release → text `'Waiting.'`.
- **Covered by:** `src/lib/state/stores.svelte.test.ts` (R)

## What the view drives

### STORE-06 · The model shows the paint of what the view has open

- **Rule:** The model is painted from the view before the view is read: the open deficit or finding paints it, lifting the paint clears it, leaving the explorer clears it. The loop ends because a paint already shown is not set again.
- **Kind:** behaviour
- **Level:** unit (runes, fake engine)
- **Source:** `viewer/app.js:1612`
- **Expected:** `setExplorer('deficits')`, `setDeficit('aphasia')` → model paint id `'deficit:aphasia'`; `liftPaint()` → `null`; `setFinding('naming')` → `'deficit:aphasia:naming'`; `setExplorer('anatomy')` → `null`.
- **Covered by:** `src/lib/state/stores.svelte.test.ts` (R)

### STORE-07 · The stage is told the view's language and whether the tract reference stands alone

- **Rule:** The stage presents in the view's language. On the diffusion tab, when the tracts belong to another anatomy than the brain on screen, the tract reference is shown alone.
- **Kind:** behaviour
- **Level:** unit (runes, fake engine)
- **Source:** `viewer/app.js:1618-1630`
- **Expected:** At start `presented` is `{ lang: 'en', referenceOnly: false }`; `setLang('fr')` → `{ lang: 'fr', referenceOnly: false }`. Tract anatomy `'other'`, `setExplorer('diffusion')` → `{ lang: 'en', referenceOnly: true }`.
- **Covered by:** `src/lib/state/stores.svelte.test.ts` (R)

### STORE-08 · The atlas comparison outline hides while a cut is drawn or the reference stands alone

- **Rule:** The comparison overlap outline is visible only while the sections are off and the tract reference is not shown alone.
- **Kind:** behaviour
- **Level:** unit (runes, fake engine)
- **Source:** `viewer/app.js:1638-1639`
- **Expected:** `comparison.highlight('pair', …)` → highlighted `'pair'`; `sections.setMode('axial')` → `null`; `setMode('off')` → `'pair'`. With the reference alone (STORE-07) → `null`.
- **Covered by:** `src/lib/state/stores.svelte.test.ts` (R, the cut only); the reference-alone case is uncovered

### STORE-09 · The region list follows the view's display and language

- **Rule:** The catalog's language follows the view's, and its groups and visible count are recomputed from the view, so hiding the cortex or changing the language updates the list.
- **Kind:** behaviour
- **Level:** unit (runes)
- **Source:** `viewer/app.js:1620-1623`
- **Expected:** Published `cdmd` catalog. The visible count is above 0 and drops when `setCortexVisible(false)`; after `setLang('fr')` the store's `lang` is `'fr'` and its groups carry the French labels. The counts and one group label in each language should be fixed from the published manifest.
- **Covered by:** `src/lib/state/stores.svelte.test.ts` (W: expectations recomputed with the same `catalog.groups` and `catalog.visibleCount` calls)

### STORE-10 · The view's sentences reach the page's live region as the view changes

- **Rule:** Each view change is passed through the speech rules (KEY-17 to KEY-21) and what they return is written to the page's one live region. An eye press's part sentence is said with the hidden count it changes.
- **Kind:** behaviour
- **Level:** unit (runes; the region can be a plain object)
- **Source:** `viewer/app.js:1658-1693`; decision 36 on #4
- **Expected:** First view → region `''`. Select a region → `'Selected: <name>, <side>'`; `notify({ text: 'Something changed' })` → `'Something changed'`; hide it → `'1 part hidden'`. Clear the notice, Undo → `'Selected: <name>, <side>. All parts shown'`. `part('Hidden: Precentral gyrus, left.')` + hide → `'Hidden: Precentral gyrus, left. 1 part hidden'`; `part('Shown: …')` + show → `'Shown: Precentral gyrus, left. All parts shown'`. `setContextLost()` → `'The 3D view was interrupted by the graphics driver. Restoring…'`; `setStatus('ready')` → `'Anatomy loaded.'`.
- **Covered by:** `src/lib/state/stores.svelte.test.ts` (R, could move down)

### STORE-11 · The link is written 250 ms after the view settles, and as soon as the camera rests

- **Rule:** Stated once as LINK-05 (`links.md`); this entry only points there, so the rule is tested once.
- **Kind:** behaviour
- **Level:** see LINK-05
- **Source:** see LINK-05
- **Expected:** see LINK-05
- **Covered by:** see LINK-05

### STORE-12 · A held link writes nothing, and a gone component writes nothing

- **Rule:** Stated once as LINK-05 (`links.md`); this entry only points there, so the rule is tested once.
- **Kind:** behaviour
- **Level:** see LINK-05
- **Source:** see LINK-05
- **Expected:** see LINK-05
- **Covered by:** see LINK-05

## Remembered choices

### STORE-13 · The reader's choices are remembered under the keys the legacy viewer wrote

- **Rule:** Theme, language, single-key shortcuts and the retired stage hint are stored under fixed `localStorage` keys, so a reader's earlier choices carry over.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/state/theme.js:1`; `viewer/app.js:95, 612`; `viewer/ui/chrome/shortcuts.js:29`; `viewer/ui/chrome/viewport-chrome.js:54`
- **Expected:** `planum.theme`, `planum-lang`, `planum.single-key-shortcuts`, `planum.stage-hint`. A written value reads back; writing `null` removes the key (store `{}`).
- **Covered by:** `src/lib/state/prefs.test.ts` (R)

### STORE-14 · Blocked site data remembers nothing and breaks nothing

- **Rule:** Where site data is blocked, or there is no storage, a read finds nothing and a write is dropped without an error. The default storage is `localStorage`, or none where reading it throws.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/theme.js:9-16, 70-75`
- **Expected:** Storage whose every call throws `SecurityError`: `readPref` → `null`; `writePref(key, 'dark')` and `writePref(key, null)` do not throw. Storage `null`: same. No global → `defaultStorage() === null`; a global → that object; a getter that throws → `null`.
- **Covered by:** `src/lib/state/prefs.test.ts` (R)

### STORE-15 · Single-key shortcuts are on unless the reader turned them off

- **Rule:** The single-key shortcut preference is on by default, and the reader's choice survives a reload. Without storage it still works for the visit.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/shortcuts.js:29`; `viewer/ui/chrome/shortcuts.test.js:34-52`
- **Expected:** Empty storage → `enabled === true`. `set(false)` → `false`, stored `'off'`, a new preference reads `false`. `set(true)` → stored `'on'`, a new preference reads `true`. Blocked storage: starts `true`, `set(false)` → `false`.
- **Covered by:** `src/lib/state/prefs.test.ts` (R)

## Theme

### STORE-16 · With nothing stored the theme follows the system, live

- **Rule:** With no stored choice the choice is System: the theme is the OS colour scheme at load and follows each OS switch. Each theme in effect sets `data-theme` on `<html>` and is reported once.
- **Kind:** behaviour
- **Level:** unit (fake document and media query)
- **Source:** `viewer/state/theme.js:25-60`
- **Expected:** The query asked is `(prefers-color-scheme: dark)`. System light → `choice 'system'`, `current 'light'`, `data-theme="light"`, reported `['light']`; system dark → the same with `'dark'`. Flip to dark then light → `current` follows, reported `['light', 'dark', 'light']`.
- **Covered by:** `src/lib/state/theme.test.ts` (R)

### STORE-17 · Light or dark is remembered and stops the following; System forgets it

- **Rule:** Choosing light or dark stores it and stops following the OS. A stored light or dark is the choice at load, with no OS listener. Choosing System removes the stored value and follows the OS again, with one listener however often it is chosen. Dispose removes the listener. Blocked site data still themes, without memory.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/theme.js:62-85`
- **Expected:** `choose('dark')` → stored `planum.theme = 'dark'`, 0 listeners, OS flips ignored, reported `['light', 'dark']`; `choose('light')` → stored `'light'`, `data-theme="light"`. Stored `'dark'` at load → `choice 'dark'`, 0 listeners. Stored `'light'`, system dark, `choose('system')` → key removed, `current 'dark'`, 1 listener; again → still 1; flip to light → reported `['light', 'dark', 'dark', 'light']`; `dispose()` → 0. Blocked storage, system dark: `dark` → `choose('light')` → `light` → `choose('system')` → `dark`.
- **Covered by:** `src/lib/state/theme.test.ts` (R)

### STORE-18 · A stored light or dark wins at load; anything else follows the system

- **Rule:** The theme in effect for a stored value: light or dark as stored, anything else (nothing, System, an unknown word, empty) from the OS. The head's pre-paint script applies the same rule before the app loads.
- **Kind:** behaviour
- **Level:** unit
- **Source:** decision 2 on #4; deviation `h1a-theme-flash.md`
- **Expected:** `('light', dark OS) → 'light'`; `('dark', light OS) → 'dark'`; for `null`, `'system'`, `'sepia'`, `''`: dark OS → `'dark'`, light OS → `'light'`.
- **Covered by:** `src/lib/state/theme.test.ts` (R); the head script itself is in `shell.md`

### STORE-19 · A theme switch is a swap, not a fade

- **Rule:** Each switch holds colour transitions off for two animation frames, so the palettes swap in one painted frame. A second switch inside those frames holds them for its own two frames. Dispose inside the frames releases the hold for good.
- **Kind:** behaviour
- **Level:** unit (fake animation frames)
- **Source:** `viewer/state/theme.js:41-44`; deviation `u2-theme-switch-frames.md`
- **Expected:** `choose('dark')` → `data-theme-switching=""` and `data-theme="dark"`; after frame 1 still present; after frame 2 absent. `choose('dark')`, frame, `choose('light')`, frame → still present; next frame → absent. `choose('dark')`, `dispose()` → absent at once and after two frames. The CSS side is UI-12.
- **Covered by:** `src/lib/state/theme.test.ts` (R)

### STORE-20 · The browser's own chrome continues the masthead colour

- **Rule:** On every theme in effect, the `theme-color` meta takes the current `--surface-base`, also on an OS switch.
- **Kind:** behaviour
- **Level:** unit (fake computed style); browser for the real token
- **Source:** `viewer/state/theme.js:45-47`
- **Expected:** With `--surface-base` light `#ffffff`, dark `#1b1e21` (`src/styles/tokens.css:19, 135`): load light → meta `#ffffff`; OS to dark → `#1b1e21`; `choose('light')` → `#ffffff`.
- **Covered by:** `src/lib/state/theme.test.ts` (R) (fake surfaces `#ffffff` and the real dark `#1b1e21`; the token itself is pinned by UI-06 in `src/styles/tokens.test.ts`)

### STORE-21 · An unknown theme choice is an error

- **Rule:** A choice other than System, light or dark fails loudly and changes nothing.
- **Kind:** hygiene
- **Level:** unit
- **Source:** `viewer/state/theme.js:68`
- **Expected:** `choose('sepia')` throws `RangeError('Unknown theme choice: sepia')`; `choice` stays `'system'`.
- **Covered by:** `src/lib/state/theme.test.ts` (R)

## Language

### STORE-22 · The start language is the link's, else the saved French, else English

- **Rule:** A link's language wins. Without one, a saved `fr` starts in French; anything else starts in English. A `lang` the link gets wrong (unknown, repeated) carries no language (decoding is S4's).
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/boot.js:4-7`
- **Expected:** `('fr', 'en') → 'fr'`; `(none, 'fr') → 'fr'`; `(none, null) → 'en'`; `('en', 'fr') → 'en'`; `(none, 'de') → 'en'`. Links `#lang=de` and `#lang=en&lang=fr` decode to no language, so the saved value decides.
- **Covered by:** `src/lib/state/language.test.ts` (R, every saved value with and without a link language; the link column is S4's)

### STORE-23 · A chosen language is remembered and sets the page language; a link's is not remembered

- **Rule:** The language at start and every change set `<html lang>`. The reader's choice is stored; a language that arrives with a link is shown and announced but not stored. A language other than English or French is an error. Blocked site data still switches.
- **Kind:** behaviour
- **Level:** unit (fake document)
- **Source:** `viewer/app.js:95, 612`; deviation `h1a-html-lang.md`
- **Expected:** Saved `fr` → `current 'fr'`, `lang="fr"`. Link `en` over saved `fr` → `current 'en'`, storage still `fr`. Nothing saved → `lang="en"`; `set('fr')` → `current 'fr'`, `lang="fr"`, stored `planum-lang = 'fr'`. Saved `en`, `follow('fr')` → `lang="fr"`, storage still `en`. `set('de')` and `follow('de')` throw `RangeError`; `current` unchanged.
- **Covered by:** `src/lib/state/language.test.ts` (R)

## Device

### STORE-24 · The device is asked about in one place, and the answers stay live

- **Rule:** Four media queries describe the reading device: the compact (phone) shell, a phone held sideways, a coarse pointer and reduced motion. Each answer is its own query's, and a change re-runs whatever reads it.
- **Kind:** behaviour
- **Level:** unit (stubbed `matchMedia`, runes)
- **Source:** `viewer/ui/chrome/sheet.js:37`; `viewer/styles/phone.css:15`
- **Expected:** Phone `(max-width: 800px), (max-height: 480px) and (orientation: landscape)`; sideways `(max-height: 480px) and (orientation: landscape)`; coarse `(pointer: coarse)`; reduced motion `(prefers-reduced-motion: reduce)`. Answers `true/false/true/false` read back in that order. An effect reading `phone` sees `[false, true]` after the phone query flips.
- **Covered by:** `src/lib/state/media.svelte.test.ts` (R, could move down)

## Stage layout

### STORE-25 · The dock and the scale bar share the bottom line while they fit

- **Rule:** The dock and the scale bar sit on one line while their widths and 48 px of margins and gap fit the visible width (wide). Otherwise the bar rises a line (tight), and a bar that would reach the middle of the stage is raised another (stacked). A hidden bar takes no room; without a visible rectangle the chrome is wide.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/viewport-chrome.js:20, 188-195`
- **Expected:** Dock 300 px, bar 100 px: visible width 448 → `wide`, 447 → `tight`. Width 400: bar 152 → `tight`, 153 → `stacked`. Width 360, bar 0 → `wide`. No rectangle, dock 900 × 400 → `wide`.
- **Covered by:** `src/lib/state/stage-layout.svelte.test.ts` (R, could move down)

### STORE-26 · The dock is tall once it and the letter above it pass the middle of the stage

- **Rule:** The dock counts as tall when its height plus 64 px is more than half the visible height. Without a visible rectangle it is not tall.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/viewport-chrome.js:203`
- **Expected:** Visible 800 × 400: dock height 136 → `false`, 137 → `true`. No rectangle, dock height 400 → `false`.
- **Covered by:** `src/lib/state/stage-layout.svelte.test.ts` (R, could move down)

### STORE-27 · A hint gets the room left by the top letter and the colour keys

- **Rule:** One line of the stage hint may span half the visible width less the right key band, the gutter and 20 px for the top letter. With a key in the top band it may span the width beside the key, less three gutters. Before the stage has a size there is no room value.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/viewport-chrome.js:26, 482`
- **Expected:** Visible 800 × 600, gutter 20: `360`; right band 100 → `310`; top band 40 with keys 220 px wide → `520`. No rectangle → `null`.
- **Covered by:** `src/lib/state/stage-layout.svelte.test.ts` (R, could move down)

### STORE-28 · A stage with no size, or the rectangle already held, changes nothing

- **Rule:** A viewport report with a zero-sized stage is ignored, and so is one that repeats the rectangle and stage size already held. A new stage size with the same rectangle is taken.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/viewport-chrome.js:707-713`
- **Expected:** Held 800 × 600. Rectangle 500 × 500 with size 0 × 0 → the same `visibleRect` object. Same rectangle and size → the same object. Same rectangle, size 900 × 600 → `hostSize` `{ width: 900, height: 600 }`.
- **Covered by:** `src/lib/state/stage-layout.svelte.test.ts` (R, could move down)

### STORE-29 · The section row folds its details on a phone, elsewhere only when its line does not fit

- **Rule:** Reverse side and Linked MRI fold behind the section row's disclosure always on a phone, elsewhere only when the row's one-line width exceeds the visible width less two gutters, and never before the stage has a size. Each webfont arrival is counted so a width measured before it is measured again.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/stage-tools.js` (`compactSection`); `viewer/ui/chrome/viewport-chrome.js:169-176`
- **Expected:** Visible 500 wide, gutter 20: need 460 → `false`, 461 → `true`; then visible 600 → `false`. Phone, no rectangle → `false`; phone, visible 500 → `true`. `fontsLoaded()` raises `fontEpoch` by 1.
- **Covered by:** `src/lib/state/stage-layout.svelte.test.ts` (R, could move down); the section bar itself is in `sections.md`

### STORE-30 · The dock's size is watched while it is mounted

- **Rule:** The dock's border box is observed and its rounded size reaches the store, and each observed change asks the camera to keep its fit.
- **Kind:** behaviour
- **Level:** browser: ResizeObserver on a laid-out element
- **Source:** `viewer/app.js:388`
- **Expected:** A fixed 321 × 45 element → `dock` `{ width: 321, height: 45 }`; height to 60 → `60`. With `onDock` recording the height: 40 px → `[40]`; to 90 → `[40, 90]`.
- **Covered by:** `src/lib/state/stage-layout.svelte.test.ts` (R)

### STORE-31 · The camera refits when the key band changes, but not for the store's own fitting

- **Rule:** A changed colour-key band asks the camera to keep its fit; an unchanged band (even with a new key size) does not. Fitting the keys during framing never asks. A desktop viewport change that moves the band asks once; on a phone the sheet's settle reframes instead, so it does not.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/viewport-chrome.js:265, 721-722`
- **Expected:** `setKeys({ top: 0, right: 90 }, …)` → 1 call; same band, keys 220 px tall → 1; `{ top: 30, right: 0 }` → 2. `framing()` with a fitter that sets top 30 → inset top 30, 0 calls. Viewport 800 × 600 with that fitter: desktop → 1 call, phone → 0; then 700 × 600 with the band unchanged → still 1.
- **Covered by:** `src/lib/state/stage-layout.svelte.test.ts` (R, could move down)

### STORE-32 · Framing keeps the anatomy clear of the dock and the colour keys

- **Rule:** The framing insets hold the colour-key band and, at the bottom, the dock's reach (its height plus the gutter) adjusted for the markings. A raised phone sheet hides the dock, so nothing is cleared under it. The key fitter runs before the insets are read.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/viewport-chrome.js:263-270`; `FRAME_FILL = 0.8`
- **Expected:** No rectangle, gutter 20, dock 300 × 38 → `{ inset: { top: 0, right: 0, bottom: 58 }, scale: { horizontal: 1, vertical: 1 } }`. Visible 800 × 600, no markings → the same insets and scale `1 / 1`. Sheet raised → bottom `0`, scale `1 / 1`. Key fitter setting `{ top: 30, right: 0 }` → it runs once, inset top `30`, right `0`.
- **Covered by:** `src/lib/state/stage-layout.svelte.test.ts` (R, could move down; the no-markings case derives its expectation through `clearFraming` instead of the fixed values)

### STORE-33 · The orientation letters and the scale bar take the room they are drawn in

- **Rule:** Each orientation letter clears its box plus an 8 px gap from its edge of the framing rectangle; the bottom letter is measured from the dock's reach. A scale bar in the upper half adds to the top, in the lower half to the bottom; a hidden bar counts nowhere. A tall dock drops the bottom letter. Hidden letters, or a raised sheet, take no room.
- **Kind:** behaviour
- **Level:** browser: boxes measured from layout
- **Source:** `viewer/ui/chrome/viewport-chrome.js:23, 236-256`
- **Expected:** Stage 800 × 600, gutter 20, dock 300 × 38; letters 10 × 20 at top (395, 12), bottom (395, 500), left (12, 250), right (778, 250); bar 120 × 20 at (650, 560). Clearance top 40, bottom 50, left 30, right 30 → framing inset bottom `68`, scale `{ horizontal: 1, vertical: 216.8 / 212.8 ≈ 1.0188 }` (±1e-9). Bar at top 100 → inset bottom smaller than without the bar; the same bar hidden → equal to no bar. Dock 300 × 300, bar hidden → tall, bottom letter dropped: inset bottom `280`, scale `{ 1, 0.875 }`. Letters hidden → inset bottom `58`; sheet raised → `0`.
- **Covered by:** `src/lib/state/stage-layout.svelte.test.ts` (R; expectations derived through `clearFraming`, replace with the fixed values above)

### STORE-34 · The dock's height is on the stage the moment it is known, and measured again at framing

- **Rule:** `--dock-height` and `data-dock-tall` are written on the stage host as soon as the dock's size changes, so framing in the same task measures the letters against the new dock. Framing reads the dock's height again in case the observer has not yet run.
- **Kind:** behaviour
- **Level:** browser: CSS variable and layout in the same task
- **Source:** `viewer/ui/chrome/viewport-chrome.js:198-203`
- **Expected:** `setDock({ 300, 120 })` → host `--dock-height: 120px`, `data-dock-tall="false"`; `{ 300, 300 }` → `"true"`. A bottom letter placed with `bottom: calc(20px + var(--dock-height) + 8px)`, dock 38 then 120 in one task → the letter's top is at 432 and the framing uses reach 140. A fixed dock 70 px tall, framed before the observer reports → inset bottom ≥ 90, `dock.height === 70`.
- **Covered by:** `src/lib/state/stage-layout.svelte.test.ts` (R)

### STORE-35 · The drag-and-scroll hint retires for good after the reader's first move

- **Rule:** The first rotate, zoom or click retires the stage hint; the retirement is remembered, so later visits start without it. Without storage it is retired for this visit.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/viewport-chrome.js:53-60, 603`
- **Expected:** `hintRetired === false`; `retireHint()` → `true`, stored `planum.stage-hint = 'retired'`; a new store on that storage → `true`. Storage holding `'retired'` at load → `true`. No storage, `retireHint()` → `true`.
- **Covered by:** `src/lib/state/stage-layout.svelte.test.ts` (R, could move down); the hint's text and display are in `stage.md`
