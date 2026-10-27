# Anatomy explorer rules

Scope: chunks A1 (#51, the anatomy tree with its visibility eyes), A2 (#52, the anatomy search and the explorer container with its browse scope) and A3 (#53, the internal-system picker and the dissection bar). The generic treegrid, combobox, radio group and disclosure widgets are in `ui-kit.md`; this catalogue says what the anatomy explorer must show and do with them. The pure helpers behind the rows (`lib/core/panels/navigator.ts`: reasons, group names, eye states, match marking) are C5's and are in `core-panels.md`; the rules here cite them where the reader sees their result. Legacy sources: `viewer/ui/panels/navigator.js`, `viewer/ui/panels/visibility-control.js`, `viewer/ui/panels/dissection.js`, `viewer/ui/panels/internal-anatomy.js`, `viewer/styles/navigator.css`. New code: `web/src/features/anatomy/`. Decision record `0002-anatomy-treegrid.md`; decisions 7, 8, 32, 34 and 36 on #4. Deviations: `a1-drop-title.md`, `a1-eye-announcement.md`, `a1-eye-focus-visible.md`, `a1-partial-state-name.md`, `a1-primitive-limits.md`, `a1-section-reason-name.md`, `a1-treegrid-structure.md`, `a2-active-option-selected.md`, `a2-arrows-focus-field.md`, `a2-expanded-with-options.md`, `a2-focus-stays-in-field.md`, `a2-match-mark-forced-colours.md`, `a2-option-title.md`, `a2-tree-scope-radio-group.md`, `a3-bar-group.md`, `a3-focus-fallback.md`, `a3-initial-count.md`, `a3-picker-switching.md`, `a3-system-value-sync.md`, and U7's `u7-treegrid.md`, `u7-treegrid-keys.md`. Copy quoted below is the English interface text; French is given where a test pins it. "Fixture" means the catalog in `src/features/anatomy/anatomy-tree-test-support.ts` (groups Frontal, Limbic, Basal ganglia, Cut labels) or `anatomy-explorer-test-support.svelte` (a real catalog over nine regions); "published data" means the default CDMD anatomy the e2e specs load.

## The tree

### ANAT-01 · The anatomy is one named treegrid of section headings, groups and regions

- **Rule:** The list is a single treegrid named "Browse anatomy". Each section (Cortex, Subcortical, Cut labels only) is a level-1 heading row with one cell, no expanded state and no selected state; its groups follow it as level-1 rows, collapsed until opened; an open group's regions are level-2 rows with their place in the group. Groups are not selectable; regions are.
- **Kind:** accessibility
- **Level:** browser — ARIA roles, levels and states on the rendered rows
- **Source:** `viewer/ui/panels/navigator.js:469-567`; decision record `0002-anatomy-treegrid.md`; deviation `a1-treegrid-structure.md`; decision 8 on #4
- **Expected:** Fixture, nothing open → row ids `section:cortex`, `cortex:Frontal`, `cortex:Limbic`, `section:structure`, `structure:Basal ganglia`, `section:tissue`, `tissue:Cut labels`, all `aria-level="1"`; groups `aria-expanded="false"`; section rows have neither `aria-expanded` nor `aria-selected`. All open → `d:right:1` has `aria-level="2"`, `aria-posinset="2"`, `aria-setsize="3"`, `aria-selected="false"`. Grid name "Browse anatomy" / "Parcourir l’anatomie".
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R)

### ANAT-02 · Groups are named as the tree names them and sorted within their family

- **Rule:** Groups keep the catalog's family order (cortex, then structures, then cut-only tissue) and are sorted alphabetically by their shown name in the reader's language within a family. A group name that two vocabularies share says which one it is.
- **Kind:** behaviour
- **Level:** unit (view-model: `labelledGroups`, `groupDisplayName`)
- **Source:** `viewer/ui/panels/navigator.js:56-84`
- **Expected:** A Limbic lobe beside a Limbic system → "Limbic lobe" and "Limbic system" (French "Système limbique"); a name used by one vocabulary only is unchanged. Sorting uses the qualified name.
- **Covered by:** `src/lib/core/panels/navigator.test.ts` (R). The tree's own tests use no shared name.

### ANAT-03 · A group row says its name and how many regions it holds

- **Rule:** A group row's accessible name is its shown name and its region count. The drawn count and the chevron are decoration. A group none of whose regions is drawn is dimmed like a hidden row.
- **Kind:** behaviour
- **Level:** unit (view-model: today `rowLabel` in `AnatomyTree.svelte`)
- **Source:** `viewer/ui/panels/navigator.js:463-467`, `523-546`
- **Expected:** Fixture: "Frontal, 3 regions", "Limbic, 1 region"; French "Frontal, 3 régions". Published data (legacy baseline): "Frontal, 38 regions", "Central, 6 regions", "Cerebellum, 31 regions", French "Frontal, 38 régions".
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R, could move down). The dimmed group is uncovered.

### ANAT-04 · A section heading names the display settings that hide its rows

- **Rule:** When display settings hide rows of a section (hemisphere, cortex, internal anatomy, spinal cord, isolation, no cut, another system), the section heading prints those reasons once, joined by " · " in the order first met, and its accessible name carries them in brackets.
- **Kind:** accessibility
- **Level:** unit (view-model: `sectionReasons`, `reasonText`)
- **Source:** `viewer/ui/panels/navigator.js:113-129`, `489-509`; deviation `a1-section-reason-name.md`; decision 32 on #4
- **Expected:** Fixture: "Cortex (Hemisphere hidden)" with the caption "Hemisphere hidden" drawn; "Subcortical" (no reason); "Cut labels only (Visible in a section)". Published data after `h` (hide a hemisphere): a "Cortex (Hemisphere hidden…" row.
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R); `src/lib/core/panels/navigator.test.ts` (R)

### ANAT-05 · A region row says its side and, when it is not drawn, why and what a press does

