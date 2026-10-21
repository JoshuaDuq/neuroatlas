# Atlas comparison implementation plan

**Goal:** Explain Destrieux/HCP-MMP correspondence on one subject with measured area, exact overlap highlighting and reproducible export.

**Architecture:** A scientific exporter writes a sparse symmetric overlap table and exact intersection meshes. A small validated reader exposes a direction-specific comparison and CSV. A focused inspector component owns its disclosure and loading state; a geometry overlay supplies meshes to the existing outline renderer.

**Tech stack:** NiBabel, NumPy, Trimesh, JavaScript, Three.js, pytest, Node tests and Vite.

The approved design is in `docs/superpowers/specs/2026-10-07-atlas-comparison-design.md`. Keep the previously verified correctness repairs in the current workspace. File scopes below allow the scientific exporter and viewer to proceed independently against the documented contract.

## Scientific exporter

Files: `brain_model/comparison.py`, `tests/test_comparison.py`, `brain_model/build.py`, `config/model.yaml`, SNAIL's new comparison assets and manifest pointer.

- [x] Write failing tests using unequal-area triangles, integer annotations with unassigned labels and explicit barycentric geometric subdivision.
- [x] Implement float64 area weights, sparse joint pairs, exact marginals and exact pair meshes; validate shape, integer labels, finiteness and nondegenerate triangles.
- [x] Add exporter integration and configured atlas pair in YAML; pin source/asset hashes and validate every ID against the manifest.
- [x] Publish only the new SNAIL comparison files and manifest pointer; independently compare all totals and mesh areas, without rebuilding existing anatomy assets.
- [x] Run focused scientific tests and lint.

## Validated viewer data and export

Files: `viewer/comparison/catalog.js`, `viewer/comparison/catalog.test.js`, `viewer/comparison/assets.js`, `viewer/comparison/assets.test.js`.

- [x] Write failing tests for asymmetric denominators, unassigned remainder, tiny shares, conservation, mismatched subjects/hemispheres/IDs and CSV precision/provenance.
- [x] Validate the sidecar and index positive pairs; expose comparison rows in descending area with the whole selected-region denominator.
- [x] Use versioned, revalidated, checksum-verified lazy loading; retain and surface HTTP/integrity errors.
- [x] Export every contribution at full precision with source identity and citations.

## Exact highlight and inspector

Files: `viewer/comparison/overlay.js` and tests, `viewer/ui/atlas-comparison.js` and tests, `viewer/app.js`, `index.html`, `viewer/i18n/translations.js`, `viewer/styles/components.css`.

- [x] Test source-selection invalidation, toggle, clipping/visibility constraints and stale async requests before implementing the controller.
- [x] Load exact pair meshes only on requested highlight; preserve original geometry/materials and route the overlap through the existing outline pass.
- [x] Add a ruled disclosure after measurements with four initial rows, remaining rows, explicit unassigned remainder, denominator and secondary export/method details.
- [x] Localize both languages and all loading/error/empty states; maintain focus and reset stale highlights.

## Verification and documentation

- [x] Run complete viewer/Python suites and production build; inspect the integrated diff for altered scientific assets or unrelated changes.
- [x] Batch live desktop/phone checks, including reverse direction, precision, exact highlighting, clear, dissection/cuts, CSV and failure paths. Fix observed issues in one batch and confirm once.
- [x] Obtain independent scientific/code and UI review; address concrete findings.
- [x] Document method, denominator, limitations and export in the existing atlas/usage/validation guides. Preserve the established design system.


## Verified result

- SNAIL publishes 1,212 positive pairs and 512 complete cortical/non-region totals; both original pial hemisphere areas conserve exactly.
- Independent cell-subdivision, decoded mesh geometry, analytic float32 area bounds, source identity and checksum checks pass. Existing anatomy mesh/volume files remain unchanged.
- All 721 JavaScript tests and 213 Python tests pass; production build, Python lint and diff-whitespace checks pass.
- Live checks cover both atlas directions and locales, exact outlines, toggle/clear, full-region measurements under cuts, touch layout and a real CSV download preserving the exact denominator and all raw area/fraction totals.
- Independent code review found one late-render callback after disposal; the app guard and real deferred-load regression resolve it. Final UI review confirms wrapped-row separation, singular copy and explicit atlas direction on the phone.
- Static design detector reports no findings. The addition inherits the existing runtime tokens and component system; DESIGN.md and its sidecar remain unchanged. Their pre-existing neutral-palette drift is recorded without changing the visual system.
- README/atlas guide qualify Bert's overview counts against the default SNAIL publication. Method, limits, usage and reproducible export are documented; PRODUCT.md includes the new capability.
- Review evidence: `.impeccable/review/desktop.jpg`, `user-1280.jpg`, `mobile.jpg`, `sulcal.jpg`.
