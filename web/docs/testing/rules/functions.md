# Functions explorer rules

Scope: chunk X1 (#56), the Functions tab: the search field, the list of curated Neurosynth functions and searched terms, the profile of one function (or of all at once), its areas and lesion checks, Restore, and the tab's busy and failure states. Legacy sources: `viewer/ui/panels/functions.js` (the Functions half of the clinical panels; the shared helpers it imports from `viewer/ui/panels/clinical.js`), `index.html:258-277,301-304,338`. New code: `web/src/features/functions/` (`functions-view.ts` is the view-model, `functions-explorer.svelte.ts` the state and commands, `FunctionList`, `FunctionProfile`, `FunctionRestore` draw them). Deviations: `x1-area-name.md`, `x1-focusable-while-opening.md`, `x1-list-semantics.md`, `x1-meta-status.md`, `x1-no-landmarks.md`, `x1-restore-focus.md`, `x1-result-announcement.md`, `x1-search-label.md`; decisions 9, 13, 37 and 38 on #4.

What opening a function does to the scene (draw, frame, hold the scene, the see-through offer, Restore itself) is in `controller.md` (CTRL-24 to CTRL-36); the domain and term data (`groupedDomains`, `matchingTerms`, `nearestName`, `domainAreas`) are in `core-catalogs.md`; `stageMessage`, `checkedParcels` and the runners are in `core-panels.md`; the list keys (`listNav`) and the debounced announcer are in `ui-kit.md` and `state.md`; a link that carries `function=` is in `links.md`. Counts below are from the published cdmd data (`public/models/cdmd/neuropsych-domains.json`, `neurosynth-terms.json`): 70 curated functions in 6 groups, 11 of them in the overview, 277 searchable terms, threshold z 3. Copy quoted is the English interface text (`web/src/lib/core/i18n/areas/functions.ts`).

## The list

### FUNC-01 · At rest the list shows "All functions", then every curated function under its group

- **Rule:** With no query, the list starts with an "All functions" row, then lists every curated function under its group heading, groups in their published order. A row shows the function's colour swatch, its name and its study count; its accessible name continues with the study count and the areas it reaches. The "All functions" row has no count and no colour.
- **Kind:** data
- **Level:** unit (view-model: `functionList`)
- **Source:** `viewer/ui/panels/functions.js:31-45,421-436`
- **Expected:** `functionList(domains, '', 'en')` → `overview.id = 'all'`, `name = 'All functions'`, `studies = null`, `colour = null`, detail "Each area in its strongest core assessment function"; 6 groups in the order `attention-executive, memory, language-number, perception, sensorimotor, social-emotional`; 70 rows in all; no term groups; no suggestion. A row's `detail` reads "<n> studies · <a> areas[, <s> structures]"; `colour` is the domain's published colour; `lang` null.
- **Covered by:** `src/features/functions/functions-view.test.ts` (R; the group order and row count are re-derived from the data, not fixed); `src/features/functions/functions.svelte.test.ts` (R); `e2e/parity/functions.spec.ts` (R; enabled on `next` since #134)

### FUNC-02 · Groups are labelled lists of buttons, and the count column is for the eye

- **Rule:** The list is a group named "Functions". Each group is a `role="group"` labelled by its `h3`, holding a `ul` of `li` buttons; the "All functions" row is its own list. Each heading names the column of study counts ("Studies"), and the column head, the count and the swatch are hidden from assistive technology. A list of buttons, not a listbox.
- **Kind:** accessibility
- **Level:** browser — DOM semantics and accessible names
- **Source:** `viewer/ui/panels/functions.js:73-84`; deviation `x1-list-semantics.md`; decision 37 on #4
- **Expected:** `getByRole('group', {name: 'Functions', exact: true})` visible; every `[role=group][aria-labelledby]` is labelled by an `H3` and holds `ul > li > button`; `.group-count`, `.function-swatch`, `.column-head` have `aria-hidden="true"`; every column head reads "Studies"; the first curated row's name matches `^<name> , [\d,]+ studies? ·`.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R); `e2e/parity/functions.spec.ts` (R; enabled on `next` since #134)

### FUNC-03 · The list's scope stands under it at rest and leaves while searching

- **Rule:** Under the list a note states the list's scope: how many curated functions, how many more terms a search finds, and what the map is not. A search hides it, since the count is announced instead.
- **Kind:** data
- **Level:** unit (view-model) for the sentence; browser for hiding (today the sentence is built in `FunctionList.svelte`)
- **Source:** `viewer/ui/panels/functions.js:418,453-454`
- **Expected:** at rest the note reads "70 functions, each a Neurosynth meta-analysis of the activation literature on HCP-MMP areas; searching also finds 277 more Neurosynth terms and clinical groups. A reference map of where studies report activation, not a measure of this brain or of a person’s abilities." Query "a" → the note is not visible.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R; checks only "70 functions", re-derived from the data); `e2e/parity/functions.spec.ts` (R; hidden while searching; enabled on `next` since #134). The full sentence and the term count are uncovered.

### FUNC-04 · The list is shown only on the Functions tab

- **Rule:** The search head and the list are hidden while another tab is in front.
- **Kind:** behaviour
- **Level:** browser — `hidden` and visibility (the condition is the explorer's `exploring`)
- **Source:** `viewer/ui/panels/functions.js:408-411`
- **Expected:** explorer `anatomy` → `.head` and `.browser` not visible.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R)

## The search field

### FUNC-05 · The search field has a visible label and controls the list

- **Rule:** The field is a search input with a visible label above it, no placeholder, `aria-controls` pointing at the list, autocomplete and spell-check off. While it is empty it shows a `/` hint, hidden from assistive technology, only while single-key shortcuts are on and not on a coarse pointer or the phone layout (≤ 800 px, or a short landscape screen).
- **Kind:** accessibility
- **Level:** browser — visible label and computed visibility
- **Source:** `index.html:262-277`; `viewer/ui/panels/functions.js:412-415`; `viewer/styles/components.css:194-195`; deviation `x1-search-label.md`; decisions 37 and 68 on #4
- **Expected:** `label.field-label` text "Search functions" (FR "Rechercher une fonction"), visible, `htmlFor` = the field's id; the field's `aria-controls` = the list group's id; `autocomplete="off"`; `placeholder` empty; `kbd` text "/" with `aria-hidden="true"`; with `:root[data-single-keys="off"]`, at 390 px wide or with a coarse pointer the `kbd` is not displayed.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R); `e2e/parity/functions.spec.ts` (R: name, and the label's box wider than 40 px; enabled on `next` since #134). The missing placeholder and the hidden hint (single keys off, phone, coarse pointer) are uncovered.

### FUNC-06 · Clear and Escape empty the field and keep focus in it

- **Rule:** With text in the field, a "Clear search" button replaces the `/` hint; pressing it empties the field, removes itself, returns focus to the field and the list returns to rest. Escape in a field with text empties it and is marked handled, so the page's Escape does not also clear the selection. Escape in an empty field, or while an input method is composing, is left to the page. Typing never moves focus.
- **Kind:** behaviour
- **Level:** browser — key dispatch to the focused field, focus
- **Source:** `viewer/ui/panels/functions.js:338-355`; KEY-04 in `controller.md`
- **Expected:** "lang", Clear → value '', `functionQuery` '', focus on the field, `.search-clear` gone, the `all` row back. "lang", Escape → `defaultPrevented` true, value ''. Escape again → `defaultPrevented` false. Escape with `isComposing` → not prevented, value still "lang". After typing "lang" focus is still the field.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R); `e2e/parity/functions.spec.ts` (R; enabled on `next` since #134)

### FUNC-07 · The `/` entry point focuses the field with its text selected

- **Rule:** The panel's `focusSearch` (the `/` key, KEY-09) puts focus in the field and selects its text.
- **Kind:** behaviour
- **Level:** browser — focus and selection
- **Source:** `viewer/ui/panels/functions.js:471`
- **Expected:** query "lang", focus elsewhere, `focusSearch()` → the field is focused, `selectionStart` 0, `selectionEnd` 4.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R)

## Search

### FUNC-08 · A query filters the curated functions and lists matching Neurosynth terms after them

- **Rule:** The trimmed query filters the curated functions under their groups. Matching searched terms follow, best match first, in a "Neurosynth terms" group (terms naming a function, task or stimulus) and a "Neurosynth clinical groups" group. At most 20 terms are listed; a note counts the rest. While searching there is no "All functions" row. A term row has no colour, and its name is marked as English in a French interface.
- **Kind:** data
- **Level:** unit (view-model: `functionList`)
- **Source:** `viewer/ui/panels/functions.js:424-445`
- **Expected:** `functionList(domains, ' a ', 'fr')` → `overview` null; 20 term rows, every one `lang: 'en'`, `colour: null`; `termsMore = matches.terms − 20`; note "<termsMore> more terms match; type more to narrow the list." (1 → "1 more term matches; …"); groups in the order `terms-function`, `terms-population`. Query "a" in English → term rows `lang: null`. Query "aphasia" → a "Neurosynth clinical groups" heading and the row `term:aphasia`.
- **Covered by:** `src/features/functions/functions-view.test.ts` (R); `src/features/functions/functions.svelte.test.ts` (R); `e2e/parity/functions.spec.ts` (R; enabled on `next` since #134)

### FUNC-09 · A query that finds nothing says so and offers the nearest name

- **Rule:** When neither a curated function nor a term matches, the list says there is no match and how to search, and offers the nearest name. Pressing the suggestion fills the field with it and keeps focus in the field.
- **Kind:** behaviour
- **Level:** unit (view-model) for the content; browser for the hand-off to the field
- **Source:** `viewer/ui/panels/functions.js:446-450,357-362`
- **Expected:** "langauge" → `matches {functions: 0, terms: 0}`; title "No match for “langauge”"; hint "Search a function, task or stimulus, such as “faces” or “reward”, or a clinical group such as “aphasia”."; a button "Did you mean “Language”?". Pressing it → field value and `functionQuery` "Language", focus on the field. "language" → no suggestion.
- **Covered by:** `src/features/functions/functions-view.test.ts` (R; the suggested name is only checked non-empty); `src/features/functions/functions.svelte.test.ts` (R); `e2e/parity/functions.spec.ts` (R; enabled on `next` since #134). The suggested name itself is not pinned anywhere.

### FUNC-10 · A query that names lesion profiles bridges to the Deficits tab

- **Rule:** While the query matches deficit profiles, the list ends with a bridge naming how many. Pressing it carries the query to the Deficits tab (CTRL-33).
- **Kind:** behaviour
- **Level:** unit (view-model) for the text; browser for the press (today the count is read in `FunctionList.svelte`)
- **Source:** `viewer/ui/panels/functions.js:451-452,364-365`
- **Expected:** "aphasia" → a button "Deficits: <n> lesion profiles match “aphasia”" (n = the Deficits tab's match count; 1 → "1 lesion profile matches"). Press → explorer `deficits`, `clinicalQuery` "aphasia", `selectedFunction` null.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R); `e2e/parity/functions.spec.ts` (R; enabled on `next` since #134)

### FUNC-11 · The arrow keys walk the list from the field; every row stays a Tab stop

- **Rule:** ArrowDown or Enter in the field moves focus to the first row. ArrowDown and ArrowUp walk every row, suggestions and bridges included, and stop at the ends; ArrowUp from the first row returns to the field. Every row is a Tab stop, and other keys (Home, End) are left alone.
- **Kind:** behaviour
- **Level:** browser — key dispatch and focus
- **Source:** `viewer/ui/panels/functions.js:345-348,369-377`; decisions 37 and 38 on #4
- **Expected:** field, ArrowDown → the `all` row; ArrowUp → the field; Enter → the `all` row. "aphasia", walking down → every `.function-row, .search-bridge` in order, the last a bridge, a further ArrowDown stays on it. Home on a row → not prevented. Tab from row 1 → row 2.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R); `e2e/parity/functions.spec.ts` (R; enabled on `next` since #134)

### FUNC-12 · The result count is said once typing pauses, and again after the field is cleared

- **Rule:** 500 ms after typing pauses, the page announcer says how many curated functions and terms match. Nothing is said before the pause. An equal sentence is not said twice while the field keeps text; clearing the field forgets it, so the same query typed again is said.
- **Kind:** accessibility
- **Level:** unit for the sentence (`resultsSentence`); browser with fake timers for the debounce in the component
- **Source:** `viewer/ui/panels/functions.js:455`; `viewer/ui/announce.js:7-14`; deviation `x1-result-announcement.md`; decision 37 on #4
- **Expected:** `resultsSentence({functions: 1, terms: 2}, 'en')` → "1 function and 2 Neurosynth terms"; `{0, 0}` → "No match" (FR "Aucun résultat"). Typing "lang" → announcer '' until 500 ms, then a sentence matching `^\d+ functions?( and \d+ Neurosynth terms?)?$`. Clear, retype "lang" → the same sentence again. "zzzzqqq" → "No match".
- **Covered by:** `src/features/functions/functions-view.test.ts` (R: the sentence); `src/features/functions/functions.svelte.test.ts` (R; real 500 ms waits)

### FUNC-13 · A language switch does not say the count again

- **Rule:** The count is said from the query and the counts only; switching the interface language with a query in the field says nothing.
- **Kind:** accessibility
- **Level:** browser — the component's effect (fake timers)
- **Source:** deviation `x1-result-announcement.md`; decision 37 on #4
- **Expected:** "lang" said; announcer emptied; language `fr` → after 900 ms the announcer is still ''.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R; a real 900 ms sleep)

## Opening a function

### FUNC-14 · Opening a function focuses its heading at once and marks its row

- **Rule:** Pressing a row (click, Enter or Space) opens the function's profile at once: its name, an `h2` that takes focus before the areas are drawn, and the profile scrolled to its top. The row becomes the one `aria-current="true"` row and is handed to the workspace as its current item. Pressing the open function again focuses its heading again.
- **Kind:** behaviour
- **Level:** browser — focus and scroll
- **Source:** `viewer/ui/panels/functions.js:149-162,457-462`; CTRL-25 for the scene
- **Expected:** a function with ≤12 areas, its download held → `document.activeElement` is the `h2[data-function-title]` (`tabindex=-1`) reading the function's name; meta "Preparing the HCP-MMP areas…"; once drawn, `[data-function=<id>]` has `aria-current="true"` and it is the only one; `currentItem()` is that row; `selectedFunction` = id; Restore offered. Scroll parent at 80 px, open another → `scrollTop` 0. Enter on the open row → focus on the heading.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R); `e2e/parity/functions.spec.ts` (R; the hash part is `links.md`; enabled on `next` since #134)

### FUNC-15 · The meta line says what is being prepared, then what is shown

- **Rule:** Under the heading, the meta line says the areas are being prepared while the run is in flight, then how many areas and structures the function reaches at the threshold; for the overview it says the colouring is on the HCP-MMP areas.
- **Kind:** data
- **Level:** unit (view-model: `areaCount`, the explorer's `meta`)
- **Source:** `viewer/ui/panels/functions.js:59-67,320-335`
- **Expected:** in flight → "Preparing the HCP-MMP areas…". `language` → "96 HCP-MMP areas at z ≥ 3"; `attention` → "112 HCP-MMP areas and 4 structures at z ≥ 3" (no-break spaces around ≥); `all` → "Shown on the HCP-MMP areas". The list row's short count: `language` → "96 areas", `attention` → "112 areas, 4 structures". French → "<n> aires HCP-MMP…".
- **Covered by:** `src/features/functions/functions-view.test.ts` (W: regex only, on the first domain); `src/features/functions/functions.svelte.test.ts` (R: the preparing text and the overview sentence; the counts by regex). The fixed counts are uncovered.

### FUNC-16 · The meta line is one live region kept across profiles

- **Rule:** One `role="status"` line stays in the page while the reader moves between functions, and only its text changes; an unchanged sentence is not rewritten. A language switch makes a new element, so the translated sentence is not announced again.
- **Kind:** accessibility
- **Level:** browser — element identity and DOM mutations
- **Source:** `viewer/ui/panels/functions.js:303-305,333`; deviation `x1-meta-status.md`; decision 37 on #4
- **Expected:** open A, then B → `meta()` is the same element; consecutive text writes all differ. Language `fr` → a new element, the old one disconnected, text matching `^\d+ aires? HCP-MMP`.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R)

### FUNC-17 · A later choice overtakes an earlier one, and only the latest speaks

- **Rule:** Opening another function while one is still downloading overtakes it. The earlier run, when it settles or fails later, is logged but changes neither the profile, the meta line nor the busy state.
- **Kind:** behaviour
- **Level:** unit (the explorer's run state)
- **Source:** `viewer/ui/panels/functions.js:123-147`
- **Expected:** open A (held), open B → B's count on the meta line; A rejects late → `openFunction(A)` resolves `false`, `console.error` called, `selectedFunction` B, meta still B's count, `data-error="false"`, `opening` false.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R; could move down)

### FUNC-18 · A failed opening is worded for the reader and belongs to its profile

- **Rule:** If a function's areas cannot be drawn, the meta line says so in the danger colour, the error is logged, the heading keeps focus and a failure that needs a newer deploy raises the Reload notice (CTRL-36). Opening another function, or switching language, clears the failure.
- **Kind:** behaviour
- **Level:** unit (the explorer's `meta` and `failed`)
- **Source:** `viewer/ui/panels/functions.js:134-140,331-334,466`
- **Expected:** reveal rejects `{code: 'asset-updated'}` → meta "The HCP-MMP areas could not be shown.", `data-error="true"`, `console.error` called, notice action `reload`, focus on the heading. Then open another function → `data-error="false"`. Language switch clearing it: uncovered.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R); the language case is uncovered

## The profile

### FUNC-19 · The overview profile lists the overview functions as links

- **Rule:** "All functions" opens a profile with a summary, the caveat, and a "Functions" section listing each overview function with its swatch, name and short area count; it has no areas and no lesion section. A link opens that function.
- **Kind:** data
- **Level:** unit (view-model: `functionProfile`); browser for the hand-off
- **Source:** `viewer/ui/panels/functions.js:251-265,300-312`
- **Expected:** `functionProfile(deps, 'all', 'en')` → `all: true`, name "All functions", `term` null, `areas` [], `lesions` null, 11 overview links (`executive, working-memory, long-term-memory, language, attention, visuospatial, social-cognition, visual-perception, motor, auditory-perception, emotion`). Pressing the first link → `selectedFunction` its id, focus on the heading.
- **Covered by:** `src/features/functions/functions-view.test.ts` (R; the 11 re-derived from the data); `src/features/functions/functions.svelte.test.ts` (R)

### FUNC-20 · A curated function's profile reads kind, caveat, areas, lesion checks, method and source

- **Rule:** A curated function's profile says which evidence it rests on (its Neurosynth term, marked as English, and its study count), the caveat, its areas and structures strongest first, the lesion studies that check the map, how the scores were made and the citation. Each area names its region and side, its functional division (named, else the section division) and its z with one decimal.
- **Kind:** data
- **Level:** unit (view-model: `functionProfile`)
- **Source:** `viewer/ui/panels/functions.js:171-249,267-275,307-316`
- **Expected:** kind "Activation evidence · Neurosynth term “<term>” · <n> studies"; caveat "Where studies of healthy groups report activation: not this brain, and not what damage would impair."; areas heading "Areas and structures, strongest first" with an `aria-hidden` "z" column head; `areas` sorted by z descending, `language`'s first `hcp-mmp:left:81` at "20.3"; each `name` "<label> · Left|Right"; at least one division; no areas → "No HCP-MMP area or structure reaches z 3."; lesion heading "Deficits that check this map", each row "<deficit name>" with "<references> · <parcels>", then the lesion note; a domain with no check → "No lesion study in Planum’s deficit evidence checks this domain."; method from the Neurosynth source ("Neurosynth (Yarkoni et al. 2011)"); `lesionBridge` null.
- **Covered by:** `src/features/functions/functions-view.test.ts` (R; values by regex); `src/features/functions/functions.svelte.test.ts` (R: the lesion heading)

### FUNC-21 · Every lesion check is listed, one row per check

- **Rule:** The lesion section lists each check of the map, even when several checks cite the same deficit (one per association), each with its own references and parcels. Pressing one opens its deficit through the Deficits tab's entry point.
- **Kind:** data
- **Level:** unit (view-model) for the rows; browser for the hand-off and the keyed render
- **Source:** `viewer/ui/panels/functions.js:222-249,383-384`
- **Expected:** `language` → 6 rows named "Aphasia" (associations `aphasia-comprehension`, `aphasia-repetition`, …), the first reading "Dronkers et al. 2004 · <parcels>". Pressing a row → the Deficits entry point called with `aphasia`. Seven published domains have repeated deficits (`language`, `attention`, `social-cognition`, `spatial-attention`, `speech-production`, `recall`, `gestures`).
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R: the hand-off, on a domain whose checks are distinct). Repeated deficits are uncovered, and likely broken: `FunctionProfile.svelte` keys the rows by `check.deficit`, which repeats for these seven domains (Svelte's keyed each rejects duplicate keys); no browser test opens one of them.

### FUNC-22 · A searched term's profile is in English, with its own caveat and no lesion checks

- **Rule:** A searched term's profile names the term in English (marked `lang="en"` in French), with the caveat for a term or for a clinical group, its areas, and no lesion section. A clinical group whose words match lesion profiles bridges to the Deficits tab under "Lesion evidence".
- **Kind:** data
- **Level:** unit (view-model: `functionProfile`); browser for `lang` and the press
- **Source:** `viewer/ui/panels/functions.js:277-288,300-313`
- **Expected:** a function term → caveat "A Neurosynth term, not a curated function: chosen for naming a function, task or stimulus, but its map was not checked against what it names or against lesion studies."; a population term → "A clinical group: its studies mostly compare people with the condition with healthy people. The map shows where they report activation, not where damage causes the condition."; `lesions` null. Population term with 3 matching deficits → `lesionBridge.text` "Deficits: 3 lesion profiles match “<term>”", `query` the term; with 0 → null; a function term → null. In French: `h2[lang=en]`, the kind line's term `span[lang=en]`. `term:aphasia` bridge press → `clinicalQuery` "aphasia".
- **Covered by:** `src/features/functions/functions-view.test.ts` (R; the caveats only checked to differ); `src/features/functions/functions.svelte.test.ts` (R)

### FUNC-23 · An unknown function or area fails loudly

- **Rule:** A profile for an id that is neither a curated function, a term nor the overview is an error; so is an area whose region the anatomy does not know.
- **Kind:** behaviour
- **Level:** unit
- **Source:** new code (`functions-view.ts`; legacy rendered nothing)
- **Expected:** `functionProfile(deps, 'no-such-function', 'en')` throws /Unknown function/. An area region absent from the catalog → throws "Unknown region in function <id>: <region>".
- **Covered by:** `src/features/functions/functions-view.test.ts` (R: the function); the unknown area is uncovered

### FUNC-24 · Twelve areas are listed; the rest wait under a disclosure that closes on another function

- **Rule:** The first 12 areas are listed; the rest sit under a native disclosure, closed, whose summary counts them. Opening another function closes it again.
- **Kind:** behaviour
- **Level:** browser — `<details>` state across renders (the split is unit)
- **Source:** `viewer/ui/panels/functions.js:209-218`
- **Expected:** `language` (96 areas) → 96 area rows in all, 84 inside a closed `details` whose summary reads "84 more areas" (1 → "1 more area"); pressing it → open. Open another function with more than 12 areas → closed.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R); `e2e/parity/functions.spec.ts` (R; enabled on `next` since #134)

### FUNC-25 · An area button is named by what it shows

- **Rule:** An area button has no `aria-label`. Its name is its content: the region and side, the division and the z score, with the separators and "z" as visually hidden text, so the visible words begin the name in order.
- **Kind:** accessibility
- **Level:** browser — accessible name
- **Source:** `viewer/ui/panels/functions.js:181-182`; deviation `x1-area-name.md`
- **Expected:** no `aria-label`; name matches `^.+ · [LR]\w*,? .*z [\d.]+$`, e.g. "<area> · Left, <division>, z 20.3"; `getByRole('button', {name: /^<visible name>/})` finds it.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R); `e2e/parity/functions.spec.ts` (R; the regex accepts the legacy "Show area: " prefix; enabled on `next` since #134)

### FUNC-26 · Opening an area draws it and hands focus to the region's name

- **Rule:** An area opens as a listed region (CTRL-26). Once it is drawn, the region inspector's name takes focus and is brought to the top of the scrolling panel. If it cannot be drawn, the meta line says so and focus stays on the area.
- **Kind:** behaviour
- **Level:** browser — focus and scroll position
- **Source:** `viewer/ui/panels/clinical.js:22-29`; `viewer/ui/panels/functions.js:385-389`
- **Expected:** Enter on an area → focus on `#selected-name`, its top within 2 px of the panel's top, `data-error="false"`. Reveal rejects → meta "Could not show the region.", `data-error="true"`, focus still on the area.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R)

### FUNC-27 · While a run is in flight, areas and Restore stay focusable, say so and do nothing

- **Rule:** While any run is in flight, each area button and Restore carry `aria-disabled="true"`, stay focusable, are drawn in the tertiary ink and ignore presses. Focus stays on the control pressed.
- **Kind:** accessibility
- **Level:** browser — focus
- **Source:** `viewer/ui/panels/functions.js:321-323,386,391`; deviations `x1-focusable-while-opening.md`, `x1-restore-focus.md`
- **Expected:** Enter on area 0 (held) → meta "Preparing the HCP-MMP areas…"; area 0 `aria-disabled="true"`, not `disabled`, focused; Enter again and a click on area 1 → the region opened once; Restore `aria-disabled="true"` and a press re-applies no scene. Released → `aria-disabled` removed.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R)

### FUNC-28 · The profile is not a landmark

- **Rule:** The profile and its sections are plain blocks under their headings; the panel's `<aside>` is the one landmark.
- **Kind:** accessibility
- **Level:** browser — roles
- **Source:** `index.html:338`; `viewer/ui/panels/functions.js:195-199,225-228,254-256,282-286`; deviation `x1-no-landmarks.md`; decision 13 on #4
- **Expected:** no `section` or `[role=region]` inside `.profile`; on the page, `getByRole('region')` count 0.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R); `e2e/parity/functions.spec.ts` (R; enabled on `next` since #134)

## Restore

### FUNC-29 · Restore is offered with an open function and returns focus to its row

- **Rule:** "Restore previous view" stands in the location bar's trailing slot while a function is open on the Functions tab and an earlier scene is held. Pressing it puts the scene back (CTRL-27), closes the profile, removes itself and puts focus on the function's row, or on the field when the row is not listed.
- **Kind:** behaviour
- **Level:** browser — focus
- **Source:** `viewer/ui/panels/functions.js:107-111,164-169,323`; deviation `x1-restore-focus.md`
- **Expected:** nothing open → no `.restore`. Open a function → "Restore previous view" (FR "Rétablir la vue précédente"); Enter → `selectedFunction` null, focus on the row, `.restore` gone, notice "Previous view restored.". Open, search "zzzqqq", Restore → focus on the field.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R); `e2e/parity/functions.spec.ts` (R; enabled on `next` since #134)

### FUNC-30 · A failed restore keeps Restore and its focus for another try

- **Rule:** If the scene comes back only in part, the meta line says so, Restore stays with focus on it and available, and a second press can succeed.
- **Kind:** behaviour
- **Level:** browser — focus
- **Source:** `viewer/ui/panels/functions.js:165-168`; deviation `x1-restore-focus.md`
- **Expected:** reader returns one failure → meta "The previous view could not be fully restored."; Restore is the same element, focused, no `aria-disabled`. Enter again → `selectedFunction` null.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R)

## Language and accessibility checks

### FUNC-31 · The tab is French in French, and searched terms stay English

- **Rule:** In French the field, the list, the rows and the profile use the French copy; Neurosynth terms are English and marked so.
- **Kind:** behaviour
- **Level:** browser — `lang` attributes and accessible names
- **Source:** `viewer/ui/panels/functions.js:35-36,301,429-430`
- **Expected:** searchbox "Rechercher une fonction"; group "Fonctions"; row `^Toutes les fonctions`; row `^Langage\s*, [\d,]+ études? ·`; query "a" → `[data-function^="term:"] .row-name[lang=en]`; `[data-function=language] .row-name` has no `lang`.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R); `e2e/parity/functions.spec.ts` (R; enabled on `next` since #134)

### FUNC-32 · axe finds nothing in the list, an open profile or a search

- **Rule:** The list at rest, a profile with its areas disclosure open, and a search for "aphasia" have no axe violations, in both languages and themes and at 1280 and 390 px, and with more contrast.
- **Kind:** accessibility
- **Level:** browser — axe
- **Source:** decision record #56
- **Expected:** `expectAxeClean()` → no violations in each state.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R; the full theme × width matrix in each of 3 states × 2 languages, see the audit's slow tests); `e2e/parity/functions.spec.ts` (R; enabled on `next` since #134)

### FUNC-33 · In forced colours the swatches, the open row and the focus ring stay visible

- **Rule:** With forced colours, a function's swatch keeps its colour, the open row has a solid outline, and a row reached by keyboard has a solid focus ring.
- **Kind:** accessibility
- **Level:** browser — computed CSS
- **Source:** decision record #56
- **Expected:** `forced-colors: active` → swatch `forced-color-adjust: none` and a non-transparent background; open row `outline-style: solid`; field, ArrowDown → the focused row `outline-style: solid`.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R)

