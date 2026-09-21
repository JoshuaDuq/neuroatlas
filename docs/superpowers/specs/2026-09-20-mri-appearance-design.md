# MRI appearance

Approved in conversation: add MRI beside Tissue, render the registered T1 scan
in grayscale on surfaces and smooth cut faces, preserve hover/selection and
share windowing with the linked MRI viewer.

Use the existing native volume texture, world-to-voxel affine, stencil caps,
categorical labels, and picking. MRI output bypasses illustrative lighting and
tone mapping; its display values match the linked slices. Interpolation does
not increase the source resolution. Supplemental anatomy explicitly marked
unregistered is omitted in MRI mode rather than given invented scan intensities.

Load MRI before activating the mode, expose loading errors, and keep the latest
appearance choice if the user switches while loading. Restore ordinary shading
when leaving MRI. Keep data/geometry unchanged during plane motion and windowing.

Verify state persistence, window propagation, geometry reuse, picking, mode
restoration, GPU compilation, and actual browser rendering.
