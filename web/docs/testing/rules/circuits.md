# Circuits (guided lessons) rules

Scope: chunk X3 (#58), the Circuits tab: the list of guided circuits, the lesson's landmark profile, the stepper in the location bar, the landmark sequence and the four notes, the related circuits under a selected region, the busy and failure states, the step announcement and the lesson's Linked MRI entry point. Legacy sources: `viewer/ui/panels/circuits.js`, `index.html:309-312,335,341-342,423`; `viewer/learning/*` for the lesson model. New code: `web/src/features/circuits/` (`circuits-view.ts` is the view-model, `circuits-explorer.svelte.ts` the state and commands, `neighbour-keys.ts` the arrow keys; `CircuitList`, `CircuitProfile`, `CircuitStatus`, `CircuitStepper`, `CircuitNotes`, `RelatedCircuits` draw them). Deviations: `x3-busy-keeps-focus.md`, `x3-current-circuit.md`, `x3-disclosure-state.md`, `x3-label-in-name.md`, `x3-list-structure.md`, `x3-no-landmarks.md`, `x3-status-always-mounted.md`, `x3-step-announcement.md`; decisions 9, 13, 37 and 40 on #4.

The lesson commands are in `controller.md` and are not repeated here: opening a lesson and framing its landmark (LESSON-01 to LESSON-03), a related lesson (LESSON-04), stepping (LESSON-05), the landmark in front (LESSON-06), uncovering and sides (LESSON-07), leaving (LESSON-08) and the lesson's Linked MRI (LESSON-09, LESSON-10). The circuit catalogue (`data/circuits.yaml`: landmarks, covering regions, references, validation) is in `core-catalogs.md`; `stepProgress`, `stepperTargets`, `involved` and the busy runner are in `core-panels.md`; a link that carries `circuit=` and `step=` is in `links.md`. The published catalogue (revised 2026-10-24) has 9 circuits with 39 landmarks: `vision` 4, `memory` 5, `motor` 6, `hearing` 3, `touch` 3, `language` 4, `attention` 3, `cerebellar` 5, `praxis` 6. Copy quoted is the English interface text (`web/src/lib/core/i18n/areas/circuits.ts`).

## The list

### CIRC-01 · The list offers every guided circuit with its landmark count, and the scope sums the landmarks
- **Rule:** The list shows each circuit as a row with its name and its number of landmarks; the count's noun is read, not shown. Under the list a note counts the circuits and their landmarks, the landmarks counted as the rows count them (the sum of every circuit's steps).
- **Kind:** data
- **Level:** unit (view-model: `landmarkTotal`)
- **Source:** `viewer/ui/panels/circuits.js:150-165`
- **Expected:** `landmarkTotal` of three circuits with 3, 2 and 1 steps → 6; of none → 0. On the published catalogue the note reads "9 guided circuits · 39 landmarks" (FR "9 parcours guidés · 39 repères"); rows named "Visual pathway , 4 landmarks" (FR "Voie visuelle , 4 repères") and "Memory landmarks , 5 landmarks".
- **Covered by:** `src/features/circuits/circuits-view.test.ts` (R); `src/features/circuits/circuits.svelte.test.ts` (R; the totals re-derived from the catalogue); `e2e/parity/circuits.spec.ts` (R; skips on `next`)

