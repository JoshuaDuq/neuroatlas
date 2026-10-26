# Core catalogue rules

Scope: chunks C2 (#20), the anatomy catalogue (region labels, visibility and its reasons, the anatomy list
and search, Yeo and CAB-NP networks, functional regions, neuropsychological domains and the Neurosynth term
search, internal anatomy, NextBrain systems, the nearest-name suggestion), and C3 (#21), the clinical,
learning (circuits and lesson session), atlas comparison and diffusion catalogues; plus the F1 (#6) shared
constants in `src/lib/types/constants.ts`. Legacy sources: `viewer/catalog/*.js`,
`viewer/clinical/{catalog,validate}.js`, `viewer/learning/{catalog,session}.js`,
`viewer/comparison/catalog.js`, `viewer/diffusion/{catalogs,presentation,validation}.js`,
`viewer/diffusion/translations.js:74-77`, and for F1 `viewer/render/{camera-views,device}.js`,
`viewer/model/brain-atlas.js:68`, `viewer/ui/chrome/workspace.js:6`, `viewer/state/url-state.js`. New code:
`web/src/lib/core/{catalog,clinical,learning,comparison,diffusion}/`, `web/src/lib/types/constants.ts`.
Deviation: `c2-search-word-boundary.md`. The words these catalogues' failures are shown in are in
`core-i18n.md`; which link values decode is in the state and links catalogues.

Data rules give fixed values read from the published files of the default anatomy, `cdmd` (MGH CDMD
"sub_013", the only entry of `public/models/anatomies.json`): `public/models/cdmd/{manifest,cab-np,
functional-regions,neuropsych-domains,neurosynth-terms,atlas-comparison}.json`, `data/neuropsychology.yaml`,
`data/circuits.yaml`, `data/diffusion-cdmd.yaml`, `config/model.yaml`. When a build changes those files,
the expected values change with them in the same commit.

## Shared constants (F1)

### CAT-01 · The seven camera presets, in order
- **Rule:** The named views are oblique, left, right, anterior, posterior, superior and inferior, in that order (the order the view menu and the keys 1 to 6 follow).
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/render/camera-views.js:8`
- **Expected:** `VIEW_NAMES` = `['oblique','left','right','anterior','posterior','superior','inferior']`; the keys of `VIEW_DIRECTIONS` are this list in this order.
- **Covered by:** `parity/f1.test.ts` (D); `src/lib/engine/render/camera-views.test.ts` (R, key set only, sorted, not the order)

### CAT-02 · Section modes, hemispheres and functional levels
- **Rule:** The section modes, the hemisphere choices and the functional levels are fixed lists. A link accepts exactly these values (the decoding rule is in the links catalogue).
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/slices/sections.js:7`; `viewer/state/url-state.js:55`; `viewer/catalog/functional-regions.js:5`
- **Expected:** `CUTS` = `['off','sagittal','coronal','axial','oblique']`; `HEMISPHERES` = `['both','left','right']`; `FUNCTIONAL_LEVELS` = `['named','sections']`. Probed with off, sagittal, coronal, axial, oblique, both, left, right, named, sections, anatomy, functions, deficits, circuits, diffusion, bogus and "", `cut=` accepts exactly `CUTS`, `hemi=` exactly `HEMISPHERES`, `level=` exactly `FUNCTIONAL_LEVELS`.
- **Covered by:** `parity/f1.test.ts` (D, through legacy `decodeState`); `src/lib/core/state/url-state.test.ts` (R, some values)

### CAT-03 · Six surface colourings, declared once
- **Rule:** The cortex can be coloured by tissue, MRI, atlas, network, CAB-NP or functional division. There is one list, and a link accepts each of them and nothing else.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/model/brain-atlas.js:68`; `viewer/state/url-state.js:36`
- **Expected:** `SURFACE_COLORS` = `['tissue','mri','atlas','network','cab-np','functional']`; `colors=bogus` and `colors=rgb` are rejected.
- **Covered by:** `parity/f1.test.ts` (D); `src/lib/engine/model/brain-atlas.test.ts` (W, `includes('mri')` only)

### CAT-04 · Five explorers, which are the workspace modes
- **Rule:** The workspace has five explorers, in tab order, and the modes are the same list.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/ui/chrome/workspace.js:6`; `viewer/state/url-state.js:38`
- **Expected:** `EXPLORERS` = `MODES` = `['anatomy','functions','deficits','circuits','diffusion']`; `tab=` accepts exactly these.
- **Covered by:** `src/lib/core/workspace.test.ts` (R, `MODES`); `parity/f1.test.ts` (D)

### CAT-05 · One compact-layout query, one phone-device query, one coarse-pointer query
- **Rule:** The compact interface, the phone rendering budget and the touch sizes each answer one media query, written the same everywhere it is repeated.
- **Kind:** hygiene
- **Level:** unit
- **Source:** `viewer/render/device.js:13-21`; `viewer/styles/{phone,stage,dialogs,masthead}.css`
- **Expected:** `PHONE_QUERY` = "(max-width: 800px), (max-height: 480px) and (orientation: landscape)"; `PHONE_DEVICE_QUERY` = "(max-width: 640px), (max-height: 480px) and (orientation: landscape)"; `COARSE_POINTER_QUERY` = "(pointer: coarse)". Every `@media` block in `web/src` that sets the compact layout uses the `PHONE_QUERY` literal exactly (today 22 stylesheets and components repeat it, from `app/layout.css` to `lib/ui/Dialog.svelte`); no `max-width: 800px` query appears in any other form.
- **Covered by:** `src/lib/state/media.svelte.test.ts` (R, the two literals); `parity/f1.test.ts` (D, legacy device.js and legacy CSS only; I, pins the `matchMedia` call order of legacy `isPhone`/`isCoarse`); the check on the new stylesheets is uncovered

### CAT-06 · The published manifest fits the manifest types
- **Rule:** The published manifest is what the types describe, so a type that stops describing the data fails the build.
- **Kind:** hygiene
- **Level:** unit
- **Source:** `web/src/lib/types/manifest.ts`, `region.ts`
- **Expected:** `schema_version` 1; `anatomy.id` "cdmd"; every region's `kind` is one of cortex, structure, non-region, tissue-region and its `hemisphere` one of left, right, midline; `atlases`, `detail_levels`, `supplemental_layers`, `cut_atlases` non-empty; the assignment type-checks under `npm run check`.
- **Covered by:** `parity/f1.test.ts` (H; keep as is, it does not use legacy)

## Region labels

### CAT-07 · Every published region has a name and a group in both languages
- **Rule:** Each region of the published anatomy has a non-empty display name and navigation group in English and in French. A region without one stops the catalogue from building.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/catalog/labels.js:55-117`; `viewer/catalog/catalog.js:37-60`
- **Expected:** all 1289 regions of `cdmd/manifest.json` resolve in `en` and `fr`. `createCatalog` of a manifest holding a region with no label throws "Region has no label: <id>".
- **Covered by:** `src/lib/core/catalog/labels.test.ts` (S), `src/lib/core/catalog/labels.fr.test.ts` (S); `parity/C2.test.ts` (D); the throw is uncovered

### CAT-08 · The published regions are all there
- **Rule:** The manifest's declared region counts are met by the regions it lists, so nothing was truncated.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/catalog/labels.test.js`
- **Expected:** cortex: destrieux 148, hcp-mmp 360; structures: aseg 32, nextbrain 292, learning 105; the supplemental zanatomy layer 58; tissue regions 290 (nextbrain 222, wmparc 68); non-regions 4 (`destrieux:left:-1`, `destrieux:right:-1`, `hcp-mmp:left:0`, `hcp-mmp:right:0`). Total 1289.
- **Covered by:** `src/lib/core/catalog/labels.test.ts` (S, declared vs listed, not the fixed numbers), `labels.fr.test.ts` (S, same), `functional-regions.test.ts` (S, hcp-mmp 360)

### CAT-09 · Destrieux parcels read their curated anatomical names, grouped by lobe
- **Rule:** A Destrieux parcel shows its curated name in the reader's language, its lobe as its group and its common abbreviations as search aliases. Both FreeSurfer spellings of a parcel (`&` and `_and_`) read the same.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/catalog/labels.js:106-116`; `viewer/catalog/destrieux-labels*.js`; `viewer/catalog/source-names.js`
- **Expected:** EN `G_front_inf-Opercular` "Opercular part of the inferior frontal gyrus", `S_calcarine` "Calcarine sulcus", `Pole_temporal` "Temporal pole", `G_temp_sup-G_T_transv` "Transverse temporal gyrus (Heschl)", `G_oc-temp_lat-fusifor` "Lateral occipitotemporal (fusiform) gyrus". FR: "Partie operculaire du gyrus frontal inférieur", "Sillon calcarin", "Pôle temporal", "Gyrus temporal transverse (Heschl)", "Gyrus occipito-temporal latéral (fusiforme)", `G_cuneus` "Cunéus", `G_cingul-Post-dorsal` "Gyrus cingulaire postéro-dorsal", `G_precentral` "Gyrus précentral", `G_postcentral` "Gyrus postcentral". Lobes EN: `G_front_sup` Frontal, `G_precuneus` Parietal, `S_calcarine` Occipital, `G_insular_short` Insula, `G_and_S_cingul-Ant` Cingulate; FR Frontal, Pariétal, Occipital, Insula, Cingulaire, `Lat_Fis-post` "Scissure latérale". Aliases: `G_temp_sup-Lateral` has "STG", `G_temp_sup-G_T_transv` "Heschl"; FR `G_front_inf-Opercular` has "GFI" and "Broca", `G_oc-temp_lat-fusifor` "fusiforme", `Lat_Fis-post` "Sylvius". `G&S_frontomargin` and `G_and_S_frontomargin` give the same name in both languages; so do `S_intrapariet&P_trans` and `S_intrapariet_and_P_trans`. The English and French tables have the same 74 keys, each with a name and a lobe.
- **Covered by:** `src/lib/core/catalog/labels.test.ts` (R), `labels.fr.test.ts` (R); `parity/C2.test.ts` (D)

### CAT-10 · HCP-MMP areas keep their codes and group by network
- **Rule:** An HCP-MMP area is shown by its published code, never an invented name. It is grouped under the Yeo network it mostly falls in; an area with no network above the threshold falls in an alphabetical bucket.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/catalog/labels.js:17-30, 95-104`
- **Expected:** `L_V1_ROI` → name and code "V1"; `R_9-46d_ROI` → code "9-46d". With `networks [{Vis, 1}]` → group "Visual" (FR "Visuel"). Without networks: `L_V1_ROI` "V–Z", `L_A1_ROI` "A–C", `L_55b_ROI` "0–9", `L_p24_ROI` "P–R". A Destrieux parcel with networks keeps its lobe (`G_precentral` with SomMot 0.75 → "Frontal").
- **Covered by:** `src/lib/core/catalog/labels.test.ts` (R), `networks.test.ts` (R); `parity/C2.test.ts` (D)

### CAT-11 · aseg structures read their names without side, grouped by system
- **Rule:** An aseg structure drops its Left-/Right- prefix (laterality is shown on its own) and is grouped by its anatomical system, in both languages.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/catalog/structure-groups*.js`; `viewer/catalog/labels.js:89-94`
- **Expected:** EN `Left-Putamen` "Putamen" / "Basal ganglia"; `CC_Anterior` "Corpus callosum, anterior" / "Corpus callosum"; `Optic-Chiasm` group "Diencephalon" (FR "Diencéphale"). FR `Left-Putamen` "Putamen" / "Ganglions de la base"; `Left-Caudate` "Noyau caudé"; `Left-Lateral-Ventricle` "Ventricule latéral" / "Ventricules et LCS"; `Left-Inf-Lat-Vent` "Corne temporale du ventricule latéral"; `CC_Anterior` "Corps calleux, antérieur" / "Corps calleux"; `Brain-Stem` "Tronc cérébral" / "Tronc cérébral". The English and French tables have the same 35 keys.
- **Covered by:** `src/lib/core/catalog/labels.test.ts` (R), `labels.fr.test.ts` (R)

### CAT-12 · NextBrain regions keep their published names and file under a system
- **Rule:** A NextBrain region shows its published name with spaces for underscores, or its verified French name where the French table has one. Its group is the anatomical system of its label id, the same for both hemispheres (right ids are left ids + 10000). A label with no system is an error.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/catalog/labels.js:72-81`; `viewer/catalog/nextbrain-systems.js`; `viewer/catalog/nextbrain-labels.fr.js`
- **Expected:** `head_of_caudate` (48) EN "head of caudate", code null, "Basal ganglia"; FR "Tête du noyau caudé" / "Ganglions de la base". FR: `core_of_nucleus_accumbens` (101) "Cœur du noyau accumbens"; `optic_chiasm` (161) "Chiasma optique" / "Voies visuelles"; `pineal_body` (506) "Corps pinéal" / "Diencéphale"; `substantia_nigra__compact_part` (352) "Substance noire, partie compacte" / "Tronc cérébral"; `periaqueductal_gray_substance` (465) "Substance grise périaqueducale"; `stratum_oriens_of_caudal_ca1` (565) "Stratum oriens de CA1 caudal" / "Hippocampe"; `granular_layer_of_caudal_dentate_gyrus` (559) "Couche granulaire du gyrus denté caudal"; `rostral_subiculum` (347) "Subiculum rostral"; `cuneus` (2005) "Cunéus" / "Occipital". `medial_habenular_nucleus` (10444) FR "medial habenular nucleus" / "Épithalamus". `molecular_layer_of_pva` (595) and `granular_cell_layer_of_pva` (597) → "Cerebellum" / "Cervelet", names unchanged. `anterodorsal_nucleus_of_thalamus` (10219) → "Thalamus". Label 209 and 10209 (supraoptic decussation) → "Hypothalamus". An unknown label throws "NextBrain label has no anatomical system: <id>". Every one of the 514 published NextBrain regions has a system in both languages.
- **Covered by:** `src/lib/core/catalog/labels.test.ts` (R), `labels.fr.test.ts` (R), `internal-anatomy.test.ts` (R), `nextbrain-systems.test.ts` (S for the published regions, R for 209)

### CAT-13 · Gyral white matter is named for its gyrus and grouped by lobe
- **Rule:** A wmparc white-matter region is named for its Desikan gyrus and grouped by lobe, with its own French name and group for every parcel.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/catalog/white-matter-labels*.js`; `viewer/catalog/labels.js:83-88`
- **Expected:** `precentral` EN "White matter of the precentral gyrus" / "Central white matter"; `insula` FR "Substance blanche de l’insula" / "Substance blanche insulaire". Each of the 34 Desikan parcels (bankssts … insula) has a French name and a French group that differ from the English ones.
- **Covered by:** `src/lib/core/catalog/labels.test.ts` (R)

### CAT-14 · Teaching-set and spinal cord structures use their authored names
- **Rule:** A teaching-set or supplemental structure shows its authored name and system in the reader's language, its family as subgroup, and answers to its source name and the authored aliases of that language.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/catalog/labels.js:58-70`
- **Expected:** `learning:left:caudate` with `display_names {en:'Caudate nucleus', fr:'Noyau caudé'}`, `system_names {en:'Basal ganglia', fr:'Ganglions de la base'}` → EN name "Caudate nucleus", FR group "Ganglions de la base". A cord region with aliases `{en:["Lissauer's tract"], fr:['Faisceau de Lissauer']}` is found by "lissauer" in English and "faisceau de lissauer" in French.
- **Covered by:** `src/lib/core/catalog/internal-anatomy.test.ts` (R), `catalog.test.ts` (R)

### CAT-15 · The medial wall is "Unlabelled" and never a result
- **Rule:** The unlabelled medial surface is named plainly, follows the cortex rules for display, and is never offered as a search result or list row.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/catalog/labels.js:12-15, 56`; `viewer/catalog/catalog.js:60-75`
- **Expected:** a `non-region` → EN `{name:'Unlabelled', group:'Unlabelled', code:null}`, FR "Non étiqueté". `search('unlabelled')` → no rows; no group row is a non-region; `visibleCount` excludes it.
- **Covered by:** `src/lib/core/catalog/labels.test.ts` (R), `labels.fr.test.ts` (R), `catalog.test.ts` (R)

### CAT-16 · The cerebral cortex hides the forebrain's deep structures only
- **Rule:** A structure counts as beneath the cortex when it is a deep forebrain structure; cerebellar and brainstem structures, and the cortex itself, do not.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/catalog/labels.js:47-53`
- **Expected:** on `cdmd`: `aseg:left:17` (hippocampus), `aseg:left:12` (putamen), `aseg:midline:253` (corpus callosum), `learning:left:fornix`, `learning:left:subthalamic` → true; `aseg:left:8` (cerebellar cortex), `learning:left:pons`, `learning:left:dentate`, `nextbrain:left:352` (substantia nigra), `destrieux:left:38` → false.
- **Covered by:** `src/lib/core/catalog/labels.test.ts` (S); `parity/C2.test.ts` (D, every region)

## Visibility

### CAT-17 · Each family is hidden only by the control that selects it
- **Rule:** A cortical patch is hidden by choosing another surface atlas. A structure is hidden by choosing another detail level, unless the active cut is painting its atlas. A cut-only (tissue) region is shown only on a cut of an atlas that carries it, while a cut is on; one smaller than every cut block says so.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/catalog/visibility.js:1-21, 45-58`
- **Expected:** cortex of atlas `b` with atlas `a` → `{visible:false, reason:'other-atlas'}`. Structure `aseg` with atlas `b` → visible; with detail `n` → 'other-detail'. Structure of atlas `n` with detail `aseg`, cut atlas `n`, cut on → visible; cut off → 'other-detail'. Tissue region `n` with cut atlas `n` → visible whatever the surface atlas; cut atlas `a` → 'other-cut-atlas'; `cut_atlases: []` → 'below-cut-resolution'; cut off → 'no-cut'; no cut atlas at all → hidden. wmparc with `cut_atlases ['a','b']` → visible on cut atlas `a` and `b`, 'other-cut-atlas' on `n`.
- **Covered by:** `src/lib/core/catalog/visibility.test.ts` (R); `parity/C2.test.ts` (D, 240 seeded settings × every region)

### CAT-18 · Display toggles hide what they name, and say so
- **Rule:** The hemisphere choice hides the other side but keeps midline regions. Hiding the cortex, or making it fully transparent, hides cortex, the medial wall and gyral white matter, not structures or other cut-only regions. Hiding internal anatomy hides structures. Hiding the spinal cord hides only the cord. MRI colouring hides regions not registered to the MRI.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/catalog/visibility.js:23-27, 59-75`
- **Expected:** hemisphere `right` → a left cortex 'hemisphere', a midline region visible. `cortexVisible:false` or `cortexOpacity:0` → cortex, non-region and wmparc 'cortex-hidden'; an aseg structure and a nextbrain tissue region stay visible. `internalVisible:false` → structure 'internal-hidden', cortex visible. `spinalCordVisible:false` → zanatomy 'spinal-cord-hidden', aseg visible. `surfaceColor:'mri'` with `mri_registered:false` → 'no-mri'; `surfaceColor:'tissue'` → visible. Published: the 58 zanatomy regions are the ones with `mri_registered:false`.
- **Covered by:** `src/lib/core/catalog/visibility.test.ts` (R); `parity/C2.test.ts` (D)

### CAT-19 · Removal beats isolation; isolation hides everything else
- **Rule:** A region the reader removed stays hidden even when it is the isolated one. Isolating a region hides every other region, structures and cut-only regions included.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/catalog/visibility.js:70-75`
- **Expected:** `hiddenRegions {a:left:1}`, `isolatedRegion 'a:left:1'` → 'removed'. `isolatedRegion 'other'` → cortex, structure and tissue region 'isolated'; the isolated region itself visible.
- **Covered by:** `src/lib/core/catalog/visibility.test.ts` (R)

### CAT-20 · A system exploration shows only that system
- **Rule:** While a system is explored, a structure outside it is hidden as 'other-system'; its laterality still applies. With the teaching set as detail, a source region of another atlas is in the system only if it is one of the overview's constituents.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/catalog/visibility.js:29-43`
- **Expected:** teaching-set caudate (Basal ganglia), detail `learning`: system "Basal ganglia" → visible; "Brainstem" → 'other-system'; "Basal ganglia" with hemisphere `right` → hidden. Detail `learning`, cut atlas `nextbrain` on, system "Diencephalon", constituents `{nextbrain:left:219}` → `nextbrain:left:219` visible, `nextbrain:left:108` hidden. Cortex is never 'other-system'.
- **Covered by:** `src/lib/core/catalog/internal-anatomy.test.ts` (R)

### CAT-21 · Hidden reasons come in a fixed precedence
- **Rule:** When several things hide a region, the reason given is the most fundamental: MRI registration, then the family's own control (cut resolution, cut atlas, cut, detail level or surface atlas), then system, hemisphere, cortex, internal anatomy, spinal cord, removal, isolation.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/catalog/visibility.js:45-77`
- **Expected:** settings `hemisphere:'right', cortexVisible:false, isolatedRegion:'other'`: cortex of another atlas → 'other-atlas'; left cortex of this atlas → 'hemisphere'; midline cortex → 'cortex-hidden'. A visible region → `{visible:true, reason:null}`.
- **Covered by:** `src/lib/core/catalog/visibility.test.ts` (R)

## Anatomy list and search

### CAT-22 · Search ranks exact, prefix, word start, then substring
- **Rule:** A search ignores case, surrounding spaces and accents. It ranks an exact match first, then a match at the start of a name, code or alias, then one at the start of a word, then one inside a word. A word starts after any character that is not a Unicode letter or digit. Ties go by family order, then name in the reader's language, then left before right. An empty query finds nothing.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/catalog/catalog.js:5-35, 111-136`; deviation `c2-search-word-boundary.md`
- **Expected:** fixture of `catalog.test.ts`: `search('')` and `search('   ')` → `{rows:[], total:0}`; `search('central')` → "Central sulcus" (left), "Central sulcus" (right), "Long insular gyrus and central insular sulcus", "Postcentral gyrus", "Subcentral gyrus and sulci"; `search('V1')` on hcp-mmp → first row code "V1". French "ra" over "Aire hypothalamique latérale (partie postérieure)" and "Noyau dorsal du raphé" → the raphé first. Published, French: "cunéus" and "cuneus" both find "Cunéus"; "Broca" finds 6 rows: `destrieux:left:12`, `destrieux:right:12`, `destrieux:left:14`, `destrieux:right:14`, `nextbrain:left:111`, `nextbrain:right:10111`. Published, English, destrieux surface: "cuneus" → 12 matches, the first five `nextbrain:left:2005`, `nextbrain:right:12005`, `destrieux:left:11`, `destrieux:right:11`, `wmparc:left:3005`.
- **Covered by:** `src/lib/core/catalog/catalog.test.ts` (R), `labels.fr.test.ts` (R, partial); `parity/C2.test.ts` (D, 142 queries re-ranked with the corrected word predicate)

### CAT-23 · Search finds names, codes and aliases, and keeps hidden rows
- **Rule:** A search matches display names, codes and aliases (both accented and plain forms). A matching region that is hidden is returned with its reason, never dropped.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/catalog/catalog.js:60-75, 128-135`
- **Expected:** `search('STG')` → "Lateral aspect of the superior temporal gyrus". `search('putamen')` with hemisphere `right` → one row, `visible:false`, `reason:'hemisphere'`.
- **Covered by:** `src/lib/core/catalog/catalog.test.ts` (R)

### CAT-24 · A capped result says how many there were
- **Rule:** A search returns at most the asked number of rows and the true total.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/catalog/catalog.js:111-136`
- **Expected:** published, English, destrieux surface, aseg detail: `search('s', settings, 50)` → 50 rows, total 779. Default cap 50.
- **Covered by:** `src/lib/core/catalog/catalog.test.ts` (W, asserts `total > 50`); `parity/C2.test.ts` (D)

### CAT-25 · The list shows the active atlas's groups, then structures, then the cut's regions
- **Rule:** The anatomy list holds the cortical groups of the surface atlas, the structure groups of the detail level (and the spinal cord), then the cut-only regions of the cut atlas. Groups sort by name in the reader's language; structures come first when the cortex is hidden. A lobe and a system with the same name stay two groups. Rows sort by family order, name, then hemisphere. While a system is explored, only its structures are listed.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/catalog/catalog.js:138-180`
- **Expected:** `catalog.test.ts` fixture: names `['Central','Insula','Parietal','Temporal','Basal ganglia']`, rows `[3,1,1,1,1]`, kinds cortex ×4 then structure; hcp-mmp → `['V–Z','Basal ganglia']`; Limbic lobe + Limbic system → keys `cortex:Limbic`, `structure:Limbic`. With `cortexVisible:false` → `['Basal ganglia','Central','Insula','Parietal','Temporal']`. Cut-only regions appear as a `tissue` group only under their cut atlas (any surface atlas). Spinal cord rows under "Spinal cord": Cuneate fasciculus (left), Gracile fasciculus (left), Gracile fasciculus (right), Anterior horn of spinal cord, Cauda equina. Published, English, destrieux, aseg: group keys `cortex:Central` (6), `Cingulate` (14), `Frontal` (38), `Insula` (10), `Lateral fissure` (6), `Limbic` (4), `Occipital` (26), `Parietal` (18), `Temporal` (26), then `structure:Basal ganglia` (8), `Brainstem` (1), `Cerebellum` (4), `Corpus callosum` (5), `Diencephalon` (4), `Limbic` (4), `Spinal cord` (58), `Ventricles and CSF` (6). With a nextbrain cut on: 18 tissue groups.
- **Covered by:** `src/lib/core/catalog/catalog.test.ts` (R; the cortex-hidden order and the system filter are uncovered there); `parity/C2.test.ts` (D)

### CAT-26 · Under CAB-NP colouring, HCP-MMP areas are listed by CAB-NP network
- **Rule:** While CAB-NP colours the surface, HCP-MMP areas are grouped, labelled and searched under the CAB-NP network their colour shows, in the reader's language. Other colourings use the Yeo grouping.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/catalog/catalog.js:82-93`
- **Expected:** fixture: Yeo groups `['Default mode','Visual']` for no colouring and `network`; `cab-np` → `['Language','Primary visual']`, FR `['Langage','Visuel primaire']`; `label('h:l:44', cab-np)` group "Language", with `atlas` colouring "Default mode"; `search('44', cab-np)` first row group "Language". Published hcp-mmp: Yeo groups Default mode 88, Dorsal attention 41, Frontoparietal control 43, Limbic 27, Salience / ventral attention 48, Somatomotor 49, Visual 64; CAB-NP groups (12) Auditory 15, Cingulo-opercular 56, Default mode 77, Dorsal attention 23, Frontoparietal 50, Language 23, Orbito-affective 6, Posterior multimodal 7, Primary visual 6, Secondary visual 54, Somatomotor 39, Ventral multimodal 4.
- **Covered by:** `src/lib/core/catalog/catalog.test.ts` (R, fixture); `parity/C2.test.ts` (D)

### CAT-27 · The visible count excludes the medial surfaces
- **Rule:** The data bar's count of visible regions counts selectable regions only.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/catalog/catalog.js:182-188`
- **Expected:** published, aseg detail, no cut: destrieux surface 238 (148 + 32 + 58), hcp-mmp 450 (360 + 90), cortex hidden 90.
- **Covered by:** `src/lib/core/catalog/catalog.test.ts` (S, derived from the manifest's declared counts); `parity/C2.test.ts` (D)

### CAT-28 · The list follows the reader's language
- **Rule:** Switching the language relabels the list and the search, and switching back restores the first labels. An unknown id has no entry.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/catalog/catalog.js:95-109`
- **Expected:** a catalogue built in `en`, switched to `fr`, `en`, `fr`: each `groups(...)` equals that of a catalogue built fresh in that language (published, French destrieux group names: Central, Cingulaire, Frontal, Insula, Limbique, Occipital, Pariétal, Scissure latérale, Temporal, then Cervelet, Corps calleux, Diencéphale, Ganglions de la base, Limbique, Moelle épinière, Tronc cérébral, Ventricules et LCS). `get('not-a-region')` → null.
- **Covered by:** `parity/C2.test.ts` (D); uncovered as a fixed-value test

## Networks

### CAT-29 · Yeo networks read as their published names
- **Rule:** A Yeo network abbreviation reads as its spelled-out name in the reader's language; an unknown key is shown as is, and a language with no table reads English.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/catalog/networks.js:10-22, 46-49`; `viewer/catalog/networks.fr.js`
- **Expected:** Vis Visual / Visuel; SomMot Somatomotor / Somatomoteur; DorsAttn Dorsal attention / Attention dorsale; SalVentAttn Salience / ventral attention / Saillance / attention ventrale; Limbic Limbic / Limbique; Cont Frontoparietal control / Contrôle frontopariétal; Default Default mode / Mode par défaut. `networkName('Invented')` "Invented"; `networkName('Cont','de')` "Frontoparietal control".
- **Covered by:** `src/lib/core/catalog/networks.test.ts` (R); `parity/C2.test.ts` (D)

### CAT-30 · Network shares under 5 % are hidden and the rest are not rescaled
- **Rule:** A region's network shares below 5 % are not shown; a share of exactly 5 % is. The shown shares keep their values. The dominant network is the first share that survives; a region with none has no dominant network.
- **Kind:** scientific
- **Level:** unit
- **Source:** `viewer/catalog/networks.js:44, 75-90`
- **Expected:** shares SomMot 0.75, DorsAttn 0.21, Default 0.04 → SomMot, DorsAttn, summing to 0.96; Vis 0.05 kept; `networksOf({})` and `(undefined)` → []; dominant of Limbic 0.6, Vis 0.4 → Limbic; dominant of Vis 0.01 → null.
- **Covered by:** `src/lib/core/catalog/networks.test.ts` (R); `parity/C2.test.ts` (D)

### CAT-31 · CAB-NP networks are Ji et al.'s, and the partition is checked
- **Rule:** The twelve CAB-NP networks read as Ji et al. (2019) name them. The published partition must name only known networks, give each a colour, and assign only regions of its atlas to its networks.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/catalog/networks.js:24-42, 51-73`
- **Expected:** `cabNpName('Visual1')` "Primary visual"; `('Orbito-Affective','fr')` "Orbito-affectif"; `('Invented')` throws "Unknown CAB-NP network: Invented". A network without colour throws "CAB-NP network has no colour: Default"; an assignment to an undeclared network throws "Invalid CAB-NP assignment: <id>"; a wrong id throws "Invalid CAB-NP partition.". Published `cab-np.json`: id "cab-np", atlas "hcp-mmp", 12 networks (Visual1, Visual2, Somatomotor, Cingulo-Opercular, Dorsal-Attention, Language, Frontoparietal, Auditory, Default, Posterior-Multimodal, Ventral-Multimodal, Orbito-Affective), 360 assignments, valid.
- **Covered by:** `src/lib/core/catalog/networks.test.ts` (R, S for the published names); `parity/C2.test.ts` (D)

### CAT-32 · A network share says what it counted
- **Rule:** Network shares of cortical parcels count surface vertices; those of projected NextBrain regions count voxels. Any other region has no defined basis.
- **Kind:** scientific
- **Level:** unit
- **Source:** `viewer/catalog/networks.js:80-85`
- **Expected:** destrieux or hcp-mmp → 'vertices'; nextbrain tissue-region → 'voxels'; other → throws /basis/. All 580 published regions with networks have a basis.
- **Covered by:** `src/lib/core/catalog/network-basis.test.ts` (R, S); `parity/C2.test.ts` (D)

## Functional regions

### CAT-33 · The functional partition is checked against the regions it assigns
- **Rule:** The functional-region file must have both levels; each record needs a unique id, names and short names in both languages, a colour, a known source and at least one area; each assignment must name an area of its atlas and a defined record.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/catalog/functional-regions.js:8-33`
- **Expected:** a record with an unknown source or no colour → "Invalid functional region: <id>"; an assignment to a Destrieux region or to an undefined record → "Invalid functional-region assignment: <id>"; a missing level → "Functional-region partition has no <level> level."; a wrong id → "Invalid functional-region partition.".
- **Covered by:** `src/lib/core/catalog/functional-regions.test.ts` (R); `parity/C2.test.ts` (D)

### CAT-34 · Every HCP-MMP area has a section, and a named region only where one is published
- **Rule:** An area belongs to one of Glasser's 22 sections and, where a source names one, to a named region. Names and key labels are read in the reader's language.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/catalog/functional-regions.js:35-43`
- **Expected:** fixture: `hcp-mmp:left:8` named `m1`, section `section-6`; `hcp-mmp:left:84` named null, section `section-22`; null partition → null. `functionalName(m1,'fr')` "Cortex moteur primaire (M1)"; `functionalShortName(section-22)` "Dorsolateral prefrontal", FR "Préfrontal dorsolatéral". Published: levels `['named','sections']`, 22 sections, 21 named regions (v1, mt, ffc, m1, s1, s2, sma, fef, pef, broca, a1, lateral-ofc, medial-ofc, subgenual-cingulate, pregenual-acc, area-10, supracallosal-acc, midcingulate, pcc-1, pcc-2, pcc-3), every one of the 360 areas in a section, 114 in a named region, 3 sources (glasser-2016, rolls-2022-ofc, rolls-2023-pcc).
- **Covered by:** `src/lib/core/catalog/functional-regions.test.ts` (R, S: 22 sections and 360 areas); `parity/C2.test.ts` (D)

## Neuropsychological domains and term search

### CAT-35 · The domain partition is checked against the regions it scores
- **Rule:** The domain file needs unique groups with both names; domains with a unique id other than "all", both names, a term, a known group, an overview flag, a colour, a study count and a lesion check; at least one overview domain; a z scale that starts at the threshold and rises; and assignments only to scored regions, with known domains at or above the threshold.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/catalog/neuropsych-domains.js:51-90`
- **Expected:** with the `neuropsych-domains.test.ts` fixture: z 2.9 under threshold 3, a Destrieux region, an unknown domain, or an unsampled aseg structure (Left-Lateral-Ventricle) → "Invalid neuropsychological-domain assignment: <id>"; missing lesion check, unknown group, id "all", missing overview flag, missing study count → "Invalid neuropsychological domain: <id>"; first band ≠ threshold or a band not above the last → "Invalid neuropsychological-domain z scale."; duplicate group → "Invalid neuropsychological-domain group: cognition"; no overview domain → "No neuropsychological domain is in the overview.".
- **Covered by:** `src/lib/core/catalog/neuropsych-domains.test.ts` (R); `parity/C2.test.ts` (D)

### CAT-36 · An area is drawn as its strongest overview domain, or the one picked
- **Rule:** An area lists its domains strongest first. With no domain picked it is drawn as its strongest overview domain (passing over a stronger one shown only alone); with one picked that it reaches, as that one. A sampled aseg structure is scored like an area.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/catalog/neuropsych-domains.js:119-134, 150-152`
- **Expected:** fixture: `hcp-mmp:left:1` → memory 7.5, language 3.2; shown null → memory, picked language → language; unscored area → [] and null. With memory not overview: overview `['language','visual']`, shown null → language, picked memory → memory. `scoredRegion`: aseg Left-Amygdala true, Left-Lateral-Ventricle false, hcp-mmp cortex true, destrieux false.
- **Covered by:** `src/lib/core/catalog/neuropsych-domains.test.ts` (R); `parity/C2.test.ts` (D)

### CAT-37 · The Functions list groups domains in authored order and filters by either name or term
- **Rule:** The list shows the groups in authored order, each with its domains in authored order, filtered by a query that matches an English name, a French name or the term, ignoring case and accents. Empty groups are left out.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/catalog/neuropsych-domains.js:139-148`
- **Expected:** fixture: `''` FR → `[['Cognition',['language','memory']],['Perception',['visual']]]`; "EPISODIC" → `[['memory']]`; "memoire" → `[['memory']]`; "praxis" → []. Published, empty query: attention-executive 14, memory 8, language-number 13, perception 14, sensorimotor 10, social-emotional 11.
- **Covered by:** `src/lib/core/catalog/neuropsych-domains.test.ts` (R); `parity/C2.test.ts` (D)

### CAT-38 · A domain lists every area it reaches, strongest first
- **Rule:** A domain or searched term lists every area and structure that reaches it, strongest first, ties in published order, with the number of studies its term rests on.
- **Kind:** scientific
- **Level:** unit
- **Source:** `viewer/catalog/neuropsych-domains.js:96-101, 154-161`
- **Expected:** fixture: language → `hcp-mmp:right:1` 4.1, `hcp-mmp:left:1` 3.2; memory → `hcp-mmp:left:1` 7.5, `aseg:left:18` 3.5; visual → []; `domainStudies('language')` 1101, `('term:fear')` 363. Published: language reaches 96 regions, first `hcp-mmp:left:81` z 20.26, then `hcp-mmp:left:74` z 18.29; 1101 studies.
- **Covered by:** `src/lib/core/catalog/neuropsych-domains.test.ts` (R); `parity/C2.test.ts` (D)

### CAT-39 · The model paint: overview colours, or z bands for one domain
- **Rule:** The overview paints each scored area in its shown domain's colour. One domain or term paints each area it reaches in the colour of its z band: the last band whose start the z reaches. An unknown domain fails.
- **Kind:** scientific
- **Level:** unit
- **Source:** `viewer/catalog/neuropsych-domains.js:163-181`
- **Expected:** fixture bands 3 / 5 / 10: overview id "function:all" → `hcp-mmp:left:1` [4,5,6], `hcp-mmp:right:1` [1,2,3], `aseg:left:18` [4,5,6]; language → both [30,30,30]; memory → `hcp-mmp:left:1` [50,50,50], `aseg:left:18` [30,30,30]; `term:fear` id "function:term:fear", `aseg:left:18` [50,50,50]; "praxis" and "term:praxis" throw "Unknown neuropsychological domain: <id>". Published bands start at 3, 5, 10: z 2.9 → none, 3 and 4.99 → 3, 5 → 5, 10 and 25 → 10. Published overview paint colours 249 of the 289 scored regions.
- **Covered by:** `src/lib/core/catalog/neuropsych-domains.test.ts` (R); `parity/C2.test.ts` (D, every domain and term on the published data)

### CAT-40 · The Neurosynth term search is checked
- **Rule:** The term file must match the domain file's atlases and threshold, name only scored regions, and give each term once, not repeating a curated domain's term, with an integer study count, a kind (function or population) and at least one region at or above the threshold.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/catalog/neuropsych-domains.js:24-49`
- **Expected:** fixture: z 2.9, a region index out of range, a repeated term, no regions, kind "anatomy", or the curated term "language" → "Invalid Neurosynth term: <term>"; an unscored region → "Invalid Neurosynth term region: aseg:left:4"; another threshold or atlas → "Invalid Neurosynth term search.". `term:aphasia` kind population; `term:language` has no record.
- **Covered by:** `src/lib/core/catalog/neuropsych-domains.test.ts` (R); `parity/C2.test.ts` (D)

### CAT-41 · Term search ranks the term itself, then word starts, then the rest
- **Rule:** A term query (case, spaces and accents ignored) returns the terms containing it: the exact term first, then terms with a word starting with it, then the rest; more studies first within each, then alphabetical.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/catalog/neuropsych-domains.js:103-112`
- **Expected:** fixture: " Fear " → fear, fear conditioning, conditioned fear; "cond" → fear conditioning, conditioned fear; "fer" → interference; "" → []; with no term file → []. Published "fear" → fearful (221 studies), fearful faces (91).
- **Covered by:** `src/lib/core/catalog/neuropsych-domains.test.ts` (R); `parity/C2.test.ts` (D)

### CAT-42 · A misspelt query is offered the closest name
- **Rule:** A query of four letters or more that matched nothing is offered the closest name within one edit per four letters (insertion, deletion, substitution or swap of neighbours), ignoring case and accents; ties go to the earlier name. The Functions list offers curated names first, then terms; the Deficits list offers deficit names and aliases.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/catalog/nearest.js`; `viewer/catalog/neuropsych-domains.js:114-117`; `viewer/clinical/catalog.js:97`
- **Expected:** domains fixture: "Langauge" → "Language"; "interferance" → "interference"; FR "memoire" → "Mémoire"; "nicotine" → null; "fea" → null. Published clinical: "aphasai" (en) → "Aphasia"; "amnesie" (fr) → "Amnésie"; "abc" → null.
- **Covered by:** `src/lib/core/catalog/neuropsych-domains.test.ts` (R); `parity/C2.test.ts` (D, 60 seeded misspellings), `parity/C3.test.ts` (D, clinical); clinical nearest uncovered as fixed values

### CAT-43 · The published domains and terms
- **Rule:** The Functions explorer offers the published curated domains and Neurosynth terms.
- **Kind:** data
- **Level:** unit
- **Source:** `public/models/cdmd/neuropsych-domains.json`, `neurosynth-terms.json`
- **Expected:** atlas hcp-mmp, structure atlas aseg with 19 sampled structures, threshold z 3, bands from 3, 5, 10; 6 groups (attention-executive, memory, language-number, perception, sensorimotor, social-emotional); 70 domains, 11 in the overview (executive, working-memory, long-term-memory, language, attention, visuospatial, social-cognition, visual-perception, motor, auditory-perception, emotion); 289 scored regions; 277 terms (232 function, 45 population) over 379 regions; the files validate together.
- **Covered by:** `parity/C2.test.ts` (D, validation only); uncovered as fixed values

## Clinical catalogue

### CAT-44 · The clinical records are checked before use
- **Rule:** The deficit catalogue refuses data that is incomplete, untranslated or not linked to the atlas, and names the record at fault.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/clinical/validate.js`
- **Expected:** messages start "Invalid clinical catalog: ". Revision date not `YYYY-MM-DD` → "revision date is required". Groups, deficits, references, associations or manifest regions missing or empty → "<kind> records are required"; a blank, null or numeric id → "<kind> id is required"; a repeated id → "Duplicate <kind>: <id>". A group, deficit (name, domain, summary), reference (population), association (title, finding, limitation, network, mapping_note) or correction (summary) text missing or blank in either language → "<id>: <field>.<lang> is required". Deficit: unknown group → "unknown group"; aliases not a list of non-empty terms in each language → "aliases.<lang> must be a list of terms"; a group with no deficit → "<group>: group has no deficits". Reference: title, authors, journal blank → "<field> is required"; year not an integer ≥ 1800 (1799, 2020.5, "1990") → "year must be a publication year"; DOI not `10.NNNN/…` (e.g. "javascript:alert(1)", "10.12/x", "10.1234/") → "invalid doi"; PMID not digits → "invalid pmid"; method not lesion-mapping, meta-analysis, case-report or case-series → "unknown method"; scope not abstract or full-text → "source scope is required"; corrections not a list → "corrections must be a list"; a correction DOI invalid → "invalid correction doi". Association: unknown deficit → "unknown deficit"; laterality not left, right or bilateral → "invalid laterality"; no supporting evidence → "supporting evidence is required"; unknown reference → "unknown reference <id>"; role not supporting or qualifying → "invalid evidence role"; mappings not a list → "mappings must be a list"; a mapped region unknown or a non-region → "unknown region <id>"; its source name different (after `&` = `_and_`) → "source_name disagrees with <id>"; a side other than the association's laterality → "hemisphere mismatch"; a region twice → "duplicate region <id>". A source name spelled with `&` where the manifest has `_and_` is accepted.
- **Covered by:** `src/lib/core/clinical/catalog.test.ts` (R, 14 of these); `parity/C3.test.ts` (D, 46 seeded mutations and the branch-reach suite)

### CAT-45 · Deficit search finds names, domains, synonyms and findings in the reader's language
- **Rule:** A deficit search ignores case, spaces and accents and matches a deficit's name, domain, aliases, and its findings' titles and networks in the reader's language. The deficit whose name is the query comes first, then the rest alphabetically. An empty query lists every deficit. A language other than English or French fails.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/clinical/catalog.js:64-90`
- **Expected:** fixture: "amnesie" (fr), "mémoire" (fr), "oubli" (fr), "forgetfulness" (en), "memory" (en) → `['amnesia']`; "" → 1; "unlisted" → []; `search('x','de')` throws "Unknown language: de". Published: "prosopagnosie" (fr) first `agnosia`; "set shifting" first `executive`; "champ visuel" (fr) first `hemianopia`; "reading" first `alexia`; "amnesia" → `['amnesia']`; "memory" (en) → `['agraphia','amnesia']`.
- **Covered by:** `src/lib/core/clinical/catalog.test.ts` (R), `data.test.ts` (S); `parity/C3.test.ts` (D)

### CAT-46 · Deficits list under their groups in authored order
- **Rule:** The Deficits list shows matching deficits under their group, groups in authored order, and leaves out a group with no match.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/clinical/catalog.js:14-24, 95`
- **Expected:** groups language, memory, motor with amnesia (memory), aphasia and dysarthria (language) → `[['language',['aphasia','dysarthria']],['memory',['amnesia']]]`; no deficits → []; fixture `grouped('oubli','fr')` → group "Mémoire et orientation spatiale"; `grouped('unlisted')` → []. Published `grouped('')`: attention-executive, memory, language-number, perception, sensorimotor, social-emotional, holding all 40 deficits.
- **Covered by:** `src/lib/core/clinical/catalog.test.ts` (R), `data.test.ts` (S)

### CAT-47 · A deficit and a region reach the same cited findings
- **Rule:** The findings of a deficit and those that map a region are the same records. A region no finding maps has none, whatever another atlas maps. An unknown deficit, reference, region or finding fails.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/clinical/catalog.js:7-12, 55-99`
- **Expected:** fixture: `forDeficit('amnesia')[0]` is `forRegion('aseg:left:17')[0]`; its reference PMID "3760943"; `forRegion('hcp-mmp:left:1')` → []. `get`, `reference`, `forDeficit`, `forRegion`, `mappedRegions`, `paint` of "missing" throw "Unknown deficit|reference|deficit|region|deficit|deficit: missing".
- **Covered by:** `src/lib/core/clinical/catalog.test.ts` (R); `parity/C3.test.ts` (D)

### CAT-48 · A deficit maps each cited region once, in citation order
- **Rule:** The regions a deficit outlines are those its findings map, once each, in the order they are cited.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/clinical/catalog.js:51-53`
- **Expected:** findings mapping [a, b], [], [b, c] → [a, b, c]. Published `mappedRegions('aphasia')` starts `destrieux:left:38`, `destrieux:left:34`.
- **Covered by:** `src/lib/core/clinical/catalog.test.ts` (R), `data.test.ts` (S)

### CAT-49 · Each finding has its own colour, up to six
- **Rule:** A deficit's findings take the six finding colours in citation order. A region two findings map takes the first one's colour. One finding can be shown alone. A deficit with more findings than colours, or an unknown finding, fails. Every published deficit fits.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/clinical/catalog.js:26-49`
- **Expected:** `FINDING_COLORS` = [57,135,229], [213,81,129], [0,131,0], [201,133,0], [98,80,214], [232,123,164]. Findings naming [a, b] and repetition [b, c]: paint id "deficit:aphasia", a and b colour 0, c colour 1; alone "repetition": id "deficit:aphasia:repetition", b and c colour 1; "reading" throws "aphasia has no finding reading.". Seven findings throw "<deficit> has more findings than finding colours.". Published: aphasia has 6 findings (the most), and its paint colours 7 regions.
- **Covered by:** `src/lib/core/clinical/catalog.test.ts` (R), `data.test.ts` (S); `parity/C3.test.ts` (D, the colours and the seven-finding throw)

### CAT-50 · The published clinical content
- **Rule:** The Deficits explorer serves the published records, linked to the default anatomy.
- **Kind:** data
- **Level:** unit
- **Source:** `data/neuropsychology.yaml`; `viewer/clinical/data.test.js`
- **Expected:** revised "2026-10-22"; 6 groups, 40 deficits (abulia … word-deafness, the list in `data.test.ts`), 60 references, 58 associations; every deficit has a finding. `forRegion`: `destrieux:left:38` deficits aphasia, aphasia, aphasia, akinetopsia; `destrieux:right:21` agnosia; `aseg:left:17` and `aseg:right:53` amnesia; `destrieux:left:16` none; `destrieux:right:38` neglect-allocentric, akinetopsia-lateral; `destrieux:right:26` extinction-temporoparietal, neglect-egocentric, neglect-perceptual; `destrieux:left:12` apraxia-finger, dysphagia-insula, emotion-prosody, speech-apraxia-frontal; `aseg:left:18` emotion-recognition; `learning:right:dentate` ataxia; `nextbrain:left:458` central-pain, lateropulsion; `aseg:right:47` ataxia, cerebellar-cognitive, dysarthria. `forDeficit('amnesia')` hippocampal-amnesia, amnesia-fornix, amnesia-diencephalic; `speech-apraxia` 2 findings, each with qualifying evidence; every apraxia finding and the first hemichorea finding have qualifying evidence; a meta-analysis is cited.
- **Covered by:** `src/lib/core/clinical/data.test.ts` (S); `parity/C3.test.ts` (D)

## Circuits and lessons

### CAT-51 · The circuit records are checked before use
- **Rule:** The circuit catalogue refuses lessons that are untranslated, uncited or not resolvable to exact landmarks of the anatomy.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/learning/catalog.js`
- **Expected:** revised blank → "Missing text: revised". Context margin not a finite positive number (0, −1, NaN, Infinity, "12") → RangeError "Circuit context margin must be positive millimetres.". Circuits or references empty or not a list → "Empty circuit" / "Empty reference"; a blank id → "Missing text: circuit.id"; a repeat → "Duplicate circuit: <id>" / "Duplicate reference: <id>". Reference: title or citation blank → "Missing text: <id>.title|citation"; URL not https → "Invalid reference URL: <id>" (unparsable → "Invalid URL"); neither PMID (digits) nor NBK accession (`NBK` + digits) → "Missing PMID or NBK accession: <id>"; PMCID present but not `PMC` + digits → "Invalid PMCID: <id>". Circuit and landmark texts (circuit name, summary, route, scope, clinical; landmark name, role, explanation, mapping) need non-empty `en` and `fr` → "Missing text: <id>.<field>.<lang>", and no other key → "Unexpected translation field: <id>.<field>". Unknown deficit → "Unknown clinical target: <id>"; no references → "Missing references: <id>"; unknown reference → "Unknown reference: <id>". Landmark: unknown region → "Unknown region: <id>"; source name different → "Source mismatch: <id>"; region not cortex or structure → "Unsupported landmark: <id>"; view not a camera preset (e.g. "diagonal", "toString") → "Unknown view: <view>"; plane not axial, coronal or sagittal → "Unknown MRI plane: <plane>"; repeated landmark → "Duplicate <circuit> landmark: <id>".
- **Covered by:** `src/lib/core/learning/catalog.test.ts` (R for source, French text, view, covering regions; W for eight changes asserted with a bare `throws`); `parity/C3.test.ts` (D, 30 seeded mutations and the branch-reach suite)

### CAT-52 · A landmark resolves to one form, and uncovers what others cover
- **Rule:** A landmark with alternatives (the cerebellar cortex whole or as lobules) resolves to the one form whose regions all exist in this anatomy; zero or two forms fail. Covering regions must be different structures of the landmark's atlas and side. Arriving at a landmark restores what the other landmarks of the circuit cover.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/learning/catalog.js:36-70, 95-110`
- **Expected:** "<n> forms of landmark <id> resolve in this anatomy: <region>" for n = 0 and 2. Covering regions [] → "Empty covering regions: <id>"; "x" → same; ["missing"] → "Unknown covering region: missing"; the landmark itself, another side, another atlas, a cortex → "Invalid covering region: <id>". Published `cerebellar`: landmark 1 `learning:lobule-v-left` where lobules are published, else `learning:cerebellar-cortex-left`; landmark 2 covers 10 left lobules (or the cerebellar cortex); landmarks 1, 3, 4 and 5 each restore those 10.
- **Covered by:** `src/lib/core/learning/catalog.test.ts` (R, S); `parity/C3.test.ts` (D)

### CAT-53 · The published circuits
- **Rule:** The Circuits explorer serves nine guided circuits, each tied to a deficit, resolving to exact landmarks of the default anatomy.
- **Kind:** data
- **Level:** unit
- **Source:** `data/circuits.yaml`; `viewer/learning/catalog.test.js`
- **Expected:** revised "2026-10-24"; context margin 12 mm; 25 references, each URL `https://`; circuits in order vision (4 landmarks, hemianopia), memory (5, amnesia), motor (6, parkinsonism), hearing (3, word-deafness), touch (3, somatosensory), language (4, aphasia), attention (3, neglect), cerebellar (5, ataxia), praxis (6, apraxia): 39 landmarks. vision ends at `hcp-mmp:left:1`; memory ends at source "Thalamus"; hearing's landmark 2 is "Dorsal medial geniculate nucleus" and it ends at `hcp-mmp:left:24`; cerebellar sides left, left, left, right, right, landmarks 3 to 5 "Superior cerebellar peduncle", "Thalamus", "R_4_ROI"; praxis all left: L_MIP_ROI, L_6a_ROI, L_MT_ROI, L_PFt_ROI, L_6v_ROI, G_temporal_middle.
- **Covered by:** `src/lib/core/learning/catalog.test.ts` (S); `parity/C3.test.ts` (D)

### CAT-54 · An unknown circuit, landmark or reference fails
- **Rule:** Asking the circuit catalogue for something it does not hold throws.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/learning/catalog.js:25-30, 112-118`
- **Expected:** `get('missing')` "Unknown circuit: missing"; `step('missing','chiasm')` "Unknown circuit: missing"; `step('vision','missing')` "Unknown landmark: missing"; `reference('missing')` "Unknown reference: missing".
- **Covered by:** `src/lib/core/learning/catalog.test.ts` (R, two of four); `parity/C3.test.ts` (D)

### CAT-55 · A lesson remembers where it is and what was seen
- **Rule:** Starting a circuit opens its first landmark. Going to a landmark records it as seen, once, in visit order. A start of an unknown circuit, or a move to a landmark that does not exist, fails and changes nothing. Closing forgets the lesson. Restarting starts over. A snapshot is a copy.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/learning/session.js`
- **Expected:** new → `{circuit:null, step:0, visited:[]}`; start vision, go 1 → `{circuit:'vision', step:1, visited:[0,1]}`; go 2, −1, 0.5, NaN, "1" → RangeError "Invalid landmark index: <n>"; go 1, 0, 1 → visited [0,1]; start vision again → `{step:0, visited:[0]}`; start "missing" → throws, state unchanged; go before any start → throws "Unknown circuit: null"; close → `{circuit:null, step:0, visited:[]}`; mutating a snapshot leaves the session unchanged.
- **Covered by:** `src/lib/core/learning/session.test.ts` (R); `parity/C3.test.ts` (D, 40 seeded sequences); go-before-start uncovered as a fixed value

### CAT-56 · Every citation names the work its identifiers point to
- **Rule:** Each clinical, circuit, functional-region, domain and bibliography citation matches the record its PMID, DOI or Bookshelf id resolves to: title, authors, PubMed issue year and published corrections. The records file holds exactly the cited works.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/learning/references.test.js`; `data/reference-records.json` (written by `scripts/fetch_references.py`)
- **Expected:** for every reference: DOI equal (case-insensitive); title equal ignoring case, accents and punctuation; author surnames equal; year = PubDate year (except Bookshelf); corrections' DOIs equal (circuit and source references have none). Circuit URLs: `https://www.ncbi.nlm.nih.gov/books/<NBK>/`, else `https://pmc.ncbi.nlm.nih.gov/articles/<PMCID>/`, else `https://pubmed.ncbi.nlm.nih.gov/<PMID>/`. At least 12 bibliography lines with a DOI, each with a PMID. The cited set equals the keys of `records`.
- **Covered by:** `src/lib/core/learning/references.test.ts` (S)

## Atlas comparison

### CAT-57 · A comparison gives each overlap as a share of this region
- **Rule:** For a cortical region of one atlas, the comparison lists the regions of the other atlas it overlaps, largest first (ties by target id), each with its area and its share of this region's whole area. The unassigned labels' overlap is added up apart. A non-cortical or unassigned region has no comparison; an unknown id fails.
- **Kind:** scientific
- **Level:** unit
- **Source:** `viewer/comparison/catalog.js:165-195`
- **Expected:** fixture: `comparisonFor('destrieux:left:1')` → target hcp-mmp, total 10, rows h1 6 (0.6, `overlap-0`), h2 3 (0.3, `overlap-1`), unassigned 1 (0.1); `comparisonFor('hcp-mmp:left:1')` → target destrieux, total 9, first share 6/9, unassigned 1/9. A 1e-12 mm² overlap is kept with share 1e-12/total. `aseg:left:11` and `destrieux:left:-1` → null; "missing" → "Unknown region: missing". Two unassigned labels (1 + 0.5) → unassigned 1.5, share 1.5/10.5, 2 rows. Equal areas order by target id ascending. Changing a returned row does not change the next answer.
- **Covered by:** `src/lib/core/comparison/catalog.test.ts` (R); `parity/C3.test.ts` (D; the equal-area tie-break only there)

### CAT-58 · The comparison file is checked against the manifest and conserves area
- **Rule:** The comparison data must name this subject, the two cortical atlases in order, the original pial surface, the barycentric vertex-cell method and mm²; pin every source and asset by SHA-256 and match the manifest's atlas files and citations; give a positive total for every cortical region; and give pairs of valid, same-side regions, once each, with unique mesh ids and positive areas, whose sums equal each region's total within a relative 1e-10.
- **Kind:** scientific
- **Level:** unit
- **Source:** `viewer/comparison/catalog.js:3-137`
- **Expected:** every failure reads "Invalid atlas comparison: <description>.": manifest: "missing subject identity", "missing declared comparison file", "missing or invalid declared comparison SHA-256", "missing manifest regions", "invalid or duplicate manifest region", "invalid cortical region metadata for <id>", "missing anatomical name for <id>"; identity: "expected schema_version 1", "comparison subject does not match manifest", "invalid atlas order or identity", "expected the original pial surface", "invalid area measurement method", "area units must be mm2", "missing overlap geometry file", "missing or invalid overlap geometry SHA-256"; sources: "missing hemisphere source provenance", "invalid or duplicate source hemisphere", "missing … pial source file", "… pial source SHA-256", "missing <side> annotations", "… annotation source SHA-256", "invalid or duplicate <side> annotation atlas"; assets: "missing cortical asset provenance", "… cortical atlas asset SHA-256", "invalid or duplicate cortical atlas asset", "cortical asset file or citation does not match <atlas>"; totals: "missing per-region area totals", "incomplete per-region area totals", "unknown region or invalid total for <id>" (0, −1, Infinity, NaN, "10", null); pairs: "missing overlap pairs", "invalid overlap region identifiers", "overlap region atlas or hemisphere mismatch" (unknown id, swapped atlases, mixed sides), "duplicate overlap pair <a|b>", "invalid or duplicate overlap mesh ID", "invalid overlap area for <a|b>" (0, −6, NaN, "6"), "overlap marginal does not conserve the whole area of <id>". A total × (1 + 5e-11) is accepted, × (1 + 2e-10) rejected.
- **Covered by:** `src/lib/core/comparison/catalog.test.ts` (R, 39 malformed-data cases and 4 manifest cases, asserting only the "Invalid atlas comparison:" prefix); `parity/C3.test.ts` (D, 47 seeded mutations and the branch-reach suite, by message)

### CAT-59 · The CSV keeps every label, full precision and the provenance
- **Rule:** The comparison CSV has one row per overlap, unassigned labels each on their own row, numbers at full precision, region names in the chosen language and the provenance needed to reproduce it. Cells holding a comma, quote or line break are quoted; lines end with CRLF. Only English and French exports exist; a non-cortical region has none.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/comparison/catalog.js:139-163, 196-210`
- **Expected:** columns in order: schema_version, anatomy_id, subject, surface, method, units, sources_json, atlas_assets_json, geometry_file, geometry_sha256, comparison_file, comparison_sha256, reconstruction, hcp_projected_from (each only when the manifest has it), source_atlas, source_region_id, source_region_name, source_annotation_name, target_atlas, total_area_mm2, target_region_id, target_region_name, target_source_name, target_kind, area_mm2, fraction, mesh_id. Fixture, area 6.123456789012345: `area_mm2` "6.123456789012345", `fraction` = String(area / (area + 4)); subject `Subject, "one"` round-trips; FR names from the French labels; the unassigned row has `target_kind` "non-region", source name "Unknown", area "1". `exportCsv(id,'de')` throws "Unknown comparison export language: de"; a non-cortical region throws "Cannot export a cortical comparison for region: <id>"; default language English.
- **Covered by:** `src/lib/core/comparison/catalog.test.ts` (R); `parity/C3.test.ts` (D)

### CAT-60 · The published comparison conserves every cortical region both ways
- **Rule:** On the published data every cortical region's overlaps and unassigned part add up to its total, each overlap is the same seen from either side, and the CSV has one row per pair.
- **Kind:** scientific
- **Level:** unit
- **Source:** `public/models/cdmd/atlas-comparison.json`
- **Expected:** 1202 pairs, 512 totals (508 cortical regions and 4 unassigned labels), method "barycentric-vertex-cells"; for every one of the 508 regions |Σ rows + unassigned − total| ≤ total × 1e-10; each row's reverse has the same area and mesh id; share = area / total exactly. `destrieux:left:38`: target hcp-mmp, total 2157.579 mm² (± 1e-9), 10 rows, the first `hcp-mmp:left:132` 683.954 mm² (share 0.31700 ± 1e-5, mesh `overlap:left:38:132`), then `hcp-mmp:left:137` 460.214 mm², unassigned 0; its CSV has 10 rows.
- **Covered by:** `src/lib/core/comparison/catalog.test.ts` (S, conservation and reversibility; the fixed example values are uncovered); `parity/C3.test.ts` (D)

## Diffusion

### CAT-61 · Tracts come from the catalogues the config names
- **Rule:** The viewer serves exactly the tract catalogues `config/model.yaml` lists, each owned by one published anatomy, with the same dataset copy keys in both languages. An anatomy with its own tracts gets them; any other gets CDMD's as an independent reference.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/diffusion/catalogs.js`; `viewer/diffusion/catalogs.test.js`
- **Expected:** `config/model.yaml` `tract_catalogs` = `['data/diffusion-cdmd.yaml']`; `TRACT_CATALOGS` equals that file parsed; catalogue id "cdmd-sub-013", anatomy "cdmd", reference space "cdmd-sub-013/surface-space.json", maps t1 and fa, 30 bundles of which af-left and cst-right are initial, cortex overlay opacity 0.16, resample step 0.5 mm; text keys dataset, files, mriCanvas, mriScope, mriTitle, otherAnatomy in `en` and `fr`. `tractCatalog('cdmd')`, `('aomic')`, `('')`, `('toString')` → the CDMD catalogue.
- **Covered by:** `src/lib/core/diffusion/catalogs.test.ts` (H for the config match, R for the fallback); `parity/C3.test.ts` (D); the fixed dataset values are uncovered

### CAT-62 · A diffusion map must be a 3D scalar volume with explicit millimetre space
- **Rule:** A map is accepted only with image data, three spatial dimensions (no fourth beyond one), a scalar data type, millimetre units, a spatial transform (sform or qform) that is a finite, invertible 4 × 4 affine with last row 0 0 0 1, and positive finite voxel spacing.
- **Kind:** scientific
- **Level:** unit
- **Source:** `viewer/diffusion/validation.js`
- **Expected:** a 2 × 2 × 2 float32 volume, identity affine, `sform_code 1`, `xyzt_units 2` → accepted (so is an oblique affine with det ≠ 0). No header, no image, empty image → code `empty`, "The volume contains no readable image data."; `dims[0]` 2, any of `dims[4..7]` > 1, a spatial size 0, −1, 1.5 or NaN → `dimensions`, "Use a three-dimensional map, not a raw 4D acquisition."; datatype not one of 2, 4, 8, 16, 64, 256, 512, 768 (e.g. 128 RGB, 0, 32, 1024) → `scalar`, "Use a scalar map rather than a vector or RGB image."; `xyzt_units & 7` ≠ 2 (0, 1 and 3 rejected; 10, 18 and 34 accepted, their spatial bits being 2) → `units`, "The NIfTI spatial units must explicitly be millimeters."; both codes 0, affine missing, not 4 × 4, or holding NaN/Infinity → `transform`, "The NIfTI needs a valid spatial transform."; |det| < 1e-12 (`affine[0][0] = 0` on the identity), a last row other than 0 0 0 1, or a spacing ≤ 0 or non-finite → `transform`, "The NIfTI needs a valid spatial transform and voxel spacing.". The error's name is "DiffusionInputError" and it is an `Error`.
- **Covered by:** `src/lib/core/diffusion/validation.test.ts` (R, partial: one change per class, messages for three); `parity/C3.test.ts` (D, 600 seeded headers)

### CAT-63 · A tracts failure is shown by one of four codes
- **Rule:** A download failure and a newer deploy keep their own code; an invalid map is `invalid-data`; anything else is `failed`.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/translations.js:74-77`; hand-over note on #4 (moved to C3)
- **Expected:** an error, or any object, with `code` 'asset-fetch' → 'asset-fetch'; 'asset-updated' → 'asset-updated'; a `DiffusionInputError` → 'invalid-data'; a `RangeError`, a plain `Error`, `null`, `undefined`, the string 'asset-fetch', and objects with code 'empty', 'other', 3, null or undefined → 'failed'.
- **Covered by:** `src/lib/core/diffusion/validation.test.ts` (R, four classes); `parity/C3.test.ts` (D, 89 cases)

### CAT-64 · Tracts of another subject are an independent reference
- **Rule:** In the Tracts explorer, tracts are an independent reference when their subject is not the anatomy shown. The explorer must know both; elsewhere the question does not arise.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/presentation.js`
- **Expected:** explorer anatomy (or any but diffusion) → false, whatever the subjects; diffusion, cdmd / cdmd → false; aomic / cdmd → true; diffusion with anatomy or reference missing, "" or null → throws "Tract exploration must identify the anatomy and reference subject.".
- **Covered by:** `src/lib/core/diffusion/validation.test.ts` (R); `parity/C3.test.ts` (D, 150 seeded states)
