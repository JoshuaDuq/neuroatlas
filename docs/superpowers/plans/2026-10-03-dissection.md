# Selective Dissection Implementation Plan

**Goal:** Reveal underlying anatomy by reversibly hiding selected regions.

**Architecture:** BrainAtlas owns dissection through a focused history
controller. Shared visibility rules drive the tree, meshes, caps and picking.
Thin controls extend the existing explorer and inspector.

**Tech Stack:** Three.js, native DOM and node:test. Execute inline to preserve
current uncommitted work. The user removed the insula preset from scope.

- [x] Add failing model, visibility, cut/palette and URL tests. Run the
  corresponding files with node --test and confirm the missing behavior.
- [x] Add viewer/state/dissection.js with validated hide/show,
  history, undo and reset; connect BrainAtlas. Add hidden identifiers to
  visibility/palette rules and section invalidation keys.
- [x] Add reusable eye controls and the explorer dissection toolbar. Wire
  group/region actions, Hide selected, undo and restore in app.
  Preserve keyboard focus on tree rebuilds; add bilingual strings and styles.
- [x] Include sorted hidden identifiers in URLs, validate against the manifest
  before applying, and update docs/usage.md.
- [x] Run npm test and npm run build. Inspect desktop/phone, manual hiding,
  undo/restore, hidden entry activation, language and keyboard focus. Run
  the Impeccable detector once; obtain focused code review and fix findings.

Verification: full suite passed (437 tests); production build passed.
Browser checks covered group and individual controls, hidden entry activation,
keyboard focus, Hide selected on phone, Undo, Restore all and French labels.
Review corrections cover compatible Undo context, explicit clinical reveals,
subject-specific masks and unique focus identities. The detector reported only
existing hierarchy and width/height transition warnings.
