"""How often NextBrain nearly tied each pair of touching labels in one brain.

scripts/segment_nextbrain.py records NextBrain's own posteriors as a near-tie
volume on the label grid: the runner-up label wherever the winning label led it
by less than a margin. A pair of touching labels is rated by the share of its
interface voxels where the model nearly chose the other label of the pair. It
measures the model's competition between labels, not agreement with another
segmentation.
"""

import json

import nibabel as nib
import numpy as np

from ..sources import ROOT, write_json
from . import nextbrain

ID = "boundary-certainty"
FILENAME = "boundary-certainty.json"


def is_published(config):
    """Only a subject segmentation has posteriors; a warped atlas has none."""
    return (
        nextbrain.is_declared(config)
        and config[nextbrain.ATLAS_ID]["procedure"] == nextbrain.SUBJECT_SEGMENTATION
    )


def path(config):
    settings = config[nextbrain.ATLAS_ID]
    return settings["directory"] / settings["near_ties"]


def verify_margin(config, provenance):
    """The recorded near-tie volume was made with the configured margin."""
    relative = str(path(config).relative_to(ROOT))
    recorded = next((s for s in provenance["sources"] if s["path"] == relative), None)
    if recorded is None:
        raise ValueError(
            f"{relative} is not recorded; run scripts/segment_nextbrain.py "
            f"--anatomy {config['anatomy']['id']} --record"
        )
    margin = config[nextbrain.ATLAS_ID]["near_tie_margin"]
    if recorded["near_ties"]["margin"] != margin:
        raise ValueError(
            f"{relative} was made with a {recorded['near_ties']['margin']} margin, not "
            f"the configured {margin}; run scripts/segment_nextbrain.py again"
        )


def same_hemisphere(a, b):
    return (a > nextbrain.HEMISPHERE_OFFSET) == (b > nextbrain.HEMISPHERE_OFFSET)


def load(config, grid):
    """The near-tie volume, checked against the labels it qualifies."""
    image = nib.load(path(config))
    placed = nextbrain.scanner_to_surface(config) @ image.affine
    if image.shape != grid.labels.shape or not np.allclose(
        placed, grid.voxel_to_surface, rtol=0, atol=1e-6
    ):
        raise ValueError("The NextBrain near-tie volume is not on its label grid")
    near_ties = np.asarray(image.dataobj).astype(np.int64)
    tied = near_ties != nextbrain.BACKGROUND
    winners, runners = grid.labels[tied], near_ties[tied]
    if np.any(winners == nextbrain.BACKGROUND):
        raise ValueError("A NextBrain near tie lies on an unlabelled voxel")
    if np.any(runners == winners):
        raise ValueError("A NextBrain near tie names its own winner as runner-up")
    # Each hemisphere is segmented on its own, so its runner-up is its own too.
    if not np.all(same_hemisphere(winners, runners)):
        raise ValueError("A NextBrain near tie crosses the midline")
    return near_ties


