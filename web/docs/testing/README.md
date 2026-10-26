# Testing: audit and business-rule catalogue

Part of #4. Since the user's decision of 2026-10-26 (comment on #4), parity is proven by business rules, not
by legacy code equivalence: a test states what the app must do for the reader, or a scientific or data
result, and checks it against fixed values without importing `viewer/`. This folder holds what the
conversion needs.

- `rules/<area>.md`: 34 catalogues, 1,323 entries (1,306 rules plus 17 that point to the one place a
  duplicated rule is stated). Each rule has an ID, the rule, its kind, the **cheapest level that proves it**,
  its legacy source, fixed expected values and the tests that cover it today, with their class.
- `audit.md`: every test file in one table, the rule IDs hiding in each legacy-comparison file, the slow
  tests ranked by seconds saved, and the findings outside the classification (bugs, changes from legacy with
  no deviation record, decisions needed).

## Counts

Test files (236: 161 unit and 51 browser Vitest files, 24 Playwright specs), by main class:

| Class                       | Files                                                                |
| --------------------------- | -------------------------------------------------------------------- |
| R business rule             | 191 (120 unit, 47 browser, 24 e2e)                                   |
| S scientific or data result | 8                                                                    |
| D legacy comparison         | 27 (24 of the 25 `parity/*.test.ts`, both `*.parity.svelte.test.ts`) |
| I implementation-pinning    | 1                                                                    |
| W weak or tautological      | 1                                                                    |
| H hygiene                   | 8                                                                    |

Rules by cheapest level: 843 unit, 465 browser, 15 e2e. About 56 rules are covered only by differential
tests and 28 by nothing; they need rule tests before the differential files can go. Many R files also carry
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
already uses leaves 25 to 30 s in the browser. After it: `parity/E4b` 43.6 s, `parity/C3` 34.3 s, the sheet
21.2 s, functions 19.9 s, `parity/F3` 16.6 s, the data bar 11.5 s (55 fixed 150 ms sleeps) and the overlays
9.8 s. Most browser time comes from five patterns: axe theme × width × language matrices, real debounce and
tooltip timers, CSS transitions, viewport churn and real data parsed per case.

## End-to-end journeys worth keeping on `next`

All three gates in `e2e/parity/enabled/` are `false`, so no region spec runs on `next` today. When the
gates flip, keep a few journeys and drop the cases a browser test already proves:

1. **Boot**: cold start to ready on the built site, the WebGL failure screen, a failed start that keeps the
   link (`boot.spec.ts`), plus the build harness that already runs (`harness.spec.ts`).
2. **Permalink round trip** (LINK-21): a scene with a region, hidden parts, a system, a cut with position and
   reverse, a hemisphere, a colouring and level, a function, deficit or circuit step and a tab, reloaded into
   the same scene.
3. **Pick and inspect on the real model**: hover names the region under the pointer, a click selects it, the
   inspector's Clear and Hide hand focus on, and Undo brings the part back.
4. **Find a region**: search, Enter, `region=` in the link, Back, and the tree row selected; an eye press
   says "Hidden: …. 1 part hidden".
5. **Explorers**: open a function and Restore; open a deficit's mapped region; step a circuit with Next.
6. **Data bar**: switch atlas with its download and progress; Escape in the popover keeps the selection;
   the comparison CSV downloads under its file name.
7. **Phone**: the sheet tells the stage what it covers, desktop to phone keeps tab focus, the page-wide
   focus walk, 320 px, and axe on the composed app.
8. **Snapshot and full screen**: a real PNG from the real WebGL stage, and real full screen in and out.
9. **Tracts**: the first opening loads and says so, the lengths CSV, and the MRI navigator's source voxel on
   real NiiVue (TRACT-33, the one rule only real NiiVue can prove).