- **Rule:** A drawn region is named "Name, side". A region that is not drawn but can be revealed is named "Name, side: reason. Activate to reveal." A region nothing can reveal is named "Name, side, not shown: reason." The row prints a reason only when it is the row's own: a setting's reason is on the section heading and a removed part says it with its struck eye.
- **Kind:** behaviour
- **Level:** unit (view-model: `regionNode` with `reasonText`, `rowStatesReason`)
- **Source:** `viewer/ui/panels/navigator.js:131-137`, `326-371`
- **Expected:** Fixture with `a:left:2` hidden: "Precentral gyrus, left"; "Superior frontal gyrus, right: Hemisphere hidden. Activate to reveal." (nothing printed); "Putamen, left: Hidden. Activate to reveal." (nothing printed); "Globus pallidus, left: In <detail set>. Activate to reveal." (prints "In …"); "Small nucleus, left, not shown: Too small for the cut." (prints "Too small for the cut"). Published data with a hemisphere hidden: "Middle frontal gyrus, right: Hemisphere hidden. Activate to reveal."
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R, could move down); `src/lib/core/panels/navigator.test.ts` (R)

### ANAT-06 · A hidden row names itself in the one tooltip, never in a native title

- **Rule:** No row carries a native `title`. A hidden row's name cell carries the row's name as its U5 tooltip; a drawn row has no tooltip.
- **Kind:** accessibility
- **Level:** browser — DOM attributes the U5 tooltip reads
- **Source:** `viewer/ui/panels/navigator.js:366-367`; deviation `a1-drop-title.md`; decision 32 on #4
- **Expected:** `d:right:2` `.row-main[data-tooltip]` = "Superior frontal gyrus, right: Hemisphere hidden. Activate to reveal."; `d:left:1` has none; `document.querySelector('[title]')` is null.
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R)

### ANAT-07 · A region too small for the cut explains itself and does nothing

- **Rule:** A region hidden because it is below the cut's resolution has no eye, is `aria-disabled`, has no selected state, takes no hover wash, shows the default cursor, and ignores Enter, Space, a click and V. Its side letter is drawn without an eye. Group eyes leave it out.
- **Kind:** behaviour
- **Level:** browser — `aria-disabled`, cursor and hover style
- **Source:** `viewer/ui/panels/navigator.js:110-111`, `328`, `360-363`, `372-378`, `536-537`; `viewer/styles/navigator.css:27,33`; deviation `a1-primitive-limits.md`
- **Expected:** `t:left:1`: `aria-disabled="true"`, no `aria-selected`, no button, computed cursor `default`, background unchanged on hover; Enter and a click on its name call nothing. `t:left:2` (no cut) has no `aria-disabled`.
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R)

### ANAT-08 · Each eye sits in its own cell, in the column of its side

- **Rule:** A row's cells are the name, then Mid, L and R. A region's eye is in the column of its hemisphere; a group has one eye per side that holds revealable regions. A section with a midline part reserves the Mid column down its rows, so L and R stay aligned; other sections do not.
- **Kind:** behaviour
- **Level:** browser — cell structure and layout
- **Source:** `viewer/ui/panels/navigator.js:478-480`, `533-545`; deviation `a1-treegrid-structure.md`
- **Expected:** `d:left:1` eye in cell 2, `d:right:1` in cell 3, `a:mid:1` in cell 1; Frontal's eyes sides `left, right`; Basal ganglia's `midline, left`; the `.slot-mid` of `a:left:1` is `display: block`, of `d:left:1` `display: none`. Published data: "Hide Frontal, left", "Hide Frontal, right", "Hide Cerebellum, midline".
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R)

### ANAT-09 · A catalog still loading shows a placeholder, never an empty treegrid

- **Rule:** With no groups yet, the tree draws an `aria-hidden` skeleton and no treegrid.
- **Kind:** accessibility
- **Level:** browser — what is in the DOM
- **Source:** new (a treegrid with no rows is invalid ARIA)
- **Expected:** `groups: []` → no `[role=treegrid]`; `.tree-skeleton` has `aria-hidden="true"`.
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R)

## Keys and focus in the tree

### ANAT-10 · Down, Up, Home and End walk the visible rows, section headings included

- **Rule:** With focus on a row, Down and Up move to the next or previous visible row and stop at the ends; Home and End go to the first and last row. Section headings are stops. Rows under a closed group are skipped.
- **Kind:** behaviour
- **Level:** browser — keyboard dispatch and real focus
- **Source:** `viewer/ui/panels/navigator.js:10-22`, `682-689`; decision record `0002-anatomy-treegrid.md`; deviation `a1-treegrid-structure.md`
- **Expected:** Fixture: Frontal, Down → Limbic; End → `tissue:Cut labels`; Home → `section:cortex`; Up there stays. Published data, Frontal open: from "Frontomarginal gyrus and sulcus, left", Down → "…, right", Up back; End lands on a level-1 row; Home → the Cortex heading.
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R)

### ANAT-11 · Right and Left open, close and move between a row and its eyes

- **Rule:** On a row: Right expands a collapsed group and keeps focus on it; on an open group or a region it moves to the row's first eye. Left collapses an open group; on a region it goes to its group. From an eye: Right and Left move between the row's eyes (Right stops at the last); Left from the first eye, and Escape, return to the row; Up and Down go to the same column in the adjacent row, or to the row itself when it has no cell there; Ctrl+Home goes to the first row and Ctrl+End to the last row's nearest eye. `*` expands every group among the focused group's siblings.
- **Kind:** behaviour
- **Level:** browser — keyboard dispatch and real focus
- **Source:** `viewer/ui/panels/navigator.js:10-36`, `659-698`; decision record `0002-anatomy-treegrid.md`; deviation `u7-treegrid-keys.md` (Right on an open group goes to its first cell, legacy went to the first child)
- **Expected:** Fixture: Frontal, Right → expanded, focus on Frontal; Right → first eye; Escape → Frontal; Down, Left → Frontal; Left → collapsed. Basal ganglia: Right → Mid eye, Right → L eye, Right stays, Left Left → row. `d:left:1` eye, Down → `d:right:1`'s eye; Up back. Frontal L eye, Up → `section:cortex`; `d:left:3` eye, Down → `section:structure`; Cut labels L eye, Down → `t:left:1` row; Ctrl+End → `t:left:2`'s eye; Ctrl+Home → `section:cortex`; `*` on Frontal → 4 groups expanded. Published data: Frontal, Right Right → "Hide Frontal, left", Right → "Hide Frontal, right".
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R)

### ANAT-12 · Enter, Space or a click opens a group or chooses a region

