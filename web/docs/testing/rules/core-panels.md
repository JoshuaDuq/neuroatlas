# Core panels rules

Scope: chunk C5 (#23), the panel view-models in `web/src/lib/core/panels/` (navigator, clinical,
inspector, circuits, related, header, provenance) and the async runners in
`web/src/lib/core/async/latest.ts`. These are the pure parts of the panels: what the panels and
the masthead print and how they order, name and qualify things, computed without the DOM. The
components that show them are in the feature catalogues (`anatomy.md`, `deficits.md`,
`functions.md`, `circuits.md`, `inspector.md`, `masthead.md`, `colophon.md`, `provenance.md`).
Legacy sources: `viewer/ui/panels/{navigator,clinical,inspector,circuits,related,provenance,visibility-control,functions,atlas-comparison}.js`,
`viewer/ui/chrome/header.js`. Deviations: `c5-match-highlight-offsets.md`. Copy quoted is the
English interface text; French is given where the rule is about the language. Published values
are from `public/models/cdmd/` and `data/neuropsychology.yaml`.

## Navigator: the tree and search

### PANEL-01 · An arrow key moves past rows that cannot be chosen, and stops at the ends

- **Rule:** In the search results, an arrow arms the next row that can be chosen, skipping disabled ones. Past either end, or with no row to reach, the armed row stays where it is. From the search field (no row armed) the first arrow lands on the first choosable row.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/navigator.js:44-54`
- **Expected:** `nextEnabledIndex([false,true,false], 0, 1)` = 2; `(…, 2, -1)` = 0; `([false,true], 0, 1)` = 0; `([true,false], 1, 1)` = 1; `([false], 0, -1)` = 0; `([true,false,false], -1, 1)` = 1; delta 0 or an empty list → the index given.
- **Covered by:** `src/lib/core/panels/navigator.test.ts` (R, `PANEL-01`: delta 0 and the empty list)

### PANEL-02 · A group name says which vocabulary it is from only when two share it

- **Rule:** Structures and tissue regions are grouped by system, HCP-MMP areas by network, other cortex by lobe. A group name used by two vocabularies at once, such as Limbic, is qualified with its vocabulary; any other name is shown as the atlas gives it. Two families in one vocabulary are not a clash.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/navigator.js:56-76`
- **Expected:** Limbic (lobe) beside Limbic (system) → shared `['Limbic']`; "Limbic lobe", "Limbic network", "Limbic system"; Frontal stays "Frontal". fr: "Lobe limbique", "Système limbique". Limbic in a structure group and a tissue-region group → no shared name.
- **Covered by:** `src/lib/core/panels/navigator.test.ts` (R)

### PANEL-03 · Groups are sorted by the name the list shows, within each family

- **Rule:** Families keep the order they are met in; within a family, groups are sorted by their shown, qualified name in the reader's language.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/navigator.js:77-86`
- **Expected:** fr, cortex Insula and Limbique, structures Cervelet, Limbique, Tronc cérébral → `Insula, Lobe limbique, Cervelet, Système limbique, Tronc cérébral`.
- **Covered by:** `src/lib/core/panels/navigator.test.ts` (R)

### PANEL-04 · A region's group is the one the tree lists it under, named as the tree shows it

