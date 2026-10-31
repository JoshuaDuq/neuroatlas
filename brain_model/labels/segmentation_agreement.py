"""Where NextBrain and aseg agree on the structures validation compares, on aseg's grid.

Validation scores each structure's NextBrain union against aseg on NextBrain's
0.4 mm grid, where part of every disagreement is aseg's 1 mm staircase. For a
picture of the disagreement itself, each union is voxelised onto aseg's 1 mm
grid: a 1 mm voxel belongs to it when more than half of the 0.4 mm voxels whose
nearest 1 mm voxel it is do. Neither segmentation is the reference.
"""

import json

import nibabel as nib
import numpy as np

from ..layers.learning import combine_labels, expand_nextbrain, read_definition
from ..sources import write_json
from ..validate_volumes import decode_record, on_source_grid
from . import nextbrain
from .volumes import axis_lookup, encode_cropped_array

ID = "segmentation-agreement"
FILENAME = "segmentation-agreement.json"
VOLUME = "nextbrain-compared.volume"


def compared_groups(config, table):
    """The NextBrain learning units validation compares with aseg, in a fixed order."""
    names = config["validation"]["segmentation_agreement"]["aseg_labels"]
    groups = [
        group
        for group in expand_nextbrain(read_definition(config)["nextbrain"], table)
        if group["id"].split(":")[1] in names
    ]
    if {group["id"].split(":")[1] for group in groups} != set(names):
        raise ValueError("Segmentation agreement names a unit learning does not define")
    return groups


def aseg_image(config):
    return nib.load(config["source_directory"] / "mri/aseg.mgz")


def voxelise(units, grid, image):
    """Each unit's code on aseg's grid where it holds over half of the cell, else 0."""
    aseg_to_surface = image.header.get_vox2ras_tkr()
    order, indices, valid, _ = axis_lookup(
        aseg_to_surface, image.shape, grid.voxel_to_surface, units.shape
    )
    # The 1 mm cell of every 0.4 mm voxel, flattened; -1 off aseg's grid.
    cells = np.full(units.shape, -1, np.int64)
    inside = np.ix_(*[np.flatnonzero(valid[b]) for b in range(3)])
    flat = np.ravel_multi_index(
        np.meshgrid(*[indices[b][valid[b]] for b in range(3)], indexing="ij"), image.shape
    )
    cells.transpose(order)[inside] = flat
    if np.any(units[cells < 0]):
        raise ValueError("A compared NextBrain unit lies outside aseg's grid")
    size = np.bincount(cells[cells >= 0], minlength=int(np.prod(image.shape)))
    codes = np.zeros(size.size, np.uint8)
    for code in range(1, int(units.max()) + 1):
        hits = np.bincount(cells[units == code], minlength=size.size)
        codes[hits * 2 > size] = code
    return codes.reshape(image.shape)


def count(compared, aseg, code, label):
    ours, theirs = compared == code, aseg == label
    return {
        "both": int(np.count_nonzero(ours & theirs)),
        "aseg_only": int(np.count_nonzero(theirs & ~ours)),
        "nextbrain_only": int(np.count_nonzero(ours & ~theirs)),
    }


def structures(config, groups, present, compared, aseg, regions):
    """One record per compared structure, with the published regions it gathers."""
    labels = config["validation"]["segmentation_agreement"]["aseg_labels"]
    published = {region["id"] for region in regions}
    records = []
    for code, group in enumerate(groups, 1):
        side, name = group["id"].split(":")
        label = labels[name][side]
        aseg_region = f"aseg:{side}:{label}"
        learning_region = f"learning:{group['id']}"
        members = [
            nextbrain.region_id_of(index) for index in group["labels"] if index in present
        ]
        missing = [
            region_id for region_id in [aseg_region, learning_region, *members]
            if region_id not in published
        ]
        if missing:
            raise ValueError(f"A compared structure names no published region: {missing}")
        records.append({
            "code": code,
            "structure": name,
            "hemisphere": side,
            "aseg_label": label,
            "regions": {"aseg": aseg_region, "learning": learning_region, "nextbrain": members},
            "voxels": count(compared, aseg, code, label),
        })
    return records


def metadata(config):
    return {
        "id": ID,
        "file": FILENAME,
        "reference_atlas": "aseg",
        "compared_atlas": nextbrain.ATLAS_ID,
        "method": (
            "Each NextBrain learning-unit union validation compares with aseg, voxelised "
            "onto aseg's 1 mm grid: a voxel belongs to the union when more than half of "
            "the 0.4 mm voxels whose nearest aseg voxel it is belong to it. Voxels are "
            "then counted where both segmentations, only aseg or only NextBrain label "
            "the structure"
        ),
    }


