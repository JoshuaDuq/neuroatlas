# Boot and assets rules

Scope: how Planum starts, what it shows while it loads or when it cannot start, how it fetches and
verifies the published files, how the service worker keeps them across visits, and what the build
must publish. Chunks F0 (scaffold, `build/site.test.ts`, `test/*`), F3 (assets, asset cache, head
prefetch, service worker), H1b (boot screen, WebGL check, `StageStatus`), I3a (start sequence in
`src/app/`) and F4 (e2e harness). Legacy read: `viewer/main.js`, the boot part of `viewer/app.js`
(93-212, 2081-2132), `viewer/state/lifecycle.js`, `viewer/ui/chrome/viewport-chrome.js:63-83, 763-781`,
`viewer/i18n/errors.js`, `viewer/model/{asset-cache,published-assets,published-files,published-anatomy}.js`,
`viewer/comparison/assets.js`, `viewer/diffusion/assets.js`, `viewer/service-worker.js`, the root
`vite.config.js`, `scripts/published-version.mjs` and the head script of the root `index.html:27-69`.
Failure wording itself (`startFailure`, `failureNotice`) is I18N-16 to I18N-19 (`core-i18n.md`);
link decoding is STATE-01 to STATE-17 (`core-state.md`) and the link notice I18N-20; the keymap is
KEY- (`controller.md`); the head theme script (`index.html`'s pre-paint script,
`src/app/head-script.test.ts`) is SHELL-11 to SHELL-14 (`shell.md`).
The start-sequence rules (BOOT-05 to BOOT-11, BOOT-13 to BOOT-19, BOOT-30, BOOT-31) are plain
logic; today `src/app/boot.svelte.test.ts` checks them in the browser because `startApp` reads the
document, `location`, `history` and `window` directly.

## Capability check

### BOOT-01 · WebGL 2 is required

- **Rule:** A browser that gives no WebGL 2 context, or throws when asked for one, gets the capability failure and the engine is never opened.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/main.js:24-41, 82-84`
- **Expected:** `getContext('webgl2')` returns null or throws → `missingWebgl()` = `'webgl2'`; stage text starts "This viewer needs WebGL 2, which this browser or device does not provide." (fr "Cette visionneuse nécessite WebGL 2, …"); `createEngine` is not called; status `error`.
- **Covered by:** `src/app/webgl-check.test.ts` (R), `src/app/boot.svelte.test.ts` (R), `e2e/parity/boot.spec.ts` (R; `next` gated off)

### BOOT-02 · Floating-point render targets are required

- **Rule:** A WebGL 2 context without `EXT_color_buffer_float` gets its own capability failure, since the frame is drawn into half-float targets.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/main.js:38-40`; `viewer/i18n/translations.js:507`
- **Expected:** extension missing → `'floatTargets'`; text starts "This viewer needs WebGL 2 with floating-point render targets"; no Retry.
- **Covered by:** `src/app/webgl-check.test.ts` (R), `e2e/parity/boot.spec.ts` (R; `next` gated off)

### BOOT-03 · The capability probe frees its context

- **Rule:** The probe's own WebGL context is released straight away, whether or not the check passes.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/main.js:39`
- **Expected:** `WEBGL_lose_context.loseContext()` called exactly once for a complete context and for one missing float targets.
- **Covered by:** `src/app/webgl-check.test.ts` (R)

### BOOT-04 · The capability failure screen

- **Rule:** A capability failure is shown and announced once in the reader's language, sets the page language and the error status, and offers no Retry (reloading cannot help).
- **Kind:** behaviour
- **Level:** browser — shown text, announcer and `<html lang>` in the DOM
- **Source:** `viewer/main.js:43-52, 82-84`; deviation `h1b-webgl-failure-theme.md` (themed screen), `h1b-single-failure-announcement.md`
- **Expected:** `#announcer` text = the shown text; no button named "Retry"/"Réessayer"; `#app[data-status=error]`; `<html lang>` = link or saved language; `app.failure = { text }` with no button.
- **Covered by:** `e2e/parity/boot.spec.ts` (R; `next` gated off), `src/app/boot.svelte.test.ts` (R), `src/features/stage/StageStatus.svelte.test.ts` (R)

## Start sequence

### BOOT-05 · Which anatomy opens

- **Rule:** A link that names a published anatomy opens it; no anatomy in the link opens the index default; an unpublished one opens the default and the link notice names the anatomy field as not applied.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:91-108`; `viewer/model/published-anatomy.js:9-15`
- **Expected:** index `{default: 'snail', anatomies: [snail, aomic]}`: none → `snail`, `aomic` → `aomic`; `#anatomy=nobody` → manifest `…/models/<default>/manifest.json` and notice `notApplied(anatomy)`; `resolveAnatomy` with `'missing'`, `''`, `null`, `1` throws "Unknown anatomy".
- **Covered by:** `src/lib/core/assets/published-anatomy.test.ts` (R), `src/app/boot.svelte.test.ts` (R)

### BOOT-06 · The index must name a published default

