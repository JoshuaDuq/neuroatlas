# Workspace rules

Scope: chunk H5 (#43), the task panel's frame: the one tablist of the five modes (manual activation), the list and detail views and the focus that follows them, the detail's location bar, the desktop selection strip, and the one notice. The phone sheet that holds the same workspace is in `sheet.md`; the global keys (Escape as Back, `/`, the vertical arrows) are in `controller.md` (KEY-); the permalink's `tab` is in `links.md` (LINK-). Legacy sources: `viewer/ui/chrome/workspace.js` (and its `workspace.test.js`), `viewer/ui/chrome/notice.js` (and `notice.test.js`), `viewer/index.html:204-226,324-337`, `viewer/styles/layout.css:13-201`. New code: `web/src/lib/core/workspace.ts`, `web/src/features/workspace/{Workspace,LocationBar,SelectionStrip,Notice}.svelte`. Deviations: `h5-breadcrumb-current.md`, `h5-clear-focus.md`, `h5-current-item.md`, `h5-single-tablist.md`, `h5-strip-name-side.md`, `h5-tablist-arrows.md`, `h5-tabpanel-semantics.md`. Decision records 0004 (tabs with manual activation) and 0007 (one tablist, nothing moves in the DOM); decisions 1 (the scroll-into-view fix, #4 body), 9, 13 and 19 on #4. Copy quoted is the English interface text.

## Mode tabs

### WORK-01 · The tab row is the five content modes, in session order

- **Rule:** The tabs are, in order, Anatomy, Functions, Deficits, Circuits, Tracts; their mode ids are `anatomy`, `functions`, `deficits`, `circuits`, `diffusion`.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/ui/chrome/workspace.js:6`; `viewer/ui/chrome/workspace.test.js:6`
- **Expected:** `MODES` = `['anatomy', 'functions', 'deficits', 'circuits', 'diffusion']`. Labels EN "Anatomy", "Functions", "Deficits", "Circuits", "Tracts"; FR "Anatomie", "Fonctions", "Déficits", "Circuits", "Faisceaux".
- **Covered by:** `src/lib/core/workspace.test.ts` (R); `src/features/workspace/Workspace.svelte.test.ts` (R, both languages); `e2e/parity/workspace.spec.ts` (R, aria snapshot; `next` gated off)

### WORK-02 · One tablist; the selected tab is the only Tab stop and controls the panel that is shown

- **Rule:** There is a single tablist, named "Explore the atlas" (FR "Explorer l’atlas"), in both shells. The selected tab has `tabindex=0` and the others `-1`. Only the selected tab has `aria-controls`, pointing at the panel shown. The list (`#navigator`) and the detail (`#inspector`) are both tabpanels labelled by the selected tab; the one not shown is `hidden`. No landmark is nested in the panel.
- **Kind:** accessibility
- **Level:** browser — ARIA attributes in the DOM
- **Source:** `viewer/ui/chrome/workspace.js:101-113,143-167`; decision record 0004; deviations `h5-single-tablist.md`, `h5-tabpanel-semantics.md`; decisions 9 and 13 on #4
- **Expected:** One `[role=tablist]`. Anatomy `aria-selected="true"`, tabindex 0, `aria-controls="navigator"`; the other four `aria-selected="false"`, tabindex −1, no `aria-controls`. Tabpanels `['navigator', 'inspector']`, both `aria-labelledby` the Anatomy tab, `hidden` `[false, true]`. After a drill-in the Anatomy tab controls `inspector`. No `aside aside` and no `[role=complementary]` inside `#workspace-panel`.
- **Covered by:** `src/features/workspace/Workspace.svelte.test.ts` (R); `e2e/parity/workspace.spec.ts` (R, branches legacy's five `aria-controls`; `next` gated off); `e2e/parity/sheet.spec.ts` (R, one tablist on a phone; legacy only, skips on `next`)

### WORK-03 · Arrows, Home and End move focus between tabs without choosing; Enter, Space or a click choose

- **Rule:** Manual activation: ArrowRight and ArrowLeft move focus to the next and previous tab, wrapping; Home and End go to the first and last. None of these chooses a mode. Enter, Space or a click chooses the focused tab, and focus stays on it.
- **Kind:** accessibility
- **Level:** browser — keyboard dispatch to the focused tab
- **Source:** `viewer/ui/chrome/workspace.js:65-99`; decision record 0004
- **Expected:** From Anatomy: Right → Functions; End → Tracts; Right → Anatomy; Left → Tracts; Home → Anatomy; Anatomy still selected, no mode chosen. Right, Enter → `mode:functions`, focus on Functions. Right, Space → `mode:deficits`. Click Tracts → `mode:diffusion`, Tracts tabindex 0, Deficits −1.
- **Covered by:** `src/features/workspace/Workspace.svelte.test.ts` (R); `e2e/parity/workspace.spec.ts` (R, the permalink `tab` follows; `next` gated off)

### WORK-04 · The tablist leaves vertical and modified arrows alone

- **Rule:** ArrowUp and ArrowDown on a tab are not cancelled, so the page keymap decides (it ignores them in a tab). Arrows with Alt, Ctrl, Meta or Shift are left to the browser and the platform and do not move between tabs.
- **Kind:** behaviour
- **Level:** browser — keyboard dispatch
- **Source:** `viewer/ui/chrome/workspace.js:83-87`; deviation `h5-tablist-arrows.md`; decision 19 on #4
- **Expected:** On Anatomy: ArrowDown, ArrowUp, Alt+ArrowRight, Shift+ArrowRight → six keydowns, none `defaultPrevented`; focus still on Anatomy; no mode chosen.
- **Covered by:** `src/features/workspace/Workspace.svelte.test.ts` (R); the keymap side is KEY-10 (`controller.md`)

### WORK-05 · Choosing the mode already in front is Back in the detail and nothing in the list

- **Rule:** Re-choosing the selected tab while the detail is shown returns to the list, as Back does, and does not re-choose the mode. In the list it does nothing and says nothing. Choosing another mode from the detail returns to the list, forgets the opener, and leaves focus on the new tab.
- **Kind:** behaviour
- **Level:** browser — the view switch with focus
- **Source:** `viewer/ui/chrome/workspace.js:221-238`; decision 19 on #4
- **Expected:** In the list, click Anatomy → no call. Row `left:1` → detail; click Anatomy → list, `return` reported, no `mode:anatomy`. From the detail, click Functions → list, `mode:functions` and `view:list`, no `return`, focus on Functions.
- **Covered by:** `src/features/workspace/Workspace.svelte.test.ts` (R); `e2e/parity/workspace.spec.ts` (R; `next` gated off)

### WORK-06 · The tablist survives a shell change with its focus

- **Rule:** The tablist and the notice are one instance in both shells, placed by CSS. A resize between desktop and phone keeps focus on a tab, and focus inside the notice stays where it was.
- **Kind:** behaviour
- **Level:** browser — focus across a shell change; e2e for the resized app
- **Source:** decision record 0007; deviation `h5-single-tablist.md`
- **Expected:** Focus on Reload in a notice; `shell` rails → sheet → rails → focus still on Reload. In the app: Functions chosen by keyboard at 1280 × 800, resized to 390 × 844 → Functions visible, selected and focused; Right, Enter → Deficits, permalink `tab=deficits`.
- **Covered by:** `src/features/workspace/Workspace.svelte.test.ts` (R, the notice); `e2e/parity/workspace.spec.ts` (R, the resized app; legacy only, `next` gated off)

### WORK-07 · The tab in front is where stranded focus goes

- **Rule:** The selected tab is registered as the "active tab" focus target, which other features use when the control that had focus is gone.
- **Kind:** behaviour
- **Level:** browser — focus
- **Source:** `viewer/ui/chrome/workspace.js:197,257-260`
- **Expected:** With Deficits in front, `requestFocus(FOCUS_TARGETS.activeTab)` → true, focus on Deficits.
- **Covered by:** `src/features/workspace/Workspace.svelte.test.ts` (R)

## List and detail

### WORK-08 · A detail exists for a region in any mode, and for a function, deficit or lesson only in its own mode

- **Rule:** The detail view has something to show when a region is selected (any mode, Tracts included on its own anatomy), or in Functions a function, in Deficits a deficit, in Circuits a lesson's circuit. Tract reference data on another anatomy has no detail. Tracts without its anatomy and reference named is an error.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/workspace.js:15-27`; `viewer/ui/chrome/workspace.test.js:129-160`
- **Expected:** Region `a` in anatomy, functions, deficits, circuits, and diffusion with anatomy = reference → true. `{functions, selectedFunction: 'all'}` → true; `null` → false. `{deficits, selectedFunction: 'language'}` → false; `{deficits, selectedDeficit: 'aphasia'}` → true; `{anatomy, selectedDeficit}` → false. `{circuits, lesson.circuit 'motor'}` → true; `null` → false; `{anatomy, lesson 'motor'}` → false. Diffusion with anatomy ≠ reference and a region → false. `{explorer: 'diffusion'}` → throws /anatomy/.
- **Covered by:** `src/lib/core/workspace.test.ts` (R; the anatomy ids `bert` and `aomic` are retired but any two ids prove the rule); `src/features/workspace/Workspace.svelte.test.ts` (R, "tract reference data has no detail view")

### WORK-09 · A new region selection drills in; losing the context returns to the list

- **Rule:** After an update, a region selection that differs from the previous one opens the detail from any mode. The same selection keeps the view the reader chose. When the detail had something to show and no longer does, the list returns. A detail opened before its context arrives waits for it. Tract reference data always shows the list.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/workspace.js:29-44`; `viewer/ui/chrome/workspace.test.js:161-185`
- **Expected:** `viewAfterUpdate` with defaults `{view list, reference false, wasAvailable false, available false, previous null, selection null}`: selection `left:1`, available → detail; previous `left:1` → `left:2` → detail; previous = selection `left:1` → list; view detail, previous `left:1`, wasAvailable, selection null → list; same with available true → detail; `{view: detail}` alone → detail; reference true → list.
- **Covered by:** `src/lib/core/workspace.test.ts` (R); `src/features/workspace/Workspace.svelte.test.ts` (R, the same paths through the component)

### WORK-10 · Focus follows the view: to Back on a drill-in from the list, back to the opener on return

- **Rule:** A selection made from the list opens the detail and moves focus to Back. A selection made elsewhere (the canvas, a link) opens it and moves no focus. Back from inside the detail returns focus to the control that opened it, else to the list's current item, else to the tab in front. Back with focus outside the detail moves no focus.
- **Kind:** behaviour
- **Level:** browser — focus
- **Source:** `viewer/ui/chrome/workspace.js:193-219`; deviation `h5-current-item.md`
- **Expected:** Click row `left:2` → detail, focus on "Back to Anatomy", heading "Region details" visible; click Back → list, focus on row `left:2`, `return` and `view:list` reported. Selection set with focus on a tab → detail, focus on the tab. Opener hidden → focus on the selected row; selected row hidden too → focus on Anatomy. `back()` with focus on the tab → list, focus on the tab.
- **Covered by:** `src/features/workspace/Workspace.svelte.test.ts` (R); `e2e/parity/workspace.spec.ts` (R, Back and the region link; `next` gated off)

### WORK-11 · A list that comes back into view shows its current item

- **Rule:** When the detail closes, the list scrolls its current item (the selected tree row, the open function, deficit or circuit) into view. Each list says what its current item is; the first one on screen is used. Back's focus fallback uses the same item.
- **Kind:** behaviour
- **Level:** browser — scroll geometry (the registry itself is unit)
- **Source:** `viewer/ui/chrome/workspace.js:9-12,212-215`; deviation `h5-current-item.md`; decision 1 on #4 and the #4 body ("Workspace scroll-into-view bugs fixed")
- **Expected:** Registry with finders returning null, a hidden row and a visible row → `currentItem()` is the visible row and `revealSelected()` scrolls it with `{block: 'nearest'}`; all unregistered → null, no scroll. In the browser, 70+ rows, `left:70` selected while the list was scrolled to 0 → after Back the selected row lies inside the list box (±1 px).
- **Covered by:** `src/lib/core/workspace.test.ts` (R, the registry with stub rows); `src/features/workspace/Workspace.svelte.test.ts` (R, the tree row); function, deficit and circuit rows coming back into view are uncovered here (their own lists register them)

### WORK-12 · Escape as Back belongs to the caller: the workspace says whether focus is in the detail

- **Rule:** The workspace reports focus as being in the detail only while the detail is shown and focus is inside it; the page keymap uses that to make Escape mean Back.
- **Kind:** behaviour
- **Level:** browser — focus
- **Source:** `viewer/app.js:1898-1905`; KEY-03 in `controller.md`
- **Expected:** In the list → false. Row clicked → detail, focus on Back → true. Focus moved to a tab → false.
- **Covered by:** `src/features/workspace/Workspace.svelte.test.ts` (R)

## Location bar

### WORK-13 · The location reads Mode › Place, and a tree group belongs to Anatomy alone

- **Rule:** The path starts with the mode the detail returns to. In Anatomy it then names the tree group holding the region, if the tree lists it. In another mode it names the place that mode gives (a lesson's circuit, a deficit's group), if any. Tracts has no place.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/workspace.js:58-63`; `viewer/ui/chrome/workspace.test.js:206-226`
- **Expected:** Anatomy with group Frontal → `[{list, "Anatomy"}, {group, key "cortex:Frontal", "Frontal"}]`; without a group → `[{list, "Anatomy"}]`. FR deficits with place "Langage" and a group → `[{list, "Déficits"}, {group, "Langage"}]`; diffusion → `[{list, "Faisceaux"}]`; circuits "Voie motrice" → `[{list, "Circuits"}, {group, "Voie motrice"}]`.
- **Covered by:** `src/lib/core/workspace.test.ts` (R)

### WORK-14 · The location bar is a breadcrumb: Back first, then the place, marked as the current location

- **Rule:** The bar is a navigation landmark named "Breadcrumb" (FR "Fil d’Ariane") holding an ordered list. The first item is a Back button named "Back to <mode>" (FR "Retour : <mode>") showing the mode. When there is a place, the second item is a button named "<place>, show in the list" (FR "<place>, afficher dans la liste"), with the same tooltip, and `aria-current="location"` while it is shown.
- **Kind:** accessibility
- **Level:** browser — landmark and ARIA; the names are view-model strings
- **Source:** `viewer/ui/chrome/workspace.js:173-182`; `viewer/index.html:324-337`; deviation `h5-breadcrumb-current.md`
- **Expected:** Region `left:2` in Anatomy: navigation "Breadcrumb", 2 `ol > li`, "Back to Anatomy" with text "Anatomy", "Frontal, show in the list" with text "Frontal", `aria-current="location"`, tooltip "Frontal, show in the list". Deficits without a place → 1 `li`. French → "Fil d’Ariane", "Retour : Anatomie", "Frontal, afficher dans la liste". The spoken crumb name starts with the visible one in both languages.
- **Covered by:** `src/features/workspace/Workspace.svelte.test.ts` (R); `src/lib/core/workspace.test.ts` (W, only checks `path` is set and the name starts with the label); `e2e/parity/workspace.spec.ts` (R; `next` gated off)

### WORK-15 · In Anatomy the group crumb returns to the region's own row and focuses it, once

- **Rule:** The group crumb opens the region's place in the tree, returns to the list, scrolls the selected row to the centre and focuses it. Focus moves once, to that row, even when the old opener is still on screen. In another mode the place crumb acts as Back.
- **Kind:** behaviour
- **Level:** browser — focus and scroll
- **Source:** `viewer/ui/chrome/workspace.js:239-255`
- **Expected:** Opened from row 1, then `left:3` selected elsewhere; click "Frontal, show in the list" → list, focus on row `left:3`, and the only `focusin` other than the crumb is that row. With `left:2` → `locate` and `return` reported, focus on row `left:2`. Circuits with place "Motor pathway" → click its crumb → list, `return`, no `locate`.
- **Covered by:** `src/features/workspace/Workspace.svelte.test.ts` (R)

### WORK-16 · The bar holds the circuit stepper and the restore action, and stays on one line at 200 % text

- **Rule:** The circuit stepper (X3) and the restore action (S3) sit to the right of the path. At 200 % text in French, at 1280 and 320 px, the place crumb ends before the stepper starts.
- **Kind:** behaviour
- **Level:** browser — layout
- **Source:** `viewer/index.html:324-337`; `viewer/styles/layout.css:58-122`
- **Expected:** With both slots: group "Steps" and "Restore previous view" visible. At 200 % text, FR circuits with place "Voie motrice": crumb right ≤ "Précédent" left + 1.
- **Covered by:** `src/features/workspace/Workspace.svelte.test.ts` (R)

## Selection strip

### WORK-17 · The strip leads to the selection only from a list that does not already show it

- **Rule:** The desktop strip shows only in the list view, only when there is a selection label, and only when the list in front does not already show that kind of selection: a region in Anatomy, a landmark in Anatomy or Circuits, a function in Functions, a deficit in Deficits, a lesson in Circuits. An unknown kind is an error. In the phone shell the sheet's grip shows the selection instead (SHEET-19).
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/workspace.js:46-56,183-187`; `viewer/ui/chrome/workspace.test.js:186-205`
- **Expected:** Detail view → false in every mode. List: region in anatomy → false; in deficits, circuits, diffusion → true; landmark in circuits → false; deficit in deficits, function in functions, lesson in circuits → false; function in anatomy → true; `{}` → false; kind `atlas` → throws /kind/. With `shell = 'sheet'` the strip is hidden.
- **Covered by:** `src/lib/core/workspace.test.ts` (R); `src/features/workspace/Workspace.svelte.test.ts` (R, through the component, and the sheet shell); `e2e/parity/workspace.spec.ts` (R; `next` gated off)

### WORK-18 · The strip's name says the side as a word and contains its visible text

- **Rule:** The strip is named "Inspect <label>, <side word>" (FR "Examiner <label>, <côté>"), while it shows the label and the side letter. The same name is used by the phone strip.
- **Kind:** accessibility
- **Level:** unit (view-model) — the name is a string; exposure is checked in the browser
- **Source:** `viewer/ui/chrome/workspace.js:185`; `viewer/ui/chrome/sheet.js:319`; deviation `h5-strip-name-side.md`; decision 19 on #4
- **Expected:** {label "Precentral gyrus", side "L", sideWord "left"} → "Inspect Precentral gyrus, left", text contains "Precentral gyrus" and "L". FR {side "G", sideWord "gauche"} → "Examiner Precentral gyrus, gauche".
- **Covered by:** `src/features/workspace/Workspace.svelte.test.ts` (R); `e2e/parity/workspace.spec.ts` (R, `next` branch; `next` gated off)

### WORK-19 · The strip opens the detail and Back returns to it; its clear gives stranded focus to the tab in front

- **Rule:** Activating the strip opens the selection's detail (when there is one) and moves focus to Back; Back returns focus to the strip. The clear, shown only for a clearable selection, clears it; once the page has updated, focus that was stranded goes to the selected tab.
- **Kind:** behaviour
- **Level:** browser — focus after an update
- **Source:** `viewer/ui/chrome/workspace.js:256-260`; deviation `h5-clear-focus.md`
- **Expected:** Deficits, region selected: click "Inspect …" → detail, focus on "Back to Deficits"; click Back → list, focus on the strip. Click "Clear selection" → `clear` reported, strip hidden, focus on Deficits. Lesson selection with `clearable: false` → no `.selection-clear`. In the app, legacy leaves focus on `body` after the clear; next puts it on the tab.
- **Covered by:** `src/features/workspace/Workspace.svelte.test.ts` (R); `e2e/parity/workspace.spec.ts` (R, branches legacy's `body`; `next` gated off)

## Notice

### WORK-20 · The one notice has its text, at most one action and a dismiss, and is not a live region

- **Rule:** A notice shows its text, one optional action ("Reload" or "See through the cortex"; FR "Recharger", "Voir à travers le cortex") and a "Dismiss" icon button (FR "Fermer") with that tooltip. It sits after the tablist and before the panels in both shells. The announcer speaks it, so it has no live role. An unknown action is an error.
- **Kind:** behaviour
- **Level:** browser — DOM order and roles; the action label is unit
- **Source:** `viewer/ui/chrome/notice.js:1-52`; `viewer/ui/chrome/notice.test.js:50-83`
- **Expected:** `noticeActionLabel('en', 'reload')` = "Reload"; `('fr', 'reload')` = "Recharger"; `('fr', 'see-through')` = "Voir à travers le cortex"; `('en', 'fly')` throws "Unknown notice action: fly". DOM order `tablist, notice, tabpanel, tabpanel`; no `aria-live`, `role=alert` or `role=status` in it. Reload → `action:reload`. No action → one button (Dismiss).
- **Covered by:** `src/lib/core/workspace.test.ts` (R); `src/features/workspace/Workspace.svelte.test.ts` (R)

### WORK-21 · Dismissing the notice gives focus to the tab in front

- **Rule:** The dismiss clears the notice; focus, which was on the vanished button, goes to the selected tab.
- **Kind:** behaviour
- **Level:** browser — focus
- **Source:** `viewer/app.js:1479-1486`; `viewer/ui/chrome/notice.js:15-27`
- **Expected:** Click "Dismiss" → `dismiss` reported, no `.notice`, focus on Anatomy.
- **Covered by:** `src/features/workspace/Workspace.svelte.test.ts` (R)

## Size, layout and media

### WORK-22 · Tabs, the strip and Back are 44 px tall; the icon buttons clear 24 px

- **Rule:** Each tab, the strip and Back are at least 44 px tall; "Clear selection" and "Dismiss" are at least 24 × 24 px.
- **Kind:** accessibility
- **Level:** browser — layout
- **Source:** WCAG 2.5.8; `viewer/styles/layout.css:13-122`
- **Expected:** At 1280 × 800 with a strip and a notice: five tab heights ≥ 44, strip ≥ 44; clear and dismiss min(width, height) ≥ 24.
- **Covered by:** `src/features/workspace/Workspace.svelte.test.ts` (R; Back's 44 px is named in the test title but not measured)

### WORK-23 · Under forced colours the selected tab is underlined in a system colour

- **Rule:** In forced colours the selected tab carries a solid bottom border and the others do not, so the selection survives the loss of colour.
- **Kind:** accessibility
- **Level:** browser — CSS computed style
- **Source:** `viewer/styles/layout.css` (tabs)
- **Expected:** `forced-colors: active` → Anatomy `border-bottom-style: solid`; Functions not solid.
- **Covered by:** `src/features/workspace/Workspace.svelte.test.ts` (R)

### WORK-24 · Large text and text spacing cut nothing off, and only the tab bar scrolls

- **Rule:** With 200 % text (French, an X3 stepper, a notice and the strip) at 1280 and 320 px, and with the WCAG 1.4.12 spacing override, nothing the workspace draws leaves the panel and no text is cut off vertically. At 320 px the tab bar scrolls sideways and the page does not.
- **Kind:** accessibility
- **Level:** browser — layout
- **Source:** WCAG 1.4.4, 1.4.10, 1.4.12
- **Expected:** Every visible tablist, notice, strip row and location bar inside the panel box (±1 px); every tab, notice text, action, strip, Back and crumb `scrollHeight ≤ clientHeight + 1`. At 320 px with 200 % text: tablist `scrollWidth > clientWidth`, `overflow-x: auto`, document `scrollWidth ≤ 320`.
- **Covered by:** `src/features/workspace/Workspace.svelte.test.ts` (R)

### WORK-25 · On a phone the panel's box gives way to the sheet

- **Rule:** On the desktop `#workspace-panel` is a flex column beside the stage; at phone width it is `display: contents`, so its children become the sheet's own items.
- **Kind:** behaviour
- **Level:** browser — CSS cascade across layers
- **Source:** decision record 0007; `web/src/features/workspace/Workspace.svelte` (`:where(#workspace-panel)`)
- **Expected:** 1280 × 800 → `display: flex`; 390 × 844 → `display: contents`.
- **Covered by:** `src/features/workspace/Workspace.svelte.test.ts` (R)

### WORK-26 · axe finds nothing in the workspace

- **Rule:** The list with a notice and the strip, the detail with its location bar and slots, and the French detail have no axe violation in light and dark, at desktop and 390 px; the same holds with more contrast and reduced motion, and in the assembled app with a region open.
- **Kind:** accessibility
- **Level:** browser — axe
- **Source:** WCAG 2.2 AA
- **Expected:** `expectAxeClean()` with no violations in each state.
- **Covered by:** `src/features/workspace/Workspace.svelte.test.ts` (R); `e2e/parity/workspace.spec.ts` (R; `next` gated off)