### FUNC-34 · Targets are 24 px with a fine pointer and 44 px with a coarse one

- **Rule:** Every visible button and summary is at least 24 px tall with a fine pointer. With a coarse pointer, rows, areas, the disclosure summary and Restore are at least 44 px tall, and Clear search is at least 44 × 44 px.
- **Kind:** accessibility
- **Level:** browser — layout
- **Source:** WCAG 2.2 SC 2.5.8; decision record #56
- **Expected:** fine pointer → every visible `button, summary` height ≥ 24. Touch emulation at 390 × 844 → `.function-row`, `.function-area`, `summary`, `.restore`, `.search-clear` height ≥ 44; `.search-clear` width ≥ 44.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R)

### FUNC-35 · At 200 % text with WCAG 1.4.12 spacing nothing is clipped or overflows

- **Rule:** At 200 % text with the 1.4.12 spacing in a 320 px column, names wrap: no visible button, summary, heading, paragraph or label overflows sideways, no control clips its text, and the page does not scroll sideways. At a phone width the page does not scroll sideways.
- **Kind:** accessibility
- **Level:** browser — layout
- **Source:** WCAG 2.2 SC 1.4.4, 1.4.10, 1.4.12
- **Expected:** every visible `button, summary, h2, h3, p, label`: `scrollWidth ≤ clientWidth + 1`; `button, summary`: `scrollHeight ≤ clientHeight + 1`; root `scrollWidth ≤ clientWidth + 1`. 390 px page → `scrollWidth − clientWidth = 0`.
- **Covered by:** `src/features/functions/functions.svelte.test.ts` (R); `e2e/parity/functions.spec.ts` (R: the 390 px page; enabled on `next` since #134)