- **Rule:** An index whose default is not among its anatomies, or an index that cannot be fetched, fails the start; no other subject is substituted.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/published-anatomy.js:9-15`; `viewer/main.js:90-92`
- **Expected:** `default: 'missing'` → throws "Unknown anatomy"; HTTP 503 → `asset-fetch` with `status: 503`; network TypeError → `asset-fetch` with that `cause`.
- **Covered by:** `src/lib/core/assets/published-anatomy.test.ts` (R)

### BOOT-07 · An unknown layer in a link falls back to the defaults

- **Rule:** When the link names an atlas or detail level this anatomy does not publish, the start retries once with the defaults and the notice names the field; any other error fails the start without a second attempt.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:172-190`
- **Expected:** `#atlas=nonexistent&detail=learning` → engine opened with `('nonexistent','learning')` then `(undefined, undefined)`; status `ready`; notice `notApplied(atlas)`. An `asset-fetch` error → engine opened once, status `error`.
- **Covered by:** `src/app/boot.svelte.test.ts` (R)

### BOOT-08 · The opening view

- **Rule:** The camera is framed on the oblique view (with the dock in place) before the link is applied, the link is applied while the stage still says loading, and only then does the stage become ready.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:2111-2124`
- **Expected:** `#view=left` → views applied in order `oblique` (status `loading`), `left` (status `loading`); final status `ready`, view `left`.
- **Covered by:** `src/app/boot.svelte.test.ts` (R for the status per view; I: also pins `setFramingSource` as the first camera call and the region mount order)

### BOOT-09 · A link's restore reaches the panels and is announced

- **Rule:** Stated once as LINK-14 (`links.md`), LINK-19 (`links.md`); this entry only points there, so the rule is tested once.
- **Kind:** behaviour
- **Level:** see LINK-14, LINK-19
- **Source:** see LINK-14, LINK-19
- **Expected:** see LINK-14, LINK-19
- **Covered by:** see LINK-14, LINK-19

### BOOT-10 · Download progress during the start

- **Rule:** The stage shows the download's progress while the start runs; once the start has failed, a late progress event does not paint "Loading" back over the error.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:161-171, 183-184`
- **Expected:** progress `{loaded: 1, total: 4}` → status `loading` with that progress; after the failure, `{loaded: 2, total: 4}` leaves status `error`.
- **Covered by:** `src/app/boot.svelte.test.ts` (R)

### BOOT-11 · The other atlas is fetched ahead

- **Rule:** Once the first atlas is on screen, the other cortical atlas is fetched in idle time, when the quality profile and connection allow it; a failed prefetch only warns.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:68-78, 2131`
- **Expected:** default start on `cdmd` with prefetch allowed → exactly one `prefetchLayer('hcp-mmp')`.
- **Covered by:** `src/app/boot.svelte.test.ts` (R); the allow/deny decision → STATE-62, `src/lib/core/state/boot.test.ts`

### BOOT-12 · The page exposes the stage status

- **Rule:** The app root carries the session status (`loading`, `ready`, `error`, `context-lost`) and the shell follows the reader's language.
- **Kind:** behaviour
- **Level:** browser — `data-status` and `aria-label` on the mounted shell
- **Source:** `viewer/main.js:45`; `viewer/app.js:60-61`
- **Expected:** mounted shell starts `data-status="loading"`; after `ready` and French, `data-status="ready"` and the panel's `aria-label` is the French text.
- **Covered by:** `src/app/boot.svelte.test.ts` (R), `e2e/parity/boot.spec.ts` (R; `next` gated off)

### BOOT-30 · A command the reader starts overtakes a link still being applied

- **Rule:** Every controller (anatomy, excursions and lessons, links) counts its scene commands on one shared counter, so a command started while a link is still being applied wins, and the link stops without applying the rest.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:216` (one `commands` for every closure), `2013-2015`
- **Expected:** link restore of `{view: 'right'}` started, then `commands.begin()`, `openCircuit(<first circuit>)` or `setSpinalCordVisible(false)` → the restore resolves `null`.
- **Covered by:** `src/app/boot.svelte.test.ts` (R, three cases)

## Start failures

### BOOT-13 · A failed download

- **Rule:** A start that fails on a download says so with Retry, and leaves nothing running.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/main.js:54-60, 90-92`; `viewer/app.js:183-189`; `viewer/i18n/errors.js:34-40`
- **Expected:** `asset-fetch` → text "Could not load the anatomy. A file could not be downloaded. Check the connection and try again." (fr "Impossible de charger l’anatomie. …"), button "Retry", `dropLink: false`, no progress bar, no world.
- **Covered by:** `src/app/boot.svelte.test.ts` (R), `e2e/parity/boot.spec.ts` (R; `next` gated off), `src/features/stage/StageStatus.svelte.test.ts` (R)

### BOOT-14 · A failed start from a link

- **Rule:** On a page opened from a link, a start failure that is not a download failure says the link failed, and Retry opens Planum without the link.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/i18n/errors.js:34-42`; `viewer/main.js:56-58`
- **Expected:** `#view=left` + renderer error → text contains "Retry opens Planum without this link.", `dropLink: true`; clicking Retry empties `location.hash`, then reloads.
- **Covered by:** `src/app/boot.svelte.test.ts` (R), `src/features/stage/StageStatus.svelte.test.ts` (R), `e2e/parity/boot.spec.ts` (R; `next` gated off)

### BOOT-15 · A newer deploy asks for a reload

