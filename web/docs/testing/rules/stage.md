# Stage rules: overlays, dock, colour keys and full screen

Scope: chunks G1 (#44, the stage overlays: hints, orientation letters, scale bar, hover chip, focus ring),
G2 (#46, the stage dock with its Section, Lesion, Coordinate and Display popovers, and the orientation gizmo
with its views, turn buttons and Reset view), G3
(#47, the network, paint and direction keys) and the full-screen part of G6 (#50). Legacy
sources: `viewer/ui/chrome/viewport-chrome.js`, `viewer/ui/chrome/stage-tools.js` (+ `stage-tools.test.js`),
`viewer/ui/chrome/display.js`, `viewer/app.js` (hover words 1694-1717). New code: `web/src/features/stage/`
(the gizmo's projection is `projectAxes` in `web/src/lib/engine/render/orientation.ts`).
Deviations: `g1-hover-chip-dismiss.md`, `g1-measurements-follow-text.md`, `g1-touch-hints.md`,
`g1-viewport-host-size.md`, `g2-dock-toolbar.md`, `g2-focus-when-tool-hidden.md`, `g2-orbit-step-buttons.md`,
`g2-gizmo-letter-targets.md`, `g2-text-reflow.md`, `g3-absent-text.md`, `g3-focus-handoff.md`, `g3-list-role.md`,
`g3-paint-toolbar.md`, `g6-fullscreen-exit.md`, `g6-fullscreen-failure.md`, `g6-fullscreen-focus.md`,
`u3-segmented-controls.md`. The stage status screens (`StageStatus`) are BOOT-12 to BOOT-29 in
`boot-and-assets.md`. Which letter faces each edge, the scale bar's 1-2-5 length and the 5 degree arrow
step are RENDER-21, RENDER-23 to RENDER-26 (`engine-e1.md`); which region the hover may name is FACADE-28
(`engine-e7.md`); the thresholds the stage-layout store computes (chrome mode, tall dock, hint room, section
fold, refit signals, hint storage) are STORE-25 to STORE-35 (`state.md`). Copy quoted is the English
interface text; "mm" follows a narrow no-break space (U+202F). Pixel values are CSS pixels.

## The overlay layer

### STAGE-01 · The overlays are passive: unseen by assistive technology, never focused, never a target

- **Rule:** The hints, orientation letters, scale bar and hover chip form one layer over the canvas that is hidden from assistive technology, holds no focusable element and takes no pointer events. Their words are not in the accessibility tree; the canvas carries the instructions.
- **Kind:** accessibility
- **Level:** browser: accessibility tree, computed `pointer-events`, Tab order
- **Source:** `viewer/index.html` overlay markup (aria-hidden); `web/src/features/stage/StageOverlay.svelte`
- **Expected:** `.stage-overlay` has `aria-hidden="true"` and is a child of `#viewport`; no descendant has `tabindex`; every descendant computes `pointer-events: none`; Tab from the canvas never lands inside the layer. The `main` landmark's aria snapshot contains neither "Drag to rotate", "3D view" nor "mm".
- **Covered by:** `src/features/stage/StageOverlay.svelte.test.ts` (R)

### STAGE-02 · The overlays follow the rectangle the reader can see

- **Rule:** The stage host publishes the visible rectangle (`--vis-*`), the colour keys' band (`--key-*`) and the dock height (`--dock-height`), and marks whether the dock and the scale bar share a line (`data-chrome`) and whether the dock is tall (`data-dock-tall`). The visible rectangle is rewritten when only the host's size changes (deviation g1-viewport-host-size).
- **Kind:** behaviour
- **Level:** browser: CSS variables on the real host
- **Source:** `viewer/ui/chrome/viewport-chrome.js:197-204, 418-432, 707-728`; deviation `g1-viewport-host-size.md`
- **Expected:** Host 900×600, chrome insets `{ top: 10, bottom: 200 }`, key band `{ top: 0, right: 90 }`, dock 300×38 → `--vis-top: 10px`, `--vis-left: 0px`, `--vis-right: 0px`, `--vis-bottom: 200px`, `--key-right: 90px`, `--dock-height: 38px`, `data-chrome="wide"`, `data-dock-tall="false"`; a 190 px dock → `data-dock-tall="true"` (190 + 64 > 390 / 2). Phone at the full sheet detent, host 792 → 648 px tall with the rectangle unchanged → `--vis-bottom` becomes 520px, not 664px.
- **Covered by:** `src/features/stage/StageOverlay.svelte.test.ts` (R, "writes the visible rectangle…"); `src/lib/state/stage-layout.svelte.test.ts` (R, host-size-only update in the store); the `--vis-bottom` rewrite on the host after a host-only resize is uncovered

### STAGE-03 · The model's focus ring runs round the visible rectangle

- **Rule:** With keyboard focus on the canvas, a 2 px ring in the stage teal is drawn round the visible rectangle, not under the dock or sheet. In forced-colours mode it is the system Highlight colour.
- **Kind:** accessibility
- **Level:** browser: `:focus-visible` and computed `::after` style
- **Source:** `viewer/styles/stage.css` (host `::after`); deviation `g1-viewport-host-size.md`
- **Expected:** Insets `{ bottom: 120 }`, canvas focused by keyboard → host `::after` `border-top-width: 2px`, `bottom: 120px`, `border-top-color: rgb(127, 208, 204)`; under `forced-colors: active` its colour equals the computed `Highlight`. On the built site the ring's four insets equal `--vis-top/right/bottom/left`.
- **Covered by:** `src/features/stage/StageOverlay.svelte.test.ts` (R)

## Hints

### STAGE-04 · The navigation hint names the gestures of the reader's pointer

- **Rule:** The navigation hint tells a mouse user to drag, scroll and click, and a touch user (coarse pointer) to drag, pinch and tap. Over the tract reference alone, which has no regions to click, the last part is left out. The keyboard hint names the arrow and zoom keys.
- **Kind:** behaviour
- **Level:** unit (view-model): the wording is chosen from language, pointer and tract reference
- **Source:** `viewer/ui/chrome/viewport-chrome.js:738-742`; deviation `g1-touch-hints.md`; decision 21 on #4
- **Expected:** Fine pointer: "Drag to rotate · Scroll to zoom · Click to inspect"; tract reference "Drag to rotate · Scroll to zoom"; French `viewport.navigationHint` / `navigationHintTracts`. Coarse pointer: "Drag to rotate · Pinch to zoom · Tap to inspect", tract reference "Drag to rotate · Pinch to zoom", French tract reference "Glisser : tourner · Pincer : zoom". Keyboard hint: "3D view · Arrow keys rotate · + − zoom".
- **Covered by:** `src/features/stage/StageOverlay.svelte.test.ts` (R; could move down)

### STAGE-05 · The keyboard hint shows only while the model has keyboard focus

- **Rule:** The keyboard hint is invisible until the canvas has keyboard focus; then it shows and the navigation hint fades out.
- **Kind:** accessibility
- **Level:** browser: `:focus-visible` and computed opacity
- **Source:** `viewer/styles/stage.css` (focus hint); `web/src/features/stage/StageHints.svelte`
- **Expected:** Before focus: `#viewport-focus-hint` opacity `0`. After a key press and canvas focus: focus hint opacity `1`, `#viewport-help` opacity `0`.
- **Covered by:** `src/features/stage/StageOverlay.svelte.test.ts` (R)

### STAGE-06 · The navigation hint retires for good at the reader's first gesture on the model

- **Rule:** A pointer press or wheel turn on the canvas, a camera key on the focused canvas, a preset, a turn button, or selecting a region other than the one the stage opened on retires the navigation hint, and it stays retired on later visits. Gestures elsewhere do not retire it.
- **Kind:** behaviour
- **Level:** browser: events dispatched to the real canvas (the retire-and-remember logic itself is STORE-35, `state.md`)
- **Source:** `viewer/ui/chrome/viewport-chrome.js:53-61, 599-621, 734-736`
- **Expected:** Each of `pointerdown` on the canvas, `wheel` on the canvas, `keydown` ArrowLeft / `+` on the canvas, `stage.retireHint()` → `#viewport-help` `data-dismissed="true"` and `localStorage['planum.stage-hint'] === 'retired'`. `pointerdown` on the host outside the canvas, ArrowLeft on `body`, `a` on the canvas → `data-dismissed="false"`. Selection `a` at open, then `a` again → not retired; then `b` → retired. With `planum.stage-hint = 'retired'` stored, the hint starts dismissed and computes `visibility: hidden`. Built site: one click on the model, reload → still dismissed.
- **Covered by:** `src/features/stage/StageOverlay.svelte.test.ts` (R); `src/features/stage/Dock.svelte.test.ts` (R, preset and turn button); `src/lib/state/stage-layout.svelte.test.ts` (R, storage)

### STAGE-07 · A hint is drawn only where one line fits clear of the top letter, whatever the text size

- **Rule:** A hint that would reach the top orientation letter (or a colour key in the top band) is not drawn. Its width is measured as drawn, so larger text or text spacing applied after load is respected (WCAG 1.4.4, 1.4.12).
- **Kind:** accessibility
- **Level:** browser: layout measurement
- **Source:** `viewer/ui/chrome/viewport-chrome.js:473-489`; deviation `g1-measurements-follow-text.md`
- **Expected:** 900×600 stage: `#viewport-help` `data-room="true"`; insets `{ right: 540 }` → `data-room="false"` and `visibility: hidden`; insets back to 0 → `"true"`. For stages 320×400, 844×300, 700×500 and 900×600, with root font size 200 % or the WCAG 1.4.12 spacing override: a drawn hint's right edge ≤ the top letter's left edge.
- **Covered by:** `src/features/stage/StageOverlay.svelte.test.ts` (R); room arithmetic in `src/lib/state/stage-layout.svelte.test.ts` (R)

### STAGE-08 · The hints follow the reader's contrast setting

- **Rule:** Under increased contrast the hints take the same ink as the orientation letters.
- **Kind:** accessibility
- **Level:** browser: computed style under `prefers-contrast: more`
- **Source:** `viewer/styles/a11y.css:16, 91-93`
- **Expected:** With `prefers-contrast: more`, `#viewport-help` `color` equals `[data-edge="top"]` `color`.
- **Covered by:** `src/features/stage/StageOverlay.svelte.test.ts` (R)

## Orientation letters and scale bar

### STAGE-09 · Four orientation letters frame the picture once the anatomy is on screen

- **Rule:** One letter sits at each edge of the framing rectangle, as the camera reports it; French writes D and G for R and L. The letters are hidden until the anatomy is ready (or switching), and a language change re-words the letters already held without reading the camera again.
- **Kind:** behaviour
- **Level:** browser: the letters drawn from camera events (which letter faces which edge per view is RENDER-23)
- **Source:** `viewer/ui/chrome/viewport-chrome.js:126-129, 465-471, 757-761, 834-841`
- **Expected:** After `applyView('anterior')`: four letters, each in `R L S I P A`, all distinct; with the camera's edges `{ top, right, bottom, left }` the letters equal those edges. Language `fr` → the same list with R→D, L→G, and the camera is not read. Status `loading` → `#orientation` hidden; `switching` → shown.
- **Covered by:** `src/features/stage/StageOverlay.svelte.test.ts` (R; the "letter the camera reports" case is W: it only checks that left and right views give four distinct letters, so the fake answers it); `src/features/snapshot/snapshot.svelte.test.ts` (R, letters equal `engine.camera.view.edges`)

### STAGE-10 · The scale bar shows its rule in pixels and its length in the reader's notation

- **Rule:** The bar's rule is as wide as the camera says, in whole pixels, and its label is the length to one decimal, trimmed, with "mm". It is hidden while the camera gives no scale or the anatomy is not on screen, and then takes no room.
- **Kind:** behaviour
- **Level:** unit (view-model) for the label and visibility; the rule width needs the DOM
- **Source:** `viewer/ui/chrome/viewport-chrome.js:444-463, 759`
- **Expected:** Scale `{ millimetres: 2.5, pixels: 87.4 }` → `.scale-bar-rule` width `87px`, label "2.5 mm"; French "2,5 mm". `{ millimetres: 10, pixels: 100 }` → "10 mm". Scale `null` → `#scale-bar` hidden; status `loading` with a scale → hidden. Built site: the label matches `^\d+([.,]\d)?\s?mm$` and the rule is 60–150 px.
- **Covered by:** `src/features/stage/StageOverlay.svelte.test.ts` (R for width and visibility; W for the label, whose expectation is re-derived with `withUnit(decimal(…))`; only the French `toContain('2,5')` is fixed); `src/styles/contrast.test.ts` (R, the bar's `--overlay-ink` on `--overlay-halo-core` is 17.99:1, at least 4.5 by WCAG 1.4.3, since axe cannot measure the bar over the canvas)

### STAGE-11 · The dock and the scale bar share the bottom line, or the bar moves up

- **Rule:** The scale bar sits beside the dock while both and the margins fit the visible width. Otherwise it rises above the dock, and a bar that would reach the middle rises one line more. The bar's width, rule and label as drawn, decides, so larger text refits it.
- **Kind:** behaviour
- **Level:** browser: measured widths (thresholds are STORE-25 and STORE-26, `state.md`)
- **Source:** `viewer/ui/chrome/viewport-chrome.js:19-20, 183-195`; deviation `g1-measurements-follow-text.md`
- **Expected:** 900 px stage, 300 px dock, scale `{ 10 mm, 100 px }` → bar wider than 100 px, `data-chrome="wide"`; insets `{ right: 460 }` (440 px visible) → `"tight"`. Root font 200 % → the bar's width grows.
- **Covered by:** `src/features/stage/StageOverlay.svelte.test.ts` (R); `src/lib/state/stage-layout.svelte.test.ts` (R, wide/tight/stacked thresholds)

### STAGE-12 · Under reduced motion the markings only fade

- **Rule:** With reduced motion the orientation letters and the scale bar keep only an opacity transition.
- **Kind:** accessibility
- **Level:** browser: computed style under `prefers-reduced-motion`
- **Source:** `viewer/styles/a11y.css:10-11`
- **Expected:** `#orientation` and `#scale-bar` compute `transition-property: opacity`.
- **Covered by:** `src/features/stage/StageOverlay.svelte.test.ts` (R, orientation only); the scale bar part is uncovered below e2e

## Hover chip

### STAGE-13 · The hover chip names the region, its network, the functions and the side

- **Rule:** Over a region the model lets the reader select, the chip names it by the catalog's label (else its own label), then, joined by " · ": the network while the surface is coloured by networks (every CAB-NP area; a Yeo 7 region only when one network holds all of it), the functions the area reaches while functions are painted (the overview's domains, the one domain shown, or a searched term only on the areas it carries; a teaching unit as the structure it carries), and the capitalised side. A region that cannot be selected has no chip. A function painted with no published domains is an error.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1694-1717`; `web/src/features/stage/hover-text.ts`
- **Expected:** With catalog name "Area A" for `a`: atlas colouring → "Area A · Left"; midline → "Area A · Midline"; French → "Area A · Gauche"; uncatalogued `x` → "raw x · Left"; `canSelect` false → `null`. CAB-NP `a`→Visual1 → "Area A · Primary visual · Left"; unmapped `zz` → "raw zz · Left". Yeo 7 `[{Vis, 1}]` → "Area A · Visual · Left"; `[{Vis, .5}, {Default, .5}]` → "Area A · Left". Function paint, overview: `a` (attention overview, memory not) → "Area A · Attention · Left", `b` → "raw b · Left"; memory alone: `b` → "raw b · Memory · Left", French `a` → "Area A · Mémoire · Gauche"; term `reading` on `a` only → "Area A · reading · Left", `b` → "raw b · Left"; unit `u` carrying `a` → "raw u · Attention · Left" in the overview, "raw u · reading · Left" for the term; deficit paint → "Area A · Left"; function paint without domains → throws "no domains".
- **Covered by:** `src/features/stage/hover-text.test.ts` (R); `src/features/stage/StageOverlay.svelte.test.ts` (R, plain and French chip)

### STAGE-14 · The chip sits beside the pointer and inside the stage

- **Rule:** The chip's top-left corner is 14 px right of and below the pointer, clamped to stay 8 px inside the stage. A chip larger than the stage keeps its top and left in view. It stays inside the stage when the text grows (WCAG 1.4.4, 1.4.12).
- **Kind:** behaviour
- **Level:** unit (view-model) for the clamp; browser for the text-size cases
- **Source:** `viewer/ui/chrome/viewport-chrome.js:850-866`; `viewer/ui/chrome/stage-tools.test.js:142-166`; deviation `g1-measurements-follow-text.md`
- **Expected:** Stage 320×240, chip 80×40: pointer (12, 14) → left 26px, top 28px; pointer (310, 230) → 232px, 192px. Stage 120×36, chip 280×60, pointer (110, 30) → 8px, 8px. In the app (900×600): pointer (100, 120) → 114px, 134px; pointer (0, 0) → left 14px; pointer (890, 590) → left 900 − width − 8, top 600 − height − 8. Stages 320×400, 844×300, 700×500, 900×600 with 200 % text or 1.4.12 spacing and the pointer 2 px from the corner: the chip's box lies inside the stage's (±0.5 px). Built site: chip left = pointer x + 14 (±2), inside the stage's 8 px gutters.
- **Covered by:** `src/features/stage/StageOverlay.svelte.test.ts` (R); the legacy fixed cases (oversized chip) are uncovered as a unit test

### STAGE-15 · The chip goes when the pointer leaves or the camera moves, and follows the words under a still pointer

- **Rule:** The chip hides when no region is under the pointer and whenever the camera moves; the next pointer move brings it back. A change of language, colouring or selection under a still pointer re-words it.
- **Kind:** behaviour
- **Level:** unit (view-model): today browser, over engine events
- **Source:** `viewer/ui/chrome/viewport-chrome.js:834-841, 850-858`
- **Expected:** Hover `a` then `null` → hidden. Hover `a`, `applyView('left')` → hidden; hover `a` again → shown. Hover `a`, language `fr` → "Area A · Gauche". Hover `a` → `b` → "Area B · Right". Built site: a wheel turn hides it.
- **Covered by:** `src/features/stage/StageOverlay.svelte.test.ts` (R; the "rewrites its text only when the words change" case is I: a MutationObserver pins a render optimisation)

### STAGE-16 · Escape dismisses the chip without moving focus

- **Rule:** Escape hides a showing chip and leaves focus where it is. It stays hidden over the same region and returns over another region, or after the pointer leaves and comes back. The keypress is marked handled so the page's Escape cascade waits for the next one. An Escape already handled, one with no chip showing, and one inside an open modal dialog are left alone.
- **Kind:** accessibility
- **Level:** browser: keyboard dispatch and dialogs
- **Source:** deviation `g1-hover-chip-dismiss.md` (WCAG 1.4.13); legacy had no dismissal
- **Expected:** Canvas focused, chip over `a`, Escape → `defaultPrevented === true`, chip hidden, focus on the canvas; pointer over `a` again → still hidden; over `b` → shown. Escape, pointer `null`, then `b` → shown. Escape on `body` with no chip → not prevented. Escape already prevented by another handler → chip stays. Modal dialog open: Escape closes the dialog and the chip stays; the next Escape hides it.
- **Covered by:** `src/features/stage/StageOverlay.svelte.test.ts` (R)

### STAGE-17 · The overlays pass axe

- **Rule:** With the dock, a hover chip and a scale bar showing, axe finds no violation in English or French.
- **Kind:** accessibility
- **Level:** browser: axe
- **Source:** WCAG 2.2 AA
- **Expected:** `expectAxeClean()` passes for EN and FR (desktop width). The phone-width run with the sheet covering the lower canvas is the built-site check.
- **Covered by:** `src/features/stage/StageOverlay.svelte.test.ts` (R; the test name promises light and dark themes and phone width, but it runs one size and one theme in two languages)

## The dock

### STAGE-18 · The dock is one labelled toolbar of four tools

- **Rule:** Section, Lesion, Coordinate and Display form a toolbar named "3D viewer tools" with one Tab stop. The arrow keys and Home/End move between the tools shown, wrapping. Tab leaves the toolbar, and Shift+Tab back into it lands on the focused tool, else the first. Coordinate is offered only while the anatomy publishes coordinate spaces; without it the arrows pass from Lesion to Display.
- **Kind:** accessibility
- **Level:** browser: focus and keyboard
- **Source:** `viewer/index.html:433-490`; deviation `g2-dock-toolbar.md` (APG Toolbar)
- **Expected:** Tools "Section", "Lesion", "Coordinate", "Display", `tabIndex` [0, −1, −1, −1]. From Section: → Lesion; ↓ → Coordinate; → twice wraps past Display to Section; ← → Display; Home → Section; End → Display. From Display, Tab → the next control after the dock; Shift+Tab → Section; Shift+Tab → the canvas. No coordinate spaces → no "Coordinate"; → from Lesion → Display; spaces back → ← from Display → Coordinate. French: toolbar "Outils du visualiseur 3D", tools "Coupe", "Lésion", "Coordonnée", "Affichage". Each tool has `aria-haspopup="dialog"`, `aria-expanded="false"`. In the app, Coordinate is offered for CDMD, its dialog holding the coordinate field and template select, and the Lesion dialog the radius slider and no coordinate field.
- **Covered by:** `src/features/stage/Dock.svelte.test.ts` (R); `src/app/regions/StageRegion.svelte.test.ts` (R, the app's Coordinate and Lesion dialogs)

### STAGE-19 · Over the tract reference no tool is left and the dock is not drawn

- **Rule:** The tract reference has no sections, lesion or display settings, so all four tools go and the dock is not drawn; the orientation gizmo stays. Showing the anatomy again restores the dock and its toolbar.
- **Kind:** accessibility
- **Level:** browser: roles and computed visibility
- **Source:** `viewer/ui/chrome/display.js:200-203` (`data-anatomy-display`); deviation `g2-dock-toolbar.md`
- **Expected:** Tract reference on: no "Section", "Lesion", "Coordinate" or "Display" button; dock `visibility: hidden`. Off: dock `visible`, one toolbar "3D viewer tools".
- **Covered by:** `src/features/stage/Dock.svelte.test.ts` (R)

### STAGE-20 · Each tool opens a named, non-modal popover, one at a time

- **Rule:** A tool opens its popover as a non-modal dialog named by its caption. Opening one closes any other. Focus lands on the pressed choice that is shown and enabled, else the first control. Escape closes it, is marked handled, and returns focus to the tool. While open, the tool is the Tab stop: Shift+Tab from the first control returns to it with the popover still open; Tab from the last control leaves the dock and closes it.
- **Kind:** behaviour
- **Level:** browser: focus and keyboard (U5's popover mechanics are in `ui-kit.md`)
- **Source:** `viewer/ui/chrome/stage-tools.js:36-136`; `stage-tools.test.js:87-101`; decision 14 on #4; deviation `g2-dock-toolbar.md`
- **Expected:** Dialogs "Section", "Lesion", "Coordinate", "Display", each named by its tool; no `aria-modal`. Display opens with focus on the "Both" radio. Open Section then Display → Section `aria-expanded="false"`, Display "true", Lesion "false". Escape → one keydown seen with `defaultPrevented === true`, focus on the tool. Shift+Tab from the first control of each of the four → the tool, popover open. Tab from Lesion's last control → the next control after the dock, Lesion `aria-expanded="false"`.
- **Covered by:** `src/features/stage/Dock.svelte.test.ts` (R)

### STAGE-21 · A popover opened from the keyboard appears at once; from a pointer it grows from the dock

- **Rule:** Opening or closing a popover by Enter or Space, or one replacing another, has no animation; a first opening by pointer grows from the dock's corner.
- **Kind:** behaviour
- **Level:** browser: CSS animation state
- **Source:** `viewer/ui/chrome/stage-tools.js:38-40, 71-92, 98-106`
- **Expected:** Keyboard open → popover has `data-instant`; Escape, then a pointer click → no `data-instant`.
- **Covered by:** `src/features/stage/Dock.svelte.test.ts` (I: asserts the `data-instant` attribute, not that no animation runs)

### STAGE-22 · A popover opens above the whole dock on its start edge, inside the visible stage

- **Rule:** Whichever tool opened it, the popover opens upward from the dock's start edge, slides left to stay inside the visible stage, never sits under a side sheet, and never gets a negative size. On a phone it fills the stage between the gutters and stops a third of the stage short of the top; past that it scrolls, and a focused control scrolls into view.
- **Kind:** behaviour
- **Level:** unit (placement numbers); browser for the drawn popover
- **Source:** `viewer/ui/chrome/stage-tools.js:11-31, 49-69`; `stage-tools.test.js:8-44`
- **Expected:** `placePopover({ toolbar: {16, 770}, visible: 1120×824 at 0,0, width: 288 })` → `{ left: 0, width: 288, maxHeight: 746 }`. Visible 420 wide, toolbar left 200 → `left + 200 + width = 404`. Phone fill, visible 390×600, toolbar (16, 540) → `{ left: 0, width: 358, maxHeight: 352 }`. Side sheet, visible x 220, 624×338, toolbar (236, 282) → `left + 236 = 236`, `maxHeight: 258`. Visible 20×20, toolbar (0, 10) → width 0, maxHeight 0. In the app: desktop popover 272 px wide, left edge on the dock's, bottom above the dock's top. Phone 390×700, sheet inset 200, 200 % text → width 350, top ≥ (dock top / 3) − 1, left 20, scrolls, and Display's last control, "Show spinal cord", focused, lies inside the shown part. Built site 390 wide: popover inside 0–390 and wider than 272.
- **Covered by:** `src/features/stage/place-popover.test.ts` (R); `src/features/stage/Dock.svelte.test.ts` (R, placement)

## The orientation gizmo

### STAGE-23 · The gizmo draws the six directions as the camera sees them

- **Rule:** Each anatomical direction (R, L, A, P, S, I; French D, G) is a lettered circle placed by projecting it on the camera's basis: screen x = d · right, screen y = −(d · up). A direction toward the viewer (d · back ≥ 0) draws in front, over the centre; one pointing away draws behind it, smaller and dimmer. Three faint axes run through the centre. The positions follow every `camera` event, written straight into the DOM. The engine publishes the basis with the event, the fake engine too.
- **Kind:** behaviour
- **Level:** unit (basis and projection); browser for the drawn letters
- **Source:** Blender's navigation gizmo; `web/src/lib/engine/render/orientation.ts` (`cameraBasis`, `projectAxes`, the AXES table: x = right, y = superior, z = posterior)
- **Expected:** Left view basis right [0, 0, 1], up [0, 1, 0], back [−1, 0, 0]; superior right [1, 0, 0], up [0, 0, −1], back [0, 1, 0], for both engines; with a target, the basis lookAt gives, not a rotation left on the camera. Posterior view: R x ≈ 1, S y ≈ −1, P depth ≈ 1; anterior: R x ≈ −1, L x ≈ 1, A depth ≈ 1. Drawn, anterior held: L > 20 px right of centre, R > 20 px left, S > 20 px above, I > 20 px below; A at the centre with the highest z-index and wider than P, which is `data-facing="away"`. A camera event with right [0, 1, 0], up [−1, 0, 0] → S right, R below. Every letter facing away has a lower z-index than the centre, every one facing the viewer one at least as high.
- **Covered by:** `src/lib/engine/render/orientation.test.ts` (R); `src/lib/engine/fake/contract-suite.ts` (R, fake and headless real engine); `src/features/stage/OrientationGizmo.svelte.test.ts` (R)

### STAGE-24 · A letter frames its view; the centre frames the oblique one

- **Rule:** A letter asks for the view from that side (L left, R right, A anterior, P posterior, S superior, I inferior), the centre for the oblique view, through the same command the dock's presets used, and retires the navigation hint. Each is named "<view> view" (French "Vue <view>") with a matching tooltip; the drawn letter is hidden from assistive technology.
- **Kind:** behaviour
- **Level:** browser: real pointer clicks (the command is a mock, the gizmo-to-controller contract)
- **Source:** `viewer/ui/chrome/viewport-chrome.js:498-509`
- **Expected:** Looking down a diagonal, so nothing overlaps: "Right view" → `chooseView` calls `[['right']]`, likewise left, anterior, posterior, superior, inferior; "Oblique view" → `[['oblique']]`; hint retired each time. Letter texts map R/L/S/I/P/A to "Right/Left/Superior/Inferior/Posterior/Anterior view". French "Vue gauche" is the L button. In the app, "Superior view" sets the session's view to `superior`, calls `camera.applyView('superior')` and is pressed.
- **Covered by:** `src/features/stage/OrientationGizmo.svelte.test.ts` (R); `src/app/regions/StageRegion.svelte.test.ts` (R)

### STAGE-25 · A view is pressed only while the camera holds it

- **Rule:** Of the centre and the six letters, the one whose view the camera holds is `aria-pressed` and drawn in the accent; a drag, a camera key or a chevron moves the camera off it and none is pressed, while the session still names the view.
- **Kind:** behaviour
- **Level:** browser: the pressed state follows `camera.viewHeld` and the session view
- **Source:** `viewer/ui/chrome/viewport-chrome.js:491-541, 560-597`
- **Expected:** At start pressed = ["Oblique view"]; after "Left view" → ["Left view"], its background differing from R's; `orbitBy({ azimuth: 0.1 })` → [], session view still `left`. After a chevron → [].
- **Covered by:** `src/features/stage/OrientationGizmo.svelte.test.ts` (R); camera-key release is FACADE-21

### STAGE-26 · The gizmo is one toolbar, shown with the anatomy

- **Rule:** The gizmo is a toolbar named "Anatomical view" (French "Vue anatomique") with one Tab stop, on the held view, else the first control; the arrows and Home/End walk the centre, the letters, the chevrons and Reset view, Enter and Space press. Its root marks its keys as its own (decision 7). It is not drawn while the anatomy is not on screen, nor under the raised phone sheet; over the tract reference it stays.
- **Kind:** accessibility
- **Level:** browser: focus, keyboard and computed visibility
- **Source:** WAI-ARIA APG Toolbar; deviation `g2-dock-toolbar.md`
- **Expected:** Tab from the canvas → "Oblique view"; → → "Right view"; End → "Reset view"; Enter → `reset` once; Tab → the next control after the stage. `data-own-keys` on the root. `ready: false` → not visible; true → visible. `sheetFull = true` → `visibility: hidden`.
- **Covered by:** `src/features/stage/OrientationGizmo.svelte.test.ts` (R); `src/app/regions/StageRegion.svelte.test.ts` (R, the sheet)

### STAGE-27 · Four chevrons on the ring orbit the model one step without dragging

- **Rule:** A group "Turn the model" of four chevrons sits on the gizmo's ring, one on each side. Each press turns the camera one keyboard-arrow step in that direction, leaves the held view and retires the hint. They are quiet (muted ink, brighter on hover and focus) and always shown. Nothing is announced.
- **Kind:** accessibility
- **Level:** browser (the step mapping is RENDER-21)
- **Source:** deviation `g2-orbit-step-buttons.md` (WCAG 2.5.7); decisions 10a, 10b and 22 on #4
- **Expected:** "Turn left" → `orbitBy({ azimuth: π/36 })`, "Turn right" → `{ azimuth: −π/36 }`, "Turn up" → `{ polar: π/36 }`, "Turn down" → `{ polar: −π/36 }`, one call per press, each with its name as tooltip; then nothing pressed, hint retired. Each chevron's centre lies more than 30 px from the gizmo's centre on its own side.
- **Covered by:** `src/features/stage/OrientationGizmo.svelte.test.ts` (R)

### STAGE-28 · Reset view resets through the controller

- **Rule:** Reset view, an icon button in the gizmo's corner under the axes, calls the controller's reset once (the opening picture, oblique view included). It is named and tooltipped "Reset view".
- **Kind:** behaviour
- **Level:** browser
- **Source:** `viewer/ui/chrome/display.js:193`
- **Expected:** Pointer on "Reset view" → `reset` called once, `data-tooltip` "Reset view". In the app → `model.reset` once.
- **Covered by:** `src/features/stage/OrientationGizmo.svelte.test.ts` (R); `src/app/regions/StageRegion.svelte.test.ts` (R)

### STAGE-52 · The gizmo sits top right, plateless, clear of the keys and the letters

- **Rule:** The gizmo stands on the stage gutter at the top right of the visible stage, inside the colour keys' band, and clear of the top and right orientation letters. It draws no plate: the letters, axes and glyphs are markings held off tissue by the stage's halo. In full screen it moves below the exit control.
- **Kind:** behaviour
- **Level:** browser: layout
- **Source:** decision of 2026-10-31 (transparent gizmo)
- **Expected:** Insets top 30, right 40, key band right 120 → gizmo top − host top = 30 + gutter, host right − gizmo right = 160 + gutter. No background on the root or the field; root ≤ 120 px wide. In the app at 1280×800 and 390×844: within 40 px of the stage's top and right edges, and its box intersects neither the top nor the right letter.
- **Covered by:** `src/features/stage/OrientationGizmo.svelte.test.ts` (R); `src/app/regions/StageRegion.svelte.test.ts` (R); the full-screen offset is uncovered

### STAGE-53 · Gizmo targets are 24 px; the chevrons and Reset view grow to 44 px on a coarse pointer

- **Rule:** The centre, the letters, the chevrons and Reset view are 24 × 24 px targets. On a coarse pointer the chevrons and Reset view grow to 44 × 44 px outward from the axes, their glyphs staying where they were drawn; the letters stay 24 px (deviation `g2-gizmo-letter-targets.md`).
- **Kind:** accessibility
- **Level:** browser: layout under touch emulation (WCAG 2.5.8)
- **Source:** deviation `g2-gizmo-letter-targets.md`
- **Expected:** Every gizmo button 24 × 24; touch emulation on → the five icon buttons `[44, 44]`, and "Turn right"'s glyph centre unchanged (to 1 px).
- **Covered by:** `src/features/stage/OrientationGizmo.svelte.test.ts` (R)

### STAGE-54 · The gizmo passes axe

- **Rule:** axe finds no violation with the gizmo on the stage, in English and French.
- **Kind:** accessibility
- **Level:** browser: axe
- **Source:** WCAG 2.2 AA
- **Expected:** `expectAxeClean()` passes in each language.
- **Covered by:** `src/features/stage/OrientationGizmo.svelte.test.ts` (R)

## The Display popover

### STAGE-29 · The hemisphere is a radio group; the side already shown does nothing

- **Rule:** "Hemisphere" offers Both, Left and Right as a radio group: the arrows move and choose. Choosing the side already shown changes nothing, so the reader's orbit is kept.
- **Kind:** behaviour
- **Level:** browser: keyboard (decision 6 on #4)
- **Source:** `viewer/ui/chrome/display.js:175-181`; deviation `u3-segmented-controls.md`
- **Expected:** One radiogroup "Hemisphere" with three radios. Click "Both" (shown) → `setHemisphere` not called; → → `setHemisphere('left')`. Built site: Left → the link has `hemi=left`.
- **Covered by:** `src/features/stage/Dock.svelte.test.ts` (R)

### STAGE-30 · The display checkboxes apply at once and show the display they are given

- **Rule:** Show cortex, Show internal anatomy and Show spinal cord apply on change and the popover stays open. Each shows the current display. The spinal cord choice is absent, not disabled, when the subject publishes no cord.
- **Kind:** behaviour
- **Level:** browser: native checkbox events (which boxes exist is unit, view-model)
- **Source:** `viewer/ui/chrome/display.js:183-230`
- **Expected:** Clicks → `setCortexVisible(false)`, `setInternalVisible(false)`, `setSpinalCordVisible(true)`; Display `aria-expanded="true"`. Given `internalVisible: false, spinalCordVisible: true` → checked true/false/true. `hasSpinalCord: false` → no "Show spinal cord", two checkboxes.
- **Covered by:** `src/features/stage/Dock.svelte.test.ts` (R)

### STAGE-31 · The cortex opacity slider speaks a percentage, steps by 5 % and goes with the cortex

- **Rule:** The opacity slider's value is spoken as a percentage in the reader's notation; an arrow step is 5 %. While the cortex is hidden the slider is removed, not greyed.
- **Kind:** behaviour
- **Level:** browser: native range step (the percentage text is I18N formatting)
- **Source:** `viewer/ui/chrome/display.js:224-229`
- **Expected:** Opacity 0.65 → `aria-valuetext` "65%", French "65 %"; → → `setCortexOpacity` once with 0.7 (±1e-10). Cortex hidden → no slider. Built site: default "100%", French `^100\s%$`; unchecking Show cortex removes the slider and checking returns it.
- **Covered by:** `src/features/stage/Dock.svelte.test.ts` (R)

## Tools that go away

### STAGE-32 · A popover whose tool or dock goes closes, and focus is not lost

- **Rule:** When the tract reference hides every tool, the open popover closes and focus inside it, or on a hidden tool, moves to the model (the canvas). When the coordinate spaces go, the Coordinate popover closes and focus moves to the first tool left. While the dock is not drawn (loading, error, lost context) or the raised phone sheet covers it, any popover closes and nothing in the dock keeps focus.
- **Kind:** accessibility
- **Level:** browser: focus
- **Source:** `viewer/ui/chrome/viewport-chrome.js:634-640`; deviation `g2-focus-when-tool-hidden.md`
- **Expected:** Display open, focus on "Both", tract reference on → no dialog, focus on the canvas. Focus on Section, tract reference on → focus on the canvas. Coordinate open, spaces gone → no dialog, focus on Section. Display open, `sheetFull = true` → no dialog, Display `aria-expanded="false"`, focus not inside the dock. Display open, status `loading` → no dialog, dock `visibility: hidden`; `switching` → `visible`.
- **Covered by:** `src/features/stage/Dock.svelte.test.ts` (R)

## The Lesion popover

### STAGE-55 · A click on the brain places the lesion only while chosen in the open Lesion popover

- **Rule:** The Lesion popover opens on selecting. Once the reader chooses to place, a click on the brain places the lesion and a press on the stage keeps the popover open. Closing it, or opening another tool in its place, returns to selecting. Without that choice a press on the stage closes the popover, as it closes Section's. Over the tract reference nothing is placed.
- **Kind:** behaviour
- **Level:** browser: real pointer presses on the canvas (the lesion store is a mock)
- **Source:** `web/src/features/lesion/LesionPopover.svelte`; `web/src/features/stage/Dock.svelte`
- **Expected:** Lesion open → placing `false`; "Place" → `true`; a click on the canvas → still open, `true`; a press outside → closed, `false`; reopened → "Place" `aria-pressed="false"`. Placing, then Section → `false`. Lesion open, canvas click → closed, never `true`. Section open, canvas click → closed. Tract reference → no "Lesion", placing `false`.
- **Covered by:** `src/features/stage/Dock.svelte.test.ts` (R)

## Size, reflow and media

### STAGE-33 · Dock targets are 24 px, 44 px on a coarse pointer, at the legacy sizes

- **Rule:** Every tool, radio and tick-box label is at least 24 × 24 px, and 44 × 44 px on a coarse pointer. At 100 % text the hemisphere radios are 28 px tall; under the phone query every choice is 44 px; on a coarse pointer the tick box is 20 × 20 px with an 11 × 6 px tick. The gizmo's targets are STAGE-53.
- **Kind:** accessibility
- **Level:** browser: layout (WCAG 2.5.8)
- **Source:** `viewer/styles/stage.css:445, 638`; `components.css:221`; `phone.css:329, 335`; deviation `g2-text-reflow.md`
- **Expected:** As stated; radios `Array(3).fill(28)`; at 390×844 `Array(3).fill(44)`; coarse tick box `[20, 20]`, `::before` `['11px', '6px']`.
- **Covered by:** `src/features/stage/Dock.svelte.test.ts` (R)

### STAGE-34 · At 200 % text and with text spacing nothing in the dock is clipped

- **Rule:** With 200 % text and the WCAG 1.4.12 spacing override no tool, button, label or paragraph is clipped and no popover scrolls sideways, in either language. On a phone at 200 % the tools wrap inside the dock, which stays inside the stage.
- **Kind:** accessibility
- **Level:** browser: layout (WCAG 1.4.4, 1.4.10, 1.4.12)
- **Source:** deviation `g2-text-reflow.md`
- **Expected:** Every listed node: `scrollWidth ≤ clientWidth + 0.5` and `scrollHeight ≤ clientHeight + 0.5`, dock and Display popover, EN and FR; popover `scrollWidth ≤ clientWidth`. Phone 390×700: dock right ≤ stage right; each tool's right ≤ dock right.
- **Covered by:** `src/features/stage/Dock.svelte.test.ts` (R)

### STAGE-35 · The dock answers forced colours, increased contrast and reduced motion

- **Rule:** In forced colours the open tool gets an outline of its own; with reduced motion the tool chevron turns at once.
- **Kind:** accessibility
- **Level:** browser: computed style under media emulation
- **Source:** `viewer/styles/a11y.css:13-15, 34-38, 57-61`
- **Expected:** Display open: `outline-style: none`; forced colours → `solid`, `2px`. Chevron `transition-duration > 0`; reduced motion → `0`.
- **Covered by:** `src/features/stage/Dock.svelte.test.ts` (R)

### STAGE-36 · The dock passes axe with each popover open

- **Rule:** axe finds no violation with the dock alone and with each of the four popovers open, in English and French.
- **Kind:** accessibility
- **Level:** browser: axe
- **Source:** WCAG 2.2 AA
- **Expected:** `expectAxeClean()` passes 5 times per language.
- **Covered by:** `src/features/stage/Dock.svelte.test.ts` (R)

## Colour keys

### STAGE-37 · The stage shows the key of what is painted, titled as the masthead names it

- **Rule:** While the anatomy is ready (or switching): a network colouring keys its networks (Yeo 7 or CAB-NP); a paint's key replaces the colouring's, which it covers; the direction key, with its three directions, follows the shown streamlines and comes after the others. A colouring with no key, or with no published data, shows none, and nothing shows while loading, after an error or a lost context.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/viewport-chrome.js:272-387`; `web/src/features/stage/stage-keys.ts`
- **Expected:** Network → plate `network`, title "Yeo 7 networks", rows "Visual", "Default mode", first swatch [120, 18, 134]. CAB-NP French → "Visuel primaire", "Langage". Paint legend over network → plates `['paint']`, map `deficit`, title "Aphasia", note "A note.", rows `[f1, pressed, present]`, `[f2, not pressed, absent]`. Network + direction → `['network', 'direction']`, rows "Left–right", "Anterior–posterior", "Superior–inferior". Status `loading`/`error`/`context-lost` → `[]`; `switching` → one plate; `atlas` → `[]`; network with no networks → `[]`. Built site: `colors=network` → 7 rows incl. "Default mode"; French "Réseaux Yeo 7", "Visuel".
- **Covered by:** `src/features/stage/stage-keys.test.ts` (R); `src/features/stage/StageKeys.svelte.test.ts` (R)
- **Territories:** the Blood supply colouring keys every branch territory in the atlas's order, its colour and its name in the reader's language: French `territory` → title "Territoires artériels", rows "Artère cérébrale antérieure" [59, 111, 182], "Basilaire"; no published territories → no plate (`stage-keys.test.ts`, R).

### STAGE-38 · A key is a named disclosure over a list with a swatch per row

- **Rule:** Each plate's title row is a toggle (disclosure) controlling the plate's body; a plain key's rows are a list named by the title, which keeps its list role (Safari/VoiceOver); each row has a swatch in its colour. The direction key's swatches are the streamline colours.
- **Kind:** accessibility
- **Level:** browser: accessibility tree and computed colours
- **Source:** `viewer/ui/chrome/viewport-chrome.js:277-297`; deviation `g3-list-role.md`
- **Expected:** Toggle "Yeo 7 networks" `aria-expanded="true"`, `aria-controls="network-key-body"`; list "Yeo 7 networks" with 2 listitems "Visual Default mode"; Visual swatch `rgb(120, 18, 134)`. Direction swatches `rgb(255, 0, 0)`, `rgb(0, 255, 0)`, `rgb(0, 0, 255)`.
- **Covered by:** `src/features/stage/StageKeys.svelte.test.ts` (R)

### STAGE-39 · The reader folds a key, and that fold is kept for the visit

- **Rule:** The title toggle folds the rows away and opens them again by click, Enter or Space, keeping focus. The reader's fold of a map is remembered per map for the visit, outranks the crowd default (STAGE-40) and survives a language change.
- **Kind:** behaviour
- **Level:** browser: focus; the per-map memory is unit (view-model)
- **Source:** `viewer/ui/chrome/viewport-chrome.js:286, 317, 389-394`
- **Expected:** Enter → `aria-expanded="false"`, body not visible, focus on the toggle; Space → `"true"`, list visible. Fold Yeo 7, switch to CAB-NP → CAB-NP open; back → Yeo 7 folded. CAB-NP crowd-folded at 900 px, reader opens it, language `fr` → "Réseaux CAB-NP" still open.
- **Covered by:** `src/features/stage/StageKeys.svelte.test.ts` (R; "model() reports each plate's fold…" is I, pinning the shape G6 reads)

### STAGE-40 · A long or crowded key starts folded to its title

- **Rule:** A key of more than 8 rows starts folded where the stage is narrower than 1000 px or its rows would not fit above the dock. On a phone any key starts folded where it would take more than half that room. Rows count 24 px, or 44 px for toggle rows on a phone or coarse pointer; a phone runs two rows to a line, except a deficit's findings and the direction key; the head takes 42 px; the room is the stage height less three gutters and the dock. Before the stage has a size nothing folds, and a key already drawn is not refolded by a resize.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/viewport-chrome.js:28-45, 304-320`
- **Expected:** Room 1200×800, gutter 20, dock 40 (desktop): 8 rows on 500×200 → open; 9 rows → open; width 999 → folded; width 1000 → open; height 300 (258 > 200) → folded; height 358 → open; stage null (phone, coarse, 30 rows) → open. Phone: 4 rows on 390×500 → open; 10 rows on 390×320 (162 > 110) → folded. Phone + coarse on 390×400 (half room 150): 8 toggle rows → folded (218), 8 plain → open (138), 6 deficit rows → folded (186), 6 plain → open, 6 direction rows → folded. App: CAB-NP 12 rows unsized → open; stage set to 900 → folded; 1200 → open; drawn open at 1200, resized to 800 → stays open; 9 toggle rows on a 400 px stage → open, coarse pointer → folded. Built site phone: CAB-NP starts folded.
- **Covered by:** `src/features/stage/stage-keys.test.ts` (R); `src/features/stage/StageKeys.svelte.test.ts` (R; the three crowd-fold cases duplicate the unit cases)

### STAGE-42 · A paint key's rows are toggles that show one row alone

- **Rule:** A pickable paint key with more than one row is a toolbar named by its title, of `aria-pressed` toggles with one Tab stop on the pressed row (else the first). Arrows, Home and End move and wrap; Enter picks; choosing the pressed row again clears the pick. A z scale, or a key of one row, is a plain list with no buttons.
- **Kind:** behaviour
- **Level:** browser: keyboard
- **Source:** `viewer/ui/chrome/viewport-chrome.js:322-380, 404-409`; deviation `g3-paint-toolbar.md`
- **Expected:** Deficit "Aphasia", f3 picked → toolbar "Aphasia"; "Arcuate…" pressed true, "Broca…" false; tabIndex [−1, −1, 0]; list has `data-picked`. From the first row: ↓ → second; End → third; ↓ → first; ↑ → third; Home → first; no pick yet; Enter → `onPaintPick('f1')`. f1 picked: click Broca → `onPaintPick(null)`; click Arcuate → `'f3'`. `pickable: false` → list "Aphasia", no toolbar and no row buttons; one row → no toolbar. Built site (`function=all`): 11 row buttons, first not pressed; "Language…" → link `function=language`, then one button (the toggle) and no toolbar.
- **Covered by:** `src/features/stage/StageKeys.svelte.test.ts` (R)

### STAGE-43 · Focus never falls to the page when a key changes under it

- **Rule:** A row stays the same element as its state changes, so focus stays on it. If the focused row goes, or a crowd fold hides it, focus moves to its plate's toggle; if the plate goes, to the stage host. A row is its finding: focus never passes to a neighbour. A pick that places focus elsewhere itself (opening a profile) is not preceded by a hop to the toggle.
- **Kind:** accessibility
- **Level:** browser: focus
- **Source:** `viewer/ui/chrome/viewport-chrome.js:351-353, 379`; deviation `g3-focus-handoff.md`
- **Expected:** Focus on row 1, legend picks f1 → same element, `aria-pressed="true"`, still focused. Focus on row 3, rows cut to 2 → focus on toggle "Aphasia"; focus on a row, legend `null` and colour `atlas` → focus on `#viewport`. Focus on f1, f1 removed → toggle focused; rows "Wernicke", "Arcuate". Pick that focuses an `h2` → `h2` focused two frames later, no focusin on a `.stage-key-toggle`. 9 rows, focus on row 5, phone on → folded, focus on the toggle.
- **Covered by:** `src/features/stage/StageKeys.svelte.test.ts` (R)

### STAGE-44 · An absent colour is outlined and said; a pick mutes the others

- **Rule:** A row whose colour no drawn region carries has an outlined, unfilled swatch and its name ends with "Not shown in this view", after the visible label. In a picked key the picked row is bold and the rows stepped back from are muted.
- **Kind:** accessibility
- **Level:** browser: computed style and accessible name (WCAG 1.4.1, 2.5.3)
- **Source:** `viewer/ui/chrome/viewport-chrome.js:359-363, 373`; deviation `g3-absent-text.md`
- **Expected:** Wernicke swatch `background-color: rgba(0, 0, 0, 0)`, `box-shadow` contains `inset`; Broca `box-shadow: none`. Wernicke button text `^\s*Wernicke\s*\.\s*Not shown in this view$`, `.stage-key-label` "Wernicke"; Broca button named exactly "Broca"; French name contains "Absent de cette vue". f1 picked → f1 `font-weight: 600`, `color: rgb(241, 242, 244)`; f2 not 600, `rgb(174, 179, 186)`.
- **Covered by:** `src/features/stage/StageKeys.svelte.test.ts` (R)

### STAGE-45 · A paint key's note shows only where it does not crowd the rows

- **Rule:** The paint key's note sits under its rows while the key is open on a stage at least 600 px wide. It is dropped when the key is folded, on a narrower stage, or where the stage leaves the rows too little height.
- **Kind:** behaviour
- **Level:** unit (view-model) for the fold and width rule; browser for the height rule
- **Source:** `viewer/ui/chrome/viewport-chrome.js:40-44, 374-378`
- **Expected:** "Each finding names the regions it cites." visible at 1200×800; folded → not visible; visible width 599 → not visible, 600 → visible; 200 px tall stage (gutter 12, dock 38) → note `data-clipped` and not visible.
- **Covered by:** `src/features/stage/StageKeys.svelte.test.ts` (R)

### STAGE-46 · The keys take a band off the framing rectangle, the one that leaves the larger square

- **Rule:** Shown keys take either the top strip down to their foot or a right column, whichever leaves the anatomy the larger square, with a tie going to the strip, in whole pixels. No keys or no stage size, no band. A change of the band reframes the camera once.
- **Kind:** behaviour
- **Level:** unit (`keyBand`); browser for the measured keys
- **Source:** `viewer/ui/chrome/viewport-chrome.js:411-442`
- **Expected:** `keyBand(0×0, 1000×600, 20)` → `{0, 0}`; `(200×100, null)` and `(200×100, 0×0)` → `{0, 0}`. `(350×100, 390×500, 20)` → `{ top: 120, right: 0 }`. `(100×500, 1000×600, 20)` → `{ top: 0, right: 120 }`. Square 600×600: `80×80` → `{ top: 100, right: 0 }`; `80×81` → `{ top: 0, right: 100 }`. `(350.4×100.6, 390×500)` → `{ top: 121, right: 0 }`; `(100.4×500.6, 1000×600)` → `{ top: 0, right: 120 }`. In the app: folding a key on a 390×700 stage shrinks `keyInset.top` and calls `onDock` once; no plate → `{0, 0}` and key size 0×0. Built site: `--key-top + --key-right > 0` with `colors=network`, 0 with `colors=tissue`.
- **Covered by:** `src/features/stage/stage-keys.test.ts` (R); `src/features/stage/StageKeys.svelte.test.ts` (R; "the fitting runs on every framing without forcing layout" and "the fitter is let go with the keys" are I: layout-read and `setKeys` spies)

### STAGE-47 · Key targets are 24 px, touch rows are 44 px

- **Rule:** On a desktop the title toggle and the paint rows are at least 24 px tall. On a coarse pointer the paint rows are 44 px; on a phone the title row is 44 px, a deficit's findings run one to a line and networks two.
- **Kind:** accessibility
- **Level:** browser: layout (WCAG 2.5.8)
- **Source:** `viewer/styles/stage.css:186-285`; `viewer/ui/chrome/viewport-chrome.js:299-303`
- **Expected:** Toggle and rows height ≥ 24. Coarse: rows ≥ 44. Phone 390: toggle ≥ 44; `#paint-key .stage-key-list` 1 grid column; `#network-key .stage-key-list` 2.
- **Covered by:** `src/features/stage/StageKeys.svelte.test.ts` (R)

### STAGE-48 · Keys reflow, ring their focus in teal and keep their colours in forced colours

- **Rule:** At 200 % text with the 1.4.12 spacing no key row is clipped and the plate does not spill. Keyboard focus is a ring of at least 2 px in the stage teal, inside the plate. In forced colours every swatch keeps its own colour, an absent one stays outlined, and the plate takes a system edge. axe finds nothing.
- **Kind:** accessibility
- **Level:** browser: layout, computed style, axe
- **Source:** `viewer/styles/stage.css:186-285`; `viewer/styles/a11y.css`
- **Expected:** Toggle font ≥ 24 px at 200 %; every row and button `scroll ≤ client + 1`; plate `scrollWidth ≤ clientWidth + 1`. Tab from the canvas → the toggle, `outline-color: rgb(127, 208, 204)`, width ≥ 2, offset < 0. Forced colours: Broca swatch background unchanged, plate `border-top-color` = body `color`, Wernicke `box-shadow` contains `inset`. axe clean for a CAB-NP plate with the direction key and for a picked paint key with an absent row and its note; built-site phone run.
- **Covered by:** `src/features/stage/StageKeys.svelte.test.ts` (R)

## Full screen

### STAGE-49 · Only the stage goes full screen, with a visible way out

- **Rule:** Full screen shows the stage host alone. While it is full screen the stage shows an "Exit full screen" control, which takes focus as the stage enters, and every full-screen control's label follows `fullscreenchange`: "Exit full screen" while full screen, "Full screen" otherwise. The exit control is never under the stage's own chrome.
- **Kind:** accessibility
- **Level:** browser: the Fullscreen API and focus; e2e for the real masthead and stage together
- **Source:** `viewer/ui/chrome/viewport-chrome.js:625-632`; deviation `g6-fullscreen-exit.md`; decisions 4, 15 and 33 on #4 ("Exit full screen" / "Quitter le plein écran")
- **Expected:** Before: exit control hidden. Click the opener → `document.fullscreenElement === host` (`#viewport`), exit control shown and focused, `active === true`, opener label "Exit full screen". Built site: `#viewport` full screen; the `#viewport` button "Exit full screen" visible and focused; `elementFromPoint` at its centre is that button; axe clean; French "Plein écran" → "Quitter le plein écran" focused.
- **Covered by:** `src/features/stage/fullscreen.svelte.test.ts` (R; a hand-built opener and host, not the real Masthead and Stage). The exit control is not mounted in the real stage yet (I2): its presence inside `#viewport` is uncovered below e2e.

### STAGE-50 · Leaving full screen gives focus back to the control that asked

- **Rule:** On leaving, focus that was on the exit control or nowhere returns to the control that asked for full screen; if that control is gone or disabled, to the stage host. Focus on a stage tool that is still shown stays there. The exit control hides.
- **Kind:** accessibility
- **Level:** browser: focus around the Fullscreen API
- **Source:** deviation `g6-fullscreen-focus.md`
- **Expected:** Enter, then Enter on the focused exit control → not full screen, exit hidden, focus on the opener, label "Full screen". Enter, focus a stage tool, `document.exitFullscreen()` → focus on the tool. Enter, opener disabled, Space on the exit control → focus on `#viewport`. Built site: Enter on the exit control → exit hidden, masthead "Full screen" focused.
- **Covered by:** `src/features/stage/fullscreen.svelte.test.ts` (R)

### STAGE-51 · A refused full screen is said, and nothing changes

- **Rule:** When the browser refuses full screen, the reader gets a notice in their language and the labels stay as they were; the error is logged.
- **Kind:** behaviour
- **Level:** browser: a real refusal (the notice text is unit)
- **Source:** `viewer/ui/chrome/viewport-chrome.js:627`; deviation `g6-fullscreen-failure.md`; comment 87 on #4 (`errors.operations.fullscreen`)
- **Expected:** Host removed from the document, language `fr`, click the opener → one notice `{ text: 'Impossible de passer en plein écran.', action: null }`, `console.error` once, `fullscreenElement === null`, opener "Full screen". English text "Could not enter full screen.".
- **Covered by:** `src/features/stage/fullscreen.svelte.test.ts` (R)