### CIRC-02 · The list is a labelled group of a real list, and a row's name contains what it shows
- **Rule:** The list is a `role="group"` named "Guided learning" over a `ul` of `li` buttons. The count column and the chevron are hidden from assistive technology. The visible words of a row are contained, in order, in its accessible name.
- **Kind:** accessibility
- **Level:** browser — DOM semantics and accessible names
- **Source:** `viewer/ui/panels/circuits.js:150-161,328`; deviation `x3-list-structure.md`; WCAG 2.2 SC 2.5.3
- **Expected:** `getByRole('group', {name: 'Guided learning', exact: true})` with 9 `ul > li > button`; `.group-count` and `.chevron` `aria-hidden="true"`; for every row the normalised name contains the normalised visible text.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-03 · The list is shown only on the Circuits tab
- **Rule:** The list is hidden while another tab is in front.
- **Kind:** behaviour
- **Level:** browser — visibility
- **Source:** `viewer/ui/panels/circuits.js:323`
- **Expected:** explorer `anatomy` → `.browser` not visible.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-04 · The arrow keys walk the rows without wrapping; every row stays a Tab stop
- **Rule:** ArrowDown and ArrowUp move to the next or previous row and stop at the ends. Keys with Alt, Ctrl, Meta or Shift are left to the browser. Every row is a Tab stop. The `/` key (KEY-09) puts focus on the first circuit.
- **Kind:** behaviour
- **Level:** browser — key dispatch and focus
- **Source:** `viewer/ui/panels/circuits.js:304-314,345`; deviation `u6-list-nav-modifier-keys.md`; decision 37 on #4
- **Expected:** row 0, Tab → row 1; ArrowUp → row 0; ArrowUp → row 0; ArrowDown × 2 → row 2; last row, ArrowDown → still the last. Shift+ArrowDown → focus unchanged; Alt+ArrowDown → not prevented. `focusFirst()` → row 0 focused.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R); `e2e/parity/circuits.spec.ts` (R; skips on `next`)

## Opening a lesson

### CIRC-05 · Opening a circuit marks its row current and puts its first landmark's title in focus
- **Rule:** Pressing a circuit opens its lesson (LESSON-01). The row becomes the one `aria-current="true"` row (it opens a lesson, it does not toggle, so no `aria-pressed`) and the workspace's current item. The profile shows the circuit's name as a visually hidden `h2`, the landmark's name as an `h3` that takes focus, its role and explanation, and the stepper shows "Landmark 1 of N".
- **Kind:** behaviour
- **Level:** browser — focus
- **Source:** `viewer/ui/panels/circuits.js:167-196,281-289,330-335`; deviation `x3-current-circuit.md`; decision 40 on #4
- **Expected:** `vision` → `[data-circuit=vision]` `aria-current="true"`, no `aria-pressed`, the only current row; `currentItem()` that row; title `h3[data-circuit-title]` `tabindex=-1`, focused, "Optic chiasm"; hidden `h2` "Visual pathway"; `.circuit-role` = step 0's role; progress "Landmark 1 of 4" (FR "Repère 1 sur 4"). Then `memory` → `vision` not current, "Landmark 1 of 5".
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R); `e2e/parity/circuits.spec.ts` (R; the hash part is `links.md`; skips on `next`)

### CIRC-06 · A landmark on its own region names its side and group; elsewhere the profile offers the way back
- **Rule:** While the selected region is the current landmark's, the profile names its hemisphere and its group under the title. Once the reader selects another region, the side and group leave and the profile says "You are exploring another region." with a "Return to landmark" button, which opens the current step again (not the first), selects its region and puts focus on the title.
- **Kind:** behaviour
- **Level:** unit (view-model: `landmarkSelected`) for the condition; browser for the focus
- **Source:** `viewer/ui/panels/circuits.js:102-110,185-195`
- **Expected:** `vision` open → `landmarkSelected` true; `.circuit-context` with 2 `dt` (visually hidden "Hemisphere", "Lobe / System") and a non-empty group `dd`; no Return. Next, then select another structure → `landmarkSelected` false, no context, the note text; Return (Enter) → step still 1, selected region = step 1's region, no Return, focus on the title.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

## The stepper

### CIRC-07 · The stepper is Previous, the place and Next; an end control leaves rather than greys out
- **Rule:** The stepper is a group named "Landmarks" holding "Previous landmark", the place in the lesson ("n of N", read as "Landmark n of N") and "Next landmark", each control with the same tooltip. At an end the control that has nowhere to go is hidden. A fixed three-column grid keeps the place still.
- **Kind:** behaviour
- **Level:** browser — names and `hidden` (the targets are `stepperTargets`, unit in `core-panels.md`)
- **Source:** `viewer/ui/panels/circuits.js:74-100`
- **Expected:** `vision` step 0 → `.circuit-stepper` `role="group"`, `aria-label` "Landmarks"; Previous hidden; Next shown, `aria-label` and `data-tooltip` "Next landmark"; Previous `aria-label` "Previous landmark".
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R); `e2e/parity/circuits.spec.ts` (R; skips on `next`)