- **Rule:** When a downloaded file no longer matches what the page was built for, the reader is told Planum was updated and offered Reload.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/i18n/errors.js:12-13, 37-39`; `viewer/i18n/translations.js:501-503`
- **Expected:** `asset-updated` → "Planum was updated. Reload to continue." with button "Reload".
- **Covered by:** `src/features/stage/StageStatus.svelte.test.ts` (R, fixture text only); the mapping from the error code → I18N-16 and I18N-19 (`core-i18n.md`). No start-level test drives an `asset-updated` error.

### BOOT-16 · Retry and Reload drop the stored anatomy

- **Rule:** Retry or Reload deletes only the stored model caches and reloads, so a bad stored copy cannot fail the same way again; a browser that blocks Cache Storage still reloads.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/published-assets.js:47-56`
- **Expected:** caches `['planum-models', 'other']` → only `planum-models` deleted, one reload; `SecurityError` from `caches.keys()` → one reload; any other error surfaces and does not reload (new behaviour; legacy swallowed every error, no deviation record). Enter and Space on Retry both trigger it, and keep the hash unless `dropLink`.
- **Covered by:** `src/lib/core/assets/published-assets.test.ts` (R), `src/features/stage/StageStatus.svelte.test.ts` (R)

### BOOT-17 · A failure after the engine opened releases it

- **Rule:** A start that fails after the engine opened disposes it and shows the failure in the language the page was in.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:2113-2119`
- **Expected:** `#lang=fr` and a build without neuropsych domains → engine disposed, no world, status `error`, button "Réessayer".
- **Covered by:** `src/app/boot.svelte.test.ts` (R)

### BOOT-31 · A download the model starts by itself that fails is told

- **Rule:** After the start, a download the model starts on its own (the white-matter envelopes, when hiding the cortex first exposes white matter) that fails is told as a notice; the app keeps running.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:2097-2103`; `viewer/i18n/translations.js:518`
- **Expected:** `loadError` with an `asset-fetch` error → notice text contains "Could not show the white matter beneath the hidden cortex."; status stays `ready`. An `asset-updated` error → "Planum was updated. Reload to continue." with action `reload` (wording: core-i18n area).
- **Covered by:** `src/app/boot.svelte.test.ts` (R, the `asset-fetch` text only); the status and the `asset-updated` case are uncovered at this level

## Page lifecycle

### BOOT-18 · Back-forward cache keeps the app

- **Rule:** A page kept for browser Back keeps its running app; the app is disposed once, when the page finally goes.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/lifecycle.js:1-8`
- **Expected:** `pagehide{persisted: true}` → 0 disposals; then two `pagehide{persisted: false}` → 1 disposal; engine disposed only on the second kind.
- **Covered by:** `src/app/lifecycle.test.ts` (R), `src/app/boot.svelte.test.ts` (R)

### BOOT-19 · Teardown leaves nothing bound

