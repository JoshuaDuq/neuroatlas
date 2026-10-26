# Masthead and data bar rules

Scope: chunks H2 (#40, the masthead: skip link, brand, Full screen, Save image and the ⋯ settings panel) and H3 (#41, the data bar: Subject, Atlas, Colour and Internal anatomy, on the bar or behind a summary). What the composition does with their choices (theme applied to the page, link rewritten for another subject, canvas focus) is in `regions.md`. Legacy sources: `viewer/ui/chrome/header.js:1-559`, the root `index.html:96-186`, `viewer/styles/masthead.css:1-452`, `viewer/styles/a11y.css:20, 49`, `viewer/ui/chrome/header.test.js`, `viewer/ui/chrome/chrome.contract.test.js:165-376`. New code: `web/src/features/masthead/{Masthead,SettingsMenu,DataBar}.svelte`, the view-models in `web/src/lib/core/panels/header.ts`. Deviations: `h2-close-on-keyboard-choice.md`, `h2-focus-before-dialog.md`, `h2-fullscreen-label.md`, `h2-radio-groups.md`, `h2-settings-announcements.md`, `h2-skip-link-without-script.md`, `h2-system-theme-note.md`, `h3-focus-never-lost.md`, `h3-load-announcements.md`, `h3-name-description-reachable.md`, `h3-select-caret-forced-colours.md`. Decision records `0003-segmented-controls.md`, `0005-settings-and-data-disclosure.md`. Decisions 4, 6, 14, 15 and 16 on #4.

Copy quoted is the English interface text unless marked FR. The published build has one subject, `cdmd` (MGH CDMD “sub_013”), atlases `destrieux` and `hcp-mmp`, and detail levels `aseg`, `nextbrain` and `learning`. English sets a percent close up ("34%"). French puts a narrow no-break space before it ("34 %").

## Skip link, brand and icon buttons

### MAST-01 · The skip link is the first Tab stop from the first paint

- **Rule:** The masthead renders the skip link first, in the active language, as soon as the page is shown. Its `href` is `#viewport`. Activating it asks the composition to focus the model and leaves the link's view unchanged.
- **Kind:** accessibility
- **Level:** browser: real Tab order and focus
- **Source:** `viewer/ui/chrome/header.js:97, 167-170, 191, 201`; `chrome.contract.test.js:305`; deviation `h2-skip-link-without-script.md`
- **Expected:** the first Tab focuses the link "Skip to model" (FR "Aller au modèle") with `href="#viewport"`. Enter calls `onSkipToModel` once, and `location.hash` stays `''`. Where focus lands is REGION-11.
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R); `e2e/parity/masthead.spec.ts` "the skip link is the first Tab stop" (R; `next` gated off)

### MAST-02 · The masthead is the banner, with the brand as the page heading

- **Rule:** The masthead is the page's `banner` landmark. Its level-1 heading is the brand.
- **Kind:** accessibility
- **Level:** browser: roles
- **Source:** `index.html:96-104`
- **Expected:** one `banner`, `heading` level 1 named "Planum"; the brand mark is `aria-hidden`.
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R); `e2e/parity/masthead.spec.ts` (R; `next` gated off)

### MAST-03 · The icon buttons are named, with the same tooltip and no native title

- **Rule:** Full screen, Save image and More settings are icon buttons named by `aria-label`. Each carries the same text as its tooltip, has no native `title` and an `aria-hidden` icon.
- **Kind:** accessibility
- **Level:** browser: accessible names
- **Source:** `index.html:137-151`; `chrome.contract.test.js:362-370`; `header.js:202-206`
- **Expected:** names and `data-tooltip` "Full screen", "Save image (PNG)", "More settings" (FR "Plein écran", "Enregistrer l’image (PNG)", "Plus de réglages"); no `title`; `svg[aria-hidden="true"]`.
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R, English); `e2e/parity/masthead.spec.ts` (R; `next` gated off)

### MAST-04 · Full screen and Save image wait for the anatomy; More settings does not

- **Rule:** Full screen and Save image are disabled (native `disabled`) until the anatomy is on screen, which is status `ready` or `switching`. More settings works from the first paint.
- **Kind:** behaviour
- **Level:** browser: the `disabled` attribute (the status → ready mapping is unit logic)
- **Source:** `header.js:200, 207-210`; `chrome.contract.test.js:372-376`; decision 15 on #4 (native `disabled` kept)
- **Expected:** `ready=false` → both have `disabled` and More settings does not. Status `loading`, `error` or `context-lost` → ready false; `ready` or `switching` → ready true.
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R for the prop; the status mapping is the composition's: REGION-12)

### MAST-05 · Without the Fullscreen API no Full screen control is offered

- **Rule:** When `document.fullscreenEnabled` is false, neither the masthead button nor the phone menu item is offered.
- **Kind:** behaviour
- **Level:** browser: DOM
- **Source:** `header.js:192-193`; `header.test.js:160-169`
- **Expected:** `fullscreenEnabled = false` → no element with the text "Full screen" and no button of that name, with the panel open.
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R)

