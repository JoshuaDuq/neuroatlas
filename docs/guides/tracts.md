# Diffusion and tracts

The **Tracts** tab shows 27 reconstructed bundles from subject 1 of DIPY's SNAIL example dataset ([CC0](https://hdl.handle.net/1773/38477)). Three are on at first; switch on a side (L, R, or a numbered callosal segment) to load more. Colour encodes local direction: left–right red, anterior–posterior green, inferior–superior blue.

## On SNAIL and elsewhere

SNAIL is reconstructed from the tract dataset's own T1, so the tracts sit on its real cortex through the exact scanner-to-surface transform. Regions, atlases, colours and the Section tool all work with tracts. **Cortex opacity** is shared with Display. Returning to Anatomy keeps the tracts; **Show tracts with anatomy** turns them off.

On `bert` or `aomic`, Tracts shows SNAIL alone, inside an outline drawn from its T1. That outline is an MRI isosurface, not a pial surface, and region details and stage tools are hidden. SNAIL tracts are never placed on another brain.

## Reading the list

Each row gives the streamline count, mean length and range. Counts are reconstructed streamlines, not axons; lengths are polyline arc lengths, not connection strength. The minimum-length slider filters on release. **Export lengths CSV** writes the loaded bundles and the active threshold. **Restore default tracts** returns to the first selection.

## MRI with tracts

**MRI with tracts** (or <kbd>M</kbd>) opens SNAIL's T1 and FA with linked slices, a crosshair, zero-based voxel inputs and the selected tracts. Click, scroll, or use the arrows and Page Up/Down on a slice to move one voxel. On SNAIL the crosshair also positions the cutting plane.

## Data

The TRK files are compressed losslessly: every point and streamline is kept, about 113 MB in all, and only selected bundles are fetched. Checksums, transforms and NiBabel geometry checks are in [`provenance.json`](https://github.com/JoshuaDuq/neuroatlas/blob/main/public/diffusion/snail-subject-1/provenance.json).

To reproduce the assets, download the archive named in [`data/diffusion.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/data/diffusion.yaml), then:

```bash
uv run python scripts/prepare_diffusion.py /path/to/bundles_2_subjects.tar.gz
uv run python scripts/prepare_diffusion_outline.py
uv run python scripts/prepare_diffusion_space.py
```

The first verifies DIPY's checksum and packages the bundles unchanged. The second draws the outline (T1 threshold 80, marching-cubes step 2 voxels). The third derives the scanner-to-surface mapping from the FreeSurfer import of the same T1.