### CIRC-08 · Next and Previous keep focus, and the view follows the landmark
- **Rule:** After Next or Previous the pressed control keeps focus so it can be pressed again; when it has left (an end), focus goes to the other one. The profile is back at its top and the landmark's region is selected.
- **Kind:** behaviour
- **Level:** browser — focus and scroll
- **Source:** `viewer/ui/panels/circuits.js:281-289`
- **Expected:** `hearing`, Next (Enter) → title step 1, focus on Next, "Landmark 2 of 3"; Enter → step 2, Next hidden, focus on Previous; Enter → step 1, focus on Previous. Profile scrolled to 40 px, Next → `scrollTop` 0, selected region = step 1's region.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R); `e2e/parity/circuits.spec.ts` (R; skips on `next`)

### CIRC-09 · A busy stepper control has no hover fill
- **Rule:** While a run is in flight, hovering a stepper control does not draw its hover background.
- **Kind:** accessibility
- **Level:** browser — computed CSS
- **Source:** deviation `x3-busy-keeps-focus.md`
- **Expected:** Next held, hover Next → `background-color: rgba(0, 0, 0, 0)`.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

## The landmark sequence and the notes

### CIRC-10 · The sequence lists every landmark in order and marks the current and the seen ones
- **Rule:** Below the landmark's data, a "Landmarks" heading labels an ordered list (`role="list"`) with one button per landmark: its number and name. The current landmark is `aria-current="step"`; a landmark already seen carries a visually hidden ", seen"; seen, current and ahead differ in shape as well as in ink.
- **Kind:** accessibility
- **Level:** browser — roles and accessible names (the progress states are `stepProgress`, unit in `core-panels.md`)
- **Source:** `viewer/ui/panels/circuits.js:47-72,198-205`; deviation `x3-list-structure.md`
- **Expected:** `hearing` → `ol[role=list]` labelled by `.landmarks-heading`; progress `current, upcoming, upcoming`; only row 0 `aria-current="step"`; row 0 number "1". Next → `visited, current, upcoming`; row 0 text ends ", seen"; row 1 has no "seen"; row 0 no `aria-current`.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R); `e2e/parity/circuits.spec.ts` (R; skips on `next`)

### CIRC-11 · A landmark row opens that landmark with its title in focus; the arrows walk the sequence
- **Rule:** Pressing a landmark in the sequence opens that step (LESSON-05) and puts focus on the title. ArrowDown and ArrowUp walk the sequence's buttons only and stop at its ends.
- **Kind:** behaviour
- **Level:** browser — focus and key dispatch
- **Source:** `viewer/ui/panels/circuits.js:281-302,304-314`
- **Expected:** `hearing`, row 2, Enter → step 2, focus on the title, title = step 2's name. Row 0, ArrowDown → row 1; ArrowDown × 2 → row 2; row 0, ArrowUp → row 0.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R); `e2e/parity/circuits.spec.ts` (R; skips on `next`)

### CIRC-12 · Four notes follow the sequence, with one command to the circuit's deficit
- **Rule:** After the sequence come four disclosures: "Connections and scope" (the circuit's summary, route, scope and the schematic caveat), "What this atlas shows" (the step's mapping and the MRI note), "Clinical context" (the circuit's clinical text, "Open deficit evidence" and the reference-anatomy note) and "Sources". The only command among them is "Open deficit evidence", which opens the circuit's deficit through the Deficits tab's entry point.
- **Kind:** behaviour
- **Level:** browser — the press (the content is catalogue data)
- **Source:** `viewer/ui/panels/circuits.js:198-226,294`
- **Expected:** `hearing` → summaries in order "Connections and scope", "What this atlas shows", "Clinical context", "Sources"; buttons outside the sequence: "Open deficit evidence" only; pressing it → the Deficits entry point called once with `word-deafness`. Schematic note "Schematic relationships · not measured connectivity or tractography".
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R); `e2e/parity/circuits.spec.ts` (R: the Deficits tab shown; skips on `next`)