- **Rule:** Revealing a region in the tree opens the group that lists it, under the name the tree shows; a region the tree does not list has no group.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/navigator.js:87-95`
- **Expected:** `c` in Frontal → `{ key: 'cortex:Frontal', label: 'Frontal' }`; `a` → `{ key: 'cortex:Limbic', label: 'Limbic lobe' }`; `d` → `{ key: 'structure:Limbic', label: 'Limbic system' }`; `elsewhere` → null.
- **Covered by:** `src/lib/core/panels/navigator.test.ts` (R)

### PANEL-05 · A match in another atlas offers the atlas that draws it

- **Rule:** Search matches drawn by another atlas are offered under the first atlas, in manifest order, that draws each, so the offered switch shows them. A match no other atlas draws is an error.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/navigator.js:96-117`
- **Expected:** cut atlases destrieux, hcp-mmp, nextbrain: a NextBrain region from destrieux or hcp-mmp → `[['nextbrain', ['nb']]]`; a wmparc region with cut atlases destrieux, hcp-mmp, from nextbrain → `[['destrieux', ['wm']]]`; without nextbrain on offer → throws "No other atlas draws nb". Surface atlases: an hcp-mmp area from destrieux → `['hcp-mmp']`.
- **Covered by:** `src/lib/core/panels/navigator.test.ts` (R)

### PANEL-06 · A setting that hides rows is said once, on the section caption

- **Rule:** Reasons that come from a display setting (hemisphere, cortex hidden, internal anatomy hidden, cord hidden, isolation, no cut, another system) are said once per section, in the order met, not on each row.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/navigator.js:119-133`
- **Expected:** cortex rows hidden by cortex-hidden (×3) and hemisphere, structure rows removed and no-mri, tissue no-cut → `[['cortex', ['cortex-hidden','hemisphere']], ['tissue', ['no-cut']]]`.
- **Covered by:** `src/lib/core/panels/navigator.test.ts` (R)

### PANEL-07 · A hidden row prints only a reason of its own

- **Rule:** A setting's reason is on the caption and a removed part's struck eye says it, so a row prints only a reason of its own. The reason names the detail set a region is in, and an unknown reason falls back to "Hidden".
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/navigator.js:135-137,356-358`
- **Expected:** shown → false; hemisphere → false; removed → false; no-mri → true; below-cut-resolution → true. `reasonText('hemisphere', …, 'en')` = "Hemisphere hidden"; `('other-detail', 'learning', 'fr')` = "Dans Ensemble pédagogique"; `('no-such-reason', …, 'en')` = "Hidden"; `('inDetailSet', …, 'fr')` = "Masqué".
- **Covered by:** `src/lib/core/panels/navigator.test.ts` (R)

### PANEL-08 · Some reasons offer a switch and one cannot be undone

- **Rule:** A row hidden because it is in another atlas or cut atlas offers the switch that shows it. A row too small for the cut explains itself and does nothing when chosen.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/navigator.js` (reason sets)
- **Expected:** `OTHER_ATLAS` = {other-atlas, other-cut-atlas}; `UNREVEALABLE` = {below-cut-resolution}.
- **Covered by:** uncovered at the view-model level (the tree's behaviour belongs to `anatomy.md`)

### PANEL-09 · A group eye is shown, hidden or partial

- **Rule:** A group's eye is hidden when every part under it is hidden, partial when some are, and shown otherwise, so a group with hidden parts stays in view.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/visibility-control.js:9-19`
- **Expected:** hidden {a, b}: `['c']` → shown; `['a','b']` → hidden; `['a','c']` → partial; `[]` → shown.
- **Covered by:** `src/lib/core/panels/navigator.test.ts` (R, `PANEL-09`: the empty list)

### PANEL-10 · A search match is marked without regard to case or accents

- **Rule:** The first case- and accent-insensitive occurrence of the query is marked in the name. A composed or decomposed name or query marks the same span. No query, no match, or a query that folds to nothing marks nothing.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/navigator.js:154-179`; deviation `c5-match-highlight-offsets.md`
- **Expected:** "Gyrus cingulaire" / `CINGU` → "Gyrus ", [cingu], "laire"; "Écorce" / `eco` → [Éco], "rce"; "Insula" / `insula` → [Insula]; `zz` or `''` → one unmarked "Insula". "Cortex cérébelleux" with NFD `cérébel` → "Cortex ", [cérébel], "leux"; NFD name with `cerebel` → the NFD "cérébel" marked. `́` → unmarked.
- **Covered by:** `src/lib/core/panels/navigator.test.ts` (R)

### PANEL-11 · A row explains a match its name does not hold with its code, then its first alias

- **Rule:** When the query is not in the name, the row shows the code that matched, else the first alias that matched; when the name holds it, nothing is shown.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/navigator.js:287-306`
- **Expected:** Primary visual cortex, code V1, aliases striate cortex, area 17: `v1` → "V1"; `striate` → "striate cortex"; `area` → "area 17"; `visual` → null; `zz` → null. Insula with alias "Île de Reil", `ile` → "Île de Reil".
- **Covered by:** `src/lib/core/panels/navigator.test.ts` (R)

