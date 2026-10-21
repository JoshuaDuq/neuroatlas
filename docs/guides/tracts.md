# Diffusion and tracts

New sessions open SNAIL subject 1, reconstructed from the tract dataset's own T1. Choose the **Tracts** tab to enable three initial reconstructed bundles in the normal 3D viewer. The built-in collection contains 27 named bundles from subject 1 of DIPY's published SNAIL example dataset. You need no files or uploads. More bundles load when a side (L or R, or a numbered corpus callosum segment) is switched on in the searchable list.

Use the normal camera presets, orbit, zoom and PNG action.

## On SNAIL

On the matching SNAIL anatomy, **Tracts** enables a layer over the actual cortical reconstruction. **Cortex opacity** is shared with the stage **Display** tool. Pick or browse atlas regions, change the atlas or colouring in the masthead, and cut both layers together with the stage **Section** tool.

Returning to **Anatomy** keeps the tracts visible. **Show tracts with anatomy** turns that layer off. The minimum-length slider filters streamlines when you release it. Visibility changes keep the uploaded geometry.

## On other anatomies

On another anatomical subject, **Tracts** displays an independent SNAIL reference with an outline derived from its skull-stripped T1. This is an MRI isosurface, not a pial reconstruction or a cortical atlas. Region details and the stage **Section** and **Display** tools are hidden in this independent reference. SNAIL tracts are never overlaid on another brain.

This diffusion subject is distinct from `bert` and `aomic`. The workspace maps its scanner RAS coordinates into its own FreeSurfer surface RAS, using the exact image-header transform. It is not registered to those other specimens. The rigid transform moves the outline and the tracts together and preserves lengths.

## MRI with tracts

**MRI with tracts** in **Tracts** (or **M**) opens the published SNAIL T1 and FA with linked sections, a crosshair, exact zero-based source voxel inputs and the selected tracts. Choose axial, coronal, sagittal or linked slices with 3D. Phones initially show one plane.

- Click to position the crosshair, scroll through slices, or use the arrow keys and Page Up and Page Down on the canvas to move one voxel.
- Contrast and FA opacity updates commit on release.
- Closing preserves the loaded maps and position.
- The crosshair also positions the normal cutting plane when the selected anatomy is SNAIL, using the exact scanner-to-surface RAS transform.

The masthead's T1 colouring and the stage **Section** tool remain available for the selected anatomical subject. T1 colouring is available with tracts when the loaded anatomy is SNAIL, including during tract loading. Its Destrieux, internal segmentations and registered HCP-MMP projection have passed source-to-asset validation. The original T1 has cropped inferior coverage. The manifest records that limit and the coarse aseg labels it does not contain.

SNAIL's learning overview omits the coarse callosal surface, because it overlaps the finer fornix and septal estimates. Select **FreeSurfer aseg** under **Internal anatomy** to see the original callosal subsegments. The callosal clinical landmark uses those same five native labels. Source segmentations and tractograms are unchanged.

## Reading the bundle list

The standard tract colours encode left–right in red, anterior–posterior in green, and inferior–superior in blue.

Each loaded row gives its streamline count (or how many of them the length filter keeps), its mean length and its length range. Counts describe reconstructed streamlines, not axons. Lengths are polyline arc lengths, not connectivity strength.

**Export lengths CSV** includes the loaded bundles, total and enabled counts, the active threshold and the enabled mean, minimum and maximum lengths. Counts and lengths use the full source polylines after the length filter. Cuts affect only the view. Spatial proximity to an atlas region does not establish a measured connection.

**Restore default tracts** restores the initial selection.

## Data and rendering

Source TRK files are losslessly compressed, retaining every original point and streamline, including source points outside the image field of view. The collection occupies about 113 MB. Only the selected bundles are requested. A load failure appears with a reload action.

The dataset is [published under CC0](https://hdl.handle.net/1773/38477). Its original checksums, affine transforms, counts and independent NiBabel geometry measurements are in [`public/diffusion/snail-subject-1/provenance.json`](https://github.com/JoshuaDuq/neuroatlas/blob/main/public/diffusion/snail-subject-1/provenance.json). The rendering and its validation are described in [Validation](../validation.md#diffusion-geometry-and-performance).

## Reproducing the assets

1. Download the archive URL in [`data/diffusion.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/data/diffusion.yaml), then package it:

   ```bash
   uv run python scripts/prepare_diffusion.py /path/to/bundles_2_subjects.tar.gz
   ```

   The script verifies DIPY's published archive checksum before packaging the data. It does not resample the data or reduce streamlines.

2. Reproduce the brain outline:

   ```bash
   uv run python scripts/prepare_diffusion_outline.py
   ```

   `data/diffusion.yaml` sets the T1 intensity threshold (80) and the marching-cubes step size (2 voxels). The largest connected component removes disconnected foreground. No registration is applied. The method, source checksum, affine, bounds and limitations are recorded in [`public/diffusion/snail-subject-1/t1-outline.json`](https://github.com/JoshuaDuq/neuroatlas/blob/main/public/diffusion/snail-subject-1/t1-outline.json).

3. After importing the exact T1 with FreeSurfer, reproduce the header-derived coordinate mapping and its independent voxel anchors:

   ```bash
   uv run python scripts/prepare_diffusion_space.py
   ```

   The output is [`public/diffusion/snail-subject-1/surface-space.json`](https://github.com/JoshuaDuq/neuroatlas/blob/main/public/diffusion/snail-subject-1/surface-space.json).