### CIRC-13 · Sources link out in a new tab, and say so, with the date the content was checked
- **Rule:** Each of the circuit's references is a link to its URL in a new tab with `rel="noreferrer"`, followed by its citation; the note ends with "Content checked: <date>". The link says in words that it opens a new tab (decision 17's shared text, `link.newTab`).
- **Kind:** accessibility
- **Level:** browser — link attributes
- **Source:** `viewer/ui/panels/circuits.js:207-218`; decision 17 on #4; X3's request 5 on #4 (comment 71)
- **Expected:** `hearing`, Sources open → the links' `href`s are the circuit's reference URLs in order, each `target="_blank"`, `rel="noreferrer"`; "Content checked: 2026-10-24". Each link contains the visually hidden "(opens in a new tab)" (FR "(s’ouvre dans un nouvel onglet)").
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R: links and date); `e2e/parity/circuits.spec.ts` (R; skips on `next`). The spoken new-tab cue is not implemented yet and is uncovered.

### CIRC-14 · A note the reader opened stays open as the lesson moves on
- **Rule:** The notes' open state is the reader's: it is kept while the lesson moves between landmarks and starts closed again with the next lesson.
- **Kind:** behaviour
- **Level:** browser — `<details>` state across renders
- **Source:** `viewer/ui/panels/circuits.js:198-226`; deviation `x3-disclosure-state.md`; decision 40 (bug 7) on #4
- **Expected:** `hearing`, open Sources → open; Next → still open; open `vision` → closed.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R); `e2e/parity/circuits.spec.ts` (R; skips on `next`)

## Related circuits

### CIRC-15 · Outside the Circuits tab, a landmark's region lists the lessons that pass through it
- **Rule:** Outside the Circuits tab, when the selected region is, holds or lies in a landmark, the region inspector lists "In guided circuits": one row per landmark, in catalogue order, each with the circuit's name and the landmark's place. A row is named by its visible words followed by a hidden ", Landmark". A region in no circuit, or the Circuits tab in front, shows no list. The heading labels the list and it is not a landmark.
- **Kind:** behaviour
- **Level:** unit (view-model: `relatedLandmarks`) for the rows; browser for names
- **Source:** `viewer/ui/panels/circuits.js:229-257`; deviations `x3-label-in-name.md`, `x3-list-structure.md`, `x3-no-landmarks.md`
- **Expected:** `relatedLandmarks` with regions {thalamus} over circuits (chiasm, thalamus, cortex), (hippocampus, thalamus), (cochlear-nucleus) → [vision 1, memory 1]; {hippocampus, chiasm, unrelated} → [vision 0, memory 0]; {cerebellum} or {} → []. On the app: `vision` open, Anatomy tab → a button named "Visual pathway 1 of 4 , Landmark" under `h3` "In guided circuits", its name starting with its visible words; on the Circuits tab → no `.related`; a structure in no circuit → no `.related`.
- **Covered by:** `src/features/circuits/circuits-view.test.ts` (R); `src/features/circuits/circuits.svelte.test.ts` (R); `e2e/parity/circuits.spec.ts` (R; skips on `next`)

### CIRC-16 · A related row opens that lesson at its own landmark, in the Circuits tab
- **Rule:** Pressing a related row opens the lesson on that landmark in the Circuits tab (LESSON-04), not on its first one, and puts focus on the title.
- **Kind:** behaviour
- **Level:** browser — focus
- **Source:** `viewer/ui/panels/circuits.js:295-296`
- **Expected:** select `memory`'s last landmark on Anatomy, press its row → lesson `{circuit: 'memory', step: 4}`, title = step 4's name. From `learning:midline:optic-chiasm` → explorer `circuits`, title "Optic chiasm", focused.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R); `e2e/parity/circuits.spec.ts` (R; skips on `next`)

## Runs in flight