- **Rule:** On a group, Enter, Space or a click anywhere on the row opens or closes it. On a drawn region they select it; on a hidden region that can be revealed they reveal it with its reason (undo what hides it, then select); on an unrevealable region nothing happens. A click on an eye does only what the eye does. Selection follows activation, never focus.
- **Kind:** behaviour
- **Level:** browser — keyboard and pointer dispatch
- **Source:** `viewer/ui/panels/navigator.js:252-263`, `386`, `547`; decision record `0002-anatomy-treegrid.md`
- **Expected:** Fixture with `a:left:2` hidden: Enter on `d:left:1`, Space on `d:right:2`, Enter on `a:left:2`, Enter on `t:left:1` → calls `select d:left:1`, `reveal hemisphere d:right:2`, `reveal removed a:left:2` (nothing for `t:left:1`); `d:left:1` then `aria-selected="true"`. A click on a row's empty area → `select d:left:1`; on Limbic → toggles it; on a section heading → nothing; on `d:left:1`'s eye → `hide d:left:1` and no selection. Published data: Enter on "Middle frontal gyrus, left" writes `region=` to the link.
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R)

### ANAT-13 · V hides or shows from the row

- **Rule:** V (either case) on a region with an eye presses that eye and leaves focus on the row. On a group with one eye it presses it; on a group with one eye per side it moves focus to the first eye and presses nothing. On a focused eye it presses that eye. On a row with no eye it does nothing.
- **Kind:** behaviour
- **Level:** browser — keyboard dispatch and real focus
- **Source:** `viewer/ui/panels/navigator.js:17`, `694-695`; decision record `0002-anatomy-treegrid.md`
- **Expected:** Fixture: `d:left:1`, `v` → `hide d:left:1`, focus on the row; `V` → `show d:left:1`. Frontal, `v` → no call, focus on its first eye. Limbic, `v` → `hide d:left:3`. Frontal's R eye focused, `v` → `hide d:right:1,d:right:2`, focus stays on it. `t:left:1` and `section:cortex` → no call. Published data: "Middle frontal gyrus, left", `v` → its eye reads "Show Middle frontal gyrus, left".
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R)

### ANAT-14 · The page's own shortcut letters pass through a tree row

- **Rule:** On a row, the page's single-character shortcuts reach the page instead of the treegrid's type-ahead, and move no focus. Any other letter starts a type-ahead search, and a shortcut letter typed after it extends the query.
- **Kind:** behaviour
- **Level:** browser — keyboard dispatch to the focused element
- **Source:** decision 7 on #4; `src/lib/controller/keymap.ts` (`SHORTCUT_KEYS`)
- **Expected:** On `d:left:1`, `f i c u s h m ? / 0 3 6` each reach a window `keydown` listener not default-prevented, and focus stays. On `section:cortex`, `p` then `f` → neither reaches the page and focus moves.
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R)

### ANAT-15 · The tree is one Tab stop, and the stop follows the choice

- **Rule:** Exactly one row or eye in the tree has `tabindex="0"`: the first row, or the chosen region's row once it is listed, unless the reader is moving through the grid when the choice changes (then the stop stays where they are). Tab enters on that stop and leaves after it.
- **Kind:** behaviour
- **Level:** browser — real focus and Tab order
- **Source:** `viewer/ui/panels/navigator.js:209-214`, `626-630`
- **Expected:** Fixture, `selected: d:left:3`, nothing open → the stop is `section:cortex`; after Expand all → `d:left:3`. From Collapse all, Tab → `d:left:3`, Tab → `#after`, Shift+Tab → `d:left:3`. Focus on Frontal, then pick `d:left:3` from outside → `d:left:3` selected and still one stop. Published data, Frontal open → one stop.
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R)

### ANAT-16 · The chosen row scrolls into view once per choice

- **Rule:** A new choice scrolls its row into view (nearest edge) once; if its group is closed, it scrolls when the group opens. Clearing the choice resets this.
- **Kind:** behaviour
- **Level:** browser — scrolling and geometry
- **Source:** `viewer/ui/panels/navigator.js:620-625`
- **Expected:** 80 regions in one group, viewport 1280 × 400, `selected: n:left:70`, then Expand all → the row's top < 400 and its bottom ≤ `innerHeight`.
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R)

### ANAT-17 · Other panels can find the chosen row and the tree's stop

- **Rule:** The workspace's current item is the row marked selected, and the `tree-stop` focus target is the tree's Tab stop, so other controls (the dissection bar, the shell) can hand focus to the tree.
- **Kind:** behaviour
- **Level:** browser — real focus
- **Source:** `viewer/ui/panels/dissection.js:34`; deviation `a3-focus-fallback.md`; decision 36 on #4
- **Expected:** `selected: d:left:3`, all open → `currentItem()` is that row; from `#before`, `requestFocus('tree-stop')` → `true` and focus on `d:left:3`.
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R)

### ANAT-18 · Up and Down from outside the list walk the tree while browsing

- **Rule:** The page's Up and Down (from the canvas or elsewhere) move focus to the next or previous row from the one holding focus (a focused eye counts as its row), or to the first row when focus is outside the tree.
- **Kind:** behaviour
- **Level:** browser — real focus
- **Source:** `viewer/ui/panels/navigator.js:652-657`, `795-798`
- **Expected:** All open, focus outside: down → `section:cortex`; down → Frontal. Frontal's first eye focused: down → `d:left:1`; up → Frontal.
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R); `src/features/anatomy/AnatomyExplorer.svelte.test.ts` (R)

## Visibility eyes

### ANAT-19 · An eye is named by the action it will take

- **Rule:** A region's or a group side's eye is named "Hide {name}, {side}" while anything under it is drawn and "Show {name}, {side}" when all of it is hidden. The side is a word in the name and a letter on screen (L, R, Mid; French G, D, Méd); the letter is hidden from assistive technology. There is no pressed state.
- **Kind:** accessibility
- **Level:** unit (view-model: the label from `hidePart`/`showPart` and `visibilityStateOf`)
- **Source:** `viewer/ui/panels/visibility-control.js:125-184`
- **Expected:** "Hide Precentral gyrus, left" → after a press "Show Precentral gyrus, left"; French "Masquer Precentral gyrus, droite" with letter "D"; letter "L" `aria-hidden="true"`; no `aria-pressed`; the hidden state draws the slash path `m3 3 18 18`. Published data: "Hide Frontal, left", "Masquer Frontal, gauche", "Masquer Frontal, droite".
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R, could move down)

### ANAT-20 · Pressing an eye changes it in place and keeps focus on it

