# Impeccable UI polish implementation plan

**Goal:** Polish the existing NeuroAtlas workspace with Impeccable while
preserving its content, scientific rendering, controls, and current edits.

**Architecture:** Keep the current three work areas and shared CSS tokens.
Refine shared styles rather than introducing components or another UI framework.
Use the project-local Impeccable skill for future UI work.

**Tech stack:** Vite, CSS, vanilla JavaScript, Fontsource Source Sans 3,
Impeccable.

## Direction

A calm scientific workspace: readable type, quiet surfaces, one teal action
color, flat panel tabs, and a dominant anatomical viewport. Keep the existing
light and dark themes and all anatomical colors and orientation conventions.
Use the current mouse, keyboard, and phone interactions without new animations.

## Tasks

- [x] Install Impeccable for this project and read its polish guidance.
- [x] Inspect the current interface and run the baseline test suite (420 passed).
- [x] Self-host Source Sans 3 through Fontsource and use it for interface text.
- [x] Improve shared text/control contrast and normalize small labels to 12px.
- [x] Remove icon tiles and boxed panel tabs; preserve segmented settings.
- [x] Give phone controls 44px touch targets and verify localized wrapping.
- [x] Record the resulting visual system in `DESIGN.md`.
- [x] Run the existing tests, production build, and one Impeccable scan.
- [x] Inspect desktop, tablet, and phone layouts, including dark mode, search,
      selection, cuts, and display controls; fix observed defects together.

## Detector review

The static scan reported four warnings. Its flat-type warning cannot resolve
the styles imported from `viewer/main.js`; rendered body and wordmark sizes are
15px and 22px. The remaining three warnings flag the existing loading-bar and
phone-sheet size transitions. Preserve these interactions in this refinement;
the sheet's visible rectangle is shared with camera framing and viewport chrome.

## Final verification

- 420 tests passed; production build succeeded; `git diff --check` passed.
- Source Sans 3 loaded in the browser; no console errors were observed.
- No horizontal page overflow at 1440×900, 897×774, 390×844, or 844×390.
- Verified keyboard search/selection, English/French labels, light/dark themes,
  region details, oblique cuts, display controls, and the settings menu.
- The icon-label contract checks each required control individually, so adding
  another labeled header icon does not invalidate unrelated accessible names.

## Validation

Use `npm test` (zero failures), `npm run build` (exit 0), and
`.agents/skills/impeccable/scripts/impeccable detect --json index.html viewer/styles`.
Read findings in context: orientation glyphs, metadata, and numerical readouts
are part of the scientific interface. Browser checks must confirm font loading,
readable states, keyboard focus, and no page overflow at 1440px, 897px, and 390px.

## Continued polish

Keep the established visual system. Use the WAI-ARIA tree and disclosure
patterns as the reference for visible focus and expansion state, preserving
the current selection, keyboard controls, and anatomical content.

- [x] Keep an expanded anatomy group's heading visible while its rows scroll.
- [x] Replace tree and phone disclosure glyphs with the existing SVG stroke style and
      improve the legibility of hemisphere labels.
- [x] Fit the four cutting planes on one row below the full-brain option.
- [x] Remove local focus styles that obscure the shared focus ring.
- [x] Verify tests, build, one detector scan, and a bounded responsive review.

The selector is 88px tall on desktop and 96px on phones, retaining 40px/44px
targets. Verified French and English, light and dark panels, expanded group
context, keyboard selection distinct from focus, clinical heading focus, and
layouts at 1440×900, 897×774, 390×844, and 844×390 without horizontal overflow.
The detector reported the same four documented warnings and no new findings.
The latest suite passed 437 tests; the production build and diff check passed.
Other concurrent app changes were preserved throughout this presentation pass.
