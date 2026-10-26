# Deficits explorer rules

Scope: chunk X2 (#57), the Deficits tab and the region inspector's related deficits: the search field, the list of deficit profiles, the profile of one deficit (its meta line, associations, evidence and publications, checked maps), Restore, and the "Neuropsychology" list under a selected region. Legacy sources: `viewer/ui/panels/clinical.js` (the Deficits half: `createClinicalExplorer`, lines 40-164 and 227-550), `index.html:279-295,339,417`. New code: `web/src/features/deficits/` (`explorer.svelte.ts` holds the runner and the focus hand-offs, `profile-meta.ts` the meta line's counts; `DeficitList`, `DeficitSearch`, `DeficitProfile`, `ProfileBody`, `Association`, `Publication`, `ExternalLink`, `LinkRow`, `RelatedDeficits`, `DeficitRestore` draw them). Deviations: `x2-aria-disabled-while-opening.md`, `x2-evidence-summary-name.md`, `x2-external-links.md`, `x2-focus-after-render.md`, `x2-list-semantics.md`, `x2-results-announcement.md`, `x2-search-label.md`, `x2-section-landmarks.md`, `x2-single-clear-control.md`, `x2-status-live-region.md`; decisions 13, 17, 37, 38 and 68 ("Deficits follows the Functions shape") on #4.

What opening a deficit does to the scene (draw, frame, the reveal notice and the see-through offer, Restore itself, the search carried between tabs) is in `controller.md` (CTRL-24, CTRL-26 to CTRL-33); the deficit catalogue (`grouped`, `search`, `nearest`, `mappedRegions`, `paint`, `forDeficit`, `forRegion`, validation) is in `core-catalogs.md`; `stageMessage`, `sharedSide`, `sideStated`, `publishedCorrections`, `relatedRegionVisible`, `involved` and the runners are in `core-panels.md`; the list keys and the announcer are in `ui-kit.md` and `state.md`; a link that carries `deficit=` is in `links.md`. The published data (`data/neuropsychology.yaml`, revised 2026-10-22) has 40 deficits in 6 groups; `aphasia` has 6 left associations, `neglect` 5 right ones, `amnesia` 3 bilateral ones. Copy quoted is the English interface text (`web/src/lib/core/i18n/areas/clinical.ts`).

## The list

### DEF-01 · The list groups every deficit under its group and states the collection's scope
- **Rule:** With no query, the list shows all deficit profiles under their group headings, groups in authored order and empty groups left out. A row shows the deficit's name and, under it, its domain. Under the list a note states the scope; a search hides it.
- **Kind:** data
- **Level:** unit (view-model; the grouping is the clinical catalogue's) for the content; browser for the note's removal
- **Source:** `viewer/ui/panels/clinical.js:40-49,63-71,494-504`
- **Expected:** 40 rows in 6 groups ("Attention and executive functions" 9, "Memory" 1, "Language, reading and number" 7, "Perception and visuospatial abilities" 7, "Sensorimotor functions" 14, "Social and emotional functions" 2); note "40 profiles · adult acquired deficits"; query "aphas" → 1 row ("Aphasia") and no note.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R; groups only checked as more than 3); `e2e/parity/deficits.spec.ts` (R; `next` gated off)

### DEF-02 · Groups are labelled lists of buttons
- **Rule:** The list is a group named "Deficits". Each deficit group is a `role="group"` labelled by its `h3`, holding a `ul` of `li` buttons, as the Functions list does. A list of buttons, not a listbox.
- **Kind:** accessibility
- **Level:** browser — DOM semantics
- **Source:** `viewer/ui/panels/clinical.js:63-71`; deviation `x2-list-semantics.md`; decisions 38 and 68 on #4
- **Expected:** `[role=group][aria-label="Deficits"]` present; every `[role=group][aria-labelledby]` is labelled by an `H3` and its `ul > li` count equals its `ul > li > button.row` count; 40 `ul > li > button.row` in all.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R)

