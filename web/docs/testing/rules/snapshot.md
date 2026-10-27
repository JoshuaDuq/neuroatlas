# Snapshot rules: the saved PNG and its markings

Scope: chunk G6 (#50), Save image: the visible stage as a PNG that documents itself, with the orientation
letters, scale bar and colour keys drawn on it, a caption naming the subject, labels, colouring and view or
section, and the not-clinical statement; its file name, download and announcement. Full screen, the other
half of G6, is STAGE-49 to STAGE-51 (`stage.md`). Legacy sources: `viewer/ui/chrome/snapshot.js`
(+ `snapshot.test.js`), `viewer/ui/chrome/viewport-chrome.js:642-697, 796-831`, `viewer/app.js:1450-1463`.
New code: `web/src/features/snapshot/` (`snapshot.ts`, `markings.ts`). Deviations: `g6-paint-row-labels.md`,
`g6-snapshot-blob.md`, `g6-snapshot-reentry.md`; decision 33 and comment 87 on #4 (the success announcement
and its strings, `viewport.snapshotSaved`). The engine's capture of the settled frame, cropped to the visible
rectangle, is FACADE-33 (`engine-e7.md`); the Save image button and its enabled state are the masthead's
(`masthead.md`). Layout numbers are CSS pixels of the cropped stage (`SNAPSHOT_LAYOUT`: gutter 16, line 16,
letter gap 12, scale gap 8); "mm" follows a narrow no-break space (U+202F).

## The caption

### SNAP-01 · The caption names the subject, then atlas, colouring and internal anatomy, then the view

- **Rule:** The first line is the subject, in bold. The second is the atlas, the colouring and the internal-anatomy level, named as the masthead names them and joined by " · ". The third is the view, when the camera holds a named view. Facts with no words are dropped, and a line with none goes.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/snapshot.js:15-42`; `snapshot.test.js:7-13`
- **Expected:** EN `{ subject: 'SNAIL subj_1', atlas: 'destrieux', surfaceColor: 'tissue', detail: 'learning', view: 'anterior' }` → `['SNAIL subj_1', 'Destrieux · Tissue · Teaching set', 'Anterior view']`, first run `strong`. `{ subject: 'S', atlas: null, surfaceColor: 'tissue', detail: null, view: null }` → `['S', 'Tissue']`. `{ subject: '', atlas: 'destrieux', surfaceColor: 'atlas', detail: 'nextbrain', view: 'left' }` → no subject line. French view: posterior → "Vue postérieure".
- **Covered by:** `src/features/snapshot/snapshot.test.ts` (R)

### SNAP-02 · The internal anatomy only where the masthead offers it, the view only while the camera holds it

- **Rule:** The internal-anatomy level is named only when the masthead offers a choice of levels. The view is named only while the camera still sits on it; once the reader has turned the model the caption names no view.
- **Kind:** behaviour
- **Level:** unit: the subject is plain data (today tested through `snapshotPlan` in the browser)
- **Source:** `viewer/ui/chrome/viewport-chrome.js:806-815`
- **Expected:** Anatomy "“CDMD sub_013”", HCP-MMP, atlas colouring, `learning` offered, `left` held → `[['CDMD sub_013'], ['HCP-MMP', 'Regions', 'Teaching set'], ['Left view']]`. Not held, not offered → `[['CDMD sub_013'], ['HCP-MMP', 'Regions']]`.
- **Covered by:** `src/features/snapshot/snapshot.svelte.test.ts` (R; could move down)

### SNAP-03 · A section replaces the view with the plane and its signed position

- **Rule:** While a plane is cut, the third line names the section and its signed position to one decimal, with its unit kept on it; an oblique section adds its tilt and signed azimuth in whole degrees. The figures are set in the interface face, not a monospace one.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/snapshot.js:29-37`; `snapshot.test.js:15-32`
- **Expected:** French coronal −12.34 → "Coupe coronale · −12,3 mm", no run with `mono`. Oblique 0, tilt 30, azimuth −45 → "Oblique section · 0.0 mm · Tilt 30° · Azimuth −45°". Axial +4 → `['Axial section', '+4.0 mm']`.
- **Covered by:** `src/features/snapshot/snapshot.test.ts` (R); `src/features/snapshot/snapshot.svelte.test.ts` (R)

### SNAP-04 · The tract reference is named alone

