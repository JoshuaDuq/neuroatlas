# Native tract viewer implementation plan

**Goal:** Explore the real SNAIL reference brain and tracts in the normal canvas.

**Architecture:** Add a separate source-space scene group; keep the anatomical
model intact and switch visibility at the composition root. Reuse the tract
catalog, decoder, measurement functions and existing camera shell.

**Tech stack:** Three.js indexed lines, NiBabel, SciPy, scikit-image, trimesh.

- [ ] Add coordinate and segment-boundary tests in `native-geometry.test.js`,
  run them before implementing `native-geometry.js`.
- [ ] Generate an MRI outline from the T1 using YAML parameters, source affine,
  and documented marching cubes. Save GLB and reproducible provenance.
- [ ] Add `native-viewer.js`: load the outline and initial bundles, lazy-load
  further bundles, update line indices for filtering, dispose owned resources.
- [ ] Add `native-ui.js`: shared clinical rail, bilingual search, opacity,
  length filter, counts, CSV, defaults and MRI-section entry.
- [ ] Connect scene visibility, framing, picking, source identity, panels and
  keyboard controls in the app. Preserve the anatomy state on leaving Tracts.
- [ ] Validate desktop/phone operation, run tests/build and independent review.
- [ ] Update usage, scientific limitations and validation evidence.