### DEF-03 · The search field has a visible label, controls the list and shows the `/` hint
- **Rule:** The field has a visible label above it and no placeholder, and `aria-controls` points at the list. While it is empty it shows a `/` hint hidden from assistive technology, only while single-key shortcuts are on (and not on a coarse pointer or the phone layout).
- **Kind:** accessibility
- **Level:** browser — visible label and layout
- **Source:** `index.html:279-295`; `viewer/ui/panels/clinical.js:486-487`; deviation `x2-search-label.md`; decisions 37 and 68 on #4
- **Expected:** `label.field-label` "Search deficits or cognitive functions", taller than 8 px, `htmlFor` = the field's id; `placeholder` ''; `aria-controls` = the "Deficits" group's id; `kbd.shortcut` "/" with single keys on; absent with `showShortcut` false.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R); `e2e/parity/deficits.spec.ts` (R: the accessible name only; `next` gated off)

### DEF-04 · One clear control, which returns focus to the field
- **Rule:** With text in the field, a "Clear search" button appears and is the only clear control: the browser's own search cancel button is hidden. Pressing it empties the field and returns focus to it.
- **Kind:** behaviour
- **Level:** browser — rendering of the native cancel, focus
- **Source:** `viewer/ui/panels/clinical.js:459-465,488-491`; deviation `x2-single-clear-control.md`; decision 38 (D9) on #4
- **Expected:** empty field → no clear button. "aphas" → `getByRole('button', {name: 'Clear search'})` visible; the native `::-webkit-search-cancel-button` not displayed; press → value '', focus on the field.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R; I for the native cancel, which is checked by finding the CSS rule's text in the style sheets rather than its effect); `e2e/parity/deficits.spec.ts` (R; `next` gated off)

### DEF-05 · Escape empties a filled field and keeps focus; on an empty field it is the page's
- **Rule:** Escape in a field with text empties it, keeps focus in the field and is marked handled; the list returns to all 40. Escape in an empty field, or while an input method composes, is left to the page's Escape cascade.
- **Kind:** behaviour
- **Level:** browser — key dispatch to the focused field
- **Source:** `viewer/ui/panels/clinical.js:406-413`; KEY-04 in `controller.md`
- **Expected:** "aphas", Escape → value '', focus on the field, the query set to ''. Empty field, Escape → the window sees `defaultPrevented` false. Composing: uncovered.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R); `e2e/parity/deficits.spec.ts` (R; `next` gated off); the composing case is uncovered

### DEF-06 · The `/` entry point focuses the field with its text selected
- **Rule:** `focusSearch` (the `/` key, KEY-09) puts focus in the field and selects its text.
- **Kind:** behaviour
- **Level:** browser — focus and selection
- **Source:** `viewer/ui/panels/clinical.js:535`
- **Expected:** "aphas", focus on a row, `focusSearch()` → the field focused, selection [0, 5].
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R)

### DEF-07 · A query that finds nothing says so and offers the nearest name
- **Rule:** With no matching deficit, the list says so, suggests trying a cognitive function, and offers the nearest deficit name. Pressing the suggestion fills the field and keeps focus there.
- **Kind:** behaviour
- **Level:** unit (view-model) for the content; browser for the hand-off
- **Source:** `viewer/ui/panels/clinical.js:505-510,420-425`
- **Expected:** "aphazia" → 0 rows; title "No match for “aphazia”"; hint "Try another term or a cognitive function."; button "Did you mean “Aphasia”?"; press → the query set to the suggestion, focus on the field.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R; the suggested name is not pinned); `e2e/parity/deficits.spec.ts` (R; `next` gated off)