## Clinical: the Deficits and Functions panels

### PANEL-12 · Opening a deficit says what it changed, in one sentence, and claims nothing else

- **Rule:** After revealing a deficit's regions, the notice names each of the reader's settings the reveal changed, in a fixed order: section closed, isolation cleared, atlas, cut labels, colour, internal anatomy, both hemispheres shown, cortex shown or hidden. A cut or isolation is only ever said when cleared. Nothing changed → no notice. The clauses are joined as a list in the reader's language, capitalised, with a full stop.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/clinical.js:180-198`
- **Expected:** detail learning → aseg: "Internal anatomy set to FreeSurfer aseg." / "Anatomie interne réglée sur FreeSurfer aseg." With a cut and isolation before: "Section closed, isolation cleared, and internal anatomy set to FreeSurfer aseg." / "Coupe fermée, isolement retiré et anatomie interne réglée sur FreeSurfer aseg." Cut atlas → hcp-mmp: "Cut labels set to HCP-MMP." Before hcp-mmp, cab-np, left; after destrieux, atlas, both, cortex hidden: "Atlas set to Destrieux, colour set to Regions, both hemispheres shown, and cortex hidden." Same settings, or a cut made after → null.
- **Covered by:** `src/lib/core/panels/clinical.test.ts` (R); the controller's use: CTRL-30 in `controller.md`

### PANEL-13 · The profile's meta line says the work in progress, the failure, or the stage

- **Rule:** While opening, the line says what is being done (opening anatomy, or restoring the previous view). After a failure it gives the panel's own failure text when it has one, else what the operation could not do in the reader's words, never the developer's message. Otherwise it says what the stage shows.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/clinical.js:200-205`; `viewer/ui/panels/functions.js:124-146`
- **Expected:** idle → the status text. Opening → "Opening anatomy…"; restoring → "Restoring the previous view…". fr `restoreFailed` → "La vue précédente n’a pas pu être entièrement rétablie." Error on `deficit` → "Could not show this deficit’s regions." fr `asset-fetch` on `region` → starts "Impossible d’afficher la région. Un fichier n’a pas pu être téléchargé" and has no "HTTP". Functions tab: busy "Preparing the HCP-MMP areas…", failure "The HCP-MMP areas could not be shown."
- **Covered by:** `src/lib/core/panels/clinical.test.ts` (R, `PANEL-13`: the Functions text and `asset-updated`)

### PANEL-14 · A side shared by every finding is said once

- **Rule:** When every association of a profile has the same side, it is said once under the title; mixed sides stay on each finding. A region link names its side only when the association's own side does not already say it.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/clinical.js:167-178`
- **Expected:** `sharedSide`: six lefts → left; `[right]` → right; two bilateral → bilateral; `[left,right]`, `[left,bilateral,left]`, `[]` → null. `sideStated('left', [left,left])` true; `('right',[right])` true; `('bilateral',[left,right])`, `('left',[left,right])`, `('left',[midline])`, `('left',[])` false.
- **Covered by:** `src/lib/core/panels/clinical.test.ts` (R)

### PANEL-15 · A reference's published corrections are listed with their DOI

