# Testing: audit and business-rule catalogue

Part of #4. Since the user's decision of 2026-10-26 (comment on #4), parity is proven by business rules, not
by legacy code equivalence: a test states what the app must do for the reader, or a scientific or data
result, and checks it against fixed values without importing `viewer/`. This folder holds what the
conversion needs.

- `rules/<area>.md`: 34 catalogues, 1,324 entries (1,302 rules plus 22 that point to the one place a
  duplicated rule is stated). Each rule has an ID, the rule, its kind, the **cheapest level that proves it**,
  its legacy source, fixed expected values and the tests that cover it today, with their class.
- `audit.md`: every test file in one table, the rule IDs hiding in each legacy-comparison file, the slow
  tests ranked by seconds saved, and the findings outside the classification (bugs, changes from legacy with
  no deviation record, decisions needed).

> **Status (2026-10-26):** the conversion below is done. K8 to K16 replaced all 27 legacy-comparison files with rule tests and deleted them, and K16 removed `web/parity/`. The counts, order and slow-test figures record the audit as it was taken, as `audit.md` does.

## Counts

Test files (237: 161 unit and 52 browser Vitest files, 24 Playwright specs), by main class:

| Class                       | Files                                                                |
| --------------------------- | -------------------------------------------------------------------- |
| R business rule             | 192 (120 unit, 48 browser, 24 e2e)                                   |
| S scientific or data result | 8                                                                    |
| D legacy comparison         | 27 (25 of the 26 `parity/*.test.ts`, both `*.parity.svelte.test.ts`) |
| I implementation-pinning    | 1                                                                    |
| W weak or tautological      | 1                                                                    |
| H hygiene                   | 8                                                                    |

Rules by cheapest level (over the 1,302 rules, pointers left out): 826 unit, 469 browser, 7 e2e. About 55
rules are covered only by differential tests and 48 by no test at all; they need rule tests before the differential files can go. Many R files also carry
small I or W parts (call-order spies, re-derived expectations); `audit.md` names them.

## Conversion order

Each step converts the differential checks into rule tests against fixed values (the rule IDs per file are
in `audit.md`), then deletes the file.

1. **Nearly covered already** (small, quick deletions): `parity/R2`, `T1`, `G6`, `f1`, `S1`, `u1`, `U2`.
   Their rules are mostly R-covered in unit files; add the few edge values listed, then delete.
2. **Core data** (largest unit-time win: `C3` alone is 34 s): `parity/C3`, `C2`, `C1` (one reviewed
   snapshot of both string tables), `C4`, `C5`.
3. **State and controller**: `parity/S2`, `S3`, `S4`, `S5a` (a table of fixed key outcomes), and the D
   parts of `parity/F3` (then move its rule cases out of `parity/`).
4. **Engine**: `parity/E4b` (43.6 s, the slowest unit file), `E1`, `E5`, `E7`, `E4a`, `f2` (as contract-suite
   cases, so the fake and the real engine meet them alike), `E6`, `E3`, `E2` (needs one browser test that
   compiles each distinct program once), then `lighting.parity.svelte.test.ts` and
   `snapshot.parity.svelte.test.ts` (the only proof the image carries "Planum · Not clinical anatomy").

In parallel, the speed fixes (no conversion needed): the engine contract (below), then the browser files'
axe matrices, real timers and animation waits.

## What to delete

- The 27 legacy-comparison files, each once its rules have rule tests (above).
- `src/lib/ui/kit-spike.svelte.test.ts` (a U0 spike over a docs-only fixture; reword decision records 0001
  and 0005, which cite it).
- Inside kept files: the call-order and spy assertions marked I, the W cases (or fix them), the engine
  contract's "names the per-frame events" on the real engine, and the e2e cases that repeat a browser test
  (most of each spec; see each spec's row).

## Slow tests

`src/lib/engine/index.svelte.test.ts` took 390 s of the browser suite in CI and made one shard last 408 s
while the others took 48 to 67 s: it runs the 49-case engine contract with a fresh real engine per case,
parsing about 35 MB of GLB on software WebGL. Only 19 cases need the real engine. Booting once per
`describe` saves about 160 to 185 s; splitting the suite into four files so shards balance cuts the CI wall
time by about 260 s; running the contract in the unit project with the fake renderer that `index.test.ts`
already uses (after writing a fetch-to-disk shim for the volumes, tracts and overlap file, and keeping one
browser cut case for the worker path) leaves 25 to 30 s in the browser. After it: `parity/E4b` 43.6 s, `parity/C3` 34.3 s, the sheet
21.2 s, functions 19.9 s, `parity/F3` 16.6 s, the data bar 11.5 s (55 fixed 150 ms sleeps) and the overlays
9.8 s. Most browser time comes from five patterns: axe theme × width × language matrices, real debounce and
tooltip timers, CSS transitions, viewport churn and real data parsed per case.

## End-to-end journeys

`web/e2e/journeys/` runs a few journeys against the built Svelte preview on its real engine, served as Pages
serves it (`e2e/serve-site.mjs`): one job, about 5 minutes, off pull requests (manual run and deploy). K19
deleted the 25 specs of `e2e/parity/` and the `legacy` project; the rules they held are proved by the
browser tests cited in the catalogues, or by these journeys. A journey is not the level that proves each rule
it touches; those rules keep their own unit or browser test.

1. **Boot** (`boot.spec.ts`): cold start to ready, each prefetched file requested once at its version
   (ASSET-15, ASSET-21), a second visit served by the service worker (SW-10), the WebGL failure screen, a
   failed start that keeps the link until Retry, the head script before the app.
2. **Permalink round trip** (`scene.spec.ts`, LINK-21): a system chosen by hand, and a scene with a region,
   a hidden part, a cut with position and reverse, a hemisphere, a colouring and level, a function and a tab,
   each reloaded to the same link.
3. **Pick and inspect on the real model** (`scene.spec.ts`): hover names the region, a click selects it, Hide
   hands focus to Undo, and Undo brings the part back.
4. **Find a region** (`scene.spec.ts`): search, Enter, `region=` in the link, Back, the tree row selected;
   an eye press says "Hidden: …. 1 part hidden".
5. **Explorers** (`explorers.spec.ts`): open a function and Restore; open a deficit's mapped region; step a
   circuit with Next.
6. **Data bar** (`chrome.spec.ts`): a colouring that needs another atlas switches it; Escape in the phone
   popover keeps the selection; the comparison CSV downloads under its file name.
7. **Phone** (`phone.spec.ts`): the sheet tells the stage what it covers and a resize keeps tab focus; the
   page-wide focus walk; 320 px (SHEET-29).
8. **Snapshot and full screen** (`chrome.spec.ts`): a real PNG from the real WebGL stage, and real full
   screen in and out. The settings menu and single-key shortcuts after a reload (SHORT-13) are there too.
9. **Tracts** (`tracts.spec.ts`): the first opening downloads and draws, the lengths CSV downloads, and the
   MRI navigator opens and steps on the built site (TRACT-48). TRACT-33 is proved in the browser project.
10. **Accessibility** (`accessibility.spec.ts`, BUILD-10): axe on the composed app, light and dark, at 1280 px
    and 390 px.

Known gaps found while writing them: on a phone the selection strip's name ("Inspect Middle temporal gyrus,
left") does not contain its visible text, so axe reports `label-content-name-mismatch`; and after a window
goes from a phone to a desktop width the stage keeps the sheet's `--vis-bottom` inset.
