# Provenance rules

Scope: chunk H4 (#42), the Provenance sheet: what the loaded anatomy's own published records say about where it came from, shown in a native modal dialog opened from the colophon (COLO-05) or, on a phone, from the ⋯ menu (MAST-19). It covers the rows the sheet builds (the C5 view-model `provenanceRows`/`referenceRows`, here because they are what the reader reads) and the dialog's behaviour. Mounting it, and passing the manifest, the domains and the tract reference, is I3b's (`regions.md`, REGION-05 and REGION-18). Legacy sources: `viewer/ui/panels/provenance.js`, `viewer/ui/panels/provenance.test.js`, the root `index.html:689-697`, `viewer/styles/dialogs.css:112-133`, `viewer/ui/chrome/header.js:423-425, 543-549`. New code: `web/src/features/provenance/ProvenanceDialog.svelte`, `web/src/lib/core/panels/provenance.ts`, U5's `web/src/lib/ui/Dialog.svelte`. Deviations: `h4-initial-focus.md`, `h4-lang-of-parts.md`, `h4-rerender-focus.md`. Decision 17 on #4 (external links), decision record `0008-dialog-mount-points.md`.

The data values below come from the published `public/models/cdmd/manifest.json`: subject "MGH CDMD “sub_013”", `individual: true`, source `https://doi.org/10.6084/m9.figshare.c.5315474.v1`, reconstruction `freesurfer-macOS-darwin_arm64-8.2.0-20260314-d932c45`, HCP-MMP projected from `fsaverage`, atlases `destrieux` and `hcp-mmp`, networks, CAB-NP, functional divisions, neuropsychological domains, one supplemental layer (`zanatomy`), and 39 source files, all with a SHA-256. Domain checks come from `public/models/cdmd/neuropsych-domains.json`. Copy quoted is the English interface text unless marked FR.

## What the sheet says

### PROV-01 · The sheet has one row per published record, and no empty rows

- **Rule:** The sheet lists, in order, the rows the loaded manifest has data for: Subject, Source data, Reconstruction, Cortical atlases, Functional networks, Functional divisions, Neuropsychological domains, Supplemental layers, Published files. A field the manifest does not publish leaves no row, and nothing is invented. Without the `individual` flag, no kind is claimed.
- **Kind:** data
- **Level:** unit (view-model over the published manifest)
- **Source:** `provenance.js:29-99`; `provenance.test.js:41-45`
- **Expected:** for `cdmd` with both URLs: labels `Subject, Source data, Reconstruction, Cortical atlases, Functional networks, Functional divisions, Neuropsychological domains, Supplemental layers, Published files`. `{anatomy:{display_name:'X “1”'}}` in `fr` → labels `['Sujet']` and the item's note is `null`. `provenanceRows({})` → `[]`. Supplemental layers: "Z-Anatomy spinal cord reference" with the note "CC BY-SA 4.0 · Z-Anatomy, after BodyParts3D (CC BY-SA 2.1 JP)". Licence links resolve beside the manifest: `/neuroatlas/models/cdmd/../licenses/CAB-NP.txt` and `…/../licenses/HCP-Data-Use-Terms.txt`.
- **Covered by:** `src/lib/core/panels/provenance.test.ts` (R, `PROV-01`: the empty case and the full `cdmd` label list, supplemental note and licence links)

### PROV-02 · Every link comes from the published records

- **Rule:** Each link in the sheet is a URL the manifest publishes, or a licence file it publishes beside itself, or the manifest and index URLs themselves.
- **Kind:** data
- **Level:** unit (view-model over the published manifest)
- **Source:** `provenance.js:47-58, 89-97`; `provenance.test.js:12-28`
- **Expected:** every `href` is in `manifest.json`, or is `/neuroatlas/models/cdmd/` + a published relative path, or is `/neuroatlas/models/cdmd/manifest.json` or `/neuroatlas/models/anatomies.json`. The CAB-NP and HCP-MMP `license_file` links, `anatomy.source_url` and both URLs are present.
- **Covered by:** `src/lib/core/panels/provenance.test.ts` (S)

### PROV-03 · The sheet names the subject, its reconstruction, every citation and the source files

- **Rule:** The sheet names the subject and its kind, the reconstruction, each atlas with its citation, each functional-division citation, and how many source files the manifest lists and whether each has a checksum.
- **Kind:** data
- **Level:** unit (view-model over the published manifest)
- **Source:** `provenance.js:43-48, 53-58, 65-69, 89-97`; `provenance.test.js:30-39`
- **Expected:** Subject "MGH CDMD “sub_013”" with the note "One individual’s MRI reconstruction". Reconstruction `freesurfer-macOS-darwin_arm64-8.2.0-20260314-d932c45`, set in mono. Each `atlases[].citation` and each `functional_regions.citations[]` is linked. Published files: `manifest.json` with the note "39 source files, each with a SHA-256 checksum" (FR "39 fichiers sources, chacun avec une somme SHA-256"), then `anatomies.json` with the note "Index of the published anatomies".
- **Covered by:** `src/lib/core/panels/provenance.test.ts` (S; R `PROV-03` pins the subject, reconstruction and the source-file note in both languages)

### PROV-04 · HCP-MMP says where it was projected from

- **Rule:** The HCP-MMP atlas carries a note naming the template it was projected from, when the anatomy publishes one.
- **Kind:** data
- **Level:** unit (view-model)
- **Source:** `provenance.js:53-57`
- **Expected:** `cdmd` → the HCP-MMP item's note is "Projected from fsaverage" (FR "Projeté depuis fsaverage"); Destrieux has no note.
- **Covered by:** `src/lib/core/panels/provenance.test.ts` (R, `PROV-04`)

### PROV-05 · Each neuropsychological domain says how its lesion evidence was checked

- **Rule:** When the domain data is loaded, each domain names its term and lists every lesion check: the deficit, its references, and how much of each lesion-mapped parcel the domain's coloured areas cover, with the side. A parcel off the surface is "not measured". A domain no study checks says so.
- **Kind:** scientific
- **Level:** unit (view-model over `neuropsych-domains.json`)
- **Source:** `provenance.js:10-27, 70-82`
- **Expected:** `executive` → text "Executive functions: “executive function”" and a note starting "Lesion check: Executive dysfunction (Gläscher et al. 2012): G_front_middle (L) 13% coloured, G_front_middle (R) 18% coloured" (coverages 0.127 and 0.183, rounded to whole percents). A mapping with `coverage: null` → "<parcel> (<side>), not measured". A domain with no checks → "No lesion study in Planum’s deficit evidence checks this domain." Pain's NextBrain parcels → "caudal_division_of_ventral_posterior_lateral_nucleus (L), not measured". French uses the side glyphs G/D/Méd and "colorée à 13 %". 26 of the 70 published domains have no check.
- **Covered by:** `src/lib/core/panels/provenance.test.ts` (R, `PROV-05`, over the published `neuropsych-domains.json`)

### PROV-06 · Labels are translated; the published data is not

- **Rule:** Row labels and notes are in the interface language. The published values (names, reconstruction, licences, URLs) are shown as published.
- **Kind:** behaviour
- **Level:** unit (view-model)
- **Source:** `provenance.test.js:47-55`
- **Expected:** `en` and `fr` have the same number of rows. First label "Subject" / "Sujet", files "Published files" / "Fichiers publiés". The reconstruction text is identical in both languages.
- **Covered by:** `src/lib/core/panels/provenance.test.ts` (R; the labels are checked with `notDeepEqual` only, which is weak)

### PROV-07 · A tract reference lists its own sources, not the hidden anatomy

- **Rule:** While the tract reference is shown, the sheet lists that reference, then its own source links. The anatomy behind it is not listed. With no source links there is no Sources row.
- **Kind:** behaviour
- **Level:** unit (view-model `referenceRows`); browser for the in-place swap (PROV-15)
- **Source:** `provenance.js:101-108`; `provenance.test.js:57-61`; `header.js:543-549`
- **Expected:** `{label:'SNAIL reference', links:[{href:'https://example.org/a', text:'A'}]}` → rows "Tract reference" `[{text:'SNAIL reference'}]` and "Sources" `[{link:…}]` (FR "Référence des faisceaux", "Sources"). `links: []` → one row.
- **Covered by:** `src/lib/core/panels/provenance.test.ts` (R); `src/features/provenance/provenance.svelte.test.ts` (R)

### PROV-08 · URLs read without their scheme; files are named by their file name

- **Rule:** A link's text is its URL without the scheme or a trailing slash. Licence files and published files are set in mono and named by their file name. An item that is only a link shows the link first, with its note under it. Beside a name, the link is the citation under the name.
- **Kind:** behaviour
- **Level:** unit (view-model) for the text; browser for the order of elements
- **Source:** `provenance.js:5-8, 49-52, 110-134`; `provenance.test.js:63-66`
- **Expected:** `https://doi.org/10.1/x` → `doi.org/10.1/x`; `https://www.z-anatomy.com/` → `www.z-anatomy.com`. CAB-NP licence link text = the last segment of `license_file`, mono. Under Published files the first child of each item is an `A` ("manifest.json", "anatomies.json") and the second a `.provenance-note`. `ftp://x/` → `ftp://x` (only the http and https schemes are dropped).
- **Covered by:** `src/lib/core/panels/provenance.test.ts` (R, `shortUrl`); `src/features/provenance/provenance.svelte.test.ts` (R, element order)

### PROV-09 · The sheet ends with the intended use

- **Rule:** Below the facts, the sheet states that Planum is for research and education, not a medical device.
- **Kind:** behaviour
- **Level:** browser: text in the dialog (one fixed string)
- **Source:** `provenance.js:152`; `index.html:697`
- **Expected:** "For research and education. Planum is not a medical device and must not be used for diagnosis, treatment or any other clinical decision." FR "Pour la recherche et l’enseignement. Planum n’est pas un dispositif médical et ne doit pas servir au diagnostic, au traitement ni à aucune autre décision clinique." It is not marked `lang="en"` in French.
- **Covered by:** `e2e/parity/provenance.spec.ts` (R, "is not a medical device" and the French start; `next` gated off); `src/features/provenance/provenance.svelte.test.ts` (R, the `lang` part only)

## The dialog

### PROV-10 · A modal dialog named Provenance, with a title and Close

- **Rule:** The sheet is a native modal dialog named by its level-2 title "Provenance", with a Close button.
- **Kind:** accessibility
- **Level:** browser: roles
- **Source:** `index.html:689-697`; decision record `0008-dialog-mount-points.md`
- **Expected:** `dialog` named "Provenance" with `heading` level 2 "Provenance"; button "Close" (FR "Fermer"); `dialog.open` after opening.
- **Covered by:** `src/features/provenance/provenance.svelte.test.ts` (R); `e2e/parity/provenance.spec.ts` (R; `next` gated off)

### PROV-11 · Opening focuses the title, not Close

- **Rule:** On open, focus goes to the dialog's title, so the list starts in view and a screen reader reads the name, then the content. Close is the first Tab stop after it.
- **Kind:** accessibility
- **Level:** browser: focus
- **Source:** deviation `h4-initial-focus.md`; legacy `provenance.js:163-169` (focused Close)
- **Expected:** after a keyboard open, `document.activeElement` is the `h2`. One Tab → Close.
- **Covered by:** `src/features/provenance/provenance.svelte.test.ts` (R, the title; "Close is next" is implied by the Tab-loop case); `e2e/parity/provenance.spec.ts` (R, `next` branch; `next` gated off)

### PROV-12 · A keyboard open and close are instant; a pointer open and Close animate

- **Rule:** Opening or closing from the keyboard (Enter, Escape, Enter on Close) shows or removes the dialog at once. A pointer open, and a pointer press on Close, animate.
- **Kind:** behaviour
- **Level:** browser: keyboard versus pointer activation
- **Source:** `provenance.js:163-174`; `provenance.test.js:68`
- **Expected:** pointer open → no `data-instant`; keyboard open → `data-instant`; Escape → closed with `data-instant`; pointer Close → closed without `data-instant`, focus on the opener; Enter on Close → closed with `data-instant`.
- **Covered by:** `src/features/provenance/provenance.svelte.test.ts` (R, 3 cases); `e2e/parity/provenance.spec.ts` (R; `next` gated off)

### PROV-13 · Focus stays in the dialog while it is open

- **Rule:** Tab and Shift+Tab move among Close and the links and never reach the page behind. Past the last control a native modal may hand focus to the browser's own UI, never to the page.
- **Kind:** accessibility
- **Level:** browser: real Tab order
- **Source:** APG Dialog (Modal); HTML `showModal()`
- **Expected:** for `links + 3` Tabs and 3 Shift+Tabs, `activeElement` is `body` or inside the dialog; Close and every link are reached.
- **Covered by:** `src/features/provenance/provenance.svelte.test.ts` (R); `e2e/parity/provenance.spec.ts` (R, 40 Tabs; `next` gated off)

### PROV-14 · Escape closes and returns focus; the page's keys never reach the page

- **Rule:** Escape closes the dialog instantly and returns focus to the button that opened it. While the dialog is open, no key reaches the page: Escape does not clear the selection and letters do not change the view. Keys that scroll the sheet are not cancelled.
- **Kind:** behaviour
- **Level:** browser: keyboard dispatch
- **Source:** `provenance.js:175-176, 177-181`
- **Expected:** with a `window` keydown listener, `v` then Escape → the listener sees nothing; dialog closed; focus on the opener. ArrowDown inside → `defaultPrevented === false`.
- **Covered by:** `src/features/provenance/provenance.svelte.test.ts` (R, 2 cases); `e2e/parity/provenance.spec.ts` (R, focus return; `next` gated off)

### PROV-15 · When the opener is gone by the time it closes, focus goes to More settings

- **Rule:** If the button that opened the dialog is no longer shown when it closes, as with the phone menu's item once the menu has closed, focus goes to the ⋯ More settings button.
- **Kind:** accessibility
- **Level:** browser: focus
- **Source:** `provenance.js:177-181`; `header.js:423-425`
- **Expected:** open from the keyboard, hide the colophon, Escape → focus on the fallback ("More" in the fixture, "More settings" in the app). On a 390 px phone: More settings → Provenance → Escape → focus on More settings.
- **Covered by:** `src/features/provenance/provenance.svelte.test.ts` (R); `e2e/parity/provenance.spec.ts` "Provenance opens from the ⋯ menu" (R; `next` gated off)

### PROV-16 · A change while open re-labels in place, and focus is kept or handed to the title

- **Rule:** A language change or a new tract reference while the dialog is open updates the rows in place. A focused link that still exists keeps focus. If the focused link is gone, focus moves to the title, not to the page.
- **Kind:** accessibility
- **Level:** browser: focus across a re-render
- **Source:** deviation `h4-rerender-focus.md`; legacy `provenance.js:154, 193-199` (replaced every row)
- **Expected:** focus the first link, switch to `fr` → the first `dt` is "Sujet", the button is "Fermer", and the same link node is still focused. Focus a link, pass a reference with one link → focus stays in the dialog, links `['https://example.org/tracts']`. Pass a reference with no links → no links, focus on the title.
- **Covered by:** `src/features/provenance/provenance.svelte.test.ts` (R, 2 cases)

### PROV-17 · In French, published English data is marked as English

- **Rule:** With the interface in French, each value the sheet does not translate carries `lang="en"`: subject, reconstruction, atlas, network and layer labels, licence names. Translated labels and notes, the intended use and a French tract-reference label are not marked. In English nothing is marked. URLs and file names are not marked.
- **Kind:** accessibility
- **Level:** browser: the `lang` attribute in the rendered DOM (the "identical in both languages" test is a pure function that could be unit)
- **Source:** deviation `h4-lang-of-parts.md`; WCAG 2.2 SC 3.1.2
- **Expected:** `en` → the reconstruction has no `lang`. `fr` → the reconstruction and the subject value have `lang="en"`; the note "Reconstruction IRM d’un individu" has none; `.provenance-use` has none. French reference `{label:'Référence'}` → no `[lang]` in the dialog.
- **Covered by:** `src/features/provenance/provenance.svelte.test.ts` (R, 2 cases); `e2e/parity/provenance.spec.ts` (R, `next` branch: some `[lang="en"]`; `next` gated off)

### PROV-18 · External links open in a new tab and say so

- **Rule:** Every link to a source opens in a new tab without a referrer. It says so with visually hidden text and an icon (WCAG technique G201).
- **Kind:** accessibility
- **Level:** browser: accessible name
- **Source:** `provenance.js:126-129` (`target="_blank"`, `rel="noreferrer"`); decision 17 on #4 (H4, C1); string `link.newTab`
- **Expected:** each `a` in the dialog has `target="_blank"` and `rel="noreferrer"`. Its accessible name ends with "(opens in a new tab)" (FR "(s’ouvre dans un nouvel onglet)").
- **Covered by:** `e2e/parity/provenance.spec.ts` (R, `target` on the first link only; `next` gated off). The new-tab cue is uncovered and **not implemented**: `ProvenanceDialog.svelte` renders the link text alone, though `ExternalLink.svelte`, `AtlasComparison.svelte` and `TractsExplorer.svelte` already add `link.newTab`.

### PROV-19 · A focused link scrolls clear of the sticky header on a phone

- **Rule:** On a phone, a link that takes focus is never hidden under the dialog's sticky header (WCAG 2.4.11).
- **Kind:** accessibility
- **Level:** browser: layout
- **Source:** WCAG 2.2 SC 2.4.11
- **Expected:** at 390×844, for each link: after `focus()`, `link.top ≥ .dialog-header.bottom`.
- **Covered by:** `src/features/provenance/provenance.svelte.test.ts` (R)

### PROV-20 · The facts reflow and do not spill

- **Rule:** On a wide window the facts are a two-column term and definition list. On a phone they stack in one column. At 200 % text with the WCAG 1.4.12 spacing, no label or note spills and the dialog does not scroll sideways, in English or French, at 1280 or 320 px.
- **Kind:** accessibility
- **Level:** browser: layout
- **Source:** `viewer/styles/dialogs.css:112-133, 289-294`; WCAG 2.2 SC 1.4.10, 1.4.12
- **Expected:** 1280 px → `grid-template-columns` `148px` plus the rest; 390 px → one column. At 200 %, every `dt`, `dd` and `.provenance-note` has `scrollWidth ≤ clientWidth + 0.5`, and the dialog `scrollWidth ≤ clientWidth`.
- **Covered by:** `src/features/provenance/provenance.svelte.test.ts` (R, the spill part; the column change is uncovered)

### PROV-21 · Reduced motion and forced colours

- **Rule:** With reduced motion the dialog does not scale. In forced colours it keeps a visible border.
- **Kind:** accessibility
- **Level:** browser: CSS computed style under emulated media
- **Source:** U5 Dialog styles; `viewer/styles/a11y.css`
- **Expected:** `prefers-reduced-motion: reduce` → `transform: none`; `forced-colors: active` → `border-top-style` is not `none`.
- **Covered by:** `src/features/provenance/provenance.svelte.test.ts` (R)

### PROV-22 · The open dialog passes axe

- **Rule:** The open dialog has no axe violations in either theme, on desktop or a phone, in English or French, and with a tract reference.
- **Kind:** accessibility
- **Level:** browser: axe
- **Source:** #4 parity proof
- **Expected:** zero violations (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`).
- **Covered by:** `src/features/provenance/provenance.svelte.test.ts` (R, a 3-state × 2-theme × 2-width matrix: 12 axe runs); `e2e/parity/provenance.spec.ts` (legacy baseline; `next` gated off)