- **Rule:** Each published correction of a reference is listed in the reader's language with its DOI and a doi.org link.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/ui/panels/clinical.js:108-115`; `data/neuropsychology.yaml`
- **Expected:** two references carry corrections: `10.1073/pnas.98.2.777-e` → `{ doi: 'doi:10.1073/pnas.98.2.777-e', href: 'https://doi.org/10.1073/pnas.98.2.777-e', summary: 'Corrects the spelling “centrolateralis” …' }` and `10.1093/cercor/bhl065`; fr summaries in French. A reference without corrections → `[]`.
- **Covered by:** `src/lib/core/panels/clinical.test.ts` (W: it re-derives href and summary from the same data and does not check the `doi:` text)

### PANEL-16 · A region with no deficit has no Neuropsychology section

- **Rule:** The inspector titles a Neuropsychology section only when a region is selected and at least one deficit cites it.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/clinical.js:207-209`
- **Expected:** `(null, 0)` → false; `({ id: 'destrieux:left:1' }, 0)` → false; `(…, 2)` → true.
- **Covered by:** `src/lib/core/panels/clinical.test.ts` (R)

## Inspector

### PANEL-17 · The empty inspector is a hint; title, facts and actions wait for a region

- **Rule:** Without a selected region the inspector hides its title, facts and actions; on Anatomy it shows the hint, on any other tab it hides the hint too. A selected region shows all four.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/inspector.js:13-29`
- **Expected:** no region, anatomy → `{ hideTitle: true, hideHint: false, hideFacts: true, hideActions: true }`; no region, deficits, circuits, functions or diffusion → `hideHint: true`. Region on anatomy or deficits → all false.
- **Covered by:** `src/lib/core/panels/inspector.test.ts` (R)

### PANEL-18 · A source label names its atlas and keeps its ids apart

- **Rule:** The source row names the source atlas and its label ids in the code voice. One or two ids share the label's line; more take the line under it; past eight they are counted and the full list is kept. A region with no source id names its atlas alone, on the line under.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/inspector.js:31-43`
- **Expected:** `{ atlas: 'destrieux', source_label_id: 16 }` → `{ atlas: 'Destrieux', ids: '16', stacked: false }`. NextBrain `[161, 10161]` → `ids: '161, 10161'`, not stacked; `[1,2,3]` → stacked. 52 ids in fr → `atlas: 'NextBrain · 52 étiquettes'`, `ids: null`, `all` the full list (cdmd `learning:left:thalamus` has 52). `{ atlas: 'zanatomy' }` → `ids: null`, stacked.
- **Covered by:** `src/lib/core/panels/inspector.test.ts` (R)

## Circuits

### PANEL-19 · A lesson's landmarks read as current, seen or ahead, and the stepper offers only real directions

- **Rule:** Each landmark is the current one, one already visited, or one ahead. The stepper offers previous and next only where a landmark exists.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/circuits.js:48-82`
- **Expected:** step 2, visited [0, 2] → `visited, upcoming, current, upcoming`; step 0 visited [0] → current. `stepperTargets(0,4)` = `{ previous: null, next: 1 }`; `(1,4)` = `{0, 2}`; `(3,4)` = `{2, null}`; `(0,1)` = `{null, null}`.
- **Covered by:** `src/lib/core/panels/circuits.test.ts` (R)

## Related evidence

### PANEL-20 · A region shares evidence with its source regions and the structures that contain it

- **Rule:** A selection is linked to itself, to the source regions a grouped structure is the union of, and to the grouped structures that contain it. Another segmentation of the same structure is not the same region. An unknown region is an error.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/related.js:7-20`
- **Expected:** `learning:left:thalamus` with constituents `nextbrain:left:458`, `:441` → those three; `nextbrain:left:458` → itself and the thalamus; `aseg:left:10` → itself. cdmd: `learning:left:caudate` → itself, `nextbrain:left:48`, `:118`, `:393`. `'missing'` → "Unknown region: missing".
- **Covered by:** `src/lib/core/panels/related.test.ts` (R)