- **Rule:** While the tract reference is shown alone, its name, in bold, replaces the subject and the labels line, and no section is named. A held view is still named.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/snapshot.js:22-23`; `viewer/ui/chrome/viewport-chrome.js:805, 814`
- **Expected:** `{ reference: 'HCP tract reference', view: null }` → `['HCP tract reference']`. With an axial section and `left` held → `[['HCP tract reference'], ['Left view']]`.
- **Covered by:** `src/features/snapshot/snapshot.test.ts` (R); `src/features/snapshot/snapshot.svelte.test.ts` (R)

### SNAP-05 · Every colouring, view and plane has a fixed caption in both languages

- **Rule:** For each colouring, each named view or none, and each plane or none, in English and French, the caption is a known table of words; every plane's name appears in it.
- **Kind:** behaviour
- **Level:** unit (a table test)
- **Source:** `viewer/ui/chrome/snapshot.js:20-42`
- **Expected:** For `{ subject: 'CDMD sub_013', atlas: 'hcp-mmp', detail: 'learning' }` × `SURFACE_COLORS` × (`VIEW_NAMES` + none) × (none, sagittal 12.34, coronal −0.04, axial 5, oblique −7.5 tilt 30 azimuth −45): the words written out once from the i18n tables (e.g. network, no view, sagittal 12.34 → `['CDMD sub_013', 'HCP-MMP · Yeo 7 networks · Teaching set', 'Sagittal section · +12.3 mm']`; French "Coupe sagittale · +12,3 mm"); the strings "Sagittal", "Coronal", "Axial", "Oblique" all occur.
- **Covered by:** `src/features/snapshot/snapshot.test.ts` (R) (fixed tables of the words for every colouring, view and plane, in English and French)

## Laying out the markings

### SNAP-06 · A narrow image breaks a caption line between its facts, never inside one

- **Rule:** The facts of a line are packed greedily into lines no wider than the room; a fact wider than the room gets a line of its own, to be shortened there.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/snapshot.js:44-59`; `snapshot.test.js:44-51`
- **Expected:** `packFacts([90, 70, 120], 30, 400)` → `[[0, 1, 2]]`; room 200 → `[[0, 1], [2]]`; room 100 → `[[0], [1], [2]]`; `packFacts([300, 70], 30, 100)` → `[[0], [1]]`. Properties for the seeded sweep: fact order kept; a line exceeds the room only when it holds one fact.
- **Covered by:** `src/features/snapshot/snapshot.test.ts` (R) (fixed cases, and a seeded property test: order kept, a line exceeds the room only with one fact)

### SNAP-07 · A line too long for its room keeps its start and ends in an ellipsis