### DEF-08 · A query that names activation maps bridges to the Functions tab
- **Rule:** While the query matches Functions-tab maps, the list ends with a bridge naming how many; pressing it carries the query to the Functions tab (CTRL-33).
- **Kind:** behaviour
- **Level:** unit (view-model) for the text; browser for the press
- **Source:** `viewer/ui/panels/clinical.js:511-512,427-428`
- **Expected:** 3 matches for "memory" → button "Functions: 3 activation maps match “memory”"; 1 → "Functions: 1 activation map matches “memory”"; press → the search carried to `functions` with "memory". On the built site, "language" → the Functions tab selected, hash `tab=functions`.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R; the count is a stub and the press is checked on the controller's call log); `e2e/parity/deficits.spec.ts` (R; `next` gated off)

### DEF-09 · The arrow keys walk the list from the field; every row stays a Tab stop
- **Rule:** ArrowDown or Enter in the field reaches the first row; ArrowDown and ArrowUp walk the rows, the bridge and the suggestion included; ArrowUp from the first row returns to the field. Every row is a Tab stop; there is no Home or End.
- **Kind:** behaviour
- **Level:** browser — key dispatch and focus
- **Source:** `viewer/ui/panels/clinical.js:414-417,432-440`; decision 38 on #4
- **Expected:** field, ArrowDown → row 0; ArrowDown → row 1; ArrowUp × 2 → the field; Enter → row 0; Tab → row 1; every row `tabIndex` 0. "memory" with a bridge, walking down → the last stop is `.search-bridge`.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R); `e2e/parity/deficits.spec.ts` (R; `next` gated off)

### DEF-10 · A focused row is never hidden under its sticky group heading
- **Rule:** Walking the list down, up, or backwards with Shift+Tab, the focused row is never covered by its group's sticky heading and stays inside the list's scroll box.
- **Kind:** accessibility
- **Level:** browser — layout and scroll
- **Source:** WCAG 2.2 SC 2.4.11 Focus Not Obscured
- **Expected:** for every row reached, its top ≥ its group heading's bottom − 1 px and its bottom ≤ the list's bottom + 1 px.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R; walks all 40 rows three times, see the audit's slow tests)

### DEF-11 · Every settled query says its count, a cleared one included
- **Rule:** 500 ms after a query settles, the announcer says how many deficits match. A cleared query says the full count. A different query with the same count is said again. Nothing is said before the pause, and a language change says nothing.
- **Kind:** accessibility
- **Level:** unit for the sentence (`results`); browser with fake timers for the debounce in the component
- **Source:** `viewer/ui/panels/clinical.js:513`; `viewer/ui/announce.js`; deviation `x2-results-announcement.md`; decision 37 on #4
- **Expected:** "aphas" → '' at once, then "1 deficit"; Escape → "40 deficits"; "aphas" then "amnesi" → "1 deficit" written again; "aphazia" → "No match". Language `fr` with a query → nothing said.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R; real 500 ms waits); `e2e/parity/deficits.spec.ts` (R: "1 deficit"; `next` gated off). The language case is uncovered.

### DEF-12 · The open deficit's row is current
- **Rule:** The row of the open deficit is the one `aria-current="true"` row and is handed to the workspace as its current item.
- **Kind:** behaviour
- **Level:** browser — the workspace registry reads the DOM
- **Source:** `viewer/ui/panels/clinical.js:515-520`
- **Expected:** `selectedDeficit = 'aphasia'` → `currentItem()` is the Aphasia row, `aria-current="true"`.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R)

## Opening a deficit

### DEF-13 · The profile opens at once and its heading takes focus once it is that deficit's
- **Rule:** Pressing a row opens the profile at once (CTRL-24). Once the profile of that deficit is in the page, it scrolls to its top and its heading (an `h2`, `tabindex=-1`) takes focus; a heading still showing another deficit never takes it.
- **Kind:** behaviour
- **Level:** browser — focus after render, scroll
- **Source:** `viewer/ui/panels/clinical.js:275-285`; deviation `x2-focus-after-render.md`
- **Expected:** press Aphasia → focus on `h2` "Aphasia"; row `aria-current="true"`. Press Amnesia → focus on `h2` "Amnesia". Scroll parent at 200 px, open another → `scrollTop` 0. `openDeficit('amnesia')` resolves after the preparation, focus on the heading.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R); `e2e/parity/deficits.spec.ts` (R; the hash part is `links.md`; `next` gated off)