### CIRC-17 · While a run is in flight every control stays focusable, says so and refuses
- **Rule:** While a landmark or the lesson's MRI opens, every control of the tab (rows, stepper, sequence, Return, the deficit command, related rows) carries `aria-disabled="true"`, stays focusable and is not natively disabled; a second run is refused. Focus stays on the control pressed. The profile and the notes are `aria-busy`. The status line says "Opening landmark…" and empties when the run ends.
- **Kind:** accessibility
- **Level:** browser — focus; the refusal is unit (the busy runner)
- **Source:** `viewer/ui/panels/circuits.js:137-148,259-279,293`; deviation `x3-busy-keeps-focus.md`; decision 40 (bug 2) on #4
- **Expected:** `hearing`, Next held → status "Opening landmark…", `busy` true; every visible button (more than 6) `aria-disabled="true"`, `disabled` false; focus on Next; Enter, a sequence row, a circuit row and the deficit command → one step opened, no deficit opened; `.circuit-profile` `aria-busy="true"`. Released → `busy` false, status '', step 1. During `openMri` → the related row `aria-disabled="true"`, then none.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-18 · An opening overtaken by a newer scene command ends quietly
- **Rule:** If a newer scene command overtakes the opening (LESSON-03), the tab neither starts a lesson nor moves focus, does not throw, and is no longer busy.
- **Kind:** behaviour
- **Level:** unit (the explorer)
- **Source:** `viewer/ui/panels/circuits.js:281-289`
- **Expected:** `openCircuit('vision')` held, `begin()`, release → resolves `true`; lesson circuit null; `busy` false.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R; could move down)

