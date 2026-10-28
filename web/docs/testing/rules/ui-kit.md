# UI kit rules: style foundation, interaction services and primitives

Scope: chunks U0 (#11, kit choice and spike), U1 (#12, tokens, cascade layers, contrast, phone tokens:
`web/src/styles/`), U2 (#14, interaction services: announcer, focus registry, roving, drag, instant and
own-keys markers), U3 (#15, IconButton, ChoiceGroup, ToggleToolbar, Toolbar, Switch, Collapsible), U4
(#16, native and content primitives), U5 (#17, Dialog, Popover, Tooltip), U6 (#18, SearchCombobox,
list navigation) and U7 (#19, Treegrid). The business rules are the WAI-ARIA APG patterns and WCAG 2.2
AA, as fixed by decision records `0001-ui-kit.md`, `0002-anatomy-treegrid.md`,
`0003-segmented-controls.md`, `0005-settings-and-data-disclosure.md` and the segmented-controls
decision in the #4 body. Tabs (0004) are in `workspace.md`. Legacy sources: `viewer/styles/*.css`,
`viewer/ui/{announce,drag,roving,tooltip}.js`, `viewer/ui/panels/navigator.js`,
`viewer/ui/panels/{functions,clinical}.js`. New code: `web/src/lib/ui/`, `web/src/styles/`.
Deviations: `u1-overlay-control-contrast.md`, `u2-roving-modifier-keys.md`, `u3-segmented-controls.md`,
`u4-*.md`, `u5-tooltip-container.md`, `u5-tooltip-grace-area.md`, `u6-list-nav-modifier-keys.md`,
`u7-treegrid.md`, `u7-treegrid-keys.md`. "axe clean" means no violations of the `wcag2a`, `wcag2aa`,
`wcag21aa` and `wcag22aa` tags (the page-level `region` rule off for fixtures). Lengths are CSS px.

## Style foundation

### UI-01 · The cascade has six layers in a fixed order, accessibility last

- **Rule:** The stylesheet entry declares the layer order first: tokens, base, elements, components, features, a11y. Built with a component whose styles are in `features`, the bundle keeps that order, so no component rule can undo an accessibility rule whatever its specificity.
- **Kind:** hygiene
- **Level:** unit (source scan; the bundle case builds with Vite)
- **Source:** `viewer/styles/stylesheets.test.js:10-15`; new `src/styles/index.css:6`
- **Expected:** First statement of `index.css`: `@layer tokens, base, elements, components, features, a11y`. In the built CSS the first-seen layer order is `['tokens', 'base', 'elements', 'components', 'features', 'a11y']`, and the probe's rule appears as `@layer features {h1.svelte-…`.
- **Covered by:** `src/styles/stylesheets.test.ts` (H); `src/styles/layer-order.test.ts` (H)

### UI-02 · Every stylesheet is loaded once, in its own layer, before any component

- **Rule:** `index.css` imports the vendored font first, then every other sheet in `src/styles`; `main.ts` imports `index.css` before any component. Each sheet is one layer named after its file. Every rule in a component `<style>` sits in `components`, `features` or `a11y` (keyframes, `@property` and font faces excepted).
- **Kind:** hygiene
- **Level:** unit (source scan)
- **Source:** `viewer/styles/stylesheets.test.js:10-15`
- **Expected:** First import `@fontsource-variable/source-sans-3/wght.css`; the rest equal the other `.css` files of `src/styles`. `tokens.css` holds only `@layer tokens` blocks, and so on. The font family is `'Source Sans 3 Variable'`, and `--font-ui: "Source Sans 3 Variable", sans-serif;`.
- **Covered by:** `src/styles/stylesheets.test.ts` (H)

### UI-03 · Forced-colour and contrast rules live only in the top-level accessibility layer; hover answers one query

- **Rule:** A `forced-colors` or `prefers-contrast` media block appears only directly inside the top-level `@layer a11y`; no layer is nested. Hover styles appear only under `(hover: hover) and (pointer: fine)` or its negation.
- **Kind:** hygiene
- **Level:** unit (source scan)
- **Source:** `viewer/styles/stylesheets.test.js:16-29`
- **Expected:** Over every sheet and component style: no violations. The scanner reports `outside @layer a11y: @media (forced-colors: active)`, `nested layer: @layer a11y`, `hover query: @media (hover: hover)` and `:hover outside the hover query: a:hover` for the matching bad inputs, and nothing for `@layer a11y { @media (forced-colors: active) { … } }`.
- **Covered by:** `src/styles/stylesheets.test.ts` (H)

### UI-04 · Type comes from the scale, and every token read is declared

- **Rule:** No retired type token is used; every `line-height` is a scale token, `inherit` or a pixel value; every `var(--x)` read without a fallback is declared in a sheet, a component style or markup.
- **Kind:** hygiene
- **Level:** unit (source scan)
- **Source:** `viewer/styles/stylesheets.test.js:31-46`
- **Expected:** No `--text-small`, `--text-micro`, `--text-body`; line heights match `var(--lh-(caption|ui|prose|title))`, `inherit` or `\d+px`; no undeclared token.
- **Covered by:** `src/styles/stylesheets.test.ts` (H)

### UI-05 · Text reads at 4.5:1 and control edges at 3:1 on every ground, in both themes

- **Rule:** In the light and the dark theme, body inks reach 4.5:1 on every panel ground, control edges 3:1; the primary button's ink 4.5:1 on its fills; stage overlay inks 4.5:1 and the overlay control border 3:1 on every plate (WCAG 1.4.3, 1.4.11).
- **Kind:** accessibility
- **Level:** unit (contrast computed from the declared tokens)
- **Source:** WCAG 2.2 SC 1.4.3, 1.4.11; deviation `u1-overlay-control-contrast.md`, `u1-stage-thumb-ring-contrast.md`
- **Expected:** Inks `--text-primary`, `--text-secondary`, `--text-tertiary`, `--accent`, `--danger` ≥ 4.5 on `--surface-base`, `-navigation`, `-sunken`, `-canvas`, `-hover`, `-raised`, `-tonal`, `-tonal-hover`; `--border-control`, `--thumb-ring` ≥ 3 on them; `--primary-ink` ≥ 4.5 on `--primary-fill`, `--primary-fill-hover`; `--overlay-ink`, `-ink-muted`, `-ink-faint`, `-accent`, `-danger` ≥ 4.5 and `--overlay-control-border` ≥ 3 on `--overlay-plate`, `-plate-hover`, `-track`, `-track-hover`. `--overlay-control-border` is `#70777f`: 3.96, 3.34, 3.43, 3.01:1 on those four (±0.01).
- **Covered by:** `src/styles/contrast.test.ts` (R; the dark theme was tested with the light tokens until K9 fixed its selector key, and now fails if that rule is missing; the dark `--thumb-ring` was 2.92:1 on `--surface-raised` and is fixed, deviation `u1-thumb-ring-contrast.md`; the `--thumb-ring` of the stage and of the imaging dialog, read through `stage-vars.css` and `Dialog.svelte`, ≥ 3 on `--surface-raised`, `-tonal`, `-tonal-hover`, `-navigation`, `-base` and `-hover`, deviation `u1-stage-thumb-ring-contrast.md`; the scale bar's ink, STAGE-10)

### UI-06 · Both themes declare the published palette

- **Rule:** `tokens.css` declares one light set on `:root` and one dark override on `:root[data-theme='dark']`, with the published values; the phone rule is separate.
- **Kind:** data
- **Level:** unit (declared values)
- **Source:** `viewer/styles/tokens.css`; deviation `u1-overlay-control-contrast.md`, `u1-stage-thumb-ring-contrast.md`
- **Expected:** The selectors before the phone rule are exactly `:root` and `:root[data-theme='dark']`. Fixed values include `--surface-base` `#ffffff` light and `#1b1e21` dark, and `--overlay-control-border` `#70777f`. The full table is a fixed token list taken once from today's `tokens.css` (it equals the legacy palette apart from that border and the dark `--thumb-ring`).
- **Covered by:** `src/styles/tokens.test.ts` (R, the selectors and each theme's whole declared set against a fixed literal: 94 in `:root`, 22 in the dark override)

### UI-07 · A phone or a finger gets 44 px touch sizes; a desktop mouse keeps instrument density

- **Rule:** In the phone shell (narrow, or a phone held sideways) controls, rows and tabs are 44 px, the header taller and the panel inset smaller. A coarse pointer on a desktop-sized window also gets 44 px rows, controls and tabs. A desktop with a fine pointer keeps 32 px.
- **Kind:** accessibility
- **Level:** browser: media queries on the real viewport
- **Source:** `viewer/styles/phone.css:15, 318`; WCAG 2.5.8
- **Expected:** Query `@media (max-width: 800px), (max-height: 480px) and (orientation: landscape)`. At 390 × 844, 812 × 375 and 844 × 390: `--control-height`, `--row-height`, `--tab-height` `44px`, `--header-height` `max(52px, 3.25rem)`, `--panel-inset` `16px`. At 1280 × 800: `--control-height` and `--row-height` `32px`; with touch emulation (coarse pointer) `44px` for rows, controls and tabs, header `max(48px, 3rem)`.
- **Covered by:** `src/styles/phone-tokens.svelte.test.ts` (R); the query literal is held by CAT-05

### UI-08 · Increased contrast strengthens the faint tokens in both themes

- **Rule:** Under `prefers-contrast: more`, in both themes, the faint inks and borders take their stronger counterparts and the overlay plates darken.
- **Kind:** accessibility
- **Level:** unit (declared values)
- **Source:** `viewer/styles/a11y.css:19-33`
- **Expected:** On `:root, :root[data-theme='dark']`: `--text-tertiary: var(--text-secondary)`, `--border-control: var(--text-primary)`, `--border-subtle: var(--border-control)`, `--thumb-ring: var(--text-primary)`, `--overlay-ink-muted`, `--overlay-border`, `--overlay-ink-faint`, `--overlay-control-border: var(--overlay-ink)`, `--overlay-halo: rgb(6 9 13 / 0.95)`, `--overlay-plate: #0c0d0f`, `--overlay-plate-hover: #1e2024`.
- **Covered by:** `src/styles/tokens.test.ts` (R, the declared swap); UI-31 checks one component effect

### UI-09 · One focus ring, for keyboard focus only, in every theme and in forced colours

- **Rule:** Keyboard focus draws a 2 px accent outline 2 px off the element; pointer focus draws none. In forced colours the ring is `Highlight` and buttons, inputs and selects have `CanvasText` borders.
- **Kind:** accessibility
- **Level:** browser: computed style for keyboard and pointer focus
- **Source:** `viewer/styles/base.css:47-51`; `src/styles/a11y.css:45-55`; WCAG 2.4.7
- **Expected:** Tabbed-to button: `outline: 2px solid` the `--accent` colour, `outline-offset: 2px`. Clicked button: `outline-style: none`. Under `forced-colors: active`: outline colour equals `Highlight`, button border colour `CanvasText`.
- **Covered by:** `src/styles/base.svelte.test.ts` (R, computed style: keyboard ring, no ring on a click, forced colours); `src/lib/ui/SearchCombobox.svelte.test.ts` (R, the forced-colour Highlight ring on the search field)

### UI-10 · Hidden is hidden, and visually hidden text stays in the accessibility tree

- **Rule:** `[hidden]` hides an element whatever its own display. `.visually-hidden` takes the text off screen but keeps it readable to assistive technology. The page body uses the UI face on the canvas ground.
- **Kind:** behaviour
- **Level:** browser: computed style and accessible name
- **Source:** `viewer/styles/base.css:53, 70-78`
- **Expected:** `<div hidden style="display:flex">` → computed `display: none`. `.visually-hidden` → `position: absolute`, 1 × 1 px, `margin: -1px`, `overflow: hidden`, `clip-path: inset(50%)`, `white-space: nowrap`, and its text still names a button. `body`: `margin: 0`, `font-family` the UI font, `color` `--text-primary`, `background` `--surface-canvas`.
- **Covered by:** `src/styles/base.svelte.test.ts` (R, computed style)

### UI-11 · Keys are drawn as caps and quantities line up

- **Rule:** A `kbd` is a 20 px-wide-at-least key cap in the monospace caption face; a key range is tertiary caption text; quantities use tabular figures; copyable codes are monospace caption.
- **Kind:** behaviour
- **Level:** browser: computed style
- **Source:** `viewer/styles/base.css:56-58`; `viewer/styles/components.css:489-503`
- **Expected:** `kbd`: `display: inline-block`, `min-width: 20px`, mono font, caption size, centred, `--text-secondary` on `--surface-base`, 1 px `--border-subtle` border, inset bottom shadow. `.key-range`: `--text-tertiary`, caption. `.measure`: `font-variant-numeric: tabular-nums`. `.code`: mono, caption.
- **Covered by:** `src/styles/base.svelte.test.ts` (R, computed style)

### UI-12 · A theme switch and an instant overlay show no transition

- **Rule:** While `<html>` carries `data-theme-switching`, and on any element carrying `data-instant` (and its backdrop), transitions are off, and no component rule can turn them back on.
- **Kind:** behaviour
- **Level:** browser: computed style
- **Source:** `viewer/styles/base.css`; new `src/styles/base.css:104-110`; deviation `u2-theme-switch-frames.md`
- **Expected:** A component with `transition: color 0.2s` in `@layer components`: under `:root[data-theme-switching]`, or with `data-instant`, computed `transition-duration` is `0s`; without them `0.2s`.
- **Covered by:** uncovered (the attributes are set by STORE-19, UI-23, UI-49, UI-54 and UI-55; their CSS effect is not checked)

### UI-13 · Reduced motion turns a disclosure chevron at once

- **Rule:** Under `prefers-reduced-motion: reduce` disclosure chevrons point the new way without a transition; fades may stay.
- **Kind:** accessibility
- **Level:** browser: computed style under emulated media
- **Source:** `src/styles/a11y.css:19-25`; WCAG 2.3.3
- **Expected:** Collapsible chevron: `transition-duration` not `0s` normally, `0s` under reduce. `details > summary::before`: `transition: none` under reduce.
- **Covered by:** `src/lib/ui/Collapsible.svelte.test.ts` (R, the Collapsible chevron); the `details` chevron is uncovered

## Interaction services

### UI-14 · Arrow keys, Home and End step through a one-stop group and wrap

- **Rule:** In a roving group, Right and Down go to the next member, Left and Up to the previous, wrapping; Home to the first, End to the last. Other keys, and an empty group, move nothing.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/roving.js:2-12`
- **Expected:** Count 4: `ArrowRight` 0 → 1; `ArrowDown` 3 → 0; `ArrowLeft` 0 → 3; `ArrowUp` 2 → 1; `Home` 2 → 0; `End` 0 → 3. `Enter`, `' '`, `Tab`, `'a'` → `null`. Count 0 → `null`.
- **Covered by:** `src/lib/ui/roving.test.ts` (R)

### UI-15 · The group's Tab stop is the focused member, else the chosen one, else the first usable

- **Rule:** Disabled and hidden members never hold the Tab stop. The stop is the focused usable member, else the pressed one, else the first usable one, else none.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/roving.js:14-19`
- **Expected:** `[{}, {pressed}, {}]` → member 1; focused member 2 → 2. `[{disabled}, {}, {}]` → 1. `[{disabled}, {disabled}]` → `null`. `[{hidden, pressed}, {}]` → 1. Bound to `[{}, {}, {pressed}, {}]`, the tabindexes are `[-1, -1, 0, -1]`.
- **Covered by:** `src/lib/ui/roving.test.ts` (R); `src/lib/ui/interaction.svelte.test.ts` (R)

### UI-16 · Arrows move focus in a roving group without choosing; Tab leaves and returns to the chosen one

- **Rule:** An arrow on a usable member moves focus and the Tab stop, skipping disabled members, and is marked handled; it never presses. Enter and Space stay the button's own. Leaving the group hands the stop back to the chosen member, so Tab and Shift+Tab return there. A changed choice or a disabled group moves the stop on `sync`.
- **Kind:** behaviour
- **Level:** unit (fake group) for the stop and key handling; browser: real Tab order
- **Source:** `viewer/ui/roving.js:21-58`; APG Toolbar
- **Expected:** `[{pressed}, {disabled}, {}, {}]`, focus 0: `ArrowRight` → handled, focus 2, stops `[-1, -1, 0, -1]`, member 0 still pressed; `End` → 3; `ArrowRight` → 0; `Enter` not handled. A key on a disabled member is not handled. Focus 1 of `[{}, {pressed}, {}]`, `ArrowRight`, leave → stops `[-1, 0, -1]`. Real DOM (Front, Left pressed, Right disabled, Top): from Left, Right → Top → Front, Left → Top, Home → Front, End → Top, Left stays pressed; Tab out to After and Shift+Tab → Left. `sync` after the choice moves to member 1 → `[-1, 0]`; all disabled → `[-1, -1]`.
- **Covered by:** `src/lib/ui/roving.test.ts` (R; the dispose case is I: it pins the listener map); `src/lib/ui/interaction.svelte.test.ts` (R)

### UI-17 · A modified arrow is the browser's or the platform's

- **Rule:** Roving groups and list navigation leave keys with Alt, Ctrl, Meta or Shift held alone: focus does not move and the event is not cancelled.
- **Kind:** behaviour
- **Level:** unit (fake events); browser for a real `keydown`
- **Source:** deviations `u2-roving-modifier-keys.md`, `u6-list-nav-modifier-keys.md`; APG "Keyboard Shortcuts"
- **Expected:** Alt/Ctrl/Meta/Shift + `ArrowRight` on a roving member → not handled, focus unchanged. Alt + `ArrowRight` dispatched in Chromium → `defaultPrevented === false`. List navigation: Alt/Ctrl/Shift + `ArrowDown` in the field or on a row → not handled.
- **Covered by:** `src/lib/ui/roving.test.ts` (R); `src/lib/ui/interaction.svelte.test.ts` (R); `src/lib/ui/list-nav.svelte.test.ts` (R)

### UI-18 · A sentence is said at once, and the same sentence again is said again

- **Rule:** The page's one polite live region (in the initial HTML) takes each announcement at once. Writing the sentence it already holds would say nothing, so a repeat is cleared and written again 100 ms later; a newer sentence in that gap replaces it. Announcing before the region is attached is an error.
- **Kind:** accessibility
- **Level:** unit (region as a plain object, fake timers); browser for the DOM mutation
- **Source:** `viewer/main.js:47`; `viewer/app.js:88`; decision 18 on #4
- **Expected:** `announce('Loading failed')` → writes `['Loading failed']`. `'Hemisphere: left'` twice → `['Hemisphere: left', '']`, still so at +99 ms, `['Hemisphere: left', '', 'Hemisphere: left']` at +100. `a`, `a`, `b` → `['a', '', 'b']`, region ends `'b'`. Released → `announce('x')` throws `'announce() called before attachAnnouncer()'`. In Chromium a repeat is observed as `['', 'Again']`.
- **Covered by:** `src/lib/ui/announcer.test.ts` (R); `src/lib/ui/interaction.svelte.test.ts` (R)

### UI-19 · A typed search's count is said once typing pauses, and only when it is new

- **Rule:** The debounced announcer says the latest text 500 ms after the last call, only if it differs from the last sentence it said. Returning to the sentence already said cancels what was pending. `reset` forgets the last sentence (a cleared search may say its count again, decision 37); `reset` and `dispose` cancel what is pending.
- **Kind:** accessibility
- **Level:** unit (fake timers)
- **Source:** `viewer/ui/announce.js:5-16`; decision 37 on #4
- **Expected:** `'1 result'`, +499 `'12 results'`, +499 → nothing; +1 → `['12 results']`. `'3 results'` (said), `'4 results'`, +200 `'3 results'`, +1000 → `['3 results']`. Said, `reset`, same again, +500 → `['3 results', '']`, +100 → `['3 results', '', '3 results']`. `a`, `reset`, `b`, `dispose`, +1000 → `[]`. Delay 50 → written at +50. Script (wait ms, text): 0 a, 100 ab, 400 abc, 700 abc, 499 abcd, 50 abc, 600 abc, 10 x, 500 x, 600 y, 600 x, then +2000 → writes at `[[1000, 'abc'], [2859, 'x'], [3959, 'y'], [4559, 'x']]`.
- **Covered by:** `src/lib/ui/announcer.test.ts` (R, including the fixed-time typing script)

### UI-20 · Focus is asked for by name and lands only where it can

- **Rule:** An owner registers how to find its element; anyone asks for it by name. The element is looked up at request time, so one rendered later is found. A target that is unregistered, absent, hidden, disabled, inert or not focusable is skipped for the fallback. The request says whether focus landed. A name registered twice is an error until unregistered.
- **Kind:** behaviour
- **Level:** browser: real focus and visibility
- **Source:** `viewer/app.js:539-546, 706-713, 725`; `viewer/ui/panels/clinical.js:24`; `viewer/ui/panels/dissection.js:30-33`
- **Expected:** Names `dissection-undo`, `region-title`, `tree-stop`, `active-tab`. Title registered before it exists → `false`; rendered `<h2 tabindex="-1">` → `true`, focused. Undo disabled, title in `[hidden]`, tab in `[inert]`: each → `false`; with fallback `tree-stop` → `true`, Tree focused. A plain `<div>` → `false`. Unregistered with fallback unregistered → `false`; fallback registered → `true`. Second `registerFocusTarget('tree-stop', …)` throws `'already registered'`; after unregistering it succeeds.
- **Covered by:** `src/lib/ui/interaction.svelte.test.ts` (R)

### UI-21 · Stranded focus is rescued; focus the reader holds is left alone

- **Rule:** When the focused control hid or disabled itself, or focus is on the body, the named target takes focus. When a usable control has focus, nothing moves.
- **Kind:** behaviour
- **Level:** browser: real focus
- **Source:** `viewer/app.js:548-554`
- **Expected:** Focus on a visible button → `rescueFocus('active-tab')` is `false`, focus unchanged. That button hidden → `true`, the tab focused. Focus on the body → `true`.
- **Covered by:** `src/lib/ui/interaction.svelte.test.ts` (R)

### UI-22 · An overlay gives focus back to its opener, unless the opener has gone

- **Rule:** The element focused when an overlay opens is its opener; closing returns focus to it and reports success. If the opener was removed, or nothing was focused, nothing is moved and the result is false.
- **Kind:** behaviour
- **Level:** browser: real focus
- **Source:** APG Dialog and Disclosure; `viewer/ui/chrome/header.js:141`
- **Expected:** Opener focused, capture, focus Other, `back()` → `true`, Opener focused; Opener removed → `false`. Nothing focused at capture → `back()` `false`, focus stays on Other.
- **Covered by:** `src/lib/ui/interaction.svelte.test.ts` (R)

### UI-23 · A keyboard activation is told from a pointer click

- **Rule:** A `click` fired by Enter or Space (`detail` 0) is a keyboard activation and opens without an entry animation (`data-instant`); a pointer click (`detail` ≥ 1) animates.
- **Kind:** behaviour
- **Level:** browser: real key and pointer events
- **Source:** `viewer/ui/chrome/sections.js:236`; `viewer/ui/chrome/sheet.js:211`
- **Expected:** Enter on a focused button, then a click → `[true, false]`. `setInstant(el, true)` adds `data-instant`, `false` removes it.
- **Covered by:** `src/lib/ui/interaction.svelte.test.ts` (R; the `setInstant` case is W, it re-reads the attribute it just set)

### UI-24 · Primitives carry no own-keys marker; the region that holds them does

- **Rule:** A region whose controls use letters or digits (masthead, panels, stage dock) is marked `data-own-keys`, so single-key shortcuts skip its controls. The primitives themselves are not marked.
- **Kind:** behaviour
- **Level:** browser: rendered markup
- **Source:** `viewer/ui/chrome/shortcuts.js:9-10`; conductor decision 7 on #4
- **Expected:** The marker is `data-own-keys` (selector `[data-own-keys]`). A rendered ChoiceGroup or ToggleToolbar contains 0 `[data-own-keys]`.
- **Covered by:** `src/lib/ui/ChoiceGroup.svelte.test.ts` (R); `src/lib/ui/ToggleToolbar.svelte.test.ts` (R); `src/lib/ui/interaction.svelte.test.ts` (W: the constant matches its own selector); the region side is in `shortcuts.md`

### UI-25 · A slider drag lasts from its first input until it ends, however it ends

- **Rule:** Over one or several sliders, a drag starts at the first `input` and ends at `change`, `pointerup`, `pointercancel` or `blur`, so a release on the start value or a cancel still ends it. The end is reported once; a release with no drag reports nothing. `focus` and `click` neither start nor end it. Disposed, nothing is tracked.
- **Kind:** behaviour
- **Level:** unit (plain event targets)
- **Source:** `viewer/ui/drag.js`
- **Expected:** For each of the four endings: `input` → `dragging true`; ending → `false`, 1 end; `pointerup` again → still 1; after `dispose`, `input` → `false`. Two sliders: `input` on b, `change` on a → `false`, 1 end. For every pair of events on two sliders, `dragging` is true exactly when the latest start-or-end event was `input`.
- **Covered by:** `src/lib/ui/drag.test.ts` (R, including the pair matrix)

### UI-26 · Up and Down cross between a search field and its result rows

- **Rule:** Down or Enter in the field moves to the first row and is handled. Up and Down move between rows and stop at the last; Up from the first row returns to the field. With no rows the field keeps its keys. Keys during IME composition, modified keys and keys on a list child that is not a row are left alone. Each row stays its own Tab stop.
- **Kind:** behaviour
- **Level:** browser: focus moves
- **Source:** `viewer/ui/panels/functions.js:339-377`; `viewer/ui/panels/clinical.js:407-440`; deviation `u6-list-nav-modifier-keys.md`
- **Expected:** Rows One, Two, Three. Field Down → One; field Enter → One, `defaultPrevented`. One Down → Two → Three → Three; Up Up → One; Up → field. Empty list: field Down not handled, focus stays. `isComposing` Enter/Down → not handled. A `<select>` in the list: Down not handled. After `update` to a new field, the old field's Down does nothing and the new one's reaches One; after `destroy` nothing.
- **Covered by:** `src/lib/ui/list-nav.svelte.test.ts` (R)

### UI-27 · An opened profile starts at its top, and an opened region's name takes focus

- **Rule:** Opening a profile scrolls every scrolling ancestor to its top. A region opened from a profile has its name scrolled into view and focused; a hidden or absent name is ignored.
- **Kind:** behaviour
- **Level:** browser: layout and focus
- **Source:** `viewer/ui/panels/clinical.js:9-15, 76-95`
- **Expected:** A 50 px `overflow-y: auto` box scrolled to 100 → `scrollToTop` → 0. Visible `<h2>` → focused; hidden → not focused; `null` → no error.
- **Covered by:** `src/lib/ui/native-primitives.svelte.test.ts` (R)

## Buttons and segmented controls

### UI-28 · An icon button is a native button named by its label, its icon decorative

- **Rule:** An icon button is a `<button type="button">` whose accessible name is its label, with an SVG hidden from assistive technology and no visible text. Enter, Space and a click activate it; a disabled one is neither in the Tab order nor clickable. Disclosure and toggle states pass through.
- **Kind:** accessibility
- **Level:** browser: role, name, keyboard
- **Source:** APG Button; WCAG 4.1.2
- **Expected:** Label 'Save image' → role button named 'Save image', tag `BUTTON`, `type="button"`, svg `aria-hidden="true"` `focusable="false"`, empty text. Enter, Space, click → 3 calls. Disabled: Tab skips it, `click()` → 0 calls. `aria-expanded="true"`, `aria-controls="menu"`, `aria-pressed="false"` rendered as given.
- **Covered by:** `src/lib/ui/IconButton.svelte.test.ts` (R)

### UI-29 · The icon set draws the published shapes

- **Rule:** There are 23 icons; each draws its listed shapes at the legacy size and stroke.
- **Kind:** data
- **Level:** unit (view-model: `icons.ts` data); browser only to see one render
- **Source:** `index.html` (inline `<svg>`); `viewer/ui/chrome/button-label.js:2-9`; `viewer/diffusion/native-ui.js:15-26`
- **Expected:** `Object.keys(ICONS).length === 23`; each renders `ICONS[name].shapes.length` `path`/`circle` elements. `search`: `width="14"`, `stroke-width="2"`, path `M20 20l-3.5-3.5`, circle `r="7"`. `cut-axial` path `M4 14.5 9 9.5h11l-5 5Z`.
- **Covered by:** `src/lib/ui/IconButton.svelte.test.ts` (R, could move down); `src/lib/ui/ToggleToolbar.svelte.test.ts` (R)

### UI-30 · Targets are at least 24 × 24

- **Rule:** Every pressable primitive is at least 24 CSS px wide and tall (WCAG 2.5.8).
- **Kind:** accessibility
- **Level:** browser: layout
- **Source:** decision 0003; WCAG 2.2 SC 2.5.8
- **Expected:** IconButton, each ChoiceGroup radio, each ToggleToolbar button and the Switch: bounding box width and height ≥ 24.
- **Covered by:** `src/lib/ui/IconButton.svelte.test.ts` (R); `src/lib/ui/ChoiceGroup.svelte.test.ts` (R); `src/lib/ui/ToggleToolbar.svelte.test.ts` (R); `src/lib/ui/Switch.svelte.test.ts` (R)

### UI-31 · Forced colours and increased contrast keep a control's state visible

- **Rule:** In forced colours the chosen or expanded state is drawn with a system-colour outline or inversion; with increased contrast a segmented track gets an inset border.
- **Kind:** accessibility
- **Level:** browser: computed style under emulated media
- **Source:** `viewer/styles/a11y.css:43`; WCAG 1.4.11
- **Expected:** `forced-colors: active`: expanded IconButton `outline-style: solid`; checked ChoiceGroup radio `solid 2px`, unchecked not solid; pressed ToggleToolbar button solid, unpressed not; Switch track border colour equals the thumb's background (`CanvasText`), and when on the thumb's colour changes and the track takes the off thumb colour. `prefers-contrast: more`: radiogroup and toolbar track `box-shadow` contains `inset` (none otherwise).
- **Covered by:** `src/lib/ui/IconButton.svelte.test.ts` (R); `src/lib/ui/ChoiceGroup.svelte.test.ts` (R); `src/lib/ui/ToggleToolbar.svelte.test.ts` (R); `src/lib/ui/Switch.svelte.test.ts` (R)

### UI-32 · Every primitive is axe clean in both themes, on a desktop and a phone, in each state

- **Rule:** Each primitive, in each of its states (closed and open, off and on, collapsed and expanded, with errors shown), has no axe violations in light and dark, at 1280 × 800 and 390 × 844.
- **Kind:** accessibility
- **Level:** browser: axe-core on rendered DOM
- **Source:** WCAG 2.2 AA
- **Expected:** `violations` `[]` for: IconButton; ChoiceGroup; ToggleToolbar; Toolbar; Switch off and on; Collapsible closed and open; a roving toolbar; RangeField enabled, disabled and with a range error; Select; Disclosure; Progress determinate and indeterminate; CheckboxGroup; DrillRow, SearchBridge; StatusLine; EmptyState; the U4 set in French at 390 px in both themes; Popover open (dark); Dialog open (light and dark, 1280 and 390 px); Tooltip open (light); SearchCombobox expanded (light and dark, 1280 and 390 px); Treegrid collapsed, expanded and dark (at the default 414 px).
- **Covered by:** `src/lib/ui/IconButton.svelte.test.ts`, `ChoiceGroup.svelte.test.ts`, `ToggleToolbar.svelte.test.ts`, `Toolbar.svelte.test.ts`, `Switch.svelte.test.ts`, `Collapsible.svelte.test.ts`, `interaction.svelte.test.ts`, `native-primitives.svelte.test.ts`, `overlays.svelte.test.ts`, `SearchCombobox.svelte.test.ts`, `Treegrid.svelte.test.ts` (R each)

### UI-33 · A cheap exclusive setting is an APG radio group: arrows move and select

- **Rule:** Language, theme, single keys, hemisphere, MPR planes and tree scope are radio groups named by their label or a visible label. The checked radio is the one Tab stop; all four arrows move and select, wrapping; Tab leaves from the checked radio and Shift+Tab re-enters on it; Space and a click select; a disabled option is skipped.
- **Kind:** accessibility
- **Level:** browser: keyboard and focus
- **Source:** decision 0003; deviation `u3-segmented-controls.md`; APG Radio Group
- **Expected:** Both/Left/Right, value Left: radiogroup 'Hemisphere', checked `['Left']`, tabindex Left 0, others −1. `aria-labelledby` a span 'Show hemisphere' → group named so. From Both: Right → Left checked; Down → Right; Right → Both; Left → Right; Up → Left. Both, Right, Tab → After, Shift+Tab → Left. Axial/Coronal (disabled)/Sagittal from Axial: Right → Sagittal checked; click Axial → Axial; focus Sagittal → still Axial; Space → Sagittal.
- **Covered by:** `src/lib/ui/ChoiceGroup.svelte.test.ts` (R)

### UI-34 · A radio group busy with a load keeps focus moving but refuses a change

- **Rule:** An `aria-disabled` radio group stays focusable: arrows move focus but select nothing, and a press changes nothing.
- **Kind:** behaviour
- **Level:** browser: keyboard and focus
- **Source:** decision 34 on #4 (fix 10, A2 hand-over)
- **Expected:** No `disabled` attribute, `aria-disabled="true"`; from Both, Right → focus Left, checked still `['Both']`; `click()` on Right → `['Both']`.
- **Covered by:** `src/lib/ui/ChoiceGroup.svelte.test.ts` (R)

### UI-35 · An abbreviated option keeps a full name that contains its text

- **Rule:** An option shown as an abbreviation is named in full, and the name contains the visible text (WCAG 2.5.3).
- **Kind:** accessibility
- **Level:** browser: accessible name
- **Source:** WCAG 2.2 SC 2.5.3
- **Expected:** Radio named 'English' shows `EN`; 'Français' shows `FR`.
- **Covered by:** `src/lib/ui/ChoiceGroup.svelte.test.ts` (R)

### UI-36 · An action or an expensive choice is a toolbar of pressed buttons: arrows only move focus

- **Rule:** View presets, cut mode and paint picks are an APG toolbar of `aria-pressed` buttons, not radios. The parent decides which is pressed (or none, when a held preset ended). One Tab stop, on the pressed button until focus moves it; a click moves it too; if it becomes disabled it moves to an enabled button. Arrows (all four, handled), Home and End move focus only, skip disabled buttons and wrap; Enter, Space and a click press the focused button.
- **Kind:** accessibility
- **Level:** browser: keyboard and focus
- **Source:** decision 0003; deviation `u3-segmented-controls.md`; APG Toolbar
- **Expected:** Front (pressed)/Left/Top (disabled)/Back: toolbar 'View presets', 0 `[role=radio]`, Front `aria-pressed="true"`, Left `"false"`. Pressed `null` → all `"false"`. One stop; Right → Left → Back → Front; Left → Back; Home → Front; End → Back; 0 presses. Left: Enter → `onpress('left')`; Space → 2 calls; click Back → `'back'`. Parent switches to Back → Back `"true"`, Front `"false"`. Pressed Back → stops `[-1, -1, -1, 0]`; click Left → `[-1, 0, -1, -1]`; Left disabled while the stop → `[0, -1, -1, -1]`. Down/Up from Front → Left/Front, both `defaultPrevented`.
- **Covered by:** `src/lib/ui/ToggleToolbar.svelte.test.ts` (R)

### UI-37 · A toolbar of commands has one Tab stop, and only toggles say pressed

- **Rule:** A toolbar is named; a plain command has no `aria-pressed`, a toggle reflects its state. One Tab stop; arrows, Home and End move focus, wrapping and skipping disabled tools; Enter and Space activate; an icon-only tool is named by its label.
- **Kind:** accessibility
- **Level:** browser: keyboard and focus
- **Source:** APG Toolbar
- **Expected:** Toolbar 'Tools': Snapshot has no `aria-pressed`, Key `"false"`. From Snapshot: Right → Key → More (the disabled tool skipped) → Snapshot; Left → More; Home → Snapshot; End → More. Enter on Snapshot → `onpress('snapshot')`; Space on Key → `"true"`; Enter → `"false"`. Button 'More' is visible by name.
- **Covered by:** `src/lib/ui/Toolbar.svelte.test.ts` (R)

### UI-38 · An on/off setting is an APG switch

- **Rule:** A switch has role `switch`, is named by its visible label and carries its state in `aria-checked`. Space and Enter toggle it, a click on its label too; a disabled switch ignores the keyboard.
- **Kind:** accessibility
- **Level:** browser: keyboard
- **Source:** APG Switch
- **Expected:** 'Single-key shortcuts', checked → `aria-checked="true"`. Off: Space → `"true"`; Enter → `"false"`; click the label text → `"true"`. Disabled: `disabled` attribute, Space → stays `"false"`.
- **Covered by:** `src/lib/ui/Switch.svelte.test.ts` (R)

### UI-39 · A collapsible section is an APG disclosure

- **Rule:** The trigger is a button with `aria-expanded`; closed, the content is not exposed. Enter, Space and a click toggle it and focus stays on the trigger; `aria-controls` points at the region holding the content; it may start open.
- **Kind:** accessibility
- **Level:** browser: keyboard and visibility
- **Source:** APG Disclosure
- **Expected:** 'Provenance' closed → `aria-expanded="false"`, 'Provenance details' not visible. Enter → `"true"`, visible, the `aria-controls` element contains it; Space → `"false"`, hidden. Click → `"true"`, focus on the trigger. `open: true` → `"true"`, visible.
- **Covered by:** `src/lib/ui/Collapsible.svelte.test.ts` (R)

## Native and content primitives

### UI-40 · A slider says its value with locale, minus sign and unit, and its readout is not its name

- **Rule:** A range field's value is spoken through `aria-valuetext` in the reader's number format, and the visible readout shows the same text. The label names the slider; the readout is hidden from assistive technology, so the value is not in the name and is not announced twice.
- **Kind:** accessibility
- **Level:** browser: accessible name and ARIA attributes
- **Source:** deviation `u4-slider-readout-not-in-name.md`; APG Slider
- **Expected:** Label 'Position', value −12.5, French millimetres → slider named exactly 'Position', `aria-valuetext="−12,5 mm"` (U+2212), `<output aria-hidden="true">` text `−12,5 mm`.
- **Covered by:** `src/lib/ui/native-primitives.svelte.test.ts` (R, value text and readout; the name and `aria-hidden` are uncovered)

### UI-41 · A slider steps with the arrows and jumps with Page keys, Home and End

- **Rule:** Arrows move by one step, PageUp and PageDown by a larger step, Home and End to the limits; each move reports both input and change.
- **Kind:** behaviour
- **Level:** browser: native keyboard
- **Source:** APG Slider
- **Expected:** 0..100 step 1 at 50: Right → `oninput(51)`, `onchange(51)`; PageUp → above 52; PageDown → below that; End → 100; Home → 0.
- **Covered by:** `src/lib/ui/native-primitives.svelte.test.ts` (R)

### UI-42 · A value pushed into a focused slider waits until the reader lets go

- **Rule:** While the slider has focus, a new value from outside does not move it; it catches up on blur.
- **Kind:** behaviour
- **Level:** browser: focus
- **Source:** `viewer/ui/chrome/sections.js:450-451`
- **Expected:** At 10, Right → 11; prop set to 80 → still 11; blur → 80.
- **Covered by:** `src/lib/ui/native-primitives.svelte.test.ts` (R)

### UI-43 · The exact-value field commits a valid entry, restores an empty one and explains one out of range

- **Rule:** Enter commits a valid number and moves the slider. An emptied field restores the current value without a change. A value out of range is not applied: the field is marked invalid and described by a visible message, the typed text stays (also across Tab), and a valid entry or any slider move clears the error.
- **Kind:** accessibility
- **Level:** browser: form interaction
- **Source:** `viewer/ui/chrome/sections.js:196-202`; deviation `u4-number-field-range-error.md`; WCAG 3.3.1, 3.3.3
- **Expected:** Spinbutton 'Exact position in millimetres': `10` Enter → `onchange(10)`, slider 10; empty Enter → no new call, field `10.0`. `900` Enter → no call, `aria-invalid="true"`, `aria-describedby` the id of 'Enter a value from −128 to 128 mm.'. `900` Tab → still invalid, text `900`; `20` Enter → `aria-invalid="false"`; `900` Tab, then slider Right → `"false"`, no `.error`.
- **Covered by:** `src/lib/ui/native-primitives.svelte.test.ts` (R)

### UI-44 · A choice from a list is a native select, named by its label

- **Rule:** A select is a native `<select>` (role combobox) named by its label or by a visible `<label for>`, with an optional description; the keyboard changes its value.
- **Kind:** accessibility
- **Level:** browser: role and name
- **Source:** decision 0001 (native elements)
- **Expected:** 'Atlas', choose `b` → `onchange('b')`, tag `SELECT`. With `id="atlas"` and a `<label for="atlas">Atlas</label>`: named 'Atlas', no `aria-label`, `aria-describedby="atlas-note"`, clicking the label focuses it.
- **Covered by:** `src/lib/ui/native-primitives.svelte.test.ts` (R)

### UI-45 · Disclosure, progress, checkbox groups, drill rows and empty states are the native or button patterns

- **Rule:** A disclosure is a native `<details>` that Enter and Space toggle and whose open state survives a restyle. A progress bar is a named native `<progress>`, determinate or indeterminate. A checkbox group is a fieldset named by its legend; Tab walks the boxes, skipping a disabled one; Space toggles. Drill rows and search bridges are buttons; a drill row marks the open item `aria-current`. An empty state names the query and offers its action as a button.
- **Kind:** accessibility
- **Level:** browser: roles, names and keyboard
- **Source:** decision 0001; APG Disclosure, Button
- **Expected:** 'Method and sources': Enter → open, Space → closed, Enter → open, variant to `section` → still open. Progress 'Anatomy download' value 0.4 → `value === 0.4`; without value → no `value` attribute. 'Hemispheres': Left checked; Tab → Right, Space → `onchange(['l', 'r'])`, Tab skips 'Locked'. 'Aphasia' row: Enter, Space → 2 calls; current → `aria-current="true"`, `data-selected="true"`. '3 matches in Functions': Enter → 1 call. 'Search Functions' button → 1 call.
- **Covered by:** `src/lib/ui/native-primitives.svelte.test.ts` (R)

### UI-46 · A status line does not repeat an unchanged sentence

- **Rule:** A status line is a `status` region; setting the same sentence again changes no DOM, so nothing is re-announced; a new sentence replaces it.
- **Kind:** accessibility
- **Level:** browser: DOM mutations
- **Source:** WCAG 4.1.3
- **Expected:** '12 results' set again → no mutation records; then '3 results' → text `3 results`.
- **Covered by:** `src/lib/ui/native-primitives.svelte.test.ts` (R)

### UI-47 · Swatches are decorative, and keep their meaning in forced colours

- **Rule:** Network swatches and share bars are hidden from assistive technology (the row's text names the network); a bar's fill width is its share. In forced colours the swatch keeps its colour and the bar is a `CanvasText` fill on a `Canvas` track.
- **Kind:** accessibility
- **Level:** browser: computed style
- **Source:** `viewer/styles/detail.css:235-265`; deviation `u4-swatch-forced-colours.md`
- **Expected:** `.network-swatch` and `.network-bar` → `aria-hidden="true"`; share 0.4 → fill `width: 40%`. Forced colours: swatch `forced-color-adjust: none`; bar fill `CanvasText`, track `Canvas`.
- **Covered by:** `src/lib/ui/native-primitives.svelte.test.ts` (R, decorative and width); the forced-colour part is uncovered

### UI-48 · Progress, slider and checkbox take system colours in forced colours

- **Rule:** In forced colours the progress fill is `Highlight` on a `Canvas` track, the slider thumb has a `CanvasText` border and a focused slider a 2 px `Highlight` outline, and checkboxes keep their native appearance.
- **Kind:** accessibility
- **Level:** browser: computed style under emulated media
- **Source:** deviations `u4-progress-forced-colours.md`, `u4-range-focus-outline.md`
- **Expected:** A kept rule for `::-webkit-progress-value` with `background-color: Highlight`; thumb `border-top-color` equals `CanvasText`; checkbox `appearance: auto`; slider `:focus-visible` outline `2px solid Highlight`.
- **Covered by:** `src/lib/ui/native-primitives.svelte.test.ts` (R; the focus outline is uncovered)

## Overlays

### UI-49 · A popover opened from the keyboard appears at once; from the pointer it animates

- **Rule:** A disclosure popover (settings, data) keeps focus on its trigger, which says `aria-expanded`. Opened with Enter or Space it carries `data-instant`; opened with a click it does not.
- **Kind:** behaviour
- **Level:** browser: real keyboard and pointer
- **Source:** decision 0005; `viewer/ui/chrome/header.js:126-141`
- **Expected:** 'Settings' `aria-expanded="false"`; click → `"true"`, 'Light' present, focus on Settings, `.popover` without `data-instant`. Escape, then Enter on Settings → `data-instant` present; the same for Space.
- **Covered by:** `src/lib/ui/overlays.svelte.test.ts` (R)

### UI-50 · Escape closes a popover first, and returns focus to its trigger

- **Rule:** Escape inside an open popover closes it, returns focus to the trigger and is marked handled, so the page's Escape does not also act. With the popover closed, Escape is left to the page.
- **Kind:** behaviour
- **Level:** browser: keyboard dispatch order
- **Source:** `viewer/ui/chrome/header.js:141`; decision 0005
- **Expected:** Focus on 'Light', Escape → popover gone, `aria-expanded="false"`, focus on Settings, window saw `defaultPrevented [true]`. Closed: Escape on Settings → `[false]`.
- **Covered by:** `src/lib/ui/overlays.svelte.test.ts` (R)

### UI-51 · A popover closes when focus leaves it, and only one is open

- **Rule:** Tab out of the last control, or Shift+Tab from the trigger, closes the popover and leaves focus where Tab put it. Focus moving to another popover's trigger, or another popover opened by a command, closes this one. Focus moving to its own trigger, or a window switch, keeps it open.
- **Kind:** behaviour
- **Level:** browser: focus events
- **Source:** decision 0005 (`header.js:135-138`)
- **Expected:** Provenance, Tab → focus on 'Data', Settings `"false"`. Shift+Tab from Settings → 'Fullscreen', closed. Focus in Settings, click Data → Data `"true"`, Settings `"false"`, 'Light' gone; 'Open data' clicked inside Settings → the same. Focus back on Settings → still `"true"` after 50 ms; `focusout` with no related target → still `"true"`.
- **Covered by:** `src/lib/ui/overlays.svelte.test.ts` (R)

### UI-52 · An outside press closes a popover; a command inside closes it and returns focus

- **Rule:** A press outside closes the popover without moving focus to its trigger. A command inside closes it, returns focus to the trigger and runs.
- **Kind:** behaviour
- **Level:** browser: pointer and focus
- **Source:** decision 0005
- **Expected:** Click Fullscreen → Settings `"false"`, focus not on Settings. Click Provenance → `"false"`, focus on Settings, `#picked` reads `provenance`.
- **Covered by:** `src/lib/ui/overlays.svelte.test.ts` (R)

### UI-53 · Up and Down inside a popover stay in the popover

- **Rule:** ArrowUp and ArrowDown on a control inside a popover are marked handled, so the page does not walk the region tree; other keys are left to the control.
- **Kind:** behaviour
- **Level:** browser: keyboard dispatch
- **Source:** `viewer/ui/chrome/header.js:149`; `viewer/ui/chrome/stage-tools.js:128`
- **Expected:** On Provenance: `{ ArrowDown: true, ArrowUp: true, a: false }`. On the stage popover's 'Grid' checkbox, Down → `[true]`.
- **Covered by:** `src/lib/ui/overlays.svelte.test.ts` (R)

### UI-54 · Stage popovers focus their pressed control, fade out over 120 ms, and swap at once

- **Rule:** A stage popover moves focus to its pressed control on open, and does not take focus back once the reader moved it to the trigger. An outside press fades it out (0.12 s opacity); Escape closes it at once. A pointer press on another stage trigger swaps them with no fade, the new one `data-instant`. Tab from the last control onto the next stage trigger closes it and leaves focus there.
- **Kind:** behaviour
- **Level:** browser: focus, transitions
- **Source:** #4 U5 note ("the stage popovers keep the legacy 120 ms exit fade and instant swap"); `viewer/ui/chrome/stage-tools.js`
- **Expected:** Click 'Stage' → focus on 'Orbit'. Focus moved back to Stage on the first placement → after two frames Stage `"true"` and focused. Outside press → opacity `transitionrun` with `data-ending-style`, `transition-duration` first value `0.12s`, then removed. Escape → `"false"` and removed. Click 'Other stage' → first popover removed without a visible fade, Stage `"false"`, one popover, `data-instant`. Grid, Tab → focus on 'Other stage', Stage `"false"`.
- **Covered by:** `src/lib/ui/overlays.svelte.test.ts` (R); the stage dock itself is in `stage.md`

### UI-55 · A dialog opened from the keyboard is instant, is named by its heading and returns focus on close

- **Rule:** A modal dialog is named by its heading. Opened with Enter it is instant and Escape closes it instantly; opened and closed with the pointer it animates. Either way focus returns to the opener; with the opener gone, to the fallback target.
- **Kind:** accessibility
- **Level:** browser: native `<dialog>`, focus
- **Source:** APG Dialog (Modal); decision 0008
- **Expected:** Enter on 'Shortcuts' → `open`, `data-instant`, `aria-labelledby` the id of heading 'Keyboard shortcuts'; Escape → closed, focus on Shortcuts, still `data-instant`. Click → no `data-instant`; Close → closed, no `data-instant`, focus on Shortcuts. Opener `display: none`, Escape → focus on 'Fallback'.
- **Covered by:** `src/lib/ui/overlays.svelte.test.ts` (R)

### UI-56 · A dialog is modal: Tab never reaches the page behind

- **Rule:** While a dialog is open the page behind is inert; Tab cycles inside the dialog (and the browser's own UI).
- **Kind:** accessibility
- **Level:** browser: Tab order
- **Source:** APG Dialog (Modal); WCAG 2.4.3
- **Expected:** Six Tabs: focus is always in the dialog or on the body.
- **Covered by:** `src/lib/ui/overlays.svelte.test.ts` (R)

### UI-57 · A late close does not undo a dialog opened again

- **Rule:** A `close` event that arrives while the dialog is open is ignored, and a reopen in the frame after a close (Close button or Escape's close request) stays open.
- **Kind:** behaviour
- **Level:** browser: native `<dialog>` events
- **Source:** new `Dialog.svelte`
- **Expected:** Open, dispatch `close` → still `open` a frame later. Click Close, tick, click Shortcuts → `open` after three frames. `requestClose()`, tick, click Shortcuts → `open` after three frames.
- **Covered by:** `src/lib/ui/overlays.svelte.test.ts` (R)

### UI-58 · A dialog may keep the page's keymap out, and Escape still closes it

- **Rule:** A dialog that isolates its keys stops them from reaching the page's keymap; Escape still closes it. Without isolation the page hears its keys.
- **Kind:** behaviour
- **Level:** browser: keyboard dispatch
- **Source:** new `Dialog.svelte` (`isolateKeys`); `shortcuts.md`
- **Expected:** Isolated: 'h' and Escape inside → window saw `[]`, dialog closed. Not isolated: 'h' → `['h']`.
- **Covered by:** `src/lib/ui/overlays.svelte.test.ts` (R)

### UI-59 · A dialog fills a phone's width

- **Rule:** On a 390 px wide phone the dialog spans the full width.
- **Kind:** behaviour
- **Level:** browser: layout
- **Source:** decision 0008
- **Expected:** Viewport 390 × 844, dialog open → `getBoundingClientRect().width === 390`.
- **Covered by:** `src/lib/ui/overlays.svelte.test.ts` (R)

### UI-60 · A tooltip waits 500 ms for a hover, then the next one within 300 ms comes at once

- **Rule:** A first hover shows its tooltip after 500 ms, with its entry; leaving earlier shows nothing; moving within the trigger does not restart the wait. Once one has closed, the next within 300 ms appears at once, without its entry; after the window the wait applies again. Keyboard focus shows at once and hands over to the next focus without a gap. A dismissal hides the open one and cancels a waiting one; leaving a trigger that is not open leaves the open one.
- **Kind:** behaviour
- **Level:** unit (timing with an injected clock); browser for one end-to-end check in Chromium
- **Source:** `viewer/ui/tooltip.js:10-11, 50-80`; decision 7 on #4
- **Expected:** Delays `500` and `300`. Enter 'save', +499 → nothing, +1 → `[['save', false]]`. Enter, +200, leave, +500 → nothing. Enter, +300, enter again, +200 → shown once. Shown, leave → hidden `['save']`, +299, enter 'fullscreen' → `['fullscreen', true]`; after +300 instead → nothing until +500, then `['fullscreen', false]`. Focus 'save' → `['save', true]`; focus 'fullscreen' → hidden `['save']`, shown `['fullscreen', true]`. In Chromium with faked timers: nothing at 499 ms, 'Save a PNG' at 500 ms; the next trigger 250 ms after the close opens with `data-instant` and no timer advanced.
- **Covered by:** `src/lib/ui/tooltip.test.ts` (R); `src/lib/ui/overlays.svelte.test.ts` (R)

### UI-61 · A tooltip is dismissible, and touch shows none

- **Rule:** Escape, a press or a scroll hides the tooltip (WCAG 1.4.13). A touch pointer shows none. A trigger whose own popover is open shows none.
- **Kind:** accessibility
- **Level:** browser: real events
- **Source:** `viewer/ui/tooltip.js:147, 152, 179-182`; WCAG 2.2 SC 1.4.13
- **Expected:** Tab to 'Snapshot' → 'Save a PNG' shown; Escape → gone. Touch `pointerover` → none after 500 ms. A trigger with `aria-expanded="true"` hovered → none.
- **Covered by:** `src/lib/ui/overlays.svelte.test.ts` (R; press, scroll and the expanded-trigger case are uncovered)

### UI-62 · The pointer can cross to the tooltip and read it

- **Rule:** While the pointer travels from the trigger to the tooltip, through the box spanning both, the tooltip stays (hoverable). Beside the pair or beyond either end it closes; so does leaving the tooltip.
- **Kind:** accessibility
- **Level:** unit (geometry); browser for the real pointer path
- **Source:** deviation `u5-tooltip-grace-area.md`; WCAG 2.2 SC 1.4.13
- **Expected:** Trigger `{ left 100, top 10, right 132, bottom 42 }`, tip `{ 80, 50, 160, 74 }`: (116, 46), (110, 20), (90, 60) inside; (170, 30), (70, 30), (116, 90), (116, 5) outside. In Chromium: hover the tip → it stays; unhover → gone within 1 s.
- **Covered by:** `src/lib/ui/tooltip.test.ts` (R); `src/lib/ui/overlays.svelte.test.ts` (R)

### UI-63 · A tooltip describes its trigger only when it adds something, and only while shown

- **Rule:** A shown tooltip is added to its trigger's `aria-describedby`, once, beside existing ids, and removed when it closes. A tooltip that only repeats the trigger's name or a note already describing it is not added. Unmounting during a pending hover shows nothing and leaves no description.
- **Kind:** accessibility
- **Level:** unit (`describedBy`); browser for the attribute on a real trigger
- **Source:** `viewer/ui/tooltip.js:110-118`
- **Expected:** `(null, 'tooltip', on)` → `'tooltip'`; `('note tooltip', on)` → `'note tooltip'`; `('note tooltip', off)` → `'note'`; `('tooltip', off)` → `null`; repeats: `('note', on)` → `'note'`, `(null, on)` → `null`. Shown on 'Snapshot' → its `aria-describedby` is the tooltip's id; closed → absent. Hover, unmount at 200 ms → after 600 ms no tooltip, no `aria-describedby`.
- **Covered by:** `src/lib/ui/tooltip.test.ts` (R); `src/lib/ui/overlays.svelte.test.ts` (R)

### UI-64 · A tooltip is placed where it fits, inside the viewport and inside an open dialog

- **Rule:** The tooltip sits below its trigger, flips above where there is no room, and stays 8 px inside the viewport. For a control inside an open modal dialog (or the fullscreen element) it is drawn inside that element, so it shows above it.
- **Kind:** behaviour
- **Level:** browser: layout
- **Source:** `viewer/ui/tooltip.js:13-14`; deviation `u5-tooltip-container.md`
- **Expected:** Trigger fixed at `bottom: 4px` → `tip.bottom ≤ trigger.top`. Trigger at `right: 0` → `tip.right ≤ clientWidth − 8 (+0.5)` and `> clientWidth − 40`. Hint inside the open dialog → the dialog contains the tooltip.
- **Covered by:** `src/lib/ui/overlays.svelte.test.ts` (R; the fullscreen container is uncovered)

## Search combobox

### UI-65 · A region search is an APG combobox: focus stays in the field, the first usable result is armed

- **Rule:** The field is a combobox with list autocomplete; focus stays in it and `aria-activedescendant` names the armed option. Every new result set arms its first enabled option, so Enter works from the first keystroke. Up and Down arm the previous or next enabled option and stop at the ends; with only disabled options nothing is armed and nothing fails. The armed option is `aria-selected`; the option for what is current elsewhere is `aria-current`, independently.
- **Kind:** accessibility
- **Level:** browser: ARIA and keyboard (the next-enabled index is unit, in `core-panels.md`)
- **Source:** `viewer/ui/panels/navigator.js:44-54, 452-461, 642`; decision 34 on #4; deviation `a2-active-option-selected.md`
- **Expected:** 'h' → Hippocampus (disabled), Hypothalamus, Thalamus (current): armed Hypothalamus; states `[['Hippocampus', null, 'false'], ['Hypothalamus', null, 'true'], ['Thalamus', 'true', 'false']]`. Down → Thalamus; Down → Thalamus; Up → Hypothalamus; Up → Hypothalamus; focus on the field. `move(1)`/`move(-1)` from outside arm the same way. 'hippo' → Down, Up, Enter: no error, no `aria-activedescendant`.
- **Covered by:** `src/lib/ui/SearchCombobox.svelte.test.ts` (R)

### UI-66 · Enter or a click chooses the armed option and keeps the search

- **Rule:** Enter chooses the armed option; the field keeps the typed text, focus and the open list, and the armed option survives Enter and a Tab out and back, so Down moves on from it. A click chooses an option; a disabled option does nothing.
- **Kind:** behaviour
- **Level:** browser: keyboard and pointer
- **Source:** `viewer/ui/panels/navigator.js:452-461`
- **Expected:** 'am' → armed Amygdala; Enter → picks `['amygdala']`, value `am`, focus in field, `aria-expanded="true"`. 'h', Enter → `['hypothalamus']`, Down → Thalamus. 'h', Tab, Shift+Tab, Down → Thalamus. Click Thalamus → `['thalamus']`; click Hippocampus (disabled) → `[]`.
- **Covered by:** `src/lib/ui/SearchCombobox.svelte.test.ts` (R)

### UI-67 · Escape empties the search first, and is the page's once the field is empty

- **Rule:** Escape in a filled field empties it and is marked handled; in an empty field it is left to the page. During IME composition it is not handled and the text and armed option stay. Escape elsewhere is not taken by the search, and a modal dialog still closes on Escape while results show.
- **Kind:** behaviour
- **Level:** browser: keyboard dispatch
- **Source:** decision 34 on #4
- **Expected:** 'am', Escape → value `''`, `defaultPrevented true`; Escape again → `false`. Composing Escape → not prevented, value `am`, expanded, armed Amygdala. Focus on 'Switch atlas', Escape → `[false]`, value `h`. An open modal `<dialog>`, Escape → closed.
- **Covered by:** `src/lib/ui/SearchCombobox.svelte.test.ts` (R)

### UI-68 · Clear empties and refocuses the field; the / hint shows only while it is empty

- **Rule:** The clear button empties the field, returns focus to it and disappears. The `/` shortcut hint shows only while the field is empty, and never when single-key shortcuts are off.
- **Kind:** behaviour
- **Level:** browser: focus and rendering
- **Source:** `viewer/ui/panels/navigator.js`
- **Expected:** 'am', click 'Clear search' → value `''`, focus in field, no 'Clear search' button. Empty → `/` shown; 'a' → gone. `showShortcut: false` → no `kbd`.
- **Covered by:** `src/lib/ui/SearchCombobox.svelte.test.ts` (R)

### UI-69 · Only options are in the list; the count is said once typing pauses

- **Rule:** The listbox (named) holds only option groups; notes and their buttons sit after it. The result sentence is said 500 ms after typing pauses (UI-19), and again after a clear. With no match the list collapses (no `aria-expanded`, no armed option) and the no-match note shows. The field controls the listbox.
- **Kind:** accessibility
- **Level:** browser: ARIA structure (timing is UI-19, unit)
- **Source:** `viewer/ui/panels/navigator.js:412`; decision 37 on #4
- **Expected:** 'h': listbox 'Matching regions' does not contain 'Switch atlas'; every child has `role="group"`; region `''` at once, `3 matches.` after the pause; Escape, region cleared, 'h' → `3 matches.` again. 'zzz' → 'No match for zzz.', `aria-expanded="false"`, no `aria-activedescendant`. `aria-controls` equals the listbox id.
- **Covered by:** `src/lib/ui/SearchCombobox.svelte.test.ts` (R)

### UI-70 · The armed option stays in view

- **Rule:** New results bring the armed option to the top of the scroller; arrow moves bring it in by the nearest edge.
- **Kind:** behaviour
- **Level:** browser: layout
- **Source:** `viewer/ui/panels/navigator.js`
- **Expected:** Tall list, 'h' → Hypothalamus top gap 0 px (rounded); Down → Thalamus bottom gap 0; Up → Hypothalamus top gap 0.
- **Covered by:** `src/lib/ui/SearchCombobox.svelte.test.ts` (R)

## Treegrid

### UI-71 · Only rows under an open parent are in view, each with its level and place among its siblings

- **Rule:** Children are shown only while their parent is expanded; an expanded row under a collapsed ancestor stays hidden. Each row has its level (1-based), its position and the size of its sibling set; only parents are expandable. Expand all is the set of every parent at every depth.
- **Kind:** behaviour
- **Level:** unit; browser for the rendered `aria-*` attributes
- **Source:** `viewer/ui/panels/navigator.js`; decision 0002
- **Expected:** Tree `a (a1, a2 (a2x)), b`: none open → `[a, b]`; `{a}` → `[a, a1, a2, b]`; `{a, a2}` → `[a, a1, a2, a2x, b]`; `{a2}` → `[a, b]`. With `{a}`: `[level, posinset, setsize, parent]` = `[1,1,2,null], [2,1,2,a], [2,2,2,a], [1,2,2,null]`; a expandable and expanded, a2 expandable not expanded, a1 not expandable. Expand all → `{a, a2}`. Rendered: Insula `aria-level="1"`, `aria-posinset="2"`, `aria-setsize="3"`, no `aria-expanded`; Frontal open → Postcentral level 2, 2 of 2.
- **Covered by:** `src/lib/ui/treegrid.test.ts` (R); `src/lib/ui/Treegrid.svelte.test.ts` (R)

### UI-72 · Keys on a row follow the APG treegrid

- **Rule:** Down and Up move to the next and previous visible row and stop at the ends; Home and End go to the first and last row. Right expands a collapsed parent (focus stays) and otherwise goes to the row's first cell; Left collapses an expanded parent and otherwise goes to the parent row. Enter and Space activate the row and select it. `*` expands every sibling parent. V toggles the row's visibility without selecting. Other keys are not the grid's.
- **Kind:** accessibility
- **Level:** unit (key-to-action table); browser: focus moves
- **Source:** `viewer/ui/panels/navigator.js:10-36`; decision 0002; deviation `u7-treegrid-keys.md`
- **Expected:** `rowKeyAction`: Down `next`, Up `previous`, Home `first`, End `last`, Enter and Space `activate`, Right `expand` on a collapsed parent and `firstCell` otherwise, Left `collapse` on an expanded parent and `parent` otherwise, `*` `expandSiblings`, `v` and Escape `null`. Moves stay inside: next from 2 of 3 → 2; previous from 0 → 0. Rendered Frontal/Insula/Limbic: Up on Frontal stays; Down → Insula; Down Down → Limbic; End → Limbic; Home → Frontal. Enter, Space on Insula → `['activate insula', 'activate insula']`, Insula `aria-selected="true"`. `*` on Frontal → Frontal and Limbic expanded. V on Insula → its eye reads `off`, no activation.
- **Covered by:** `src/lib/ui/treegrid.test.ts` (R); `src/lib/ui/Treegrid.svelte.test.ts` (R)

### UI-73 · Keys in a cell walk the row's controls and keep the column across rows

- **Rule:** Right and Left move between the row's usable cells, skipping empty and disabled cells; Right on the last stays; Left from the first, and Escape, return to the row. Up and Down go to the same column in the adjacent row, or its nearest usable cell, or the row itself when it has none. Home and End go to the first and last cell; Ctrl+Home and Ctrl+End to the first and last row (its nearest cell, or the row). Enter and Space press the cell's button; V toggles visibility in a cell too.
- **Kind:** accessibility
- **Level:** unit (key-to-action table); browser: focus moves
- **Source:** decision 0002; deviation `u7-treegrid-keys.md`
- **Expected:** `cellKeyAction`: Right `nextCell` (last: `null`), Left `previousCell` (first: `row`), Escape `row`, Down `next`, Up `previous`, Home/End `firstCell`/`lastCell`, with Ctrl `first`/`last`; Enter, Space, `v` → `null`. Rendered Insula: Right → cell 0, Right → cell 1, Right stays, Left → 0, Left → row. Frontal cell 1, Down → Precentral cell 1, Up Up → Frontal cell 1. Ctrl+End from Insula's cell → Limbic cell 0; Ctrl+Home → Frontal cell 0. Wide grid: Precentral's eye disabled and side empty → Right Right stays on cell 0; Cingulate cell 2, Up → Limbic cell 1. Blank grid: from Insula's cell, Down → row 'rule'; Ctrl+Home → row 'top'. Enter in Insula cell 0 → `['select insula']`; Space on cell 1 → `off`; V → `on`.
- **Covered by:** `src/lib/ui/treegrid.test.ts` (R); `src/lib/ui/Treegrid.svelte.test.ts` (R)

### UI-74 · Typing a name finds the row, and shortcut keys still work

- **Rule:** On a row, a printable character (not Space or `*`, without Ctrl, Alt or Meta) moves to the next row whose label starts with it, case-insensitive and wrapping; more characters within 500 ms refine the query; a repeated single letter cycles; no match leaves focus. A shortcut key (V) acts when no query is being typed, and extends a query that is. Keys the page lists as its own are left to the page unless a query is under way.
- **Kind:** behaviour
- **Level:** unit (match and key tests); browser: the 500 ms query window and focus
- **Source:** APG Tree View type-ahead; deviation `u7-treegrid-keys.md`; decision 7 (conductor) on #4
- **Expected:** Labels Frontal, Insula, Limbic, Lateral, Occipital: `(0, 'o') → 4`; `(4, 'f') → 0`; `(2, 'LI') → 2`; `(0, 'la') → 3`; `(2, 'l') → 3`; `(2, 'll') → 3`; `(3, 'l') → 2`; `(0, 'z') → -1`. `isTypeAheadKey`: `a`, `A` true; Space, `*`, `Enter`, Ctrl+`a` false. Rendered: Frontal, 'i' → Insula; after 500 ms 'l' → Limbic. Frontal open, 'po' → Postcentral. V on Insula keeps focus. `passKeys {i, n}`: 'i' reaches the window, focus stays on Frontal; `{n}`: 'i' → Insula then 'n' is not passed; 'l' → Limbic.
- **Covered by:** `src/lib/ui/treegrid.test.ts` (R); `src/lib/ui/Treegrid.svelte.test.ts` (R)

### UI-75 · The grid is one Tab stop: the focused row or cell, else the selected row, else the first

- **Rule:** The grid has one Tab stop, which follows focus and stays unique; Tab leaves the grid and Shift+Tab returns to the stop. Before focus enters, the stop is the selected row, else the first. A selection made outside the grid moves the stop; focus inside is not taken by it.
- **Kind:** accessibility
- **Level:** browser: Tab order
- **Source:** decision 0002; `viewer/ui/panels/navigator.js:224-239`
- **Expected:** Stops `[Frontal]`; Before, Tab → Frontal; Tab → After; Shift+Tab → Frontal. Down → stops `[Insula]`; Right → `[Insula cell 0]`. Selected Insula → `[Insula]`, Tab from Before → Insula. Outside 'select insula' → `[Insula]`; focus Limbic → `[Limbic]`.
- **Covered by:** `src/lib/ui/Treegrid.svelte.test.ts` (R)

### UI-76 · Focus survives the grid changing around it

- **Rule:** When the focused row leaves the view (its parent collapsed by keyboard or pointer), focus and the stop go to the nearest ancestor still shown, else the first row. A button replaced in place keeps focus on its cell. A change elsewhere leaves focus on its row. A grid rebuilt while the reader is outside it leaves focus where it is.
- **Kind:** behaviour
- **Level:** unit (`survivingRowId`); browser: real focus
- **Source:** `viewer/ui/panels/navigator.js:224-239`
- **Expected:** `survivingRowId`: a1 shown → `a1`; a2x with nothing open → `a`; with `{a}` → `a2`; `gone` or `null` → `a`; empty grid → `null`. Rendered: focus Precentral, collapse Frontal (keys or the pointer toggle) → focus and stop on Frontal. Enter on Insula's eye → the new eye button focused and the stop. Focus Limbic, click Insula's eye → focus on Limbic. Tab out to After, click Collapse all → focus stays on Collapse all.
- **Covered by:** `src/lib/ui/treegrid.test.ts` (R); `src/lib/ui/Treegrid.svelte.test.ts` (R)

### UI-77 · The grid's structure names the rows, not their cells

- **Rule:** The grid is `role="treegrid"` with a name; rows are `role="row"` with their own names (not the text of their cells); `aria-expanded` is on parents only; `aria-selected` is on selectable rows only, never on group rows; each control sits in its own `gridcell`. A disabled node is `aria-disabled` and takes no hover wash. A top-level row and its open children share one block with no role.
- **Kind:** accessibility
- **Level:** browser: ARIA and computed style
- **Source:** decision 0002; deviations `u7-treegrid.md`, `r2-aria-disabled-rows.md`; WCAG 4.1.2
- **Expected:** Treegrid 'Anatomy', rows Frontal, Insula, Limbic; Frontal and Limbic `aria-expanded="false"`, Insula none; Insula has 2 gridcells. Row names 'Frontal, 2 regions' and 'Insula'. Selected Insula → `aria-selected` `[null, 'true', null]`; all open → `[null, 'false', 'false', 'true', null, 'false']`. Row 'rule' `aria-disabled="true"`, its background unchanged on hover, Insula's changes. Frontal's block has no `role` and holds Precentral, not Insula.
- **Covered by:** `src/lib/ui/Treegrid.svelte.test.ts` (R; the block case is I: it pins the class `treegrid-block`)