### MAST-06 · The full-screen labels follow the state

- **Rule:** While the document is fullscreen, the masthead button, its tooltip and the phone menu item read "Exit full screen". Otherwise they read "Full screen". The icon is unchanged.
- **Kind:** accessibility
- **Level:** browser: accessible names
- **Source:** deviation `h2-fullscreen-label.md`; decision 4 on #4
- **Expected:** `fullscreen=true` → button and `data-tooltip` "Exit full screen" (FR "Quitter le plein écran"); `false` → "Full screen".
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R, button and tooltip; the phone menu item's label is uncovered)

## The settings panel

### MAST-07 · More settings is a disclosure, not a menu

- **Rule:** More settings opens a non-modal panel of ordinary controls. The trigger carries `aria-expanded` and `aria-controls`, and has no `aria-haspopup`. Nothing has a menu role.
- **Kind:** accessibility
- **Level:** browser: ARIA attributes
- **Source:** decision record `0005-settings-and-data-disclosure.md`; decision 14 on #4; `index.html:147-182`
- **Expected:** closed → `aria-expanded="false"`, no `aria-haspopup`. Open → `aria-expanded="true"`, and the `aria-controls` target holds a `radiogroup`. No `[role=menu]` or `[role=menuitem]` on the page.
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R); `e2e/parity/masthead.spec.ts` (R, `aria-expanded` only; `next` gated off)

### MAST-08 · Enter and Space toggle the panel; a keyboard open is instant

- **Rule:** Enter and Space on More settings toggle the panel, and focus stays on the trigger. A keyboard open shows the panel at once; a pointer open animates.
- **Kind:** behaviour
- **Level:** browser: keyboard dispatch to the focused trigger
- **Source:** `header.js:121-125`; `header.test.js:144-158`
- **Expected:** Enter → open and focus still on More settings; Enter → closed; Space → open. Keyboard open → `.settings-menu[data-instant]`; pointer open → no `data-instant`.
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R, 2 cases)

### MAST-09 · Three radio groups, each one Tab stop, then the commands

- **Rule:** The panel holds three radio groups, each named by its row label: Language, Theme and Single-key shortcuts. Each is one Tab stop, on its checked radio, and the commands follow them. Each language radio carries its own language and draws its code, with the code inside its name.
- **Kind:** accessibility
- **Level:** browser: roles, Tab order
- **Source:** deviation `h2-radio-groups.md`; decision 6 on #4; `index.html:156-182`
- **Expected:** groups "Language" (English, Français), "Theme" (System, Light, Dark), "Single-key shortcuts" (On, Off). Checked by default: English, System, On. `English` has `lang="en"` and draws "EN"; `Français` has `lang="fr"`. Checked radio `tabIndex 0`, others `-1`. Tab order inside the panel: English, System, On, then "Keyboard shortcuts". FR rows: "Langue", "Thème", "Raccourcis à une touche"; FR choices "Système", "Clair", "Sombre", "Oui", "Non".
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R, 2 cases); `e2e/parity/masthead.spec.ts` "the panel offers language, theme and single-key shortcuts" (R; `next` gated off)

### MAST-10 · Arrows move and select, and a keyboard choice keeps the panel open

- **Rule:** In a group the arrow keys move and select, wrapping at both ends, and Space selects. A choice made from the keyboard applies at once and leaves the panel open, so the reader can keep walking the options.
- **Kind:** accessibility
- **Level:** browser: keyboard
- **Source:** deviations `h2-radio-groups.md`, `h2-close-on-keyboard-choice.md`; decision 15 on #4; legacy `viewer/ui/roving.js` (arrows only moved focus)
- **Expected:** on System, → → Light is checked and focused, and `onTheme('light')` runs. Two more → → Dark, then System (wrap): calls `light, dark, system`. The panel stays open. ← → Dark is checked.
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R); `e2e/parity/masthead.spec.ts` "arrows on a choice" (R, `next` branch; `next` gated off)

### MAST-11 · A pointer choice applies it and closes the panel

- **Rule:** Clicking a radio applies the choice, closes the panel and focuses More settings. Clicking the radio already checked does nothing.
- **Kind:** behaviour
- **Level:** browser: focus after close
- **Source:** `header.js:126-131, 152-159`
- **Expected:** click Dark → `onTheme('dark')` once, panel closed, focus on More settings. Click English (already checked) → no call.
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R, 2 cases); `e2e/parity/masthead.spec.ts` "choosing a theme, a language and single keys" (R; `next` gated off)

### MAST-12 · Every setting change is announced in the language it leaves the page in

