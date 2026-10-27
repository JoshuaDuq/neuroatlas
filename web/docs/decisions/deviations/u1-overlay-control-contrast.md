# U1: overlay control border contrast

- **Legacy:** `--overlay-control-border: #6d737b` (`viewer/styles/tokens.css`). Against the stage plates it measures 3.75:1 on `--overlay-plate`, 3.17:1 on `--overlay-plate-hover`, 3.25:1 on `--overlay-track` and 2.85:1 on `--overlay-track-hover`. The last is below 3:1.
- **New:** `--overlay-control-border: #70777f` (same hue, lightness only, the smallest step that reaches 3:1 on every one of those grounds). Ratios: 3.96, 3.34, 3.43 and 3.01:1. Identical in both themes, because the overlay palette is theme-independent. The `prefers-contrast: more` override is unchanged.
- **Standard:** WCAG 2.2 SC 1.4.11 Non-text Contrast (user interface component boundaries need 3:1 against adjacent colours).
- **Checked by:** `src/styles/contrast.test.ts`; `src/styles/tokens.test.ts` pins `#70777f`.
- **Not covered:** none. `--overlay-raised` is a fill, not a ground this border is drawn on; the selected-segment ring on the stage and in the imaging dialog, which is, uses `--overlay-ink-faint` instead (`u1-stage-thumb-ring-contrast.md`).
