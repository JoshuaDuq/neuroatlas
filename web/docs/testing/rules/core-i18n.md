# Core i18n and formatting rules

Scope: chunk C1 (#13): the English and French interface strings, the language lookup, the counted and
interpolated phrases, the failure wording (`failureNotice`, `startFailure`, `linkNotice`, the diffusion
failure codes' words, the tract MRI readout) and the C1 amendments recorded on #4; and the number and text
formatting helpers. Legacy sources: `viewer/i18n/{translations,errors}.js`, `viewer/ui/format.js`,
`viewer/{clinical,learning,diffusion}/translations.js`, the private tables of
`viewer/ui/chrome/sections.js:20-52` and `viewer/diffusion/navigation-ui.js:8-29`. New code:
`web/src/lib/core/i18n/` (`index.ts`, `errors.ts`, `diffusion.ts`, `areas/*.ts`),
`web/src/lib/core/format.ts`, `web/src/lib/core/comparison-format.ts`. Deviations:
`c1-failure-subject.md`, `c1-loading-megabytes.md`, `c1-mri-dialog-french.md`, `c1-mri-dialog-i18n.md`;
S5b's `s5b-shortcut-strings.md` for the shortcut rows. The code that maps an error to a diffusion code is
in `core-catalogs.md` (CAT-63); the start screen that shows the failure words is in `boot-and-assets.md`
(BOOT-13 to BOOT-15).

Conventions: NNBSP is U+202F (narrow no-break space), NBSP is U+00A0, the minus sign is U+2212, the em
dash is U+2014. Expected strings below write these characters by name where the difference matters.

Not a rule today: French spacing before `:` and `;` is mixed. Of the 70 places in the French table where
`:` or `;` ends a phrase, 42 use NNBSP and 28 use an ordinary space (for example `app.spoken`,
`link.notApplied`, `dissection.partHidden`, `diffusion.loaded`, every shortcut row). Guillemets are mixed
too (`domains.score`, `domains.termOf`, `errors.operations.colour` and `navigator.noMatch` use ordinary
spaces inside « », `functions.deficitBridge` uses NBSP). The legacy tables have the same mixture. A rule
"French sets NNBSP before `: ; ! ?` and NBSP inside « »" needs a decision on #4 first; only the formatted
values (I18N-22, I18N-28) hold it today.

## Tables and lookup

### I18N-01 · Every English string has a French counterpart, and the reverse

- **Rule:** The English and French tables have the same keys at every depth. A function or a list counts as one entry.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/i18n/i18n.test.js`; `web/src/lib/core/i18n/index.ts:35-102`
- **Expected:** the set of leaf paths of `TRANSLATIONS.en` equals that of `TRANSLATIONS.fr` (no path in one and not the other). Inside `clinical`, `circuits`, `diffusion`, `errors.operations` and `link.fields` the key lists are equal. `mri.tissueNames` has the same 12 keys in both.
- **Covered by:** `src/lib/core/i18n/i18n.test.ts` (R); `src/lib/core/i18n/errors.test.ts` (R, operations and link fields)

### I18N-02 · Each area file is composed once into each language

- **Rule:** Every file under `areas/` is one area of both tables, and the tables hold nothing else.
- **Kind:** hygiene
- **Level:** unit
- **Source:** `viewer/i18n/i18n.test.js` (the legacy duplicate-`mpr:` guard); `web/src/lib/core/i18n/index.ts:1-33`
- **Expected:** the sorted area names of `TRANSLATIONS.en` and of `TRANSLATIONS.fr` both equal the sorted file names of `areas/*.ts` (31 areas).
- **Covered by:** `src/lib/core/i18n/i18n.test.ts` (H)

### I18N-03 · French reads French; any other language reads English

- **Rule:** The strings of an area are the French ones for `fr` and the English ones for every other language, including an unknown or empty one and a name that is a property of every object. Looking up a language never fails.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/i18n/translations.js:1072`; `web/src/lib/core/i18n/index.ts:106-111`
- **Expected:** `t('fr','header').languageSwitch` = "Langue"; `t('en','header').languageSwitch` = "Language"; `t('de'|'unknown'|''|'xx','header')` and `t('constructor','header')` are `TRANSLATIONS.en.header` (the same object). An area that does not exist is a type error at build time, not a run-time fallback.
- **Covered by:** `src/lib/core/i18n/i18n.test.ts` (R)

### I18N-04 · The interface says the approved copy

- **Rule:** Every string, and what every string function says for fixed arguments, is the approved English and French copy: the legacy wording, plus the deviations and amendments recorded on #4 (I18N-05 to I18N-09). A change of wording is a reviewed change of this record.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/i18n/translations.js`, `viewer/clinical/translations.js`, `viewer/learning/translations.js`, `viewer/diffusion/translations.js`; decision 5 on #4 (French reviewed in C1's PR)
- **Expected:** a committed snapshot of both tables, each function called at fixed arguments (counts 0, 1, 2, 183, 12345; strings "Alpha", ""; booleans both; the `mpr.note` subject `{individual: true|false}`; the `mri.grid` dims `[182, 218, 182]`), equals today's output. The snapshot is generated once from the current tables (which equal legacy apart from I18N-05 to I18N-09), reviewed, and then fixed; it never imports `viewer/`.
- **Covered by:** `src/lib/core/i18n/copy.test.ts` (R, a reviewed snapshot of both tables in `src/lib/core/i18n/__snapshots__/copy.{en,fr}.txt`, functions at fixed arguments)

### I18N-05 · The C1 amendments read as approved, in both languages

- **Rule:** The strings later chunks asked for through the C1 queue are in the tables with their approved wording.
- **Kind:** behaviour
- **Level:** unit
- **Source:** decisions 15, 17, 20, 21, 22, 24, 32, 39, 42 on #4; G3 `keyAbsent` request; H1a `panelAria` request; T1 and R2 requests
- **Expected:** EN / FR:
  `viewport.navigationHintTouch` "Drag to rotate · Pinch to zoom · Tap to inspect" / "Glisser : tourner · Pincer : zoom · Toucher : inspecter";
  `viewport.navigationHintTractsTouch` "Drag to rotate · Pinch to zoom" / "Glisser : tourner · Pincer : zoom";
  `viewport.exitFullscreen` "Exit full screen" / "Quitter le plein écran";
  `viewport.dockLabel` "3D viewer tools" / "Outils du visualiseur 3D";
  `viewport.orbitGroup` "Turn the model" / "Faire pivoter le modèle"; `orbitLeft|Right|Up|Down` "Turn left|right|up|down" / "Tourner à gauche|à droite|vers le haut|vers le bas";
  `viewport.keyAbsent` "Not shown in this view" / "Absent de cette vue";
  `workspace.panelAria` "Atlas panel" / "Panneau de l’atlas";
  `link.newTab` "(opens in a new tab)" / "(s’ouvre dans un nouvel onglet)";
  `dissection.partHidden('X','Y')` "Hidden: X, Y." / "Masqué : X, Y."; `partShown` "Shown: X, Y." / "Affiché : X, Y.";
  `sheet.detent` peek/half/full "Panel collapsed" / "Panel half open" / "Panel fully open", FR "Panneau replié" / "Panneau à moitié ouvert" / "Panneau entièrement ouvert";
  `comparison.ready` "Atlas comparison loaded." / "Comparaison des atlas chargée."; `comparison.exported` "Atlas comparison CSV downloaded." / "Fichier CSV de la comparaison des atlas téléchargé.";
  `diffusion.tryAgain` "Try again" / "Réessayer"; `diffusion.loaded('X')` "Loaded: X" / "Chargé : X"; `diffusion.restored` "Default tracts restored." / "Faisceaux initiaux rétablis."; `diffusion.exported` "Lengths CSV exported." / "CSV des longueurs exporté.";
  `shortcuts.rangeTo` "to" / "à".
- **Covered by:** `src/lib/core/i18n/i18n.test.ts` (R) (I18N-05; `diffusion.matches` too)

### I18N-06 · The loading line gives megabytes in the reader's notation

- **Rule:** While the anatomy downloads, the line gives the bytes received and the total, each in megabytes at one decimal with its unit held to it, in the reader's decimal notation.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/i18n/translations.js:441, 968`; deviation `c1-loading-megabytes.md`
- **Expected:** `viewport.loadingWithTotal(12.3 × 1048576, 46.1 × 1048576)` → EN "Loading anatomy · 12.3 NNBSP MB / 46.1 NNBSP MB", FR "Chargement de l’anatomie · 12,3 NNBSP Mo / 46,1 NNBSP Mo" (no space between number and NNBSP).
- **Covered by:** `src/lib/core/i18n/i18n.test.ts` (R) (I18N-06)

### I18N-07 · The diffusion MRI dialog is translated, with the French grammar fixes

- **Rule:** The diffusion MRI dialog reads its strings from the `mri` area in both languages. Two French strings use the corrected wording. The grid line names the voxel counts and the spacing.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/navigation-ui.js:8-29`; deviations `c1-mri-dialog-i18n.md`, `c1-mri-dialog-french.md`; decision 41 on #4 (T2 additions)
- **Expected:** FR `mri.dialog.hint` = "Cliquer sur une coupe pour placer le réticule. Faire défiler pour parcourir les coupes ; les touches fléchées déplacent le réticule d’un voxel."; FR `mri.dialog.voxel` = "Voxel source (indices à partir de 0)". `mri.dialog.grid([182,218,182],'1 mm')` FR = "182 × 218 × 182 voxels source · espacement de 1 mm"; `grid([2,3],'1 mm')` EN = "2 × 3 source voxels · 1 mm spacing". T2's keys `ready`, `viewer`, `voxelName`, `range`, `moved`, `hintKeys`, `hintClose`, `hintTouch` exist in both languages (EN `ready` "Reference MRI ready.", `hintClose` "M closes this view.").
- **Covered by:** `src/lib/core/i18n/i18n.test.ts` (R) (I18N-07; grid lines too)

### I18N-08 · The linked MRI names its tissue labels and orientation letters in the reader's language

- **Rule:** The linked MRI's tissue label names and its edge letters come from i18n. French writes D for right and G for left.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/sections.js:20-52, 378, 394-401`
- **Expected:** `mri.tissueNames['Left-Cerebral-Cortex']` EN "Left cerebral cortex", FR "Cortex cérébral gauche"; `Unknown` EN "Unlabelled", FR "Non étiqueté"; 12 keys in both. `orientation` EN `{R:'R', L:'L', S:'S', I:'I', P:'P', A:'A'}`, FR `{R:'D', L:'G', S:'S', I:'I', P:'P', A:'A'}`.
- **Covered by:** `src/lib/core/i18n/i18n.test.ts` (R) (I18N-08; tissue names, orientation letters)

### I18N-09 · The shortcut sheet lists every key, with the S5b fixes

- **Rule:** The shortcut sheet names every single-key shortcut in both languages. French names Escape "Échap". The Escape row ends with the function or the deficit in both languages, and the `M` row mentions the MRI with tracts.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/i18n/translations.js:382, 912`; deviation `s5b-shortcut-strings.md` (D1 to D3); decision 24 on #4
- **Expected:** the key column of `shortcuts.groups` contains F, I, M, C, S, H, 0, "1 – 6", "/" and "Esc" (EN) or "Échap" (FR). EN Esc row: "In a detail view: back to the list. Elsewhere: clear the search, then the selection, then the function or deficit". FR Échap row ends "… puis la sélection, puis la fonction ou le déficit". EN M row: "Open or close linked MRI slices; in Tracts, the MRI with tracts"; FR M row: "Ouvrir ou fermer les coupes IRM ; dans Faisceaux, l’IRM avec faisceaux".
- **Covered by:** `src/lib/core/i18n/i18n.test.ts` (R) (keys and the Escape rows; I18N-09 for the M rows)

### I18N-10 · The atlas switch shows a short name

- **Rule:** The masthead atlas switch shows the atlas's short name, else its full title, else its id.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/i18n/translations.js:1074-1077`; `web/src/lib/core/i18n/index.ts:113-118`
- **Expected:** `atlasSwitchLabel('destrieux','en')` "Destrieux"; `('hcp-mmp','fr')` "HCP-MMP"; `('nextbrain','en')` "NextBrain"; `('learning','en')` "Teaching set"; `('learning','fr')` "Ensemble pédagogique"; `('wmparc','en')` "wmparc" (the short name; every atlas has one, so the full-title branch cannot be reached today); `('unheard-of')` "unheard-of"; an unknown language reads English.
- **Covered by:** `src/lib/core/i18n/i18n.test.ts` (R) (I18N-10)

## Counted and interpolated phrases

### I18N-11 · A counted phrase agrees with its count, in both languages

- **Rule:** A phrase that counts something uses the singular for one and the plural otherwise, in each language's grammar. The streamline count groups its digits (I18N-23); the other counts are written without grouping (12345 stays "12345").
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/clinical/translations.js`, `viewer/learning/translations.js`, `viewer/diffusion/translations.js`, `viewer/i18n/translations.js`
- **Expected:** `clinical.regionsMarked(shown, total, coloured)`: EN (7,7,true) "7 regions coloured", (10,11,true) "10 of 11 regions coloured", (1,1,true) "1 region coloured", (0,1,true) "0 of 1 region coloured", (7,7,false) "7 regions visible"; FR (7,7,true) "7 régions colorées", (10,11,true) "10 régions sur 11 colorées", (1,1,true) "1 région colorée", (1,3,true) "1 région sur 3 colorée", (2,3,false) "2 régions sur 3 visibles", (1,1,false) "1 région visible". `diffusion.streamlines`: EN (721,721) "721 streamlines", (640,721) "640 of 721 streamlines", (1,1) "1 streamline", (12345,12345) "12 NNBSP 345 streamlines"; FR (2140,2140) "2140 trajectoires", (640,721) "640 sur 721 trajectoires". `circuits.coverage(8,33)` EN "8 guided circuits · 33 landmarks", FR "8 parcours guidés · 33 repères". `circuits.landmarkCount` EN 1 "1 landmark", 4 "4 landmarks"; FR "1 repère", "4 repères". `diffusion.matches` EN 1 "1 tract bundle", 12 "12 tract bundles"; FR "1 faisceau", "12 faisceaux". `circuits.step(i, n)` takes a 0-based index: EN (1, 2) "Landmark 2 of 2", FR "Repère 2 sur 2". `dissection.hiddenCount` EN 1 "1 part hidden", 2 "2 parts hidden"; FR "1 partie masquée", "2 parties masquées".
- **Covered by:** `src/lib/core/i18n/i18n.test.ts` (R) (regionsMarked, streamlines, coverage, landmarkCount, matches; I18N-11 for `circuits.step`, `dissection.hiddenCount` and grouped streamlines). Note: four phrases ignore the count and read wrongly for 1: `footer.sourceFiles` ("1 source files"), `functions.coverage`, `circuits.coverage` ("1 guided circuits · 1 landmarks") and `diffusion.bundleCollection` ("1 tract bundles", "1 faisceaux"). The published counts are never 1, so the reader never sees it; legacy has the same wording.

### I18N-12 · The colophon and the MPR note describe the brain that was built

- **Rule:** The colophon names the published subject and says whether it is an individual or a template. The linked MRI note says the same. Neither carries another brain's name.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/i18n/i18n.test.js`; `viewer/i18n/translations.js` (`footer.colophon`, `mpr.note`)
- **Expected:** for `{display_name: 'FreeSurfer “bert”', individual: true}` and `{display_name: 'FreeSurfer fsaverage', individual: false}`, in each language: the colophon contains "bert" or "fsaverage" respectively, the two differ, the template's does not contain "bert"; `mpr.note(subject)` contains "1 mm" and differs from the template's. EN and FR colophons differ.
- **Covered by:** `src/lib/core/i18n/i18n.test.ts` (R, partial: pattern matches, not the full sentences)

### I18N-13 · Panel copy names no tab the redesign removed

- **Rule:** The deficit, lesson and tract copy never sends the reader to a tab that no longer exists.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/clinical/translations.test.js`
- **Expected:** no string of `clinical`, `circuits` or `diffusion` (functions called with (1, 4) and (3, 4)), in either language, matches `View →`, `Vue →`, `Sections`, `Coupes`, `Region tab`, `in the explorer`, `dans l’explorateur`.
- **Covered by:** `src/lib/core/i18n/i18n.test.ts` (R)

### I18N-14 · The network notes state the denominator and the display threshold

- **Rule:** Both languages say what a network share counts (surface vertices or volume voxels) and that shares under 5 % are hidden.
- **Kind:** scientific
- **Level:** unit
- **Source:** `viewer/catalog/network-basis.test.js` (its i18n part); `web/src/lib/core/catalog/networks.ts:54` (the 0.05 threshold)
- **Expected:** EN `networks.notes.vertices` matches /vertices/, `voxels` matches /voxels/; FR matches /sommets/ and /voxels/; every note in both languages matches /5\s?%/.
- **Covered by:** `src/lib/core/i18n/i18n.test.ts` (R)

### I18N-15 · A comparison row's name carries the area and the share

- **Rule:** The name of an overlap toggle names the other region, the overlap area and the share of this region, in the reader's notation.
- **Kind:** behaviour
- **Level:** unit
- **Source:** decision 39 on #4; `web/src/lib/core/i18n/areas/comparison.ts`
- **Expected:** `comparison.highlight('Area 44', withUnit(overlapArea(25.36)), withUnit(overlapShare(0.1536)))` EN "Highlight overlap with Area 44, 25.4 NNBSP mm², 15.4% of this region"; FR "Tracer le recouvrement avec Area 44, 25,4 NNBSP mm², 15,4 NNBSP % de cette région".
- **Covered by:** `src/lib/core/comparison-format.test.ts` (R)

## Failure wording

### I18N-16 · A failure says what could not be done, never the raw error

- **Rule:** A failure notice names the operation that failed. A failed download adds what to check. A newer deploy asks for a reload instead. The error's own message is never shown.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/i18n/errors.js:11-18`; `viewer/i18n/translations.js:500-530, 1026-1055`
- **Expected:** `failureNotice(error with code 'asset-updated', lang, any, any)` → `{text: errors.updated, action: 'reload'}` (EN "Planum was updated. Reload to continue.", FR "Planum a été mis à jour. Rechargez la page pour continuer."). `failureNotice(code 'asset-fetch', 'en', 'layer', 'HCP-MMP')` → "Could not load HCP-MMP. A file could not be downloaded. Check the connection and try again.", `action: null`. `failureNotice(new Error('boom'), 'fr', 'layer', 'Destrieux').text` starts "Impossible de charger Destrieux.". `failureNotice(SyntaxError("Unexpected token '<' …"), lang, 'snapshot').text` = `errors.operations.snapshot` (EN "Could not save the image.") and contains neither "Unexpected" nor "doctype".
- **Covered by:** `src/lib/core/i18n/errors.test.ts` (R) (also I18N-16)

### I18N-17 · A failure that cannot be worded fails loudly

- **Rule:** Asking for the words of an operation that has none, or of an operation that names its subject without a subject, throws instead of showing "undefined".
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/i18n/errors.js:15-16`; deviation `c1-failure-subject.md`
- **Expected:** `failureNotice(e, 'en', 'unheard-of')` throws /No failure text for unheard-of/; `failureNotice(e, 'en', 'layer')` and `(…, 'colour')` with no subject throw /layer failure text needs a subject/ (resp. colour).
- **Covered by:** `src/lib/core/i18n/errors.test.ts` (R) (I18N-17)

### I18N-18 · Every operation has words in both languages

- **Rule:** Each of the 18 operations has a failure sentence in English and French.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/i18n/translations.js:500-530, 1026-1055`
- **Expected:** `errors.operations` keys in both languages, in order: start, link, layer, colour, region, cord, system, internal, whiteMatter, wholeBrain, snapshot, section, deficit, landmark, mri, comparison, overlap, restore. `layer` and `colour` take a subject: EN `colour('CAB-NP')` "Could not show the CAB-NP colouring.", FR "Impossible d’afficher la coloration « CAB-NP »."
- **Covered by:** `src/lib/core/i18n/errors.test.ts` (R) (key lists and I18N-18 for order and the subject sentence)

### I18N-19 · A failed start keeps the link only for a download or update failure

- **Rule:** A start that fails on a download or a newer deploy is worded as a failed start, with Retry or Reload, and keeps the link. Any other failure of a page opened from a link says the link could not be opened, and its Retry drops the link. Without a link it is a failed start with Retry.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/i18n/errors.js:34-42`
- **Expected:** `startFailure(asset-fetch, 'en', true)` → `{text: "Could not load the anatomy. A file could not be downloaded. Check the connection and try again.", button: 'Retry', dropLink: false}`. `startFailure(asset-updated, 'fr', true)` → `{text: "Planum a été mis à jour. Rechargez la page pour continuer.", button: 'Recharger', dropLink: false}`. `startFailure(new Error('Unknown view: Left'), 'en', true)` → `{text: "Could not open this link. Retry opens Planum without this link.", button: 'Retry', dropLink: true}`. `startFailure(new Error('boom'), 'en', false)` → text "Could not load the anatomy.", `dropLink: false`.
- **Covered by:** `src/lib/core/i18n/errors.test.ts` (R) (I18N-19)

### I18N-20 · The link notice names each unapplied field once, in the reader's words

- **Rule:** The notice lists the link fields that were not applied, once each, in their given order, as a list in the reader's language. A circuit step is not named when its circuit is. An unknown field is named as is.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/i18n/errors.js:21-28`
- **Expected:** `linkNotice(['pos','lang','pos'],'en').text` "Not applied from this link: section position and language."; `(['pos','lang'],'fr')` "Éléments du lien non appliqués : position de la coupe et langue."; `(['circuit','step'],'en')` "Not applied from this link: circuit."; `(['step','circuit'],'fr')` "Éléments du lien non appliqués : circuit."; `(['step'],'en')` "Not applied from this link: circuit step."; `(['unknown-field'],'en')` "Not applied from this link: unknown-field."; `action` is always `null`.
- **Covered by:** `src/lib/core/i18n/errors.test.ts` (R) (I18N-20); `src/app/boot.svelte.test.ts` (R, the anatomy and atlas notices at boot)

### I18N-21 · A tracts failure is worded from its code

- **Rule:** The Tracts panel words a failure by one of four codes, in the reader's language, never with the error's English message.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/translations.js:58-79`; hand-over note on #4 (C1 review: `diffusionError(lang, code)` takes the code)
- **Expected:** `diffusionError('en', code)`: `asset-fetch` "The reference data could not be downloaded. Check the connection, then try again."; `asset-updated` "Planum was updated while this page was open. Reload the page to load the new data."; `invalid-data` "The reference data could not be read."; `failed` "The reference data could not be displayed." FR: "Les données de référence n’ont pas pu être téléchargées. Vérifiez la connexion, puis réessayez." / "Planum a été mis à jour pendant que cette page était ouverte. Rechargez la page pour charger les nouvelles données." / "Les données de référence n’ont pas pu être lues." / "Les données de référence n’ont pas pu être affichées." None contains the error's message (e.g. "The NIfTI spatial units must explicitly be millimeters.").
- **Covered by:** `src/lib/core/i18n/diffusion.test.ts` (R, I18N-21 exact texts); `src/lib/core/diffusion/validation.test.ts` (R, not the message)

### I18N-22 · The tract MRI readout writes the point, T1 and FA in the house style

- **Rule:** The readout gives the crosshair in signed RAS millimetres, the T1 value at no decimals and, where the dataset has an FA map, FA at two decimals. Each label is held to its value; French sets NNBSP before each colon.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/translations.js:51-56`
- **Expected:** `mriReadout([7.446, -23.539, 46.64], 340.552, 0.5123, 'en')` = "RAS:NBSP+7.4, MINUS23.5, +46.6NNBSPmm · T1:NBSP341 · FA:NBSP0.51"; `'fr'` = "RASNNBSP:NBSP+7,4NNBSP; MINUS23,5NNBSP; +46,6NNBSPmm · T1NNBSP:NBSP341 · FANNBSP:NBSP0,51". T1 NaN → "T1:NBSP—". `fa` undefined → no "FA".
- **Covered by:** `src/lib/core/i18n/diffusion.test.ts` (R)

## Number and text formatting

### I18N-23 · Digits group past four, with a narrow no-break space

- **Rule:** A number of five digits or more groups its digits in threes with NNBSP. Four digits stay together. Counts and quantities group alike.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/format.js:8-12`
- **Expected:** `grouped(1234)` "1234"; `grouped(12345)` "12NNBSP345"; `grouped(123456)` "123NNBSP456"; `grouped(21472)` "21NNBSP472".
- **Covered by:** `src/lib/core/format.test.ts` (R)

### I18N-24 · A unit is held to its number

- **Rule:** A unit follows its number after NNBSP, never a breaking space. English sets a percent sign close up; French sets NNBSP before it like any unit.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/format.js:21-23`
- **Expected:** `withUnit('5670','mm²')` "5670NNBSPmm²"; `withUnit('2797,9','mm²','fr')` "2797,9NNBSPmm²"; `withUnit('16','%')` "16%"; `withUnit('16','%','fr')` "16NNBSP%". No output of `quantity`, `formatRas`, `millimetres` or `percent` has U+0020 or U+2009 before "mm" or "%".
- **Covered by:** `src/lib/core/format.test.ts` (R)

### I18N-25 · A count agrees with its noun

- **Rule:** A count and its noun agree. English adds -es after s, x, z, ch or sh and turns a consonant + y into -ies. French uses its own word for the nouns it knows. Digits group as I18N-23.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/format.js:25-49`
- **Expected:** EN `count(0,'region')` "0 regions", `(1,'region')` "1 region", `(185,'region')` "185 regions", `(1,'study')` "1 study", `(80,'study')` "80 studies", `(2,'day')` "2 days", `(2,'match')` "2 matches", `(2,'box')` "2 boxes", `(2,'branch')` "2 branches", `(2,'bus')` "2 buses", `(21472,'match')` "21NNBSP472 matches". FR `(0,'region')` "0 régions", `(1,'region')` "1 région", `(183,'region')` "183 régions", `(1,'match')` "1 correspondance", `(5,'match')` "5 correspondances", `(1831,'study')` "1831 études"; the French nouns are region, match, label, study (and the keys `région`, `correspondance`). A noun French does not know keeps its English plural: `(2,'day','fr')` "2 days".
- **Covered by:** `src/lib/core/format.test.ts` (R), `src/lib/core/i18n/i18n.test.ts` (R, French)

### I18N-26 · A measurement has four significant figures and is never a false zero

- **Rule:** A measured quantity shows four significant figures, grouped digits, the reader's decimal mark and its unit. An absent value is an em dash; a true zero is "0".
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/format.js:51-69`
- **Expected:** `quantity(3214.153,'mm²')` "3214NNBSPmm²"; `(775.634310225458,'mm²')` "775.6NNBSPmm²"; `(5.1234,'mm³')` "5.123NNBSPmm³"; `(21472,'mm³')` "21NNBSP470NNBSPmm³"; `(64385,'mm³')` "64NNBSP390NNBSPmm³"; `(1000,'mm²')` "1000NNBSPmm²"; `(2.5,'mm²')` "2.5NNBSPmm²"; `(0,'mm²')` "0NNBSPmm²"; `null`, `undefined`, NaN, Infinity → "—"; FR `(775.634,'mm²','fr')` "775,6NNBSPmm²". The default language is English.
- **Covered by:** `src/lib/core/format.test.ts` (R)

### I18N-27 · A fixed-decimal number uses the reader's notation and a true minus

- **Rule:** A number at fixed decimals uses a decimal comma in French and U+2212 for negatives. `signed` marks positives with "+", `trim` drops trailing zeros, and a value that rounds to zero carries no sign. A non-finite value is an em dash. The defaults are one decimal and English.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/format.js:71-82`
- **Expected:** `decimal(-32.5)` "MINUS32.5"; `(-32.5,1,'fr')` "MINUS32,5"; `(12,1,'en',{signed:true})` "+12.0"; `(-0.04,1,'fr',{signed:true})` "0,0"; `(-30,0,'en',{signed:true})` "MINUS30"; `(0.8,2,'fr',{trim:true})` "0,8"; `(1,2,'en',{trim:true})` "1"; `(0.5,1,'en',{trim:true})` "0.5"; `(NaN)` "—"; `(-3)` "MINUS3.0".
- **Covered by:** `src/lib/core/format.test.ts` (R)

### I18N-28 · A RAS point is a signed triple in millimetres

- **Rule:** A point gives each axis signed, at one decimal, with a true minus, then "mm". English separates axes with ", "; French with NNBSP + "; " because its decimal mark is a comma. A missing, short or non-finite point is an em dash.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/format.js:84-91`
- **Expected:** `formatRas([-41.04, 26.2, 28.31])` "MINUS41.0, +26.2, +28.3NNBSPmm"; `'fr'` "MINUS41,0NNBSP; +26,2NNBSP; +28,3NNBSPmm"; `[0, -0.04, 0.04]` "0.0, 0.0, 0.0NNBSPmm"; `null`, `[1, 2]`, `[1, NaN, 2]`, `'abc'` → "—".
- **Covered by:** `src/lib/core/format.test.ts` (R)

### I18N-29 · Slider readouts give signed millimetres and whole percentages

- **Rule:** A coordinate readout is signed millimetres at one decimal; a fraction reads as a whole percentage, in the reader's notation.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/format.js:93-100`
- **Expected:** `millimetres(12.5,'en')` "+12.5NNBSPmm"; `(-3,'fr')` "MINUS3,0NNBSPmm"; `(0,'en')` "0.0NNBSPmm"; `percent(0.4,'en')` "40%"; `(0.35,'fr')` "35NNBSP%"; `(1,'en')` "100%".
- **Covered by:** `src/lib/core/format.test.ts` (R)

### I18N-30 · A comparison figure never shows a positive overlap as zero

- **Rule:** Stated once as INSP-27 (`inspector.md`); this entry only points there, so the rule is tested once.
- **Kind:** behaviour
- **Level:** see INSP-27
- **Source:** see INSP-27
- **Expected:** see INSP-27
- **Covered by:** see INSP-27