- **Rule:** Each change is said politely as "<row label>: <choice>". After a language change, the sentence is in the new language, with the French space before the colon. The panel's own text follows the new language.
- **Kind:** accessibility
- **Level:** unit (view-model) for the sentence; browser for the live region
- **Source:** deviation `h2-settings-announcements.md`; decision 15 on #4
- **Expected:** System → → (to Dark) → "Theme: Dark"; On → → "Single-key shortcuts: Off"; English → → "Langue : Français". The panel then shows the radiogroup "Langue" and the radios "Sombre" and "Non".
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R)

### MAST-13 · The single-key choice is on the document for the hints

- **Rule:** The page exposes the single-key preference as `html[data-single-keys]`, which the shortcut hints read.
- **Kind:** behaviour
- **Level:** browser: a document attribute set by an effect
- **Source:** `header.js:226`; `header.test.js:171-179`
- **Expected:** on → `data-single-keys="on"`; choose Off → `"off"`.
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R); `e2e/parity/masthead.spec.ts` (R; `next` gated off)

### MAST-14 · The System note is always available

- **Rule:** The note on System ("Follow the device’s light or dark setting", FR "Suivre le réglage clair ou sombre de l’appareil") is its tooltip and also its permanent `aria-describedby` description, so touch and screen-reader users get it too.
- **Kind:** accessibility
- **Level:** browser: ARIA description
- **Source:** deviation `h2-system-theme-note.md`; `header.js:222`
- **Expected:** System radio `data-tooltip` = the note; the `aria-describedby` element's text is the same.
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R)

### MAST-15 · Escape closes the panel and is consumed

- **Rule:** Escape anywhere in the open panel closes it and focuses More settings. The key is marked handled, so the app's own Escape does not go on to clear the selection.
- **Kind:** behaviour
- **Level:** browser: keyboard and focus; the selection half needs the keymap (regions)
- **Source:** `header.js:140-146`
- **Expected:** focus on Dark, Escape → `defaultPrevented === true`, panel closed, focus on More settings. With a region selected, the selection is kept.
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R, `defaultPrevented`); `e2e/parity/masthead.spec.ts` (R; `next` gated off); the selection half is uncovered

### MAST-16 · Leaving the panel closes it where the reader went

- **Rule:** Tabbing out of the panel closes it without pulling focus back. A press outside closes it, and focus stays where the press landed.
- **Kind:** behaviour
- **Level:** browser: focus
- **Source:** `header.js:132-139`
- **Expected:** focus on "Keyboard shortcuts", Tab → panel closed, focus on the next control after the masthead. Press on a stage button → panel closed, focus on that button.
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R); `e2e/parity/masthead.spec.ts` (R; `next` gated off)

### MAST-17 · Arrow keys on a panel command do not reach the page

- **Rule:** An arrow key on an ordinary command in the panel is kept from the page, so the anatomy tree does not move.
- **Kind:** behaviour
- **Level:** browser: keyboard dispatch
- **Source:** `header.js:147-151`; `header.test.js:124-142`
- **Expected:** focus on "Keyboard shortcuts", ArrowDown → the document's keydown sees `defaultPrevented === true`.
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R)

### MAST-18 · A command closes the panel before its dialog opens

- **Rule:** Full screen, Provenance and Keyboard shortcuts close the panel and return focus to More settings first. Only then do they act, so a dialog they open takes More settings as its invoker and returns focus there.
- **Kind:** accessibility
- **Level:** browser: focus order
- **Source:** deviation `h2-focus-before-dialog.md`; legacy `shortcuts.js:121-125`, `provenance.js:171-176`
- **Expected:** click "Keyboard shortcuts" → when `onShortcuts` runs, the focused element is named "More settings", and the panel is closed.
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R, shortcuts only; Provenance and Full screen are uncovered)

### MAST-19 · On a phone the panel also carries Full screen and Provenance

- **Rule:** Under the phone query the panel offers Full screen and Provenance before Keyboard shortcuts, and the masthead's own Full screen button is hidden. Provenance is offered once the manifest has loaded, and it opens a dialog. On a wide window only Keyboard shortcuts is drawn.
- **Kind:** behaviour
- **Level:** browser: layout and DOM
- **Source:** `index.html:176-182`; `chrome.contract.test.js:372-376`; `viewer/styles/phone.css:48-49`
- **Expected:** 390×844 → items "Full screen", "Provenance", "Keyboard shortcuts ?". One "Full screen" button in the accessibility tree. Clicking it calls `onFullscreen`. `provenanceReady=false` → no Provenance button; `true` → Provenance with `aria-haspopup="dialog"`.
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R, 2 cases); `e2e/parity/masthead.spec.ts` "on a phone the panel also offers Full screen" (R; `next` gated off)

### MAST-20 · Single-key shortcuts do not fire from masthead controls