- **Rule:** Disposing the app unmounts the regions before the engine goes, and removes the keymap and the `hashchange` listener.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:2134-2168`
- **Expected:** at region teardown the engine is not yet disposed; after `dispose()`, pressing C changes nothing and `removeEventListener('hashchange', handler)` was called with the bound handler.
- **Covered by:** `src/app/boot.svelte.test.ts` (R for the keymap; I for order and listener spies)

### BOOT-20 · Commands to an unmounted region fail loudly

- **Rule:** A controller command sent before its region is mounted, or after it unmounted, throws an error naming the command; a question answers no until a region answers it; unmounting a region withdraws only its own ports.
- **Kind:** behaviour
- **Level:** unit
- **Source:** new composition root (no legacy equivalent; project fail-fast rule)
- **Expected:** `showDetail()` unmounted → throws `/showDetail/`; `mprOpen()` → `false` until registered; withdrawing the first of two `showList` registrations leaves the second called once.
- **Covered by:** `src/app/ports.test.ts` (I)

## Stage status

### BOOT-21 · Loading without a known size

- **Rule:** While the anatomy loads with no known total, the stage says "Loading anatomy…" with no bar and no Retry.
- **Kind:** behaviour
- **Level:** unit (view-model)
- **Source:** `viewer/ui/chrome/viewport-chrome.js:68-78, 778-781`
- **Expected:** text "Loading anatomy…" (fr "Chargement de l’anatomie…"); no `progress`; total 0 removes a shown bar.
- **Covered by:** `src/features/stage/StageStatus.svelte.test.ts` (R), `e2e/parity/boot.spec.ts` (R; `next` gated off)

### BOOT-22 · The download bar

- **Rule:** With a known total, the stage shows a determinate bar named "Anatomy download" at the rounded percent, and the line gives loaded and total megabytes in the reader's notation.
- **Kind:** behaviour
- **Level:** unit (view-model)
- **Source:** `viewer/ui/chrome/viewport-chrome.js:68-83`; deviation `c1-loading-megabytes.md`
- **Expected:** 12.3 MiB of 45.6 MiB → bar value 27, max 100, text contains "12.3" and "45.6"; fr 1 MiB of 4 MiB → bar "Téléchargement de l’anatomie", text contains "1,0"; a slow real download's value increases.
- **Covered by:** `src/features/stage/StageStatus.svelte.test.ts` (R), `e2e/parity/boot.spec.ts` (R; `next` gated off)

### BOOT-23 · What the stage announces

- **Rule:** The stage announces the start of the load, its end and a failure, once each and with the text shown; it never announces a progress event, and leaves the lost-context announcement to the speech layer.
- **Kind:** behaviour
- **Level:** unit (view-model)
- **Source:** `viewer/app.js:97-99, 2128`; deviation `h1b-single-failure-announcement.md`
- **Expected:** start → "Loading anatomy…" (even when a total is already known); 4 progress events → no announcer mutation; ready → "Anatomy loaded."; error → the failure text; context lost → stage announces "".
- **Covered by:** `src/features/stage/StageStatus.svelte.test.ts` (R), `e2e/parity/boot.spec.ts` (R; `next` gated off)

### BOOT-24 · The error screen

- **Rule:** An error shows its failure text with its button; an error with no failure says "Something went wrong." with Retry; a capability failure has no button.
- **Kind:** behaviour
- **Level:** unit (view-model)
- **Source:** `viewer/ui/chrome/viewport-chrome.js:769-775`; `viewer/main.js:48-51`
- **Expected:** as stated; no progress bar on any error.
- **Covered by:** `src/features/stage/StageStatus.svelte.test.ts` (R)

### BOOT-25 · A lost graphics context

- **Rule:** When the graphics context is lost the stage says the view was interrupted and is restoring, with no Retry and no bar, keeps the dark scene in both themes, and disappears when the context returns.
- **Kind:** behaviour
- **Level:** browser — computed stage background in the light theme
- **Source:** `viewer/app.js:118-120`; `viewer/ui/chrome/viewport-chrome.js:763-767`; deviation `h1b-webgl-failure-theme.md` (context lost not covered)
- **Expected:** "The 3D view was interrupted by the graphics driver. Restoring…"; light theme stage background `rgb(14, 17, 22)`; `webglcontextrestored` → `data-status="ready"`, announcer "Anatomy loaded.".
- **Covered by:** `src/features/stage/StageStatus.svelte.test.ts` (R), `src/app/boot.svelte.test.ts` (R), `e2e/parity/boot.spec.ts` (R; `next` gated off)

### BOOT-26 · Focus around the stage status

- **Rule:** When the status hides the focused control, focus moves to Retry (error) or the message (context lost) and returns to the control when the stage is ready again; otherwise focus is not touched, and never taken at boot.
- **Kind:** behaviour
- **Level:** browser — focus moves
- **Source:** deviation `h1b-focus-hidden-controls.md`
- **Expected:** dock focused → context lost → message focused → ready → dock focused; error → Retry focused; an unhidden control keeps focus; at boot focus stays on `body`; Retry is the Tab stop after the hidden dock.
- **Covered by:** `src/features/stage/StageStatus.svelte.test.ts` (R)

### BOOT-27 · Themed, legible boot screens

- **Rule:** The loading and failure screens follow the page theme, the bar's track and fill and the focus ring each reach 3:1, and forced colours keep the message and bar visible.
- **Kind:** behaviour
- **Level:** browser — computed colours, forced colours
- **Source:** deviations `h1b-webgl-failure-theme.md` (decisions 3 and 18 on #4), `h1b-progress-track-contrast.md`
- **Expected:** light and dark: track/surface, fill/surface, fill/track ≥ 3:1; ring/stage ≥ 3:1 on loading, error and context-lost; forced colours: message colour = stage colour, bar visible.
- **Covered by:** `src/features/stage/StageStatus.svelte.test.ts` (R; the increased-contrast case is W), `e2e/parity/boot.spec.ts` (R; `next` gated off)

### BOOT-28 · Retry stays usable on every screen

- **Rule:** Retry is at least 24 px (44 px under a coarse pointer), stays on screen at 320 px width and on a short landscape phone, sits in the upper part of a phone stage, and keeps its label inside under 200 % text and WCAG 1.4.12 spacing.
- **Kind:** behaviour
- **Level:** browser — layout/geometry
- **Source:** H1b decision record (#39); WCAG 2.2 SC 2.5.8, 1.4.10, 1.4.12
- **Expected:** height ≥ 24; coarse ≥ 44×44; 320×256: no horizontal scroll, button within [0, 320]; 390×844: bottom < 337.6; 800×400: within [0, 400]; label box inside button.
- **Covered by:** `src/features/stage/StageStatus.svelte.test.ts` (R)

### BOOT-29 · The boot screens pass axe

- **Rule:** Loading, download failure, capability failure and context lost are axe-clean in light and dark, desktop and phone, English and French.
- **Kind:** behaviour
- **Level:** browser — axe
- **Source:** H1b decision record (#39)
- **Expected:** zero axe violations.
- **Covered by:** `src/features/stage/StageStatus.svelte.test.ts` (R), `e2e/parity/boot.spec.ts` (R; `next` gated off)

## Published assets

### ASSET-01 · Each published file is fetched at its own version, revalidated

- **Rule:** Every published file is requested as `<path>?v=<its version>`, the first 16 hex digits of its SHA-256, with `cache: 'no-cache'` and high priority, so a deploy re-downloads only what changed and a stale HTTP cache cannot fail the checksum.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/published-assets.js:15-28`; `scripts/published-version.mjs:10-19`
- **Expected:** records `learning.glb → aaaa`, `manifest.json → bbbb` → `…/learning.glb?v=aaaa`, `…/manifest.json?v=bbbb`, options `{cache: 'no-cache', priority: 'high'}`; diffusion `brain.nii.gz` → `?v=<record.version>`.
- **Covered by:** `src/lib/core/assets/published-assets.test.ts` (R), `src/lib/core/assets/asset-cache.test.ts` (R), `src/lib/core/assets/diffusion-assets.test.ts` (R)

