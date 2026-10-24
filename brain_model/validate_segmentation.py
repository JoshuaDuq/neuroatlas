"""Measures of segmentation and reconstruction quality, from the sources themselves."""

import re

import nibabel as nib
import numpy as np

from .labels import nextbrain
from .labels.volumes import resample_nearest
from .layers.learning import combine_labels, expand_nextbrain, read_definition
from .sources import HEMISPHERES, ROOT, sha256

MEASURE = re.compile(r"^# Measure (\w+), [^,]+, [^,]+, ([^,]+), unitless\s*$", re.MULTILINE)


def dice(a, b):
    return 2 * np.count_nonzero(a & b) / (np.count_nonzero(a) + np.count_nonzero(b))


def surface_holes(config):
    """FreeSurfer's count of topological defect holes before it repaired the surfaces."""
    path = config["source_directory"] / config["anatomy"]["statistics"]
    measures = dict(MEASURE.findall(path.read_text()))
    holes = {side: int(measures[f"{prefix}SurfaceHoles"]) for prefix, side in HEMISPHERES.items()}
    if sum(holes.values()) != int(measures["SurfaceHoles"]):
        raise ValueError(f"{path.name}: hemisphere SurfaceHoles do not sum to the total")
    return {
        "source": str(path.relative_to(ROOT)),
        "sha256": sha256(path),
        "surface_holes": {**holes, "total": int(measures["SurfaceHoles"])},
    }


def segmentation_agreement(config):
    """Dice of each declared learning unit with its aseg label, on each side.

    aseg is carried onto the 0.4 mm NextBrain grid by nearest neighbour, so a
    score compares the two segmentations, not two grids. Two segmentations of
    one scan agreeing is not accuracy; it bounds how far either can be wrong
    without the other noticing.
    """
    settings = config["validation"]["segmentation_agreement"]
    grid, table = nextbrain.load(config)
    groups = [
        group
        for group in expand_nextbrain(read_definition(config)["nextbrain"], table)
        if group["id"].split(":")[1] in settings["aseg_labels"]
    ]
    if {group["id"].split(":")[1] for group in groups} != set(settings["aseg_labels"]):
        raise ValueError("Segmentation agreement names a unit learning does not define")
    units = combine_labels(grid.labels, groups)
    path = config["source_directory"] / "mri/aseg.mgz"
    aseg = nib.load(path)
    coarse, shift = resample_nearest(
        np.asarray(aseg.dataobj), aseg.header.get_vox2ras_tkr(),
        grid.voxel_to_surface, grid.labels.shape,
    )
    scores = {}
    for code, group in enumerate(groups, 1):
        side, name = group["id"].split(":")
        aseg_label = settings["aseg_labels"][name][side]
        scores.setdefault(name, {})[side] = dice(units == code, coarse == aseg_label)
    # An anatomy may lower the floor for one structure on one side, with the
    # measurements that justify it; one the score no longer needs is refused.
    exceptions = config["anatomy"].get("segmentation_agreement_exceptions", {})
    floors = {}
    for name, sides in exceptions.items():
        for side, exception in sides.items():
            if name not in scores or side not in scores[name]:
                raise ValueError(f"Segmentation agreement exception names no score: {name} {side}")
            if scores[name][side] >= settings["minimum_dice"]:
                raise ValueError(f"{name} {side} meets Dice {settings['minimum_dice']}; remove its exception")
            floors[(name, side)] = exception["minimum_dice"]
    low = {
        f"{name} {side}": round(score, 3)
        for name, sides in scores.items()
        for side, score in sides.items()
        if score < floors.get((name, side), settings["minimum_dice"])
    }
    if low:
        raise ValueError(f"NextBrain disagrees with aseg below Dice {settings['minimum_dice']}: {low}")
    return {
        "method": "Dice of each NextBrain learning-unit union with the same structure's "
        "aseg label, aseg resampled onto the NextBrain grid by nearest neighbour",
        "aseg_sha256": sha256(path),
        "aseg_labels": settings["aseg_labels"],
        "maximum_nearest_neighbour_shift_mm": shift,
        "minimum_dice": settings["minimum_dice"],
        **({"exceptions": exceptions} if exceptions else {}),
        "dice": scores,
    }