- **Rule:** A key pressed on a masthead control is the control's own. The global single-key shortcuts do not act on it.
- **Kind:** behaviour
- **Level:** browser: keymap and a focused masthead control
- **Source:** comment 18 item 3 on #4 (`OWN_KEYS_ATTRIBUTE`); S5a
- **Expected:** focus on a Theme radio or the skip link and press `f`, `r` or `1` → no framing, reset or view change (fake engine records none). The radio group's own arrows still work.
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (I: checks the `data-own-keys` attribute is present, not that keys are kept from the keymap)

### MAST-21 · The checked radio keeps its width

- **Rule:** The bold checked label does not change the width of any radio, so a choice does not make the row jump.
- **Kind:** behaviour
- **Level:** browser: layout
- **Source:** `header.js:20-24`
- **Expected:** `data-label` holds the drawn text ("Dark"). The `offsetWidth` of System, Light and Dark is the same before and after → on System.
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R)

### MAST-22 · Masthead targets are big enough

- **Rule:** Every masthead button, radio and panel item is at least 24×24 px on a fine pointer (WCAG 2.5.8). Icon buttons are 44×44 px on a phone.
- **Kind:** accessibility
- **Level:** browser: layout
- **Source:** WCAG 2.2 SC 2.5.8; `viewer/styles/phone.css:46`
- **Expected:** every visible `header button`, `.settings-menu [role=radio]` and `.menu-item` measures ≥ 24 px at 1280×800. Icon buttons measure 44 × 44 px at 390×844.
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R, 24 px desktop; the 44 px phone size is uncovered)

### MAST-23 · Enlarged and spaced text stays inside its control

- **Rule:** At 200 % text with the WCAG 1.4.12 spacing override, the skip link's and the radios' text stays inside them.
- **Kind:** accessibility
- **Level:** browser: layout
- **Source:** WCAG 2.2 SC 1.4.4, 1.4.12; comment 38 item 3 (`min-height`, not `height`)
- **Expected:** the text range height ≤ the box height + 0.5 px for `.skip-link` and every panel radio.
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R)

### MAST-24 · Forced colours and reduced motion

- **Rule:** In forced colours the checked radio keeps a visible edge. With reduced motion the panel fades and does not scale.
- **Kind:** accessibility
- **Level:** browser: CSS computed style under emulated media
- **Source:** decision record `0003-segmented-controls.md`; `viewer/styles/a11y.css`
- **Expected:** `forced-colors: active` → checked radio `outline-style: solid`, `outline-width: 2px`. `prefers-reduced-motion: reduce` → `.settings-menu` `transition-property: opacity`.
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R, 2 cases)

### MAST-25 · The masthead passes axe with its panel open

