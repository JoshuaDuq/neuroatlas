# Controller rules

Scope: chunks S2 (the selection and anatomy commands: select, display, focus, isolate, hide,
reveal, the internal-anatomy doors, the cord, reset), S3 (mode switching, function and deficit
excursions, guided lessons, the linked MRI), S5a (the global keymap and the Escape cascade) and the
announcer's sentences (S1, `speech.ts`). Legacy sources: the command closures in `viewer/app.js`,
`viewer/learning/{navigation,session}.js`, `viewer/clinical/navigation.js`,
`viewer/ui/chrome/{sections,shortcuts,workspace}.js`, `viewer/state/{session,internal-mode}.js`.
Permalink reading and writing (S4) is in `links.md` (LINK-). New code: `web/src/lib/controller/`.
Copy quoted below is the English interface text. The selection, display and internal-anatomy rules
are plain logic except where focus moves (CTRL-04, CTRL-08); `src/lib/controller/anatomy.svelte.test.ts`
checks them in the browser today and could run in the unit project over the fake engine, as
`excursion.test.ts` does.

## Selection

### CTRL-01 · Selecting a region shows it in the list and opens its detail

- **Rule:** Selecting a region selects it, expands the tree group that holds it (and leaves an open group alone), opens its detail, raises the phone sheet and dismisses the stage help. Choosing the region already selected opens its detail again.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:527-546`
- **Expected:** select `destrieux:left:30` → selected; one group expanded; detail shown, sheet raised, help dismissed once each; camera not moved. Select it again → detail shown a second time. Clear, then select again → the same group stays expanded, no second group.
- **Covered by:** `src/lib/controller/anatomy.svelte.test.ts` (R), `src/app/boot.svelte.test.ts` (R, a click on the model selects the picked region and shows its detail), `parity/S2.test.ts` (D)

### CTRL-02 · A name chosen from the list is framed; a click on the model is not

- **Rule:** A region picked from the navigator is framed. Re-picking the region already selected, or selecting by clicking the model, keeps the reader's orbit.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:657-665`
- **Expected:** `selectRegion(A, {frame:true})` → one framing on A; again with A → no new framing; `selectRegion(B)` without `frame` → no framing.
- **Covered by:** `src/lib/controller/anatomy.svelte.test.ts` (R), `parity/S2.test.ts` (D)

### CTRL-03 · A region that cannot be selected is refused

- **Rule:** Selecting a region that the current display does not draw (e.g. an HCP-MMP area while Destrieux is loaded) fails, and nothing changes.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:533-534` (`model.select` throws)
- **Expected:** `selectRegion('hcp-mmp:left:1')` throws "not visible"; detail not opened; selection unchanged.
- **Covered by:** `src/lib/controller/anatomy.svelte.test.ts` (R), `parity/S2.test.ts` (D)

### CTRL-04 · Clearing the selection keeps keyboard focus on the page

- **Rule:** Clearing the selection (× or Escape) gives focus to the selected tab in front if the focused control went away, waiting until the interface has updated. A focused control that stays keeps focus.
- **Kind:** behaviour
- **Level:** browser — focus moves
- **Source:** `viewer/app.js:549-556`, `708-711`; deviations `s2-hide-focus-fallback.md` (the wait), `h5-clear-focus.md`
- **Expected:** focused button removed → `clearSelection()` resolves `true`, the active tab has focus, nothing is selected. Focus on a button that stays → resolves `false`, and focus does not move.
- **Covered by:** `src/lib/controller/anatomy.svelte.test.ts` (R); `e2e/parity/workspace.spec.ts` (R; `next` gated off)

### CTRL-05 · Focus frames the selection, or the lesson landmark as authored

- **Rule:** Focus (button or F) frames the selected region from the current viewing direction. When the selection is the open lesson's current landmark on the Circuits tab, it frames the landmark in the lesson's view with the lesson's context margin. A key press frames at once (no eased move).
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:449-472`, `510-524`
- **Expected:** `focusSelection({immediate:true})` → the region is framed with `immediate: true`. In a lesson → `frameLandmark(step.region, step.view, contextMarginMm = 12, {immediate:true})`, then a render. With nothing selected → nothing.
- **Covered by:** `src/lib/controller/anatomy.svelte.test.ts` (R), `src/lib/controller/lesson.test.ts` (R), `parity/S2.test.ts` (D)

## Display and dissection

### CTRL-06 · A display change that drops the selection says so