def export(config, regions):
    grid, table = nextbrain.load(config)
    groups = compared_groups(config, table)
    image = aseg_image(config)
    aseg = np.asarray(image.dataobj)
    compared = voxelise(combine_labels(grid.labels, groups), grid, image)
    record = encode_cropped_array(
        compared, image.header.get_vox2ras_tkr(), image.header.get_zooms()[:3],
        config["output_directory"] / VOLUME, np.dtype("uint8"),
    )
    write_json(config["output_directory"] / FILENAME, {
        "id": ID,
        "voxel_volume_mm3": float(np.prod(image.header.get_zooms()[:3])),
        "structures": structures(
            config, groups, set(np.unique(grid.labels).tolist()), compared, aseg, regions
        ),
    })
    return {**metadata(config), "volume": record}


def limitations():
    return [
        "Segmentation agreement compares NextBrain, voxelised onto aseg's 1 mm grid, with aseg for five structures per side. Agreement between two segmentations of one scan is not accuracy, and neither is the reference; NextBrain's own boundary certainty does not measure it.",
    ]


def revoxelise(units, grid, image):
    """The voxelisation again, from each voxel centre's own position.

    Placed point by point through the full affines rather than per axis, so the
    check does not share the code it checks.
    """
    to_aseg = np.linalg.inv(image.header.get_vox2ras_tkr()) @ grid.voxel_to_surface
    axes = []
    for b in range(3):
        steps = np.zeros((units.shape[b], 3))
        steps[:, b] = np.arange(units.shape[b])
        axes.append(steps @ to_aseg[:3, :3].T)
    nearest = [
        np.rint(axes[0][:, None, None, k] + axes[1][None, :, None, k] + axes[2][None, None, :, k]
                + to_aseg[k, 3]).astype(np.int64)
        for k in range(3)
    ]
    on_grid = np.ones(units.shape, bool)
    for k in range(3):
        on_grid &= (nearest[k] >= 0) & (nearest[k] < image.shape[k])
    cell = np.ravel_multi_index([np.where(on_grid, n, 0) for n in nearest], image.shape)
    if np.any(units[~on_grid]):
        raise ValueError("A compared NextBrain unit lies outside aseg's grid")
    keys, counts = np.unique(
        cell[on_grid].astype(np.int64) * 256 + units[on_grid], return_counts=True
    )
    voxel, code = np.divmod(keys, 256)
    total = np.zeros(int(np.prod(image.shape)), np.int64)
    np.add.at(total, voxel, counts)
    expected = np.zeros(total.size, np.uint8)
    wins = (code > 0) & (counts * 2 > total[voxel])
    expected[voxel[wins]] = code[wins]
    return expected.reshape(image.shape)


def validate(config, manifest, nextbrain_source):
    published = manifest["segmentation_agreement"]
    if {key: value for key, value in published.items() if key != "volume"} != metadata(config):
        raise ValueError("Manifest segmentation-agreement metadata mismatch")
    grid, table = nextbrain_source
    groups = compared_groups(config, table)
    image = aseg_image(config)
    record = published["volume"]
    if record["file"] != VOLUME or record["dtype"] != "|u1":
        raise ValueError("Segmentation agreement volume is not the declared uint8 file")
    compared, _ = on_source_grid(record, decode_record(config, record, VOLUME), image, VOLUME)
    if not np.array_equal(compared, revoxelise(combine_labels(grid.labels, groups), grid, image)):
        raise ValueError("The compared NextBrain volume differs from a revoxelisation")
    aseg = np.asarray(image.dataobj)
    document = json.loads((config["output_directory"] / FILENAME).read_text())
    present = set(np.unique(grid.labels).tolist())
    expected = structures(config, groups, present, compared, aseg, manifest["regions"])
    if document["structures"] != expected:
        raise ValueError("Segmentation agreement counts differ from a recount")
    return {
        "file": FILENAME,
        "dice_on_aseg_grid": {
            f"{item['structure']} {item['hemisphere']}": round(
                2 * item["voxels"]["both"]
                / (2 * item["voxels"]["both"] + item["voxels"]["aseg_only"]
                   + item["voxels"]["nextbrain_only"]),
                4,
            )
            for item in expected
        },
    }
