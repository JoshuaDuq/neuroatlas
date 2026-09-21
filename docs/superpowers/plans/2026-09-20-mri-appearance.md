# MRI Appearance Implementation Plan

**Goal:** Display registered grayscale MRI on the selectable, cuttable brain.

**Architecture:** A shared MRI shader extension samples the existing native
texture on surfaces and caps. BrainSections coordinates loading and windowing;
BrainAtlas retains geometry, visibility and selection. The scene bypasses tone
mapping only while MRI is selected.

**Tech Stack:** Three.js, WebGL2, JavaScript, node:test, Vite.

- [ ] Add failing tests for MRI mode acceptance and URL round trips, shared
  window uniforms, cap picking, loading races and unregistered geometry.
  Run `node --test viewer/model/brain-atlas.test.js viewer/tissues/gpu-sections.test.js
  viewer/slices/sections.test.js viewer/state/url-state.test.js`.
- [ ] Add `viewer/render/mri-material.js` with volume uniforms, validated window
  updates and a shader extension overriding outgoing light with windowed MRI.
  Attach it to model surfaces and both cap paths. Reuse cap highlight lifts.
- [ ] Coordinate MRI loading and appearance selection in `slices/sections.js`;
  expose loaded uniforms to `model/brain-atlas.js`, including later-loaded meshes.
  Update shared uniforms in `setWindow(center, width)`.
- [ ] Add MRI/IRM labels in the header and translations, persist `colors=mri`,
  connect asynchronous switching in `app.js`, and bypass scene tone mapping.
- [ ] Run `npm test` and `npm run build`. Inspect MRI and ordinary modes in the
  browser, including cuts, hover, contrast and responsive controls. Update usage
  documentation and record verification.
