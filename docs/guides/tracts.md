# Diffusion and tracts

The **Tracts** tab shows each anatomy's own tracts. On SNAIL they are the 27 reconstructed bundles of subject 1 of DIPY's SNAIL example dataset ([CC0](https://hdl.handle.net/1773/38477)); on CDMD, 17 bundles tracked here from its own diffusion scan with DIPY (multi-shell CSD, particle filtering, RecoBundles against the HCP842 atlas) and resampled from 0.2 mm to 0.5 mm steps, which moves no point more than 0.056 mm. A few are on at first; switch on a side (L, R, or a numbered callosal segment) to load more. Colour encodes local direction: left–right red, anterior–posterior green, inferior–superior blue.

## On their own anatomy

SNAIL and CDMD are each reconstructed from the T1 their tracts were tracked against, so the tracts sit on the real cortex through the exact scanner-to-surface transform. Regions, atlases, colours and the Section tool all work with tracts. **Cortex opacity** is shared with Display. Returning to Anatomy keeps the tracts; **Show tracts with anatomy** turns them off.

An anatomy without tracts of its own would show SNAIL's alone, inside an outline drawn from its T1: an MRI isosurface, not a pial surface, with region details and stage tools hidden. Tracts are never placed on another brain. Each anatomy's tracts are named in one catalog, listed under `tract_catalogs` in `config/model.yaml`.

## Reading the list

Each row gives the streamline count, mean length and range. Counts are reconstructed streamlines, not axons; lengths are polyline arc lengths, not connection strength. The minimum-length slider filters on release. **Export lengths CSV** writes the loaded bundles and the active threshold. **Restore default tracts** returns to the first selection.

## MRI with tracts

**MRI with tracts** (or <kbd>M</kbd>) opens the tract reference's MRI (SNAIL's T1 and FA, CDMD's T1) with linked slices, a crosshair, zero-based voxel inputs and the selected tracts. Click, scroll, or use the arrows and Page Up/Down on a slice to move one voxel. On the tracts' own anatomy the crosshair also positions the cutting plane.

## Data

The TRK files are compressed losslessly: every point and streamline is kept, about 113 MB in all, and only selected bundles are fetched. Checksums, transforms and NiBabel geometry checks are in [`provenance.json`](https://github.com/JoshuaDuq/neuroatlas/blob/main/public/diffusion/snail-subject-1/provenance.json).

To reproduce the assets, download the archive named in [`data/diffusion.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/data/diffusion.yaml), then:

```bash
uv run python scripts/prepare_diffusion.py /path/to/bundles_2_subjects.tar.gz
uv run python scripts/prepare_diffusion_outline.py
uv run python scripts/prepare_diffusion_space.py
```

The first verifies DIPY's checksum and packages the bundles unchanged. The second draws the outline (T1 threshold 80, marching-cubes step 2 voxels). The third derives the scanner-to-surface mapping from the FreeSurfer import of the same T1.
