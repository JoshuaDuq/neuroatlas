"""Every region's centroid and anchor, and each anchor inside the region on the grid that defines it.

The anchor is where the linked MRI and a cut go to show a region, so landing in its own label is
the property that matters; it is checked on the published cut volumes for the cortex and aseg,
and on each other region's source grid.
"""

import nibabel as nib
import numpy as np

from .labels import nextbrain, white_matter
from .labels.tissue_labels import describe_source_label
from .layers import arterial_territories, cerebellar_functions, learning, spinal_cord
from .sources import read_color_table
from .validate_volumes import published_codes

PLACED_KINDS = {"cortex", "structure", "tissue-region"}


def label_at(labels, voxel_to_surface, ras):
    """The label of the voxel whose centre is `ras`; an anchor is always a voxel centre."""
    voxel = np.linalg.solve(
        np.asarray(voxel_to_surface, dtype=np.float64)[:3, :3],
        np.asarray(ras, dtype=np.float64) - np.asarray(voxel_to_surface)[:3, 3],
    )
    index = np.rint(voxel).astype(int)
    if not np.allclose(voxel, index, atol=1e-6):
        raise ValueError(f"An anchor at {ras} is not a voxel centre")
    return labels[tuple(index)]


def validate_fields(regions):
    for region in regions:
        if region["kind"] not in PLACED_KINDS:
            continue
        for field in ("centroid_ras_mm", "anchor_ras_mm"):
            value = region.get(field)
            if value is None or len(value) != 3 or not np.all(np.isfinite(value)):
                raise ValueError(f"{region['id']} has no {field}")


def validate_placements(config, manifest, tissues, nextbrain_source):
    regions = manifest["regions"]
    validate_fields(regions)
    by_atlas = {}
    for region in regions:
        if region["kind"] in PLACED_KINDS:
            by_atlas.setdefault(region["atlas"], []).append(region)

    image = nib.load(config["source_directory"] / "mri/aparc.a2009s+aseg.mgz")
    tkr = image.header.get_vox2ras_tkr()
    checked = {}
    on_surface = []

    def inside(region, labels, affine, accepted):
        if label_at(labels, affine, region["anchor_ras_mm"]) not in accepted:
            raise ValueError(f"{region['id']}'s anchor lies outside its own label")
        checked[region["atlas"]] = checked.get(region["atlas"], 0) + 1

    # The cortex and aseg on the cut volumes the viewer reads.
    for atlas in config["atlases"]:
        record = tissues["atlases"][atlas["id"]]
        codes = published_codes(config, record, image, atlas["id"])
        present = set(np.unique(codes).tolist())
        owned = {}
        for code, label in enumerate(record["labels"]):
            if label["region_id"] is not None and code in present:
                owned.setdefault(label["region_id"], set()).add(code)
        for region in by_atlas.get(atlas["id"], []):
            if region["id"] in owned:
                inside(region, codes, tkr, owned[region["id"]])
            else:
                on_surface.append(region["id"])
        if atlas["id"] == "destrieux":
            table = read_color_table()
            values = np.unique(np.asarray(image.dataobj))
            structures = {
                describe_source_label(int(value), table, regions)["region_id"]: {code}
                for code, value in enumerate(values)
            }
            for region in by_atlas.get("aseg", []):
                inside(region, codes, tkr, structures[region["id"]])

    if nextbrain.is_declared(config):
        grid, _ = nextbrain_source
        for region in by_atlas.get(nextbrain.ATLAS_ID, []):
            inside(region, grid.labels, grid.voxel_to_surface, {region["source_label_id"]})
        grids = {
            source: grid for source, grid, _, _ in learning.source_groups(config, nextbrain_source)
        }
        for region in by_atlas.get(learning.ATLAS_ID, []):
            grid = grids[region["source_atlas"]]
            inside(region, grid.labels, grid.voxel_to_surface, set(region["source_label_ids"]))
    if spinal_cord.is_declared(config):
        grid = spinal_cord.load(config)
        for region in by_atlas.get("pam50", []):
            inside(region, grid.labels, grid.voxel_to_surface, {region["volume_label"]})
    for module, load in (
        (white_matter, lambda: white_matter.load(config)),
        (arterial_territories, lambda: arterial_territories.load(
            config, arterial_territories.read_definition())),
        (cerebellar_functions, lambda: cerebellar_functions.load(config)),
    ):
        if not module.is_declared(config):
            continue
        source, values = load()
        for region in by_atlas.get(module.ATLAS_ID, []):
            inside(region, values, source.header.get_vox2ras_tkr(), {region["source_label_id"]})

    placed = sum(len(members) for members in by_atlas.values())
    if sum(checked.values()) + len(on_surface) != placed:
        raise ValueError("Some placed regions were not checked against their own label")
    return {
        "anchors_inside_own_label": checked,
        "placed_on_surface_no_ribbon_voxel": sorted(on_surface),
    }
