# Colophon rules

Scope: chunk H4 (#42), the colophon: the status bar at the foot of a wide window. It holds the not-clinical statement, a description of what is loaded, the region or bundle count, and the Provenance opener. The dialog it opens is in `provenance.md`. What feeds it (status, the tract reference, whether the data bar shows a download) is the composition's (`regions.md`). Legacy sources: the root `index.html:592-597`, `viewer/ui/chrome/header.js:78-90, 536-542`, `viewer/styles/masthead.css:453-492`, `viewer/styles/phone.css:48-49`, `viewer/ui/chrome/chrome.contract.test.js:283-303`. New code: `web/src/features/colophon/{Colophon.svelte,region-count.ts}`, `colophonParts` in `web/src/lib/core/panels/header.ts`, the coarse-pointer `--footer-height` rule in `web/src/app/layout.css`. Deviation: `h4-coarse-target.md`.

Copy quoted is the English interface text unless marked FR. English sets a percent close up ("25%"). French puts a narrow no-break space before it ("25 %").

## Content

### COLO-01 · The status bar opens with the not-clinical statement, which never gives way

- **Rule:** The status bar reads, in order: the statement that this is not clinical anatomy, the description of what is loaded, the count, then the Provenance button. The statement never truncates. The description is what gives way, with an ellipsis.
- **Kind:** behaviour
- **Level:** browser: text order and layout (truncation)
- **Source:** `index.html:592-596`; `chrome.contract.test.js:283-296` (the statement leads, ahead of the description that truncates); `viewer/styles/masthead.css:453-492`
- **Expected:** text "Not clinical anatomy Bert · one individual’s MRI reconstruction 12 visible regions Provenance" (FR statement "Pas une anatomie clinique"). With a description wider than the bar, the statement's `scrollWidth === clientWidth` and the description has `text-overflow: ellipsis` with `scrollWidth > clientWidth`.
- **Covered by:** `src/lib/core/panels/header.test.ts` (R, `COLO-01`: the statement in each language and state); `src/features/provenance/provenance.svelte.test.ts` (R, order and the French statement); `e2e/parity/provenance.spec.ts` (R; `next` since #64); truncation is uncovered

### COLO-02 · The description names what is loaded, as the masthead names it

- **Rule:** The description names the subject as the masthead names it (MAST-28), then what kind of anatomy it is. A tract reference is named as reference data. Before anything has loaded there is no description, and the statement stays in every state.
- **Kind:** behaviour
- **Level:** unit (view-model `colophonParts`)
- **Source:** `header.js:78-84`; `chrome.contract.test.js:283-296`
- **Expected:** `{display_name:'SNAIL “subj_1”', individual:true}` → "SNAIL subj_1 · one individual’s MRI reconstruction" (FR "SNAIL subj_1 · reconstruction IRM d’un individu"). `individual:false` → "… · averaged reference template" (FR "gabarit de référence moyenné"). `reference {label:'Ref'}` → "Ref · reference data" (FR "Ref · données de référence"). Nothing loaded → `''`. Statement "Not clinical anatomy" / "Pas une anatomie clinique" in all three cases. The published build shows "MGH CDMD sub_013 · one individual’s MRI reconstruction".
- **Covered by:** `src/lib/core/panels/header.test.ts` (R, `COLO-02`: the exact description for an individual, a template and a reference, in both languages); `src/features/provenance/provenance.svelte.test.ts` (R); `e2e/parity/provenance.spec.ts` (R, regex; `next` since #64)

### COLO-03 · The count says how many regions are visible, in each language's plural

- **Rule:** On the anatomy the count is the number of regions drawn, said to be the visible ones, with the right plural. In Tracts mode it names the bundles instead, whatever is loading. Before the first model is ready there is no count.
- **Kind:** behaviour
- **Level:** unit (`regionCountText`)
- **Source:** `header.js:537-541`; `chrome.contract.test.js:298-303`
- **Expected:** 1 → "1 visible region"; 3 → "3 visible regions"; 228 → "228 visible regions"; FR 3 → "3 régions visibles", 1 → "1 région visible". Tracts text "72 bundles" with status `switching` → "72 bundles". Status `loading` → `''`.
- **Covered by:** `src/features/colophon/region-count.test.ts` (R); `e2e/parity/provenance.spec.ts` (R, `/\d+ visible regions?/`; `next` since #64)

### COLO-04 · A download the data bar is not showing is shown in the count

- **Rule:** While a download runs that the data bar is not already showing in one of its fields (a link, or a command from elsewhere), the count shows its progress. When a data-bar field holds the pending choice, the count keeps counting regions.
- **Kind:** behaviour
- **Level:** unit (`regionCountText`); the `choosing` flag comes from the data bar through the composition (REGION-17)
- **Source:** `header.js:537-541`
- **Expected:** status `switching`, progress 1/4, `choosing:false` → "Loading 25%" (FR "Chargement 25 %"); no total → "Loading…". `choosing:true` → "3 visible regions".
- **Covered by:** `src/features/colophon/region-count.test.ts` (R; the progress case only matches `/25/`)

## The opener and the bar

### COLO-05 · The Provenance button opens a dialog, once one can be opened

- **Rule:** The status bar ends with a "Provenance" button that says it opens a dialog. It is there only when the page can open the sheet. Legacy shipped it hidden until boot.
- **Kind:** accessibility
- **Level:** browser: role and attribute
- **Source:** `index.html:595`; `chrome.contract.test.js:311-315` (a dialog, not a raw JSON file); `viewer/ui/panels/provenance.js:183-186`
- **Expected:** button "Provenance" (FR "Provenance") with `aria-haspopup="dialog"`. With no opener supplied, no button.
- **Covered by:** `src/features/provenance/provenance.svelte.test.ts` (R for the name and attribute; I for "only when the owner supplies an opener", a component-prop contract); `e2e/parity/provenance.spec.ts` (R; `next` since #64)

### COLO-06 · The Provenance target is 24 px on a fine pointer and 44 px on a coarse one

- **Rule:** With a fine pointer the status bar is 32 px tall and the button 24 px. With a coarse pointer, at any width, the bar is 45 px: a 1 px rule above a 44 px button that fills it. The page does not scroll because of it.
- **Kind:** accessibility
- **Level:** browser: layout under touch emulation
- **Source:** deviation `h4-coarse-target.md`; legacy `viewer/styles/masthead.css` (`#provenance` 24 px at every width)
- **Expected:** fine pointer at 1280×800 → button height 24. Touch emulation at 1180×820 inside `#app` → footer height 45, button height 44, button top = footer top + 1, `elementFromPoint` inside the button hits it, `scrollHeight ≤ clientHeight`.
- **Covered by:** `src/features/provenance/provenance.svelte.test.ts` (R, 2 cases)

### COLO-07 · The status bar is a plain footer, not a live region

- **Rule:** The status bar is the page's `contentinfo` landmark and is not live. Its count changes are visual; mode and selection changes are said by the announcer.
- **Kind:** accessibility
- **Level:** browser: roles
- **Source:** `index.html:592`; `web/src/features/colophon/Colophon.svelte` header note
- **Expected:** `footer#colophon` is the one `contentinfo`; neither it nor any descendant has `role="status"` or `aria-live`.
- **Covered by:** uncovered (the footer's presence only, in `provenance.svelte.test.ts`)

### COLO-08 · On a phone the status bar gives way

- **Rule:** Under the phone query the status bar is hidden. The statement moves to the sheet's grip and Provenance to the ⋯ menu.
- **Kind:** behaviour
- **Level:** browser: CSS computed style
- **Source:** `viewer/styles/phone.css:48-49`; the sheet's statement is SHEET's, the menu item MAST-19
- **Expected:** 390×844 → `#colophon` `display: none`; no `contentinfo` in the accessibility tree.
- **Covered by:** `src/app/App.svelte.test.ts` (R, the real footer at 390 px); `e2e/parity/provenance.spec.ts` "on a phone the status bar gives way" (R; `next` since #64); `e2e/parity/shell.spec.ts` (R; `next` since #64)
