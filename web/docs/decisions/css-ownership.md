# CSS ownership and cascade layers

Chunk U1. Copy of the "Legacy stylesheet ownership" table on #4: each legacy line range is ported by the chunk named, into that chunk's own component `<style>` blocks.

| Sheet                | Split (legacy line ranges → chunk)                                                                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tokens.css, base.css | U1 (`src/styles/tokens.css`, `base.css`)                                                                                                                                                                          |
| layout.css           | 1-12 H1a · 13-50 H5 · 51-57 I1 · 58-122 H5 · 123-160 U4/U6 · 161-164 R1 · 165-201 H5 · 202-225 H1a                                                                                                                |
| components.css       | 1-206 U4/U6 (buttons, inputs, search) · 207-237 U3 · 238-290 U4 · 291-386 U4 · 387-407 R1 · 408-487 U3/H5 · 488-506 U1 (kbd, `src/styles/elements.css`) · 507-539 U5 · 540-547 U1 (focus-ring offsets, see below) |
| detail.css           | 1-127 and 204-234 R1 · 128-203 R2 · 235-265 U4 (Swatch) / R1 · 266-281 R1                                                                                                                                         |
| stage.css            | 1-185 G1 · 186-285 G3 · 286-310 H1b · 311-440 and 454-508 G2 · 441-453 and 509-614 G4 · 615-727 I2 (split by selector)                                                                                            |
| phone.css            | 15-29 U4 · 30-61 H1a · 62-229 and 288-363 H6 · 230-250 I1 · 251-287 U5 (+ G5, S5b, H4 ids) · 364-398 by selector (A1, U4, G5, H4) · 399-402 U1 (component ring offsets, see below)                                |
| a11y.css             | 8-15, 24-38, 45-84 U1/U3/U4 · 16, 91-93 G1 · 20, 49 H3 · 39 G5/T2 · 50, 101-107 T1 · 88, 97-99 X3 · 95 X2                                                                                                         |
| dialogs.css          | 1-101 U5 · 102-122 S5b · 112-133 H4 · 135-204 G5 · 205-251 T2 · 252-277 by selector                                                                                                                               |
| masthead.css         | 1-70 and 308-364 H2 · 71-307 H3 · 365-452 H2/H3 · 453-492 H4                                                                                                                                                      |
| navigator.css        | 1-40, 66-251, 302-322 A1 · 41-65 and 252-265 U6/A2 · 266-301 U4                                                                                                                                                   |
| clinical.css         | 30-82 U4 · 83-141 X1 · rest X2                                                                                                                                                                                    |
| circuits.css         | X3                                                                                                                                                                                                                |
| diffusion.css        | T1                                                                                                                                                                                                                |

Component forced-colour and contrast rules move into each component's `<style>` under `@layer a11y`.

## What U1 ported

| Legacy                                                  | Now                                                                                                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tokens.css`                                            | `src/styles/tokens.css`, `@layer tokens`, values identical (`web/parity/u1.test.ts`)                                                                                                  |
| `base.css`                                              | `src/styles/base.css`, `@layer base`                                                                                                                                                  |
| `components.css` 488-506 (kbd), `.measure`, `.code`     | `src/styles/elements.css`, `@layer elements`                                                                                                                                          |
| `a11y.css` 19-33 (contrast tokens), 50-51 (forced ring) | `src/styles/a11y.css`, `@layer a11y`; 8-15 reduces to the generic `details > summary::before` rule, the id/class selectors belong to the chunks above                                 |
| `a11y.css` 34-38, 40-45, 52-100 selectors               | The owning component, in its `<style>` under `@layer a11y`                                                                                                                            |
| `components.css` 540-547, `phone.css` 399-402           | Not global: the selectors name component ids (`#detail-back`, `#sheet-handle`, ...). Each component sets `outline-offset: -2px` on its own flush-edge control in `@layer components`. |

## Layer contract

`src/styles/index.css` declares `@layer tokens, base, elements, components, features, a11y;` before anything else.

- Svelte scopes component selectors with a class, so a component rule outranks an element rule by specificity. Layers, not source order, decide between layers: a later layer wins whatever the specificity.
- Every component `<style>` rule is inside `@layer components` (shared widgets in `src/lib/ui/`), `@layer features` (panels, stage, masthead) or `@layer a11y`. Only `@keyframes`, `@property` and `@font-face` may sit outside a layer.
- Forced-colours, `prefers-contrast` rules live in `@layer a11y`, either as `@layer a11y { @media (forced-colors: active) { ... } }` or the reverse nesting.
- Hover styles sit inside `@media (hover: hover) and (pointer: fine)` and nowhere else; the same query is used for every hover rule.
- `!important` inverts layer order (the earliest layer wins). Only `base.css` uses it (`[hidden]`, theme swap, `data-instant`), where winning over every later layer is the intent. A reduced-motion rule that must beat a component transition is written without `!important` in `@layer a11y`.
- Every `var(--x)` without a fallback names a declared token (`src/styles/stylesheets.test.ts` checks every stylesheet and every `<style>` block).
- Line heights come from `--lh-caption|ui|prose|title`.
