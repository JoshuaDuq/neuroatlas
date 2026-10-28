# Diffusion and tracts

The **Tracts** tab displays bundles reconstructed from diffusion MRI. CDMD has 30 bundles derived from the same subject's diffusion scan and displayed with its reconstructed T1 anatomy.

## Explore the bundles

Select a side (L or R), or a numbered callosal segment, to load a bundle. A subset is visible initially. Use **Restore default tracts** to return to that selection. The **Section** and **Display** controls work with the tracts; cortex opacity is shared between the Tracts tab and Display. Tracts remain visible when you return to Anatomy until you switch off **Show tracts with anatomy**.

Streamline colour represents local direction:

| Colour | Direction |
| :--- | :--- |
| Red | Left–right |
| Green | Anterior–posterior |
| Blue | Inferior–superior |

Each row reports a streamline count, mean length and range. Use the minimum-length slider to filter the display; **Export lengths CSV** exports loaded bundles with the active threshold. The CSV uses English bundle names regardless of interface language. Hidden bundles and bundles with no streamlines above the threshold have zero enabled streamlines and blank length statistics. Streamline counts are not axon counts, and polyline lengths are not measures of connection strength.

## Compare with MRI

Choose **MRI with tracts** or press <kbd>M</kbd> to see the tract reference's T1 and FA images with linked slices and a crosshair. Click or scroll on a slice, or use the arrow keys and Page Up/Down, to move through voxels. The voxel inputs are zero-based. When the tracts belong to the displayed anatomy, the crosshair also positions the cutting plane.

For an anatomy without its own tracts, such as a local `fsaverage` build, the viewer shows CDMD's tracts separately within an outline derived from CDMD's T1. It does not place those tracts on the other anatomy.

## Sources and interpretation

Seventeen CDMD bundles were generated using DIPY and RecoBundles against the HCP842 atlas. The remaining 13 use TractSeg 2.10: SLF I–III on each side and seven callosal segments (rostrum, genu, rostral body, anterior midbody, posterior midbody, isthmus and splenium). Both sets are resampled to 0.5 mm steps, after each streamline end that ran past the brain into CSF is trimmed back to the last point inside it: DIPY stops RecoBundles tracking on diffusion-resolution tissue maps, so up to half a bundle’s streamlines overshot the pial surface by as much as 5 mm. They are reconstructions from diffusion data, not direct observations of individual axons.

The compressed TRK files are loaded only when selected. Their checksums, transforms, methods and geometry checks are recorded in [`provenance.json`](https://github.com/JoshuaDuq/neuroatlas/blob/main/public/diffusion/cdmd-sub-013/provenance.json). See [Validation and limits](../validation.md#tracts) for the checks and [References and licensing](../reference/references.md) for the source terms.

## CDMD's TractSeg bundles and FA

[`scripts/tractseg_cdmd.py`](https://github.com/JoshuaDuq/neuroatlas/blob/main/scripts/tractseg_cdmd.py) follows TractSeg's `csd_msmt` recipe with MRtrix3 3.0.8:

- **Input:** 242 volumes from the Δ = 19 ms shells, b = 800–3450 and b = 0.
- **Peaks:** Dhollander responses, multi-shell multi-tissue CSD and `sh2peaks`.
- **Alignment:** rigid `mrregister` aligns tensor FA to TractSeg's MNI FA template in place of FSL `flirt`; FODs are reoriented. A check rejects the transform unless template white matter lands on scan white matter. Mean FA there is 0.505, versus 0.307 for the inverse and 0.366 without a transform.
- **Tracking:** probabilistic tracking generates 2,000 streamlines per bundle. It is stochastic, so individual streamlines differ on rerun. The inverse rigid transform and recorded diffusion-to-T1 transform return them to CDMD's frame.
- **FA:** tensor FA (b = 0, 800, 1500) is resampled trilinearly onto the T1 grid. Mean FA is 0.62 in aseg's corpus callosum, 0.42 in cerebral white matter and 0.16 in the ventricles.

The union of TractSeg's SLF I–III overlaps the RecoBundles SLF at Dice 0.46 left and 0.53 right; its callosal segments overlap the RecoBundles whole callosum at 0.67. The methods define bundles differently, so these values are comparisons between reconstructions, not accuracy against ground truth.

To regenerate and package these outputs after installing the prerequisites described in [Building an anatomy](building.md#regenerating-sources):

```bash
uv run python scripts/tractseg_cdmd.py /path/to/cdmd-pilot
uv run python scripts/prepare_diffusion_cdmd.py /path/to/cdmd-pilot
```
