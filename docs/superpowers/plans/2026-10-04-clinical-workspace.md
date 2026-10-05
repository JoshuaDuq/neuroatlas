# Clinical Workspace Implementation Plan

**Goal:** Significantly improve NeuroAtlas with the user's selected light,
clinical, professional visual direction, built directly in the app.

**Architecture:** Keep existing UI modules, identifiers, translations, and state
unchanged. Reorganize the HTML shell and revise the existing CSS by its current
responsibilities: tokens, shell layout, components, clinical content, and phones.

**Tech Stack:** JavaScript, semantic HTML, CSS, Three.js, Vite, Source Sans 3.

- [x] Separate identity/settings from the imaging toolbar in index.html and
  viewer/styles/layout.css. Keep instruments within the masthead.
- [x] Define white clinical surfaces, slate ink, teal states, shared borders,
  and consistent control sizing in viewer/styles/tokens.css.
- [x] Refine search, tabs, anatomy rows, dissection, selection, data sheets,
  display settings, and dialogs in the existing component styles.
- [x] Adapt the new shell in viewer/styles/phone.css while preserving the phone
  sheet, gesture targets, and landscape behavior.
- [x] Inspect desktop, tablet, phone, French, dark theme, selected-region,
  cutting-plane, display, and deficit states in the live app. Fix material
  findings together, then confirm once.
- [x] Run npm test, npm run build, git diff --check, and the Impeccable detector.
- [x] Obtain the Impeccable finish review and document the built system in
  DESIGN.md and .impeccable/design.json.

## Validation references

Existing viewer/ui/chrome.contract.test.js and element-bindings.test.js preserve
the shell's behavior and bindings. W3C ARIA APG tabs and combobox examples inform
the existing accessible controls. No rendering, geometry, atlas data, or state
changes are part of this work.
