# Section rules: the Section popover, the section row and the linked MRI

Scope: chunks G4 (#48, the Section popover in the stage dock and the section row above the dock's tools)
and G5 (#49, the linked MRI (MPR) dialog). G5 is not built: its rules below come from legacy, from the G5
research and decision record on #49 and from decision 31 on #4, and are all uncovered. Legacy sources:
`viewer/ui/chrome/sections.js` (+ `sections.test.js`), `viewer/ui/chrome/stage-tools.js:3-9`
(`compactSection`), `viewer/index.html:493-540, 599-630`, `viewer/styles/dialogs.css:135-204`. New code:
`web/src/features/sections/` (`SectionPopover.svelte`, `SectionBar.svelte`, `section-controls.svelte.ts`,
`section-text.ts`). Deviations: `g4-angle-held-while-focused.md`, `g4-focus-when-bar-hidden.md`,
`g4-label-in-name.md`, `g4-linked-mri-busy.md`, `g4-pending-after-failure.md`, `g4-status-outlives-bar.md`,
`u3-segmented-controls.md`, `u4-number-field-range-error.md`; for G5 the records the decision on #49 names
(`g5-plane-radio`, `g5-canvas-not-interactive`, `g5-wheel-modifiers`, `g5-save-names`,
`g5-slider-label-in-name`, `g5-outputs-not-live`, `g5-plane-layout`, `g5-panel-names`, `g5-save-announce`,
`g5-unlabelled-sample`; not written yet). The cut geometry, offset range, sampling, window maths and the
point readout values are SLICE-01 to SLICE-37 (`engine-e4a.md`); opening the linked MRI on the selected
region, lessons and the `M` key are CTRL-39, LESSON-09, LESSON-10, KEY-02 and KEY-12 (`controller.md`); the
dock that holds the popover and the row is STAGE-18 to STAGE-36 (`stage.md`); the fold threshold of the row
is computed by the stage-layout store (STORE-29, `state.md`). Copy quoted is the English interface text; "mm" follows
a narrow no-break space (U+202F); "−" is U+2212.

## The Section popover

### SECT-01 · The popover offers five planes as a toolbar of toggles, the current one pressed
- **Rule:** The Section popover's planes are a toolbar "Cutting plane" of `aria-pressed` buttons: Full brain, Sagittal, Coronal, Axial, Oblique. The plane on screen, or the one being prepared, is pressed and takes focus as the popover opens. The buttons carry no tooltip that only repeats their name.
- **Kind:** accessibility
- **Level:** browser: roles and focus (decision 6 on #4)
- **Source:** `viewer/ui/chrome/sections.js:56-64, 416-428`; deviations `u3-segmented-controls.md`, `g4-label-in-name.md`
- **Expected:** Texts `['Full brain', 'Sagittal', 'Coronal', 'Axial', 'Oblique']`, `aria-pressed` `['true', 'false', 'false', 'false', 'false']`, focus on Full brain, no `title`. While Sagittal is prepared, Sagittal is pressed. French: toolbar "Plan de coupe", "Cerveau entier" pressed. The popover also holds the combobox "Cut labels".
- **Covered by:** `src/features/sections/SectionBar.svelte.test.ts` (R); `e2e/parity/sections.spec.ts` (R; legacy only, skips on `next`)

### SECT-02 · The arrows only move; Enter or a click chooses and gives focus back to Section
- **Rule:** In the plane toolbar the arrow keys move focus without cutting. Enter, Space or a click chooses the plane, closes the popover and returns focus to the Section tool. Choosing the plane already on screen closes the popover and cuts nothing.
- **Kind:** behaviour
- **Level:** browser: keyboard and focus
- **Source:** `viewer/ui/chrome/sections.js:171-174`; `stage-tools.js:119-123` (`[data-cut-mode]` closes)
- **Expected:** Open, → → → focus on Coronal and no cut; Enter → Section `aria-expanded="false"`, focus on Section, cut calls `['coronal']`, row named "Coronal section". With Axial cut, click Section then Axial → popover closed, cut calls still `['axial']`. Built site: Coronal → popover hidden, Section focused, link `cut=coronal`.
- **Covered by:** `src/features/sections/SectionBar.svelte.test.ts` (R); `src/features/sections/section-controls.test.ts` (R, no second cut); `e2e/parity/sections.spec.ts` (R; legacy only, skips on `next`)

### SECT-03 · On a phone the planes show short names and keep the full ones as their names
- **Rule:** Under the phone query the five planes sit on one row of 44 px targets showing short names; each button is still named by the full name.
- **Kind:** accessibility
- **Level:** browser: layout and accessible name
- **Source:** `viewer/ui/chrome/sections.js:57-64` (`modesShort`); deviation `g4-label-in-name.md`
- **Expected:** At 390×844 the button named "Sagittal" shows "Sag" (others "Full", "Cor", "Ax", "Obl"), is ≥ 44 px tall, and the toolbar has 5 grid columns.
- **Covered by:** `src/features/sections/SectionBar.svelte.test.ts` (R); `e2e/parity/sections.spec.ts` (R; legacy only, skips on `next`)

### SECT-04 · Cut labels lists the published label sets, and a failed change returns to the labels still cut
- **Rule:** "Cut labels" offers the manifest's cut atlases in the published order. Choosing one changes the labels the cut samples. If the change fails, the select shows the labels still cut and the status line says why.
- **Kind:** behaviour
- **Level:** browser: native select (the controller's side is CTRL-38)
- **Source:** `viewer/ui/chrome/sections.js:159-169, 194, 483-489`
- **Expected:** Options `['destrieux', 'hcp-mmp', 'nextbrain']`, value `destrieux`; choose `hcp-mmp` → `cutAtlas === 'hcp-mmp'`; `setCutAtlas` rejects for `nextbrain` → value back to `hcp-mmp`, spoken "Could not prepare the section.". The manifest marks NextBrain as segmented on this brain (`nextbrainSegmented === true`). French combobox "Étiquettes de coupe".
- **Covered by:** `src/features/sections/SectionBar.svelte.test.ts` (R); `src/features/sections/section-controls.test.ts` (R, the list and NextBrain); `e2e/parity/sections.spec.ts` (R, combobox present; legacy only, skips on `next`)

## Choosing and closing a plane

### SECT-05 · A chosen plane is named at once, then the cut turns to face the reader
- **Rule:** The row names the chosen plane as soon as it is chosen, with nothing to move while its anatomy is prepared (only Close). When the cut lands, the camera faces the cut from the side it keeps, and the session takes that view.
- **Kind:** behaviour
- **Level:** unit (the controls over the fake engine); browser for the drawn pending row
- **Source:** `viewer/ui/chrome/sections.js:171-193, 430-438`; `viewer/app.js:1281`
- **Expected:** `choose('coronal')` → `plane === 'coronal'`, `pending === true`; when it lands → `pending === false`, mode `coronal`, `faceCut` called, `setView('anterior')`. Axial → `'superior'`. Row while pending: `data-pending="true"`, named "Sagittal section", no input, buttons named only "Close section and show the full brain"; after landing `data-pending="false"` and the slider present.
- **Covered by:** `src/features/sections/section-controls.test.ts` (R); `src/features/sections/SectionBar.svelte.test.ts` (R)

### SECT-06 · A new plane meets the region already selected, not the midline
- **Rule:** With a region selected, a newly chosen plane is moved to pass through that region's centroid, clamped to the plane's range.
- **Kind:** behaviour
- **Level:** unit (the offset maths is SLICE-05)
- **Source:** `viewer/ui/chrome/sections.js:183-191`; `viewer/slices/coordinates.js` (`offsetThrough`)
- **Expected:** A left cortex region selected, `choose('sagittal')` → `offset === centroidOf(region)[0]` and ≠ 0.
- **Covered by:** `src/features/sections/section-controls.test.ts` (R)

### SECT-07 · Only the latest choice settles the plane
- **Rule:** A plane chosen while another is prepared overtakes it: only the newer one is faced, and an overtaken choice that settles later does not end the newer one's preparation. The plane already on screen, or already being prepared, is not cut again.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/sections.js:174-182`; deviation `g4-pending-after-failure.md`
- **Expected:** `choose('off')` with nothing cut → no cut. Axial being prepared, `choose('axial')` again → one cut call. Sagittal prepared, then Axial → `plane === 'axial'`; Sagittal lands later → mode `axial`, `setView` calls `[['superior']]`, not pending. Axial (pending), Full brain, Axial (pending); the first Axial settles `false` → still `plane === 'axial'`, `pending === true`; the second lands → not pending, mode `axial`.
- **Covered by:** `src/features/sections/section-controls.test.ts` (R)

### SECT-08 · A failed cut stops preparing and is said, until the reader acts again
- **Rule:** A cut that fails clears the pending plane, leaves the row on the plane really cut (or none), and the status line says and shows the failure, even when no plane is cut. The failure is dropped when the reader acts on the section again or the cut's mode changes; a later return to the same plane does not bring it back.
- **Kind:** behaviour
- **Level:** unit for the state; browser for the drawn line
- **Source:** `viewer/ui/chrome/sections.js:115-118, 176-179`; deviation `g4-pending-after-failure.md` (WCAG 3.3.1, 4.1.3)
- **Expected:** Cut rejects for Coronal → `pending === false`, `plane === 'off'`, `failure` is the error, logged once; `setMode('axial')` afterwards → `failure === null`. Desktop and phone: first Sagittal rejects → no row, said and shown "Could not prepare the section.", the status box wider and taller than 1 px; choosing Sagittal again → shown line changes. Rejected Sagittal, then mode Coronal, then off → said "Full brain · no cut", nothing shown.
- **Covered by:** `src/features/sections/section-controls.test.ts` (R); `src/features/sections/SectionBar.svelte.test.ts` (R)

### SECT-09 · Close returns to the whole brain, focus on Section, and says so
- **Rule:** Close moves focus to the Section tool at once, before the whole brain is back, forgets a plane being prepared, and the status says "Full brain · no cut" once, from a live region that outlives the row.
- **Kind:** behaviour
- **Level:** browser: focus and the live region
- **Source:** `viewer/ui/chrome/sections.js:238-242`; deviation `g4-status-outlives-bar.md` (WCAG 4.1.3)
- **Expected:** Enter on "Close section and show the full brain" → the row still there and focus on Section; when `setMode('off')` resolves → row gone, mode `off`, the `role="status"` node still connected, said "Full brain · no cut". `close()` while Coronal is prepared → not pending, mode `off`, `current === null`. Built site (next): `#viewport [role="status"]` with "Full brain · no cut".
- **Covered by:** `src/features/sections/SectionBar.svelte.test.ts` (R); `src/features/sections/section-controls.test.ts` (R); `e2e/parity/sections.spec.ts` (R; the announcement is next-only, so it runs nowhere today)

## The section row

### SECT-10 · The row is a group named by the plane, above the dock's tools
- **Rule:** While a plane is cut or prepared, and the tract reference is not shown alone, the row is a group named by the plane's noun. It is inside the dock, after the tools in reading order, drawn above them.
- **Kind:** accessibility
- **Level:** browser: DOM order and layout
- **Source:** `viewer/ui/chrome/sections.js:430-438`; `viewer/styles/stage.css:325`
- **Expected:** No plane → no group. Sagittal → group "Sagittal section" (also "Coronal section", "Axial section", "Oblique section"; French "Coupe sagittale"); `.section-bar` parent is `.stage-dock`; the toolbar precedes it (`DOCUMENT_POSITION_FOLLOWING`); the row's bottom ≤ the toolbar's top + 0.5.
- **Covered by:** `src/features/sections/SectionBar.svelte.test.ts` (R); `e2e/parity/sections.spec.ts` (R; legacy only, skips on `next`)

### SECT-11 · The position slider is named by its axis, ends in anatomical letters and speaks millimetres
- **Rule:** The slider is named by the plane's axis, spans the plane's offset range in 0.5 mm steps and speaks its value to one decimal in millimetres. The letters at its ends name the plane's negative end first; an oblique plane shows only − and +. The letters are hidden from assistive technology.
- **Kind:** behaviour
- **Level:** unit for the words (`axisEnds`); browser for the slider's attributes
- **Source:** `viewer/ui/chrome/sections.js:17-20, 439-452`
- **Expected:** `axisEnds`: sagittal `['L', 'R']`, French `['G', 'D']`; coronal `['P', 'A']`; axial French `['I', 'S']`; oblique `['−', '+']`. Sagittal slider "R coordinate (mm): − left / + right", `min −128`, `max 128`, `step 0.5`, `aria-valuetext` "0.0 mm"; the ends `L`, `R` with `aria-hidden="true"`. Coronal "A coordinate (mm): − posterior / + anterior", axial "S coordinate (mm): − inferior / + superior". French at −12.5 → "−12,5 mm".
- **Covered by:** `src/features/sections/section-text.test.ts` (R); `src/features/sections/SectionBar.svelte.test.ts` (R); `e2e/parity/sections.spec.ts` (R; legacy only, skips on `next`)

### SECT-12 · The slider builds one cut at a time and skips to the newest value
- **Rule:** Moving the slider builds the cut as it goes, one build at a time; values that arrive while one is building are replaced by the newest. A build that fails is said, and the next slide still runs.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/sections.js:138-157, 195`
- **Expected:** First build held, slides 5, 6, 7 → builds `[[5]]`; the first lands → `[[5], [7]]`, offset 7. A rejected build for 5 → `failure` is the error; slide 6 → failure `null`, offset 6, builds `[[5], [6]]`. Keyboard: two → on the focused slider → offset 1, `aria-valuetext` "+1.0 mm", exact field "1.0".
- **Covered by:** `src/features/sections/section-controls.test.ts` (R); `src/features/sections/SectionBar.svelte.test.ts` (R)

### SECT-13 · The spoken sentence waits for the hand to let go, and held sliders keep the reader's value
- **Rule:** While a slider is dragged, or the position slider has focus, the spoken status waits; it is said when the slider is left or released. A focused slider (position, tilt or azimuth) keeps the reader's value against changes from elsewhere and takes the cut's value when left; a still-building slide keeps the reader's angle until the build lands.
- **Kind:** behaviour
- **Level:** browser: focus and pointer events
- **Source:** `viewer/ui/chrome/sections.js:208-211, 447-452, 474, 524-526`; deviation `g4-angle-held-while-focused.md`
- **Expected:** Axial, focus the slider, → → → said unchanged; Tab → said starts "Tissue cut at +1.0 mm". Focused position slider, `setOffset(20)` → value `0`; blur → `20`. Oblique: tilt `input` 45 then `setOffset(5)` → said unchanged; `pointerup` on tilt → said starts "Tissue cut at +5.0 mm". Tilt focused, `setAngles(60, −90)` → sliders `['30', '30']`; blur → `['60', '-90']`. Tilt 45 building, focus moves to azimuth → tilt still `45`; after it lands, azimuth 40 → builds `[[45, 30], [45, 40]]`, tilt `45`.
- **Covered by:** `src/features/sections/SectionBar.svelte.test.ts` (R)

### SECT-14 · The status line says where the cut is, on what grid and labels, and what the colours mean
- **Rule:** The spoken sentence gives the position, the source grid and the label set, then what the colouring means on these labels. The shown line leaves out the position, which the slider already shows. Under the MRI colouring it is an MRI cut. It says when the anatomy is being prepared, a failure by its code, a failure the bar caught, and the full brain when nothing is cut.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/sections.js:490-526`; `web/src/features/sections/section-text.ts`
- **Expected:** Destrieux, offset −12.5, spacing 1 → said "Tissue cut at −12.5 mm · 1 mm source grid · native Destrieux labels", shown "1 mm source grid · native Destrieux labels". French, 3.25, 0.8 → "Coupe tissulaire à +3,3 mm · grille source de 0,8 mm · étiquettes Destrieux natives". MRI → said "MRI cut at −12.5 mm · 1 mm source grid · native Destrieux labels", shown "MRI · 1 mm source grid · native Destrieux labels". NextBrain → ends "NextBrain labels segmented on this brain" or "warped NextBrain labels". Notes: network "networks by each region’s dominant share"; CAB-NP on Destrieux "CAB-NP colours HCP-MMP labels only", on HCP-MMP "CAB-NP network of each HCP-MMP area"; functional on HCP-MMP "functional division of each HCP-MMP area", else "functional divisions colour HCP-MMP labels only"; atlas colouring no note; a function's paint over network → "… · neuropsychological functions colour HCP-MMP labels only". Loading → "Preparing anatomy…" both; state error `asset-fetch` → said starts "Could not prepare the section. "; not active → "Full brain · no cut" both; a caught failure → "Could not prepare the section." both.
- **Covered by:** `src/features/sections/section-text.test.ts` (R); `src/features/sections/SectionBar.svelte.test.ts` (R, shown line and French said)

### SECT-15 · The exact field moves the cut, restores an empty entry, and explains a value out of range
- **Rule:** The spinbutton "Exact cut position in millimetres" moves the cut to the value committed with Enter, including zero. An empty entry puts the current position back without moving the cut. A value outside the plane's range is not applied: the field is marked invalid and described by a visible message giving the range in the reader's notation, kept after the field is left until corrected.
- **Kind:** behaviour
- **Level:** unit for the message (`rangeMessage`); browser for the field
- **Source:** `viewer/ui/chrome/sections.js:196-202`; `sections.test.js:88-116`; deviation `u4-number-field-range-error.md`; comment on #4 (G4 requests, `cuts.positionRange`)
- **Expected:** Position 37.5, commit empty → no `setOffset`, value "37.5". Commit −12.5, 0, 18.75 → `setOffset` `[[-12.5], [0], [18.75]]`. Commit 900 → no call, `aria-invalid="true"`, description "Enter a position from −128 to 128 mm." visible; Tab → value still "900"; commit 12 → `aria-invalid="false"`, no `aria-describedby`, call `[[12]]`. `rangeMessage([-73.25, 96.5], 'fr')` → "Saisissez une position de −73,3 à 96,5 mm.". Built site: 12.5 → link `pos=12.5`; empty → field "12.5"; 900 → no `pos=` in the link (next only).
- **Covered by:** `src/features/sections/section-text.test.ts` (R); `src/features/sections/SectionBar.svelte.test.ts` (R); `src/features/sections/section-controls.test.ts` (R, values reach the cut); `e2e/parity/sections.spec.ts` (R; the range case is next-only, so it runs nowhere today; legacy only, skips on `next`)

### SECT-16 · Reverse side is named by its words and keeps the other half, facing it
- **Rule:** The checkbox is named by its visible words; its longer meaning is its tooltip and accessible description. Checking it keeps the other half of the cut and turns the camera to face it.
- **Kind:** behaviour
- **Level:** browser: accessible name and description (WCAG 2.5.3)
- **Source:** `viewer/ui/chrome/sections.js:203, 463-465`; deviation `g4-label-in-name.md`
- **Expected:** Checkbox "Reverse side" (French "Inverser le côté"), `data-tooltip` "Reverse retained side", described "Reverse retained side" while focused; checking → `state.reverse === true`; coronal reversed → `setView('posterior')`. Built site: link `rev=1`.
- **Covered by:** `src/features/sections/SectionBar.svelte.test.ts` (R); `src/features/sections/section-controls.test.ts` (R); `e2e/parity/sections.spec.ts` (R; legacy only, skips on `next`)

### SECT-17 · An oblique cut adds tilt and azimuth in whole degrees
- **Rule:** An oblique plane adds a Tilt and an Azimuth slider, named by their visible words and described by their longer meaning. They speak whole degrees, the azimuth signed. Moving one leaves the other as it was.
- **Kind:** behaviour
- **Level:** unit for the degrees (`degrees`); browser for the sliders
- **Source:** `viewer/ui/chrome/sections.js:205-207, 456-462, 474-478`; deviation `g4-label-in-name.md`
- **Expected:** `degrees(30, 'en')` "30°"; signed "+30°"; `degrees(-45, 'fr', true)` "−45°". Oblique opens at tilt 30, azimuth 30: "Tilt" `aria-valuetext` "30°", "Azimuth" "+30°", descriptions "Tilt from axial" and "Rotation around superior axis"; ends `−`, `+`. End on Azimuth → azimuth 180, "+180°", tilt 30. French names "Inclinaison", "Azimut".
- **Covered by:** `src/features/sections/section-text.test.ts` (R); `src/features/sections/SectionBar.svelte.test.ts` (R); `e2e/parity/sections.spec.ts` (R; legacy only, skips on `next`)

### SECT-18 · Linked MRI opens at once from the keyboard and ignores presses while it loads
- **Rule:** The row's "Linked MRI" button advertises `M`. It passes on whether it was used from the keyboard (instant) or a pointer. While the scan loads it is `aria-disabled`, stays focusable, and further presses (and `M`) do nothing; it is free again however the opening ends, and a failure is said in the status line.
- **Kind:** behaviour
- **Level:** unit for the guard; browser for the attributes
- **Source:** `viewer/ui/chrome/sections.js:219-236`; deviation `g4-linked-mri-busy.md`; decision 31 on #4
- **Expected:** `aria-keyshortcuts="M"`. Enter → `aria-disabled="true"`; Enter again → `openLinkedMri` calls `[[{ instant: true }]]`; after it loads no `aria-disabled`; a click → `[[{ instant: true }], [{ instant: false }]]`. A rejected opening → `failure` is the error, `opening === false`. French "IRM liée".
- **Covered by:** `src/features/sections/section-controls.test.ts` (R); `src/features/sections/SectionBar.svelte.test.ts` (R); `e2e/parity/sections.spec.ts` (R, present; legacy only, skips on `next`)

### SECT-19 · The slider, the field and Reverse side wait for a cut
- **Rule:** While the engine has no active cut the position slider, the exact field and Reverse side are disabled.
- **Kind:** behaviour
- **Level:** unit (view-model): today browser
- **Source:** `viewer/ui/chrome/sections.js:479-481`
- **Expected:** Oblique cut → slider and field enabled; `sections.active` false → slider, field and "Reverse side" `disabled`.
- **Covered by:** `src/features/sections/SectionBar.svelte.test.ts` (R)

### SECT-20 · Focus inside the row is handed to a control that is still there
- **Rule:** When the row goes while focus is inside it, focus moves to the Section tool; when the tract reference hides the row and the Section tool together, to the dock's first tool (View). When the row folds its details while focus is in them, focus moves to More.
- **Kind:** accessibility
- **Level:** browser: focus
- **Source:** `viewer/ui/chrome/sections.js:433`; deviation `g4-focus-when-bar-hidden.md`
- **Expected:** Focus on the slider, cut closed elsewhere → no row, focus on Section. Focus on the exact field, tract reference on → no row, focus on the first `.stage-tool`, which is visible. Focus on Reverse side, visible width 900 → 500 → `data-compact="true"`, focus on "More section controls".
- **Covered by:** `src/features/sections/SectionBar.svelte.test.ts` (R)

### SECT-21 · Where one line would not fit, the row folds Reverse side and Linked MRI behind More
- **Rule:** The row keeps everything on one line while its natural width fits the visible stage less the two gutters, and folds Reverse side and Linked MRI behind a disclosure "More section controls" otherwise; a phone always folds it and names the plane by its short name. The width is measured with every control beside the slider, also while folded and again when the words change, so the row unfolds once there is room. The dock stays inside the stage.
- **Kind:** behaviour
- **Level:** browser: measured widths (the fold decision is STORE-29, `state.md`)
- **Source:** `viewer/ui/chrome/stage-tools.js:3-9`; `stage-tools.test.js:46-54`; `viewer/ui/chrome/viewport-chrome.js:147-176`
- **Expected:** `compactSection({ room: 748, need: 700 })` false, `(700, 700)` false, `(488, 700)` true, `need: null` (phone) true. App, 1280 wide: no row → `sectionNeed 0`; Coronal → `data-compact="false"`, `sectionNeed` = dock `offsetWidth`; French → a new width, again the dock's; closed → 0. Visible 560 → folded; French re-measured while folded; visible 1280 → unfolded and the dock's width equals the width measured while folded. 560 px stage: More `aria-expanded="false"`, its panel not visible, no "Reverse side"; Enter → `"true"`, Reverse side visible, dock right ≤ 560. Phone 390: folded, full name hidden, short "Sag", dock width 390 − 2 × gutter. Built site phone: More toggles, then "Linked MRI" visible.
- **Covered by:** `src/features/sections/SectionBar.svelte.test.ts` (R; the "writes its one-line width to the stage layout" case also pins the store field); `src/lib/state/stage-layout.svelte.test.ts` (R, the fold decision); `e2e/parity/sections.spec.ts` (R; legacy only, skips on `next`)

### SECT-22 · The cut on screen is what the snapshot's caption reports
- **Rule:** The section the caption names is the plane on screen with its offset, tilt and azimuth; nothing while no plane is cut or while one is being prepared.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/sections.js:577-584`
- **Expected:** Nothing cut → `null`; Oblique → `{ plane: 'oblique', offset: 0, tilt: 30, azimuth: 30 }`; Axial being prepared → `null`.
- **Covered by:** `src/features/sections/section-controls.test.ts` (R)

### SECT-23 · Row targets are 24 px, 44 px on a coarse pointer, and forced colours keep the controls visible
- **Rule:** Every visible control in the row is at least 24 px tall, and 44 px on a coarse pointer. In forced colours the sliders are drawn in system colours and the tick box keeps its native look.
- **Kind:** accessibility
- **Level:** browser: layout and computed style
- **Source:** `viewer/styles/stage.css:441-453, 509-614`; `viewer/styles/a11y.css`
- **Expected:** Oblique row: every button, input and check label ≥ 24 px tall; coarse ≥ 44. Forced colours: slider `forced-color-adjust: none`, thumb `border-top-color` = the computed `CanvasText`; checkbox `appearance: auto`.
- **Covered by:** `src/features/sections/SectionBar.svelte.test.ts` (R)

### SECT-24 · The row and the popover pass axe
- **Rule:** axe finds no violation with the oblique row showing an out-of-range error and with the Section popover open, in English and French, nor in the folded and unfolded phone row.
- **Kind:** accessibility
- **Level:** browser: axe
- **Source:** WCAG 2.2 AA
- **Expected:** `expectAxeClean()` passes for each state named.
- **Covered by:** `src/features/sections/SectionBar.svelte.test.ts` (R); `e2e/parity/sections.spec.ts` (R; legacy only, skips on `next`)

## The linked MRI dialog (G5, not built)

### SECT-25 · The linked MRI is a modal dialog that opens on Close and gives focus back
- **Rule:** The dialog "Linked MRI sections" is modal and opens after the scan has loaded, with focus on Close. Close, Escape and `M` close it, instantly when done from the keyboard; there is no backdrop dismiss. Focus returns to the opener, else to the Section tool, then the canvas. It keeps the dark imaging palette in both themes.
- **Kind:** accessibility
- **Level:** browser: native `showModal`, focus
- **Source:** `viewer/ui/chrome/sections.js:212-252`; `sections.test.js:64-86`; G5 decision record on #49; KEY-02 for `M`
- **Expected:** Dialog named "Linked MRI sections" (French "Coupes IRM liées"), `aria-modal` semantics, first focus on the button "Close" ("Fermer"). Escape → closed with `data-instant`; Close by Enter → instant, by click → animated; focus back on "Linked MRI" (or the region's "Linked MRI"), else the Section tool, else the canvas. Clicking the backdrop leaves it open.
- **Covered by:** uncovered

### SECT-26 · Three linked planes, each a named section with an image, a slider and Save PNG
- **Rule:** The dialog shows Sagittal, Coronal and Axial, each a section named by its heading (kept for assistive technology on a phone). Each canvas is an image, not focusable and with no key handler, named with its orientation letters spelled out. Each slider is named by its visible label and spans −128 to 128 mm in 1 mm steps; each Save PNG button names its plane.
- **Kind:** accessibility
- **Level:** browser: roles and names
- **Source:** `viewer/ui/chrome/sections.js:264-283, 536-543`; G5 decision record on #49 (g5-panel-names, g5-canvas-not-interactive, g5-slider-label-in-name, g5-save-names); decision 31 on #4
- **Expected:** Three `section`s named "Sagittal", "Coronal", "Axial"; each `canvas` `role="img"`, no `tabindex`; slider "Sagittal position" (French "Position sagittale"), min −128, max 128, step 1, `aria-valuetext` in millimetres; button "Save PNG, Sagittal" (visible text "Save PNG" first). No slider named "Sagittal MRI position".
- **Covered by:** uncovered

### SECT-27 · The crosshair moves by slider, click and wheel, and stays within ±128 mm
- **Rule:** The shared crosshair moves along a plane's axis with that plane's slider (native keys: arrows 1 mm, Page Up/Down 10 mm, Home/End to the limits), to the clicked point on a canvas, and by 1 mm per wheel event, clamped to ±128 mm. Ctrl or Meta with the wheel is left to the browser's zoom. A sampled region that is drawn on the model becomes the selection.
- **Kind:** behaviour
- **Level:** unit for steps and clamps; browser for the events
- **Source:** `viewer/ui/chrome/sections.js:256-307`; G5 decision record on #49 (g5-wheel-modifiers)
- **Expected:** Crosshair z 127, wheel up on the axial canvas → 128; again → 128. Wheel with `ctrlKey` → crosshair unchanged and the event not prevented. Page Up on the axial slider at 0 → 10. Click at the canvas centre → crosshair on the frame's centre. Sample on a visible region `r` → `onSelect('r')`; on a hidden one → no selection change.
- **Covered by:** uncovered

### SECT-28 · On a phone one plane is shown at a time, chosen by a radio group
- **Rule:** Under the phone query a radio group "Section plane" picks the one plane shown (Axial by default; arrows move and choose); the hidden planes are not resampled, and the grid is one column whenever one plane is shown.
- **Kind:** behaviour
- **Level:** browser: media query and keyboard
- **Source:** `viewer/ui/chrome/sections.js:315-351`; G5 decision record on #49 (g5-plane-radio, g5-plane-layout); decision 6 on #4
- **Expected:** At 390 px: radiogroup "Section plane" ("Plan de coupe") with Sagittal, Coronal, Axial, Axial checked; → → Sagittal checked and shown, the others hidden and not redrawn. At 760 px wide (one-plane query): one grid column. At 1280 px: no radiogroup, three planes.
- **Covered by:** uncovered

### SECT-29 · One readout says where the crosshair is and what is there, after a pause
- **Rule:** One status readout gives the crosshair's RAS position, the sampled name and its label number; it is rewritten after 250 ms without movement, not per drag frame. The slider outputs are not live regions. A sample with no name reads "Unlabelled", never "(label undefined)". Tissue names are translated.
- **Kind:** behaviour
- **Level:** unit for the words; browser for the live region's timing (with fake timers)
- **Source:** `viewer/ui/chrome/sections.js:22-50, 390-407, 557-561`; `viewer/index.html:613-620`; G5 decision record on #49 (g5-outputs-not-live, g5-unlabelled-sample); SLICE-15 for the sampled values
- **Expected:** Readout "<x, y, z> — Cerebral white matter (label 2)" for `Left-Cerebral-White-Matter` (French "Substance blanche cérébrale"); a sample with no name → "<RAS> — Unlabelled" ("Non étiqueté"). Exactly one element with `role="status"` (or `aria-live` other than off) in the dialog; three slider moves within 250 ms → one readout write.
- **Covered by:** uncovered

### SECT-30 · Window, Level and the segmentation overlay
- **Rule:** The Window (10–256, default 180) and Level (0–255, default 90) sliders set the MRI contrast and speak whole numbers; the "Segmentation overlay" checkbox shows the labels over the MRI.
- **Kind:** behaviour
- **Level:** browser: sliders (the window maths is SLICE-12 and SLICE-23)
- **Source:** `viewer/index.html:614-621`; `viewer/ui/chrome/sections.js:204, 253-254, 549-556`
- **Expected:** Defaults Window 180, Level 90, `aria-valuetext` "180" and "90"; Window to 200 → `setWindow(90, 200)` once per frame. Overlay unchecked → `setDisplay({ overlay: false })`. French "Fenêtre", "Niveau", "Superposition de segmentation".
- **Covered by:** uncovered

### SECT-31 · Save PNG downloads the plane under a descriptive file name and says so
- **Rule:** Save PNG downloads that plane's image, letters and annotation included, as `<subject>-<plane>-<position to one decimal>mm.png`, and confirms the save in words.
- **Kind:** behaviour
- **Level:** unit for the file name and sentence; browser for the download
- **Source:** `viewer/ui/chrome/sections.js:308-312`; G5 decision record on #49 (g5-save-announce); decision 31 on #4
- **Expected:** Subject `sub_013`, axial, crosshair z 12.34 → `sub_013-axial-12.3mm.png`; announced "Saved the axial section as a PNG." (French "Coupe axiale enregistrée au format PNG.").
- **Covered by:** uncovered

### SECT-32 · Each plane is drawn with its crosshair, edge letters and position
- **Rule:** Each canvas shows the MRI at full opacity, the crosshair as a 1 px blue line over a 3 px dark one, the four edge letters of the plane (French D and G), and "<Plane> <signed position> mm" at the bottom left.
- **Kind:** behaviour
- **Level:** browser: canvas pixels (frame letters are RENDER-39)
- **Source:** `viewer/ui/chrome/sections.js:353-388`
- **Expected:** Crosshair stroke `#4fb6e0` 1 px over `#0e1116` 3 px through the crosshair's pixel; letters at (size/2, 22), (size − 16, size/2), (size/2, size − 14), (16, size/2); annotation "Axial +12.3 mm" at (10, size − 12); alpha 255 everywhere.
- **Covered by:** uncovered

### SECT-33 · The dialog meets the size, reflow and focus-visibility rules
- **Rule:** Radios, Save, Close and sliders are at least 24 px, 44 px on a coarse pointer. The sticky header never covers the focused control. The dialog reflows at 320 px and 200 % text, and passes axe in both themes, at 1280 and 390 px, in English and French.
- **Kind:** accessibility
- **Level:** browser: layout and axe
- **Source:** `viewer/styles/dialogs.css:135-204, 258-288`; G5 decision record on #49 (WCAG 1.4.10, 2.4.11, 2.5.8)
- **Expected:** As stated; each focused control's box lies below the header's bottom.
- **Covered by:** uncovered
