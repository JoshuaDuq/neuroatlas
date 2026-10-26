# The evidence summaries are 44 px on a coarse pointer

Chunk: R1
Status: fix under the parity policy (no prior approval needed); listed in the R1 PR

## Legacy behaviour

detail.css:260-262 states that a coarse pointer gets the 44 px target for `details.detail-section > summary`, but detail.css:115 (`#region-detail > :is(.evidence-section, #region-constituents) > summary { min-height: var(--row-height) }`, specificity 2-0-1) outranks it (0-1-2). The Functional division, Neuropsychological functions and Functional networks summaries stayed at the row height (36 px) on touch screens.

## New behaviour

Every summary in the inspector is at least 44 px under `pointer: coarse`, as the legacy comment intended.

## Standard

WCAG 2.2 SC 2.5.8 Target Size (Minimum) is met at 24 px; the project's own rule (#4 definition of done, "44 px on coarse pointers") and Apple HIG / Material 3 touch-target guidance ask for 44-48 px.