def rate(labels, near_ties, minimum):
    """[label, label, interface voxels, near-tie voxels] for each rated pair.

    An interface voxel of a pair is a voxel of either label with a face neighbour
    in the other, counted once. Pairs across the midline are not rated: each
    hemisphere is segmented separately, so their boundary is the join's.
    """
    values, dense = np.unique(labels, return_inverse=True)
    dense = dense.reshape(labels.shape)
    count = len(values)
    index = np.arange(labels.size).reshape(labels.shape)
    keys, voxels = [], []
    for axis in range(3):
        ahead, behind = [slice(None)] * 3, [slice(None)] * 3
        ahead[axis], behind[axis] = slice(1, None), slice(None, -1)
        a, b = dense[tuple(behind)], dense[tuple(ahead)]
        label_a, label_b = labels[tuple(behind)], labels[tuple(ahead)]
        touching = (
            (a != b)
            & (label_a != nextbrain.BACKGROUND)
            & (label_b != nextbrain.BACKGROUND)
            & same_hemisphere(label_a, label_b)
        )
        key = np.minimum(a, b)[touching] * count + np.maximum(a, b)[touching]
        keys += [key, key]
        voxels += [index[tuple(behind)][touching], index[tuple(ahead)][touching]]
    pair, voxel = np.divmod(
        np.unique(np.concatenate(keys) * labels.size + np.concatenate(voxels)), labels.size
    )
    low, high = values[pair // count], values[pair % count]
    winner, runner = labels.ravel()[voxel], near_ties.ravel()[voxel]
    tied = np.where(winner == low, runner == high, runner == low)
    pairs, starts, sizes = np.unique(pair, return_index=True, return_counts=True)
    near = np.add.reduceat(tied.astype(np.int64), starts)
    rated = sizes >= minimum
    return [
        [int(values[key // count]), int(values[key % count]), int(size), int(ties)]
        for key, size, ties in zip(pairs[rated], sizes[rated], near[rated])
    ]


def metadata(config):
    settings = config[nextbrain.ATLAS_ID]
    return {
        "id": ID,
        "file": FILENAME,
        "atlas": nextbrain.ATLAS_ID,
        "near_tie_margin": settings["near_tie_margin"],
        "minimum_interface_voxels": settings["minimum_interface_voxels"],
        "voxel_spacing_mm": settings["segmentation_spacing_mm"],
        "method": (
            "For each pair of touching NextBrain labels in one hemisphere, the voxels of "
            "either label with a face neighbour in the other, on the segmentation grid; "
            "of those, the ones where NextBrain's two most probable labels were this "
            "pair and the winner's posterior led by less than the margin"
        ),
    }


def document_fields(config):
    """What the published file repeats from the metadata, for the viewer's note."""
    described = metadata(config)
    return {
        field: described[field]
        for field in ("id", "atlas", "near_tie_margin", "voxel_spacing_mm")
    }


def export(config, regions):
    grid, _ = nextbrain.load(config)
    settings = config[nextbrain.ATLAS_ID]
    published = {region["id"] for region in regions}
    rows = []
    for a, b, interface, near in rate(
        grid.labels, load(config, grid), settings["minimum_interface_voxels"]
    ):
        ids = [nextbrain.region_id_of(a), nextbrain.region_id_of(b)]
        missing = [region_id for region_id in ids if region_id not in published]
        if missing:
            raise ValueError(f"A rated boundary has no published region: {missing}")
        rows.append([*ids, interface, near])
    write_json(config["output_directory"] / FILENAME, {**document_fields(config), "pairs": rows})
    return metadata(config)


def recount(labels, near_ties):
    """Interface and near-tie voxels per same-hemisphere pair, keyed by label pair.

    Counted per voxel and the label it touches, not per pair, so the check does
    not share the code it checks.
    """
    padded = np.pad(labels, 1, constant_values=nextbrain.BACKGROUND)
    own = labels.ravel()
    entries = []
    for axis in range(3):
        for shift in (1, -1):
            other = np.roll(padded, shift, axis)[1:-1, 1:-1, 1:-1].ravel()
            touching = np.flatnonzero(
                (other != own)
                & (other != nextbrain.BACKGROUND)
                & (own != nextbrain.BACKGROUND)
                & same_hemisphere(own, other)
            )
            entries.append(np.column_stack([touching, other[touching]]))
    voxel, other = np.unique(np.vstack(entries), axis=0).T
    winner = own[voxel]
    tied = near_ties.ravel()[voxel] == other
    pairs, inverse = np.unique(
        np.column_stack([np.minimum(winner, other), np.maximum(winner, other)]),
        axis=0, return_inverse=True,
    )
    interface = np.bincount(inverse, minlength=len(pairs))
    near = np.bincount(inverse, weights=tied, minlength=len(pairs)).astype(np.int64)
    counts = {
        (int(a), int(b)): (int(size), int(ties))
        for (a, b), size, ties in zip(pairs, interface, near)
    }
    tied_voxels = int(np.count_nonzero(near_ties))
    # A near tie whose runner-up is a face neighbour's label lies on that boundary.
    on_boundary = int(np.unique(voxel[tied]).size)
    return counts, tied_voxels, on_boundary


def validate(config, manifest, nextbrain_source):
    if manifest["boundary_certainty"] != metadata(config):
        raise ValueError("Manifest boundary-certainty metadata mismatch")
    grid, _ = nextbrain_source
    near_ties = load(config, grid)
    published = json.loads((config["output_directory"] / FILENAME).read_text())
    if {key: published[key] for key in published if key != "pairs"} != document_fields(config):
        raise ValueError("Boundary certainty does not describe itself as its metadata does")
    regions = {
        region["id"]: region for region in manifest["regions"]
        if region["atlas"] == nextbrain.ATLAS_ID
    }
    counts, tied_voxels, on_boundary = recount(grid.labels, near_ties)
    minimum = config[nextbrain.ATLAS_ID]["minimum_interface_voxels"]
    expected = {pair: value for pair, value in counts.items() if value[0] >= minimum}
    found = {}
    for a, b, interface, near in published["pairs"]:
        if a not in regions or b not in regions:
            raise ValueError(f"A rated boundary has no published region: {a}, {b}")
        pair = tuple(sorted((regions[a]["source_label_id"], regions[b]["source_label_id"])))
        if pair in found:
            raise ValueError(f"Boundary {a}, {b} is rated twice")
        found[pair] = (interface, near)
    if found != expected:
        wrong = sorted(set(found.items()) ^ set(expected.items()))[:5]
        raise ValueError(f"Boundary certainty differs from a recount: {wrong}")
    interface = np.array([value[0] for value in found.values()])
    near = np.array([value[1] for value in found.values()])
    return {
        "file": FILENAME,
        "rated_pairs": len(found),
        "pairs_below_minimum": len(counts) - len(found),
        "share_of_interface_voxels_rated": float(
            interface.sum() / sum(value[0] for value in counts.values())
        ),
        "median_near_tie_share": float(np.median(near / interface)),
        "interface_weighted_near_tie_share": float(near.sum() / interface.sum()),
        "near_tie_voxels": tied_voxels,
        "share_of_near_ties_against_a_face_neighbour": on_boundary / tied_voxels,
    }