- **Rule:** The masthead with the panel open has no axe violations in either theme, on desktop or a phone, in English or French.
- **Kind:** accessibility
- **Level:** browser: axe
- **Source:** #4 parity proof
- **Expected:** zero violations (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`).
- **Covered by:** `src/features/masthead/Masthead.svelte.test.ts` (R, 2 cases); `e2e/parity/masthead.spec.ts` (legacy baseline; `next` gated off)

## Data bar: fields and options

### MAST-26 · The data fields are native selects named by their caption and described by their note

- **Rule:** Subject, Atlas, Colour and Internal anatomy are native selects. Each is named by its visible caption and described by its one-line note.
- **Kind:** accessibility
- **Level:** browser: accessible name and description
- **Source:** `index.html:106-135`; `chrome.contract.test.js:165-183`
- **Expected:** comboboxes "Subject", "Atlas", "Colour", "Internal anatomy" (FR "Sujet", "Atlas", "Couleur", "Anatomie interne"). Atlas on Destrieux is described by "Sulcal and gyral regions, 74 per hemisphere" (FR "Régions des sillons et des gyrus, 74 par hémisphère").
- **Covered by:** `src/features/masthead/DataBar.svelte.test.ts` (R, 2 cases); `e2e/parity/data-bar.spec.ts` (R; `next` gated off)

### MAST-27 · A field is offered only when there is a choice

- **Rule:** Subject is a field only when more than one subject is published, and Internal anatomy only when more than one detail level is. With one subject there is no Subject field and no subject text in the bar: the colophon names the subject.
- **Kind:** behaviour
- **Level:** unit (view-model) for which fields; browser for the DOM
- **Source:** `header.js:288-297, 315-319, 505-508`
- **Expected:** subjects `[sub_013, sub_014]` → Subject options "CDMD sub_013", "CDMD sub_014". One subject and detail levels `[learning]` → no "Subject" or "Internal anatomy" combobox, no `.study-name` and no "Subject" text. The published build (one subject) → no Subject field; Atlas shows "Destrieux" and Colour "Regions" on a fresh load.
- **Covered by:** `src/features/masthead/DataBar.svelte.test.ts` (R, 2 cases); `e2e/parity/data-bar.spec.ts` (R; `next` gated off)

### MAST-28 · A subject is named without quotation marks, dataset first

- **Rule:** A subject's name is its published display name without quotation marks or doubled spaces, which keeps the dataset with the subject. It falls back to the subject id, then the entry id.
- **Kind:** data
- **Level:** unit (view-model `subjectName`)
- **Source:** `header.js:37-41`; `chrome.contract.test.js:240-245`
- **Expected:** `MGH CDMD “sub_013”` → `MGH CDMD sub_013`; `SNAIL “subj_1”` → `SNAIL subj_1`; `AOMIC-PIOP1 “sub-0022”` → `AOMIC-PIOP1 sub-0022`; `{id:'x', subject:'x'}` → `x`; `{id:'y'}` → `y`. Also `A  "b"` → "A b", and `””` with no subject or id → "".
- **Covered by:** `src/lib/core/panels/header.test.ts` (R); `parity/C5.test.ts` (D, seeded entries against legacy)

### MAST-29 · Colour offers only published colourings, in fixed groups

- **Rule:** The Colour field offers only the colourings this build publishes, in the groups Appearance (Tissue, T1 MRI), Parcellation (Regions) and Networks (Yeo 7 networks, CAB-NP networks). Functional divisions comes last, on its own.
- **Kind:** behaviour
- **Level:** unit (view-model `colourGroups`); browser only for the optgroup labels in the DOM
- **Source:** `header.js:9-15, 51-57`; `chrome.contract.test.js:317-331`
- **Expected:** all published → `[['appearance',['tissue','mri']], ['parcellation',['atlas']], ['networks',['network','cab-np']], [null,['functional']]]`. Networks only → no `cab-np` and no functional group. Option texts on Destrieux: `''` (the hidden paint option), "Tissue", "T1 MRI", "Regions", "Yeo 7 networks", "CAB-NP networks (atlas becomes HCP-MMP)", "Functional divisions (atlas becomes HCP-MMP)". Optgroup labels "Appearance", "Parcellation", "Networks" (FR "Apparence", "Parcellisation", "Réseaux").
- **Covered by:** `src/lib/core/panels/header.test.ts` (R); `src/features/masthead/DataBar.svelte.test.ts` (R, could move down); `e2e/parity/data-bar.spec.ts` (R; `next` gated off); `parity/C5.test.ts` (D)

### MAST-30 · An option says what else choosing it changes

- **Rule:** A colouring defined on another atlas names the atlas it switches to. An atlas that cannot show the current colouring names the colouring it falls back to. The selected option, and options with no side effect, carry just their name.
- **Kind:** behaviour
- **Level:** unit (view-model `colourOption`, `atlasOption`)
- **Source:** `header.js:59-70`; `chrome.contract.test.js:333-344`
- **Expected:** `colourOption('en','cab-np',{atlas:'destrieux',required:'hcp-mmp'})` → "CAB-NP networks (atlas becomes HCP-MMP)"; with `atlas:'hcp-mmp'` → "CAB-NP networks". `atlasOption('en','destrieux','hcp-mmp')` → "Destrieux (colour becomes Regions)". With HCP-MMP and CAB-NP shown, the Atlas options are "Destrieux (colour becomes Regions)", "HCP-MMP", "FreeSurfer aseg (colour becomes Regions)". FR: "(l’atlas devient …)", "(la couleur devient …)".
- **Covered by:** `src/lib/core/panels/header.test.ts` (R); `src/features/masthead/DataBar.svelte.test.ts` (R); `e2e/parity/data-bar.spec.ts` (R; `next` gated off); `parity/C5.test.ts` (D)

### MAST-31 · A tab's paint shows in Colour as a hidden option

- **Rule:** While the Functions or Deficits tab paints the brain, Colour shows that paint's name in an option that cannot be chosen, and its note says which tab set it.
- **Kind:** behaviour
- **Level:** browser: `<option hidden>` selected state
- **Source:** `header.js:17-18, 471-473, 488, 518`
- **Expected:** paint `function:memory` → selected option text "Functions", `hidden`; description starts "Set by the Functions tab".
- **Covered by:** `src/features/masthead/DataBar.svelte.test.ts` (R)

### MAST-32 · A choice that downloads shows its progress, and reverts if it does not land

- **Rule:** While a choice made in a field downloads, that select keeps showing the choice with how far it has come. Once the choice lands, fails or is overtaken, the select shows the model's state again.
- **Kind:** behaviour
- **Level:** unit (view-model) for the text; browser for the select's value
- **Source:** `header.js:72-76, 470-481`; `chrome.contract.test.js:346-350`
- **Expected:** choose HCP-MMP, status `switching`, no progress → selected text "HCP-MMP · Loading…". Progress 34/100 → "HCP-MMP · Loading 34%" (FR "Chargement 34 %"). Status `ready` with the atlas still `destrieux` → value `destrieux`, text "Destrieux". `loadingText` with no total, or total 0 → "Loading…"; 1/4 → "Loading 25%". `{5, 5}` → "Loading 100%"; French "Chargement 25 %" with a narrow no-break space. The exact strings are checked only by `parity/C5.test.ts` (D).
- **Covered by:** `src/features/masthead/DataBar.svelte.test.ts` (R); `src/lib/core/panels/header.test.ts` (W: compares against `t(lang,'header').loading` and matches `/25/`); `parity/C5.test.ts` (D)

### MAST-33 · Another subject waits for a download, and focus is not dropped

- **Rule:** The Subject select is disabled while a download runs, because another subject is another page. If it had focus, focus moves to Atlas, not to the page.
- **Kind:** accessibility
- **Level:** browser: focus
- **Source:** `header.js:509-510`; deviation `h3-focus-never-lost.md`
- **Expected:** Subject focused, status → `switching` → Subject `disabled`, focus on Atlas.
- **Covered by:** `src/features/masthead/DataBar.svelte.test.ts` (R)

### MAST-34 · A download started from the bar is announced at its start and its end

- **Rule:** A choice that has to download is said when it starts and when it lands. Progress is not said per percent. A failure says nothing more, because the notice does. A choice with no download says nothing.
- **Kind:** accessibility
- **Level:** browser: live region
- **Source:** deviation `h3-load-announcements.md`
- **Expected:** choose HCP-MMP → "HCP-MMP: Loading…" (FR "HCP-MMP : Chargement…"). Status `ready` with atlas `hcp-mmp` → "Anatomy loaded." (FR "Anatomie chargée."). Status `ready` with the atlas unchanged → still "HCP-MMP: Loading…". Colour T1 MRI with no download → `''`.
- **Covered by:** `src/features/masthead/DataBar.svelte.test.ts` (R, 4 cases)

### MAST-35 · On the bar a note is a tooltip; in the popover it is printed

- **Rule:** On the bar each field's note is its tooltip and never a native `title`. In the popover the notes are printed under the fields, and the tooltips are dropped so nothing is said twice.
- **Kind:** accessibility
- **Level:** browser: DOM and visibility
- **Source:** `header.js:342-350`
- **Expected:** on the bar, each select's `data-tooltip` is its note, and there is no `title`; Atlas → "Sulcal and gyral regions, 74 per hemisphere". In the popover, `.data-note` is visible and Atlas has no `data-tooltip`.
- **Covered by:** `src/features/masthead/DataBar.svelte.test.ts` (R; the bar case compares the tooltip to the note element it was read from, which is W apart from Atlas); `e2e/parity/data-bar.spec.ts` (R; `next` gated off)

### MAST-36 · Every data choice is explained in a line in both languages

- **Rule:** Each atlas, detail level and colouring has a one-line note in English and French. The field is "Subject", never "Specimen", for an in-vivo MRI.
- **Kind:** data
- **Level:** unit (i18n tables)
- **Source:** `chrome.contract.test.js:264-281`
- **Expected:** `header.notes` has more than 10 characters for `destrieux`, `hcp-mmp`, `learning`, `aseg` and `nextbrain` in `en` and `fr`. `display.surfaceColorTitles` is set for `tissue`, `mri`, `atlas`, `network`, `cab-np` and `functional`. `header.subject` is "Subject" / "Sujet". No "Specimen" or "Spécimen" in the masthead.
- **Covered by:** uncovered (`parity/C1.test.ts` compares the string tables with legacy: D)

## Data bar: collapse and summary

### MAST-37 · The bar collapses when it does not fit, and always on phones and touch

- **Rule:** The bar measures itself rather than using a breakpoint. When the fields do not fit, they go behind a summary button. A phone and a coarse pointer always get the summary. The bar refits when its own width changes, not only on a window resize.
- **Kind:** behaviour
- **Level:** browser: layout and ResizeObserver
- **Source:** `header.js:351-368, 383-386, 418-421`; `header.test.js:201-222, 320-341`
- **Expected:** 1600×900, fine pointer → no `data-collapsed`. 390×844 → collapsed. Touch emulation at 1600×900 → collapsed, with a summary ≥ 44 px tall and < 500 px wide, and the popover's left edge within 3 px of the summary's. Bar width 300 px → collapsed; width cleared → not collapsed.
- **Covered by:** `src/features/masthead/DataBar.svelte.test.ts` (R, 4 cases); `e2e/parity/data-bar.spec.ts` (R; `next` gated off)

### MAST-38 · The summary names its parts, label first

- **Rule:** The summary button is named "Atlas and display settings:" followed by every part it shows, joined by " · ": subject (when there is a choice), atlas, colour, internal anatomy. A tract reference shows only its own name. The button carries `aria-expanded` and `aria-controls`, and its tooltip is the label alone (WCAG 2.5.3: the visible text is in the name).
- **Kind:** accessibility
- **Level:** unit (view-model `dataSummary`) for the parts; browser for the name
- **Source:** `header.js:43-49, 427-457, 522`; `chrome.contract.test.js:247-262`
- **Expected:** "Atlas and display settings: CDMD sub_013 · Destrieux · Tissue · Teaching set"; FR prefix "Réglages de l’atlas et de l’affichage: ". `dataSummary({subject:null, atlas:'Destrieux', colour:'Regions', detail:'Teaching set'})` → parts atlas, colour, detail. With a `reference` → `[{part:'subject', text:<reference>}]`. `aria-controls` = the popover's id; `data-tooltip` "Atlas and display settings". Every printed part is in the name.
- **Covered by:** `src/features/masthead/DataBar.svelte.test.ts` (R); `src/lib/core/panels/header.test.ts` (R); `e2e/parity/data-bar.spec.ts` (R; `next` gated off); `parity/C5.test.ts` (D)

### MAST-39 · As room shrinks the summary drops internal anatomy, then colour, never the atlas

- **Rule:** A summary too long for its line hides Internal anatomy, then Colour. The atlas is never dropped; it truncates. The accessible name keeps every part.
- **Kind:** behaviour
- **Level:** browser: layout measurement
- **Source:** `header.js:369-382`; `header.test.js:251-318`
- **Expected:** 300×800 → `data-short` set; the `detail` part is `display: none`, the `atlas` part is shown, and the name still contains "Teaching set". 250×800 with one detail level → `data-short="colour"`, atlas shown.
- **Covered by:** `src/features/masthead/DataBar.svelte.test.ts` (R, 2 cases)

### MAST-40 · The popover is a disclosure: the summary keeps focus and Tab walks the fields

- **Rule:** The summary opens the popover with Enter, Space or a press, and keeps focus. Tab walks the fields in order, then leaves, which closes the popover. A keyboard open is instant; a pointer open animates.
- **Kind:** accessibility
- **Level:** browser: keyboard and focus
- **Source:** decision record `0005-settings-and-data-disclosure.md`; `header.js:388-407`; `header.test.js:238-249`
- **Expected:** focus on the summary, Enter → `aria-expanded="true"`, focus on the summary. Tab ×4 → Subject, Atlas, Colour, Internal anatomy. Tab → "Save image (PNG)" (no Full screen on a phone) and the popover is closed. Space opens it. Keyboard open → `[data-instant]`; pointer open → none.
- **Covered by:** `src/features/masthead/DataBar.svelte.test.ts` (R, 4 cases); `e2e/parity/data-bar.spec.ts` (R; `next` gated off)

### MAST-41 · Escape closes the popover onto the summary and is consumed

- **Rule:** Escape closes the open popover, puts focus on the summary and is marked handled, even when a click on a note left focus on the page. The selection is not cleared.
- **Kind:** behaviour
- **Level:** browser: keyboard; e2e for "the selection survives" with the real keymap
- **Source:** `header.js:397-403`
- **Expected:** focus on Colour, Escape → `defaultPrevented`, `aria-expanded="false"`, focus on the summary. Focus on `body`, Escape → handled and closed. With `destrieux:left:38` selected, the hash still contains it after Escape.
- **Covered by:** `src/features/masthead/DataBar.svelte.test.ts` (R, 2 cases); `e2e/parity/data-bar.spec.ts` "does not clear the selection" (R, the only check of the selection half; `next` gated off)

### MAST-42 · A press outside closes the popover without moving focus

- **Rule:** A press outside the data group closes the popover, and focus stays where the press landed.
- **Kind:** behaviour
- **Level:** browser: pointer and focus
- **Source:** `header.js:393-395`
- **Expected:** popover open, click "Save image (PNG)" → closed, focus on that button.
- **Covered by:** `src/features/masthead/DataBar.svelte.test.ts` (R); `e2e/parity/data-bar.spec.ts` (R; `next` gated off)

### MAST-43 · The data popover and the settings panel are never open together

- **Rule:** Opening the data popover closes the settings panel, and opening the settings panel closes the data popover.
- **Kind:** behaviour
- **Level:** browser: two components sharing one bound state (the binding is the composition's: REGION-15)
- **Source:** `header.js:164-165, 396`
- **Expected:** data open, click More settings → data `aria-expanded="false"`, More settings `"true"`; click the summary → the reverse.
- **Covered by:** `src/features/masthead/DataBar.svelte.test.ts` (R); `src/features/masthead/Masthead.svelte.test.ts` (R); `e2e/parity/data-bar.spec.ts` (R; `next` gated off)

### MAST-44 · Focus is never lost when the bar changes shape

- **Rule:** When the bar collapses under a focused field, the popover opens and the field keeps focus. When it widens under the focused summary, focus goes to the first visible, enabled field. A collapse with focus elsewhere leaves the popover closed.
- **Kind:** accessibility
- **Level:** browser: layout and focus
- **Source:** `header.js:352-368`; `header.test.js:181-236`; deviation `h3-focus-never-lost.md`
- **Expected:** Atlas focused at 1600 px, resize to 390 px → collapsed, `aria-expanded="true"`, focus on Atlas. Summary focused at 390 px, resize to 1600 px → focus on Subject. Focus on More settings, bar width 300 px → collapsed, `aria-expanded="false"`.
- **Covered by:** `src/features/masthead/DataBar.svelte.test.ts` (R, 3 cases)

### MAST-45 · The popover fits small and enlarged screens

- **Rule:** On a phone the popover ends 12 px from the right edge. In landscape at most 480 px tall it lays the fields out in two columns. At 320 px wide with 200 % text and the WCAG 1.4.12 spacing it stays inside the window and the page does not scroll sideways.
- **Kind:** accessibility
- **Level:** browser: layout
- **Source:** WCAG 2.2 SC 1.4.10, 1.4.12; `viewer/styles/masthead.css:71-307`
- **Expected:** 390×844 → `|popover.right − (innerWidth − 12)| < 2`. 844×390 → `grid-template-columns` has 2 tracks. 320×640 at 200 % → popover left ≥ 0, right ≤ `innerWidth`, `scrollWidth ≤ innerWidth`.
- **Covered by:** `src/features/masthead/DataBar.svelte.test.ts` (R, 3 cases)

### MAST-46 · Data targets are big enough

- **Rule:** Every field on the bar is at least 24 px (WCAG 2.5.8). On a phone or touch screen the summary and every field are at least 44 px tall.
- **Kind:** accessibility
- **Level:** browser: layout
- **Source:** WCAG 2.2 SC 2.5.8; the project's 44 px coarse-pointer rule
- **Expected:** 1600×900: every select ≥ 24×24 px. 390×844, and touch at 1600×900: summary and every select `offsetHeight` ≥ 44.
- **Covered by:** `src/features/masthead/DataBar.svelte.test.ts` (R, 3 cases)

## Data bar: tract reference

### MAST-47 · The tract reference shows its name alone, with its description reachable

- **Rule:** While the tract reference is shown, the bar names it and offers no field. When the reference has a description, its name is a Tab stop, described by that description, and its tooltip opens on keyboard focus. On a phone the summary shows the name alone, with no popover to open.
- **Kind:** accessibility
- **Level:** browser: focus and description
- **Source:** `header.js:501-508, 520-523`; deviation `h3-name-description-reachable.md`; decision 16 on #4
- **Expected:** reference `{label:'Tract reference', description:'Bundles drawn on the HCP template'}` → `data-reference`; no combobox; `.study-name` text "Tract reference", `tabIndex 0`, `data-tooltip` and description = the description. Tab from the skip link → the name, and a `tooltip` with the description appears. On 390 px: collapsed, the summary toggle is not visible, the name is visible, no combobox.
- **Covered by:** `src/features/masthead/DataBar.svelte.test.ts` (R, 2 cases)

### MAST-48 · Focus survives the reference coming, changing and its language

- **Rule:** Focus on the reference's name stays there when the reference is passed again or the language changes. When the reference starts while a field has focus, focus moves on to the next masthead control, not to the page.
- **Kind:** accessibility
- **Level:** browser: focus
- **Source:** deviation `h3-focus-never-lost.md`
- **Expected:** name focused, reference re-passed → still focused; language → `fr` → still focused. Colour focused, reference set → `activeElement` is not `body` and is outside the data bar.
- **Covered by:** `src/features/masthead/DataBar.svelte.test.ts` (R, 2 cases)

## Data bar: appearance and axe

### MAST-49 · Select carets and borders survive forced colours and increased contrast

- **Rule:** Each select's caret is drawn with borders, so it survives forced colours in the system text colour. With increased contrast the fields have a visible border.
- **Kind:** accessibility
- **Level:** browser: CSS computed style under emulated media
- **Source:** deviation `h3-select-caret-forced-colours.md`; `viewer/styles/a11y.css:20, 49`
- **Expected:** `forced-colors: active` → the wrapper's `::after` `border-right-color` and the select's `border-top-color` equal the computed `CanvasText`. `prefers-contrast: more` → Atlas `border-top-color` is `--border-control`: `rgb(119, 130, 140)` (`#77828c`) in light, `rgb(125, 132, 140)` (`#7d848c`) in dark.
- **Covered by:** `src/features/masthead/DataBar.svelte.test.ts` (R forced colours; W for contrast: it only asserts the border is not `rgba(0, 0, 0, 0)`)

### MAST-50 · The bar and the open popover pass axe

- **Rule:** The bar and the open popover have no axe violations in either theme, desktop and phone, English and French, with touch emulation too.
- **Kind:** accessibility
- **Level:** browser: axe
- **Source:** #4 parity proof
- **Expected:** zero violations (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`).
- **Covered by:** `src/features/masthead/DataBar.svelte.test.ts` (R, 4 cases); `e2e/parity/data-bar.spec.ts` (legacy baseline; `next` gated off)