### ASSET-02 · An unpublished file is refused before any request

- **Rule:** Asking for a file the build did not publish fails at once, naming the file, and sends nothing.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/published-assets.js:23-32`
- **Expected:** empty map, `…/missing.glb` → throws `asset-fetch` with message matching `missing.glb`; `fetch` not called.
- **Covered by:** `src/lib/core/assets/published-assets.test.ts` (R)

### ASSET-03 · Without a published map requests go unversioned

- **Rule:** With no published map (Node tests, an embedder's bundler) requests go out unversioned and unverified.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/published-files.js:1-7`
- **Expected:** `…/learning.glb` → fetched as `…/learning.glb`.
- **Covered by:** `src/lib/core/assets/published-assets.test.ts` (R)

### ASSET-04 · Bytes from another deploy are an update, not data

- **Rule:** Downloaded bytes whose SHA-256 differs from the published record fail as `asset-updated`, never as a data error.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/asset-cache.js:69-71`
- **Expected:** published 6 bytes 1..6, server sends six 9s → rejects `{code: 'asset-updated'}`; matching bytes pass through unchanged.
- **Covered by:** `src/lib/core/assets/asset-cache.test.ts` (R)

### ASSET-05 · A `.gz` decoded in transit is checked against its contents

- **Rule:** A `.gz` file a server sends with `Content-Encoding: gzip` arrives decoded, and is checked against the recorded hash and size of its contents.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/asset-cache.js:61-63`; `scripts/published-version.mjs:20-25`
- **Expected:** raw gzip bytes → pass; decoded 30 bytes with `Content-Encoding` → pass, last progress `{30, 30}`; decoded 29 bytes → `asset-updated`.
- **Covered by:** `src/lib/core/assets/asset-cache.test.ts` (R)

### ASSET-06 · Failed downloads carry their cause

- **Rule:** An HTTP failure rejects as `asset-fetch` with its status; a network failure rejects as `asset-fetch` with the original error as cause and no status.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/asset-cache.js:56-68`
- **Expected:** 503 → `{code: 'asset-fetch', status: 503}`; `TypeError('Failed to fetch')` → `{code: 'asset-fetch', cause}`; diffusion 404 → message names `missing.trk.gz`.
- **Covered by:** `src/lib/core/assets/asset-cache.test.ts` (R), `src/lib/core/assets/diffusion-assets.test.ts` (R), `src/lib/core/assets/comparison-assets.test.ts` (R)

### ASSET-07 · One download per file at a time

- **Rule:** Concurrent requests for the same file share one download, and every caller hears its progress.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/asset-cache.js:3-11, 75-91`
- **Expected:** two calls for `a.glb` → 1 fetch, both get 8 bytes, both last progress `{loaded: 8, total: 8}`.
- **Covered by:** `src/lib/core/assets/asset-cache.test.ts` (R)

### ASSET-08 · Progress counts decoded bytes

- **Rule:** The progress total is the published decoded size; `Content-Length` is only a fallback and never used under `Content-Encoding`, so the bar never passes 100 %.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/asset-cache.js:18-48`
- **Expected:** published 40 bytes, gzip `Content-Length: 12` → every event `total = 40`, `loaded ≤ 40`; unpublished, same headers → exactly `[{loaded: 40, total: 40}]`.
- **Covered by:** `src/lib/core/assets/asset-cache.test.ts` (R; mutation-checked)

### ASSET-09 · The app takes over the head script's downloads

- **Rule:** A file the head script already started is taken from it, not fetched a second time.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/asset-cache.js:86-88`
- **Expected:** `__planumAssets['…/b.glb']` set → 4 bytes returned, `fetch` not called, entry removed.
- **Covered by:** `src/lib/core/assets/asset-cache.test.ts` (R)

### ASSET-10 · Published files come from the site root

- **Rule:** The anatomy index, manifests and diffusion files are read from `/neuroatlas/`, the published root, wherever the page itself is served (the preview lives at `/neuroatlas/next/`).
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:102`; `viewer/diffusion/assets.js:3-6` (legacy used the app base, which was the root)
- **Expected:** manifest URL `/neuroatlas/models/cdmd/manifest.json`; with `location` `…/neuroatlas/next/`, `readDiffusionAsset('snail-subject-1/t1.nii.gz').url` = `/neuroatlas/diffusion/snail-subject-1/t1.nii.gz`.
- **Covered by:** `src/app/boot.svelte.test.ts` (R), `src/lib/core/assets/diffusion-assets.test.ts` (R)

### ASSET-11 · The anatomy index request

- **Rule:** The anatomy index is requested revalidated and at high priority.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/model/published-anatomy.js:3-6`; `viewer/model/published-assets.js:15`
- **Expected:** request options `{cache: 'no-cache', priority: 'high'}`; body parsed as JSON.
- **Covered by:** `src/lib/core/assets/published-anatomy.test.ts` (R)

### ASSET-12 · Atlas-comparison files are verified against their own checksum