- **Rule:** A display change (hide, show, undo, restore all, isolate, hemisphere, cortex or internal toggle, opacity) first clears the standing notice. If the change leaves the selected region undrawn, the selection is cleared and the reader is told.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:220-236`; `viewer/i18n/translations.js:493`
- **Expected:** select A, hide B → no notice. Hide A → "Selection cleared — <name> is no longer shown." Next display command → notice is null. Select A, then hemisphere `right` (A on the left) → notice starts "Selection cleared".
- **Covered by:** `src/lib/controller/anatomy.svelte.test.ts` (R), `parity/S2.test.ts` (D)

### CTRL-07 · Undo and Restore all bring parts back

- **Rule:** Undo restores the last hidden parts and the selection they took with them. Restore all shows every hidden part.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1275-1278`
- **Expected:** select A, hide [A, B], undo → A selected again. Hide [B], restore all → no hidden regions.
- **Covered by:** `src/lib/controller/anatomy.svelte.test.ts` (R); `e2e/parity/dissection.spec.ts` (R; `next` gated off: not in the config's ignore list, skips itself); `parity/S2.test.ts` (D)

### CTRL-08 · Hide hands the selection to the dissection and focus to Undo

- **Rule:** The inspector's Hide, with a selection, switches to the Anatomy list, hides the region and puts focus on the dissection's Undo. If Undo cannot take focus, focus goes to the tree's tab stop. If neither can, the command reports that no control took focus. With nothing selected, Hide does nothing.
- **Kind:** behaviour
- **Level:** browser — focus moves
- **Source:** `viewer/app.js:716-723`; deviation `s2-hide-focus-fallback.md`; decision 35 on #4
- **Expected:** no selection → resolves `false`, explorer unchanged. Selection → resolves `true`; explorer `anatomy`; list shown; region hidden; focus on Undo. Undo disabled → focus on the tree stop. Both gone → `false`.
- **Covered by:** `src/lib/controller/anatomy.svelte.test.ts` (R); `e2e/parity/dissection.spec.ts` (R; `next` gated off: not in the config's ignore list, skips itself); `parity/S2.test.ts` (D, focus excluded)

### CTRL-09 · Isolate toggles between the region and the whole brain

- **Rule:** Isolate shows only the selection and frames it (a lesson's landmark is framed as authored). Isolating again releases it and frames the whole brain. With nothing selected, Isolate fails.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:692-701`
- **Expected:** select A, isolate → `isolatedRegion = A`, framing on A. Isolate again → `isolatedRegion = null`, whole brain framed. On a lesson landmark → landmark framed with `{immediate:false}` and no region framing. With no selection → throws "Select a region".
- **Covered by:** `src/lib/controller/anatomy.svelte.test.ts` (R), `parity/S2.test.ts` (D)

### CTRL-10 · Hemisphere reframes; cortex and internal toggles do not

- **Rule:** Changing the hemisphere frames the whole brain. Changing cortex visibility, cortex opacity or internal-structure visibility leaves the camera where it is. Cortex opacity must lie in [0, 1].
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1252-1262`
- **Expected:** hemisphere `left`, cortex off, opacity 0.5, internal off → those settings, and exactly one whole-brain framing. `setCortexOpacity(2)` → `RangeError`.
- **Covered by:** `src/lib/controller/anatomy.svelte.test.ts` (R), `parity/S2.test.ts` (D)

### CTRL-11 · The spinal cord shows, hides, or says it is not published

- **Rule:** Showing the cord draws it and frames the whole brain. Hiding it while a cord region is selected clears the selection and says so (CTRL-06). An anatomy that publishes no cord says so and changes nothing.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1233-1250`; `viewer/i18n/translations.js:340`
- **Expected:** show → `spinalCordVisible` true, `zanatomy:midline:cord` drawn, one whole-brain framing. Select the cord, then hide it → nothing selected, and the "Selection cleared — …" notice. No `zanatomy` layer → "No spinal cord is published for this subject.", still hidden.
- **Covered by:** `src/lib/controller/anatomy.svelte.test.ts` (R: show, unavailable); hiding drops the selection: `parity/S2.test.ts` only (D)

### CTRL-12 · Reset returns to the opening picture

- **Rule:** Reset closes any cut, resets the display (both hemispheres, nothing selected, nothing hidden), clears the search, recentres the camera on the brain and applies the oblique view, without a "selection cleared" notice. It overtakes any command still loading.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1263-1273`
- **Expected:** after view `left`, query "gyrus", a selection and hemisphere `left`, reset → hemisphere `both`, no selection, `view: 'oblique'`, `query: ''`, `notice: null`, cut `off`. A slow command started before reset applies nothing after it.
- **Covered by:** `src/lib/controller/anatomy.svelte.test.ts` (R; overtaking not tested), `parity/S2.test.ts` (D)

## Internal anatomy

### CTRL-13 · Entering internal anatomy shows the structures alone

- **Rule:** The Internal anatomy door closes any cut, clears the search, loads the default detail level, hides the cortex, colours by atlas, clears the system filter and frames the internal structures.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1143-1161`
- **Expected:** toggle from the opening state → `cortexVisible: false`, `surfaceColor: 'atlas'`, `detail` = the default detail, `internalSystem: null`; one internal framing.
- **Covered by:** `src/lib/controller/anatomy.svelte.test.ts` (R), `parity/S2.test.ts` (D)

### CTRL-14 · Leaving internal anatomy gives the whole brain back

- **Rule:** Leaving shows the cortex, clears the system filter and the search, and puts back the colouring and detail level from before entering. A detail level the reader chose while inside is kept. Hemisphere, opacity and selection are not touched. The whole brain is framed.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1163-1189`; `viewer/state/internal-mode.js:33-43`
- **Expected:** enter then leave → `cortexVisible: true`, `surfaceColor` and `detail` as before; framings internal then whole. Choose detail `aseg`, enter, leave → detail `aseg` again. Choose `nextbrain` while inside → still `nextbrain` after leaving.
- **Covered by:** `src/lib/controller/anatomy.svelte.test.ts` (R); `src/lib/core/state/internal-mode.test.ts` (STATE-60, pure); detail restore after `aseg`: `parity/S2.test.ts` only (D)

### CTRL-15 · Leaving says when a colouring was lost to an atlas change

- **Rule:** If the colouring from before entering needs an atlas (CAB-NP and functional divisions need HCP-MMP) and the reader switched atlas while inside, leaving colours by atlas and says why.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1178-1184`; `viewer/i18n/translations.js:494-495`
- **Expected:** atlas `hcp-mmp`, colour `cab-np`, enter, atlas `destrieux`, leave → `surfaceColor: 'atlas'`; notice "CAB-NP colours HCP-MMP areas only, so <Destrieux label> shows its own region colours."
- **Covered by:** `src/lib/core/state/internal-mode.test.ts` (STATE-61: `colourLost` value only); the notice: `parity/S2.test.ts` only (D)

### CTRL-16 · Choosing a system enters internal anatomy by the other door

- **Rule:** Choosing an internal system filters the display to that system. From outside, it first hides the cortex, colours by atlas and records the detail level on screen (not the default), so leaving restores it. It clears the search, opens the structures group and frames the internal structures. "Spinal cord" first shows the cord. An unknown system fails with a notice.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1191-1212`
- **Expected:** choose a learning system → `cortexVisible: false`, `internalSystem` = that system, a `structure:` group expanded; leave → cortex shown, `internalSystem: null`. Detail `aseg`, system "Basal ganglia", detail `learning`, leave → `learning` kept. `'Nowhere'` → a failure notice.
- **Covered by:** `src/lib/controller/anatomy.svelte.test.ts` (R); on-screen detail recorded: `parity/S2.test.ts` only (D)

### CTRL-17 · A later command overtakes the doors while they load

- **Rule:** If another scene command starts while entering or leaving is still loading, the door stops and leaves the scene to the later command. It does not hide or show the cortex, or frame, after that.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1143-1189` (`current()` checks)
- **Expected:** start entering, then `begin()` another command → `cortexVisible` stays `true`. Start leaving, then show the cord → the detail level is not restored over the cord command.
- **Covered by:** `src/lib/controller/anatomy.svelte.test.ts` (R: entering); leaving: `parity/S2.test.ts` only (D)

## Revealing a region

### CTRL-18 · Reveal undoes what hides a region, then selects and frames it

- **Rule:** Activating a hidden region in the tree undoes its hiding reason, re-checks, and moves on to the next reason until the region can be selected, then selects and frames it. The reasons and their undo:
  - removed → show the region
  - cortex hidden → cortex visible and opaque
  - internal hidden → internal structures visible
  - spinal cord hidden → cord shown
  - hemisphere → both hemispheres
  - isolated → release isolation
  - no MRI → tissue colouring
  - other detail → load the region's detail level
  - other system → clear the system filter
  - no cut → CTRL-19

  If the same reason comes back, the reveal fails with a notice and selects nothing.

- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:569-598`, `675-686`; `viewer/catalog/visibility.js`
- **Expected:** hemisphere `right`, reveal(`hemisphere`, `destrieux:left:30`) → `both`, selected, framed. Cortex hidden and region removed, reveal(`removed`) → cortex visible, selected. reveal(`hemisphere`, `hcp-mmp:left:1`) under Destrieux → failure notice, nothing selected.
- **Covered by:** `src/lib/controller/anatomy.svelte.test.ts` (R: hemisphere, removed→cortex, failure); the other reasons: `parity/S2.test.ts` only (D, random walk)

### CTRL-19 · A cut-only region is revealed by a coronal cut through its centre

- **Rule:** A region seen only in a cut is revealed by opening a coronal cut placed through the region's centroid: offset = centroid · plane normal, clamped to the cut's offset range. Non-finite inputs fail.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:579-586`; `viewer/slices/coordinates.js:24-31`
- **Expected:** reveal(`no-cut`, id) → mode `coronal`; `offset = clamp(c·n, min, max)` for centroid c and normal n (exact; e.g. c = (10, -20, 5), n = (0, 1, 0), range [-80, 60] → -20; c·n = -95 → -80). Region selected.
- **Covered by:** `src/lib/engine/slices/coordinates.test.ts` (engine area; tests the engine's `offsetThrough`, not the copy in `controller/anatomy.ts:136`); the reveal: `parity/S2.test.ts` only (D)

### CTRL-20 · A constituent opens with its own layers

- **Rule:** Choosing a constituent of an overview structure clears the system filter, loads the layers that draw it, selects it and frames it.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1213-1225`
- **Expected:** `openConstituent(<aseg structure>)` → that region selected, one region framing.
- **Covered by:** `src/lib/controller/anatomy.svelte.test.ts` (R), `parity/S2.test.ts` (D)

## Mode switching

### CTRL-21 · Tracts turns on its overlay and gives the cortex opacity back on leaving

- **Rule:** On the anatomy the tract reference belongs to, choosing Tracts turns on the tract overlay. If the cortex is fully opaque, Tracts sets it to the tracts' default opacity. Leaving Tracts removes the overlay and restores the opacity from when Tracts was entered, including 0, whatever was set inside. On another subject's anatomy, Tracts changes neither.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1045-1065`; `viewer/diffusion/native-ui.js:253`
- **Expected:** opacity 1 → Tracts → tracts default (`overlay_cortex_opacity`, 0.16 in the fake) → Anatomy → 1; overlay on, then off. Opacity 0.64 → Tracts (stays 0.64), set 0.22, Tracts again, Anatomy → 0.64. Visit with 0 → 0. Other subject → no overlay; opacity 0.7 kept.
- **Covered by:** `src/lib/controller/modes.test.ts` (R), `parity/S3.test.ts` (D, 6 seeds × 60 steps)

### CTRL-22 · A tab chosen during a lesson waits for the lesson's scene; the last choice wins

- **Rule:** Choosing a tab while a lesson is open first ends the lesson and puts its scene back (LESSON-08), then shows the tab. If two tabs are chosen while the leave is in flight, only the later one is shown.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1345-1352`
- **Expected:** lesson open on Circuits, choose Anatomy → lesson closed, held scene re-applied, explorer `anatomy`. Choose Functions, then Deficits, before the leave resolves → only `deficits` chosen.
- **Covered by:** `src/lib/controller/modes.test.ts` (R), `parity/S3.test.ts` (D)

### CTRL-23 · Back on Functions or Deficits, an open item is redrawn on its own atlas

- **Rule:** Returning to Functions with a function open while another atlas is shown opens the function again, which loads the domains' atlas. Returning to Deficits with a deficit open whose mapped cortex lies on another atlas opens the deficit again. Otherwise the scene is left as it is. The reopen goes through the panel's entry point and is not awaited.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1353-1361`
- **Expected:** open `language`, Anatomy, switch to a non-HCP atlas, Functions → explorer `functions`, atlas = domains atlas, `selectedFunction: 'language'`. Same atlas → no reframe. Deficit `acalculia`, other atlas, Deficits → atlas of its cortical region, regions framed.
- **Covered by:** `src/lib/controller/modes.test.ts` (R; the same-atlas case is W: it asserts before the un-awaited re-open could show), `parity/S3.test.ts` (D)

## Excursions

### CTRL-24 · Opening a deficit shows its profile at once, then draws and frames its regions

- **Rule:** Opening a deficit keeps the scene from before the excursion (only the first item of an excursion keeps it), ends any lesson, shows Deficits and opens the profile at once. It then draws the mapped regions together and frames them. A command that overtakes it stops it before it draws, notices or frames, but the profile stays open and the scene stays held.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:974-995`; `viewer/clinical/navigation.js:39-53`
- **Expected:** `openDeficit('acalculia')` → `true`; one scene captured; Restore offered; explorer `deficits`; `selectedDeficit: 'acalculia'`; detail shown before the reveal; the last framing is `frameRegions(mappedRegions('acalculia'))`, after the paint is drawn. Overtaken → `false`, no framing, notice null, Restore still offered.
- **Covered by:** `src/lib/controller/excursion.test.ts` (R), `src/lib/controller/excursion.svelte.test.ts` (R), `parity/S3.test.ts` (D)

### CTRL-25 · Opening a function draws its areas and frames the whole brain

- **Rule:** Opening a function does the same as a deficit (CTRL-24), but shows Functions, draws every area the function's paint colours, and frames the whole brain.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:997-1017`
- **Expected:** `openFunction('language')` → `true`; explorer `functions`; every id in `domainPaint(domains,'language').colors` drawn; the last framing is the whole brain.
- **Covered by:** `src/lib/controller/excursion.test.ts` (R), `parity/S3.test.ts` (D)

### CTRL-26 · A region a function or deficit names is opened as an excursion step

- **Rule:** A region listed by a function or deficit is drawn, selected and framed with context around it. It holds the scene if no excursion holds one yet.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1019-1034`
- **Expected:** `openListedRegion('destrieux:left:25')` → `true`, selected, Restore offered, `frameRegions(['destrieux:left:25'])`.
- **Covered by:** `src/lib/controller/excursion.test.ts` (R), `parity/S3.test.ts` (D)

### CTRL-27 · Restore previous view returns to the scene before the excursion

- **Rule:** Restore puts back the scene held by the excursion's first item, however many steps followed. It closes the item in front, says "Previous view restored." and offers nothing more to restore. A restore that fails in part reports every cause and keeps the scene for another try. A restore overtaken by a later command changes nothing. With no held scene, Restore fails.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:846-864`; `viewer/clinical/translations.js:31`
- **Expected:** deficit, deficit, listed region, Restore → `true`; the re-applied scene is the first capture; Restore not offered; `selectedDeficit: null`; notice "Previous view restored.". On Functions → `selectedFunction: null`. Partial failure → `AggregateError` with each cause logged; Restore still offered; deficit still open. Overtaken → `false`, unchanged. None held → error "no scene".
- **Covered by:** `src/lib/controller/excursion.test.ts` (R; the scene reader is a `vi.fn`); `e2e/parity/deficits.spec.ts`, `functions.spec.ts` (R; `next` gated off); `parity/S3.test.ts` (D)

### CTRL-28 · Closing the deficit or function ends the excursion where it stands

- **Rule:** Closing the open deficit or function ends the excursion. The scene stays as it is and Restore is no longer offered.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:866-877`
- **Expected:** open, close → item null, Restore not offered, no scene re-applied.
- **Covered by:** `src/lib/controller/excursion.test.ts` (R), `parity/S3.test.ts` (D)

### CTRL-29 · An item opened from a lesson ends it and takes over its scene

- **Rule:** A function or deficit opened from inside a lesson ends the lesson. The scene from before the lesson becomes the excursion's, so Restore returns there and leaving the lesson has nothing left to restore.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:978-982`, `1000-1002`
- **Expected:** open a circuit (one capture), open `language` → lesson closed, still one capture; Restore re-applies the lesson's held scene; `leaveLesson()` re-applies nothing more. The same holds for `openDeficit('acalculia')`.
- **Covered by:** `src/lib/controller/excursion.test.ts` (R: function); deficit: `parity/S3.test.ts` only (D)

### CTRL-30 · An opened map says what it changed and labels the cut with its atlas

- **Rule:** After drawing a function's or deficit's regions, the reader is told which of their settings the reveal changed (atlas, cut, isolation, hemisphere, cortex), in one notice with any see-through offer. Where a cut atlas with the surface atlas's id is published, the cut is labelled by that atlas too.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:879-900`; `viewer/ui/panels/clinical.js` (`revealNotice`)
- **Expected:** a reveal that changes the atlas → a notice that names the change. Surface atlas `destrieux`, with `destrieux` in `cut_atlases` → `cutAtlas: 'destrieux'`.
- **Covered by:** wording is PANEL-12 (`core-panels.md`); in the controller, `parity/S3.test.ts` only (D)

### CTRL-31 · A map with a strongest region beneath the cortex offers to see through it

- **Rule:** With the cortex shown and fully opaque, a function offers to see through the cortex when one of its 5 strongest regions lies beneath the cortex; the offer names that region, its side and the function. A deficit offers it when its mapped regions include structures beneath the cortex. The deficit's notice names them: all of them up to three, otherwise two and "N other mapped regions". The overview of all functions offers nothing. A deficit mapped on structures alone hides the cortex and offers nothing. A cortex the reader made see-through by hand gets no offer.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:902-962`; `viewer/i18n/translations.js:206-207`; `viewer/clinical/translations.js:11-12`
- **Expected:** a deep function → notice action `see-through`, text matches /beneath the cortex/. `neglect` → action `see-through`. Five deep names → text contains "3 other mapped". `ALL_DOMAINS` → no action. `abulia` → `cortexVisible: false`, no action. Opacity 0.4 before a deep function → no offer.
- **Covered by:** `src/lib/controller/excursion.test.ts` (R); the by-hand case: `parity/S3.test.ts` only (D)

### CTRL-32 · Taking the offer makes the cortex see-through until a map needs none

- **Rule:** Taking the offer sets the cortex opacity to the manifest's see-through opacity, replaces the offer with a confirmation, and keeps the change undoable from Display. A later map that makes the same offer keeps it and does not repeat the offer. A later map that needs none makes the cortex opaque again and says "Cortex made opaque again."
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:932-972`; `viewer/i18n/translations.js:330-331`
- **Expected:** take the offer → `cortexOpacity` = `appearance.see_through_opacity` (0.15 on cdmd); notice matches /see-through/; action null. Then `ALL_DOMAINS` → opacity 1, notice "Cortex made opaque again.". Then the same deep function → stays 0.15, no action.
- **Covered by:** `src/lib/controller/excursion.test.ts` (R), `parity/S3.test.ts` (D)

### CTRL-33 · A search carried to the other evidence tab opens that tab's list on the same words

- **Rule:** Searching Functions from Deficits, or the other way round, carries the words to that tab's search field, closes the item in front, ends the excursion and shows the other tab. The bridge's counts are the number of matches the other tab would list. A deficit lists the curated functions whose lesion checks cite it.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1066-1086`
- **Expected:** deficit open, `searchIn('functions','memory')` → explorer `functions`, `functionQuery: 'memory'`, `selectedFunction: null`, Restore not offered. `functionsMatching('qqqqzzzz')` → 0. `checkedMaps(d)` → only domains with a lesion check citing d.
- **Covered by:** `src/lib/controller/excursion.test.ts` (R; the deficit count is W, compared with the same `clinical.search` it calls), `e2e/parity/deficits.spec.ts` (R; `next` gated off), `parity/S3.test.ts` (D)

### CTRL-34 · A stage key row shows one function or one finding alone

- **Rule:** On Functions, a row of the stage key opens that function, and clearing it returns to all functions. On Deficits, a row shows that finding alone, and clearing it shows all findings.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1036-1045`
- **Expected:** `pickPaint(null)` on Functions → `selectedFunction: ALL_DOMAINS`; `pickPaint('working-memory')` → `'working-memory'`. On Deficits, `pickPaint('finding')` → `selectedFinding: 'finding'`; `null` → `null`.
- **Covered by:** `src/lib/controller/excursion.test.ts` (R), `parity/S3.test.ts` (D)

### CTRL-35 · Choosing an atlas or a colour lifts the open paint first

- **Rule:** A function's or deficit's paint names areas of one atlas, so choosing another atlas or surface colour lifts the paint before applying the choice.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:600-604`
- **Expected:** with `language` open, `chooseSurfaceColor('tissue')` → `paintLifted: true`, `surfaceColor: 'tissue'`. `chooseAtlas(other)` → `paintLifted: true`, atlas = other.
- **Covered by:** `src/lib/controller/excursion.test.ts` (R), `parity/S3.test.ts` (D)

### CTRL-36 · A failure that needs a newer deploy offers Reload

- **Rule:** When a panel's load fails because the assets were updated, the notice offers Reload. Other failures are worded by the panel itself.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:833-836`
- **Expected:** `code: 'asset-updated'` → notice action `reload`. Any other code → notice null.
- **Covered by:** `src/lib/controller/excursion.test.ts` (R)

### CTRL-37 · A link's scene is the new baseline

- **Rule:** After a permalink is applied, there is no earlier scene to restore, so Restore is not offered.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:2013-2080` (links set `beforeExcursion = null`)
- **Expected:** deficit open, `forget()` → Restore not offered.
- **Covered by:** `src/lib/controller/excursion.test.ts` (R), `src/app/boot.svelte.test.ts` (R, through a real link restore); link restore itself is LINK-14 (`links.md`)

### CTRL-38 · A failed cut-atlas change reaches the caller

- **Rule:** The cut atlas is the sections' own setting. A rejected change reaches the caller instead of being swallowed. Legacy caught it, and the cuts panel reported it (`app.js:564-566`); no deviation file records the change.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:557-566`
- **Expected:** `setCutAtlas('destrieux')` → `cutAtlas: 'destrieux'`. A rejection "overtaken" → the promise rejects with it.
- **Covered by:** `src/lib/controller/excursion.test.ts` (R)

## Linked MRI

### CTRL-39 · The Linked MRI opens on the selected region

- **Rule:** The selection's own Linked MRI button centres the MRI crosshair on the selected region's centroid. The cut bar's button moves the crosshair there only when it is still at the origin; otherwise it opens where the crosshair is. With nothing selected, the MRI opens at the crosshair. MRI data loads before the dialog shows. An open without a pointer (keyboard) shows the dialog at once.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/sections.js:219-237`
- **Expected:** crosshair (1,2,3), region button → crosshair = centroid, `show({instant:true})` after `sections.load`. Bar button at (1,2,3) → stays (1,2,3); at (0,0,0) → centroid, `show({instant:false})`. No selection → (0,0,0), shown once.
- **Covered by:** `src/lib/controller/lesson.test.ts` (R)

## Lessons

### LESSON-01 · Opening a lesson shows its first landmark as authored

- **Rule:** Opening a circuit holds the scene from before (a lesson already open keeps the scene it holds) and opens the detail. It then draws, selects and uncovers the first landmark, frames it in the step's view with the catalogue's context margin, sets that view, and starts the lesson at step 0.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1311-1322`, `1366-1373`; `viewer/learning/session.js:6-9`
- **Expected:** `openCircuit(c)` → one capture; lesson `{circuit: c, step: 0, visited: [0]}`; selection = step 0's region; `frameLandmark(region, view, 12, {})`; session view = step view. Opening a second circuit → still one capture.
- **Covered by:** `src/lib/controller/lesson.test.ts` (R), `src/lib/controller/excursion.svelte.test.ts` (R), `e2e/parity/circuits.spec.ts` (R; `next` gated off: not in the config's ignore list, skips itself), `parity/S3.test.ts` (D)

### LESSON-02 · A landmark that is not drawn is refused

- **Rule:** If the landmark's geometry is not drawn, the lesson fails with "Landmark geometry unavailable: <region>" and does not start.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1311-1316`
- **Expected:** `frameLandmark` → false → rejects /Landmark geometry unavailable/; `lesson.circuit === null`.
- **Covered by:** `src/lib/controller/lesson.test.ts` (R)

### LESSON-03 · An overtaken lesson opening stops before framing or starting

- **Rule:** If another command starts while a lesson's landmark is loading, the lesson neither frames nor starts.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1366-1373`
- **Expected:** `openCircuit`, then `begin()` → no landmark framing; lesson null.
- **Covered by:** `src/lib/controller/lesson.test.ts` (R)

### LESSON-04 · A related lesson opens on its landmark in the Circuits tab

- **Rule:** A lesson opened from another panel's "related circuits" opens on the named landmark in the Circuits tab. The opening step and that landmark both count as visited.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1374-1382`
- **Expected:** `openLessonLandmark(c, 2)` → explorer `circuits`; lesson `{circuit: c, step: 2, visited: [0, 2]}`; selection = step 2's region.
- **Covered by:** `src/lib/controller/lesson.test.ts` (R), `e2e/parity/circuits.spec.ts` (R; `next` gated off: not in the config's ignore list, skips itself), `parity/S3.test.ts` (D)

### LESSON-05 · Stepping moves the lesson; a step that does not exist is refused

- **Rule:** Stepping opens the step's landmark, moves the lesson there, records the step as visited and shows the detail when the Circuits tab is in front. A step index outside the circuit fails with a `RangeError`, and the lesson stays where it was.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1383-1392`; `viewer/learning/session.js:13-19`
- **Expected:** `openLessonStep(1)` → `step: 1`; selection = step 1's region; detail shown. `openLessonStep(steps.length)` → `RangeError`; `step` still 1.
- **Covered by:** `src/lib/controller/lesson.test.ts` (R), `src/lib/core/learning/session.test.ts` (CAT-55), `parity/S3.test.ts` (D)

### LESSON-06 · The landmark in front is the current step's region on the Circuits tab

- **Rule:** The selection counts as the lesson's landmark only when a lesson is open, the Circuits tab is in front, and the selected region is the current step's region. Focus, Isolate and the Linked MRI use this test (CTRL-05, CTRL-09, LESSON-09).
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:449-455`
- **Expected:** no lesson → null. Lesson open on Anatomy → null. On Circuits → step 0. Selection cleared → null.
- **Covered by:** `src/lib/controller/lesson.test.ts` (R)

### LESSON-07 · A landmark is uncovered and shown on its own side

- **Rule:** Once a landmark is drawn and selected, the lesson shows the regions in the step's `restores` and hides its `covering_regions`. It shows the landmark's hemisphere, or both for a midline landmark. A landmark region that does not exist is refused.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/learning/navigation.js:1-7`
- **Expected:** on cdmd, the `cerebellar` circuit's dentate step (`learning:left:dentate`) hides its 10 covering lobules, and returning to step 0 (`learning:lobule-v-left`) shows all 10 again. `learning:left:fornix` → hemisphere `left`; `learning:midline:optic-chiasm` → `both` and internal structures visible; a right landmark → `right`. Region `nowhere` → error "Unknown landmark region: nowhere".
- **Covered by:** `src/lib/controller/navigation/learning.test.ts` (R); right side: `parity/S3.test.ts` only (D)

### LESSON-08 · Leaving a lesson puts back the scene from before it

- **Rule:** Leaving a lesson (back to the list, or to another tab) ends it, puts back the scene from before it, and keeps the list in front. A link that names the lesson's landmark leaves no earlier scene, so leaving re-applies nothing. A link that names only the circuit keeps the scene as the link set it up, before the landmark was opened, and leaving returns there. With no lesson open, or the Circuits tab not in front, leaving does nothing. If only part of the scene comes back, the reader is told. If a later command takes over during the leave, the list is not shown.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1323-1343`, `2055-2062`
- **Expected:** lesson on Circuits, leave → lesson null; the held scene re-applied; list shown. Link-opened on its landmark (`forget()`) → nothing re-applied; list not shown. `#tab=circuits&circuit=<first circuit>` → the first landmark selected; leave → nothing selected. Not on Circuits → lesson still open. Partial failure → a notice, lesson null. Overtaken → list not shown.
- **Covered by:** `src/lib/controller/lesson.test.ts` (R), `src/app/boot.svelte.test.ts` (R, the circuit-only link), `parity/S3.test.ts` (D)

### LESSON-09 · Under a lesson, the landmark's Linked MRI opens the lesson's plane on the landmark

- **Rule:** With the lesson's landmark in front, the selection's Linked MRI button opens the lesson's prepared plane instead of the plain MRI. It prepares the cut, puts the crosshair on the landmark's own centroid, shows the overlay without reversing, sets the authored plane, faces the cut, and then opens the plane. A missing or non-finite centroid, or an MRI that fails to load, is an error; no other location opens.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1393-1425`; `viewer/learning/navigation.js:9-18`
- **Expected:** crosshair = `centroidOf(step.region)`; `setDisplay({reverse: false, overlay: true})`; mode = `step.plane`; `openPreparedPlane(step.plane, …)` called once and the plain `show` not called. Centroid `null`, `[0, NaN, 0]` or `[1, 2]` → rejects /centroid/. `setMode` failure → rejects with that error.
- **Covered by:** `src/lib/controller/lesson.test.ts` (R), `src/lib/controller/navigation/learning.test.ts` (R; the 2-element centroid only in `parity/S3.test.ts`, D), `src/features/circuits/circuits.svelte.test.ts` (R, through the panel's entry point)

### LESSON-10 · The lesson's MRI waits for nothing the reader has moved on from

- **Rule:** The prepared plane opens only while the same lesson step is in front on the Circuits tab and no newer command has started. If the reader steps on, leaves the tab, or starts another command, the plane is not opened, and the crosshair and cut are not set for the abandoned step.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1393-1418` (`canOpen`)
- **Expected:** stepping inside `openPreparedPlane` → `canOpen()` turns false; Anatomy chosen before it settles → `openPreparedPlane` not called. A `begin()` during `prepareCut` → no crosshair set, no `faceCut`, no plane.
- **Covered by:** `src/lib/controller/lesson.test.ts` (R; a mutation check confirms the Circuits-tab condition is tested)

## Keyboard

### KEY-01 · Keys already handled, compositions, modified keys and the diffusion MRI are left alone

- **Rule:** The page ignores:
  - a key a control already handled (`defaultPrevented`)
  - a key used by an input composition
  - any key with Ctrl, Meta or Alt (Shift is allowed)
  - every key while the diffusion MRI navigator is open
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1883-1896`
- **Expected:** Escape with `defaultPrevented` → nothing; without it → clears the selection. Escape with Ctrl, or while composing → nothing. Diffusion MRI open: `m ? Escape 1` → no command.
- **Covered by:** `src/lib/controller/keymap.test.ts` (R; modifiers only on Escape and M), `parity/S5a.test.ts` (D: every key × modifier)

### KEY-02 · With the linked MRI open, M closes it and nothing else acts

- **Rule:** While the linked MRI dialog is open, only M acts: it closes the dialog. M must have no modifier, come from a target where single-key shortcuts may act, and single keys must be on. Escape is left to the dialog.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1886-1895`
- **Expected:** `M` from a button → closed, key cancelled. Single keys off, or from a text input, textarea or contenteditable, or with Ctrl/Meta/Alt, or composing → nothing. Escape → nothing.
- **Covered by:** `src/lib/controller/keymap.test.ts` (R), `parity/S5a.test.ts` (D)

### KEY-03 · Escape steps back one level at a time

- **Rule:** Escape steps back one level per press:
  1. Shortcut sheet open → nothing (the dialog closes itself).
  2. Focus in a region's detail → Back, and the selection stays.
  3. A region selected → clear it and rescue focus.
  4. On Functions with a function open → close it and rescue focus.
  5. A deficit open → close it and rescue focus.
  6. Otherwise nothing.

  Under the tract reference, Escape does nothing.

- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1897-1920`
- **Expected:** detail + selection → `back` only. Selection + function + deficit → `clearSelection`, then `rescueFocus`. Function + deficit on Functions → `closeFunction` + `rescueFocus`. Function on Anatomy → no `closeFunction`. Deficit → `closeDeficit` + `rescueFocus`. Sheet open, or tract reference → nothing.
- **Covered by:** `src/lib/controller/keymap.test.ts` (R), `e2e/parity/shortcuts.spec.ts` (R, sheet; `next` gated off), `parity/S5a.test.ts` (D)

### KEY-04 · Escape from a form field still steps back unless the field used it

- **Rule:** Escape is judged before the form-field gate (KEY-05). Escape pressed in a text field that did not consume it (an empty search) still runs the Escape cascade. A field that clears its text marks the key handled, and the page leaves it (KEY-01).
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1898-1921`
- **Expected:** focus in `INPUT type=text`, a region selected, Escape not prevented → selection cleared + focus rescued.
- **Covered by:** `parity/S5a.test.ts` only (D)

### KEY-05 · Form fields keep the keys they use

- **Rule:** No shortcut acts from a text-type input (text, search, email, number, password, tel, url, untyped), a textarea, a select or contenteditable. A slider keeps its arrows, Home, End, PageUp and PageDown, but other keys still act. A checkbox does not block shortcuts.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/session.js:13-37`; `viewer/app.js:1921`
- **Expected:** `c` in a text input → no cortex toggle. ArrowDown on a range input → no tree walk. `c` on a range input → cortex toggled. `c` on a checkbox → toggled.
- **Covered by:** `src/lib/core/state/session.test.ts` (STATE-33, the predicate); in dispatch: `parity/S5a.test.ts` only (D)

### KEY-06 · Single-key shortcuts can be turned off, and controls with keys of their own keep them

- **Rule:** Single-character shortcuts stop when the reader turns them off (WCAG 2.1.4). They also never act from a button, summary or tab inside a region that owns its keys. A tree row there is not such a control.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/shortcuts.js:9-25`; `viewer/app.js:1925-1926`
- **Expected:** `h` on a button in a marked region → nothing; `h` on a plain row in it → hemisphere `left`; single keys off → `h` does nothing.
- **Covered by:** `src/lib/controller/keymap.test.ts` (R), `src/app/boot.svelte.test.ts` (R, the preference through the window listener), `src/lib/core/keyboard.test.ts` (STATE-34), `parity/S5a.test.ts` (D)

### KEY-07 · On the focused canvas the arrows turn the model and + = - zoom it

- **Rule:** While the 3D canvas itself has focus, the arrow keys orbit and `+`, `=` and `-` zoom, even with single keys off. Each such key is cancelled. Elsewhere the arrows keep their other uses (KEY-10).
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1859-1876`, `1922`; `viewer/render/keyboard-orbit.js:19-27`
- **Expected:** single keys off: `+` and `-` → two dolly steps, the first < 1 (zoom in); ArrowLeft → one orbit turn. Step sizes are in the engine area (`keyboard-orbit.test.ts`).
- **Covered by:** `src/lib/controller/keymap.test.ts` (R; `=` not pressed), `src/app/boot.svelte.test.ts` (R, ArrowLeft and `=` on the canvas), `parity/S5a.test.ts` (D)

### KEY-08 · ? toggles the shortcut sheet, and only ? acts while it is open

- **Rule:** `?` opens or closes the shortcut sheet at once (no fade). While the sheet is open, every other shortcut is ignored.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1927-1928`
- **Expected:** `?` → `toggleShortcuts({instant: true})`, key cancelled. Sheet open: `c / 1 m` → nothing; `?` → toggled.
- **Covered by:** `src/lib/controller/keymap.test.ts` (R), `e2e/parity/shortcuts.spec.ts` (R; `next` gated off), `parity/S5a.test.ts` (D)

### KEY-09 · / goes to the search of the explorer in front

- **Rule:** `/` shows the list and focuses the explorer's search: the Anatomy, Functions or Deficits search field, the Circuits list, or the Tracts panel. The key is cancelled.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1929-1940`
- **Expected:** `/` on Anatomy → list shown, then anatomy search focused; on Functions → functions search; Deficits → deficits search; Circuits → circuit list; Diffusion → tracts.
- **Covered by:** `parity/S5a.test.ts` only (D)

### KEY-10 · ArrowDown and ArrowUp walk the region tree, except from a tab

- **Rule:** In the Anatomy explorer, ArrowDown and ArrowUp move to the next and previous tree row from anywhere on the page that is not a form field, and the key is cancelled. In other explorers they are left alone. With focus on a tab they are neither handled nor cancelled, so the browser's default applies.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1941-1944`; deviation `s5a-arrows-in-tablist.md`; decision 19 on #4
- **Expected:** Anatomy, ArrowDown, ArrowUp → walk +1, −1. Functions, Deficits, Circuits or Diffusion → nothing, not cancelled. On a `[role="tab"]` → nothing, not cancelled.
- **Covered by:** `src/lib/controller/keymap.test.ts` (R), `e2e/parity/anatomy-tree.spec.ts` (R; `next` gated off), `parity/S5a.test.ts` (D, tabs excluded)

### KEY-11 · Digits choose the preset views

- **Rule:** `0` chooses the oblique view; `1` to `6` choose left, right, anterior, posterior, superior and inferior. The view is applied at once, and the stage help is dismissed. Other digits do nothing.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:66`, `1878-1881`, `1945-1947`
- **Expected:** `0..6` → oblique, left, right, anterior, posterior, superior, inferior with `{immediate: true}`. `7`, `9` → nothing.
- **Covered by:** `src/lib/controller/keymap.test.ts` (R), `src/app/boot.svelte.test.ts` (R, `1` frames `left` and retires the stage hint), `parity/S5a.test.ts` (D)

### KEY-12 · M opens the MRI of the explorer in front

- **Rule:** In Tracts, `m` or `M` opens the diffusion MRI, even under the tract reference. Elsewhere it presses the linked MRI opener at once, except under the tract reference. A disabled opener does nothing.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1948-1952`, `1982-1986`; `viewer/ui/chrome/sections.js:236`; deviation `g4-linked-mri-busy.md` (an opener busy loading counts as disabled)
- **Expected:** Diffusion + reference → `openDiffusionMri`, cancelled, no `openMpr`. Anatomy + reference → nothing. Anatomy → `openMpr({instant: true})`.
- **Covered by:** `src/lib/controller/keymap.test.ts` (R), `parity/S5a.test.ts` (D); the busy opener refusing a second press: `src/features/sections/section-controls.test.ts` (R, sections area); `M` reaching a disabled or busy opener is uncovered

### KEY-13 · F focuses and I isolates the selection

- **Rule:** `F` frames the selection at once (CTRL-05). `I` toggles isolation (CTRL-09). Both work in either case, only with a selection, and not under the tract reference. The key is cancelled only when it acts.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1953-1967`
- **Expected:** selection → `focusSelection({immediate: true})` / `isolateSelection()`. No selection, or under the reference → nothing.
- **Covered by:** `src/lib/controller/keymap.test.ts` (R), `parity/S5a.test.ts` (D)

### KEY-14 · C, U, S and H toggle the display

- **Rule:** `C` toggles the cortex, `U` the internal structures and `S` the spinal cord. `H` cycles the hemisphere both → left → right → both. They work in either case, not under the tract reference, and the key is not cancelled.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1968-1981`
- **Expected:** with cortex on, internal off, cord off, hemisphere `right`: `C U S H` → cortex false, internal true, cord true, hemisphere `both`; none prevented. both→left, left→right, right→both.
- **Covered by:** `src/lib/controller/keymap.test.ts` (R), `src/app/boot.svelte.test.ts` (R, `c`), `e2e/parity/anatomy-tree.spec.ts` (R, `h`; `next` gated off), `parity/S5a.test.ts` (D)

### KEY-15 · A control handles its keys before the page

- **Rule:** The page's keymap is one window `keydown` listener in the bubble phase, so a focused control's own handling, and its `preventDefault`, come first. It is removed when the app is torn down.
- **Kind:** behaviour
- **Level:** browser — real event propagation, a focused control before the window
- **Source:** `viewer/app.js:1988`
- **Expected:** one `keydown` listener without capture; `?` through it toggles the sheet; after removal, no listener.
- **Covered by:** `src/lib/controller/keymap.test.ts` (I: stubs `addEventListener`); `src/app/boot.svelte.test.ts` (R: keys dispatched on the page reach the listener, and none after teardown). That a focused control's `preventDefault` comes first is uncovered.

### KEY-16 · Controls advertise the same keys in aria-keyshortcuts

- **Rule:** Controls that a shortcut also triggers name the same key in `aria-keyshortcuts`. `?` is written "Shift+/" (ARIA 1.2), and the other keys as matched.
- **Kind:** behaviour
- **Level:** unit
- **Source:** deviation `s5b-shortcut-strings.md`
- **Expected:** `ARIA_KEYSHORTCUTS.shortcuts === 'Shift+/'`; `cortex === 'C'`.
- **Covered by:** `src/lib/controller/keymap.test.ts` (R)

## Speech (the announcer)

### KEY-17 · The selection is said once, with its side

- **Rule:** The first view says nothing. A new selection says "Selected: <name>, <side>", only once. Clearing the selection says an empty sentence.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1658-1690`
- **Expected:** select a left region → `['Selected: Precentral gyrus, left']`; same view again → `[]`; cleared → `['']`.
- **Covered by:** `src/lib/controller/speech.test.ts` (R)

### KEY-18 · A notice outranks the selection it accompanies

- **Rule:** When a new notice and a selection arrive together, the notice is said instead of the selection, once. A later change of selection is said again.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1670-1678`
- **Expected:** notice "Internal anatomy is hidden" + selection → that notice only; repeated → `[]`; selection moves to the right → "Selected: Precentral gyrus, right".
- **Covered by:** `src/lib/controller/speech.test.ts` (R)

### KEY-19 · A changed count of hidden parts joins the same sentence

- **Rule:** When the number of hidden parts changes, the count joins the notice or selection sentence (adding a full stop if needed). Said once, it stands alone when nothing else is said. A Hide or Show from an eye button puts its part sentence before the count. A part sentence with no changed count is dropped.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1670-1680`; deviation `s1-announcer-one-sentence.md`; decision 36 on #4
- **Expected:** 2 hidden → `['2 parts hidden']`. Selection + 1 hidden → `['Selected: Precentral gyrus, left. 1 part hidden']`. Notice "Done." + 0 hidden → `['Done. All parts shown']`. Part "Hidden: Precentral gyrus, left." + 1 hidden → `['Hidden: Precentral gyrus, left. 1 part hidden']`.
- **Covered by:** `src/lib/controller/speech.test.ts` (R), `src/app/boot.svelte.test.ts` (R, the part sentence and the count in the live region)

### KEY-20 · A lost graphics context is said, and so is its recovery

- **Rule:** When the graphics context is lost, the reader is told once, after any other sentence. When it is ready again, "Anatomy loaded." is said.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1681-1688`
- **Expected:** status `context-lost` → `['The 3D view was interrupted by the graphics driver. Restoring…']`, once. Then `ready` → `['Anatomy loaded.']`, once.
- **Covered by:** `src/lib/controller/speech.test.ts` (R)

### KEY-21 · The announcer speaks the interface language

- **Rule:** Sentences follow the view's language.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1663-1667`
- **Expected:** `lang: 'fr'`, a right region → `['Sélectionné : Precentral gyrus, droite']`.
- **Covered by:** `src/lib/controller/speech.test.ts` (R)