- **Rule:** An eye press calls hide or show for its ids, and the same button stays in the DOM with its new name and state, so focus does not move.
- **Kind:** behaviour
- **Level:** browser — real focus on a patched element
- **Source:** `viewer/ui/panels/navigator.js:569-598`; `viewer/ui/panels/visibility-control.js:171-184`
- **Expected:** `d:left:1`'s eye focused, Enter → `hide d:left:1`; the eye element is the same node, still focused, `data-state="hidden"`; Space → `show d:left:1`.
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R)

### ANAT-21 · A group side with some regions hidden reads as partly hidden

- **Rule:** A group side whose regions are some hidden and some drawn is partial: its name and tooltip say so, and it still offers Hide. Pressing it hides the side's every revealable region.
- **Kind:** accessibility
- **Level:** unit (view-model: `visibilityStateOf` and the label)
- **Source:** `viewer/ui/panels/visibility-control.js:118-123`, `177-181`; deviation `a1-partial-state-name.md`
- **Expected:** Hide `d:right:1` → Frontal's R eye: `data-partial="true"`, `data-state="shown"`, name "Hide Frontal, right, partially hidden", tooltip "Hide Frontal, right · partially hidden". Press it → "Show Frontal, right", `data-partial="false"`, and `d:right:2`'s eye hidden. Published data: hide "Middle frontal gyrus, left" → "Hide Frontal, left, partially hidden" on next (legacy keeps "Hide Frontal, left"); show it again → not partial.
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R); `src/lib/core/panels/navigator.test.ts` (R)

### ANAT-22 · An eye press names the part for the one announcement

- **Rule:** An eye press hands the announcer the part sentence, which the announcer says ahead of the hidden count in one message. The tree writes nothing to the live region itself.
- **Kind:** accessibility
- **Level:** unit (view-model: the sentence) — the joined message is S1's (`controller.md`)
- **Source:** `viewer/app.js:1670-1676`; deviation `a1-eye-announcement.md`; decisions 32 and 36 on #4
- **Expected:** Hide then show `d:left:1` → `said` = ["Hidden: Precentral gyrus, left.", "Shown: Precentral gyrus, left."]; French ["Masqué : Precentral gyrus, gauche.", "Affiché : Precentral gyrus, gauche."]; `#announcer` stays "". Whole app, published data: hiding "Middle frontal gyrus, left" announces "Hidden: Middle frontal gyrus, left. 1 part hidden" (legacy: "1 part hidden").
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R); `src/lib/controller/speech.test.ts` (R, the join); `src/app/boot.svelte.test.ts` (R, the join)

### ANAT-23 · Expand all opens every group, then becomes Collapse all

- **Rule:** The button over the tree reads "Expand all" unless every group is open, when it reads "Collapse all"; it opens every group or closes them all.
- **Kind:** behaviour
- **Level:** unit (view-model: `allExpanded` in `TreeHeader.svelte`)
- **Source:** `viewer/ui/panels/navigator.js:758-762`; `viewer/app.js:643-653`
- **Expected:** Fixture: "Expand all" → press → 4 groups expanded, "Collapse all" → press → 0 expanded, "Expand all". French "Tout déplier" / "Tout replier".
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R)

## Tree presentation

### ANAT-24 · An open group stays in view over its regions, without covering a focused one

- **Rule:** An open group row sticks to the top of the list while its own regions scroll under it and leaves with them; its regions keep a scroll margin so the sticky row never covers the one scrolled to.
- **Kind:** accessibility
- **Level:** browser — CSS position and scroll margin
- **Source:** `viewer/styles/navigator.css:120-135`; deviation `a1-primitive-limits.md`
- **Expected:** Frontal open: Frontal `position: sticky`, Limbic not sticky, `d:left:1` `scroll-margin-top` ≠ `0px`, and `d:left:1` shares its parent block with Frontal.
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R, but its `parentElement.className === 'treegrid-block'` line is I: drop it)

### ANAT-25 · Section headings are ruled off and take no hover wash

- **Rule:** Every section heading but the first has a 1 px rule above it; a heading has no hover background.
- **Kind:** behaviour
- **Level:** browser — computed style
- **Source:** `viewer/styles/navigator.css` (section label rules)
- **Expected:** `section:cortex` `border-top-width` `0px`; `section:structure` and `section:tissue` `1px`; hovered `section:cortex` background `rgba(0, 0, 0, 0)`.
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R)

### ANAT-26 · Eyes and counts stay visible where state must not hide

- **Rule:** On a fine pointer an eye is revealed while its row is hovered or holds focus by any means (`:focus-within`), is selected, or is hidden. Under forced colours and increased contrast every eye and every group count is drawn; in forced colours the chosen row keeps a 1 px solid system-colour outline. A hidden row's side letter is dimmed. Under reduced motion the chevron turns at once.
- **Kind:** accessibility
- **Level:** browser — media emulation and computed style
- **Source:** `viewer/styles/navigator.css:205-220`; `viewer/styles/a11y.css:80`; deviation `a1-eye-focus-visible.md`
- **Expected:** `forced-colors: active`: selected row outline `solid` `1px`; Frontal's and `d:right:1`'s eyes and their SVGs opacity `1`; Frontal's `.group-count` visibility `visible`. `prefers-contrast: more`: same for eyes and count. `prefers-reduced-motion: reduce`: chevron `transition-duration` `0s`. `d:right:2`'s side letter colour ≠ `d:left:1`'s.
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R; the dimmed letter only checks "different", W-ish). The mouse-pressed eye staying visible on a fine pointer is uncovered.

### ANAT-27 · Eyes and rows are big enough to hit

- **Rule:** On a fine pointer each eye is at least 24 px square and a row at least 32 px tall; on a coarse pointer each eye is at least 44 px square and a row at least 44 px; a landscape phone keeps eyes at 24 px or more with no sideways scroll.
- **Kind:** accessibility
- **Level:** browser — geometry
- **Source:** WCAG 2.2 SC 2.5.8; #4 definition of done (44 px on coarse pointers)
- **Expected:** Eyes of `d:left:1`, `a:mid:1` and Frontal: ≥ 24 × 24 fine, ≥ 44 × 44 coarse; `d:left:1` row ≥ 32 fine, ≥ 44 coarse; at 812 × 375 eyes ≥ 24 and `scrollWidth ≤ innerWidth`. Published data: "Hide Frontal, left/right", "Hide Middle frontal gyrus, left", "Hide Cerebellum, midline" ≥ 24 (and ≥ 44 with touch).
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R)

### ANAT-28 · The tree reflows at 320 px, with text spacing and at 200 % text

