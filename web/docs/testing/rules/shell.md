# App shell rules

Scope: chunk H1a (#38), the app shell. It covers `web/index.html` (head metadata, the pre-paint theme and language script, the `<noscript>` notice, the mount point and the live region), the four landmarks and their order, the layout grid of `src/app/layout.css`, the region slots and `App.svelte`'s `data-status` cascade. Legacy sources: the root `index.html:1-104, 592-597, 698-701`, `viewer/styles/layout.css:1-12, 202-225`, `viewer/styles/phone.css:30-61`, `viewer/ui/chrome/chrome.contract.test.js:68, 305`. New code: `web/index.html`, `web/src/app/App.svelte`, `web/src/app/layout.css`, `web/src/app/regions/*.svelte` (empty slots today; what fills them is in `regions.md`). Deviations: `h1a-theme-flash.md`, `h1a-html-lang.md`, `h1a-skip-link.md`. Decisions 2, 13 and 18 on #4, conductor decision 6 (comment 39).

The inline script in `web/index.html` is the theme and language script (decision 2). The F3 asset prefetch is not in `web/index.html`: the build injects it (BUILD-06, BUILD-07 in `boot-and-assets.md`), and ASSET-16–ASSET-21 cover what it fetches. `src/app/head-script.test.ts` tests only the theme and language script, so its rules are here. The skip link itself is the masthead's (MAST-01); the shell owns its target and the region order. Theme tokens: `--rail-width` 360 px (320 px at 801–1000 px), `--header-height` `max(48px, 3rem)`, `--footer-height` `max(32px, 2rem)` (45 px on a coarse pointer, COLO-06). The phone query is `(max-width: 800px), (max-height: 480px) and (orientation: landscape)`.

## Landmarks and order

### SHELL-01 · One banner, one panel, one stage and one status bar, in that order, and no navigation landmark

- **Rule:** The page has exactly one `banner`, one `complementary`, one `main` and one `contentinfo` landmark, in that document order. There is no `navigation` landmark: the mode tabs are a tablist, not a set of links. The panels inside the one `aside` are tabpanels or sections, never nested asides.
- **Kind:** accessibility
- **Level:** browser: landmark roles in the DOM
- **Source:** `index.html:96, 225, 319, 426, 592`; decision 13 on #4 (this overrides the #38 issue text, which listed a `nav`)
- **Expected:** element order `HEADER, ASIDE, MAIN, FOOTER`; `getByRole` count 1 each for `banner`, `complementary`, `main`, `contentinfo`; 0 `nav`. Legacy has 0 `complementary`, because its asides carry `role=tabpanel`.
- **Covered by:** `src/app/App.svelte.test.ts` (R, with stub masthead and footer snippets); `e2e/parity/shell.spec.ts` "one banner, main and contentinfo" (R; `next` gated off)

### SHELL-02 · The panel landmark is named in the reader's language

- **Rule:** The one complementary landmark has an accessible name in the interface language.
- **Kind:** accessibility
- **Level:** browser: accessible name of a landmark
- **Source:** comment 38 item 1 on #4 (`workspace.panelAria`)
- **Expected:** `en` → "Atlas panel"; `fr` → "Panneau de l’atlas".
- **Covered by:** `src/app/App.svelte.test.ts` (R, French); `src/app/boot.svelte.test.ts` (R, BOOT-12); `e2e/parity/shell.spec.ts` (R, English; `next` gated off)

### SHELL-03 · The masthead and status slots add no element of their own

- **Rule:** The masthead and status regions render what is composed into them and add no wrapper element. The masthead feature renders the only `banner` and the colophon the only `contentinfo`, so composing them can never nest two landmarks or repeat an id. An empty slot renders nothing.
- **Kind:** accessibility
- **Level:** browser: DOM structure
- **Source:** conductor decision 6 (comment 39 on #4); `index.html:96, 592`
- **Expected:** with snippets `<header id="masthead">` and `<footer id="colophon">`: `document.querySelectorAll('header').length === 1`, and the same for `footer`. They are direct children of `#app`. Without snippets: no `header` and no `footer` in `#app`.
- **Covered by:** `src/app/App.svelte.test.ts` (R for the counts with stub snippets; the empty-slot case is uncovered)

### SHELL-04 · The masthead comes first, then the panel, then the stage

- **Rule:** In reading and Tab order the masthead comes first, then the panel, then the stage (WCAG 1.3.2, 2.4.3).
- **Kind:** accessibility
- **Level:** browser: real Tab order
- **Source:** `viewer/ui/chrome/chrome.contract.test.js:68`; `index.html:96, 225-426`
- **Expected:** a button appended to each of `header`, `aside` and `main`. Three Tabs from the start of the document focus them in that order. `header.compareDocumentPosition(main)` and `aside.compareDocumentPosition(main)` both include `DOCUMENT_POSITION_FOLLOWING`.
- **Covered by:** `src/app/App.svelte.test.ts` (R); `e2e/parity/shell.spec.ts` "panel before the stage" and "the masthead is first" (R; `next` gated off)

### SHELL-05 · The stage can take focus but is not a Tab stop

- **Rule:** The stage landmark is the skip link's target. It can take focus from script and from the `#viewport` anchor (when no canvas can take focus: loading, error), but it is never a Tab stop of its own.
- **Kind:** accessibility
- **Level:** browser: focus
- **Source:** deviation `h1a-skip-link.md`; comment 38 item 2 on #4; legacy `index.html:426` (no tabindex)
- **Expected:** `main#viewport` has `tabIndex === -1`. `main.focus()` makes it `document.activeElement`. Tabbing through the page never lands on `main` itself.
- **Covered by:** `src/app/App.svelte.test.ts` (R); `e2e/parity/shell.spec.ts` "main can take focus" (R; `next` gated off)

## Layout

### SHELL-06 · Desktop grid: masthead across, panel beside the stage, status bar across

- **Rule:** On a wide window the shell is a full-height grid: a masthead row, then the panel column beside the stage, then the status-bar row. Header and footer are pinned to their rows, so an empty slot cannot move the stage. Changing the panel's content does not resize the stage.
- **Kind:** behaviour
- **Level:** browser: layout/CSS
- **Source:** `viewer/styles/layout.css:1-12, 222-225`
- **Expected:** at 1280×800 with a fine pointer, `#app` is 800 px tall. Columns `360px 920px`; rows 48 px, 720 px, 32 px. `aside` is column 1, row 2; `main` is column 2, row 2 at top = 48 px; `header` spans row 1 and `footer` row 3. At 900×800 the rail is 320 px. Without a header snippet, `main` still starts at 48 px.
- **Covered by:** uncovered (no test reads the desktop grid)

### SHELL-07 · On a phone the shell is a fixed one-column frame

- **Rule:** Under the phone query the shell is one column: the masthead, then the stage filling the rest. The sheet overlays the stage, the panel's own box disappears (`display: contents`) and the status bar is hidden. The frame never scrolls: only the panel inside the sheet does.
- **Kind:** behaviour
- **Level:** browser: layout/CSS
- **Source:** `viewer/styles/phone.css:30-61`
- **Expected:** at 390×844: `footer` `display: none`; `aside` `display: contents`; `#app` has one column, rows `auto 1fr` and `overflow: hidden`; `main` is column 1, row 2; `documentElement.scrollWidth − clientWidth = 0`. The same holds at 812×375 (landscape ≤ 480 px tall).
- **Covered by:** `src/app/App.svelte.test.ts` (R, only the `footer` and `aside` display values at 390 px); `e2e/parity/shell.spec.ts` "a phone has no contentinfo" (R; `next` gated off)

### SHELL-08 · The frame fits both phone orientations and 320×256

- **Rule:** With every region composed, the page fits the window in both orientations and at 320×256 CSS px (WCAG 1.3.4, 1.4.10). Nothing scrolls the page, and the stage stays inside the window with a non-zero height.
- **Kind:** accessibility
- **Level:** e2e: needs the composed page (masthead, sheet, stage); a browser test mounting every region with the fake engine would also prove it
- **Source:** WCAG 2.2 SC 1.3.4, 1.4.10; `viewer/styles/phone.css:30-45`
- **Expected:** for 812×375, 375×812 and 320×256: overflowX 0, overflowY 0, `main` left ≥ 0, right ≤ clientWidth, bottom ≤ clientHeight, height > 0; no `contentinfo`.
- **Covered by:** `e2e/parity/shell.spec.ts` "fits the frame" ×3 (R; `next` gated off)

### SHELL-09 · Before the anatomy arrives the panel shows a skeleton, not the inspector

- **Rule:** While the app is loading or failed to start there is nothing to inspect. The inspector is hidden, and the empty tree shows a skeleton of ten rows under the band the tabs will fill, so nothing jumps when they arrive.
- **Kind:** behaviour
- **Level:** browser: CSS computed style
- **Source:** `viewer/styles/layout.css:202-221`; comment 50 item 3 on #4 (the skeleton should be an `aria-hidden` element, not `#tree:empty`: I1 is changing it, deviation `i1-loading-skeleton.md` pending in PR #134)
- **Expected:** `data-status="loading"` → `#inspector` `display: none`; an empty `#tree` is `10 × --row-height` tall. `data-status="error"` → `#inspector` `display: none`. `ready` → `#inspector` shown. On desktop the panel's top padding is 0 while loading or failed.
- **Covered by:** uncovered

## Status

### SHELL-10 · The app root carries the session status

- **Rule:** `#app` carries `data-status`, which is `loading` in the static HTML and then follows the session status. The rest of the page styles itself from it.
- **Kind:** behaviour
- **Level:** browser: a DOM attribute set by the component
- **Source:** `index.html:95`; `viewer/app.js:1623`
- **Expected:** static HTML `<div id="app" data-status="loading">`; mounted → `loading`; then `ready`, `switching`, `error`, `context-lost` as the status changes.
- **Covered by:** `src/app/App.svelte.test.ts` (R); `src/app/boot.svelte.test.ts` (R, BOOT-12); `e2e/parity/shell.spec.ts` "#app carries a known data-status" (W: accepts any of the five values; `next` gated off)

## Before the app loads

### SHELL-11 · The first paint has the reader's theme

- **Rule:** Before the first paint, a saved `light` or `dark` choice wins. Any other saved value, or none, follows the system's `prefers-color-scheme`. A dark reader never sees a light flash.
- **Kind:** behaviour
- **Level:** unit for the resolution (the script run in a VM); e2e for "before the app's script" on the built page
- **Source:** deviation `h1a-theme-flash.md`; decision 2 on #4; comment 18 item 1 (key `planum.theme`). Legacy `index.html:2` ships `data-theme="light"`.
- **Expected:** stored nothing, `''`, `'system'` or `'Dark'` → `light` with a light system and `dark` with a dark one. Stored `light` with a dark system → `light`; stored `dark` with a light system → `dark`. With the app's scripts blocked and a dark scheme → `<html data-theme="dark">`.
- **Covered by:** `src/app/head-script.test.ts` (R; its oracle is the app's own `resolveTheme`, so a literal table of the values above would also name the rule); `e2e/parity/shell.spec.ts` "the first frame has the system theme", "a saved theme wins over the system" (R; `next` gated off)

### SHELL-12 · The browser chrome takes the theme's surface colour

- **Rule:** The `theme-color` meta follows the first-paint theme with the theme's base surface colour. The static HTML ships the light value.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `index.html:26`; `web/src/styles/tokens.css` `--surface-base`
- **Expected:** light → `#ffffff`; dark → `#1b1e21`; static `<meta name="theme-color" content="#ffffff" />`.
- **Covered by:** `src/app/head-script.test.ts` (R, read from `tokens.css`); `e2e/parity/shell.spec.ts` (R, dark only; `next` gated off)

### SHELL-13 · The page language is right before the first paint

- **Rule:** Before any text is painted, `<html lang>` is the link's `lang` when the link names it once as `en` or `fr`. Otherwise it is the saved `planum-lang` when that is `fr`, and otherwise `en`. A `lang` repeated in the link decides nothing, as in link decoding.
- **Kind:** accessibility
- **Level:** unit (the script run in a VM); e2e for the built page
- **Source:** deviation `h1a-html-lang.md`; WCAG 2.2 SC 3.1.1; comment 18 item 2
- **Expected:** `#lang=fr` → `fr`; `#tab=functions&lang=fr` → `fr`; `#lang=en` with `fr` saved → `en`; `#lang=de` with `fr` saved → `fr`; `#lang=` with nothing saved → `en`; `#lang=fr&lang=en` with nothing saved → `en`, with `fr` saved → `fr`; no hash with `de` saved → `en`. With the app's scripts blocked, `#lang=fr` → `fr`, and no hash with `planum-lang=fr` saved → `fr`.
- **Covered by:** `src/app/head-script.test.ts` (R; the oracle is `startLanguage(decodeState(hash).state.lang, saved)`); `e2e/parity/shell.spec.ts` "<html lang> follows the link and the saved choice" (R; `next` gated off)

### SHELL-14 · Blocked site data does not stop the first paint

- **Rule:** When reading `localStorage` throws (site data blocked), the head script still applies the system theme and the link's language.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `web/index.html` head script (`try`/`catch` around storage)
- **Expected:** storage throws `SecurityError`, system dark, `#lang=fr` → `data-theme="dark"`, `lang="fr"`.
- **Covered by:** `src/app/head-script.test.ts` (R)

### SHELL-15 · The live region exists before the app

- **Rule:** The polite live region is in the initial HTML, empty, so it exists before the first message is spoken.
- **Kind:** accessibility
- **Level:** unit (read `index.html`)
- **Source:** decision 18 on #4; `index.html:700`
- **Expected:** `<p id="announcer" role="status" aria-live="polite" class="visually-hidden"></p>` after `#app` in `<body>`.
- **Covered by:** uncovered (attaching to it is U2's, in `state.md`)

### SHELL-16 · Without scripts the page says what it is and where the data lives

- **Rule:** With scripts off, the page shows a plain English notice: what Planum is, that it needs JavaScript for WebGL 2, and a link to the published anatomy index.
- **Kind:** behaviour
- **Level:** unit (read `index.html`); e2e with JavaScript disabled for "it is shown"
- **Source:** `index.html:77-94`; comment 38 item 4 (the relative links 404 under the preview base but resolve under the live one)
- **Expected:** `<noscript>` holds `<h1>Planum</h1>`, the text "it needs JavaScript enabled" and `<a href="models/anatomies.json">`.
- **Covered by:** uncovered

### SHELL-17 · Shares name the published site

- **Rule:** The head carries the share metadata of the published site, with absolute URLs, so a shared link renders as a card.
- **Kind:** hygiene
- **Level:** unit (read `index.html`)
- **Source:** `index.html:5-26`
- **Expected:** `<title>Planum</title>`; `link[rel=canonical]` and `og:url` = `https://joshuaduq.github.io/neuroatlas/`; `og:image` = `https://joshuaduq.github.io/neuroatlas/preview.png`, 1200×630, with a non-empty `og:image:alt`; `twitter:card` = `summary_large_image`; `og:site_name` = `Planum`. The `og:description` counts ("148 Destrieux regions, 360 HCP-MMP areas, 483 histological labels") are a data claim. It has not been checked against the published manifest, whose `regions` list has 150 `destrieux`, 362 `hcp-mmp` and 514 `nextbrain` entries, unknown and medial-wall entries included.
- **Covered by:** uncovered (BUILD-09 covers `lang` and the title only)

## Accessibility

### SHELL-18 · The shell passes axe

- **Rule:** The shell has no axe violations (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`) in either theme, on desktop or a phone, in English or French.
- **Kind:** accessibility
- **Level:** browser for the shell alone; e2e for the whole loaded page (BUILD-10)
- **Source:** #4 parity proof ("`next` must have zero axe violations")
- **Expected:** zero violations at 1280×800 and 390×844, light and dark.
- **Covered by:** `src/app/App.svelte.test.ts` (R, English only); `e2e/parity/shell.spec.ts` "the shell passes axe" (legacy baseline) and the 8-case theme × width × language matrix (R; `next` gated off)
