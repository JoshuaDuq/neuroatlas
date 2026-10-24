# Diffusion and tracts

The **Tracts** tab shows each anatomy's own tracts. On CDMD they are 30 bundles tracked here from its own diffusion scan. Seventeen come from DIPY (multi-shell CSD, particle filtering, RecoBundles against the HCP842 atlas). HCP842 does not divide the SLF or the callosum, so SLF I, II and III on each side and seven callosal segments come from TractSeg 2.10: rostrum, genu, rostral body (premotor), anterior midbody (primary motor), posterior midbody (primary somatosensory), isthmus and splenium, as segments 1 to 7. Both sets are resampled to 0.5 mm steps, which moves no point more than 0.24 mm. A few are on at first; switch on a side (L, R, or a numbered callosal segment) to load more. Colour encodes local direction: left–right red, anterior–posterior green, inferior–superior blue.

## On their own anatomy

CDMD is reconstructed from the T1 its tracts were tracked against, so the tracts sit on the real cortex through the exact scanner-to-surface transform. Regions, atlases, colours and the Section tool all work with tracts. **Cortex opacity** is shared with Display. Returning to Anatomy keeps the tracts; **Show tracts with anatomy** turns them off.

An anatomy without tracts of its own, such as a local `fsaverage` build, shows CDMD's alone, inside an outline drawn from its T1: an MRI isosurface, not a pial surface, with region details and stage tools hidden. Tracts are never placed on another brain. Each anatomy's tracts are named in one catalog, listed under `tract_catalogs` in `config/model.yaml`.

## Reading the list

Each row gives the streamline count, mean length and range. Counts are reconstructed streamlines, not axons; lengths are polyline arc lengths, not connection strength. The minimum-length slider filters on release. **Export lengths CSV** writes the loaded bundles and the active threshold. **Restore default tracts** returns to the first selection.

## MRI with tracts

**MRI with tracts** (or <kbd>M</kbd>) opens the tract reference's MRI (each anatomy's T1 and FA) with linked slices, a crosshair, zero-based voxel inputs and the selected tracts. Click, scroll, or use the arrows and Page Up/Down on a slice to move one voxel. On the tracts' own anatomy the crosshair also positions the cutting plane.

## Data

The TRK files are resampled to 0.5 mm steps, then gzip-compressed, about 177 MB in all; and only selected bundles are fetched. Checksums, transforms, the method behind each file and NiBabel geometry checks are in [`provenance.json`](https://github.com/JoshuaDuq/neuroatlas/blob/main/public/diffusion/cdmd-sub-013/provenance.json).

The RecoBundles tracts come from `scripts/cdmd_pilot.py`; `prepare_diffusion_space.py` and `prepare_diffusion_outline.py` derive the scanner-to-surface mapping and the outline from the reconstruction of the same T1.

## CDMD's TractSeg bundles and FA

[`scripts/tractseg_cdmd.py`](https://github.com/JoshuaDuq/neuroatlas/blob/main/scripts/tractseg_cdmd.py) follows TractSeg's own `csd_msmt` recipe with MRtrix3 3.0.8.
- **Shells:** it takes the Δ = 19 ms shells at b = 800–3450 plus b = 0 (242 volumes), the range nearest TractSeg's HCP training data.
- **Peaks:** Dhollander responses, multi-shell multi-tissue CSD and `sh2peaks`.
- **MNI alignment:** TractSeg normally uses FSL `flirt`. Here a rigid `mrregister` of the tensor FA to TractSeg's MNI FA template takes its place, with the FODs reoriented as they move. A check refuses the matrix unless the template's white matter lands on the scan's white matter: mean FA 0.505, against 0.307 for the inverse and 0.366 for no transform.
- **Tracking:** TractSeg's probabilistic tracking from its orientation maps, 2,000 streamlines per bundle. It is stochastic, so a rerun differs streamline by streamline.
- **Back to CDMD's frame:** streamlines return through the inverse rigid matrix and the pilot's recorded diffusion-to-T1 transform.
- **FA:** the tensor FA (b = 0, 800, 1500) is resampled trilinearly onto the T1 grid. It averages 0.62 in aseg's corpus callosum, 0.42 in cerebral white matter and 0.16 in the ventricles.

Against CDMD's RecoBundles tracts, the union of SLF I–III overlaps its SLF at Dice 0.46 on the left and 0.53 on the right, and the callosal segments overlap its whole callosum at 0.67. The two methods define these bundles differently.

```bash
uv run python scripts/tractseg_cdmd.py /path/to/cdmd-pilot
uv run python scripts/prepare_diffusion_cdmd.py /path/to/cdmd-pilot
```
