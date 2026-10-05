# SNAIL as the default anatomy

The user additionally requires seamless atlas-region and tract exploration in
the reconstructed brain. For matching SNAIL anatomy, tracts are an independent
visible layer: opening Tracts enables it, and returning to Anatomy or selecting
a region keeps it visible. Native cortical parcels replace the display outline,
with shared cortex transparency, normal region picking and MRI appearance.
The standard cutting plane clips the tracts in the same surface-RAS world.
Other subjects may inspect the independent reference, but never receive SNAIL
tracts over their own anatomy. No region-to-tract connectivity claim is inferred
from spatial proximity.

The user requested the same SNAIL subject for anatomy and all other atlas views.
Use the exact published subject-1 T1 already bundled with its tractograms.
Reconstruct its own cortical surfaces and tissue labels; never reuse Bert labels
or rename another reconstruction. Keep existing subjects available.

## Scientific contract

- Pin the original T1 SHA256 and FreeSurfer build. Retain FreeSurfer command logs.
- Run the installed FreeSurfer 8.2 reconstruction and existing registered-sphere
  HCP/Yeo projection and subject-specific NextBrain segmentation pipelines.
- On this 24 GiB arm64 machine, precompute SynthStrip with the existing validated
  sliced-convolution runtime. This changes convolution summation order, not the
  model or its inputs, and avoids the full-volume im2col allocation. Record this
  explicitly. The remaining reconstruction uses the default 8.2 options.
- Validate surfaces, atlas coverage and all emitted artifacts before changing
  the configured and published default.
- FreeSurfer surface RAS differs from the source scanner RAS. Use the exact
  `orig.header.get_vox2ras_tkr() @ inverse(orig.affine)` mapping if composing
  tractograms with reconstructed surfaces; do not estimate a registration.
- The source is skull stripped and has a cropped inferior field of view. Keep
  this limitation visible in provenance. Do not invent missing tissue.

## User behavior

Fresh sessions open SNAIL. Explicit anatomy links retain their requested subject.
Anatomy, atlas selection, networks, sections and tract exploration should use
validated geometry from that same subject. Existing MRI inspection remains in
the original image coordinate system. No user uploads are required.

The user removed the separate diffusion MRI page from scope: use the existing
anatomy's MRI appearance and section controls. Delete that duplicate dialog and
its controls rather than retain a second MRI workflow. Tract controls remain in
the normal 3D canvas.

## Failure contract

Missing files, checksum changes, reconstruction errors, invalid topology or
coordinate inconsistencies stop publication. No placeholder/default replacement
is published while reconstruction is incomplete.

## Primary documentation

- https://surfer.nmr.mgh.harvard.edu/fswiki/recon-all
- https://www.freesurfer.net/fswiki/rel7downloads/rel8notes
- https://surfer.nmr.mgh.harvard.edu/fswiki/CoordinateSystems
- https://hdl.handle.net/1773/38477
