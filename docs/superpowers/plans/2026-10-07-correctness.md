# Correctness repairs implementation plan

> **For agentic workers:** Use the debugging and test-driven-development workflows for each repair. Independent file scopes can be investigated separately; review the integrated diff before completion.

**Goal:** Reject invalid scientific state, report unavailable anatomy, validate spatial correspondence, and describe measured quantities accurately.

**Architecture:** Preserve scientific arrays, meshes, measurements, and normal interaction behavior. Validate requests at entry points, keep load failures observable, and reuse the published-asset loading policy. Correct documentation from published validation reports.

**Tech stack:** JavaScript, Three.js, Vite, Python, NiBabel, NumPy, Node tests, pytest.

## Request validation and supplemental anatomy

Files: viewer/app.js, viewer/model/brain-atlas.js, viewer/state/url-state.js and their tests; a focused published-anatomy resolver if needed.

- [x] Reproduce explicitly unknown anatomy, atlas, detail, invalid URL fields, and rejected spinal-cord loading with regression tests.
- [x] Confirm those tests fail for the observed silent defaults or missing load error.
- [x] Allow defaults only for omitted choices; throw descriptive errors for explicitly invalid requests. Remove legacy numeric colour decoding.
- [x] Remove tolerant startup restoration. Surface supplemental failures when that layer is requested, and prevent selection of unloaded anatomy without causing unhandled background rejections.
- [x] Verify valid defaults, switching, dissection, and loaded spinal-cord selection still work.

Expected request behavior:

```js
assert.throws(() => resolveAnatomy(published, 'missing'), /Unknown anatomy/);
assert.equal(resolveAnatomy(published), published.default);
assert.throws(() => decodeState('#opacity=5'), /opacity/);
```

## Registered source grids

Files: brain_model/volumes.py, brain_model/tissue_labels.py, tests/test_volumes.py, tests/test_tissue_labels.py.

- [x] Construct a tiny MGH reference and an identically shaped image with a 25 mm scanner-affine shift. Require load_on_grid and export_volumes to reject it.
- [x] Confirm the rejection tests fail before changing validation.
- [x] Require equal shapes, scanner affines, and tkregister transforms using one focused validation function. Apply it at volume-export and HCP ribbon-projection boundaries.
- [x] Verify shifted orientation and differing shape are rejected; registered synthetic images are accepted.
- [x] Run the existing source-to-volume and ribbon-projection tests to confirm outputs remain unchanged.

## Network descriptions and scientific documentation

Files: viewer/catalog/networks.js, viewer/ui/inspector.js, viewer/i18n/translations.js, related tests, brain_model/networks.py, README.md, docs/anatomies.md, docs/atlases.md, docs/validation.md.

- [x] Trace the actual denominator for cortical surface and NextBrain network compositions.
- [x] Present source vertex shares for cortical parcels and projected cortical voxel shares for NextBrain labels, excluding samples assigned to no network. Describe the five-percent cutoff only as a display threshold. Preserve every fraction and filtering result.
- [x] Correct matching metadata and bilingual descriptions. Test the representation-dependent explanation, without testing incidental prose formatting.
- [x] Replace mixed-unit validation claims with subject-specific values and units from published reports. Describe bounded display smoothing and preserved voxel classification/source measurements accurately.
- [x] Document SNAIL as the published default, distinguish configured fsaverage build support from available viewer subjects, and qualify unsupported reconstruction-quality inferences from MRIQC.

## Browser lifecycle and published diffusion freshness

Files: viewer/main.js, viewer/state/lifecycle.js and its tests, viewer/diffusion/assets.js and its tests, vite.config.js, a tested content-hash helper under scripts if needed.

- [x] Reproduce pagehide with persisted=true followed by persisted=false; only the latter may dispose the app. Verify no one-shot listener discards the later termination event.
- [x] Keep the existing application alive across persisted navigation; dispose once on terminal pagehide.
- [x] Test that diffusion reads use the same versioned, revalidated published requests as models and preserve HTTP/network error reporting.
- [x] Include diffusion files in the content hash, with deterministic relative paths, so changing tract/reference bytes changes the deployed version.
- [x] Verify service-worker/model tests and a production build.

## Integration verification and competitive recommendation

- [x] Run npm test, .venv/bin/python -m pytest, and npm run build after all scoped repairs.
- [x] Review the integrated diff for scientific output changes, hidden fallbacks, and unrelated refactoring.
- [x] Check valid startup and invalid-link error handling in the browser where available.
- [x] Identify one next product investment for learners and researchers equally. Specify a concrete first release and how it adds value relative to the reviewed competitors; do not implement that feature in this repair pass.


## Verified result

- Strict shared requests report their original failure; omitted choices retain documented defaults. Supplied English and French language choices survive serialization and reload.
- Supplemental spinal loading remains observable and is awaited before showing the layer; failed startup disposes constructed resources.
- Native source grids require exact 3D shape, scanner affine and tkregister correspondence. The published source headers satisfy this contract.
- Network fractions and all published scientific values are unchanged. Only network composition/limitation prose changed in the manifests; mesh and volume files were not modified.
- Full Python suite: 197 passed. Viewer suite: 650 passed. Production build passed. Python lint and diff whitespace checks passed. Independent review found no remaining concrete regressions after its two findings were repaired.
- Live browser checks: SNAIL default startup, valid region restoration, English/French network explanations, unknown anatomy error, unknown camera-view error, and successful reveal of 58 spinal structures.

## Recommended next product investment

Build an atlas comparison inspector for learners and researchers. First release: select a Destrieux region on SNAIL and highlight its corresponding HCP-MMP areas on the same reconstruction. Show overlap area and percentage, explicitly identify the denominator and unassigned portion, retain source/mapping limitations, and export the correspondence table with subject and atlas versions. Compute surface overlap from the common source tessellation, using area weights rather than vertex counts.

Learners can connect named folds with another atlas's areas; researchers can inspect and reuse quantitative ROI correspondences. This develops an identity around explainable atlas relationships. Brain Tutor already offers same-individual MRI, atlas labels and tract viewing (https://brainvoyager.de/products/brain-tutor/), and siibra provides rich multi-atlas and linked-data exploration (https://siibra-explorer.readthedocs.io/en/latest/). The proposed investment is a focused product direction, not a claim that competitors lack every form of atlas comparison. The feature is identified here; this repair pass implements correctness changes.
