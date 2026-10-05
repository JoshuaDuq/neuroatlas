# Diffusion Exploration Implementation Plan

**Goal:** A ready-to-use collection of real diffusion maps and reconstructed
bundles in NeuroAtlas. Users do not upload data.

**Architecture:** A lazy NiiVue workspace owns the published subject's image
and tract space. Focused validation, geometry, display and bilingual UI modules
keep it independent of the FreeSurfer anatomy renderer.

**Tech stack:** JavaScript, Vite, @niivue/niivue 0.69.0, node:test; NiBabel,
NumPy and YAML for reproducible asset preparation.

- [x] Review NiiVue loading/mesh documentation and DIPY streamline/bundle examples.
- [x] Verify the CC0 SNAIL archive against DIPY's official checksum. Preserve
  subject 1's T1, FA and 27 original TRK bundles; package TRK losslessly with
  deterministic gzip. Record source hashes, grid/affine, counts and NiBabel
  RAS+ samples and lengths in provenance.json.
- [x] Validate scalar 3D images, explicit mm units and spatial transforms;
  measure polyline arc lengths and reject malformed streamline geometry.
- [x] Integrate lazy linked slices/3D, T1/FA, searchable bundle selection,
  direction colors, image contrast, length filtering, PNG and CSV capture.
  Protect canvas input and preserve close/reopen state.
- [x] Wire Explore → Tracts, session validation, language updates and disposal.
  Inherit the established clinical tokens and responsive phone behavior.
- [x] Address reported lag: default to lines instead of extruded cylinders,
  avoid volume texture rebuilds on tract operations, draw visible bundles only,
  defer hidden geometry updates, and commit sliders on release.
- [x] Benchmark source decoder/geometry: largest bundle 4,056 → 371 ms and
  693 → 63 MB of GPU buffer data (headless CPU preparation, same original points).
- [x] Add scientific tests for every published bundle's source bytes, decoded
  RAS+ coordinates, streamline counts and length summaries; add regressions for
  avoiding MRI texture rebuilds on tract operations.
- [x] Check real large-bundle selection/toggles, FA, empty length/search states,
  keyboard close/reopen, French and phone layout; run the UI detector once.
- [ ] Complete final test/build verification and independent finish review.
- [x] Document source, license, usage, preparation and scientific boundaries.

Changes remain in the working tree; no deployment or commit is requested.