- **Rule:** At 320 px wide with WCAG 1.4.12 text spacing, and at 200 % text, nothing spills sideways and no row clips its content; names scale with the text.
- **Kind:** accessibility
- **Level:** browser — layout
- **Source:** WCAG 2.2 SC 1.4.4, 1.4.10, 1.4.12
- **Expected:** Long group names at 320 × 700 with spacing: no element's right > `innerWidth + 0.5`, `scrollWidth ≤ innerWidth`, each row inside the grid and `scrollWidth ≤ clientWidth + 1`. At 200 % (640 px): name font ≥ 1.9 × normal, no row overflows either axis.
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R)

### ANAT-29 · The tree has no axe violations

- **Rule:** Expanded, with hidden, partial and unavailable rows and a selection, the tree passes axe in English and French.
- **Kind:** accessibility
- **Level:** browser — axe
- **Source:** WCAG 2.2 AA
- **Expected:** `expectAxeClean()` returns no violations for both languages (fixture); `app.expectAccessible('anatomy-tree')` with Frontal open (published data).
- **Covered by:** `src/features/anatomy/AnatomyTree.svelte.test.ts` (R)

## Search

### ANAT-30 · A query lists its matches in place of the tree, and arms the first

- **Rule:** A non-blank query lists the catalog's ranked matches as options named "Name, side, Group" (the group as the tree names it), arms the first one that can be chosen, and hides the tree with its header and scope. The field is expanded only while the list holds an option. The tree stays mounted, so its open groups and Tab stop survive the search.
- **Kind:** behaviour
- **Level:** browser — combobox state and visibility
- **Source:** `viewer/ui/panels/navigator.js:326-345`, `390-461`, `742-767`; deviation `a2-expanded-with-options.md`; decision 34 on #4
- **Expected:** Fixture, "cuneus" → options "Cuneus, left, Occipital" and "Cuneus, right, Occipital"; `aria-expanded="true"`; the armed option is "Cuneus, left"; the treegrid is not visible; Down arms "Cuneus, right". Published data, "middle frontal gyrus" → "Middle frontal gyrus, left, Frontal" armed (`aria-activedescendant` = its id), "…, right, Frontal" listed, the first `mark.query-match` reads "Middle frontal gyrus".
- **Covered by:** `src/features/anatomy/AnatomyExplorer.svelte.test.ts` (R)

### ANAT-31 · The match is marked, and an alias says why a name matched

- **Rule:** The part of the name that matches is marked, regardless of case and accents. When the name does not contain the query, the code or the first alias that does follows the name in brackets, marked, and is said after the name.
- **Kind:** behaviour
- **Level:** unit (view-model: `matchSegments`, `matchedAlias`)
- **Source:** `viewer/ui/panels/navigator.js:154-178`, `283-327`
- **Expected:** French, "CUNEUS" → two marks "Cunéus"; "ifg" → option "Opercular part of the inferior frontal gyrus, IFG, left, Frontal", its mark "IFG", its text contains "(IFG)".
- **Covered by:** `src/lib/core/panels/navigator.test.ts` (R); `src/features/anatomy/AnatomyExplorer.svelte.test.ts` (R, could move down)

### ANAT-32 · A result that is not drawn says why, and choosing it reveals it

- **Rule:** A match that is not drawn is listed with the same name a tree row has ("Name, side: reason. Activate to reveal."), its reason on the second line and as its U5 tooltip, and no native title. Enter or a click reveals it with its reason and empties the query.
- **Kind:** behaviour
- **Level:** browser — combobox choice
- **Source:** `viewer/ui/panels/navigator.js:252-263`, `346-368`; deviation `a2-option-title.md`
- **Expected:** Fixture, hemisphere `right`, "cuneus" → option "Cuneus, left: Hemisphere hidden. Activate to reveal.", armed; its `[data-tooltip]` the same text; no `[title]` in the listbox; Enter → `reveal hemisphere d:left:cuneus`, field "". Published data after `h`: option "Middle frontal gyrus, right: Hemisphere hidden. Activate to reveal." containing "Hemisphere hidden".
- **Covered by:** `src/features/anatomy/AnatomyExplorer.svelte.test.ts` (R)

### ANAT-33 · A result too small for the cut is disabled and never armed

- **Rule:** A match below the cut's resolution is listed, `aria-disabled`, named "Name, side, not shown: reason.", skipped by the arrows and never armed; a click on it does nothing and keeps the query.
- **Kind:** behaviour
- **Level:** browser — combobox arming (the skip is `nextEnabledIndex`, unit in `core-panels.md`)
- **Source:** `viewer/ui/panels/navigator.js:38-53`, `252-254`, `360-362`, `451-460`
- **Expected:** "nucleus" → option "Tiny nucleus, left, not shown: Too small for the cut." with `aria-disabled="true"`; the armed option is the other; Down, Up never arm it; a click → no call, field still "nucleus".
- **Covered by:** `src/features/anatomy/AnatomyExplorer.svelte.test.ts` (R); `src/lib/core/panels/navigator.test.ts` (R)

### ANAT-34 · Choosing a result empties the query and leaves focus in the field

- **Rule:** Enter on the armed result or a click on a result selects it (or reveals it), empties the query, brings the tree back around the region, and leaves focus in the field. Escape and the clear button ("Clear search") empty the field, bring the tree back and keep focus in the field. A note's button ("Switch atlas", "Switch cut labels") moves focus to the field before it acts.
- **Kind:** behaviour
- **Level:** browser — real focus
- **Source:** `viewer/ui/panels/navigator.js:252-263`, `386`, `401-402`, `421-423`, `704-732`; deviation `a2-focus-stays-in-field.md`
- **Expected:** Fixture, "cuneus", Enter → `select d:left:cuneus`, field "", tree visible, focus in the field; a click on "Cuneus, right" → `select d:right:cuneus`, focus in the field; Escape → field "", tree visible, focus in the field. Published data: Enter or a click writes `region=`; the clear button → field "", focus in field, tree visible.
- **Covered by:** `src/features/anatomy/AnatomyExplorer.svelte.test.ts` (R)

### ANAT-35 · The armed option is the selected one; the chosen region is current