### DEF-14 · The profile reads evidence kind, summary, caveat, associations, checked maps and sources
- **Rule:** Under its heading and meta line the profile says how many associations it rests on, the deficit's summary, a caveat that it is reference anatomy, then the associations under one "Associations" heading, the activation maps the evidence checks when there are any, and the sources line with the revision date.
- **Kind:** data
- **Level:** unit (view-model) for the content; today built in `ProfileBody.svelte`
- **Source:** `viewer/ui/panels/clinical.js:321-358`
- **Expected:** Aphasia → "Lesion and clinical evidence · 6 associations"; caveat "Reference anatomy; associations do not predict an individual patient’s deficit."; one `h3` "Associations"; "Activation maps this evidence checks" present only when `checkedMaps` is not empty; foot "Selected literature · not a systematic review · Content checked: 2026-10-22".
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R: the single "Associations" heading); `e2e/parity/deficits.spec.ts` (R: the kind line; `next` gated off). The caveat, the checked-maps heading and the sources line are uncovered.

### DEF-15 · The meta line says what is opening, then the side and what the stage shows
- **Rule:** The meta line says "Opening anatomy…" while the deficit's regions are prepared. Then, when all the profile's associations share a side, it names the side, followed by how many of the mapped regions are drawn now, counted again as the reader hides, cuts or isolates. With a paint on the stage it counts the painted regions and says "coloured".
- **Kind:** data
- **Level:** unit (`profile-meta.ts` `stageCounts`; the sentence is a view-model)
- **Source:** `viewer/ui/panels/clinical.js:361-368,388-403`; `viewer/clinical/translations.js` (`regionsMarked`)
- **Expected:** on Destrieux, aseg, both hemispheres: Aphasia held → "Opening anatomy…", then "Left hemisphere · 7 regions visible"; hemisphere `right` → "Left hemisphere · 0 of 7 regions visible". Paint with one region → "Left hemisphere · 1 region coloured". Amnesia → starts "Bilateral landmarks"; Neglect → starts "Right hemisphere" and `stageCounts` counts all its mapped regions but one as shown. `stageCounts` on aphasia with hemisphere `right` → shown 0; isolated on its first region → 1; its first region hidden → total − 1; an unknown region → throws.
- **Covered by:** `src/features/deficits/profile-meta.test.ts` (R); `src/features/deficits/deficits.svelte.test.ts` (R); `e2e/parity/deficits.spec.ts` (R, by regex; `next` gated off)

### DEF-16 · The meta line is one status region updated in place
- **Rule:** One `role="status"` line is mounted with the profile and keeps its element while the reader moves between deficits and languages; only its text changes, so each change is announced.
- **Kind:** accessibility
- **Level:** browser — element identity
- **Source:** `viewer/ui/panels/clinical.js:331-334,401`; deviation `x2-status-live-region.md`
- **Expected:** open Aphasia, keep the node; Amnesia → the same node reads "Bilateral landmarks…"; language `fr` → the same node reads "Repères bilatéraux…", still connected.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R)

### DEF-17 · A later open overtakes an earlier one, and only the latest reports
- **Rule:** Opening another deficit while one is being prepared overtakes it: the earlier run settling does not end the busy state or change the meta line.
- **Kind:** behaviour
- **Level:** unit (the explorer's runner state)
- **Source:** `viewer/ui/panels/clinical.js:287-312`
- **Expected:** Aphasia held, Amnesia held → heading "Amnesia"; Aphasia settles → `opening` still true, meta "Opening anatomy…"; Amnesia settles → `opening` false, meta ends "regions visible".
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R; could move down)

