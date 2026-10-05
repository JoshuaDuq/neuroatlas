# SNAIL default anatomy implementation plan

> Execute inline in the existing workspace; preserve unrelated edits.

**Goal:** Make the tract dataset's own reconstructed brain the default anatomy.

**Architecture:** Declare SNAIL in the anatomy configuration, generate and record
its own FreeSurfer outputs, then reuse the subject-independent atlas pipeline.
Publish only after validation. Exact image-header coordinate transforms align
scanner-RAS tractograms with FreeSurfer surface-RAS anatomy.

**Tech stack:** FreeSurfer 8.2, NiBabel, NumPy/SciPy, existing model builder,
Three.js, YAML.

- [x] Pin the SNAIL reconstruction input and runtime in `config/model.yaml`,
  retaining the existing default until publication.
- [x] Test `prepare_subject.py` rejects incomplete reconstructions and changed
  source bytes before recording generated reconstruction files.
- [x] Import the source with `recon-all -motioncor` (without V8 global stages),
  precompute SynthStrip through the validated memory-conscious runtime, then run
  `recon-all -all -openmp 4` with the default V8 pipeline. Record exact commands,
  inputs, runtime hashes and limitations in `data/snail/reconstruction.json`.
- [x] Record completed source outputs and transfer HCP/Yeo annotations with
  `.venv/bin/python scripts/prepare_subject.py --anatomy snail`.
- [x] Run the existing subject-specific NextBrain pipeline with
  `FS_LICENSE=... .venv/bin/python scripts/segment_nextbrain.py --anatomy snail --record`.
- [x] Declare SNAIL's actual coarse aseg coverage in YAML. Its segmentation
  has no choroid-plexus (31/63) or optic-chiasm (85) labels; retain the shared
  smoothing and all other subjects' structure sets. Record that limitation.
- [ ] Rebuild and validate the SNAIL learning overview without its conflicting
  coarse callosal surface. Keep that surface in aseg, retain the source voxels,
  and enforce the cross-source visibility criterion in full model validation.
- [x] Build and validate with `.venv/bin/python -m brain_model.build --anatomy snail`
  and `.venv/bin/python -m brain_model.validate --anatomy snail`.
- [x] Verify the scanner-to-surface RAS matrix with voxel anchors; apply it to
  both the source outline and tracts before their composition with atlas surfaces.
- [x] Set `anatomy: snail`, refresh the published anatomy index, test fresh and
  explicit-subject sessions, then update subject labels and usage documentation.
- [x] Keep atlas anatomy, region picking and MRI controls active with matching
  SNAIL tracts. Retain the tract layer while browsing anatomy; share cortex
  opacity and the cutting plane. Never overlay it on another specimen.
- [x] Restore the requested MRI navigator with the published SNAIL T1/FA,
  linked crosshair, exact source voxel navigation and selected lightweight tract
  lines. Load it only when opened and retain its data on close/reopen. Keep the
  normal anatomy MRI appearance and region/section controls.
- [ ] Run appropriate Python/JavaScript tests and build; inspect desktop and
  phone layouts and complete independent finish review.