- **Rule:** In the result list only the armed option is `aria-selected="true"`; the option of the region already selected is `aria-current="true"` and is drawn heavier.
- **Kind:** accessibility
- **Level:** browser — ARIA states in the listbox
- **Source:** `viewer/ui/panels/navigator.js:279`, `600-619`; deviation `a2-active-option-selected.md`; decisions 34 and 40 on #4
- **Expected:** `selected: d:right:cuneus`, "cuneus" → the one `aria-selected="true"` option is the armed "Cuneus, left"; the one `aria-current="true"` option is "Cuneus, right". Published data, after choosing the right one and coming back: left `aria-selected="true"`, right `false`.
- **Covered by:** `src/features/anatomy/AnatomyExplorer.svelte.test.ts` (R)

### ANAT-36 · A search that finds nothing says so, with a hint

- **Rule:** A non-blank query with no match anywhere shows the title "No match for “query”" and the hint after the list. A blank or all-space query shows no sentence. When the only matches are in another atlas, the title stays and the hint is dropped.
- **Kind:** behaviour
- **Level:** unit (view-model: `sentences` in `AnatomySearch.svelte`)
- **Source:** `viewer/ui/panels/navigator.js:428-436`, `745-755`
- **Expected:** "zzzz" → "No match for “zzzz”" and "Try another spelling, an abbreviation or a synonym. Symptoms and syndromes are under Deficits."; no option; `aria-expanded="false"`. " " → no `.empty`. French "zzzzqq" → "Aucun résultat pour « zzzzqq »".
- **Covered by:** `src/features/anatomy/AnatomyExplorer.svelte.test.ts` (R, could move down)

### ANAT-37 · Matches in another atlas are reported, with a switch to that atlas

- **Rule:** Matches that only another surface atlas draws, or only another cut atlas labels, are not dropped: a sentence per atlas counts them and offers a switch to the first atlas in manifest order that draws them. A rejection from the switch is not caught.
- **Kind:** behaviour
- **Level:** unit (view-model: `matchesElsewhere` and the sentences)
- **Source:** `viewer/ui/panels/navigator.js:92-106`, `393-399`, `439-448`
- **Expected:** Destrieux shown, "v1" → "No match for “v1”" and "1 match in HCP-MMP1.0 multimodal atlas." with "Switch atlas" → call `atlas hcp-mmp`, then "V1, left" listed. Cut atlas "other", "small" → "1 match in NextBrain histological atlas, which labels cuts only." with "Switch cut labels" → call `cut nextbrain`; its rejection surfaces as `unhandledrejection` "Error: cut atlas failed".
- **Covered by:** `src/lib/core/panels/navigator.test.ts` (R); `src/features/anatomy/AnatomyExplorer.svelte.test.ts` (R)

### ANAT-38 · A list cut off says how many matches there are

- **Rule:** When the catalog caps the list, the sentence after it gives the shown and total counts and asks for a narrower search.
- **Kind:** behaviour
- **Level:** unit (view-model) — the cap of 50 is the catalog's (`core-catalogs.md`)
- **Source:** `viewer/ui/panels/navigator.js:400`, `437`
- **Expected:** 61 HCP-MMP areas containing "V1", "v1" → 50 options and "Showing 50 of 61 matches. Refine the search to narrow it."
- **Covered by:** `src/features/anatomy/AnatomyExplorer.svelte.test.ts` (R)

### ANAT-39 · What a search found is said once typing pauses

- **Rule:** Once typing pauses, the announcer says the match count for a complete list, then the sentences after the list (title first), only when it differs from what was last said.
- **Kind:** accessibility
- **Level:** unit (view-model: the status sentence) — the 500 ms pause is U6's (`ui-kit.md`)
- **Source:** `viewer/ui/panels/navigator.js:242-250`, `411-412`, `449`
- **Expected:** "cuneus" → "2 matches."; "zzzz" → starts "No match for “zzzz”. Try another spelling, an abbreviation or a synonym"; Destrieux, "v1" → "No match for “v1”. 1 match in HCP-MMP1.0 multimodal atlas."; capped → "Showing 50 of 61 matches. Refine the search to narrow it." (no count). Published data: "zzzzqq" → contains "No match for “zzzzqq”".
- **Covered by:** `src/features/anatomy/AnatomyExplorer.svelte.test.ts` (R, real 500 ms waits)

### ANAT-40 · `/` and the page's arrows reach the search

- **Rule:** `/` focuses the field and selects its text. While a search shows, the page's Up and Down from outside the field move focus into the field, keeping its text and armed option, so the next key moves the option where it is announced.
- **Kind:** behaviour
- **Level:** browser — real focus and selection
- **Source:** `viewer/ui/panels/navigator.js:793-798`; `viewer/app.js:1943-1944`; deviation `a2-arrows-focus-field.md`
- **Expected:** "cuneus", focus elsewhere, `/` → focus in the field, selection `[0, 6]`; walk down → focus in the field, value "cuneus". Published data, "middle", `/` → selection `[0, 6]`.
- **Covered by:** `src/features/anatomy/AnatomyExplorer.svelte.test.ts` (R)

### ANAT-41 · The search field stays pinned and the armed result is never under it

- **Rule:** While searching, the field stays at the top of the panel as results scroll under it, and the armed result scrolls to just below the field, after typing, after the arrows, and at 200 % text.
- **Kind:** accessibility
- **Level:** browser — layout and scrolling
- **Source:** `viewer/styles/layout.css:120-132`; WCAG 2.2 SC 2.4.11
- **Expected:** 50 options, scroller scrolled 400 px → the field's top within 24 px of the scroller's top. The armed option's top pixel hits the option itself after typing, after 20 Down, after 20 Up (armed = first), and again at 200 % after a fresh search.
- **Covered by:** `src/features/anatomy/AnatomyExplorer.svelte.test.ts` (R)

### ANAT-42 · Results reflow and keep their targets

- **Rule:** At 320 px with text spacing results wrap and nothing spills or clips; at 200 % text result rows grow; on a coarse pointer the clear button, each result and each scope radio are at least 44 px. Under forced colours the matched text is underlined, not only heavier.
- **Kind:** accessibility
- **Level:** browser — layout, media emulation
- **Source:** WCAG 2.2 SC 1.4.1, 1.4.10, 1.4.12, 2.5.8; deviation `a2-match-mark-forced-colours.md`
- **Expected:** 320 × 700 with spacing: `scrollWidth ≤ innerWidth`, each option `scrollWidth ≤ clientWidth + 1`, `scrollHeight ≤ clientHeight + 1`. 200 %: first option height > 1.5 × normal. Coarse: "Clear search" ≥ 44 × 44, options ≥ 44, radios ≥ 44. `forced-colors: active`: `mark.query-match` `text-decoration-line: underline`.
- **Covered by:** `src/features/anatomy/AnatomyExplorer.svelte.test.ts` (R)

