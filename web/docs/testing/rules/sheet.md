# Phone sheet rules

Scope: chunk H6 (#45), the phone bottom sheet with three rests (peek, half, full): where it may rest and which rest a drag lands on (`detents`), the phone shell it creates, the grip (handle, selection strip, safety statement), dragging, what it tells the stage, and its focus and announcement rules. The workspace inside it (tabs, notice, panels) is in `workspace.md`; how the camera follows the sheet is in `engine-e5.md` (SCENE-02, -03, -05, -07) and `engine-e7.md` (FACADE-15). Legacy sources: `viewer/ui/chrome/sheet.js`, `viewer/ui/chrome/detents.js` (and its `detents.test.js`), `viewer/ui/chrome/sheet.test.js`, `viewer/styles/phone.css`, `viewer/styles/a11y.css:8-14`. New code: `web/src/lib/core/detents.ts`, `web/src/features/sheet/Sheet.svelte`. Deviations: `h6-detent-announcements.md`, `h6-first-inset-report.md`, `h6-handle-controls.md`, `h6-handle-target.md`, `h6-peek-focus.md`. Decision records 0006 (sheet semantics) and 0007 (one tablist, nothing moves in the DOM); decision 20 on #4; comment 79 on #4 (the wiring requests). Spans are CSS pixels along the axis the sheet grows on: height upright, width sideways. "Stage height" H is the height of the stage host (`#viewport`). Copy quoted is the English interface text.

## The rests

### SHEET-01 · Upright, the sheet rests at peek, half or full, and full leaves a fixed band of picture

- **Rule:** Upright, peek is the grip's measured height (132 px when it cannot be measured), half is half the stage height, and full is the stage height less a 128 px band of picture, the same on every phone.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/detents.js:17,29-41`
- **Expected:** `detentHeights(800, UPRIGHT_DETENTS)` = `{peek: 132, half: 400, full: 672}`. A measured grip of 101 px on 784 → peek 101. `available − full` = 128 at 784 and at 607. 812 → half 406, full 684.
- **Covered by:** `src/lib/core/detents.test.ts` (R); `src/features/sheet/Sheet.svelte.test.ts` (R, the handle steps to round(0.5·H) and H − 128)

### SHEET-02 · On a short screen the rests stay ordered and inside it, collapsing onto peek rather than overflowing

- **Rule:** Each rest is at least the one below it and never taller than the room. When the fractions fall below peek, the rests coincide with peek. A screen shorter than peek makes peek the whole screen.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/detents.js:29-38`
- **Expected:** `detentHeights(200, UPRIGHT_DETENTS)` = `{132, 132, 132}`. `detentHeights(80, UPRIGHT_DETENTS)` = `{80, 80, 80}`. `detentHeights(-5, …)` = `{0, 0, 0}`.
- **Covered by:** `src/lib/core/detents.test.ts` (W: asserts only `peek ≤ half ≤ full ≤ 200` and `tiny.peek = 80`; its name says "distinct" although at 200 px the three rests are equal; the negative case is uncovered)

### SHEET-03 · Held sideways, half shares the width evenly and full stops at 62 % so the model stays readable

- **Rule:** Sideways, peek is the wider of 216 px (plus the left safe area) and the one measured row of tabs; half is half the window width; full is 62 % of it. Half always opens past the measured tab row.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/detents.js:43-47`; `viewer/ui/chrome/sheet.js:66-79`
- **Expected:** `detentHeights(812, SIDEWAYS_DETENTS)` = `{216, 406, 503}` (upright 812 is `{132, 406, 684}`). With the French tab row as peek: 844 and 346 → `{346, 422, 523}`; 844 and 299 → `{299, 422, 523}`; 667 and 299 → `{299, 334, 414}`. In the browser at 844 × 390 the English sheet's peek is the tab row, 368 ± 1 px.
- **Covered by:** `src/lib/core/detents.test.ts` (R for the halves; W for the rest: only inequalities); `src/features/sheet/Sheet.svelte.test.ts` (R, "held sideways the one row of tabs is 368 px")

### SHEET-04 · A slow drag settles on the nearest rest, ties going down toward the anatomy

- **Rule:** Without a throw, the sheet settles on the rest nearest the span at release. Exactly between two rests, it takes the lower one.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/detents.js:50-60`
- **Expected:** With `{132, 400, 672}`: 140 → peek; 420 or 430 → half; 700 → full; from full at 150 with velocity 0.1 → peek; 266 (134 from both) → peek; 536 → half.
- **Covered by:** `src/lib/core/detents.test.ts` (R; the tie is uncovered); `src/features/sheet/Sheet.svelte.test.ts` (R, "a slow drag … settles on the nearest rest")

### SHEET-05 · A flick moves exactly one rest in its direction, and stops at the ends

- **Rule:** A release at 0.4 px/ms or faster moves one rest in the direction thrown, however little the finger travelled. A flick past the top or bottom rest stays there. Slower releases are read by position (SHEET-04).
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/detents.js:62-84`
- **Expected:** With `{132, 400, 672}`: `settleDetent('peek', 140, h, 1.2)` → half; `('half', 460, h, −1.2)` → peek; `('full', 700, h, 1.2)` → full; `('peek', 135, h, −1.2)` → peek; `('peek', 140, h, 0.4)` → half; `('peek', 140, h, 0.39)` → peek.
- **Covered by:** `src/lib/core/detents.test.ts` (R; the 0.4 threshold itself is uncovered); `src/features/sheet/Sheet.svelte.test.ts` (R, 30 px in 10 ms → half, −30 px → peek, +40 px at full stays full)

### SHEET-06 · Only the last 100 ms before release count as the throw

- **Rule:** Release velocity is the span change over time across the samples no older than 100 ms at release, oldest to newest. Fewer than two such samples, or no elapsed time, is no throw.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/detents.js:86-104`
- **Expected:** Samples (0, 132), (400, 150), (450, 190), (480, 220), released at 480 → 70/80 = 0.875 px/ms (±1e-9). (0, 132), (40, 300) released at 400 → 0. One sample → 0. In the browser, a 30 px move at 10 ms released at 170 ms settles back on peek.
- **Covered by:** `src/lib/core/detents.test.ts` (R); `src/features/sheet/Sheet.svelte.test.ts` (R, "a throw that stopped before the finger lifted is not a flick")

### SHEET-07 · Past the outer rests the sheet resists like a rubber band and never goes more than 72 px beyond

- **Rule:** Between peek and full a drag follows the finger. Past either end it follows at about half speed and ever less, approaching but never reaching 72 px of overshoot.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/detents.js:106-121`
- **Expected:** With `{132, 400, 672}`, overshoot `72·(1 − 1/(1 + 0.55·over/72))`: 440 → 440; 132 → 132; 672 → 672; full + 20 → 681.54; full + 100 → 703.18; full + 2000 → 739.58; 32 (peek − 100) → 100.82 (each ±0.01).
- **Covered by:** `src/lib/core/detents.test.ts` (W: inequalities only, `8 < near < 20`, `far < 72`); `src/features/sheet/Sheet.svelte.test.ts` (W, the same bounds in the browser)

## The phone shell

### SHEET-08 · On a phone the panel becomes a fixed sheet at the foot of the screen; on a desktop there is no sheet

- **Rule:** The phone shell applies at 800 px wide or less, and on a landscape window 480 px tall or less. There the sheet is fixed to the bottom edge and starts at peek with both panels hidden (sideways the rail keeps them; SHEET-10). Off the phone the sheet is not a box of its own, the grip is gone, nothing is written to the sheet's size, and the stage is told it covers nothing. A landscape window taller than 480 px keeps the bottom sheet.
- **Kind:** behaviour
- **Level:** browser — layout/CSS media queries
- **Source:** `viewer/ui/chrome/sheet.js:35-38,256-298`; `viewer/styles/phone.css:15,62-97`; `viewer/ui/chrome/sheet.test.js:103-164`
- **Expected:** 390 × 844 → `position: fixed`, sheet bottom = `innerHeight`, `data-detent="peek"`, `#navigator` and `#inspector` `visibility: hidden`. 1280 × 800 → `display: contents`, handle not visible, no `data-detent`, `style.height` empty, insets all 0, `sheetFull` false, `#navigator` visible. 780 × 700 → `style.height` set, `style.width` empty, `bottom: 0px`. 800 px wide → phone shell; 801 px wide → desktop.
- **Covered by:** `src/features/sheet/Sheet.svelte.test.ts` (R; the 800/801 boundary is uncovered)

### SHEET-09 · Peek hugs the grip, and follows it when its text grows or shrinks

- **Rule:** At peek the sheet ends where the tab row (and a notice, when one shows) ends, plus the home-indicator band, so nothing of the grip is cut off and no slack is left under it. The peek follows the grip when a selection name, a notice, a language, 200 % text or the WCAG 1.4.12 spacing changes its height, gliding like any change of rest.
- **Kind:** behaviour
- **Level:** browser — layout
- **Source:** `viewer/ui/chrome/sheet.js:61-79,243-251`
- **Expected:** At peek, `sheet.bottom − tablist.bottom` < 3 px, and the tablist bottom ≤ `innerHeight`. Adding a selection or a notice grows the span; removing it returns to the bare span exactly. With 200 % text and the spacing override, the span grows, the tab row still ends within 3 px of the screen foot, and the grip row's bottom ≤ the tablist's top + 1.
- **Covered by:** `src/features/sheet/Sheet.svelte.test.ts` (R)

### SHEET-10 · Held sideways the sheet is a side rail from the stage's top, and rotating swaps the axis

- **Rule:** On a short landscape window the same sheet with the same rests sits on the left, starts at the stage's top (so it does not cover the masthead), grows rightward, and at peek is as wide as its one row of tabs, whose labels never wrap. Being full height, the rail keeps its panel at peek rather than leaving an empty column, so a selection does not raise it. Rotating back restores the bottom sheet and hides the panel at peek.
- **Kind:** behaviour
- **Level:** browser — layout
- **Source:** `viewer/ui/chrome/sheet.js:58-100`; `viewer/styles/phone.css` (landscape block)
- **Expected:** 390 × 844 rotated to 844 × 390 → `style.width` set, `style.height` empty, `style.top` = round(stage top) px, sheet left = 0, last tab's right within 40 px of the sheet's right edge, tab `white-space: nowrap`, `#navigator` visible and taller than 100 px. Back to 390 × 844 → `style.height` set, `style.width` and `style.top` empty, `#navigator` hidden.
- **Covered by:** `src/features/sheet/Sheet.svelte.test.ts` (R)

### SHEET-11 · The stage is told the span the sheet will land on, and whether it glides there

- **Rule:** The sheet reports what it covers rather than resizing the canvas: upright `{top 0, right: safe right, bottom: span, left: safe left}`, sideways `{top 0, right: safe right, bottom: safe bottom, left: span}`, all zero off the phone. It reports the target span of a change of rest, not the moving box, and says `settle: true` when it moves on its own curve and `settle: false` while it follows a finger. A window narrowed to a phone after load reports the laid-out grip's cover.
- **Kind:** behaviour
- **Level:** browser — layout (the span comes from measured boxes)
- **Source:** `viewer/ui/chrome/sheet.js:103-122`; deviation `h6-first-inset-report.md`; comment 79 on #4
- **Expected:** At peek: last report `{insets: {0, 0, rect.height, 0}, settle: true}`. During a drag: `settle: false`. After the handle: `bottom` = round(0.5·H), then H − 128. Desktop 1280 × 800 narrowed to 390 × 844 → the last `bottom` > 60 and = round(sheet height); widened again → `{0, 0, 0, 0}`. In the app the stage's `--vis-bottom` follows each rest (> 60 at peek, round(0.5·H) ± 5 at half), and `--vis-left` > 100 sideways.
- **Covered by:** `src/features/sheet/Sheet.svelte.test.ts` (R)

### SHEET-12 · A full sheet tells the stage, which then gives up its dock

- **Rule:** The stage layout's `sheetFull` is true exactly while the sheet rests at full on a phone, written before the inset is reported. Leaving the phone shell or unmounting sets it back to false.
- **Kind:** behaviour
- **Level:** browser — needs the mounted sheet; the flag itself is plain state
- **Source:** comment 79 on #4 (I2, `stage.css:720-721`); `web/src/features/sheet/Sheet.svelte`
- **Expected:** peek → false; half → false; full → true; a flick down from full stays full and true; at full, resizing to 1280 × 800 → false.
- **Covered by:** `src/features/sheet/Sheet.svelte.test.ts` (R); hiding the dock at full is a stage rule (`stage.md`)

## The handle

### SHEET-13 · The handle is a button that steps peek, half, full, peek, named for what a press does

- **Rule:** The grip handle is a native button. Each press moves one rest up, and from full it goes back to peek. Its name is "Expand panel" at peek and half and "Collapse panel" at full (FR "Déplier le panneau", "Replier le panneau"). It controls `#workspace-panel`, has no `aria-expanded`, and Escape does not move the sheet. Enter and Space press it.
- **Kind:** accessibility
- **Level:** browser — keyboard dispatch to a focused button
- **Source:** `viewer/ui/chrome/sheet.js:124-134,210-212`; decision record 0006; deviation `h6-handle-controls.md`
- **Expected:** Presses from peek → half (span round(0.5·H), "Expand panel"), full (H − 128, "Collapse panel"), peek (the first span, "Expand panel"); `onDetent` called with `['half', 'full', 'peek']`. `tagName` BUTTON, `aria-controls="workspace-panel"`, no `aria-expanded`. French at half, Escape → still half.
- **Covered by:** `src/lib/core/detents.test.ts` (R, `stepDetent` walks peek → half → full, stops at the ends, and an unknown rest falls back to peek); `src/features/sheet/Sheet.svelte.test.ts` (R)

### SHEET-14 · A rest the reader chooses is announced; resizes and raises that come with another action are not

- **Rule:** After the handle, or a drag or flick that lands on a different rest, a polite message says the new rest. A drag that springs back says nothing, and so do a resize or rotation, the automatic lift when the phone shell is entered with focus in a panel, and a raise by the selection strip, a tab or a pick on the stage.
- **Kind:** accessibility
- **Level:** browser — the page's live region
- **Source:** deviation `h6-detent-announcements.md`; decision 20 on #4; decision record 0006
- **Expected:** EN "Panel collapsed", "Panel half open", "Panel fully open"; FR "Panneau replié", "Panneau à moitié ouvert", "Panneau entièrement ouvert". Drag of 30 px at 400 ms released at 800 ms (back to peek) → "". Tab chosen at peek → "". Strip with Enter → "". Resize 390 × 844 → 390 × 700 at half → the earlier message unchanged.
- **Covered by:** `src/features/sheet/Sheet.svelte.test.ts` (R); the strings are in `src/lib/core/i18n/areas/sheet.ts` (I18N-)

### SHEET-15 · A keyboard press moves the sheet without a glide; a pointer press, a settle or a drag each keep their own motion

- **Rule:** A settled sheet glides over 240 ms on the sheet's curve. A keyboard activation (handle, tab, strip) and the shell entry with panel focus jump at once, and the stage chrome that follows the sheet jumps too. A pointer activation restores the glide. A dragged sheet follows the finger with no transition. With reduced motion only an opacity transition remains.
- **Kind:** behaviour
- **Level:** browser — CSS computed style
- **Source:** `viewer/ui/chrome/sheet.js:127-139,210-220`; `viewer/styles/a11y.css:8-14`; decision record 0006
- **Expected:** At rest `transition-property: height`, `transition-duration: 0.24s`. Enter or Space on the handle → `data-instant` present, duration `0s`; then a click → `data-instant` absent. While dragging → duration `0s`. `prefers-reduced-motion: reduce` → `transition-property: opacity`.
- **Covered by:** `src/features/sheet/Sheet.svelte.test.ts` (R)

## Dragging

### SHEET-16 · A press on the grip becomes a drag after 8 px and follows the finger

- **Rule:** A press with the primary pointer's main button on the grip row, the tab row or the notice becomes a drag once it has travelled 8 px along the sheet's axis (up upright, right sideways). The span is then the span at the press plus the travel, held by SHEET-07, and settles on release by SHEET-04 and SHEET-05. A press in a panel scrolls it instead; a non-primary pointer, another button, and a second finger during a drag do nothing.
- **Kind:** behaviour
- **Level:** browser — pointer events on real layout
- **Source:** `viewer/ui/chrome/sheet.js:7-8,150-198`
- **Expected:** 7 px → `data-dragging="false"`, span unchanged. Pulled to round(0.5·H) − 30 at 50 ms → dragging, span = round(0.5·H) − 30, `settle: false`; released at 400 ms → half, `settle: true`, `onDetent(['half'])`. Sideways at peek, +10 px → span = peek + 10, released at 400 ms → peek. A press on a list row moved 100 px, a non-primary press, a `button: 1` press → not dragging. A second finger (id 2) moving → span unchanged.
- **Covered by:** `src/features/sheet/Sheet.svelte.test.ts` (R)

### SHEET-17 · The click that ends a drag is swallowed; a tap that never dragged is not

- **Rule:** When a drag ends on a button (the handle or a tab), the click that follows the release does nothing, so a drag never also steps the sheet or chooses a mode. After that click the button works again. A press that never passed the threshold leaves its click alone.
- **Kind:** behaviour
- **Level:** browser — event order
- **Source:** `viewer/ui/chrome/sheet.js:192-196`
- **Expected:** Drag 60 px from the handle released at 400 ms, then a handle click → `onDetent` still `['peek']`; after a macrotask a click → half. A press released at 5 ms with no move, then a click → full. Drag from the Functions tab, then its click → no `mode:functions`; after a macrotask the click → `mode:functions`.
- **Covered by:** `src/features/sheet/Sheet.svelte.test.ts` (R)

### SHEET-18 · A drag that is interrupted returns to the rest it started from

- **Rule:** Cancelling the finger's pointer, the window losing focus, a resize, a rotation or leaving the phone shell ends the press and puts the sheet back on its prior rest; the next press starts a fresh drag. A cancel from another pointer leaves the drag alone. A press still under the threshold is cleared by a blur too.
- **Kind:** behaviour
- **Level:** browser — window events and media changes
- **Source:** `viewer/ui/chrome/sheet.js:143-148,200-208,277-292`; `viewer/ui/chrome/sheet.test.js:177-265`
- **Expected:** At half, drag 100 px; `pointercancel` from id 2 → still dragging at half + 100; from id 1 → not dragging, span = half, `data-detent="half"`, `settle: true`. Window `blur` mid-drag → span = rest. Resize to 390 × 800 mid-drag → not dragging. Rotation to 844 × 390 mid-drag → not dragging, and the next drag runs along the width.
- **Covered by:** `src/features/sheet/Sheet.svelte.test.ts` (R; leaving the shell mid-drag is uncovered)

## The grip's selection

### SHEET-19 · The grip names the selection at peek, with its clear and the safety statement

- **Rule:** With a selection, the grip shows its name and side letter as a button that opens it, named "Inspect <label>, <side word>" (FR "Examiner <label>, <côté>"), and, when the selection can be cleared, a "Clear selection" button (FR "Effacer la sélection"). The statement "Not clinical anatomy" (FR "Pas une anatomie clinique") is always in the grip. Upright, once the detail view is shown above peek, the name hides (the detail heads itself) and the clear stays.
- **Kind:** accessibility
- **Level:** browser — visibility from CSS; the name is a view-model string
- **Source:** `viewer/ui/chrome/sheet.js:308-322`; deviation `h5-strip-name-side.md`
- **Expected:** Selection {label "Insula", side "L", sideWord "left", clearable} → button "Inspect Insula, left" whose text contains "Insula" and "L"; "Clear selection" visible. French → "Examiner Insula, left", "Effacer la sélection", "Pas une anatomie clinique" on the page. After the strip opens the detail at half: strip not visible, clear visible.
- **Covered by:** `src/features/sheet/Sheet.svelte.test.ts` (R)

### SHEET-20 · The strip raises a resting sheet and opens the detail, moving focus only if it had it

- **Rule:** Activating the strip raises peek to half (a raised sheet stays where it is), shows the selection's detail, and says nothing. If the strip had focus, focus moves to the detail's Back button, since the strip is hidden by then. A pointer activation that left focus elsewhere does not take it.
- **Kind:** behaviour
- **Level:** browser — focus
- **Source:** `viewer/ui/chrome/sheet.js:136-139,213-219`; `viewer/ui/chrome/sheet.test.js:294`
- **Expected:** Enter on the strip → span round(0.5·H), `data-instant`, `onSelection` called, focus on `.detail-back`, `data-view="detail"`, announcer "". Click with focus on the Anatomy tab → half, detail, focus still on the tab. Then the handle → full; Back → list view, still full.
- **Covered by:** `src/features/sheet/Sheet.svelte.test.ts` (R)

### SHEET-21 · The grip's clear gives focus to the tab in front

- **Rule:** The clear clears the selection; the name and its clear vanish, and focus goes to the selected mode tab.
- **Kind:** behaviour
- **Level:** browser — focus
- **Source:** `viewer/ui/chrome/sheet.js:235-240`
- **Expected:** Click "Clear selection" → `onClear` called once, focus on the Anatomy tab, no strip.
- **Covered by:** `src/features/sheet/Sheet.svelte.test.ts` (R)

## Tabs, panels and focus

### SHEET-22 · Choosing a tab raises a resting sheet, silently, and never lowers a raised one

- **Rule:** A tab chosen while the sheet is at peek (even the tab already chosen) raises it to half without an announcement. A keyboard choice raises it without a glide. A tab chosen at half or full leaves the sheet where it is.
- **Kind:** behaviour
- **Level:** browser — click and keyboard on the tablist
- **Source:** `viewer/ui/chrome/sheet.js:220`; `viewer/ui/chrome/sheet.test.js:215-222`
- **Expected:** Click Functions at peek → span round(0.5·H), `mode:functions`, announcer "". Then the handle → full, then Deficits → still H − 128. Click Anatomy (chosen) at peek → half. Enter on Functions at peek → half with `data-instant`.
- **Covered by:** `src/features/sheet/Sheet.svelte.test.ts` (R)

### SHEET-23 · At peek the panels take no focus; above it every panel stop is on screen below the grip

- **Rule:** The sheet is a non-modal region with no focus trap. Tab walks the handle, the name, its clear, then the tablist as one stop. Upright at peek the panels are hidden, so nothing in them is reachable. At half and full every Tab stop in the panel, as the list scrolls, lies fully on screen and below the grip (WCAG 2.4.11). In the app the sheet comes before the stage in reading order and no stop outside it lands under it.
- **Kind:** accessibility
- **Level:** browser — sequential focus and layout
- **Source:** `viewer/ui/chrome/sheet.js:17-20`; `viewer/styles/phone.css:90-97`; decision record 0006
- **Expected:** With a selection: handle → strip → clear → Anatomy tab → (next stop not in `#navigator`). At half, Anatomy tab → Tab → "Search regions". With 30 rows and a notice at half or full: ≥ 31 stops in the panel, each `top ≥ grip floor − 0.5` and `bottom ≤ innerHeight + 0.5`. At peek: ≥ 4 stops, none in `#navigator`, all inside the sheet and the screen.
- **Covered by:** `src/features/sheet/Sheet.svelte.test.ts` (R)

### SHEET-24 · Settling on peek with focus in a panel moves focus to the handle

- **Rule:** Before the sheet settles on peek while focus is inside a panel, focus moves to the handle, which is always on screen. Focus on a tab, the notice or a grip control stays where it is.
- **Kind:** accessibility
- **Level:** browser — focus
- **Source:** deviation `h6-peek-focus.md`; decision record 0006
- **Expected:** At half, focus on a list row, flick down (−30 px in 10 ms) → peek, focus on the handle. Focus on the Anatomy tab while the handle cycles to peek → focus still on the tab.
- **Covered by:** `src/features/sheet/Sheet.svelte.test.ts` (R)

### SHEET-25 · Entering the phone shell keeps a control in use on screen, and the shell remembers its rest

- **Rule:** Entering the phone shell with focus inside a panel lifts a resting sheet to half at once, keeps focus where it was, reports no rest change and says nothing. With focus elsewhere the sheet rests at peek with its glide. Leaving and re-entering the shell keeps the rest it left with. A resize inside the shell re-measures the rest silently.
- **Kind:** behaviour
- **Level:** browser — media changes and focus
- **Source:** `viewer/ui/chrome/sheet.js:266-292`; `viewer/ui/chrome/sheet.test.js:103-133,166`
- **Expected:** 1280 × 800 with focus on a row → 390 × 844: `data-detent="half"`, `data-instant`, focus on the row, row `visibility: visible`, `onDetent` not called, announcer "". Focus on a tab instead → peek, no `data-instant`. At full → desktop → phone → `full`, span H − 128. At half, 390 × 844 → 390 × 700 → span round(0.5·H) of the new stage, reported as `bottom`.
- **Covered by:** `src/features/sheet/Sheet.svelte.test.ts` (R)

## Size, contrast and look

### SHEET-26 · Every grip control is a finger's target, and the handle keeps a 24 px line with a name over it

- **Rule:** On a phone and held sideways the handle, the name, its clear and each tab are at least 44 × 44 px. Upright with a selection, the part of the handle a pointer can reach is its own 24 px top line (legacy 20 px). With touch emulation in the app the grip's controls are 44 px.
- **Kind:** accessibility
- **Level:** browser — layout and hit testing
- **Source:** deviation `h6-handle-target.md`; `viewer/styles/phone.css:116-134,267-271,296-299`
- **Expected:** At 390 × 844 and 844 × 390 with a selection: every control's width and height ≥ 44. Hit testing down the handle's centre line in 0.25 px steps finds ≥ 23 px of handle before anything else.
- **Covered by:** `src/features/sheet/Sheet.svelte.test.ts` (R)

### SHEET-27 · The handle bar holds 3:1 against the sheet, and is ButtonText under forced colours

- **Rule:** The drawn handle bar, the handle's only visual cue, contrasts at least 3:1 with the sheet's background, and in forced colours it is the system ButtonText colour.
- **Kind:** accessibility
- **Level:** browser — computed colours
- **Source:** `web/src/features/sheet/Sheet.svelte` (`@layer a11y`); WCAG 1.4.11
- **Expected:** contrast(bar background, sheet background) ≥ 3. With `forced-colors: active`, bar background = the computed colour of `ButtonText`, still ≥ 3:1.
- **Covered by:** `src/features/sheet/Sheet.svelte.test.ts` (R)

### SHEET-28 · In the sheet the tab row spans the sheet's column like the legacy sheet tabs

- **Rule:** In the sheet the tabs sit on the sheet's ground, the first label starts under the words above it and the last ends near the edge, the selected tab's underline is as wide as its label, and long labels wrap (upright) or never wrap (sideways). At peek the tab row has no rule under it.
- **Kind:** behaviour
- **Level:** browser — layout/CSS
- **Source:** `viewer/styles/phone.css` (sheet tabs)
- **Expected:** At 390 px: tablist background = sheet background; first tab left + 4 = 16; last tab right = `innerWidth` − 12; selected `::before` left and right `0px`; `white-space: normal`. At 844 × 390: `white-space: nowrap`.
- **Covered by:** `src/features/sheet/Sheet.svelte.test.ts` (R)

### SHEET-29 · The phone page never scrolls sideways at 320 px

- **Rule:** At 320 px the assembled page has no horizontal scroll and the last tab is still visible (WCAG 1.4.10).
- **Kind:** accessibility
- **Level:** browser — the composed panel region at 320 × 640 (as `PanelsRegion.svelte.test.ts` and `App.svelte.test.ts` set the viewport)
- **Source:** WCAG 1.4.10
- **Expected:** 320 × 640: `scrollWidth − clientWidth` = 0; the Tracts tab visible.
- **Covered by:** `e2e/journeys/phone.spec.ts` "the phone: …, 320 px" (R)

### SHEET-30 · axe finds nothing on the sheet

- **Rule:** The sheet with a selection, at peek and raised, in English and French, both themes, phone and desktop width, has no axe violation.
- **Kind:** accessibility
- **Level:** browser — axe
- **Source:** WCAG 2.2 AA
- **Expected:** `expectAxeClean()` with no violations once per theme and width (light and dark × 1280 and 390 px) with the panel raised and a selection; French one run (light, 390 px). In the app: peek and half with a region in the link.
- **Covered by:** `src/features/sheet/Sheet.svelte.test.ts` (R)
