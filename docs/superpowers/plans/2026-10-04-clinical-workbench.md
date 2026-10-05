# Clinical Workbench Implementation Plan

**Goal:** Significantly improve NeuroAtlas as a calm, precise clinical reference
workspace while preserving anatomical content, rendering, and interactions.

**Architecture:** Use the existing CSS tokens and responsive grid. Keep shared
control icons in one small presentation helper; translated labels remain text
and existing event handlers retain ownership of behavior.

**Tech stack:** JavaScript, CSS, Three.js, Vite, self-hosted Source Sans 3.

## Implementation

- [x] Replace detached panel cards with a contiguous ruled workspace; align
  explorer and inspector headings and give the model the available space.
- [x] Refine the brand and specimen selector, toolbar spacing, tab selection,
  anatomical rows, and readable form borders within the clinical palette.
- [x] Add consistent SVG control icons and a two-column cutting-plane chooser;
  preserve accessible names, English and French, and existing keyboard behavior.
- [x] Adapt the same hierarchy to tablet, phone, and short landscape layouts.
- [x] Run existing frontend tests and a production build. Inspect desktop,
  tablet, phone, French, dark theme, selection, cuts, and display states.
- [x] Run the Impeccable detector once, obtain an independent finish review,
  and update design documentation to match the finished implementation.

## Evidence and constraints

Existing uncommitted work is preserved. UI color roles remain independent of
scientific palettes. No new packages, scientific algorithms, hidden fallbacks,
or compatibility layers are introduced.

Reference review: MDN's `:focus-visible` documentation and the WAI-ARIA tabs
pattern support retaining visible keyboard focus and the current roving tab
behavior. Existing Three.js renderer sizing remains unchanged.
