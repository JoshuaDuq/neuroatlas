# Keyboard shortcuts dialog rules

Scope: chunk S5b (#37), the keyboard shortcuts dialog: what it lists, how its keys are written and read, how it opens and closes, where focus goes, and its layout. The keys themselves (what `?`, `/`, `M`, the digits and the others do, single-key shortcuts being turned off, the Escape cascade) are the keymap's, in `controller.md` (KEY-01 to KEY-16); the native modal behaviour shared by every dialog (trap, inert page, `data-instant`, focus return) is U5's, in `ui-kit.md` (UI-). The rows' wording is translated in `core-i18n.md` (I18N-). Legacy sources: `viewer/ui/chrome/shortcuts.js`, `viewer/i18n/translations.js` (shortcuts), `viewer/styles/dialogs.css:104-123,289-294`, `viewer/app.js:1927-1928,1948-1953`. New code: `web/src/features/shortcuts/ShortcutsDialog.svelte`, `web/src/lib/core/i18n/areas/shortcuts.ts`, `web/src/lib/controller/keymap.ts` (`SHORTCUT_KEYS`). Deviations: `s5b-group-structure.md`, `s5b-initial-focus.md`, `s5b-shortcut-strings.md`. Decision 24 on #4 (D1 to D4), D2 amended by comment 81 on #4; decision 7 on #4 (the dialog does not isolate keys). Copy quoted is the English interface text.

## What it lists

### SHORT-01 · Three groups of 21 key rows, in the reader's language

- **Rule:** The dialog lists the keys in three groups: Panel (8 rows), Model (7 rows) and Display (6 rows), each row a key and what it does, then a note on turning single-key shortcuts off. French: Panneau, Modèle, Affichage.
- **Kind:** data
- **Level:** unit
- **Source:** `viewer/ui/chrome/shortcuts.js:85-101`; `viewer/i18n/translations.js` (shortcuts)
- **Expected:** Group titles EN `['Panel', 'Model', 'Display']`, FR `['Panneau', 'Modèle', 'Affichage']`; 21 rows; the first row is `/`, "Focus the search field"; the Model group holds `1 – 6`, "Left, right, anterior, posterior, superior, inferior view", and `0`, "Return to the oblique view"; the Display group ends with `?`, "Open this list". EN and FR lists contain F, I, M, C, S, H, 0, `1 – 6`, `/` and Esc (FR Échap).
- **Covered by:** `src/lib/core/i18n/i18n.test.ts` (R, the keys present); `src/features/shortcuts/shortcuts.svelte.test.ts` (R, the titles and 21 `dt`/`dd`, could move down to unit for the data); `e2e/parity/shortcuts.spec.ts` (R; `next` since #64)

### SHORT-02 · Every key the keymap acts on is in the list

- **Rule:** Each key the page keymap handles (`?`, `/`, the tree arrows, the seven view digits, F, I, C, U, S, H, M) appears in the dialog, a range standing for every digit between its ends and the arrows drawn as ↑ and ↓.
- **Kind:** data
- **Level:** unit — `SHORTCUT_KEYS` against the i18n rows
- **Source:** `web/src/lib/controller/keymap.ts:11-32`; `viewer/app.js:1920-1990`
- **Expected:** The set of listed caps, with `1 – 6` expanded to 1…6 and `ArrowDown`/`ArrowUp` mapped to ↓/↑, contains every value of `SHORTCUT_KEYS` and of `SHORTCUT_KEYS.views`.
- **Covered by:** `src/features/shortcuts/shortcuts.svelte.test.ts` (R; reads the caps from the DOM, so it is a browser test for a data rule and could move down to unit)

### SHORT-03 · The rows say what the keys really do (decision 24, comment 81)

- **Rule:** D1: the French Escape row names the function and the deficit, as the English one does. D2: the M row says it also opens or closes the MRI with tracts in Tracts, naming that dialog by its button. D3: the French cap for Escape is "Échap".
- **Kind:** behaviour
- **Level:** unit
- **Source:** deviation `s5b-shortcut-strings.md` (D1 to D3); decision 24 on #4; comment 81 on #4; `viewer/i18n/translations.js:919`; `viewer/app.js:1912-1914,1948-1953`
- **Expected:** EN Escape row ends "function or deficit"; FR row "Dans une vue détaillée : revenir à la liste. Ailleurs : effacer la recherche, puis la sélection, puis la fonction ou le déficit". M row EN "Open or close linked MRI slices; in Tracts, the MRI with tracts", FR "Ouvrir ou fermer les coupes IRM ; dans Faisceaux, l’IRM avec faisceaux". FR Escape cap "Échap".
- **Covered by:** `src/lib/core/i18n/i18n.test.ts` (R, D1 and D3); `e2e/parity/shortcuts.spec.ts` (R, D3, accepts Esc or Échap; `next` since #64); D2 (the M rows) in `src/lib/core/i18n/i18n.test.ts` (R, I18N-09)

### SHORT-04 · The note says how to turn single-key shortcuts off, or back on

- **Rule:** The note under the list follows the reader's single-key preference, and updates while the dialog is open.
- **Kind:** behaviour
- **Level:** unit — the strings; a browser check that the note follows the prop
- **Source:** `viewer/ui/chrome/shortcuts.js:100,139-142`; WCAG 2.1.4
- **Expected:** On: "Page-wide single-key shortcuts (letters, numbers, / and ?) can be turned off in the settings menu." Off: "Page-wide single-key shortcuts are off. Turn them back on in the settings menu." FR on: "… peuvent être désactivés dans le menu des réglages."; off: "… sont désactivés. Réactivez-les dans le menu des réglages."
- **Covered by:** `src/features/shortcuts/shortcuts.svelte.test.ts` (R, substrings "can be turned off" / "are off"); `e2e/parity/shortcuts.spec.ts` (R, the off note after a reload with the preference off; `next` since #64)

## How keys are written

### SHORT-05 · Each key is a cap, and a dash between two keys is read as "to"

- **Rule:** A row's keys are split on spaces and each is drawn as a key cap (`kbd`). A dash between two caps is a range: the dash is hidden from assistive technology and a visually hidden "to" (FR "à") follows it, so a screen reader says "1 to 6", not "1 6".
- **Kind:** accessibility
- **Level:** browser — the DOM a screen reader reads; the token split is pure and could be a view-model unit test
- **Source:** `viewer/ui/chrome/shortcuts.js:12-13,90-94`; deviation `s5b-shortcut-strings.md` (D4)
- **Expected:** `← → ↑ ↓` → four caps. `1 – 6` → `[kbd "1"] [span.key-range: aria-hidden "–", hidden "to"] [kbd "6"]`, row text "1–to6". French range text "à". In the app, one `.key-range .visually-hidden` (legacy has none).
- **Covered by:** `src/features/shortcuts/shortcuts.svelte.test.ts` (R); `e2e/parity/shortcuts.spec.ts` (R, branches legacy's 0; `next` since #64)

### SHORT-06 · A group is a heading and its list, not an unnamed section

- **Rule:** The dialog's title is a level-2 heading; each group is a level-3 heading followed by a description list of key and action, wrapped in a plain container rather than an unnamed `section`.
- **Kind:** accessibility
- **Level:** browser — DOM structure
- **Source:** `viewer/ui/chrome/shortcuts.js:94-99`; deviation `s5b-group-structure.md`
- **Expected:** heading level 2 "Keyboard shortcuts"; three `h3`; 21 `dt` and 21 `dd` (roles term and definition); 0 `section` (legacy 3).
- **Covered by:** `src/features/shortcuts/shortcuts.svelte.test.ts` (R); `e2e/parity/shortcuts.spec.ts` (R; `next` since #64)

## Opening, closing and focus

### SHORT-07 · The dialog's title takes focus on opening; Close is the one Tab stop

- **Rule:** On opening, focus goes to the title (a static heading that can take focus), so a screen reader reads the dialog's name and then its content. Close stays the first and only focusable control.
- **Kind:** accessibility
- **Level:** browser — focus
- **Source:** `viewer/ui/chrome/shortcuts.js:107-116`; deviation `s5b-initial-focus.md`
- **Expected:** After opening (by keyboard, pointer or `?`): `document.activeElement` is the `h2`. Focusable controls inside: exactly one, `.dialog-close`. In the app: next focuses the heading, legacy focuses Close.
- **Covered by:** `src/features/shortcuts/shortcuts.svelte.test.ts` (R); `e2e/parity/shortcuts.spec.ts` (R, branches; `next` since #64)

### SHORT-08 · Opened or closed by a key it appears at once; by a pointer it fades

- **Rule:** An opening or closing made from the keyboard (Enter or Space on the opener or on Close, `?`, Escape) is instant. A pointer opening or a pointer press on Close animates.
- **Kind:** behaviour
- **Level:** browser — keyboard versus pointer activation
- **Source:** `viewer/ui/chrome/shortcuts.js:106-121`
- **Expected:** Opener clicked → no `data-instant`. Opener with Enter → `data-instant`. `?` → `data-instant`. Escape → `data-instant`. Close clicked → no `data-instant`; Close with Enter → `data-instant`.
- **Covered by:** `src/features/shortcuts/shortcuts.svelte.test.ts` (R); `e2e/parity/shortcuts.spec.ts` (R; `next` since #64)

### SHORT-09 · Closing returns focus to the opener, else to the settings button, else leaves it on the page

- **Rule:** Escape or Close returns focus to the control that opened the dialog. When that control is gone (the settings menu closed behind the dialog), focus goes to the "More settings" (⋯) button. When the dialog was opened by `?` with nothing focused, focus stays on the page.
- **Kind:** behaviour
- **Level:** browser — focus
- **Source:** `viewer/ui/chrome/shortcuts.js:109,122-127`
- **Expected:** Escape → focus on "Keyboard shortcuts" opener. Opener hidden before Escape → focus on "More". `?` from `body`, `?` again → focus on `body`. In the app: opened from the menu with the keyboard, Escape → focus on "More settings"; on a 390 px phone the same.
- **Covered by:** `src/features/shortcuts/shortcuts.svelte.test.ts` (R); `e2e/parity/shortcuts.spec.ts` (R; `next` since #64)

### SHORT-10 · Tab stays in the dialog

- **Rule:** While the dialog is open, Tab never reaches the page: focus stays inside the dialog or goes to the browser's own controls.
- **Kind:** accessibility
- **Level:** browser — sequential focus
- **Source:** native modal `dialog` (U5); WAI-ARIA APG Dialog (Modal)
- **Expected:** Four (in the app six) presses of Tab: each time `activeElement` is `body` or inside the dialog.
- **Covered by:** `src/features/shortcuts/shortcuts.svelte.test.ts` (R); `e2e/parity/shortcuts.spec.ts` (R; `next` since #64)

### SHORT-11 · `?` reaches the page while the dialog is open, and Escape closes only the dialog

- **Rule:** The dialog does not isolate keys: `?` pressed inside it reaches the page keymap, which closes it (KEY-08). Escape closes the dialog and nothing behind it changes (KEY-03). Keys that scroll the list are not cancelled.
- **Kind:** behaviour
- **Level:** browser — keyboard dispatch; e2e for the selection behind it
- **Source:** decision 7 on #4; `viewer/app.js:1927-1928`
- **Expected:** `?` → open with `data-instant`; `?` again → closed. ArrowDown inside → not `defaultPrevented`. In the app with `destrieux:left:38` selected: `?`, Escape → closed and the permalink unchanged.
- **Covered by:** `src/features/shortcuts/shortcuts.svelte.test.ts` (R, `?` through a stand-in keymap); `e2e/parity/shortcuts.spec.ts` (R; `next` since #64)

### SHORT-12 · A language change while open relabels the dialog in place

- **Rule:** Switching the language while the dialog is open rewrites its title, groups, rows, Close and range word, and focus stays on the title.
- **Kind:** behaviour
- **Level:** browser — focus across a rerender
- **Source:** `viewer/ui/chrome/shortcuts.js:132-137`
- **Expected:** Open in English, switch to French → heading "Raccourcis clavier", focus on the title. French from the start → dialog "Raccourcis clavier", button "Fermer", range "à", groups Panneau, Modèle, Affichage.
- **Covered by:** `src/features/shortcuts/shortcuts.svelte.test.ts` (R); `e2e/parity/shortcuts.spec.ts` (R, French labels; `next` since #64)

### SHORT-13 · The settings menu opens it, and `?` does nothing when single keys are off

- **Rule:** In the app the dialog opens from the "Keyboard shortcuts" item of the "More settings" menu. With single-key shortcuts turned off, `?` does not open it, and the note says how to turn them back on.
- **Kind:** behaviour
- **Level:** browser — the menu, the keymap and the stored preference mounted together (REGION-10 proves a menu setting the same way); the reload half is a stored-preference read at mount
- **Source:** `viewer/ui/chrome/shortcuts.js:3`; KEY-06 in `controller.md`
- **Expected:** "More settings" → "Keyboard shortcuts" → dialog "Keyboard shortcuts". `localStorage['planum.single-key-shortcuts'] = 'off'`, reload, `?` → no dialog; menu → note contains "Turn them back on in the settings menu".
- **Covered by:** `e2e/parity/shortcuts.spec.ts` (R; `next` since #64); uncovered at its level

## Size, layout and media

### SHORT-14 · Close is 24 px, and 44 px on a coarse pointer

- **Rule:** The Close button is at least 24 × 24 px, and exactly 44 × 44 px when the primary pointer is coarse.
- **Kind:** accessibility
- **Level:** browser — layout under emulated touch
- **Source:** WCAG 2.5.8; U5 Dialog
- **Expected:** Fine pointer: width and height ≥ 24. Touch emulation (`pointer: coarse`): 44 × 44.
- **Covered by:** `src/features/shortcuts/shortcuts.svelte.test.ts` (R); `e2e/parity/shortcuts.spec.ts` (R, ≥ 24 on a phone; `next` since #64)

### SHORT-15 · Large text, spacing and small screens keep every row inside the dialog

- **Rule:** With 200 % text and the WCAG 1.4.12 spacing, in English and French, at 1280 and 320 px, no key or description spills sideways and the dialog does not scroll sideways. On a short landscape phone the title and Close stay in view while the list scrolls under them. On a phone the dialog fills the width and the page does not scroll sideways. Upright on a phone the key sits above its description.
- **Kind:** accessibility
- **Level:** browser — layout
- **Source:** `viewer/styles/dialogs.css:104-123,289-294`; WCAG 1.4.4, 1.4.10, 1.4.12
- **Expected:** Every `dt`/`dd` `scrollWidth ≤ clientWidth + 0.5`; dialog `scrollWidth ≤ clientWidth`; every `dd` `scrollHeight ≤ clientHeight`. At 740 × 360 scrolled to the end: header top ≥ 0 and Close inside the header. In the app at 390 px: dialog width ≥ 380, document `scrollWidth ≤ innerWidth`.
- **Covered by:** `src/features/shortcuts/shortcuts.svelte.test.ts` (R); `e2e/parity/shortcuts.spec.ts` (R, phone width; `next` since #64)

### SHORT-16 · Reduced motion drops the scale, and forced colours keep the edges

- **Rule:** With reduced motion the dialog opens with no scale transform. In forced colours the dialog and each key cap keep a visible border.
- **Kind:** accessibility
- **Level:** browser — CSS computed style
- **Source:** `viewer/styles/dialogs.css:24-44`; `viewer/styles/a11y.css:8-14`
- **Expected:** `prefers-reduced-motion: reduce` → dialog `transform: none`. `forced-colors: active` → dialog and `kbd` `border-top-style` ≠ `none`.
- **Covered by:** `src/features/shortcuts/shortcuts.svelte.test.ts` (R)

### SHORT-17 · axe finds nothing with the dialog open

- **Rule:** The open dialog has no axe violation in light and dark, at desktop and phone width, in English and French, and with more contrast.
- **Kind:** accessibility
- **Level:** browser — axe
- **Source:** WCAG 2.2 AA
- **Expected:** `expectAxeClean()` with no violations in English (both themes, 1280 and 390 px), and one run each in French and under `prefers-contrast: more` (light, 1280 px); in the app, `expectAccessible('shortcuts')`.
- **Covered by:** `src/features/shortcuts/shortcuts.svelte.test.ts` (R); `e2e/parity/shortcuts.spec.ts` (R; `next` since #64)
