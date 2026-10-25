# U1: overlay control border contrast

- **Legacy:** `--overlay-control-border: #6d737b` (`viewer/styles/tokens.css`). Against the stage plates it measures 3.75:1 on `--overlay-plate`, 3.17:1 on `--overlay-plate-hover`, 3.25:1 on `--overlay-track` and 2.85:1 on `--overlay-track-hover`. The last is below 3:1.
- **New:** `--overlay-control-border: #70777f` (same hue, lightness only, the smallest step that reaches 3:1 on every one of those grounds). Ratios: 3.96, 3.34, 3.43 and 3.01:1. Identical in both themes, because the overlay palette is theme-independent. The `prefers-contrast: more` override is unchanged.
- **Standard:** WCAG 2.2 SC 1.4.11 Non-text Contrast (user interface component boundaries need 3:1 against adjacent colours).
- **Checked by:** `src/styles/contrast.test.ts`; the difference is the one expected token difference in `web/parity/u1.test.ts`.
- **Not covered:** `--overlay-raised` is a fill, not a ground this border is drawn on; a chunk that places the border on it must check that pair.