### DEF-18 · A failure is worded for the reader and belongs to its profile
- **Rule:** A failure is said on the meta line in the reader's words, never the developer's message, in the error style; it is passed to the reload offer (CTRL-36) and focus stays where it was. Another deficit or another language clears it.
- **Kind:** behaviour
- **Level:** unit (the explorer's `actionError` and the meta sentence)
- **Source:** `viewer/ui/panels/clinical.js:296-306,521-526`
- **Expected:** a region open rejects "Unknown clinical region: x" → meta "Could not show the region." (not containing "Unknown clinical region"), class `error`, the reload offer hears it, focus on the region button. Language `fr` → no error, meta starts "Hémisphère gauche · ". Fail again, then `selectedDeficit = 'amnesia'` → no error. A failed deficit opening → "Could not show this deficit’s regions." (uncovered).
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R); the deficit-opening wording is uncovered

## Associations and evidence

### DEF-19 · An association shows its colour, its side once, and its regions in reach
- **Rule:** Each association is an article headed by its title with the swatch of its colour on the brain (hidden from assistive technology). When every association shares a side, the meta line states it and the titles drop the short side; otherwise each title shows the short side for the eye. A screen reader always hears " · <full side>". Each mapped region is a button named "Open region: <name> · <Side>"; its visible text drops the side when it matches the association's. An association with no mapping says "No atlas mapping available."
- **Kind:** behaviour
- **Level:** browser — accessible names (the side choices are `sharedSide` / `sideStated`, unit in `core-panels.md`)
- **Source:** `viewer/ui/panels/clinical.js:114-174`
- **Expected:** Neglect → more than one `article.association`; the title's `.network-swatch` `aria-hidden="true"`; no `.side`; hidden text " · Right hemisphere"; first region `aria-label` matching `^Open region: .+ · Right$`, its text without "Right".
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R); `e2e/parity/deficits.spec.ts` (R: the region names; `next` gated off). Mixed sides and the empty mapping are uncovered here.

### DEF-20 · A mapped region opens below the profile with its name in focus
- **Rule:** Pressing a mapped region opens it as a listed region (CTRL-26). Once drawn, the region inspector's name takes focus and is brought to the top of the detail view.
- **Kind:** behaviour
- **Level:** browser — focus and scroll position
- **Source:** `viewer/ui/panels/clinical.js:22-29,441-447`
- **Expected:** Aphasia, "Open region: Middle temporal gyrus…" → the region `destrieux:left:38` opened; focus on the region title, its top within 2 px of the detail view's top.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R; the region is checked on the controller's call log); `e2e/parity/deficits.spec.ts` (R; `next` gated off)

### DEF-21 · While a run is in flight, region buttons and Restore stay focusable and refuse
- **Rule:** While any run is in flight, region buttons and Restore carry `aria-disabled="true"`, stay focusable, ignore presses and draw as unavailable; the meta line says why. Restore uses the tertiary ink, and `GrayText` in forced colours.
- **Kind:** accessibility
- **Level:** browser — focus and computed colour
- **Source:** `viewer/ui/panels/clinical.js:389-391,445,455`; deviation `x2-aria-disabled-while-opening.md`
- **Expected:** Amnesia held → the first region button `aria-disabled="true"`, `disabled` false, focusable; a press opens no region; released → no `aria-disabled`. Restore held → `aria-disabled="true"`, meta "Restoring the previous view…", colour = `--text-tertiary` (`GrayText` forced), a second press runs no second restore, focus stays.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R)

