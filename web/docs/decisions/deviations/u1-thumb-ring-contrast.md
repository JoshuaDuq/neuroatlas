# U1: dark thumb ring contrast

- **Legacy:** dark `--thumb-ring: #7a8189` (`viewer/styles/tokens.css`). It is the 1 px inset edge of the chosen segment in `ChoiceGroup`, `ToggleToolbar` and `Toolbar`. On `--surface-raised` (`#343a40`, the chosen segment's fill in the dark theme) it measures 2.92:1, below 3:1.
- **New:** dark `--thumb-ring: #7d848c`, the dark `--border-control`. 3.04:1 on `--surface-raised`, and at least 3:1 on every panel ground (asserted by `contrast.test.ts`). The light theme and the `prefers-contrast: more` override are unchanged.
- **Standard:** WCAG 2.2 SC 1.4.11 Non-text Contrast (the state indicator of a user interface component needs 3:1 against adjacent colours); rule UI-05.
- **Checked by:** `src/styles/contrast.test.ts` (every panel ground, dark theme included) and `src/styles/tokens.test.ts` (pins the value).