### PANEL-21 · Every published constituent is itself a published region

- **Rule:** The 80 grouped structures in the cdmd manifest name only constituents the manifest publishes.
- **Kind:** data
- **Level:** unit
- **Source:** `public/models/cdmd/manifest.json`
- **Expected:** for each region with `constituent_regions`, every id `createInvolvement` returns is in the manifest.
- **Covered by:** `src/lib/core/panels/related.test.ts` (S)

## Masthead and colophon text

### PANEL-22 · A subject is named with its dataset, without quotation marks

- **Rule:** Stated once as MAST-28 (`masthead.md`); this entry only points there, so the rule is tested once. The view-model test (`src/lib/core/panels/header.test.ts` or `provenance.test.ts`) is where it is proved.
- **Kind:** behaviour
- **Level:** see MAST-28
- **Source:** see MAST-28
- **Expected:** see MAST-28
- **Covered by:** see MAST-28

### PANEL-23 · The collapsed masthead names what is available, or the tract reference alone

- **Rule:** Stated once as MAST-38 (`masthead.md`); this entry only points there, so the rule is tested once. The view-model test (`src/lib/core/panels/header.test.ts` or `provenance.test.ts`) is where it is proved.
- **Kind:** behaviour
- **Level:** see MAST-38
- **Source:** see MAST-38
- **Expected:** see MAST-38
- **Covered by:** see MAST-38

### PANEL-24 · The Colour field offers only the colourings the build publishes, in groups

- **Rule:** Stated once as MAST-29 (`masthead.md`); this entry only points there, so the rule is tested once. The view-model test (`src/lib/core/panels/header.test.ts` or `provenance.test.ts`) is where it is proved.
- **Kind:** behaviour
- **Level:** see MAST-29
- **Source:** see MAST-29
- **Expected:** see MAST-29
- **Covered by:** see MAST-29

### PANEL-25 · A colour or atlas option names what choosing it changes

- **Rule:** Stated once as MAST-30 (`masthead.md`); this entry only points there, so the rule is tested once. The view-model test (`src/lib/core/panels/header.test.ts` or `provenance.test.ts`) is where it is proved.
- **Kind:** behaviour
- **Level:** see MAST-30
- **Source:** see MAST-30
- **Expected:** see MAST-30
- **Covered by:** see MAST-30

### PANEL-26 · A download says how far it has come, or that it has started

- **Rule:** Stated once as MAST-32 (`masthead.md`); this entry only points there, so the rule is tested once. The view-model test (`src/lib/core/panels/header.test.ts` or `provenance.test.ts`) is where it is proved.
- **Kind:** behaviour
- **Level:** see MAST-32
- **Source:** see MAST-32
- **Expected:** see MAST-32
- **Covered by:** see MAST-32

### PANEL-27 · The status bar always says it is not clinical anatomy

- **Rule:** Stated once as COLO-01 (`colophon.md`), COLO-02 (`colophon.md`); this entry only points there, so the rule is tested once. The view-model test (`src/lib/core/panels/header.test.ts` or `provenance.test.ts`) is where it is proved.
- **Kind:** behaviour
- **Level:** see COLO-01, COLO-02
- **Source:** see COLO-01, COLO-02
- **Expected:** see COLO-01, COLO-02
- **Covered by:** see COLO-01, COLO-02

## Provenance

### PANEL-28 · The provenance sheet lists only what the published records say

- **Rule:** Stated once as PROV-01 (`provenance.md`), PROV-02 (`provenance.md`), PROV-03 (`provenance.md`), PROV-04 (`provenance.md`); this entry only points there, so the rule is tested once. The view-model test (`src/lib/core/panels/header.test.ts` or `provenance.test.ts`) is where it is proved.
- **Kind:** data
- **Level:** see PROV-01, PROV-02, PROV-03, PROV-04
- **Source:** see PROV-01, PROV-02, PROV-03, PROV-04
- **Expected:** see PROV-01, PROV-02, PROV-03, PROV-04
- **Covered by:** see PROV-01, PROV-02, PROV-03, PROV-04