- **Rule:** A run that does not fit is cut to the longest start that, with "…", fits; if nothing fits, only "…" is drawn.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/snapshot.js:61-71, 119-136`; `snapshot.test.js:53-59`
- **Expected:** Measure 10 px per character: `ellipsize('Destrieux', 200)` → "Destrieux"; `('Destrieux · Tissue', 100)` → "Destrieux…" (≤ 100 px); `('Destrieux', 5)` → "…". Property: the result is the text, or a prefix with trailing spaces trimmed plus "…", and measures ≤ the width unless it is "…".
- **Covered by:** `src/features/snapshot/snapshot.test.ts` (R) (fixed cases, and a seeded property test: a trimmed prefix plus "…" that fits, or "…")

### SNAP-08 · The caption runs from the top left and stops short of the top letter

- **Rule:** The caption starts at the left gutter, its first line centred 24 px from the top, one line every 16 px; the first line is 13 px, the others 12 px, bold runs at weight 600. Its room ends 12 px before the top orientation letter (or at the right gutter when there is none), so the two never touch.
- **Kind:** behaviour
- **Level:** browser: canvas text measurement
- **Source:** `viewer/ui/chrome/snapshot.js:6-13, 203-230`
- **Expected:** 560×520 plan, top letter at x 280 → every caption run's right end ≤ 280 − ½ × letter width − 12; first baseline y 24, then 40, 56…; with a long subject ("A subject whose name is far too long for the room it has here") the first line ends in "…".
- **Covered by:** `src/features/snapshot/snapshot.drawing.svelte.test.ts` (R)

### SNAP-09 · The statement and the scale bar share the bottom line until they would meet

- **Rule:** The image always carries "Planum · Not clinical anatomy" at the bottom left. The scale bar sits at the bottom right on the same line while the statement, two gaps and the bar fit between the gutters; otherwise it rises one line and a gap.
- **Kind:** behaviour
- **Level:** unit for the positions; browser for the drawn statement
- **Source:** `viewer/ui/chrome/snapshot.js:73-85, 234-241`; `snapshot.test.js:61-68`; `viewport.snapshotStatement`
- **Expected:** `bottomLine({ 1120, 824, statementWidth: 190, scaleWidth: 110 })` → statement `{ x: 16, y: 800 }`, scale `{ x: 994, y: 800 }`. `(300, 600, 190, 110)` → scale y 552 (576 − 16 − 8), scale x + 110 = 284. Statement text "Planum · Not clinical anatomy" (French "Planum · Pas une anatomie clinique"), 12 px, at the statement spot. Property: the statement and the bar never overlap.
- **Covered by:** `src/features/snapshot/snapshot.test.ts` (R) (positions; a seeded property test: never overlap, shared line exactly when it fits); `src/features/snapshot/snapshot.drawing.svelte.test.ts` (R; the statement is drawn)

### SNAP-10 · The scale bar is drawn at its on-screen length

- **Rule:** The image's scale bar is a bracket exactly as many pixels wide as the bar on screen, open at the top with 6 px ends, its label 8 px after it in 13 px type, both with the markings' halo.
- **Kind:** scientific
- **Level:** browser: canvas pixels
- **Source:** `viewer/ui/chrome/snapshot.js:147-170`; `viewer/ui/chrome/viewport-chrome.js:692-696`
- **Expected:** On-screen bar `{ pixels: 100, label: '10 mm' }` → plan `scale` `{ pixels: 100, label: '10 mm' }`; on the image the bracket's foot spans 100 px (from `round(x) + 0.5` to that + 99) at `round(y + 3) − 0.5`; label starts at x + 108. No scale bar shown → `scale: null` and nothing drawn.
- **Covered by:** `src/features/snapshot/snapshot.svelte.test.ts` (R), `src/features/snapshot/snapshot.drawing.svelte.test.ts` (R)

### SNAP-11 · The letters are drawn where the reader sees them

- **Rule:** Each orientation letter is drawn at the centre of where it is on screen, in 13 px bold with the halo. Without a key band in the top strip the top letter moves up to the caption's line. Over a tall dock, where the screen hides the bottom letter, the image draws it centred one line above the statement. Before the anatomy is drawn there are no letters and no scale bar.
- **Kind:** behaviour
- **Level:** browser: measured positions
- **Source:** `viewer/ui/chrome/viewport-chrome.js:646-664`
- **Expected:** 1000×700 stage: letters in order top, right, bottom, left, each text = the camera's edge letter, x (and y except top) = the screen box centre (±1e-3); top y = 20. Dock 300×400 (tall) → bottom letter `{ x: 500, y: 652 }` (700 − 16 − 32). Status `loading` → `{ letters: [], scale: null }`.
- **Covered by:** `src/features/snapshot/snapshot.svelte.test.ts` (R), `src/features/snapshot/snapshot.drawing.svelte.test.ts` (R)

### SNAP-12 · Each colour key is redrawn with every row named beside its swatch

- **Rule:** Each shown key is redrawn as its plate, its swatches and its words: the title, the functional level shown beside it, and every row's label beside its own swatch. The picked row is bold and the others regular; a colour not shown in this view stays hollow. A folded key draws its title row only. Rows scrolled out of a long key stay out. The paint key's note is not drawn (legacy, flagged on #4).
- **Kind:** behaviour
- **Level:** browser: measured text and computed style
- **Source:** `viewer/ui/chrome/snapshot.js:172-196`; `viewer/ui/chrome/viewport-chrome.js:665-691`; deviation `g6-paint-row-labels.md`
- **Expected:** Deficit "Aphasia" with Broca picked, Wernicke absent, Arcuate → texts `['Aphasia', 'Broca', 'Wernicke', 'Arcuate']`, each row's x = the left of its label on screen (±1e-3) and right of its swatch; weights `['600', '400', '400']`; swatches `['rgb(100, 120, 200)', 'rgba(0, 0, 0, 0)', 'rgb(160, 120, 200)']`; the note absent; plate box = the screen plate's size. Functional, Sections level → `['Functional divisions', 'Sections', '1 · Early', '2 · Late']`, level x = the checked radio's text left; folded → `['Functional divisions', 'Sections']`, no swatches. 40 rows on a 1100×420 stage, opened → fewer than 41 texts and 40 swatches, all with y inside the plate.
- **Covered by:** `src/features/snapshot/snapshot.svelte.test.ts` (R), `src/features/snapshot/snapshot.drawing.svelte.test.ts` (R)

### SNAP-13 · Only marks are added; the anatomy is not resampled

- **Rule:** The markings are drawn on the captured frame at its device-pixel ratio in the overlay ink, halo and halo core; the rendered anatomy under them is not filtered or resampled. The faces the marks use are loaded for their words before the frame is captured.
- **Kind:** scientific
- **Level:** browser: canvas pixels
- **Source:** `viewer/ui/chrome/snapshot.js:198-257`; `viewer/ui/chrome/viewport-chrome.js:816-830`
- **Expected:** A 560×520 plan at ratio 2 over a flat `#7a7f86` frame: more than 5000 pixels change, every changed pixel lies within the halo reach (8 px blur) of a drawn letter, caption run, key, statement or bar; pixels farther away keep `#7a7f86`. `document.fonts.load` is awaited for 400 12 px, 400 13 px, 600 13 px and each key font before `captureSnapshot`.
- **Covered by:** `src/features/snapshot/snapshot.drawing.svelte.test.ts` (R)

