# One tablist instead of mirrored copies

Chunk: H5, H6, I1
Status: approved by the user on #4 (2026-10-25)

## Legacy behaviour

workspace.js:143-145 builds two tablists (`#workspace-tabs`, `#sheet-tabs`) and re-points the panels' `aria-labelledby` per shell (workspace.js:167).

## New behaviour

A single tablist positioned by CSS in both shells; one instance per panel; manual activation kept. See 0004 and 0007.

## Standard cited

WAI-ARIA APG Tabs pattern (one tablist per set of panels); WCAG 2.2 SC 1.3.1 and 4.1.2.