### ANAT-43 · The search has no axe violations

- **Rule:** Browsing, with results, and with the sentences after the list, the explorer passes axe in English and French.
- **Kind:** accessibility
- **Level:** browser — axe
- **Source:** WCAG 2.2 AA
- **Expected:** `expectAxeClean()` clean for each state; `app.expectAccessible('anatomy-search')` with "middle frontal" results.
- **Covered by:** `src/features/anatomy/AnatomyExplorer.svelte.test.ts` (R)

## Browse scope and system picker

### ANAT-44 · The browse scope is a radio group of two choices

- **Rule:** "Whole brain" and "By system" are one radio group named "Browse": Tab enters on the checked one, the arrows move and choose, and choosing the checked one again does nothing. While an atlas or detail level loads the group refuses a choice but its radios keep focus. Searching puts the scope away.
- **Kind:** behaviour
- **Level:** browser — radio keyboard and focus
- **Source:** `viewer/ui/panels/internal-anatomy.js:64-67`, `76-83`; deviation `a2-tree-scope-radio-group.md`; decision 34 fix 10 on #4
- **Expected:** One `radiogroup` "Browse"; "Whole brain" checked; Right → call `scope`, "By system" checked; clicking "By system" again → no second call. Loading: `aria-disabled="true"`, not `disabled`, focus stays; Right → no call, focus on the last radio. French "Parcourir", "Cerveau entier". "cun" typed → no radiogroup. Published data: Right from "Whole brain" → "By system" focused and checked, and the "System" select visible.
- **Covered by:** `src/features/anatomy/AnatomyExplorer.svelte.test.ts` (R)

### ANAT-45 · The system picker lists each system of the detail level once, sorted as shown

- **Rule:** The picker offers "All internal structures" first, then every system the structures of the current detail level belong to, once each, keyed by the English group name and shown and sorted by the name in the reader's language. A name another vocabulary shares is qualified as the tree qualifies it. Another detail level lists its own systems.
- **Kind:** behaviour
- **Level:** unit (`system-options.ts` is pure)
- **Source:** `viewer/ui/panels/internal-anatomy.js:86-101`
- **Expected:** aseg fixture: values `["", "Basal ganglia", "Brainstem", "Limbic", "Ventricles and CSF"]`, labels "All internal structures", then the same names. French labels "Toutes les structures internes", "Ganglions de la base", "Limbique", "Tronc cérébral", "Ventricules et LCS" with values `["", "Basal ganglia", "Limbic", "Brainstem", "Ventricles and CSF"]`. Shared "Limbic" → "Limbic system"; French shared "Limbique" → "Système limbique" (value still "Limbic"). `aseg-fine` → `["", "Cerebellum"]`. Published data: first "All internal structures", the rest sorted with `localeCompare(…, 'en')`.
- **Covered by:** `src/features/anatomy/SystemPicker.svelte.test.ts` (R; the first case already calls `systemOptions` directly: move these four cases down to unit)

### ANAT-46 · The system picker is a labelled select that shows the display's system

- **Rule:** The picker shows only while browsing by system with no search open. Its visible label "System" names and focuses the select. It shows the system the display holds (the empty value for all), follows the display when another control changes it, and a choice calls the command with the system, or with none for all. Type-ahead goes through the same command.
- **Kind:** behaviour
- **Level:** browser — native select and label
- **Source:** `viewer/ui/panels/internal-anatomy.js:68`, `85`, `102`
- **Expected:** Label "System" / "Système"; a label click focuses the select. `value: null` → ""; `value: 'Limbic'` → "Limbic"; set Limbic from outside → "Limbic". Choose "Basal ganglia", then "" → calls `Basal ganglia`, `null`, value "". Tab then `v` → "Ventricles and CSF", one call. Hidden until "By system" in the explorer.
- **Covered by:** `src/features/anatomy/SystemPicker.svelte.test.ts` (R); `src/features/anatomy/AnatomyExplorer.svelte.test.ts` (R, shown under the scope only inside)

### ANAT-47 · A refused system choice is put back

- **Rule:** When the choice command fails or is overtaken, the select returns to the system the display holds, and stays there when its options are rebuilt (as by a language switch).
- **Kind:** behaviour
- **Level:** browser — bound select value
- **Source:** `viewer/state/scene-commands.js:33-43`, `124-130`; `viewer/ui/panels/internal-anatomy.js:54`; deviation `a3-system-value-sync.md`
- **Expected:** `value: 'Limbic'`, command refuses, choose "Basal ganglia" → one call, value back to "Limbic"; choose "Brainstem", then switch to French → options include "Tronc cérébral", value "Limbic".
- **Covered by:** `src/features/anatomy/SystemPicker.svelte.test.ts` (R)

### ANAT-48 · The system picker is disabled while an atlas or detail level loads

- **Rule:** While a switch is loading, the system select is disabled, as the scope beside it refuses choices.
- **Kind:** behaviour
- **Level:** browser — native `disabled`
- **Source:** `viewer/ui/panels/internal-anatomy.js:33`, `81`; `viewer/model/brain-atlas.js:731-736`; deviation `a3-picker-switching.md`
- **Expected:** `switching: true` → `disabled === true`; `false` → `false`.
- **Covered by:** `src/features/anatomy/SystemPicker.svelte.test.ts` (R)

### ANAT-49 · A chosen system is in the link and comes back from it

- **Rule:** Stated once as LINK-21 (`links.md`); this entry only points there, so the rule is tested once.
- **Kind:** behaviour
- **Level:** see LINK-21
- **Source:** see LINK-21
- **Expected:** see LINK-21
- **Covered by:** see LINK-21

## Dissection bar

### ANAT-50 · While parts are hidden, a Dissection group shows the count and two commands

