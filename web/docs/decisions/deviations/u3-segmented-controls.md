# Segmented controls follow the APG per group

Chunk: U3
Status: approved by the user on #4 (2026-10-25)

## Legacy behaviour

Every `.segmented` is a `role=group` of `aria-pressed` buttons with a custom roving tabindex (ui/roving.js); arrows move focus only, whatever the group means.

## New behaviour

Radio Group (arrows move and select) for language, theme, single keys, hemisphere, MPR planes and tree scope; Toolbar of `aria-pressed` toggle buttons for view presets, cut mode and paint picks. Not Bits ToggleGroup. See 0003.

## Standard cited

WAI-ARIA APG Radio Group and Toolbar patterns; WCAG 2.2 SC 4.1.2.
