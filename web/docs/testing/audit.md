# Test audit

Every test file under `web/` (Vitest unit and browser projects, `web/parity/`, Playwright `e2e/`) classified
against the rule on #4 (comment of 2026-10-26: parity is proven by business rules, not by legacy code
equivalence). The rule catalogues it points to are in `rules/`; the summary and conversion order are in
`README.md`.

Audited at `origin/svelte-rebuild` 92882a4 (after #135 G4 section bar, #137 Playwright container, #136 K5
follow-ups and #134 I1 panels region). Case counts and timings come from CI run 40377467496 (the PR run of
#137); files merged after it (the G4 files and `PanelsRegion.svelte.test.ts`) were counted from the source.

## Legend

**Class** (the file's main class; secondary classes in brackets):

| Letter | Class                     | Meaning                                                                                                  |
| ------ | ------------------------- | -------------------------------------------------------------------------------------------------------- |
| R      | business rule             | States what the app must do for the reader and checks fixed expected values.                             |
| S      | scientific or data result | Checks a numeric or data result against values from the published data, with tolerances.                 |
| D      | legacy comparison         | Imports `viewer/` and diffs outputs, call logs, source text or timings of legacy and new code.           |
| I      | implementation-pinning    | Pins calls, call order, internal structure, private state or source text instead of the observable rule. |
| W      | weak or tautological      | Asserts too little, re-derives the expectation with the code under test, or mocks away the subject.      |
| H      | hygiene                   | Repository, build, style or lint-like checks that are not a feature rule.                                |

**Runs at / should run at:** `unit` is the Vitest `unit` project (Node, no DOM); `browser` is the Vitest
`browser` project (`*.svelte.test.ts`, Chromium with SwiftShader WebGL); `e2e` is Playwright on the built
site (`e2e/journeys/`, the new app only; K19 deleted the 25 legacy-comparison specs of `e2e/parity/`, whose
rules are now proved by the browser tests the rule catalogues cite or by those journeys). `—` means the file should go.

**Action:** keep; convert to rules (the differential checks are replaced by rule tests against fixed
values, then the file is deleted); move down a level; merge with a duplicate; delete.

## Counts

| Class                       | Files | Notes                                                                                                                     |
| --------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------- |
| R business rule             | 192   | 120 unit, 48 browser, 24 e2e specs; many carry small I, W or S parts, named in the Class column                           |
| S scientific or data result | 8     | all unit: published-data checks with values from the data                                                                 |
| D legacy comparison         | 27    | 25 of the 26 `parity/*.test.ts` files and the two `*.parity.svelte.test.ts` files (`parity/F3.test.ts` is R with D parts) |
| I implementation-pinning    | 1     | `src/app/ports.test.ts` (kept: a cheap fail-fast contract)                                                                |
| W weak or tautological      | 1     | `src/lib/ui/kit-spike.svelte.test.ts` (delete)                                                                            |
| H hygiene                   | 8     | build, repository and stylesheet checks, and the WebGL probe                                                              |
| Total                       | 237   | 161 unit and 52 browser Vitest files, 24 Playwright specs                                                                 |

## Every test file

Paths are relative to `web/`. Cases are from the CI run (or counted from the source for files merged after it).

<!-- prettier-ignore -->
| File | Cases | Class | Runs at | Should run at | Action |
|---|---|---|---|---|---|
| `parity/C1.test.ts` | 12 (10 in the current file) | D | unit | — | convert to I18N-04 (one committed snapshot of both tables, functions at fixed arguments), I18N-05–I18N-11, I18N-16–I18N-29; then delete |
| `parity/C2.test.ts` | 8 | D | unit | — | convert to CAT-07, CAT-09, CAT-10, CAT-12, CAT-16–CAT-43 (fixed fixtures plus a few published-data values); then delete |
| `parity/C3.test.ts` | 251 (255 in the current file) | D | unit | — | convert to CAT-42, CAT-44–CAT-64 (one fixed input per rejection message, one published-content test per catalogue); then delete |
| `parity/C4.test.ts` | 25 | D | unit | — | convert to STATE-01–STATE-33, STATE-35, STATE-37–STATE-65 (D-only parts listed below); then delete |
| `parity/C5.test.ts` | 129 (15 `drawn` blocks × 8 seeds + 9 single) | D | unit | — | convert to PANEL-01–PANEL-07, PANEL-09–PANEL-20, PANEL-31, PANEL-32, PANEL-34 and the header and provenance rules PANEL-22–PANEL-30 point to (MAST-28–30, -32, -38, COLO-01, -02, PROV-01–05, -07, -08); then delete |
| `parity/E1.test.ts` | 24 | D (+H: 1 case checks that one three.js instance is loaded) | unit | — | convert to RENDER-01–RENDER-08, RENDER-10–RENDER-18, RENDER-20–RENDER-34, RENDER-38–RENDER-43; then delete |
| `parity/E2.test.ts` | 415 | D (+I: 398 cases pin compiled GLSL text, uniforms and cache keys) | unit | — | convert to SHADER-01–SHADER-35 and RENDER-35–RENDER-37 (unit, plus one browser compile test for SHADER-35 and pixel tests for SHADER-05–07, -14–16, -19, -31, -32); then delete |
| `parity/E3.test.ts` | 12 | D | unit | — | convert to TISSUE-01–TISSUE-38 (data rules TISSUE-05, -11 on the published envelopes and ribbon) and SLICE-06, -08, -09 (Volume); then delete |
| `parity/E4a.test.ts` | 7 | D (+R: the current half of "rejects the same invalid displays") | unit | — | convert to SLICE-11–SLICE-15, SLICE-17, SLICE-18, SLICE-29–SLICE-31, SLICE-33, SLICE-35; then delete |
| `parity/E4b.test.ts` | 10 | D (+H: 1 case, "comparison has teeth" tests the harness) | unit | — | convert to ATLAS-02, -04, -07–-09, -11–-13, -15–-47, -52; then delete |
| `parity/E5.test.ts` | 17 | D | unit | — | convert to SCENE-01–SCENE-03, SCENE-05–SCENE-08, SCENE-15, SCENE-20, SCENE-24, SCENE-26, SCENE-28, SCENE-32, SCENE-33 and FACADE-01; then delete |
| `parity/E6.test.ts` | 18 | D (+R: 2 cases, the two deviation checks, which duplicate `native-viewer.test.ts`) | unit | — | convert to DIFF-01–-11, -17–-23, -28–-30; then delete |
| `parity/E7.test.ts` | 15 | D (+R: 3 cases: held-state reports, modified camera keys, placing at the orbit limit) | unit | — | convert to FACADE-01, FACADE-04–FACADE-12, FACADE-15, FACADE-17–FACADE-26, FACADE-28, FACADE-29, FACADE-37; move the 3 R cases into held-view and framing unit tests; then delete |
| `parity/F3.test.ts` | 28 | R (+D: 2 version-map cases, 1 `legacyConfig.base` line; +I: 4 source-regex cases, 1 watcher spy; +H: 4 build cases) | unit | unit | convert the D cases to fixed-value tests of `workerVersions`/`headVersions` on a fixture tree (BUILD-05), and the source-regex cases to `run()` checks (ASSET-17, -19, -20); then move out of `parity/` (ASSET-16–20, SW-02–09, BUILD-01, -02, -04–08) |
| `parity/G6.test.ts` | 2 (243 caption fact sets × 2 languages; 1000 seeded steps) | D | unit | — | Convert to SNAP-01, -03, -04, -05, -06, -07, -09, then delete. |
| `parity/R2.test.ts` | 1 | D | unit | — | convert to INSP-27 (add the edge values to `src/lib/core/comparison-format.test.ts`); then delete |
| `parity/S1.test.ts` | 2 | D | unit | — | convert to STORE-03, STORE-04 (seeded command run against fixed expectations, not legacy); the command semantics it sweeps are C4 rules already R-covered in `core/state/session.test.ts` and `core/learning/session.test.ts`; then delete |
| `parity/S2.test.ts` | 9 (1 walk: 16 seeds × 60 steps; 2 overtakes × 12 delays; 6 scripts × 2 orders) | D | unit | — | convert to CTRL-01–03, CTRL-05–20; then delete |
| `parity/S3.test.ts` | 5 (a 6-seed × 60-step tab walk, 40 seeded landmark cases, 3 scripted runs) | D | unit | — | convert to CTRL-21–35, LESSON-01, -04, -05, -07–09; then delete |
| `parity/S4.test.ts` | 2 | D (+I: slices `viewer/app.js` source text and runs it with `new Function`) | unit | — | convert to LINK-02, LINK-03, LINK-09–LINK-17; then delete |
| `parity/S5a.test.ts` | 2 (case 1: over 20 000 presses) | D | unit | — | convert to KEY-01–14 (a table of fixed outcomes), case 2 to the core-state keyboard predicates; then delete |
| `parity/T1.test.ts` | 3 | D | unit | — | convert to TRACT-01, -02, -06, -15, -19 in `src/lib/core/tracts.test.ts`; then delete |
| `parity/U2.test.ts` | 8 | D | unit | — | convert to UI-14–UI-16, UI-19, UI-25, STORE-16, STORE-17, STORE-19–STORE-22; then delete |
| `parity/f1.test.ts` | 9 | D (+H: 1 case, manifest fits the types; +I: 1 case pins legacy `matchMedia` call order) | unit | — | convert to CAT-01–CAT-05 (fixed literals, plus a check of the new stylesheets); move the manifest-type case (CAT-06) to a non-parity unit file; then delete |
| `parity/f2.test.ts` | 3 | D | unit | — | convert to contract-suite cases (SLICE-02, SLICE-03, SLICE-16, SLICE-18, SLICE-19, SLICE-39 and ATLAS-04, -13, -15–22, -30, -35–40), so the fake and the real engine meet them alike; then delete |
| `parity/u1.test.ts` | 5 | D | unit | — | D: reads `viewer/styles/{tokens,phone,a11y,base,components}.css` and diffs declarations. Convert to UI-05–UI-11 (fixed token and declaration values; UI-09–UI-11 better as computed-style browser checks); then delete |
| `src/app/App.svelte.test.ts` | 6 | R | browser | browser | keep (SHELL-01, -02, -03, -04, -05, -07, -10, -18); it uses stub slot snippets, which is right for the shell. Add the desktop grid (SHELL-06) and the empty-slot case (SHELL-03). The region-composition tests (REGION-01–REGION-26) belong in a new browser test that mounts the real regions with the fake engine |
| `src/app/boot.svelte.test.ts` | 38 | R (+I: 3 cases and 1 assert pin mount/frame/dispose order and listener spies) | browser | browser (most cases are plain logic and could move to unit once `startApp` is given its document, `location` and `window`) | keep (BOOT-01, -04, -05, -07–14, -17–19, -25, -30, -31, ASSET-10; also CTRL-01, -37, LESSON-08, KEY-06, -07, -11, -14, -15, -19); trim the order and spy asserts; 9 cases hold other areas' rules (see Summary) |
| `src/app/head-script.test.ts` | 4 | R | unit | unit | keep (shell area: the pre-paint theme script). Its expected values come from the app's own `resolveTheme`/`startLanguage`, not fixed values: add a few fixed rows |
| `src/app/lifecycle.test.ts` | 2 | R | unit | unit | keep (BOOT-18) |
| `src/app/ports.test.ts` | 5 | I | unit | unit | keep (BOOT-20): the ports registry's fail-fast contract, cheap and meaningful, not a reader rule |
| `src/app/regions/PanelsRegion.svelte.test.ts` | 24 | R | browser | browser | keep (REGION-03, -07, -24, -25; also CTRL-08's focus hand-off to Undo, ANAT-22's joined part and count sentence, the `/` and Escape ports of KEY-); added by #134 after the audit's CI run; one axe case over two states |
| `src/app/webgl-check.test.ts` | 4 | R | unit | unit | keep (BOOT-01–03) |
| `src/boot/keep-cached.test.ts` | 3 | R | unit | unit | keep (SW-01; "only after a successful start" is uncovered) |
| `src/boot/webgl-probe.svelte.test.ts` | 1 | H | browser | browser | keep (BUILD-13): an environment precondition on real WebGL; its 2 viewer refs are comments |
| `src/features/anatomy/AnatomyExplorer.svelte.test.ts` | 24 | R | browser | browser | keep (ANAT-18, ANAT-30–ANAT-44, ANAT-46); move down to unit through a search view-model the match marking, sentences, cap and status text (ANAT-31, -36–-39); use fake timers for the 500 ms status pause |
| `src/features/anatomy/AnatomyTree.svelte.test.ts` | 52 | R (+I: 1 line pins `parentElement.className === 'treegrid-block'`) | browser | browser | keep (ANAT-01, ANAT-03–ANAT-29); drop the class-name line in the sticky case; move the row, group and section naming cases (ANAT-03–-05, -19) down to a tree view-model unit test |
| `src/features/anatomy/DissectionBar.svelte.test.ts` | 19 | R | browser | browser | keep (ANAT-50–ANAT-54, ANAT-57); the 4 wording rows of the `test.each` (ANAT-51) could move to the i18n unit test |
| `src/features/anatomy/SystemPicker.svelte.test.ts` | 15 | R | browser | browser | keep (ANAT-45–ANAT-48, ANAT-57); move down to unit the 4 option-list cases (ANAT-45: `systemOptions` is pure, the first case already calls it directly) |
| `src/features/anatomy/tree-css.test.ts` | 4 | H | unit | unit | keep (stylesheet lint for `tree.css`: layer order, line-height scale, declared tokens); or merge into `styles/stylesheets.test.ts` by adding plain stylesheets to its scan |
| `src/features/circuits/circuits-view.test.ts` | 4 | R | unit | unit | keep (CIRC-01, -15) |
| `src/features/circuits/circuits.svelte.test.ts` | 45 | R | browser | browser (+ unit for 6 cases) | keep (CIRC-02 to -27). Move down to a unit test of `createCircuitExplorer`: overtaken opening (CIRC-18), the MRI run's refusal and failure text (CIRC-22), the failure wording (CIRC-19), `landmarkSelected` (CIRC-06), the step sentence (CIRC-21). Shrink the axe matrix (slow tests). Add CIRC-23 (no region landmark) |
| `src/features/colophon/region-count.test.ts` | 4 | R | unit | unit | keep (COLO-03, COLO-04); pin "Loading 25%" instead of `/25/` |
| `src/features/deficits/deficits.svelte.test.ts` | 45 | R (+I: 1 case finds the native-cancel rule's text in the style sheets) | browser | browser (+ unit for 3 cases) | keep (DEF-02 to -33). Move down to a unit test of `createDeficitsExplorer`: latest wins (DEF-17), failure ownership and wording (DEF-18). Check the native cancel by its rendering, not the CSS text (DEF-04). Fake timers for DEF-11; add its language case; sample the sticky-heading walk (DEF-10); shrink the axe matrix |
| `src/features/deficits/profile-meta.test.ts` | 3 | R | unit | unit | keep (DEF-15) |
| `src/features/functions/functions-view.test.ts` | 10 | R (+W: 3 cases assert only a regex, a non-empty suggestion, or that two caveats differ) | unit | unit | keep (FUNC-01, -08, -09, -12, -15, -19, -20, -22, -23); pin the fixed values: "96 HCP-MMP areas at z ≥ 3", "Did you mean “Language”?", the caveat texts, 70 rows in 6 groups, 11 overview links |
| `src/features/functions/functions.svelte.test.ts` | 50 | R | browser | browser (+ unit for 4 cases) | keep (FUNC-02 to -07, -10 to -14, -16, -19 to -35). Move down to a unit test of `createFunctionExplorer`: latest wins (FUNC-17), failure wording and clearing (FUNC-18), the meta sentence (FUNC-15); the scope sentence to `functions-view.test.ts` (FUNC-03). Fake timers for FUNC-12 and -13; shrink the axe matrix. Add a case that opens `language` (FUNC-21, repeated lesion-check deficits) |
| `src/features/inspector/AtlasComparison.svelte.test.ts` | 48 | R (+S: 4 cases, V1 956.4 mm² / 34.4 %, SFG 23 rows, the 0.069 mm² row as `<0.1`, region 119 unassigned 72.0 mm² / 19.7 %; +I: 1 case pins 32 px height and weight 400 "as legacy") | browser | browser | keep (INSP-20–INSP-38); replace the 32 px / weight 400 case with INSP-36's target rule or drop it; move down the shown predicate, heading, "more" wording and row names (INSP-20, -21, -26, -28) with a view-model |
| `src/features/inspector/inspector.svelte.test.ts` | 47 | R (+S: 1 case, `aseg:left:8` volume 49 790 mm³; +W: 3 cases, notes only length > 0, domains one regex, networks only a "%" suffix) | browser | browser | keep (INSP-01–INSP-03, INSP-05–INSP-19; INSP-04 only W); strengthen the W cases with the data's text and order (INSP-02 notes, INSP-10 shares, INSP-12 order on `hcp-mmp:left:50`); move the datasheet metric choice and the empty-hint choice (INSP-01, -05) down to unit |
| `src/features/masthead/DataBar.svelte.test.ts` | 43 | R (+W 2: the increased-contrast border is only "not transparent"; the bar-tooltip case compares each tooltip to the note element it reads) | browser | browser | keep (MAST-26, -27, -29–-35, -37–-50). Move down to unit (view-model, already in `core/panels/header.test.ts`): the option-text and optgroup assertions of "options name what choosing them changes" and "French strings and names". Replace the fixed 150 ms `settle()` sleeps (see Slow tests) |
| `src/features/masthead/Masthead.svelte.test.ts` | 31 | R (+I 1: the `data-own-keys` case pins the attribute, not that the keymap ignores the key) | browser | browser | keep (MAST-01–MAST-25, MAST-43); convert the `data-own-keys` case to MAST-20's observable (a single-key press on a masthead control does nothing); merge the two axe cases into one |
| `src/features/provenance/provenance.svelte.test.ts` | 19 | R (+I 1: "the button appears only when the owner supplies an opener" is a component-prop contract) | browser | browser | keep (COLO-01, -02, -05, -06, -08; PROV-07, -08, -10–-17, -19–-22); cut the axe matrix (see Slow tests) |
| `src/features/sections/SectionBar.svelte.test.ts` | 37 (33 + 2 `test.each` × 2; not in durations.tsv) | R (+I: 1 case pins the store field `stage.sectionNeed` = dock width) | browser | browser | Keep (SECT-01 to -05, -08 to -21, -23, -24). Move SECT-19 (disabled without a cut) down to a view-model unit test. Runs against the real Dock (G2) and the fake engine. |
| `src/features/sections/section-controls.test.ts` | 15 | R | unit | unit | Keep (SECT-02, -04 to -09, -12, -15, -16, -18, -22). The fake engine's call log is read for `setMode` and `faceCut`. Those are the controls-to-engine contract, and `setView('anterior')` is checked too. |
| `src/features/sections/section-text.test.ts` | 12 | R | unit | unit | Keep (SECT-11, -14, -15, -17). |
| `src/features/sheet/Sheet.svelte.test.ts` | 54 | R | browser | browser | keep (SHEET-01, -03 to -30 in the browser; SHEET-01, -05, -06, -07 cases repeat the unit file through real pointer events, keep only one per rule); fix the speed (below) |
| `src/features/shortcuts/shortcuts.svelte.test.ts` | 17 | R | browser | browser (+unit for 2 data rules) | keep (SHORT-01, -04 to -12, -14 to -17); move down to unit: "every key the keymap acts on is listed" (SHORT-02, `SHORTCUT_KEYS` against the i18n rows) and the group and row counts of SHORT-01 |
| `src/features/snapshot/snapshot.parity.svelte.test.ts` | 1 | D | browser | — | Convert to SNAP-08 to SNAP-13 (a browser rule test that records the drawing), then delete. |
| `src/features/snapshot/snapshot.svelte.test.ts` | 13 | R (+I: 1 case, a fake keys model that contradicts the DOM to pin where the fold is read) | browser | browser (4 cases unit) | Keep (SNAP-02, -03, -04, -10, -11, -12, -14 to -18; STAGE-09). Move down: the two caption cases (SNAP-02, -04) take plain data once the caption inputs are split from `snapshotPlan`'s DOM reads. The join and failure cases (SNAP-17, -18) can use a stub stage and encoder. |
| `src/features/snapshot/snapshot.test.ts` | 8 | R | unit | unit | Keep (SNAP-01, -03, -04, -06, -07, -09). The `viewer/` mention is a "ported from" comment. This is the home for the G6 sweep as a fixed table (SNAP-05). |
| `src/features/stage/Dock.svelte.test.ts` | 49 | R (+I: 3 cases) | browser | browser | Keep (STAGE-06, -18 to -36). I: `data-own-keys` on the dock root should become a keymap test that a key pressed in the dock does not reach it (KEY-06, controller area). Also I: the `data-instant` attribute (STAGE-21), and `stage.dock.width` equal to the bounding box (store contract, `state.md`). Controller commands are `vi.fn` mocks, which is the dock-to-controller contract. |
| `src/features/stage/StageKeys.svelte.test.ts` | 43 | R (+I: 3 cases) | browser | browser | Keep (STAGE-37 to -48). Drop or move down the three crowd-fold cases that repeat `stage-keys.test.ts` (STAGE-40). I: `model()` return shape (G6's input), the layout-read spies ("forces no layout"), and the fitter release via a `setKeys` spy. |
| `src/features/stage/StageOverlay.svelte.test.ts` | 43 (5 retiring gestures, 2 × 4 text-size stages) | R (+W: 2 cases, +I: 2 cases) | browser | browser (2 groups unit) | Keep (STAGE-01 to -17). Move down to view-model unit tests: hint wording (STAGE-04) and the chip clamp (STAGE-14, with legacy's oversized-chip case). W: "shows the letter the camera reports" lets the fake answer; the scale label re-derives its expectation with `withUnit(decimal(…))`. I: the gutter re-read on device change, and the MutationObserver on chip text writes. The axe case's name promises themes and phone width that it does not run. |
| `src/features/stage/StageStatus.svelte.test.ts` | 34 | R (+I: 1 case, +W: 1 case) | browser | browser | Keep. Its rules are in `boot-and-assets.md` (BOOT-04, -13 to -16, -21 to -29), not repeated in `stage.md`. I: the MutationObserver count of progress `value` writes. W: "increased contrast keeps the message distinct" holds without any `prefers-contrast` rule (BOOT-27). |
| `src/features/stage/fullscreen.svelte.test.ts` | 5 | R | browser | browser | Keep (STAGE-49 to -51). Real Fullscreen API over a hand-built opener and host. Mounting the exit control in the real stage, and wiring it to the masthead, waits for I2 and is otherwise only in `e2e/parity/snapshot.spec.ts`. |
| `src/features/stage/hover-text.test.ts` | 13 | R | unit | unit | Keep (STAGE-13). |
| `src/features/stage/place-popover.test.ts` | 5 | R | unit | unit | Keep (STAGE-22). Fixed numbers from legacy `stage-tools.test.js`, with no legacy import. |
| `src/features/stage/stage-keys.test.ts` | 18 | R | unit | unit | Keep (STAGE-37, -40, -46). |
| `src/features/tracts/MriNavigator.svelte.test.ts` | 47 | R (+I: about 5 cases count engine calls, e.g. `resize` once, one `moveVoxel` per key) | browser | browser | keep (TRACT-27 to -32, -34 to -47, -49); the T1/FA values are the fake's, so TRACT-33 and the real readout stay e2e |
| `src/features/tracts/TractsExplorer.svelte.test.ts` | 52 | R (+I: "the search head carries the keycap" counts `details` and DOM order; +W: forced colours checks only that two fills differ) | browser | browser | keep (TRACT-03 to -05, -07 to -18, -20 to -26); add "No streamlines meet this length filter." (TRACT-05); the result-count debounce case should use fake timers |
| `src/features/workspace/Workspace.svelte.test.ts` | 44 | R | browser | browser | keep (WORK-01 to -07, -09 to -12, -14 to -26); the fixture's anatomy ids `bert`/`aomic` are retired (harmless: any two ids prove WORK-08) |
| `src/lib/controller/anatomy.svelte.test.ts` | 30 | R (+I: reset pins the engine call order) | browser | unit (27 cases); browser (3 focus cases) | move down a level: all but the two `clearSelection` focus cases and the Hide focus case to unit over the fake engine, as `excursion.test.ts` runs; drop the call-order assert (CTRL-01–14, -16–18, -20) |
| `src/lib/controller/excursion.svelte.test.ts` | 1 | R | browser | browser | keep (CTRL-24, -27, LESSON-01): `$effect` reactivity needs the client runtime |
| `src/lib/controller/excursion.test.ts` | 27 | R (+I: 2 `timeline.slice` render counts; +W: 1 count compared with the same `clinical.search`) | unit | unit | keep (CTRL-24–29, CTRL-31–38); trim the render counts, give the deficit count a fixed number |
| `src/lib/controller/keymap.test.ts` | 23 | R (+I: 1 stubbed `addEventListener`) | unit | unit | keep (KEY-01–03, -06–08, -10–16); add KEY-04, -05, -09 and modifiers on other keys before S5a goes |
| `src/lib/controller/lesson.test.ts` | 21 | R (+I: 4 exact call timelines) | unit | unit | keep (LESSON-01–06, -08–10, CTRL-05, -39); keep the end-state asserts, trim the timelines |
| `src/lib/controller/links.svelte.test.ts` | 3 | R (+W: 1 case, the `<html lang>` it asserts is set by the test's own `followLanguage`) | browser | browser (announcer cases); unit (language case) | keep LINK-19; move the language case down to unit (spy on `followLanguage`, check no `planum-lang` write) or drop it as covered by `links.test.ts` (LINK-08) |
| `src/lib/controller/links.test.ts` | 14 | R (+I: 3 cases count spied `hold`/`schedule`/`release` calls and `restore` calls) | unit | unit | keep (LINK-01–LINK-04, LINK-06–LINK-08, LINK-10, LINK-17, LINK-20) |
| `src/lib/controller/modes.test.ts` | 13 (3 from a loop) | R (+W: 1; +I: 1 pins fire-and-forget) | unit | unit | keep (CTRL-21–23); fix 'back on Functions on the right atlas', which asserts before the un-awaited re-open could show: await `scene.settled()` first |
| `src/lib/controller/navigation/learning.test.ts` | 6 | R | unit | unit | keep (LESSON-07, -09); add a right-hemisphere landmark and a 2-element centroid (only S3 has them) |
| `src/lib/controller/speech.test.ts` | 8 | R | unit | unit | keep (KEY-17–21); its viewer ref is a citation comment |
| `src/lib/core/assets/asset-cache.test.ts` | 8 | R | unit | unit | keep (ASSET-01, -04–09) |
| `src/lib/core/assets/comparison-assets.test.ts` | 14 (`describe.each` runs 4 cases × 2 readers) | R (+S: 1 case checks the published cdmd files against their SHA-256) | unit | unit | keep (ASSET-06, -12, -13) |
| `src/lib/core/assets/diffusion-assets.test.ts` | 3 | R | unit | unit | keep (ASSET-01, -06, -10) |
| `src/lib/core/assets/published-anatomy.test.ts` | 7 | R | unit | unit | keep (BOOT-05, -06, ASSET-11) |
| `src/lib/core/assets/published-assets.test.ts` | 6 | R | unit | unit | keep (ASSET-01–03, BOOT-16); the non-`SecurityError` case pins a change from legacy that has no deviation record |
| `src/lib/core/async/latest.test.ts` | 11 | R | unit | unit | keep (PANEL-31–PANEL-34) |
| `src/lib/core/catalog/catalog.test.ts` | 18 | R (+S: 2 published-data cases) | unit | unit | keep (CAT-14, -15, -22–-27); tighten the capped case to total 779 (CAT-24); add the cortex-hidden group order and the system filter (CAT-25) |
| `src/lib/core/catalog/functional-regions.test.ts` | 5 | R (+S: 1 published case) | unit | unit | keep (CAT-08, -33, -34) |
| `src/lib/core/catalog/internal-anatomy.test.ts` | 4 | R | unit | unit | keep (CAT-12, -14, -20) |
| `src/lib/core/catalog/labels.fr.test.ts` | 12 | R (+S: 2 published or table-size cases) | unit | unit | keep (CAT-07–CAT-09, -11, -12, -15, -22); merge its published-manifest case with the two in `labels.test.ts` (duplicate) |
| `src/lib/core/catalog/labels.test.ts` | 16 | R (+S: 3 published-data cases) | unit | unit | keep (CAT-07–CAT-13, -15, -16); merge the published-manifest cases (see above) and give the fixed counts of CAT-08 |
| `src/lib/core/catalog/network-basis.test.ts` | 2 | R (+S: 1 case) | unit | unit | keep (CAT-32) |
| `src/lib/core/catalog/networks.test.ts` | 14 | R | unit | unit | keep (CAT-10, -29–-31) |
| `src/lib/core/catalog/neuropsych-domains.test.ts` | 11 | R | unit | unit | keep (CAT-35–CAT-42) |
| `src/lib/core/catalog/nextbrain-systems.test.ts` | 2 | S (+R: 1 case) | unit | unit | keep (CAT-12) |
| `src/lib/core/catalog/visibility.test.ts` | 24 | R | unit | unit | keep (CAT-17–CAT-19, -21) |
| `src/lib/core/clinical/catalog.test.ts` | 7 | R | unit | unit | keep (CAT-44–CAT-49) |
| `src/lib/core/clinical/data.test.ts` | 2 | S | unit | unit | keep (CAT-45, -46, -48–-50) |
| `src/lib/core/comparison-format.test.ts` | 4 | R | unit | unit | keep (I18N-15, I18N-30) |
| `src/lib/core/comparison/catalog.test.ts` | 48 | R (+S: 1 published case) | unit | unit | keep (CAT-57–CAT-60); assert each malformed case's message, not only the prefix (CAT-58) |
| `src/lib/core/detents.test.ts` | 19 | R (+W: 6 cases assert only inequalities) | unit | unit | keep (SHEET-01 to -07, -13); tighten to fixed values: 200 → {132, 132, 132}, 812 sideways → {216, 406, 503}, rubber band 681.54 / 703.18 / 739.58 / 100.82, tie 266 → peek, flick threshold 0.4 vs 0.39 |
| `src/lib/core/diffusion/catalogs.test.ts` | 3 | H (+R: 1 case, the fallback) | unit | unit | keep (CAT-61) |
| `src/lib/core/diffusion/validation.test.ts` | 4 | R | unit | unit | keep (CAT-62–CAT-64, I18N-21) |
| `src/lib/core/format.test.ts` | 16 | R | unit | unit | keep (I18N-23–I18N-29) |
| `src/lib/core/i18n/diffusion.test.ts` | 2 | R (+W: 1 case asserts only non-empty and EN ≠ FR) | unit | unit | keep (I18N-21, -22); assert the four sentences of I18N-21 |
| `src/lib/core/i18n/errors.test.ts` | 9 | R | unit | unit | keep (I18N-01, -16–-20) |
| `src/lib/core/i18n/i18n.test.ts` | 16 | R (+H: 1 composition case; +W: 2 presence-only cases) | unit | unit | keep (I18N-01–-03, -07–-14, -25) |
| `src/lib/core/keyboard.test.ts` | 4 | R | unit | unit | keep (STATE-34) |
| `src/lib/core/learning/catalog.test.ts` | 9 | R (+S: 4 published-content cases; +W: 1 case asserts 8 bare throws) | unit | unit | keep (CAT-51–CAT-54); give the 8 bare `throws` their messages |
| `src/lib/core/learning/references.test.ts` | 5 | S | unit | unit | keep (CAT-56) |
| `src/lib/core/learning/session.test.ts` | 4 | R | unit | unit | keep (CAT-55) |
| `src/lib/core/panels/circuits.test.ts` | 2 | R | unit | unit | keep (PANEL-19) |
| `src/lib/core/panels/clinical.test.ts` | 11 | R (+W: 1 case, corrections re-derived from the same YAML) | unit | unit | keep (PANEL-12–PANEL-16); pin the two published DOIs in the corrections case |
| `src/lib/core/panels/header.test.ts` | 6 | R | unit | unit | keep (PANEL-22–PANEL-27); tighten PANEL-26/27 to exact strings |
| `src/lib/core/panels/inspector.test.ts` | 7 | R | unit | unit | keep (PANEL-17, PANEL-18) |
| `src/lib/core/panels/navigator.test.ts` | 18 | R | unit | unit | keep (PANEL-01–PANEL-07, PANEL-09–PANEL-11) |
| `src/lib/core/panels/provenance.test.ts` | 6 | R | unit | unit | keep (PANEL-28, PANEL-30) |
| `src/lib/core/panels/related.test.ts` | 2 | R (+S: 1 case over the published manifest) | unit | unit | keep (PANEL-20, PANEL-21) |
| `src/lib/core/state/boot.test.ts` | 2 | R | unit | unit | keep (STATE-62) |
| `src/lib/core/state/clinical-navigation.test.ts` | 6 | R (+I: 2 cases pin the full model call sequence) | unit | unit | keep (STATE-51, STATE-52) |
| `src/lib/core/state/dissection.test.ts` | 3 | R | unit | unit | keep (STATE-57–STATE-59) |
| `src/lib/core/state/internal-mode.test.ts` | 8 | R | unit | unit | keep (STATE-60, STATE-61) |
| `src/lib/core/state/link-check.test.ts` | 4 | R | unit | unit | keep (STATE-18–STATE-21) |
| `src/lib/core/state/link-writer.test.ts` | 4 | R | unit | unit | keep (STATE-63–STATE-65) |
| `src/lib/core/state/paint.test.ts` | 4 | R | unit | unit | keep (STATE-53–STATE-55) |
| `src/lib/core/state/reader-state.test.ts` | 18 | R | unit | unit | keep (STATE-35–STATE-41) |
| `src/lib/core/state/scene-commands.test.ts` | 16 | R | unit | unit | keep (STATE-42–STATE-50) |
| `src/lib/core/state/session.test.ts` | 25 | R (+I: 1 case asserts `session.state` is undefined) | unit | unit | keep (STATE-22–STATE-33) |
| `src/lib/core/state/url-state.test.ts` | 32 | R | unit | unit | keep (STATE-01–STATE-17) |
| `src/lib/core/tracts.test.ts` | 8 | R (+S: one case reads the published catalogs) | unit | unit | keep (TRACT-01, -02, -06, -08, -15, -19); absorb from T1 the CSV file name and MIME type, a CSV row per catalog bundle, `lengthSummary({0.05, 0, 1000})` and `settingsReadout(0, 250)` |
| `src/lib/core/workspace.test.ts` | 16 | R (+W: "the path and its group crumb are named" checks only non-empty and prefix) | unit | unit | keep (WORK-01, -08, -09, -11, -13, -14, -17, -20) |
| `src/lib/engine/comparison/overlay.test.ts` | 6 | R | unit | unit | keep (SCENE-26–SCENE-32; add DoubleSide/unpickable, the empty file, highlight after dispose) |
| `src/lib/engine/contract.test.ts` | 56 | R (+H: 7 cases test the fake double itself) | unit | unit | keep (the contract suite on the fake: FACADE-, SLICE-, SCENE-28 and engine-e4b/tracts rules; the 7 fake-only cases are test-double hygiene) |
| `src/lib/engine/diffusion/native-geometry.test.ts` | 4 | R (+I: asserts the position attribute is the very source array and that filtering keeps the same attribute objects) | unit | unit | keep (DIFF-06–-09); add the inclusive boundary, the black point and the bounding box; drop the identity asserts |
| `src/lib/engine/diffusion/native-viewer.test.ts` | 5 | R (+W: "the brain opacity can be set before the outline loads" checks only that it does not throw) | unit | unit | keep (DIFF-18–-23); rewrite the W case to load an outline and read its opacity |
| `src/lib/engine/diffusion/navigation-data.test.ts` | 3 | R (+I: NiiVue field names, the only observable) | unit | unit | keep (DIFF-28–-30); add the half-voxel rounding |
| `src/lib/engine/diffusion/navigation-viewer.test.ts` | 4 | R | unit | unit | keep (DIFF-31, -32) |
| `src/lib/engine/diffusion/published-data.test.ts` | 3 | S | unit | unit | keep (DIFF-06, -13–-16); see Slow tests |
| `src/lib/engine/diffusion/reference-space.test.ts` | 3 | R (+S: 1 case, published anchors) | unit | unit | keep (DIFF-10–-12); add the bottom-row matrix and assert the error classes |
| `src/lib/engine/diffusion/streamlines.test.ts` | 2 | R | unit | unit | keep (DIFF-01–-03); add the inclusive boundary, NaN minimum and `code === 'streamlines'` |
| `src/lib/engine/diffusion/tract-file.test.ts` | 3 | R (+S: af-left 3,639 streamlines) | unit | unit | keep (DIFF-04, -05) |
| `src/lib/engine/diffusion/tracts.test.ts` | 3 | R | unit | unit | keep (DIFF-26, -27); mock the asset reader (see Slow tests) |
| `src/lib/engine/framing.test.ts` | 8 | R | unit | unit | keep (FACADE-01, FACADE-03, FACADE-11–FACADE-14; its RENDER-07 assertion is W: tighten to ±0.8·v) |
| `src/lib/engine/index.svelte.test.ts` | 50 | R (+W: "accepts the look of the app state" asserts nothing) | browser | unit for 45 cases; browser for the snapshot, the MRI navigator, one cut on the worker path and a boot smoke | move down a level (contract on the real engine with the fake renderer of `index.test.ts`, after writing a fetch-to-disk shim for the volumes, tracts and overlap file), or at least share boots and split into 4 files: see Engine contract cases |
| `src/lib/engine/index.test.ts` | 5 | R (+I: 1 case spies `setMriAppearance`) | unit | unit | keep (FACADE-30–FACADE-32, FACADE-34, FACADE-36; SCENE-11, SCENE-29); boot once for the 4 cases that share |
| `src/lib/engine/model/assets.test.ts` | 1 | S | unit | unit | keep (ATLAS-03, -06, -07, -20, -48); assert 14 Basal ganglia meshes instead of "> 5"; make it the shared CDMD model file (see Slow tests) |
| `src/lib/engine/model/brain-atlas.cut.test.ts` | 1 | R | unit | unit | keep (SLICE-24, SLICE-37 in `engine-e4a.md`; ATLAS-52) |
| `src/lib/engine/model/brain-atlas.test.ts` | 61 (one loop gives 4 cases) | R (+I: 2 cases; +W: 1 case) | unit | unit | keep (ATLAS-01–-06, -08–-14, -16–-19, -21–-25, -27–-32, -34–-44, -46–-48, -52, -53); replace the centroid case with fixed values; drop the raycast-count and "has a spatial index" asserts |
| `src/lib/engine/model/progress.test.ts` | 2 | R | unit | unit | keep (ATLAS-08) |
| `src/lib/engine/model/spinal-cord.test.ts` | 6 | R (+S: 1 case, the published assembly) | unit | unit | keep (ATLAS-20, -47, -49–-51); share one model (see Slow tests) |
| `src/lib/engine/render/border-feather.test.ts` | 5 | R | unit | unit | keep (RENDER-35–RENDER-37; add the radius and four-parcel errors) |
| `src/lib/engine/render/camera-path.test.ts` | 5 | R | unit | unit | keep (RENDER-12) |
| `src/lib/engine/render/camera-views.test.ts` | 17 | R | unit | unit | keep (RENDER-02–RENDER-06, RENDER-08–RENDER-10); add the direction vectors (RENDER-01), the fit narrowing (RENDER-07) and the up-axis case (RENDER-11) |
| `src/lib/engine/render/device.test.ts` | 10 | R | unit | unit | keep (RENDER-29–RENDER-31; add the no-document case) |
| `src/lib/engine/render/effective-viewport.test.ts` | 18 | R | unit | unit | keep (RENDER-13–RENDER-16) |
| `src/lib/engine/render/keyboard-orbit.test.ts` | 7 | R | unit | unit | keep (RENDER-21, RENDER-22; assert the 1.1 zoom factor, not only the key names) |
| `src/lib/engine/render/lighting.parity.svelte.test.ts` | 1 | D (+R: rig count 7, non-black environment, empty camera after dispose) | browser | browser | convert to SHADER-33, SHADER-34 with fixed expectations (no legacy import); keep in browser (PMREM needs WebGL) |
| `src/lib/engine/render/mri-material.svelte.test.ts` | 2 | R | browser | browser | keep (SHADER-14, SHADER-15); add the outside-grid, scan-off and lift-driven mark cases |
| `src/lib/engine/render/mri-material.test.ts` | 5 | R | unit | unit | keep (SHADER-11, SHADER-12, SHADER-13) |
| `src/lib/engine/render/network-colors.test.ts` | 6 | R | unit | unit | keep (SHADER-08, SHADER-09, SHADER-10); add the rounding and NaN cases |
| `src/lib/engine/render/orbit-controls.test.ts` | 18 | R | unit | unit | keep (RENDER-17, RENDER-18, RENDER-20; RENDER-19 untested; the harness writes private OrbitControls fields) |
| `src/lib/engine/render/orientation.test.ts` | 7 | R | unit | unit | keep (RENDER-23, RENDER-24) |
| `src/lib/engine/render/outline-edges.test.ts` | 3 | R | unit | unit | keep (RENDER-33, RENDER-34 restore half) |
| `src/lib/engine/render/outline-occluders.test.ts` | 7 | R | unit | unit | keep (RENDER-32) |
| `src/lib/engine/render/picking.test.ts` | 16 | R (+I: 1 case checks the camera listener is removed on dispose) | unit | unit | keep (SCENE-15–SCENE-23; add pointercancel, the dblclick miss and the ray through the pointer, SCENE-24) |
| `src/lib/engine/render/quality.test.ts` | 11 | R | unit | unit | keep (RENDER-27, RENDER-28) |
| `src/lib/engine/render/scale-bar.test.ts` | 6 | R | unit | unit | keep (RENDER-25, RENDER-26); trim "a usable viewport still yields a bar" (repeats the 50 mm case) |
| `src/lib/engine/render/scene.test.ts` | 10 | R (+I: 5 render-pipeline cases pin pass order, needsSwap, buffer identity, target settings and a spy on `paintOutlineEdges`) | unit | unit | keep the 5 R cases (SCENE-09, SCENE-10, SCENE-13, SCENE-14, SCENE-33); drop the I cases or replace them with a pixel check in the SHADER area |
| `src/lib/engine/slices/coordinates.test.ts` | 5 | R | unit | unit | keep (RENDER-38–RENDER-42 = SLICE-01–SLICE-05); add the oblique normal formula, edge letters and the range error |
| `src/lib/engine/slices/sampling.test.ts` | 2 | S (+W: the overlay case asserts only `pixels[0] > pixels[1]`) | unit | unit | keep (SLICE-11, SLICE-13, RENDER-43 point); assert the blend `[153, 38, 38, 255]` and a non-identity window (SLICE-12) |
| `src/lib/engine/slices/sections.test.ts` | 22 | R (+I: 1 case checks the highlight is passed to a stub) | unit | unit | keep (SLICE-04, SLICE-16–SLICE-28, SLICE-35, SLICE-38); thin the slider sweep (see Slow tests) |
| `src/lib/engine/slices/volume.test.ts` | 6 | S | unit | unit | keep (SLICE-06 length only, SLICE-08–SLICE-10); add the order, affine and shape refusals and the integrity errors (SLICE-07) |
| `src/lib/engine/tissues/assets.test.ts` | 2 | S | unit | unit | keep (SHADER-22); replace the `if (!record) return` guard with an assert so a missing atlas fails |
| `src/lib/engine/tissues/gpu-sections.test.ts` | 20 | R (+S: 2 cases check GPU and CPU voxels agree) | unit | unit | keep (SLICE-10, SLICE-29–SLICE-36, SLICE-38) |
| `src/lib/engine/tissues/highlight.test.ts` | 5 | R | unit | unit | keep (SHADER-18, SHADER-20) |
| `src/lib/engine/tissues/palette.test.ts` | 13 | R (+S: 1 case on the published NextBrain labels) | unit | unit | keep (SHADER-01, SHADER-21–SHADER-24); same vacuous-return guard in the published case |
| `src/lib/engine/tissues/plane-section.test.ts` | 6 | R | unit | unit | keep (TISSUE-01–TISSUE-03) |
| `src/lib/engine/tissues/ribbon-wedges.test.ts` | 4 | R | unit | unit | keep (TISSUE-08–TISSUE-10) |
| `src/lib/engine/tissues/solid-assets.test.ts` | 25 | R | unit | unit | keep (TISSUE-13–TISSUE-22, TISSUE-37; SHADER-01 for the cord) |
| `src/lib/engine/tissues/solid-sections.test.ts` | 19 | R (+W: 1 case) | unit | unit | keep (TISSUE-21, TISSUE-23–TISSUE-35); fix the W case "a background build draws the same cap as the synchronous one": in Node there is no `Worker`, so `build` resolves null and its `if (built)` body never runs (it also carries a needless 20 s timeout) |
| `src/lib/engine/tissues/white-matter.test.ts` | 6 | R | unit | unit | keep (SHADER-26–SHADER-29) |
| `src/lib/state/language.test.ts` | 7 | R | unit | unit | keep (STORE-22, STORE-23) |
| `src/lib/state/media.svelte.test.ts` | 3 | R | browser | unit | move down (all 3: `matchMedia` is stubbed, no DOM; needs a runes-enabled unit file pattern, since the unit project excludes `*.svelte.test.ts`) (STORE-24) |
| `src/lib/state/prefs.test.ts` | 7 | R | unit | unit | keep (STORE-13–STORE-15) |
| `src/lib/state/stage-layout.svelte.test.ts` | 31 | R (+W: 5 framing cases derive their expectation through `clearFraming`) | browser | unit + browser | split: move the 22 pure cases down (STORE-25–STORE-29, STORE-31, STORE-32, STORE-35); keep the 9 that measure real layout or a ResizeObserver (STORE-30, STORE-33, STORE-34); replace the `clearFraming` re-derivations with the fixed insets and scales in STORE-32/STORE-33 |
| `src/lib/state/stores.svelte.test.ts` | 19 | R (+W: the catalog-store case recomputes its expectation with the same catalog calls) | browser | unit | move down (all 19: fake engine, a plain element as live region; same runes unit pattern as media) (STORE-01–STORE-12); fix STORE-09 counts from the published manifest |
| `src/lib/state/theme.test.ts` | 13 | R | unit | unit | keep (STORE-16–STORE-21) |
| `src/lib/ui/ChoiceGroup.svelte.test.ts` | 12 | R | browser | browser | keep (UI-24, UI-30–UI-35) |
| `src/lib/ui/Collapsible.svelte.test.ts` | 6 | R | browser | browser | keep (UI-13, UI-32, UI-39) |
| `src/lib/ui/IconButton.svelte.test.ts` | 9 | R | browser | browser | keep (UI-28, UI-30–UI-32); the icon-data case could move to unit (UI-29) |
| `src/lib/ui/SearchCombobox.svelte.test.ts` | 25 | R | browser | browser | keep (UI-09, UI-32, UI-65–UI-70); fake timers for the announcement case; one axe run per state instead of the 4-case theme × width matrix plus a fifth axe case |
| `src/lib/ui/Switch.svelte.test.ts` | 6 | R | browser | browser | keep (UI-30–UI-32, UI-38) |
| `src/lib/ui/ToggleToolbar.svelte.test.ts` | 14 | R | browser | browser | keep (UI-24, UI-29–UI-32, UI-36) |
| `src/lib/ui/Toolbar.svelte.test.ts` | 5 | R | browser | browser | keep (UI-32, UI-37) |
| `src/lib/ui/Treegrid.svelte.test.ts` | 41 | R (+I: 1 case pins the `treegrid-block` class) | browser | browser | keep (UI-32, UI-71–UI-77); fake timers for the two 600 ms type-ahead waits |
| `src/lib/ui/announcer.test.ts` | 9 | R | unit | unit | keep (UI-18, UI-19) |
| `src/lib/ui/drag.test.ts` | 5 | R | unit | unit | keep (UI-25); add the pair-matrix expectation from UI-25 when U2 parity is deleted |
| `src/lib/ui/interaction.svelte.test.ts` | 17 | R (+W: 2 cases, `setInstant` re-reads the attribute it set, the own-keys constant matches its own selector) | browser | browser | keep (UI-15–UI-18, UI-20–UI-24, UI-32); drop the two W cases |
| `src/lib/ui/kit-spike.svelte.test.ts` | 9 | W | browser | — | delete: a U0 spike that tests Bits UI through the docs-only `docs/decisions/kit-spike/Spike.svelte`, not shipped code. Its Toolbar and Combobox cases cover Bits parts no longer shipped (Toolbar is hand-rolled on `bindRoving`, the combobox hand-built per decision 34), its Tabs case a Bits tablist removed by 0004; RadioGroup, Popover and Tooltip are proven through the shipped wrappers (UI-33, UI-50, UI-51, UI-60, UI-61, UI-63). Decision records 0001 and 0005 cite it as evidence and need rewording |
| `src/lib/ui/list-nav.svelte.test.ts` | 7 | R | browser | browser | keep (UI-17, UI-26) |
| `src/lib/ui/native-primitives.svelte.test.ts` | 22 | R | browser | browser | keep (UI-27, UI-32, UI-40–UI-48); add the uncovered name and forced-colour parts of UI-40, UI-47, UI-48 |
| `src/lib/ui/overlays.svelte.test.ts` | 38 | R | browser | browser | keep (UI-32, UI-49–UI-64); fake timers for the real 500/600/700 ms waits; split Popover/Dialog from Tooltip so shards balance |
| `src/lib/ui/roving.test.ts` | 9 | R (+I: the dispose case pins the listener map) | unit | unit | keep (UI-14–UI-17) |
| `src/lib/ui/tooltip.test.ts` | 14 | R | unit | unit | keep (UI-60, UI-62, UI-63) |
| `src/lib/ui/treegrid.test.ts` | 25 | R | unit | unit | keep (UI-71–UI-74, UI-76) |
| `src/styles/contrast.test.ts` | 8 | R | unit | unit | keep (UI-05) |
| `src/styles/layer-order.test.ts` | 1 | H | unit | unit | keep (UI-01) |
| `src/styles/phone-tokens.svelte.test.ts` | 4 | R | browser | browser | keep (UI-07) |
| `src/styles/stylesheets.test.ts` | 13 | H | unit | unit | keep (UI-01–UI-04) |
| `build/site.test.ts` | 1 | H | unit | unit | keep (BUILD-01); assert the literal `/neuroatlas/` and `/neuroatlas/next/`, not the module's own constants |
| `test/no-triple-slash.test.ts` | 1 | H | unit | unit | keep (BUILD-11) |
| `test/repo.test.ts` | 1 | H | unit | unit | keep (BUILD-12; holds ASSET-14 incidentally) |
| `e2e/journeys/boot.spec.ts` | 5 | R | e2e | e2e | keep (ASSET-15, -21, SW-10, BOOT screens, SHELL-11, -13) |
| `e2e/journeys/scene.spec.ts` | 4 | R | e2e | e2e | keep (LINK-21, pick and inspect, find a region) |
| `e2e/journeys/explorers.spec.ts` | 3 | R | e2e | e2e | keep (a function, a deficit, a circuit) |
| `e2e/journeys/chrome.spec.ts` | 5 | R | e2e | e2e | keep (data bar, comparison CSV, SNAP, STAGE-49/-50, SHORT-13) |
| `e2e/journeys/phone.spec.ts` | 3 | R | e2e | e2e | keep (the sheet and stage, focus walk, SHEET-29) |
| `e2e/journeys/tracts.spec.ts` | 1 | R | e2e | e2e | keep (TRACT-02, -07, -19, -27, -48) |
| `e2e/journeys/accessibility.spec.ts` | 4 | R | e2e | e2e | keep (BUILD-10) |

## Rules hiding inside the legacy-comparison files

For each differential file (and `parity/F3.test.ts`, which has differential parts): the rule IDs it holds, the rules
only it checks today (so they must get a rule test before it is deleted), what it checks that is not a rule
(drop it), and notes for the converter.

### `parity/C1.test.ts`

Rules hiding inside: I18N-01 and I18N-03 (key parity and the English fallback, already covered elsewhere); I18N-04 (every legacy string and every function's output over 40 seeded draws, for every area of both languages and the per-domain clinical, circuits and diffusion tables); I18N-05 (the `ADDED` list: it only checks these keys are absent from legacy, so their wording is uncovered); I18N-06 (the `CHANGED` table already asserts fixed strings: move it as is); I18N-07 (the dialog strings and the two French fixes, already fixed values) and I18N-08 (tissue names and French edge letters, read from the source text of `ui/chrome/sections.js` and `diffusion/navigation-ui.js`); I18N-09 (the `legacyFixed` patch is the S5b rule D1–D3 in disguise: assert the rows); I18N-10 (every atlas id in en, fr, xx); I18N-11 (counted phrases); I18N-16–I18N-20 (failure, start and link notices over four errors × 18 operations × three languages, and 46 field draws); I18N-21, I18N-22 (diffusion words and readout, 100 seeded points); I18N-23–I18N-29 (format helpers over 213 values, nine nouns, 105 points).
Notes: the honest replacement of the whole-table diff is a committed snapshot (`toMatchFileSnapshot` or a JSON fixture) of both tables with each function called at the fixed arguments listed in I18N-04, generated once from today's tables (which equal legacy apart from the recorded deviations and amendments) and reviewed. The format-helper sweep needs no seeds: the fixed cases of I18N-23–I18N-29 cover every branch (absent values, zero, rounding to zero, grouping thresholds, both languages, `signed`, `trim`). The `KINDS` table and the `resolve`/`sample` machinery are not rules: drop them.
Also the only check near MAST-36 (every data choice has a note in both languages) and of the S5b D2 row for `M` (SHORT-, comment 81 on #4).

### `parity/C2.test.ts`

Rules hiding inside: CAT-07 and CAT-16 (`labelOf` and `beneathCortex` for every region, both languages); CAT-17–CAT-21 (`visibilityOf` over 240 seeded settings × 1289 regions); CAT-22, CAT-24, CAT-25, CAT-26, CAT-27 (groups, search over 142 queries re-ranked with the corrected word predicate of `c2-search-word-boundary.md`, cap and total, `visibleCount`, labels under CAB-NP); CAT-28 (lazy language switch, `get` of an unknown id); CAT-29–CAT-32 (networks on the published partition and every region); CAT-33, CAT-34 (functional regions on the published file); CAT-35–CAT-41, CAT-43 (domain validation, paint for every domain and all 277 terms, areas, studies, term matching, grouping, shown domain, scored region, overview, z bands at −1, 0, 3, 3.5, 5, 7.77, 10, 25); CAT-42 (nearest over 60 seeded one-letter deletions of region names).
Notes: the per-anatomy loop runs once (only `cdmd` is published). Worth keeping as data tests with fixed expected values: the published search totals (e.g. "s" 779, "cuneus" 12, "noyau" FR 241, "zzz" 0), the published group keys and row counts (CAT-25, CAT-26), the visible counts (CAT-27), the published z-band lookups (CAT-39) and the published domain counts (CAT-43). The seeded settings grid adds nothing the fixed visibility cases do not prove, provided CAT-21's precedence is tested per reason pair.

### `parity/C3.test.ts`

Rules hiding inside: CAT-44 (46 clinical mutations); CAT-45–CAT-49 (search, grouped, nearest, forDeficit, forRegion, mappedRegions, paint per finding, unknown ids, over 3 seeds of the published content; the seven-finding throw); CAT-50 (published clinical content); CAT-42 (clinical nearest); CAT-51, CAT-52, CAT-54 (30 circuit mutations, alternatives and covering regions, unknown lookups); CAT-55 (40 seeded session sequences, including go before start); CAT-57–CAT-60 (47 comparison mutations, including the 5e-11 / 2e-10 drift and the equal-area tie-break; every region and both CSV languages on the published data; returned rows are copies); CAT-62 (600 seeded NIfTI headers reaching all six messages and codes); CAT-63 (89 error objects); CAT-64 (150 seeded states); CAT-61 (`TRACT_CATALOGS` and `tractCatalog` for cdmd, aomic, "", "toString"); CAT-49 (`FINDING_COLORS`). The final 121-case suite ("the seeded inputs reach every validation branch") is a coverage check on the seeds, not a rule: drop it; the converted tests give each message its own fixed input, so the list of messages it holds is the checklist for CAT-44, CAT-51 and CAT-58 (the legacy "missing total for" branch is unreachable, as the file says).
Notes: the published-content observations (`observeClinical`, `observeComparison`) are useful as data tests only with fixed expected values (CAT-50, CAT-60's `destrieux:left:38` example); as diffs they cost most of the 34 s. The `pair equal areas` mutation is the only test of the comparison tie-break: keep it as a small fixture case. `mapping source name spelling` (`&` versus `_and_`) is only tested here for the clinical validator: keep it as a fixture case of CAT-44.

### `parity/C4.test.ts`

Rules hiding inside: STATE-01–STATE-33, STATE-35 and STATE-37–STATE-65 (STATE-34, the keyboard predicates, and STATE-36 are not in it). Covered only here, so the converter must add fixed-value tests for: STATE-02 (the whole parameter-name and order table), STATE-13 (limit + 0.17 mm accepted, + 0.18 mm refused), STATE-17 (the corpus round trip), STATE-43 (two downloads' progress summed), STATE-44 ("Atlas not applied: <id>" / "Detail level not applied: <id>"), STATE-50 (cut closed before showing; empty set), STATE-56 (every cdmd function, term, deficit and finding has a paint and key), and the edge parts of STATE-05 (`a,a`), STATE-10 (rounding), STATE-11 (written to hundredths), STATE-14 (bounds), STATE-22/23 (refused view keeps the notice), STATE-24/25 (`setFinding`), STATE-57/58 (no-change returns false, empty undo, reset).
Also checks, which are not rules (drop): the scene-commands trace equality of render counts, console output, the exact model method calls and the `typeof progress` of each (`fake.events`); legacy error messages for nonsense inputs beyond those the rules name; the clinical-navigation call order beyond "show last".
Notes: STATE-17 and STATE-18 are worth keeping as data tests over a fixed corpus: the `POOL` table (one entry per parameter: readable, near-miss and nonsense values) is a good fixed corpus; the 80 seeded hashes (seeds 1-40, 101-140) can be dropped or kept as a property test with a fixed seed asserting "decode never throws on a string; re-reading what is written gives the same state minus defaults". Seeded dissection and session sequences can become a few named sequences with fixed end states. STATE-51: with no cortical (or no structure) citation the layer is `null` in both versions (`len && !some(…) ? x : null` parses as `(len && !some(…)) ? x : null`); assert `null`.

### `parity/C5.test.ts`

Rules hiding inside: PANEL-01–PANEL-07, PANEL-09–PANEL-20, PANEL-22–PANEL-32, PANEL-34. Covered only here: PANEL-29 (lesion-check coverage text over the published checks), the fr option strings of PANEL-25, the exact strings of PANEL-26/27, the Functions-tab text and `asset-updated` of PANEL-13, the empty-list cases of PANEL-01 and PANEL-09, `ftp` and empty links of PANEL-30, the row order and supplemental note of PANEL-28, and the "false is not applied" result of PANEL-31.
Also checks, which are not rules (drop): the event logs of transcribed legacy runner bodies (the `start` events are written by the test's own wrappers); `nextEnabledIndex` over 1600 random draws (a handful of fixed cases prove it); `vocabularyOf`/`sharedGroupNames` over random group names.
Notes: the masthead, provenance and inspector view-models are consumed by other areas (`masthead.md`, `colophon.md`, `provenance.md`, `inspector.md`); convert into the existing `core/panels/*.test.ts` files rather than new ones. The `createInvolvement` sweep over every published region (PANEL-20) is a fair data test to keep as fixed expectations for a few named regions plus the existing PANEL-21 sweep.
Also, from the feature catalogues: its "header view-models" block holds MAST-28, MAST-29, MAST-30, MAST-32, MAST-38 and COLO-02, and its "provenance view-model" block holds PROV-01, PROV-04, PROV-05, PROV-07 and PROV-08; PROV-04 and PROV-05 have no other coverage. It is also the only check of the 8 vs 9 source-id boundary of the navigator view-model.

### `parity/E1.test.ts`

Rules hiding inside: RENDER-01–RENDER-08, RENDER-10–RENDER-18, RENDER-20–RENDER-34, RENDER-38–RENDER-43. Covered only here: RENDER-01 (direction vectors), RENDER-07 (fit narrows the frustum), RENDER-11 (view along the up axis), RENDER-22 (the 1.1 factors), RENDER-31 (no document), RENDER-39 (edge letters, u/v, oblique formula, range error), RENDER-41 (the non-finite error), RENDER-42 ("off", two-value point), RENDER-43 (centred frame). Also checks that one three.js instance serves `web/` and `viewer/` (not a rule: drop, or move to `boot-and-assets.md` BUILD- if wanted), and diffs the `paintOutlineEdges` call log (I: drop; RENDER-34's edge equivalence needs a browser pixel test).
Notes: keep as property tests with fixed seeds: the published-mesh fixtures (tissue-envelopes, spinal-cord, structures) with the 21 directions × 4 lenses × 10 fits sweep (silhouette spans 0.8 ± 1e-3, never outside), the 7 × 7 view-pair orbit paths (constant distance on level pairs, up turning < π/10 per step) and the 400 free orbits (opposite edges carry opposite letters).

### `parity/E2.test.ts`

Rules hiding inside: the composition sweep (398 cases: 3 appearances × plain/networked × 4 kinds × feather/MRI marks/orders, plus plain + MRI, cut, cut + MRI, solid ± white matter ± cap labels × MRI, each on desktop and phone) holds SHADER-02, -04, -05, -06, -07, -11, -14, -15, -17, -19, -25, -28, -30, -31, -32 and SHADER-35; the missing-attribute case is SHADER-03. "white matter" holds SHADER-26–SHADER-29; "cap labels" SHADER-30; "palette" SHADER-01 and SHADER-21–SHADER-24; "network colours" SHADER-08–SHADER-10; "border feathering" RENDER-35–RENDER-37 (`engine-e1.md`); "MRI uniforms" SHADER-11–SHADER-13; "highlight and label sampling" SHADER-18 and SHADER-20. Also checks equal GLSL source strings (`HIGHLIGHT_CHUNK`, `LABEL_AT`, `WHITE_MATTER_UNIFORMS`, `WHITE_MATTER_LIFT`) and equal exported constants (`FEATHER_RADIUS`, `NETWORK_COLOR_ITEM_SIZE`): not rules, drop; what those strings do is SHADER-16, -19, -28 and -32, which need real-WebGL pixel tests.
Notes: nothing in this file proves a shader compiles. Converting the sweep to text snapshots would keep it implementation-pinning; the replacement for SHADER-35 is one browser test that builds each distinct program once on a shared renderer (about 40 distinct cache keys, not 398 cases: appearance × 3 and desktop/phone do not change the program, only clearcoat, which SHADER-02 and -25 check in unit) plus a unit check that cache keys are distinct. The seeded palette sweep (mulberry32 seed 1) and the published-cortex feather are worth keeping as data tests with fixed seeds, the latter as RENDER-35 checks on real meshes (border weights in [0, 0.5], zero beyond 1.5 mm) rather than a diff. `stderr` "THREE.Color: Unknown color notacolour" comes from SHADER-13's unknown-name case.

### `parity/E3.test.ts`

Rules hiding inside: "plane-section" TISSUE-01, -02, -05 (and TISSUE-04 implicitly, never asserted); "ribbon-wedges" TISSUE-08, -11, -12; "SolidSections" TISSUE-23, -24, -26, -27; "section worker" TISSUE-31; "solid-assets" TISSUE-15–TISSUE-22 (and the `indexLabels` half of TISSUE-17); "Volume" SLICE-06 (the order `'C'` and shape `[1, 1]` errors), SLICE-08 and SLICE-09 on the published white-matter volume (`engine-e4a.md`); "glass-solids and white-matter-surfaces" TISSUE-36, -37, -38; "earcut" TISSUE-06. Also checks `generation` and the solids' internal order index equal legacy: not rules, drop.
Notes: the module mocks `fetchAsset` for both implementations and loads `tissue-envelopes.glb` with a top-level `await`. The published-data checks worth keeping (fixed seeds 31, 7, 11, 5, 17, 23, 29, 41) are TISSUE-05 and TISSUE-11 as data tests, and SLICE-09 on 400 seeded points against fixed label values. The section-worker case imports `viewer/tissues/section-worker.js` for its `onmessage`; `solid-sections.test.ts` already covers the new worker in-thread, so only the unknown-id fallback (TISSUE-31) needs adding there.

### `parity/E4a.test.ts`

Rules hiding inside: SLICE-11–SLICE-15, SLICE-17, SLICE-18, SLICE-29–SLICE-31, SLICE-33, SLICE-35. Covered only here: SLICE-12 non-identity windows, SLICE-13 blend weights, SLICE-15 published-volume readout, SLICE-14 (its current half is already R).
Notes: replace the 2003 seeded `sample()` points with about ten fixed published points whose aseg labels, names, region ids and intensities are tabulated from `aseg.volume`/`mri.volume` (S, intensity ± 1e-6). The 300-trial TissueSections replay becomes a property test: every hit is on a visible, selectable region of the current display; keep its coverage floors (≥ 2 labels, ≥ 2 regions, > 5 cap hits).

### `parity/E4b.test.ts`

Rules hiding inside: ATLAS-08 (progress fold, 50 seeded trials); ATLAS-04, -12, -13, -15–-19, -21–-25, -27–-31, -33–-40, -46 (centroid cached), -47 (cord load state) in the two 300-command replays; ATLAS-07, -20, -26, -32, -41, -52 in the CDMD replay; ATLAS-42–-45 in the two ray cases (≥ 9,000 CDMD rays in 10 display states, clipped and not); ATLAS-46 (every CDMD centroid); ATLAS-02, -11 (load from the published manifest); ATLAS-39 and ATLAS-09 (the two deviation cases). "comparison has teeth" checks the harness, not a rule: drop it.
Held only here: ATLAS-15 (detail change clears the system, isolation and selection), ATLAS-26 (network colour; the fixture has no network layer), ATLAS-33 (feather palette after each redraw), ATLAS-45 (CDMD picks), and parts of ATLAS-11 (sidecars read), -13 (selection and isolation dropped on an atlas change), -21 (visibility in every state), -22 (refused commands change nothing), -40 (reset keeps the paint), -46 (CDMD centroids).
Notes: keep the mulberry32 command script as a seeded property test on the fixture (seed 0xe4b, 300 commands): after each command assert ATLAS-21 against `visibilityOf` and, for a refused command, that `settings`, materials and events are unchanged (ATLAS-22). No legacy model is needed for either. On CDMD, replace the 9,000-ray comparison with ATLAS-45's invariants over 100 Fibonacci rays per state, on one model. The two deviation cases also assert the legacy bug (`[[], [10, 20]]`, an isolation that hides everything); their new-model halves are already R in `brain-atlas.test.ts`.

### `parity/E5.test.ts`

Rules hiding inside: SCENE-01–SCENE-03 (easing curves, durations, reduced motion), SCENE-05–SCENE-08, SCENE-15, SCENE-20, SCENE-24 (ray through the pointer), SCENE-26, SCENE-28, SCENE-32 (refusal after dispose), SCENE-33, FACADE-01 (a plan per named view).
Notes: the easing is a formula: test `cubic-bezier(0.32, 0.72, 0, 1)` and the cubic ease-in-out at 25/50/75 % of 240 ms with fixed values (± 1e-6). The seeded picker script becomes a list of fixed event sequences with expected hover/select/focus outputs.

### `parity/E6.test.ts`

Rules hiding inside: DIFF-01–-03 (lengths and summaries on 25 seeded and 4 published tracts, all minimums incl. invalid); DIFF-06–-09 (geometry buffers, ranges, bounds, black point, matrix, minimum check); DIFF-10, -11 (200 seeded rigid transforms; invalid matrices); DIFF-28–-30 (500 seeded voxels and points on two grids, half-voxel rounding, navigator tract fields); DIFF-04, -05 (loader sharing and retry, gzip decode); DIFF-17–-23 (snapshot, bounds, transforms, real `load()`, outline material, opacity and visibility before load, foreign reference space).
Held only here: DIFF-02 (empty and 4-value inputs), DIFF-03 (NaN minimum), DIFF-09 (the black point), DIFF-11 (bottom row [0, 0, 1, 1]), DIFF-17 (all fixed values after a real `load()`, foreign anatomy refused), DIFF-23 (the applied opacity and visibility), DIFF-29 (half-voxel rounding).
Notes: keep the seeded synthetic tracts and rigid transforms as property tests with fixed seeds: length = sum of segment lengths, the filter keeps exactly the streamlines ≥ the minimum, `surfaceToScanner(scannerToSurface(p)) = p` within 1e-9 mm, `scannerVoxel(sourceVoxelPoint(v)) = v`. The two R cases (setMinimum on an empty viewer, a bundle added once) repeat `native-viewer.test.ts`: drop them. Decision 29 on #4 (compare `snapshot()` until T1 has a CSV builder) no longer applies once the rule tests assert fixed summaries.

### `parity/E7.test.ts`

Rules hiding inside: FACADE-01, FACADE-04–FACADE-12, FACADE-15, FACADE-17–FACADE-26, FACADE-28, FACADE-29, FACADE-37. R parts already standing alone: FACADE-22 ("reports a change of the held state"), FACADE-21 (modifier keys; its last three lines check legacy: drop them), FACADE-25 (orbit-limit placement).
Notes: it already boots BrainAtlas once in `beforeAll` and calls `model.reset()` per case: the pattern proposed below for the contract suite. Keep the six display states of FACADE-04 on the published CDMD model with one or two framings each; FACADE-20 must not be asserted to the millisecond (decision in the catalogue: "within a frame or two of 250 ms").

### `parity/F3.test.ts`

Rules hiding inside: ASSET-16–20, SW-02–09, BUILD-01, -02, -04–08. Only the 2 cases in "worker and head version maps match the legacy build" are D. They diff the `sw.js` map and the head map byte for byte against the root `vite.config.js` plugin. They are the only check of BUILD-05's contents: 16-hex versions, the `.gz` contents hash and the `models/`-only head map. The `expect(legacyConfig.base)` line is D too, and redundant.
Notes: 4 head-prefetch cases read `src/boot/prefetch.js` as text (I): 'names only layers the manifest publishes', 'offers every atlas and detail level a link can ask for', 'reads the default brain from the index rather than assuming it' and 'does not start the tissue envelopes or the cord'. Turn them into `run()` checks over the manifest's atlas and detail ids. The 9 service-worker cases and their stub worker scope are the model to keep. The 4 build cases (H) run real Vite builds (see Slow tests). Since `parity/` is deleted at cutover, move everything (e.g. `build/published-files.test.ts`, `src/service-worker.test.ts`, `src/boot/prefetch.test.ts`) before deleting.

### `parity/G6.test.ts`

Rules hiding inside: SNAP-01, SNAP-03, SNAP-04, SNAP-05 (the caption for every colouring × view × plane, the tract reference, empty facts, EN and FR), SNAP-06 (`packFacts`), SNAP-07 (`ellipsize`), SNAP-09 (`bottomLine`). Its one R assertion is that the four plane names occur.
Notes: The caption sweep has 6 colourings × (7 views + none) × (none + 4 planes) + 3 edge cases = 243 fact sets in 2 languages. Turn it into a fixed-expectation table in `snapshot.test.ts`. Writing every row is not needed. The table can be one row per colouring, view and plane with fixed words, plus the three edge cases. Turn the 1000-step seeded sweep (seed 20261026, the fake `measure` of 5 + charCode mod 7 per character) into property tests with that fixed seed: packed lines keep fact order and exceed the room only with one fact; an ellipsized run is a trimmed prefix plus "…" that fits, or "…"; statement and scale never overlap; the scale is on the baseline exactly when it fits. Nothing here needs `viewer/`.

### `parity/R2.test.ts`

Rules hiding inside: INSP-27 (the area and share text, one decimal, `<0.1` for a positive part below 0.1, the French decimal comma). It imports `viewer/ui/panels/comparison-format.js` and diffs strings over 12 edge values, a 0–2 sweep at 0.001 and 2000 seeded randoms, in en and fr, so it is D.
Notes: `src/lib/core/comparison-format.test.ts` (R) already pins 0, 0.0003, 0.08, 0.1, 25.36 fr, and the shares 0.000001 (en, fr), 0.0008, 0.001, 0.1536 (en, fr), 0. Before deleting, add the edges only the sweep checks, with fixed values (checked with `Number.prototype.toFixed`): area −0 → "0.0", 0.05 / 0.0500001 / 0.0999999 → "<0.1", `Number.MIN_VALUE` → "<0.1", 0.95 → "0.9", 1 → "1.0", 99.95 → "100.0", 100 → "100.0", −1 → "−1.0" (U+2212); share `Number.MIN_VALUE / 100` (which is 0) → "0.0". The random sweep proves nothing a rule needs: drop it.

### `parity/S1.test.ts`

Rules hiding inside: STORE-03 (the session store's state, returns and throws equal the session's after every command), STORE-04 (the lesson store likewise). Everything else it sweeps is the C4 session itself, which belongs in `core-state.md` and is R-covered by `src/lib/core/state/session.test.ts` and `src/lib/core/learning/session.test.ts`: an unknown view is refused (`false`); an unknown explorer throws; `setExplorer`, `setFunction`, `setDeficit`, `setFinding` reset `paintLifted`, `liftPaint` sets it; `setDeficit` clears the finding; `toggleGroup` and `setExpanded`; `setLang` maps anything but `fr` to `en`; `setStatus` clears progress and error; `setProgress` means loading; `setSwitching` only from ready or switching, `endSwitching` only from switching; `setError`, `setContextLost`; `notify` throws `TypeError('A notice needs text.')` for non-string text; joined notices say each text once and keep the first action; any action clears the notice; an unbalanced `releaseNotices` throws `'No notices are held.'` (deviation `c4-unbalanced-notice-release`); a lesson `go` outside 0..steps−1 or non-integer throws `RangeError`.
Notes: the seeded mulberry32 sweep (seeds 1–8 × 400 steps; 1–4 × 200 for lessons) is worth keeping as a store test with the session's own `assemble({})` as oracle (the store must equal the core it wraps, not legacy), so it needs no `viewer/` import. The fake lesson catalog answers `get(null)`, so `go` after `close` is allowed in the sweep; that is not a rule.

### `parity/S2.test.ts`

Rules hiding inside: CTRL-01–03, CTRL-05–20 (CTRL-04 and the focus half of CTRL-08 are excluded: no DOM). Rules only it checks:

- hiding the cord drops a selection with the notice (CTRL-11)
- the detail is restored after `aseg` (CTRL-14)
- the colour-lost notice (CTRL-15)
- the second door records the on-screen detail (CTRL-16)
- an overtaken leave (CTRL-17)
- every reveal reason but hemisphere and removed (CTRL-18)
- the no-cut plane through the centroid (CTRL-19; the copy of `offsetThrough` in `controller/anatomy.ts:136` has no test of its own)
- an overtaken reset (CTRL-12)

Its walk also triggers scene-command failures (`chooseAtlas('nowhere')`, failed door downloads → failure notices), which belong to the state area. Not rules: the equality of engine call logs, the hook order, the legacy model renames done through a Proxy.
Notes: keep the 6 scripts and the 2 overtakes (each rival delay 0–11 microtask turns) as fixed-outcome tests on the new code. If a seeded walk is kept, make it a property test with fixed seeds and invariants: the selection is always null or selectable; a dropped selection always gives "Selection cleared — … is no longer shown.". Compare only the calls made since the last burst.

### `parity/S3.test.ts`

Rules hiding inside: CTRL-21–35, LESSON-01, -04, -05, -07–09. Rules only it checks:

- a deficit opened from a lesson takes over its scene (CTRL-29)
- the reveal notice and the cut-atlas label (CTRL-30)
- a cortex made see-through by hand gets no offer (CTRL-31)
- a right-hemisphere landmark (LESSON-07)
- a 2-element centroid is refused (LESSON-09)

CTRL-22 (two tabs during a leave) is also R in `modes.test.ts` ('a later choice wins'). It also compares legacy `revealNotice` wording and `createInvolvement`; these belong to the panels-clinical area. Not rules: the `openDeficit` return values (normalised away), capture counts, render positions in the engine log.
Notes: it cuts `viewer/app.js` source text with `new Function` and `runInNewContext`, so any legacy edit breaks it. The 40 seeded landmark cases come from 3 sides × 3 `restores` × 3 `covering_regions` × 5 centroids. Write them as an explicit table on the new code.

### `parity/S4.test.ts`

Rules hiding inside: LINK-02, LINK-03 (lesson fields), LINK-09 (known ids), LINK-10 (failure naming), LINK-11 (defaults on restore), LINK-12 (facing the cut), LINK-13 (Tracts excursion), LINK-14 (tab, function, deficit, lesson), LINK-15 (lesson landmark), LINK-16 (detail without the sheet; opening an item without an atlas), LINK-17 (overtaken restore). Of these, LINK-09, LINK-11–LINK-16 and most of LINK-10 are covered only here.
Also checks, which are not rules (drop): identical engine call logs and console output of legacy and new; source slicing of `viewer/app.js` (it fails if the legacy file is edited); the kept-scene bookkeeping as strings.
Notes: the `fixed` table of 37 scenarios is the value to keep: convert it to an `it.each` table over `createLinks` on the fake engine, each row with its fixed `notApplied`, explorer, function/deficit, lesson and hook calls. The 120 seeded hashes (seed 35) can be dropped, or kept as one property test (restore never throws; returns null or a list of published parameter names). LINK-21, the round trip through the real address bar, is the one e2e journey for this area; `e2e/parity/dissection.spec.ts` checks parts of it and is enabled on `next` since #134.

### `parity/S5a.test.ts`

Rules hiding inside: KEY-01–14. Rules only it checks:

- Escape from a text field that did not consume it still steps back (KEY-04)
- the form-field gates in dispatch (KEY-05)
- `/` per explorer (KEY-09)
- Ctrl/Meta/Alt on every key, not only Escape and M (KEY-01)
- Enter, Space, Tab, `a` and `7` do nothing

Case 2 (`isCharacterKey` over `''`, `'é'`, an emoji, `'Dead'`, `undefined`, `5`, and `characterShortcutAllowed`) belongs to the core-state keyboard predicates and is partly R in `src/lib/core/keyboard.test.ts`. Not a rule: the log-line equality with the legacy `onKeyDown` cut from `app.js`.
Notes: 23 states × 19 foci × 32 keys × modifiers/flags. Convert to a table of fixed expected outcomes (commands, whether the key is cancelled) for the presses that act, plus a fixed "no command, not cancelled" assertion for the rest. Not slow (681 ms).

### `parity/T1.test.ts`

Rules hiding inside: TRACT-01 and TRACT-02 (the 30 catalog bundles form the same 13 rows, members and EN/FR names as legacy), TRACT-06 (`lengthSummary` for `{142.25, 75, 239.46}` and `{0.05, 0, 1000}` in EN and FR), TRACT-15 (`settingsReadout` for (0.16, 1), (1, 40), (0, 250) in EN and FR), TRACT-19 (the CSV byte-identical to legacy `saveLengths` for the 30 catalog bundles plus quoting, formula-guard, hidden and empty rows at minimum 1, 40 and 250; Blob type `text/csv;charset=utf-8`; file name `planum-streamline-lengths.csv`).
Notes: `src/lib/core/tracts.test.ts` already holds fixed expectations for most of it. Before deleting, add there: `LENGTHS_CSV_TYPE` and `LENGTHS_CSV_FILENAME` equal those two strings; a CSV built from the 30 catalog names has 31 lines plus the final empty one, in catalog order; EN "mean 0.1 mm (range 0.0–1000.0)" / FR "moyenne 0,1 mm (étendue 0,0–1000,0)"; "0% · ≥250 mm" / "0 % · ≥250 mm". The legacy `saveLengths` stub (fake `document`, mocked `URL`, fake timers) is not a rule: drop it.

### `parity/U2.test.ts`

Rules hiding inside: UI-14 (`rovingStep` over every key, index −1..n and size 0..5), UI-15 (`tabStop` for every focused member of 6 group shapes), UI-16 (a bound group's Tab stops, focus and handled keys from every member, then leaving and a changed choice), UI-19 (the debounced script, with the fixed write times now in UI-19), UI-25 (the 7 × 7 event-pair matrix on two sliders and dispose), STORE-16, STORE-17, STORE-19, STORE-20, STORE-21 (theme: stored `{}`, `dark`, `light`, `sepia` × OS light/dark, six choices with OS flips and two frames each, unknown choice, dispose; blocked storage), STORE-22 (start language: 6 links × 4 saved values). The roving trace's last entry (listener names after dispose) is implementation: drop.
Notes: the link column of the start-language table (`#lang=de`, `#lang=en&lang=fr` decode to nothing) is S4 decoding, for `links.md`. The theme trace's meta colours use fake surfaces `#ffffff`/`#1d1d1f`; the real dark `--surface-base` is `#1b1e21`.

### `parity/f1.test.ts`

Rules hiding inside: CAT-01 (view order, against legacy `VIEW_DIRECTIONS`); CAT-02, CAT-03, CAT-04 (lists and what legacy `decodeState` accepts; the new decoder's acceptance belongs to the links/core-state catalogues); CAT-05 (the three media queries; legacy CSS literal; legacy `isPhone`/`isCoarse` call order, which is implementation and should drop); CAT-06 (manifest fits the types: not differential, keep).
Notes: replace the legacy-CSS case with the same check over the new stylesheets (`web/src/**/*.{css,svelte}`), which today has no test.

### `parity/f2.test.ts`

Rules hiding inside: SLICE-02 (edge letters), SLICE-03, SLICE-16, SLICE-18, SLICE-19 on the fake; SLICE-39 (`setDisplay({ reverse: 1 })` throws "Section display options must be boolean."; the contract suite asserts only the TypeError); the selectable set under every hemisphere × cortex × internal setting and the fake model's display and layer operations: ATLAS-04, ATLAS-13, ATLAS-15–ATLAS-22, ATLAS-30, ATLAS-35–ATLAS-40 (`engine-e4b.md`).
Notes: what f2 proves is that the fake behaves like the real model. The contract suite is the standard place for that: add contract cases with fixed expectations (for example the number of selectable regions per hemisphere × cortex × internal setting, taken from the published manifest), and they run on both engines.

### `parity/u1.test.ts`

Rules hiding inside: UI-05 (the one changed token, `--overlay-control-border #70777f`), UI-06 (both themes declare the palette, and only `:root` and `:root[data-theme='dark']` before the phone rule), UI-07 (the phone touch sizes under `@media (max-width: 800px), (max-height: 480px) and (orientation: landscape)`), UI-08 (the increased-contrast token swap), UI-09 (focus ring and pointer-focus rule), UI-10 (`[hidden]`, `.visually-hidden`, `body`), UI-11 (`kbd`, `.key-range`, `.measure`, `.code`).
Notes: it slices legacy files by line number (`phone.css` lines 14–15, `a11y.css` lines 19–33), so it already breaks on any legacy edit. Converting UI-06 to a fixed token table is a pin on the palette; UI-09–UI-11 are better proved as computed styles in Chromium than as declarations.

### `src/features/snapshot/snapshot.parity.svelte.test.ts`

Rules hiding inside: SNAP-08 (caption room up to the top letter, line spacing, sizes, ellipsis of a long subject), SNAP-09 (the statement is drawn), SNAP-10 (the scale bracket's pixels), SNAP-11 (the letters are drawn), SNAP-12 (each key is drawn), SNAP-13 (only marks are added, at ratio 2). `snapshot.svelte.test.ts` checks only the `markings()` plan for SNAP-11 and SNAP-12, not the drawing. It is the only test that proves the image carries "Planum · Not clinical anatomy".
Notes: Replace the pixel diff against legacy with a rule test on the same fixture: 560×520 at ratio 2, the DEFICIT legend, the long subject and the oblique section. Option 1: draw onto a canvas whose 2D context is wrapped to record `fillText`/`strokeText` calls with their font, x and y. Assert the statement text at (16, 520 − 24), every caption run ending before the top letter's left − 12, the bracket spanning `pixels` px, and the first line ending in "…". Record the letters' and the keys' `fillText` calls and the swatch fills too, so SNAP-11 and SNAP-12 are proved on the drawing. Option 2: keep a pixel check on the flat `#7a7f86` frame with fixed regions (pixels far from every mark unchanged; the statement's box changed). Do not compare with `viewer/`.

### `src/lib/engine/render/lighting.parity.svelte.test.ts`

Rules hiding inside: SHADER-33 (rig: types, colours, intensities, positions, targets) and SHADER-34 (PMREM texture fields and every reflected pixel at roughness 0, 0.5, 1).
Notes: the R parts (7 children, non-black, camera empty after dispose) stay. Replace the legacy diff with fixed rig values and texture fields (`CubeUVReflectionMapping`); for the environment keep a non-black check plus, if wanted, a few reflected pixels with a stated tolerance.

## Slow tests

Measured in CI run 40377467496 (per-file and per-case durations from the job logs). The browser project
ran in four shards whose Vitest durations were 408 s, 61 s, 48 s and 67 s: one file decides the job's wall
time. Summed file time was 549 s in the browser project (50 files) and 165 s in the unit project (159 files,
72 s wall on one runner with parallel workers). `src/features/sections/SectionBar.svelte.test.ts` merged
after that run and is estimated from reading it.

### The engine contract: `src/lib/engine/index.svelte.test.ts` (390 s)

The file runs the shared engine contract (`src/lib/engine/fake/contract-suite.ts`, 49 cases) against the
real engine, plus one snapshot case. In CI it took 390 s of the browser suite (71 % of all browser file
time) and made shard 4 last 408 s while the other three took 48 to 67 s. Each case boots a fresh engine
that parses about 35 MB of GLB on SwiftShader WebGL: 4.5 s is the boot alone (49 × 4.5 ≈ 220 s), and cases
that load a second atlas, the volumes, the tracts or the overlap file take 9 to 20 s. The same engine boots
in 1.1 to 1.4 s in Node (`index.test.ts`, fake renderer), so most of the browser cost is software-rendered
frames drawn while a case awaits a load, not parsing. The same suite already runs against the fake in
`src/lib/engine/contract.test.ts` (unit, 141 ms).

Which cases need the real engine (the per-case table is below): of the 49 contract cases, 19 need it
(a real GLB, volume, tract or overlap file, real WebGL, or NiiVue), as does the file's own snapshot case;
30 are bookkeeping the fake already proves, and they pay 4.5 s each only for the boot. 7 cases need a pristine engine (the opening state, the
cord's first showing, the linked MRI and the resampling before load, the tracts' first opening, centroids
before another atlas is cached, disposal); every other case can share a boot and restore through the public
API.

Three standard fixes, cheapest first (none implemented here):

1. **Boot once per `describe`.** In `contract-suite.ts`, boot in `beforeAll`, dispose in `afterAll`, and
   restore in `afterEach` with the public API only (`model.reset()`, `setPaint(null)`, the opening atlas and
   detail, `sections.setMode('off')` and its display defaults, a neutral framing source, `setChromeInsets({})`,
   `comparison.clear()`, `tracts.setActive(false)`, `applyTheme('light')`,
   `camera.applyView('oblique', { immediate: true })`), skipping awaited restores when nothing changed.
   Put the 7 pristine cases in a "first use" group with a fresh boot each. `parity/E7.test.ts` already uses
   this pattern (`beforeAll` model and `model.reset()`), and the fake pays nothing. Estimated file time
   205 to 230 s instead of 390 s: **about 160 to 185 s saved**.
2. **Split the suite so the shards balance.** Vitest shards by file. Export four definers (events and
   model; sections; camera, presentation, comparison and the snapshot case; tracts and lifecycle), call all
   four from `contract.test.ts` on the fake and one each from four browser files. With fix 1, each file is
   about 37 to 81 s and the slowest shard falls from 408 s to about 130 to 150 s: **about 260 s of CI wall
   time per run**. Check where the four files land (Vitest assigns shards by path, not duration); a custom
   `sequence.sequencer` can place them if two collide.
3. **Move the contract down a level.** Run the real-engine contract in the unit project with the fake
   renderer that `index.test.ts` already uses. That harness reads only the GLBs from disk
   (`model/test-support.ts:14-19`) and mocks the comparison overlay (`index.test.ts:117-140`); the volumes,
   the tracts and the overlap file still go through `fetch` (`index.ts:100,136`,
   `tissues/solid-assets.ts:149`), so a fetch-to-disk shim must be written first. Node has no `Worker`, so
   in unit `SolidSections` takes only its no-worker path (`solid-sections.ts:394`): keep one browser cut case
   for the worker path. Keep the rest of the small browser file for what needs real WebGL: a boot smoke, the
   snapshot and the MRI navigator (NiiVue). The camera-per-move case uses a driven loop, as
   `framing.test.ts` does. About 10 to
   20 s of unit time with shared boots, 25 to 30 s left in the browser: **about 360 s less browser time**,
   and shard 4 ends near 50 s like the others.

Also: "names the per-frame events" tests a constant and belongs in `contract.test.ts` alone; "accepts the
look of the app state" asserts nothing and should fold into FACADE-31 in unit.

### Ranked by seconds saved

Estimates are per file, from the measured times and the causes found by reading each file. "Goes with the
conversion" means the time disappears when the differential file is converted to rule tests and deleted.

<!-- prettier-ignore -->
| # | File | Level | Measured | Main cause | Standard fix | Est. saved |
|---|---|---|---|---|---|---|
| 1 | `src/lib/engine/index.svelte.test.ts` | browser | 390 s | a fresh real-engine boot per case on SwiftShader | the three options above | 160–360 s (and 260 s of wall time) |
| 2 | `parity/E4b.test.ts` | unit | 43.6 s | each case parses every CDMD GLB twice (legacy and new) and builds BVHs; ≥ 36,000 BVH ray casts | goes with the conversion: rules on the synthetic fixture, one shared CDMD model in `beforeAll` for the data rules, about 100 rays per state | ~40 s |
| 3 | `parity/C3.test.ts` | unit | 34.3 s | 123 mutation cases × 6 seeds × 2 implementations, each cloning the 1 MB manifest and exporting CSVs for all 1289 regions (up to ~570,000 CSV exports) | goes with the conversion: one small fixture per rejection (as `comparison/catalog.test.ts` does: 48 cases in 0.27 s), one published-content test per catalogue built once | ~34 s |
| 4 | `src/features/sheet/Sheet.svelte.test.ts` | browser | 21.2 s | every change of rest waits a 240 ms CSS glide, and Playwright's actionability check waits for the gliding handle; three viewport calls per case; axe matrix | turn the glide off in `beforeEach` except the motion cases; phone viewport once per `describe`; one axe run per state; split the file | ~15 s |
| 5 | `src/features/functions/functions.svelte.test.ts` | browser | 19.9 s | 28 axe runs (3 states × 2 languages × 2 themes × 2 widths); real 500 ms debounce waits and a fixed 900 ms sleep | fake timers (`vi.advanceTimersByTime`); about 6 axe runs; explorer-state cases to unit | ~14 s |
| 6 | `parity/F3.test.ts` | unit | 16.6 s | each `publishedAssets()` hashes 325 MB under `public/`; two real Vite builds and two `resolveConfig` calls | small fixture tree for the watcher, inline and version-map cases; share one instance where not mutated; move the build checks to one post-build check of the `dist/` CI already builds | ~14 s |
| 7 | `src/features/masthead/DataBar.svelte.test.ts` | browser | 11.5 s | `settle()` is a fixed `setTimeout(150)`, called about 55 times (~8 s); 2 × 2 axe matrix | wait on the condition (`tick()`, `expect.poll` on the collapse); one axe run per state | ~8.5 s |
| 8 | `src/features/circuits/circuits.svelte.test.ts` | browser | 9.3 s | 44 axe runs (5 states × 2 languages × 4) | one run per state, the matrix only on the open lesson (~8 runs); 4 cases to unit | ~6 s |
| 9 | `parity/E7.test.ts` | unit | 7.5 s | 40 seeded commands per display state, run twice, with silhouette fits over every vertex | goes with the conversion (one or two framings per state with fixed values) | ~7 s |
| 10 | `src/lib/ui/overlays.svelte.test.ts` | browser | 9.8 s | six tooltip cases wait the real 500 ms show delay plus fixed 200 to 700 ms sleeps; real CSS transitions; axe twice per state | fake `setTimeout`/`performance` as the file's own "hover waits 500 ms" case does; `settled()` instead of fixed sleeps; split Tooltip from Popover/Dialog | ~5 s |
| 11 | `src/features/deficits/deficits.svelte.test.ts` | browser | 8.3 s | five real 500 ms debounce waits; a sticky-heading walk of ~117 key presses; axe matrix | fake timers; sample the walk with `row.focus()`; one axe run per state | ~5 s |
| 12 | `src/features/inspector/AtlasComparison.svelte.test.ts` | browser | 8.2 s | every case re-hashes, parses and validates the real 236 KB comparison file; 20 axe runs | catalogue built once in `beforeAll` outside the loading cases; one axe run per state; split the file | ~5 s |
| 13 | `src/lib/engine/diffusion/published-data.test.ts` | unit | 7.5 s | decodes all 30 bundles (17.5 M points) and builds full line geometry to read a few points | transform the sample points directly; `test.each` per bundle so shards balance | ~5 s |
| 14 | `src/lib/engine/render/lighting.parity.svelte.test.ts` | browser | 7.0 s | two PMREM environments (legacy and new) and six float renders on SwiftShader | goes with the conversion: one PMREM, fixed rig values, fewer renders | ~4 s |
| 15 | `src/features/tracts/TractsExplorer.svelte.test.ts` | browser | 6.8 s | axe 2 × 4; two real 500 ms debounces; viewport reset after every case | fake timers; one axe run per language; reset the viewport only where changed | ~3.5 s |
| 16 | `src/lib/engine/index.test.ts` | unit | 6.1 s | each case reads and parses the CDMD GLBs from disk | boot once in `beforeAll` for the four cases that can share | ~3.5 s |
| 17 | `src/features/stage/Dock.svelte.test.ts` | browser | 6.0 s | 8 axe runs; a pointer case waits out a popover fade | one axe run per distinct state; reduced motion in pointer cases; View naming to unit | ~3 s |
| 18 | `src/features/anatomy/AnatomyExplorer.svelte.test.ts` | browser | 5.7 s | four real 500 ms status pauses; 20 axe runs | fake timers; one axe run per state | ~3 s |
| 19 | `parity/E3.test.ts` | unit | 5.9 s | real asset parsing and the ribbon wedges of two atlases built four times | goes with the conversion: new implementation only, wedges built once, synthetic fixtures for geometry | ~3 s |
| 20 | `src/lib/engine/model/spinal-cord.test.ts` | unit | 5.5 s | three cases each build a model and parse destrieux, learning and the cord | one model in `beforeAll`, restored with `reset()`; share with `model/assets.test.ts` | ~3 s |
| 21 | `src/lib/engine/slices/sections.test.ts` | unit | 3.6 s | one case calls `crosshairFor` about 10⁶ times (every 0.5 mm step of every slider angle) | per angle, the ends, one step past the end and a few interior steps | ~3 s |
| 22 | `parity/C2.test.ts`, `parity/E2.test.ts`, `parity/f2.test.ts`, `parity/E6.test.ts`, `parity/S2.test.ts` | unit | 3.8, 3.2, 3.0, 3.0, 2.9 s | double runs (legacy and new) over the published data, seeded sweeps comparing whole logs | go with the conversion | ~15 s together |
| 23 | `src/lib/engine/model/brain-atlas.cut.test.ts` | unit | 4.0 s | a real cut on real geometry (the rule itself, mostly inherent) | prove "nothing is downloaded twice" on the fixture with a spying loader; keep one CDMD case in the shared model file | ~2 s |
| 24 | `src/features/snapshot/snapshot.svelte.test.ts` | browser | 4.7 s | each real save loads webfonts, captures 1000×700 and encodes a PNG; the join case saves twice | preload fonts in `beforeAll`; a small stage except for the PNG-size case; stub the second save | ~2.5 s |
| 25 | `src/features/tracts/MriNavigator.svelte.test.ts`, `src/features/masthead/Masthead.svelte.test.ts`, `src/features/anatomy/AnatomyTree.svelte.test.ts`, `src/features/inspector/inspector.svelte.test.ts`, `src/features/workspace/Workspace.svelte.test.ts`, `src/lib/ui/Treegrid.svelte.test.ts`, `src/features/provenance/provenance.svelte.test.ts`, `src/features/shortcuts/shortcuts.svelte.test.ts`, `src/lib/ui/SearchCombobox.svelte.test.ts`, `src/features/stage/StageKeys.svelte.test.ts` | browser | 4.5, 3.9, 3.8, 3.2, 2.9, 2.8, 2.5, 2.5, 2.1, 2.2 s | the same three patterns: axe theme × width × language matrices, real debounce or type-ahead waits (200 to 600 ms), real CSS transitions | one axe run per state; fake timers; reduced motion or `settled()` | ~14 s together |
| 26 | `src/features/sections/SectionBar.svelte.test.ts` | browser | not measured (est. 4–6 s) | 6 axe runs; character-by-character `userEvent.type`; ResizeObserver waits | one axe run per state; `userEvent.fill`; the compact-row cases in their own file | ~2–3 s |

**The patterns behind most of the browser time**, each with its standard fix:

- **Axe matrices.** Many files run axe for every theme × width × language in several states (28, 40 or 44
  runs in one file). Run axe once per distinct DOM state, and the theme, width and language passes once, on
  the richest state. Colour contrast in both themes is a token rule already checked in unit
  (`src/styles/contrast.test.ts`).
- **Real timers.** The 500 ms result debounce, the 500/300 ms tooltip delays, the 600 ms type-ahead window
  and fixed sleeps (`setTimeout(150)`, 900 ms) are waited in real time. Use `vi.useFakeTimers({ toFake:
['setTimeout', 'clearTimeout'] })` and `vi.advanceTimersByTime`, and assert synchronously.
- **Animations.** Cases wait out CSS transitions (the sheet's glide, popover and dialog fades). Run them under
  reduced motion or a test style with `transition: none`, except the few cases whose rule is the motion.
- **Viewport churn.** `beforeEach`/`afterEach` resizes in every case. Set the viewport once per `describe`.
- **Real data per case.** Parse or hash the published file once in `beforeAll` (or at module scope of the
  fixture), except in the cases whose rule is the loading.
- **Double runs in parity files.** Every differential file runs the legacy and the new code; the converted
  rule tests run only the new code, which alone halves those files.

### Engine contract cases, one by one

Measured in CI run 40377467496, job 121764433200 (browser shard 4). Cases are those of `src/lib/engine/fake/contract-suite.ts` as run by `src/lib/engine/index.svelte.test.ts` on the real engine (CDMD manifest, SwiftShader WebGL, a 1000×700 host), plus that file's own snapshot case. "Shared boot" means one engine per describe booted in `beforeAll`, with a restore in `afterEach` (below).

<!-- prettier-ignore -->
| Case | CI ms | Needs the real engine? | Mutates state that would break a shared boot? | Proposal |
|---|---|---|---|---|
| events › unsubscribes | 4929 | no: emitter bookkeeping | no: the listener is removed | share boot |
| events › names the per-frame events | not timed (no boot) | no: a constant in `api.ts` | no | fake only (it tests no engine) |
| model › opens on the first atlas and the default detail level | 4586 | yes: the opening layers come from the real manifest and GLB load | asserts the pristine state | fresh boot (or first case of the shared group) |
| model › selects a visible region, reports it in a change, and clears it | 4559 | no: BrainAtlas bookkeeping (provable in Node) | no: clears its selection | share boot |
| model › refuses an unknown, non-region or hidden selection | 4577 | no | no: only throws | share boot |
| model › drops a selection the settings no longer show | 4509 | no | yes: hemisphere `left` (reset restores) | share boot + reset |
| model › validates its setters | 4537 | no | no | share boot |
| model › refuses to select a cortical region once the cortex is transparent | 4525 | no | yes: cortex opacity 0 (reset restores) | share boot + reset |
| model › isolates the selection and releases it on a setting change | 4605 | no | yes: selection (reset restores) | share boot + reset |
| model › paints by id, and the same id is not a change | 4504 | no | no: ends with `setPaint(null)` (reset does not clear a paint) | share boot |
| model › dissects with one history entry per action, and undoes them | 4532 | no | yes: selection restored (reset restores) | share boot + reset |
| model › shows, restores and loads hidden regions | 4568 | no | yes: hidden set (reset restores) | share boot + reset |
| model › resets the display | 4585 | no | it is the reset | share boot |
| model › switches atlas, refusing an unpublished one with an unknown-layer code | 14648 | yes: parses the second atlas (`cortex-hcp-mmp.glb`, 16 MB) | yes: atlas changed; its layer stays cached | share boot + `setAtlas(first)` |
| model › switches detail level, refusing an unpublished one | 13781 | yes: parses a second detail level | yes: detail changed | share boot + `setDetail(default)` |
| model › selects an internal system of the learning level | 4552 | no | no: ends on null | share boot |
| model › colours the surface at once, leaving the cut alone | 4529 | no | no: ends on `atlas` | share boot |
| model › downloads the spinal cord on first showing | 9264 | yes: parses `spinal-cord.glb` | yes: asserts "not ready" first; a load cannot be undone | fresh boot |
| model › downloads the envelopes on request | 13830 | yes: parses `tissue-envelopes.glb` (13 MB) | no: later cuts reuse them | share boot |
| model › prefetches a layer without changing the display | 13974 | yes: parses the second atlas | no on display; the layer stays cached | share boot |
| model › refuses to prefetch what is not an atlas or a detail level | 4562 | no | no | share boot |
| model › reports centroids in RAS millimetres only for geometry it has | 4528 | no GL, but real geometry | sensitive: `centroidOf` scans every cached layer, so it fails once the other atlas was loaded | fresh boot (or run before any atlas switch) |
| sections › cuts, reporting the plane to the model | 9726 | yes: the first cut loads the tissue volume and builds solids | no: ends with `setMode('off')` | share boot |
| sections › hands out snapshots, not its live state | 4542 | no | no: ends `reverse: false` | share boot |
| sections › keeps the crosshair and the offset inside the volume | 9888 | yes: opens a sagittal cut | yes: mode, offset and crosshair | share boot + `setMode('off')`, `setCrosshair([0, 0, 0])` |
| sections › validates the oblique angles and the display options | 4506 | no: mode stays off | yes: angles 10/5, reverse true | share boot + `setAngles(30, 30)`, `setDisplay({ reverse: false, overlay: false })` |
| sections › chooses the label volume of the cut | 14415 | yes: axial cut on the second atlas's tissue volume | yes: mode and cut atlas | share boot + `setCutAtlas(first)`, `setMode('off')` |
| sections › serves the linked MRI once loaded | 9391 | yes: fetches `mri.volume` and `aseg.volume` | yes: asserts "not loaded" first; a load cannot be undone | fresh boot |
| sections › resamples the planes and samples the volume only once loaded | 13782 | yes: real volumes and CPU resampling | yes: same as above | fresh boot (can share one fresh engine with the case above if merged) |
| sections › colours the surface, downloading what the colour needs | 14043 | yes: downloads the T1 and the functional colours | no: ends on `atlas` | share boot |
| sections › refuses a colour whose atlas is not on screen | 13891 | yes: switches to the CAB-NP atlas | no: ends on the first atlas | share boot |
| camera › holds a named view, and tells when it is let go | 4605 | no | asserts the held opening view; restore re-creates it | share boot (restore ends on `applyView('oblique', { immediate: true })`) |
| camera › reports the camera per move, outside the change event | 12677 | yes today: the real loop reports an eased move frame by frame (about 8 s of SwiftShader frames); a driven loop proves it in unit | no | share boot |
| camera › releases the view when it frames something other than a preset | 4578 | no | camera only | share boot |
| camera › does nothing, and keeps the held view, when none of the regions is drawn | 4536 | no | no | share boot |
| camera › leaves the held view alone when it frames the whole or the internal anatomy | 4534 | no | no | share boot |
| camera › faces the cut it is cutting | 14131 | yes: builds coronal and oblique caps | yes: mode oblique, reverse true | share boot + `setMode('off')`, `setDisplay({ reverse: false })` |
| camera › captures and restores a camera, and whether its view was held | 4555 | no | camera only | share boot |
| camera › places a link camera and reads it back; a held view has no orbit link | 4533 | no | camera and widened limits (the next framing resets them, RENDER-05) | share boot |
| camera › measures a pull-based framing source when it frames | 4556 | no | yes: replaces the framing source | share boot + a neutral source `() => ({ inset: {}, scale: { horizontal: 1, vertical: 1 } })` |
| camera › shrinks the visible rectangle for the sheet, and says so | 4602 | no | yes: chrome inset 200 | share boot + `setChromeInsets({}, { settle: false })` |
| camera › keeps its fit when the dock changes | 4611 | no | camera only | share boot |
| presentation › accepts the look of the app state, and a theme change | 4509 | no (asserts nothing) | yes: dark theme | share boot + `applyTheme('light')`; better fold into FACADE-31 in unit |
| comparison › outlines an overlap and clears it, and a later request overtakes an earlier one | 13743 | yes: real fetch, SHA-256 and parse of `atlas-overlaps.glb` (16 MB) | no: ends hidden and cleared (restore `setVisible(true)`) | share boot |
| tracts › loads on first opening and says so | 18647 | yes: real tract assets | yes: asserts "not ready" and one `tractsReady`; a load cannot be undone | fresh boot |
| tracts › thins the streamlines by their minimum length | 13853 | yes: loaded tracts | yes: active, minimum, opacity, overlay | share boot + `setActive(false)` |
| tracts › converts a point between the scan and the surface, both ways | 4617 | no: a fixed registration transform | no | share boot |
| tracts › opens the MRI navigator on a canvas | 19899 | yes: NiiVue on real WebGL with the real MRI | no: disposes its navigator | keep on real, share boot |
| lifecycle › is disposed once, and the model says so | 4631 | no | disposes the engine | fresh boot (or the shared group's last case) |
| (file) captures the settled frame, cropped to the stage rectangle asked for | 9342 | yes: one real WebGL frame and pixel readback | no | keep on real, share boot |

## Findings outside the classification

What the audit found while writing the catalogues that is not about a test's class: bugs in the app,
changes from legacy without a deviation record, decisions needed, test bugs, and rules that no test runs
anywhere. Each names the rule that states the expected behaviour. Nothing was changed: the audit is docs only.

### Bugs in the app

1. **Lesion checks with a repeated deficit break the function profile** (FUNC-21).
   `src/features/functions/FunctionProfile.svelte` keys the lesion-check rows by `check.deficit`, but seven
   published domains repeat a deficit across checks (`language` has 6 checks on `aphasia`; also `attention`,
   `social-cognition`, `spatial-attention`, `speech-production`, `recall`, `gestures`). Svelte rejects
   duplicate keys in a keyed each block. No browser test opens one of these domains. Key by association and
   add a browser case that opens `language`.
2. **Provenance links lack the "(opens in a new tab)" cue** (PROV-18). `ProvenanceDialog.svelte` sets
   `target="_blank"` without the cue decision 17 on #4 gives H4; `link.newTab` exists and
   `ExternalLink.svelte`, `AtlasComparison.svelte` and `TractsExplorer.svelte` use it. (The circuit source
   links had the same gap, CIRC-13; #136 fixed it, `x3-new-tab-cue.md`.)
3. **Counted phrases that ignore their count** (I18N-11): `footer.sourceFiles`, `functions.coverage`,
   `circuits.coverage` and `diffusion.bundleCollection` read wrongly for 1 ("1 tract bundles",
   "1 faisceaux"); published counts are never 1 today. `functional.contested` uses straight apostrophes
   ("Glasser's") where the rest of the English uses ’.
4. **`detents.ts` says the rests are distinct; on a short stage they coincide** (SHEET-02). Upright on a stage
   of 260 px or less the three rests are equal (200 px → 132/132/132) and half equals peek up to 264 px. The
   code matches legacy; the comment at `src/lib/core/detents.ts:51-52` and the test named "distinct" (which
   asserts only `≤`) are wrong.

### To check (not confirmed bugs)

1. **The page's label counts** (SHELL-17). `web/index.html`'s `og:description` says "148 Destrieux regions,
   360 HCP-MMP areas, 483 histological labels", as legacy does. The `cdmd` manifest has 150 `destrieux`,
   362 `hcp-mmp` and 514 `nextbrain` entries, unknown and medial-wall entries included. The first two match
   once those are left out; whoever owns the data claims should check 483 against the 514.
2. **The domain order's comment** (INSP-12, CAT-38). Domains come in published order, which is deliberate:
   strongest by z as a share of each domain's cortical maximum
   (`brain_model/layers/neuropsych_domains.py:114-131`), not by raw z, so on `hcp-mmp:left:50` Familiarity
   (z 4.4) is first and Visual perception (z 14.8) fifth. `domainsOf`'s comment says only "strongest first",
   which reads as raw z, and no test checks the order.

### Changes from legacy with no deviation record

1. **Cache Storage failures other than `SecurityError`** (BOOT-16) now surface without reloading: a change
   from legacy pinned by `published-assets.test.ts`, with no record in `web/docs/decisions/deviations/`.
2. **G5, the linked MRI dialog, is not built**, and the `g5-*.md` records the #49 decision names do not exist.
   SECT-25 to SECT-33 are written from legacy and that decision, all uncovered.

### Decisions needed

1. **Functions and Deficits announce search results by different rules** (FUNC-12, DEF-11): Functions says
   nothing for a cleared field and does not repeat an equal sentence while the field keeps text
   (`x1-result-announcement.md`); Deficits says the full count when cleared and repeats an equal sentence
   for a different query (`x2-results-announcement.md`). Comment 68 on #4 aligns Deficits with the Functions
   props shape but does not decide the announcement; K3's shared search field must pick one.
2. **French spacing before `:` and `;` is mixed**: 42 narrow no-break spaces, 28 ordinary spaces; guillemets
   mix NBSP and ordinary spaces; the data summary's name has "…l’affichage: " with no space. Legacy is the
   same, so no rule can state the French typography until the French review on #4 decides it.
3. **`DiffusionInputCode` lacks `'streamlines'`** (CAT-62, CAT-63), the code legacy streamline validation
   uses; still open on #4 (comment 24).
4. **Deleting `kit-spike.svelte.test.ts`** needs `0001-ui-kit.md` and `0005-settings-and-data-disclosure.md`
   reworded; they cite it as evidence.
5. **The cut material keeps its clear coat on phones** (SHADER-17), as legacy does (`viewer/tissues/shader.js:10`),
   while every other tissue material drops it on phones. Keep it, or align it with the others?
6. **An unknown MRI highlight colour name is accepted** (SHADER-13) with only a three.js console warning, as
   legacy does (`viewer/render/mri-material.js:39-44`). Should it fail fast, as the rest of the engine does?

### Test bugs

1. `src/lib/controller/modes.test.ts`, "back on Functions on the right atlas", asserts before the un-awaited
   re-open could show; await `scene.settled()` first.
2. `src/lib/engine/tissues/solid-sections.test.ts`, "a background build draws the same cap as the synchronous
   one": Node has no `Worker`, so `build` resolves `null` and the assertions never run.
3. `src/lib/engine/tissues/assets.test.ts` and `palette.test.ts` `return` early when a published atlas is
   missing, so they pass vacuously.
4. `src/lib/engine/diffusion/native-viewer.test.ts:8` passes the catalogue id `cdmd-sub-013` as an anatomy;
   it works only through the fallback to `cdmd`.
5. Fixtures still use retired anatomy ids (`snail`, `bert`, `aomic`) in `link-writer.test.ts`,
   `header.test.ts`, `url-state.test.ts`, `links.test.ts`, `workspace-test-world.ts` and
   `TractsExplorer.svelte.test.ts`.

### Rules no test runs anywhere

- `e2e/parity/circuits.spec.ts`, `anatomy-search`, `atlas-comparison`, `dissection` and `mri-navigator` gate
  themselves on the panels gate at run time but are not in `nextIgnored` in `playwright.config.ts`. Harmless
  now that the panels gate is on (#134), but the stage- and shell-gated specs that skip themselves the same
  way (`dock`, `sections`, `stage-keys`, `snapshot`) are still collected on `next` and always skip,
  inflating shard counts; `sheet` runs on `next` except its 4 stage-gated cases.
- `sheet.spec.ts`, "a window narrowed to a phone after load is set up, and is told", skips on legacy by design
  and on `next` behind the stage gate: it runs nowhere, and it is the only evidence for `h6-first-inset-report.md`.
- Next-only e2e cases that run nowhere while the gates are false: the dock's turn buttons (STAGE-27), the
  section position's range error and the "Full brain · no cut" announcement, the stage keys' level arrows,
  and the snapshot spec's French labels.
- The navigator's source-voxel rule (TRACT-33) is checked only against a mocked NiiVue.
- Every LINK- rule end to end (LINK-21) runs on no test against the next app; the `hidden=` and `system=`
  round trips (ANAT-49, ANAT-56) are in `dissection.spec.ts`, enabled on `next` only since #134.
- About 55 rules are covered only by differential tests and 48 by no test at all; they need rule tests
  before the differential files go.

### Integration gaps (I1, I2, I3b) and duplicated code

- The stage's "Exit full screen" control and `createSectionControls` are not mounted in the real stage.
  `DissectionBar.svelte` has no explorer input, so I1 must mount it only in the Anatomy explorer (ANAT-50).
  Save image must stay outside `#viewport` (SNAP-19).
- One `TODO(C1)` string table remains: `section-text.ts` (`cuts.positionRange`); #136 moved the snapshot
  and full-screen strings into i18n.
- `nextEnabledIndex` exists twice (`SearchCombobox.svelte` and `core/panels/navigator.ts`);
  `features/circuits/neighbour-keys.ts` reimplements U6's arrow-key walk without a unit test;
  `controller/anatomy.ts:136` copies `offsetThrough` untested (CTRL-19).
