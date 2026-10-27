# Region composition rules

Scope: the four region components `web/src/app/regions/{Masthead,Panels,Stage,Status}Region.svelte` and the integration chunks that fill them. I1 (#61) composes the panel region (workspace, sheet, explorers, detail view). I2 (#62) composes the stage region (overlays, dock, popovers, section bar, the Linked MRI and Diffusion MRI dialogs). I3b (#64) composes the masthead and status regions and mounts the Shortcuts and Provenance dialogs. The rules follow the I3a composition contract (comment 70 on #4), conductor decision 6 (comment 39: slot regions add no element), conductor decision 12 (comment 72: the root owns the single stateful instances, and every port is registered once the shell mounts), decision record `0008-dialog-mount-points.md` and the #4 composition rule: features never mount each other, and cross-panel behaviour goes through controller commands and the focus registry. Legacy sources: the root `index.html:96-603, 679-701`, `viewer/app.js:93-160, 606-738, 1406-1545, 1615-1645, 2065-2068`, `viewer/main.js:81`, `viewer/ui/chrome/viewport-chrome.js:684-791, 798-819, 853-884`. New code: `web/src/app/{App.svelte,application.svelte.ts,ports.ts,world.ts,boot.ts}` and the regions.

State on 2026-10-26, after #64 (I3b): all four regions are integrated. `src/app/regions/PanelsRegion.svelte.test.ts`, `StageRegion.svelte.test.ts`, `MastheadRegion.svelte.test.ts`, `StatusRegion.svelte.test.ts` and `ShellRegions.svelte.test.ts` test them over the fake engine, and `src/app/App.svelte.test.ts` tests the shell before the engine. The panels, stage and shell gates in `web/e2e/parity/enabled/` are all `true`. The panels gate covers `anatomy-tree`, `deficits`, `functions`, `inspector`, `tracts` and `workspace`; the stage gate `stage-overlay`; the shell gate `boot`, `data-bar`, `masthead`, `provenance`, `shell` and `shortcuts`. Whether the gated specs pass on `next` is known only from CI's e2e run, since pull requests skip e2e. Each feature's own rules are in its catalogue (`masthead.md`, `colophon.md`, `provenance.md`, `workspace.md`, `sheet.md`, `stage.md`, `shortcuts.md`, …). This catalogue holds only what composing them adds.

**Levels.** "browser (regions + fake engine)" means a Vitest browser test that builds the app with `createApp()`, attaches a `World` built on F2's fake engine, mounts `App.svelte` with the real regions, and asserts DOM, focus and the fake engine's record. This is the default. It is fast and needs no built site. "e2e" is kept for the few journeys that need the built page: a real reload, real fullscreen (the Vitest iframe has no `allowfullscreen`), the real model switching assets, and the gated parity specs as the end-to-end check once each gate flips.

## Mount points and landmarks

### REGION-01 · The masthead region holds the masthead, with the data bar in its slot

- **Rule:** The masthead region renders H2's masthead, with H3's data bar in its `data` slot between the brand and the masthead's buttons. It adds no element: the masthead's `header#masthead` is the page's only banner.
- **Kind:** behaviour
- **Level:** browser (regions + fake engine)
- **Source:** `index.html:96-186`; decision 6 (comment 39 on #4); #64 scope
- **Expected:** one `header`, which is `#masthead`, and one `banner`. Inside it, in DOM order: the skip link, the `h1` "Planum", the Atlas, Colour and Internal anatomy comboboxes (published build, wide window: one subject, so no Subject field), the "Full screen" button (where the page allows full screen), the "Save image (PNG)" button, the "More settings" button. Tab from the start of the document: "Skip to model", Atlas, Colour, Internal anatomy, then the masthead buttons.
- **Covered by:** `src/app/regions/MastheadRegion.svelte.test.ts` (R, the order and names, and before the engine); `src/app/App.svelte.test.ts` (R, the tab order across the regions)

### REGION-02 · The status region holds the colophon and nothing else

- **Rule:** The status region renders H4's colophon and adds no element: `footer#colophon` is the page's only `contentinfo`.
- **Kind:** behaviour
- **Level:** browser (regions + fake engine)
- **Source:** `index.html:592-597`; decision 6
- **Expected:** one `footer`, which is `#colophon`, holding "Not clinical anatomy", the description "MGH CDMD sub_013 · one individual’s MRI reconstruction", the count and the Provenance button.
- **Covered by:** `src/app/regions/StatusRegion.svelte.test.ts` (R, the parts, before the engine, French)

### REGION-03 · The panel region is the one named aside, with no aside inside it

- **Rule:** The panel region is the single `aside#workspace-panel` named "Atlas panel". It holds the workspace's one tablist, the list and detail views and the phone sheet. Nothing inside it is an `aside`; panels are tabpanels or sections.
- **Kind:** accessibility
- **Level:** browser (regions + fake engine)
- **Source:** decision 13 on #4; decision 9 (one tablist); #61 scope; `index.html:189-425`
- **Expected:** `querySelectorAll('aside').length === 1`; `complementary` named "Atlas panel" (FR "Panneau de l’atlas"); one `[role=tablist]` at both 1280 and 390 px; axe `landmark-complementary-is-top-level` passes.
- **Covered by:** `src/app/regions/PanelsRegion.svelte.test.ts` (R, the composed panel and its sheet); `src/app/App.svelte.test.ts` (R, the empty aside); `e2e/parity/workspace.spec.ts` (R; enabled on `next` since #134); `e2e/parity/sheet.spec.ts` (R; `next` since #148)

### REGION-04 · The stage region is the main landmark and holds the stage

- **Rule:** The stage region is `<main id="viewport" tabindex="-1">`. It holds the canvas, the stage status (start, progress, failure), the overlays, the dock, the stage popovers and the section bar.
- **Kind:** behaviour
- **Level:** browser (regions + fake engine)
- **Source:** #62 scope; comment 55 item 1 on #4 (StageStatus inside `main`); `index.html:426-591`
- **Expected:** one `main`; the canvas with `role="application"`, and the stage-status element, are its descendants; no stage control sits outside `main`.
- **Covered by:** `src/app/regions/StageRegion.svelte.test.ts` (R, the landmark holds the overlay, dock and keys; no stage control outside it); `src/app/regions/ShellRegions.svelte.test.ts` (R, the stage status inside it)

### REGION-05 · Dialogs are mounted once, as children of the app root

- **Rule:** Each dialog is a native `<dialog>` mounted once, as a direct child of the app root, so stacking and the inert page never depend on region markup (top layer). The masthead region mounts Keyboard shortcuts and Provenance, which follow `#masthead`; the stage region mounts Linked MRI and Diffusion MRI, which follow the stage's `<main>`. The regions render as fragments, so none of them has a wrapper. The Tracts MRI holds no GPU context, volume or navigator while closed (decision 0008); G5's panes are 2D canvases.
- **Kind:** behaviour
- **Level:** browser (regions + fake engine)
- **Source:** decision record `0008-dialog-mount-points.md`; `index.html:599-697`
- **Expected:** four `dialog` elements, one each with the names "Keyboard shortcuts", "Provenance", the Linked MRI and Diffusion MRI titles. Each one's parent is the app root. With one open, it `matches(':modal')` and the regions are inert (a click on a masthead button does nothing). While the Tracts MRI is closed the engine holds no navigator.
- **Covered by:** `src/app/regions/ShellRegions.svelte.test.ts` (R, all four, their parents, an open one modal and the masthead unfocusable); `src/app/regions/StageRegion.svelte.test.ts` (R, the two MRI dialogs and no navigator while closed)

### REGION-06 · One tooltip serves the whole page

- **Rule:** The page mounts one tooltip, so every `data-tooltip` trigger in the masthead, the panels and the stage shows its tip on hover and on keyboard focus.
- **Kind:** accessibility
- **Level:** browser (regions + fake engine)
- **Source:** `viewer/main.js:81` (`startTooltips()`); comment 70 ("not mounted by anyone yet: `Tooltip.svelte`"); comment 83 item 3 on #4
- **Expected:** keyboard focus on More settings → one `tooltip` with "More settings". Focus on a panel control that has `data-tooltip` → its text. Never two tooltips at once.
- **Covered by:** `src/app/regions/ShellRegions.svelte.test.ts` "the one tooltip" (R, the masthead and a panel control, by keyboard focus, one tooltip at a time)

## Ports and single instances

### REGION-07 · Once the shell mounts, every port is registered

- **Rule:** With every region mounted and the world attached, every controller command reaches a region and every question is answered by one. No command throws "port is not mounted", and no question answers no because nothing registered it.
- **Kind:** behaviour
- **Level:** browser (regions + fake engine)
- **Source:** conductor decision 12 (comment 72 on #4: "I3b adds a test that every port is registered once the shell mounts"); comment 70 (the port list); comment 85 item 1 (the non-raising detail port for links). The unmounted behaviour is BOOT-20.
- **Expected:** after mount and `attach(world)`, these do not throw "not mounted": `showDetail`, `showList`, `revealOnSelect`, `back`, `focusSearch`, `walkTree`, `openFunction`, `openDeficit`, `openLessonMri` (I1); `showMri`, `openPreparedPlane`, `openMpr`, `closeMpr`, `openDiffusionMri` (I2); `toggleShortcuts` (I3b). Each question answers true in its state: `shortcutsOpen()` after `toggleShortcuts()`, `mprOpen()` after `openMpr()`, `diffusionMriOpen()` after `openDiffusionMri()`, `focusInDetail()` with focus in a region detail. Unmounting the app withdraws them all.
- **Covered by:** `src/app/regions/ShellRegions.svelte.test.ts` "the ports" (R, every command reaches a region, the questions answer, and closing the app withdraws them); `src/app/regions/PanelsRegion.svelte.test.ts` and `StageRegion.svelte.test.ts` (R, what each port does)

### REGION-08 · Regions share the root's single stateful instances

- **Rule:** The scene commands, excursions, anatomy commands and the stage-layout store exist once, in the composition root. Regions and features take them from `getApp()` and never build second ones, so excursion state, the intent counter and the framing source are shared.
- **Kind:** hygiene
- **Level:** unit (source scan of `src/app/regions/` and `src/features/`)
- **Source:** conductor decision 12 (comment 72); comment 70
- **Expected:** no call to `createSceneCommands`, `createExcursions`, `createAnatomyCommands` or `createStageLayout` outside `src/app/{application.svelte.ts,world.ts}` and tests.
- **Covered by:** uncovered

### REGION-09 · Features do not mount each other or reach into another feature's DOM

- **Rule:** A feature component is mounted only by a region or by its own feature. A feature never finds another feature's element by id. Cross-panel behaviour goes through controller commands and the focus registry.
- **Kind:** hygiene
- **Level:** unit (source scan)
- **Source:** #4 body, "Composition"
- **Expected:** no `document.getElementById` or `querySelector('#…')` in non-test files under `src/features/` (none today). A component under `src/features/<a>/` is imported only from `src/features/<a>/`, `src/app/regions/` or a test fixture. Snippet props (`trailing`, `stepper`, `comparison`, `relatedDeficits`, `relatedCircuits`, `data`) are filled only in regions or I1's `DetailView`/`ListView`.
- **Covered by:** uncovered

## Masthead and status composition (I3b)

### REGION-10 · A setting chosen in the menu applies to the whole app and is remembered

- **Rule:** A language chosen in the settings panel re-labels every region, sets `<html lang>` and is saved. A theme sets `<html data-theme>`, repaints the scene and is saved. Single keys set `html[data-single-keys]` and turn the single-key shortcuts on or off. A link's language is followed but never saved.
- **Kind:** behaviour
- **Level:** browser (regions + fake engine); e2e for the reload journey
- **Source:** `viewer/app.js:137-148, 606-615`; comment 70 (`onLang` is `app.chooseLanguage`; a link's language goes through `language.follow`); `viewer/state/theme.js`
- **Expected:** choose Français → `html[lang=fr]`, `localStorage['planum-lang'] === 'fr'`, complementary "Panneau de l’atlas", status bar "Pas une anatomie clinique". Choose Dark → `html[data-theme=dark]`, `localStorage['planum.theme'] === 'dark'`, the engine's `applyTheme('dark')` called once. Single keys Off → `html[data-single-keys=off]`, and a view key (`1`) no longer changes the view. Open `#lang=fr` with nothing saved → French, `planum-lang` absent; reload without a hash → English.
- **Covered by:** `src/app/regions/MastheadRegion.svelte.test.ts` "the settings the reader chooses" (R: language with its storage and a link's language, theme with the engine's `applyTheme`, single keys with a key that no longer acts); the reload journey is uncovered at e2e; `e2e/parity/masthead.spec.ts` (R, the attributes only; `next` since #64)

### REGION-11 · Skip to model focuses the canvas, or the stage when the canvas cannot take focus

- **Rule:** Activating the skip link focuses the model's canvas with a visible focus ring. While no canvas can take focus (loading, error), it focuses the stage landmark. The link's view is not changed.
- **Kind:** accessibility
- **Level:** browser (regions + fake engine); one e2e journey on the built page
- **Source:** `viewer/ui/chrome/header.js:167-170`; comment 38 item 2 on #4; deviations `h1a-skip-link.md`, `h2-skip-link-without-script.md`
- **Expected:** status `ready`: Tab, Enter → `activeElement` is the canvas and `matches(':focus-visible')`; `location.hash` unchanged. Status `loading` → `activeElement` is `main#viewport`.
- **Covered by:** `src/app/regions/MastheadRegion.svelte.test.ts` "skip to model" (R: the canvas with `:focus-visible`, the stage while there is no canvas or it cannot take focus, the address left alone); `e2e/parity/masthead.spec.ts` (R, the ready case: `CANVAS`; `next` since #64)

### REGION-12 · Full screen and Save image act on the stage, and their labels follow

- **Rule:** The masthead's Full screen and Save image are enabled while the status is `ready` or `switching`. Full screen puts the stage into fullscreen and the labels become "Exit full screen". Leaving fullscreen in any way restores "Full screen". Save image saves the stage's picture (G6).
- **Kind:** behaviour
- **Level:** browser (regions + fake engine) for the wiring, with the browser's full-screen API stubbed; e2e for real fullscreen, which needs a top-level page
- **Source:** `header.js:200-210`; deviation `h2-fullscreen-label.md`; decisions 4 and 33 on #4
- **Expected:** `loading`, `error`, `context-lost` → both disabled; `ready`, `switching` → enabled. Click Full screen → `document.fullscreenElement` is the stage, and the masthead button (or the phone menu item) is named "Exit full screen". Escape → "Full screen". Save image → a PNG download named as SNAP- specifies.
- **Covered by:** `src/app/regions/MastheadRegion.svelte.test.ts` "Full screen and Save image" (R: enabled by status, Save image reaches the saver with the stage, Full screen asks the stage and the labels follow `fullscreenchange`); entering and leaving real fullscreen, and the downloaded file, are uncovered at e2e; the props are MAST-04, MAST-06

### REGION-13 · The data bar's choices change the model

- **Rule:** Atlas runs the atlas choice. Colour first lifts a tab's paint, then chooses the colouring. Internal anatomy chooses the detail level. The data bar is fed from the session and the model: status, progress, atlas, colour, detail, paint, the published atlases, detail levels and colourings, the subject and the index's subjects.
- **Kind:** behaviour
- **Level:** browser (regions + fake engine); one e2e journey for a real atlas switch
- **Source:** `viewer/app.js:618-636`
- **Expected:** with the Functions paint shown, Colour → T1 MRI → paint `null`, `surfaceColor` `mri`. Destrieux with Colour → CAB-NP networks → atlas `hcp-mmp`, colour `cab-np`, and the Atlas options read "Destrieux (colour becomes Regions)", "HCP-MMP". Internal anatomy → NextBrain → detail `nextbrain`.
- **Covered by:** `src/app/regions/MastheadRegion.svelte.test.ts` "the data bar" (R: Colour lifts the paint and chooses the colouring, Atlas lifts it too, Internal anatomy chooses the detail); the option labels and the CAB-NP atlas change are uncovered at this level; `e2e/parity/data-bar.spec.ts` (R; `next` since #64); `src/features/masthead/DataBar.svelte.test.ts` (R at the component boundary)

### REGION-14 · Choosing another subject reopens the app on that subject

- **Rule:** Stated once as LINK-06 (`links.md`); this entry only points there, so the rule is tested once.
- **Kind:** behaviour
- **Level:** see LINK-06
- **Source:** see LINK-06
- **Expected:** see LINK-06
- **Covered by:** see LINK-06

### REGION-15 · The data popover and the settings panel share one open state

- **Rule:** The masthead region binds the settings panel's open state to the data bar's, so the two are never open together.
- **Kind:** behaviour
- **Level:** browser (regions + fake engine)
- **Source:** `header.js:164-165, 396`; MAST-43
- **Expected:** at 390 px, open the data popover, then More settings → data closed, settings open; the reverse also holds.
- **Covered by:** `src/app/regions/MastheadRegion.svelte.test.ts` "the data popover and the settings panel are never open together" (R, both directions at 390 px); `e2e/parity/data-bar.spec.ts` (R; `next` since #64)

### REGION-16 · Alone on screen, the tract reference replaces the subject everywhere

- **Rule:** While the tract reference is shown alone, the data bar names it (with Colour shown as Tissue) and the colophon describes it as reference data. Provenance lists its source and provenance links. In the Tracts tab the status bar counts bundles instead of regions.
- **Kind:** behaviour
- **Level:** browser (regions + fake engine)
- **Source:** `viewer/app.js:1617-1634`; `header.js:543-549`
- **Expected:** reference-only state → data bar in reference mode, with the reference label and description; colophon "<label> · reference data"; Provenance rows "Tract reference" and "Sources", whose links are the Tracts panel's source and provenance links. Explorer `diffusion` → the count is the reference's bundle detail text.
- **Covered by:** `src/app/regions/MastheadRegion.svelte.test.ts` (R, the data bar in reference mode with no fields, and the Provenance rows and links); `src/app/regions/StatusRegion.svelte.test.ts` (R, the bundle count and the colophon text); the reference's description and Colour as Tissue are DataBar's own (MAST-47)

### REGION-17 · The status bar shows a download only when the data bar does not

- **Rule:** The colophon's count is told whether a data-bar field holds the pending choice, so a download appears in one place only.
- **Kind:** behaviour
- **Level:** browser (regions + fake engine)
- **Source:** `header.js:537-541`; COLO-04
- **Expected:** choose HCP-MMP in the data bar while it downloads → the Atlas option shows "HCP-MMP · Loading 34%" and the count shows "N visible regions". A download started from a link → the count shows "Loading 34%".
- **Covered by:** `src/app/regions/StatusRegion.svelte.test.ts` "the count" (R: a download the data bar holds is not in the count, and the next one, started elsewhere, is); `src/features/colophon/region-count.test.ts` (R, the function)

### REGION-18 · Provenance opens from the colophon and the phone menu, once the manifest is there

- **Rule:** Both openers, the colophon's button and the phone menu's item, open the one Provenance dialog with the loaded manifest, its URLs and the domains. The menu item waits for the manifest. Closing returns focus to the opener, or to More settings when the opener is gone.
- **Kind:** behaviour
- **Level:** browser (regions + fake engine); the phone journey also as e2e
- **Source:** `viewer/ui/panels/provenance.js:137-190`; `header.js:423-425`; #64 scope
- **Expected:** 1280 px: Provenance → dialog "Provenance" with the "Neuropsychological domains" row and domain notes; Escape → focus on the button. 390 px: More settings → Provenance → dialog; Escape → focus on More settings. Before the manifest → no Provenance menu item.
- **Covered by:** `src/app/regions/MastheadRegion.svelte.test.ts` (R, the phone menu: no item before the manifest, then the dialog and focus back on More settings; the tract reference's rows); `src/app/regions/StatusRegion.svelte.test.ts` "Provenance" (R, the colophon's button, animated for a pointer, instant for the keyboard, focus back on the button); `e2e/parity/provenance.spec.ts` (R; `next` since #64)

### REGION-19 · Keyboard shortcuts opens from the menu and from the keymap

- **Rule:** The menu's Keyboard shortcuts and the `?` key open the one shortcuts dialog through the `toggleShortcuts` port. The menu path returns focus to More settings, and the port answers whether the dialog is open.
- **Kind:** behaviour
- **Level:** browser (regions + fake engine)
- **Source:** `viewer/ui/chrome/shortcuts.js:121-125`; deviation `h2-focus-before-dialog.md`; comment 70
- **Expected:** More settings → Keyboard shortcuts → dialog open and `shortcutsOpen()` true; Escape → focus on More settings. `?` with single keys on → opens; `?` again → closes.
- **Covered by:** `src/app/regions/MastheadRegion.svelte.test.ts` "the dialogs" (R: the menu item with focus back on More settings and `shortcutsOpen()`, the menu's entry animation for a pointer and none for the keyboard, `?` opening and closing with none); `e2e/parity/shortcuts.spec.ts` (R; `next` since #64)

## Stage composition (I2)

### REGION-20 · The stage shows the start and its failures from the session, once each

- **Rule:** The stage status in `main` is fed by the session's status and progress and by the app's start failure. It says the start, the end of loading and a start failure once each. Lost and restored context are said by S1's speech, not again here.
- **Kind:** behaviour
- **Level:** browser (regions + fake engine)
- **Source:** comments 50 and 55 item 5 on #4; BOOT-22–BOOT-26 for the screens themselves
- **Expected:** status `loading`, progress 34/100 → a progress bar with value 34 inside `main`. Status `ready` → the bar is gone and the announcer has said "Anatomy loaded." once. A failure → its text in `main` and said once.
- **Covered by:** `src/app/regions/ShellRegions.svelte.test.ts` "the stage status" (R: the progress bar inside `main` and "Anatomy loaded." once ready, a failure in `main` and said); `src/app/boot.svelte.test.ts` (R, BOOT- with H1b's component)

### REGION-21 · The MRI dialogs open from the stage and from the controllers

- **Rule:** The Linked MRI dialog opens from the section bar's opener and from the controllers' `showMri`, `openPreparedPlane` and `openMpr`, and closes with `closeMpr`. The Diffusion MRI dialog opens from the Tracts panel's button and from `openDiffusionMri`. `M` toggles the open one. The question ports answer whether each is open.
- **Kind:** behaviour
- **Level:** browser (regions + fake engine; the dialogs' own WebGL is not needed)
- **Source:** #62 scope; comment 70; comment 81 (M also closes the Tracts MRI); comment 83 item 1
- **Expected:** `openMpr()` → the Linked MRI dialog open, `mprOpen()` true; `closeMpr()` → closed, false. Tracts → Open MRI → the Diffusion MRI dialog open, `diffusionMriOpen()` true; `M` → closed.
- **Covered by:** `src/app/regions/StageRegion.svelte.test.ts` "the MRI dialogs" (R: the ports, `M`, the section row's opener, Escape, and a navigator only while open)

### REGION-22 · The Tracts minimum length is one shared value

- **Rule:** The minimum streamline length set in the Tracts panel is the one the Diffusion MRI navigator draws with.
- **Kind:** behaviour
- **Level:** browser (regions + fake engine)
- **Source:** comment 83 item 1 on #4 (T1's `minimum` bound to one place in the app)
- **Expected:** set the Tracts minimum to 40 mm, open the Diffusion MRI → the navigator's minimum is 40; change it to 60 in the panel → the navigator follows.
- **Covered by:** `src/app/regions/StageRegion.svelte.test.ts` "the Tracts MRI draws with the length the panel set" (R, 40 mm; following a later change is uncovered)

### REGION-23 · The stage layout follows the panel and the window

- **Rule:** The stage-layout store knows the visible part of the stage. It is set when the panels set the camera's chrome insets, and on every desktop resize through the engine's viewport event. The phone sheet's full rest reaches the stage's styles.
- **Kind:** behaviour
- **Level:** browser (regions + fake engine)
- **Source:** `viewer/app.js:121-125`; `viewport-chrome.js:684-791`; comment 83 item 2; `stage.css:720-721`
- **Expected:** desktop resize 1280 → 1000 px → the store's viewport width follows the stage's new width. Sheet at full on a phone → the stage's full-sheet style applies. No second stage-layout store (REGION-08).
- **Covered by:** `src/app/regions/StageRegion.svelte.test.ts` "the stage layout" (R: a desktop resize, and a full phone sheet hiding the dock, scale bar and letters); the store itself is in `state.md`

## Panel composition (I1)

### REGION-24 · The detail view stacks its parts in a fixed order

- **Rule:** The detail view composes, top to bottom: circuit profile, action status, function profile, clinical profile, region detail, related deficits, circuit notes, related circuits. A part with nothing to show is absent.
- **Kind:** behaviour
- **Level:** browser (regions + fake engine)
- **Source:** `index.html:339-424`; #61 scope (the CSS sibling rules become the props `profileAbove` and `landmarkSelected`)
- **Expected:** with a function open and its region selected → the function profile comes before the region detail, and both before related deficits. With a circuit lesson's landmark → the circuit profile first, then notes, then related circuits.
- **Covered by:** `src/app/regions/PanelsRegion.svelte.test.ts` (R, a deficit's profile above the selected region; the full stacking order is uncovered)

### REGION-25 · A click on the model shows the region; a link's detail does not raise the sheet

- **Rule:** Clicking a region on the model selects it and shows its detail, and on a phone raises the sheet. A link that opens a detail at start shows it without raising a phone's sheet over the camera.
- **Kind:** behaviour
- **Level:** browser (regions + fake engine: a fake pick); one e2e journey
- **Source:** `viewer/app.js:527-546, 2065-2068`; decision 12 (interim effect: a click selects and then throws until I1 registers its ports); comment 85 item 1
- **Expected:** 1280 px: pick `destrieux:left:30` → the detail heading is that region's name. 390 px: pick → the sheet at half. Open `#tab=functions&function=<id>` at 390 px → the detail is open and the sheet stays at peek.
- **Covered by:** `src/app/regions/PanelsRegion.svelte.test.ts` (R: a pick opens the detail; a function or lesson link keeps the sheet at peek where a pick raises it); the e2e journey is uncovered

### REGION-26 · The tract reference resets what the old anatomy left on the stage

- **Rule:** When the tract reference becomes active, the hover outline, the outline cache and the framing cache of the anatomy are reset, so nothing of the hidden anatomy stays drawn or framed.
- **Kind:** behaviour
- **Level:** browser (regions + fake engine)
- **Source:** #61 scope (`viewer/app.js:1418-1428`)
- **Expected:** hover a region, switch to the tract reference → no hover outline is drawn (the fake engine records the hover cleared). Focus then frames the reference, not the old region.
- **Covered by:** uncovered

## Gates and journeys

### REGION-27 · Each gate flips with its region, and its specs then run green on `next`

- **Rule:** When a region is integrated, its gate file is set to `true` in the same PR, and the specs it lists then run, and pass, on `next`. No spec is dropped from `next` once its region is integrated.
- **Kind:** hygiene
- **Level:** e2e
- **Source:** #4 body, "Parity proof"; #61, #62 and #64 acceptance criteria; `playwright.config.ts:13-21`
- **Expected:** `enabled/panels.ts` `true` after I1 → `anatomy-tree`, `deficits`, `functions`, `inspector`, `tracts`, `workspace` listed by `playwright test --list --project next`. `enabled/stage.ts` after I2 → `stage-overlay` (and the other stage specs, which are not gated by name). `enabled/shell.ts` after I3b → `boot` (the stage status is mounted by the shell), `data-bar`, `masthead`, `provenance`, `shell`, `shortcuts`. Each spec's run-time `test.skip` on `next` is then inactive.
- **Covered by:** all three gates are `true` (#134, #148, #64), so the panels and shell specs and `stage-overlay` are listed on `next` (`playwright test --list --project next`); whether they pass there is known only from CI's e2e run, since pull requests skip e2e

The e2e journeys worth keeping on `next` after cutover, one test each: the first boot to a drawn model (BOOT-), the skip link to the canvas (REGION-11), a theme and language chosen and kept across a reload (REGION-10), a real atlas switch from the data bar (REGION-13), another subject through a reload (REGION-14, once two subjects are published), real fullscreen (REGION-12), Provenance from the phone menu (REGION-18), the frame fit (SHELL-08), and the head script before the app (SHELL-11, SHELL-13). Everything else in the gated specs is covered by browser tests of the features and, once written, of the regions.