### PANEL-29 · Each function's lesion check says how much of each mapped parcel its areas colour

- **Rule:** Stated once as PROV-05 (`provenance.md`); this entry only points there, so the rule is tested once. The view-model test (`src/lib/core/panels/header.test.ts` or `provenance.test.ts`) is where it is proved.
- **Kind:** data
- **Level:** see PROV-05
- **Source:** see PROV-05
- **Expected:** see PROV-05
- **Covered by:** see PROV-05

### PANEL-30 · URLs read without their scheme, and a tract reference lists its own sources

- **Rule:** Stated once as PROV-07 (`provenance.md`), PROV-08 (`provenance.md`); this entry only points there, so the rule is tested once. The view-model test (`src/lib/core/panels/header.test.ts` or `provenance.test.ts`) is where it is proved.
- **Kind:** behaviour
- **Level:** see PROV-07, PROV-08
- **Source:** see PROV-07, PROV-08
- **Expected:** see PROV-07, PROV-08
- **Covered by:** see PROV-07, PROV-08

## Async runners

### PANEL-31 · In a latest-wins panel only the latest run reports

- **Rule:** The Functions and Deficits tabs and the comparison highlight run their work latest-wins: a later run overtakes an earlier one. Every run resolves to its own outcome, but only the latest reports its result, failure or settling. Every failure is logged; only the latest tells the reader. A synchronous throw is a failure of the run. The action starts at once. A run whose value is `false` counts as not applied.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/functions.js:124-146`; `viewer/ui/panels/clinical.js:288-313`; `viewer/ui/panels/atlas-comparison.js:65-88`
- **Expected:** two runs, second resolves `b` then first `a` → outcomes `{ ok: true, value: 'a' }`, `{ ok: true, value: 'b' }`, reported `['result b', 'settled']`. First resolves first → nothing reported until the second. Both reject → errors reported `[current]`, both logged. A throwing action → `{ ok: false, error }`, `onError` once. The action is called before the first await.
- **Covered by:** `src/lib/core/async/latest.test.ts` (R)

### PANEL-32 · Cancelling drops the run in flight without starting another

- **Rule:** A panel that closes or clears overtakes its run in flight, so a download that lands later reports nothing; the next run reports as usual.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/atlas-comparison.js:65-88`
- **Expected:** run pending, `cancel()`, resolve `late` → outcome `{ ok: true, value: 'late' }`, no result, no settling; a later run reports `now`.
- **Covered by:** `src/lib/core/async/latest.test.ts` (R)

### PANEL-33 · The latest run settles even when its handler throws

- **Rule:** The settling handler of the latest run always runs, after the result or failure handler, even when that handler throws; the throw reaches the caller.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/functions.js:139-145`
- **Expected:** an action rejecting with an `onError` that throws `handler` → the run rejects with `handler`, `onSettled` called once.
- **Covered by:** `src/lib/core/async/latest.test.ts` (R)

### PANEL-34 · In the Circuits tab a run asked for while another is busy is refused

- **Rule:** The Circuits tab runs one action at a time: a run asked for while another is in flight is turned away, not queued and not overtaking, and starts and settles nothing. Every run that starts settles, with the runner already free; a failure is logged and reported. The run resolves true when its action completed.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/panels/circuits.js:260-278`
- **Expected:** first pending → `busy` true; a second → false, its action not called, no start or settle; first resolves → true, `busy` false; a later run → true. Events of one run: `start busy=true`, `action busy=true`, `settled busy=false`. A failing run → false, `['error', 'settled busy=false']`, logged once; the next run → true.
- **Covered by:** `src/lib/core/async/latest.test.ts` (R)