## Saving

### SNAP-14 · Save image downloads planum-<atlas>.png of the visible stage

- **Rule:** The download is a PNG of the visible stage (the canvas less what the sheet covers) at device pixels, named after the atlas shown, or "brain" with none.
- **Kind:** behaviour
- **Level:** browser: real canvas encode; e2e for the real engine and download
- **Source:** `viewer/app.js:1450-1463`; FACADE-33
- **Expected:** Host 1000×700, chrome insets `{ bottom: 100 }`, HCP-MMP → one link, `download` "planum-hcp-mmp.png", blob type `image/png`, decoded 1000×600 at ratio 1. Atlas `null` → "planum-brain.png". Built site 1280×800, Destrieux → suggested file "planum-destrieux.png", PNG signature, width = stage width × devicePixelRatio (±1), 0 < height ≤ ceil(stage height × ratio), focus stays on Save image.
- **Covered by:** `src/features/snapshot/snapshot.svelte.test.ts` (R); `e2e/parity/snapshot.spec.ts` (R; legacy only, skips on `next`)

### SNAP-15 · The image is handed over as a Blob URL, released 40 s after the click

- **Rule:** The PNG is encoded asynchronously into a Blob and downloaded through an object URL, which is released 40 s after the click, not before, so the browser can finish the file.
- **Kind:** behaviour
- **Level:** browser today (`toBlob`, `createObjectURL`); the timing is fake-timer logic
- **Source:** deviation `g6-snapshot-blob.md` (FileSaver.js revoke delay); legacy used a data URL
- **Expected:** After the save, the link's `href` fetches a blob of type `image/png`; `URL.revokeObjectURL` not called at +39 999 ms; called exactly once, with that `href`, at +40 000 ms.
- **Covered by:** `src/features/snapshot/snapshot.svelte.test.ts` (R, fake `setTimeout`)

### SNAP-16 · A saved image is announced

- **Rule:** When the download has started the page says so, naming the file, in the reader's language.
- **Kind:** accessibility
- **Level:** browser: the announcer's live region
- **Source:** decision 33 and comment 87 on #4 (`viewport.snapshotSaved`, WCAG 4.1.3)
- **Expected:** English "Image saved as planum-destrieux.png."; French "Image enregistrée : planum-hcp-mmp.png."; "planum-brain.png" with no atlas. Built site (next): `#announcer` text "Image saved as planum-destrieux.png.".
- **Covered by:** `src/features/snapshot/snapshot.svelte.test.ts` (R); `e2e/parity/snapshot.spec.ts` (R; next-only, so it runs nowhere today)

### SNAP-17 · A second request while one is being made joins it

- **Rule:** Asking to save again while a save is in progress gives the same save: one capture, one file, one announcement. Once it has ended, a new request saves again.
- **Kind:** behaviour
- **Level:** unit (with a fake stage and encoder); browser today
- **Source:** deviation `g6-snapshot-reentry.md`
- **Expected:** Two calls in a row return the same promise; after it settles, one link "planum-brain.png" and the announcement "Image saved as planum-brain.png."; a third call afterwards → two links.
- **Covered by:** `src/features/snapshot/snapshot.svelte.test.ts` (R)

### SNAP-18 · A failure is the snapshot notice, and nothing is downloaded or said

- **Rule:** If measuring, capturing or encoding fails, the reader gets the scene commands' snapshot failure notice; no file is downloaded and nothing is announced. A snapshot asked before the stage has been laid out is such a failure.
- **Kind:** behaviour
- **Level:** unit (with a fake stage); browser today
- **Source:** `viewer/app.js:1460-1462`; `viewer/ui/chrome/viewport-chrome.js:803`
- **Expected:** `captureSnapshot` throws `Error('context lost')` → `fail('snapshot', error)` once, no link, announcer text "". No visible rectangle → `snapshotPlan` throws "The stage has not been laid out yet.".
- **Covered by:** `src/features/snapshot/snapshot.svelte.test.ts` (R, the capture failure); the not-laid-out case is uncovered

### SNAP-19 · Save image stays outside the stage

- **Rule:** The Save image control is not part of the stage host, so it is not reachable while the stage is full screen (legacy parity).
- **Kind:** behaviour
- **Level:** browser: region composition
- **Source:** decision 33 on #4
- **Expected:** The button "Save image (PNG)" is not a descendant of `#viewport`.
- **Covered by:** uncovered