- **Rule:** Comparison JSON and geometry need a 64-hex SHA-256 before any request, must hash to it, and are not cached once loaded; a malformed JSON or a failing digest surfaces as the original error.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/comparison/assets.js:4-21`
- **Expected:** checksum `undefined`, `null`, `''`, `'wrong'`, `'z'×64` → throws /SHA-256/, no fetch; changed bytes → `asset-updated` /checksum mismatch/; validly hashed `{invalid` → `SyntaxError`; two loads → two fetches.
- **Covered by:** `src/lib/core/assets/comparison-assets.test.ts` (R)

### ASSET-13 · The published comparison data matches its checksums

- **Rule:** The published cdmd atlas-comparison JSON and geometry hash to the SHA-256 their manifest and JSON declare, the JSON names its anatomy, and the geometry is a GLB.
- **Kind:** data
- **Level:** unit
- **Source:** `public/models/cdmd/manifest.json` (`atlas_comparison`)
- **Expected:** `anatomy_id` = `manifest.anatomy.id`; geometry's first uint32 (LE) = `0x46546c67` ("glTF").
- **Covered by:** `src/lib/core/assets/comparison-assets.test.ts` (S)

### ASSET-14 · Published index default matches the configuration

- **Rule:** The published index lists its own default, and that default is the anatomy `config/model.yaml` builds.
- **Kind:** data
- **Level:** unit
- **Source:** `public/models/anatomies.json`; `config/model.yaml`
- **Expected:** `anatomies[].id` contains `default`; `model.yaml.anatomy` = `default`.
- **Covered by:** `test/repo.test.ts` (H, incidental)

### ASSET-15 · Every published request on the real page is versioned

- **Rule:** On the served site, every request under `models/` or `diffusion/` carries the version the build published for that file.
- **Kind:** behaviour
- **Level:** e2e — every request the served page makes
- **Source:** `viewer/model/published-assets.js:19-28`
- **Expected:** for each request, `?v=` = `publishedRecord(public, path).version`.
- **Covered by:** `e2e/parity/harness.spec.ts` (R, runs on `next`)

## Head prefetch

### ASSET-16 · The head script starts the first frame's files

- **Rule:** Before the app's code has parsed, the head script starts the index, the brain's manifest, one cortical atlas and one detail level, each from the published root at its published version, revalidated and at high priority.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `index.html:34-60`
- **Expected:** atlas `hcp-mmp` → `cortex-hcp-mmp.glb`, anything else → `cortex-destrieux.glb`; detail `aseg` → `structures.glb`, `nextbrain` → `nextbrain.glb`, else `learning.glb`; `#anatomy=bert&atlas=hcp-mmp&detail=nextbrain` → exactly `…/neuroatlas/models/anatomies.json?v=index0000000000a`, `…/bert/cortex-hcp-mmp.glb?v=hcp0000000000000`, `…/bert/manifest.json?v=manifest00000000`, `…/bert/nextbrain.glb?v=fine000000000000`, keyed on `__planumAssets` by the plain URL; all under `/neuroatlas/`.
- **Covered by:** `parity/F3.test.ts` (R)

### ASSET-17 · The brain to prefetch

- **Rule:** The head script prefetches the brain the link names, or else the index's default once the index has arrived.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `index.html:53-67`
- **Expected:** empty hash, index `{"default":"bert"}` → 4 requests including `/neuroatlas/models/bert/manifest.json`.
- **Covered by:** `parity/F3.test.ts` (R; plus an I source-regex case)

### ASSET-18 · The index is handed over only after the brain has started

- **Rule:** With no anatomy in the link, the app receives the index only after the default brain's files have started, so the manifest is never fetched twice; an index that does not parse or names no brain is still handed over for the app to report.
- **Kind:** behaviour
- **Level:** unit
- **Source:** deviation `k4-prefetch-index-after-warm.md`; `index.html:61-67`
- **Expected:** `{"default":"bert"}` → index resolves `ok` with the manifest already requested; `not json` or `null` → the index text unchanged, 1 request.
- **Covered by:** `parity/F3.test.ts` (R)

### ASSET-19 · No envelopes or cord for the first frame

- **Rule:** The head script does not start the tissue envelopes or the spinal cord; the model fetches those when first needed.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `index.html:27-33`
- **Expected:** no request for `manifest.solid_envelopes.file` or any `supplemental_layers[].file`.
- **Covered by:** `parity/F3.test.ts` (I: source text, not a run of the script)

### ASSET-20 · The prefetch names only what the manifest publishes

- **Rule:** Every file name the head script can request is published by the default manifest, and every atlas and detail level a link can name has a prefetch entry.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `index.html:38-39`; `public/models/<default>/manifest.json`
- **Expected:** each quoted `.glb` in the script ∈ atlases ∪ detail levels ∪ supplemental layers; each atlas file and detail level id is present.
- **Covered by:** `parity/F3.test.ts` (I: source regex)

### ASSET-21 · Each prefetched file is requested once on the real page

- **Rule:** On the served site, the index, manifest, default atlas and default detail level are each requested exactly once, at their current version.
- **Kind:** behaviour
- **Level:** e2e — request count on the served page
- **Source:** `index.html:46-52`; `viewer/model/asset-cache.js:86-88`
- **Expected:** for each of `models/anatomies.json`, `models/<default>/manifest.json`, `…/cortex-destrieux.glb`, `…/learning.glb`: exactly `[<root><file>?v=<version>]`.
- **Covered by:** `e2e/parity/harness.spec.ts` (R, runs on `next`)

## Service worker

### SW-01 · Registration

- **Rule:** In a built site with service-worker support, the app registers `<app base>sw.js` scoped to the app base, only after a successful start; a failed registration is warned about, and development or unsupported browsers register nothing.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/main.js:62-76, 86-89`
- **Expected:** `register('${BASE_URL}sw.js', {scope: BASE_URL})`; `PROD=false` or no `navigator.serviceWorker` → not called; rejection → `console.warn('Service worker registration failed:', error)`.
- **Covered by:** `src/boot/keep-cached.test.ts` (R); "only after a successful start" → uncovered (tests run with `PROD=false`, and `e2e/parity/harness.spec.ts` registers the worker itself)

### SW-02 · Store once, serve after

- **Rule:** The first request for this deploy's version of a published file is fetched and stored; later requests are served from storage.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/service-worker.js:70-91`
- **Expected:** two requests for `cortex-destrieux.glb?v=<current>` → 1 network fetch, second body `bytes:models/bert/cortex-destrieux.glb`; manifest and diffusion `.trk.gz` stored too.
- **Covered by:** `parity/F3.test.ts` (R)

### SW-03 · Only current published files are intercepted

- **Rule:** The worker answers only same-origin GET requests for the version of a published file this deploy publishes; the page, scripts, other versions, unpublished files, other origins and non-GET requests pass through untouched.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/service-worker.js:22-32, 56-68`
- **Expected:** unversioned, `?v=previousdeploy00`, `unpublished.glb?v=1`, `assets/index-abc.js`, `elsewhere.test`, POST → not answered, 0 fetches.
- **Covered by:** `parity/F3.test.ts` (R)

### SW-04 · A bad download is never stored

- **Rule:** A failed, partial or mismatched response is passed to the page but never stored.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/service-worker.js:77-88`
- **Expected:** 502, 206, 200 with bytes of another deploy → nothing stored; then a good 200 → 1 entry.
- **Covered by:** `parity/F3.test.ts` (R)

### SW-05 · A decoded `.gz` is stored by its contents' hash

- **Rule:** A `.gz` file the server decodes on the way is stored when its contents hash to the published contents version.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/service-worker.js:84-86`
- **Expected:** `gunzipped[path] = version('decoded tract')`, server sends `decoded tract` → 1 entry.
- **Covered by:** `parity/F3.test.ts` (R)

### SW-06 · A new deploy deletes only what it no longer publishes

- **Rule:** On activation the worker deletes stored files the deploy no longer publishes and the pre-rename `neuroatlas-models*` caches, keeps everything else, and takes control of open pages.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/service-worker.js:41-54`
- **Expected:** stored `cortex-destrieux` (unchanged) and `structures` (changed) → only `cortex-destrieux` kept; caches left: `planum-models`, `something-else`; `clients.claim()` called.
- **Covered by:** `parity/F3.test.ts` (R)

### SW-07 · A new worker takes over immediately

- **Rule:** A newly installed worker activates without waiting for every tab to close.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/service-worker.js:39`
- **Expected:** `install` → `skipWaiting()` called.
- **Covered by:** `parity/F3.test.ts` (R)

### SW-08 · Filling the store revalidates

- **Rule:** The worker fetches a file to store with `cache: 'no-cache'`, so the HTTP cache cannot hand it bytes from before the deploy.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/service-worker.js:75-76`
- **Expected:** first fetch options `cache = 'no-cache'`.
- **Covered by:** `parity/F3.test.ts` (R)

### SW-09 · The page itself is always revalidated

- **Rule:** Navigations always go to the network with `cache: 'no-cache'`; a redirected answer or a network failure falls back to the browser's own request. The site does not work offline.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/service-worker.js:59-66`
- **Expected:** navigate `/neuroatlas/` → one fetch of that URL with `no-cache`; redirected → second `fetch(request)`; rejected → `fetch(request)`.
- **Covered by:** `parity/F3.test.ts` (R, no-cache only); redirect and failure fallbacks uncovered

### SW-10 · A second visit is served by the worker

- **Rule:** On the served site the built worker registers in the app's scope, stores a published file once its bytes match, and serves it on the next visit.
- **Kind:** behaviour
- **Level:** e2e — a real service worker across a reload
- **Source:** `viewer/service-worker.js`; `vite.config.js:84-90`
- **Expected:** `serviceWorker.ready.scope` = base URL; `planum-models` holds `models/anatomies.json?v=<version>`; after reload that response is `fromServiceWorker()`; controller script `<base>sw.js`.
- **Covered by:** `e2e/parity/harness.spec.ts` (R, runs on `next`)

## Build output

### BUILD-01 · Site paths

- **Rule:** The live site and the development server serve from `/neuroatlas/`; `build:preview` publishes under `/neuroatlas/next/`.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `vite.config.js:9`
- **Expected:** `siteBase('development')` = `siteBase('production')` = `/neuroatlas/`; `siteBase('preview')` = `/neuroatlas/next/`.
- **Covered by:** `build/site.test.ts` (H; compares with the module's own `ASSET_BASE`/`PREVIEW_BASE`, not the literal paths), `parity/F3.test.ts` (R, `ASSET_BASE` = `/neuroatlas/`)

### BUILD-02 · The preview does not republish the data

- **Rule:** The preview build leaves the published models and diffusion data out, since the live site already serves them; the production build copies them.
- **Kind:** behaviour
- **Level:** unit
- **Source:** new (`web/vite.config.ts`); preview deploy
- **Expected:** `copyPublicDir` = `false` for mode `preview`, `true` for `production`.
- **Covered by:** `parity/F3.test.ts` (H)

### BUILD-03 · Only the preview is hidden from search

- **Rule:** The preview's raw HTML carries `<meta name="robots" content="noindex">`; the live site has no robots meta.
- **Kind:** behaviour
- **Level:** unit
- **Source:** new (`web/vite.config.ts` `preview-noindex`)
- **Expected:** as stated, in the HTTP response body for the preview.
- **Covered by:** `e2e/parity/harness.spec.ts` (R; the preview half runs on `next`, the live half on `legacy` only). Could move down to unit: the `preview-noindex` hook, as `parity/F3.test.ts` calls the prefetch hook.

### BUILD-04 · Three.js and the BVH index in their own chunks

- **Rule:** Three.js core and `three-mesh-bvh` are built into their own `three` and `bvh` chunks, so a chrome-only deploy does not re-download them.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `vite.config.js:31-41`
- **Expected:** chunk `three` contains `WebGLRenderer`; chunk `bvh` contains `MeshBVH`.
- **Covered by:** `parity/F3.test.ts` (H)

### BUILD-05 · The version maps the build writes

- **Rule:** The build writes `sw.js` beside the bundle with `{base, files, gunzipped}`: each published file's version (first 16 hex of its SHA-256), and for each `.gz` the first 16 hex of its contents' SHA-256; the head script gets the `models/` versions only.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `vite.config.js:13-24, 63-65, 84-90`; `scripts/published-version.mjs:10-45`
- **Expected:** keys exactly `base`, `files`, `gunzipped`; `base` = `/neuroatlas/`; head map non-empty with every key starting `models/`; `sw.js` contains `planum-models`.
- **Covered by:** `parity/F3.test.ts` (D for the map contents; H for `sw.js` written beside the bundle); `e2e/parity/harness.spec.ts` (R, end to end, versions only). Contents hashing of `.gz` → D only.

### BUILD-06 · Charset first, prefetch before the stylesheet

- **Rule:** The built page declares its charset within the first 1024 bytes, and the prefetch script comes before the stylesheet link.
- **Kind:** behaviour
- **Level:** unit
- **Source:** HTML Standard 4.2.5.4; `index.html:4, 34`
- **Expected:** first 1024 bytes contain `<meta charset="UTF-8"`; index of `window.__planumAssets` < index of `rel="stylesheet"`.
- **Covered by:** `parity/F3.test.ts` (H)

### BUILD-07 · The prefetch script is inlined with its values

- **Rule:** The build injects the prefetch script inline into `<head>` with the published root and versions written in.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `vite.config.js:63-65`
- **Expected:** one `script` tag, `injectTo: 'head'`, no `__PUBLISHED_VERSIONS__` or `__ASSET_BASE__` left.
- **Covered by:** `parity/F3.test.ts` (H)

### BUILD-08 · Development reloads on a rebuilt asset

- **Rule:** In development, adding, changing or removing a file under `public/models` or `public/diffusion` updates its version and reloads the page; other events and files are ignored.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `vite.config.js:66-78`
- **Expected:** `change`/`unlink`/`add` of `models/anatomies.json` → full reload each time and the map gains/loses the entry; `addDir` or `robots.txt` → no reload; both trees are watched.
- **Covered by:** `parity/F3.test.ts` (R 2, I 1)

### BUILD-09 · Page language and title

- **Rule:** The page declares `lang="en"` and the title "Planum" when opened without a language.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `index.html:2, 7`
- **Expected:** as stated.
- **Covered by:** `e2e/parity/harness.spec.ts` (R, runs on `next`); could move down to unit (a read of `index.html`).

### BUILD-10 · The page frame passes axe

- **Rule:** The loaded page has no axe violations on `next` (legacy recorded as a baseline).
- **Kind:** behaviour
- **Level:** e2e — axe on the built, loaded page
- **Source:** `web/parity/README.md` (browser parity)
- **Expected:** zero violations on `next`.
- **Covered by:** `e2e/parity/harness.spec.ts` (R, runs on `next`)

### BUILD-11 · No triple-slash type references

- **Rule:** No source file under `src/` or `parity/` carries a `/// <reference types|lib=…>` directive.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `web/tsconfig*.json` split
- **Expected:** offender list empty.
- **Covered by:** `test/no-triple-slash.test.ts` (H)

### BUILD-12 · Repository helpers read the data-contract files

- **Rule:** `repoRoot` ends with `/`, and `readRepoJson`/`readRepoYaml` read `public/` and `config/` files.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `web/test/repo.ts`
- **Expected:** as stated.
- **Covered by:** `test/repo.test.ts` (H)

### BUILD-13 · The test browser can draw what the renderer needs

- **Rule:** The headless test browser gives WebGL 2 with `EXT_color_buffer_float` and a complete 4× multisampled RGBA16F framebuffer.
- **Kind:** behaviour
- **Level:** browser — real WebGL
- **Source:** `viewer/main.js:30-41`; `viewer/render/scene.js`
- **Expected:** `FRAMEBUFFER_COMPLETE`, `NO_ERROR`, `RENDERBUFFER_SAMPLES` = 4.
- **Covered by:** `src/boot/webgl-probe.svelte.test.ts` (H)
