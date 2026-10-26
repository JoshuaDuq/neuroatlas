# U1: stage thumb ring contrast

- **Legacy:** on the stage `--thumb-ring` is `--overlay-control-border` (`#70777f`, `stage-vars.css`). It is the 1 px inset edge of the chosen segment in `ChoiceGroup` (DisplayPopover) and `ToggleToolbar` (ViewPopover), whose fill there is `--surface-raised` = `--overlay-raised` (`#3a3d42`). Against that fill it measures 2.41:1, below 3:1; against the track 3.43:1.
- **New:** on the stage `--thumb-ring` is `--overlay-ink-faint` (`#90969e`), an existing overlay token, so no value changes and `--overlay-control-border` keeps its other uses (3.96, 3.34, 3.43, 3.01:1 on the plates). Ratios of the ring: 3.66 on the raised fill, 5.21 on the track, 4.57 on the track hover, 6.01 on the popover surface (`--overlay-plate`), 5.08 on the plate hover.
- **Standard:** WCAG 2.2 SC 1.4.11 Non-text Contrast (the state indicator of a user interface component needs 3:1 against adjacent colours); rule UI-05.
- **Checked by:** `src/styles/contrast.test.ts`, which resolves `stage-vars.css` over `tokens.css` the way the panel pairs resolve `tokens.css`.