- **Rule:** The bar is there only while at least one part is hidden, and only in the Anatomy explorer. It is a group named by a visually hidden "Dissection" heading, not a landmark, and holds, in order, the count, Undo and Restore all. The count is plain text (the announcer says it).
- **Kind:** accessibility
- **Level:** browser — ARIA group and DOM order
- **Source:** `viewer/ui/panels/dissection.js:20-30`; `viewer/index.html:314-322`; deviation `a3-bar-group.md`; decision 36 on #4
- **Expected:** 3 hidden → `role=group`, `aria-labelledby` = its `h3` "Dissection"; no `section` or `region`; children text `Dissection`, `3 parts hidden`, `Undo`, `Restore all`; no `aria-live`, `status` or `alert` inside. 0 hidden → no group; hide one → "1 part hidden". Published data: no bar on a plain load; `#hidden=destrieux:left:38` → a group "Dissection" with "1 part hidden".
- **Covered by:** `src/features/anatomy/DissectionBar.svelte.test.ts` (R). "Only in the Anatomy explorer" (legacy `dissection.js:23`) is uncovered: the component has no explorer input, so I1 must mount it only there (`regions.md`).

### ANAT-51 · The count and commands are worded in the reader's language

- **Rule:** The count says how many parts are hidden, singular or plural; the commands are Undo and Restore all.
- **Kind:** behaviour
- **Level:** unit (i18n `dissection.hiddenCount`; `core-i18n.md`)
- **Source:** `viewer/ui/panels/dissection.js:24-28`
- **Expected:** en 1 → "1 part hidden", 12 → "12 parts hidden", "Undo", "Restore all"; fr 1 → "1 partie masquée", 12 → "12 parties masquées", "Annuler", "Tout rétablir"; heading "Dissection" in both.
- **Covered by:** `src/features/anatomy/DissectionBar.svelte.test.ts` (R, could move down)

### ANAT-52 · Undo is disabled with nothing to undo; Restore all never is

- **Rule:** Undo is disabled when the last dissection step cannot be undone, as after opening a link; Restore all is enabled whenever the bar shows. Enter and Space run them; Tab goes from the tree stop to Undo, Restore all, then on, skipping a disabled Undo.
- **Kind:** behaviour
- **Level:** browser — native disabled and Tab order
- **Source:** `viewer/ui/panels/dissection.js:29-30`
- **Expected:** No history → Undo `disabled`, Restore all enabled. Enter, Space on Undo, Enter on Restore all → calls `undo`, `undo`, `restore`. Tab order `tree stop`, `Undo`, `Restore all`, `after`; with Undo disabled, Tab from the stop → Restore all. Published data, `#hidden=…`: Undo disabled, Restore all enabled (French "Annuler" disabled, "Tout rétablir" enabled).
- **Covered by:** `src/features/anatomy/DissectionBar.svelte.test.ts` (R)

### ANAT-53 · Focus is never left on a spent command or a bar that left

- **Rule:** When Undo spends the history while parts remain, focus moves to Restore all. Undo that leaves more to undo keeps focus. When the bar empties with focus in it, focus goes to the tree's Tab stop, or to the tab in front when the tree has none (a search is open). A change made from outside the bar moves no focus.
- **Kind:** behaviour
- **Level:** browser — real focus
- **Source:** `viewer/ui/panels/dissection.js:31-35`; deviation `a3-focus-fallback.md`; decision 36 on #4
- **Expected:** History [1], Undo → Undo disabled, focus on Restore all. History [1, 2] → "2 parts hidden", focus on Undo. Restore all (3 hidden) or the last Undo (1 hidden) → no bar, focus on `#stop`; no tree stop → focus on `#tab`. Undo from an outside button → focus stays there. Published data: Restore all → focus on the tree's `[tabindex="0"]`, no `hidden=` in the link; hide "Cerebellum, left" after a `hidden=` link, Undo → "1 part hidden", Undo disabled, focus on Restore all.
- **Covered by:** `src/features/anatomy/DissectionBar.svelte.test.ts` (R)

### ANAT-54 · The inspector's Hide hands focus to Undo

- **Rule:** The `dissection-undo` focus target is Undo, or Restore all while Undo is disabled, and none without the bar, so the inspector's Hide never lands on a disabled button. Hiding the selected region from the inspector puts focus on Undo; Undo then brings the part back and focus goes to the tree.
- **Kind:** behaviour
- **Level:** browser — focus registry, and the composed panel for the cross-panel half
- **Source:** decision 35 and 36 on #4; deviation `a3-focus-fallback.md`
- **Expected:** History [1] → `requestFocus('dissection-undo')` true, Undo focused; no history → Restore all focused; no bar → `false`, and with fallback `tree-stop` → `#stop`. Published data, `#region=destrieux:left:38`, Hide → "1 part hidden", Undo enabled and focused; Enter → no bar, focus on the tree's stop.
- **Covered by:** `src/features/anatomy/DissectionBar.svelte.test.ts` (R); `src/app/regions/PanelsRegion.svelte.test.ts:123` (R, the inspector's Hide focuses Undo in the list)

### ANAT-55 · A restored link's hidden count is said once

- **Rule:** Stated once as LINK-19 (`links.md`); this entry only points there, so the rule is tested once.
- **Kind:** accessibility
- **Level:** see LINK-19
- **Source:** see LINK-19
- **Expected:** see LINK-19
- **Covered by:** see LINK-19

### ANAT-56 · A hidden part is in the link and comes back from it

- **Rule:** Stated once as LINK-21 (`links.md`); this entry only points there, so the rule is tested once.
- **Kind:** behaviour
- **Level:** see LINK-21
- **Source:** see LINK-21
- **Expected:** see LINK-21
- **Covered by:** see LINK-21

### ANAT-57 · The bar and the picker keep their targets and reflow

- **Rule:** Undo and Restore all are at least 24 px (44 px tall on a coarse pointer) and the select at least 24 px tall. At 320 px, 200 % text and text spacing the French bar wraps and the picker keeps its label beside the field, with nothing spilling or clipped. Both pass axe in English and French.
- **Kind:** accessibility
- **Level:** browser — geometry, axe
- **Source:** WCAG 2.2 SC 1.4.10, 1.4.12, 2.5.8; `viewer/styles/navigator.css:242-248`, `297-320`
- **Expected:** Buttons ≥ 24 × 24, ≥ 44 tall coarse; select ≥ 24 tall. French bar, 12 hidden, 320 × 700 at 200 % with spacing: `scrollWidth ≤ innerWidth`, group `scrollHeight ≤ clientHeight + 1`, each part inside the bar. Picker at 320: `.system-picker` `scrollWidth ≤ clientWidth + 1`, select within `[0, innerWidth]`, width > 0. `expectAxeClean()` clean for both.
- **Covered by:** `src/features/anatomy/DissectionBar.svelte.test.ts` (R); `src/features/anatomy/SystemPicker.svelte.test.ts` (R)
