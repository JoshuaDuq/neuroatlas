# The dock and its popovers reflow at 200 % text and in narrow stages

Chunk: G2
Status: fix (standard cited)

## Legacy behaviour

The dock's tools, the presets, the hemisphere buttons and the stage commands have fixed heights and `white-space: nowrap`, and the tool row never wraps. At 200 % text, or with the WCAG 1.4.12 text spacing, a long name ("Antérieure", "Réinitialiser la vue") crosses into its neighbour or leaves its popover, and on a narrow stage the three tools run out of the dock.

## New behaviour

Tools, presets, hemisphere buttons and commands have a `min-height` (the control height) instead of a `height`, so they grow with their text. The presets, hemisphere buttons and commands wrap inside their cell (`white-space: normal`), and the tool row wraps (`flex-wrap`) inside the dock. Sizes at 100 % text are the legacy ones: tools and presets 32 px, hemisphere buttons 28 px, all 44 px under the phone query, and a 20 px tick box with an 11 × 6 px tick on a coarse pointer.

## Standard cited

WCAG 2.2 SC 1.4.4 Resize Text, SC 1.4.10 Reflow and SC 1.4.12 Text Spacing.
