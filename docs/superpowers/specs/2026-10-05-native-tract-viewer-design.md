# Tracts in the normal viewer

The user approved the same reference brain and tracts in the normal viewer,
without reconstructing cortical atlas labels. Selecting Explore → Tracts uses
the existing Three.js canvas, camera presets, orientation, zoom and snapshot.
It displays the SNAIL subject 1 reference rather than overlaying these tracts on
the unrelated FreeSurfer specimen. Leaving Tracts restores the anatomy scene.

A reproducible MRI isosurface provides a transparent brain outline, derived
from the published skull-stripped T1. It is explicitly an MRI-derived outline,
not a pial reconstruction or cortical parcellation. YAML owns extraction
parameters; NiBabel applies the source affine before the same RAS-to-viewer
rotation and unit conversion used for the tracts. Source points are retained.

The established clinical side panel contains brain opacity, minimum streamline
length, search and the 27 named bundles. Bundles load on selection, render as
indexed line segments, and change visibility without re-uploading geometry.
Length filtering changes only line indices. The MRI sections workspace remains
available for T1/FA inspection. Atlas-specific panels and shortcuts are disabled
while this independent reference specimen occupies the canvas.

Verification covers source coordinates, segment boundaries, filtered lengths,
derived-surface provenance, switching back to anatomy, keyboard camera views,
desktop and phone layouts, the complete test suite and production build.