### DEF-22 · Each Evidence summary names its association
- **Rule:** Each association's evidence sits behind a closed disclosure whose summary reads "Evidence" followed by a visually hidden ", <association title>", so the names differ and the visible word begins each.
- **Kind:** accessibility
- **Level:** browser — accessible names
- **Source:** `viewer/ui/panels/clinical.js:150-161`; deviation `x2-evidence-summary-name.md`
- **Expected:** Neglect → 5 summaries, names unique, each `^Evidence, `; the first text node "Evidence"; French `^Données probantes, `. A summary opens and closes the evidence, which holds "Reported finding", "Interpretation", "Approximate anatomical mapping" and "Publications · <n>" headings.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R); `e2e/parity/deficits.spec.ts` (R: open and close, "Reported finding"; `next` gated off)

### DEF-23 · Opened evidence survives a language change and closes for another deficit
- **Rule:** A disclosure the reader opened stays open when the language changes and starts closed again when another deficit is opened, coming back included.
- **Kind:** behaviour
- **Level:** browser — `<details>` state across renders
- **Source:** `viewer/ui/panels/clinical.js:272-273,449-454,523`
- **Expected:** Neglect, open the first → open; language `fr` → heading "Négligence spatiale", still open, summary `^Données probantes, `; Aphasia then Neglect → closed.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R)

### DEF-24 · Publications link out in a new tab, say so, and mark English text
- **Rule:** Each publication names its role and method, links its title to the DOI and its PubMed id to PubMed, both in a new tab with `rel="noreferrer"`, and says in words that the link opens a new tab, with an icon hidden from assistive technology. In a French interface the English title and the authors line are marked `lang="en"`. Published corrections follow with their DOI link.
- **Kind:** accessibility
- **Level:** browser — `lang` and link attributes
- **Source:** `viewer/ui/panels/clinical.js:80-112`; deviation `x2-external-links.md`; decision 17 on #4
- **Expected:** the title link `href` `^https://doi.org/`, `target="_blank"`, text containing "(opens in a new tab)", `svg[aria-hidden=true]`, no `[lang]` in English; in French "(s’ouvre dans un nouvel onglet)", a `span[lang=en]` inside, an authors `p.note[lang=en]`. PubMed link "PubMed · <pmid>" → `https://pubmed.ncbi.nlm.nih.gov/<pmid>/`. A correction → "Correction published", its summary, a "doi:<doi>" link.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R); `e2e/parity/deficits.spec.ts` (R: DOI and PubMed links; `next` gated off). Corrections are uncovered here (`publishedCorrections` is in `core-panels.md`).

### DEF-25 · A checked map opens that function
- **Rule:** Each activation map the evidence checks is a row with its colour and name; pressing it opens that function through the Functions tab's entry point.
- **Kind:** behaviour
- **Level:** browser — the press
- **Source:** `viewer/ui/panels/clinical.js:211-225,341-350,442-443`
- **Expected:** Aphasia with `checkedMaps` [language] → a button "Language"; press → the Functions entry point called with `language`.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R; `checkedMaps` is a stub; the real list is CTRL-33)

### DEF-26 · The profile's sections are not landmarks
- **Rule:** The profile's inner sections carry no accessible name of their own; their headings title them. The workspace's tab panel holds the profile.
- **Kind:** accessibility
- **Level:** browser — roles
- **Source:** `viewer/ui/panels/clinical.js:335-346`; `index.html:339,417`; deviation `x2-section-landmarks.md`; decision 13 on #4
- **Expected:** no `.clinical-profile section[aria-labelledby]` and no `section[aria-label]`.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R)

## Restore

### DEF-27 · Restore is offered with an open deficit and returns focus to its row
- **Rule:** "Restore previous view" stands in the location bar's trailing slot while a deficit is open on the Deficits tab and an earlier scene is held. Pressing it puts the scene back (CTRL-27) and puts focus on the row of the deficit just left, or on the field when that row is not listed. A failure says so on the meta line in the error style and keeps focus on Restore.
- **Kind:** behaviour
- **Level:** browser — focus
- **Source:** `viewer/ui/panels/clinical.js:230-236,314-319,391`
- **Expected:** nothing open → no Restore; no held scene → no Restore. Aphasia open → Restore; press → the scene put back, focus on the Aphasia row. Restore rejects "boom" → meta "The previous view could not be fully restored.", class `error`, the reload offer hears "boom", focus on Restore. The field fallback is uncovered.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R); `e2e/parity/deficits.spec.ts` (R; `next` gated off)

