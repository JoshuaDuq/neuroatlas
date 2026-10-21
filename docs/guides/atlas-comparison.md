# Comparing cortical atlases

On SNAIL, select a Destrieux or HCP-MMP region and open **Compare atlases** in its details. The direction heading names the source and target atlases. Each row shows the shared pial area and its share of the selected region's **whole** pial surface. The unassigned remainder is shown explicitly. Open the additional-regions disclosure to see every smaller match.

The method, including why the two directions give different percentages, is in [Atlases](../concepts/atlases.md#comparing-destrieux-and-hcp-mmp).

## Outline an overlap

Activate a row to outline that exact intersection, then activate it again to clear the overlap. The selected source region, the current atlas and the scientific colours stay in place. Changing or hiding the source clears the outline. With a section active, the table still describes the whole region and explains why the outline controls are disabled.

The outline geometry loads only on the first request.

## Download the data

**Download CSV** exports every contribution, with unrounded areas and fractions, the complete denominator, the subject, the method, the source and asset checksums, and the atlas citations.

**Method and sources** explains the barycentric boundaries and the limits of the HCP projection.

This is a spatial comparison of two parcellations. It is not a claim of functional equivalence or clinical accuracy. Other published subjects do not yet declare comparison assets, so the table appears on SNAIL only.

## What the published files contain

The SNAIL build publishes two files alongside the cortical meshes:

- `atlas-comparison.json` records the region totals, every positive pair, the method, the units, the source annotation and pial SHA-256 hashes, the original cortical asset hashes, and the atlas citations.
- `atlas-overlaps.glb` carries the exact pair geometry.

The viewer checks both against their recorded checksums. The displayed values are rounded to one decimal. A nonzero value below 0.1 reads `<0.1`. The CSV keeps the raw double-precision fractions. The numbers themselves and how they were verified are on the [validation](../validation.md#atlas-correspondence) page.

## Publishing comparison assets

Comparison publishing is enabled for SNAIL in [`config/model.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/config/model.yaml). The normal build exports it. To add only the comparison assets to an existing publication, without rebuilding the anatomy:

```bash
uv run python -m brain_model.layers.comparison --anatomy snail
```