### CIRC-19 · A failure is said on the status line, in view, and focus stays where it was
- **Rule:** When a run fails, the status line says what could not be done in the reader's words and in the error style, is scrolled into view on the Circuits tab, the error is logged and passed to the reload offer (CTRL-36), and focus stays on the control pressed. The lesson stays on its step. The next run clears the failure.
- **Kind:** behaviour
- **Level:** unit (the explorer's `status` and `failed`) for the wording; browser for the scroll and focus
- **Source:** `viewer/ui/panels/circuits.js:142-147,269-278`
- **Expected:** a plain failure → "Could not show this landmark."; `{code: 'asset-updated'}` → "Planum was updated. Reload to continue.", `data-error="true"`, notice action `reload`, focus on Next, step 0; next run → step 1, status '', `data-error="false"`. The status line below a 120 px panel's fold is scrolled to within it. The MRI failure → "Could not open the linked MRI.".
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-20 · The status line is in the page before it speaks, and a language switch does not repeat it
- **Rule:** The `role="status"` line is always mounted on the tab, empty and taking no room at rest; only its text changes. A language switch replaces the element, so the sentence in force is not announced again.
- **Kind:** accessibility
- **Level:** browser — element identity and layout
- **Source:** `viewer/ui/panels/circuits.js:146`; deviation `x3-status-always-mounted.md`; decisions 37 and 40 (bug 3) on #4
- **Expected:** at rest → `role="status"`, text '', not `hidden`, height 0. After a failure, language `fr` → the old element disconnected, the new one reads "Impossible d’afficher ce repère." (the French `operations.landmark`).
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-21 · A landmark opened on the region already selected is announced
- **Rule:** After a landmark opens, if the selected region is the one selected before (Return, or the current row of the sequence), the page announcer says the landmark's place and name. When the region changes, the selection sentence is enough and the tab says nothing more.
- **Kind:** accessibility
- **Level:** unit (the explorer's `announceStep`) for the sentence; browser for the announcer
- **Source:** deviation `x3-step-announcement.md`; decision 40 (bug 5) on #4
- **Expected:** `hearing` step 0, press sequence row 0 → "Landmark 1 of 3: Left inferior colliculus central nucleus" (FR "Repère 1 sur 3: <French name>"). Sequence row 1 → announcer ''.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-22 · The lesson's Linked MRI runs under the tab's busy run
- **Rule:** The tab's `openMri` is the controller's `panels.openMri` (decision 9): the landmark's Linked MRI opens the lesson's prepared plane (LESSON-09) with the tab's progress and failure text; while it runs the controls refuse and a second MRI run is refused.
- **Kind:** behaviour
- **Level:** unit (the explorer) for the refusal and wording; browser for the status line
- **Source:** `viewer/ui/panels/circuits.js:343-344`; decision 9 on #4
- **Expected:** `hearing`, `openLinkedMri({atRegion: true})` → `openPreparedPlane` called once with step 0's plane; `busy` false after. Held → status "Opening landmark…", Next `aria-disabled="true"`, a second `openMri()` → `false`; released → `true`, status ''. Rejects → `false`, status "Could not open the linked MRI.", `data-error="true"`.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

## Language and accessibility checks

### CIRC-23 · The lesson profile and the related list are not landmarks
- **Rule:** The profile and the related section are plain blocks under their headings; the panel's `<aside>` is the one landmark.
- **Kind:** accessibility
- **Level:** browser — roles
- **Source:** `index.html:341,423`; `viewer/ui/panels/circuits.js:167-257`; deviation `x3-no-landmarks.md`; decision 13 on #4
- **Expected:** no `section` or `[role=region]` inside `.circuit-profile` or `.related`; `getByRole('region')` count 0 with a lesson open.
- **Covered by:** uncovered (only indirectly by axe's landmark rules in CIRC-24)

### CIRC-24 · axe finds nothing in the list, a lesson, another region, a run or a failure
- **Rule:** The list, an open lesson with Sources open, the reader on another region, a run in flight and a failure have no axe violations, in both languages and themes and at 1280 and 390 px, and with more contrast.
- **Kind:** accessibility
- **Level:** browser — axe
- **Source:** decision record #58
- **Expected:** `expectAxeClean()` → no violations in each state.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R; the full theme × width matrix in each of 5 states × 2 languages, see the audit's slow tests); `e2e/parity/circuits.spec.ts` (R; skips on `next`)

### CIRC-25 · In forced colours the open circuit, the progress shapes and the focus ring stay visible
- **Rule:** With forced colours, the open circuit's row has a solid outline, the step numbers keep their colours, seen and ahead differ by fill, and a control reached by keyboard has a solid focus ring.
- **Kind:** accessibility
- **Level:** browser — computed CSS
- **Source:** decision record #58
- **Expected:** `hearing` step 1, `forced-colors: active` → the `hearing` row `outline-style: solid`; every `.circuit-step-number` `forced-color-adjust: none`; seen and ahead backgrounds differ; Tab from Previous → Next focused, `outline-style: solid`.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-26 · With a coarse pointer every target is 44 px
- **Rule:** With a coarse pointer, circuit rows, related rows, sequence rows, note summaries, the deficit command, Return and the stepper controls are at least 44 px tall, and the stepper controls at least 44 px wide.
- **Kind:** accessibility
- **Level:** browser — layout
- **Source:** WCAG 2.2 SC 2.5.5; decision record #58
- **Expected:** touch emulation at 390 × 844 → `.circuit-choice`, `.circuit-link`, `.circuit-step`, `summary`, `.command`, `.circuit-return button`, `.circuit-stepper .icon-button` height ≥ 44; Next width ≥ 44.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-27 · At 200 % text with WCAG 1.4.12 spacing nothing is clipped or overflows
- **Rule:** At 200 % text with the 1.4.12 spacing in a 320 px viewport, in French on the longest lesson with its notes open, no visible button, summary, heading, paragraph or description overflows sideways, no control clips its text, the page does not scroll sideways, and the stepper's place stays inside its grid. At a phone width with a lesson open the page does not scroll sideways.
- **Kind:** accessibility
- **Level:** browser — layout
- **Source:** WCAG 2.2 SC 1.4.4, 1.4.10, 1.4.12
- **Expected:** `cerebellar`, French, three notes open, another region selected → every visible `button, summary, h2, h3, p, dd` `scrollWidth ≤ clientWidth + 1`; `button, summary` `scrollHeight ≤ clientHeight + 1`; root and `.circuit-stepper` `scrollWidth ≤ clientWidth + 1`. 390 px, `cerebellar`, French → page `scrollWidth − clientWidth = 0`.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R); `e2e/parity/circuits.spec.ts` (R: the 390 px page; skips on `next`)