## Related deficits

### DEF-28 · A selected region lists the deficits mapped on it or on anatomy it shares
- **Rule:** The region inspector's "Neuropsychology" section lists each deficit mapped on the selected region or on a region it shares anatomy with, once each, with its name and domain. It is not shown, nor titled, when there are none. It is not a landmark. Pressing a row opens that deficit's profile with its heading in focus.
- **Kind:** behaviour
- **Level:** unit (view-model) for the list; browser for the hand-off
- **Source:** `viewer/ui/panels/clinical.js:51-61,206-209,370-386`
- **Expected:** select `destrieux:left:38` → section shown, `h3` "Neuropsychology", no `aria-labelledby`, a row "Aphasia"; press → Aphasia opened, focus on its heading. `destrieux:left:-1` → section hidden.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R); `e2e/parity/deficits.spec.ts` (R; `next` gated off)

## Language and accessibility checks

### DEF-29 · The tab is French in French
- **Rule:** In French the list, the profile, the meta line and the evidence use the French copy.
- **Kind:** behaviour
- **Level:** browser
- **Source:** `viewer/clinical/translations.js`
- **Expected:** Aphasia → heading "Aphasie", "Données lésionnelles et cliniques · 6 associations", summary "Données probantes"; meta "Hémisphère gauche · …"; Neglect → "Négligence spatiale".
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R); `e2e/parity/deficits.spec.ts` (R; `next` gated off)

### DEF-30 · axe finds nothing in the list or in a profile with its evidence open
- **Rule:** The list, a profile with every evidence disclosure open, and the French list after a search have no axe violations, in both themes, at 1280 and 390 px.
- **Kind:** accessibility
- **Level:** browser — axe
- **Source:** decision record #57
- **Expected:** `expectAxeClean()` → no violations, Neglect open; then French and "mém".
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R); `e2e/parity/deficits.spec.ts` (R; `next` gated off)

### DEF-31 · At 200 % text, or with WCAG 1.4.12 spacing, nothing overflows or clips
- **Rule:** With the root font at 200 %, or with the 1.4.12 spacing, neither column scrolls sideways and no button, summary or field clips its text.
- **Kind:** accessibility
- **Level:** browser — layout
- **Source:** WCAG 2.2 SC 1.4.4, 1.4.12
- **Expected:** each `.rail` `scrollWidth ≤ clientWidth`; each `button, summary, input` `scrollHeight ≤ clientHeight + 1`.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R)

### DEF-32 · With a coarse pointer every target is 44 px tall
- **Rule:** With a coarse pointer, every visible button, summary, search field and link in the list and the profile is at least 44 px tall (the location bar sizes its own trailing button).
- **Kind:** accessibility
- **Level:** browser — layout
- **Source:** WCAG 2.2 SC 2.5.5; decision record #57
- **Expected:** touch emulation, Neglect open, query "a" → more than 10 targets, each height ≥ 43.5 px.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R)

### DEF-33 · In forced colours the focused heading keeps the highlight ring and Restore reads as a link
- **Rule:** With forced colours, a heading focused after a key press shows its focus ring in `Highlight`, and Restore takes `LinkText`.
- **Kind:** accessibility
- **Level:** browser — computed CSS
- **Source:** `viewer/styles/a11y.css:55-56,87`; decision 38 on #4
- **Expected:** `forced-colors: active` → Restore colour = `LinkText`; Shift, focus the heading → `:focus-visible`, `outline-color` = `Highlight`.
- **Covered by:** `src/features/deficits/deficits.svelte.test.ts` (R)
