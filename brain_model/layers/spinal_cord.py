"""This brain's cervical cord: SCT's segmentation, with PAM50's tracts and grey matter registered to it.

scripts/segment_spinal_cord.py writes three volumes beside the subject's MRI:
PAM50's most probable region per voxel on a grid around the cord, SCT's cord
segmentation and its vertebral levels, the last two on the source T1's grid.
"""

import nibabel as nib
import numpy as np

from ..labels import nextbrain
from ..labels.volumes import LabelGrid
from ..sources import declares, sha256

ATLAS_ID = "pam50"
# PAM50's white-matter atlas: 30 tracts and 6 grey-matter regions, left then right.
ATLAS_REGIONS = 36
FILES = {
    "regions": "pam50-regions.nii.gz",
    "segmentation": "sct-cord.nii.gz",
    "levels": "sct-levels.nii.gz",
}
LEVEL_NAMES = {**{n: f"C{n}" for n in range(1, 8)}, **{n + 7: f"T{n}" for n in range(1, 13)}}

NOTES = {
    "en": "This brain’s own cord, segmented from its T1 with the Spinal Cord Toolbox. "
          "The tracts and grey matter inside it are the PAM50 atlas registered to that cord: "
          "the 1 mm scan does not resolve them in this person.",
    "fr": "La moelle de ce cerveau, segmentée sur son IRM T1 avec la Spinal Cord Toolbox. "
          "Les faisceaux et la substance grise qu’elle contient sont l’atlas PAM50 recalé sur "
          "cette moelle : l’IRM à 1 mm ne les résout pas chez cette personne.",
}


def is_declared(config):
    return declares(config, "spinal_cord")


def paths(config):
    directory = config["source_directory"] / "spinal-cord"
    return {key: directory / name for key, name in FILES.items()}


def scanner_grid(config, path):
    """A label volume and where its voxel centres sit in the subject's surface RAS."""
    image = nib.load(path)
    labels = np.asarray(image.dataobj)
    if not np.array_equal(labels, np.rint(labels)) or labels.min() < 0:
        raise ValueError(f"{path.name} must hold nonnegative integer labels")
    return LabelGrid(
        labels.astype(np.int64),
        nextbrain.scanner_to_surface(config) @ image.affine,
        [float(x) for x in image.header.get_zooms()[:3]],
    )


def load(config):
    """PAM50's regions as atlas index + 1, on the atlas grid; 0 outside the cord."""
    grid = scanner_grid(config, paths(config)["regions"])
    spacing = config["spinal_cord"]["atlas_spacing_mm"]
    if not np.allclose(grid.spacing_mm, spacing, rtol=1e-4):
        raise ValueError(f"PAM50 regions must sit on a {spacing} mm grid")
    present = set(np.unique(grid.labels).tolist()) - {0}
    expected = published_labels(config)
    if present != expected:
        raise ValueError(
            f"PAM50 regions missing from this cord: {sorted(expected - present)}, "
            f"unexpected: {sorted(present - expected)}"
        )
    return grid


def published_labels(config):
    """Volume labels (atlas index + 1) of every region but the unresolved ones."""
    unresolved = set(config["spinal_cord"]["unresolved"]["atlas"])
    return {index + 1 for index in range(ATLAS_REGIONS) if index not in unresolved}


def levels(config):
    """The vertebral levels SCT labelled on the cord, top to bottom."""
    grid = scanner_grid(config, paths(config)["levels"])
    return [LEVEL_NAMES[int(level)] for level in np.unique(grid.labels) if level > 0]


def label_table(config):
    """Each region's volume label: its structure, side and PAM50 atlas index."""
    table = {}
    for structure in config["spinal_cord"]["structures"]:
        for hemisphere, index in zip(("left", "right"), structure["atlas"]):
            table[index + 1] = (structure, hemisphere, index)
    if sorted(table) != sorted(published_labels(config)):
        raise ValueError("The cord's structures must name every resolved PAM50 region once")
    return table


def partner_of(label):
    """The same region on the other side: PAM50 lists each left region before its right."""
    return label + 1 if label % 2 else label - 1


def describer(config):
    table = label_table(config)
    families = config["spinal_cord"]["families"]
    reach = levels(config)
    notes = {
        lang: f"{note} {span}" for (lang, note), span in zip(NOTES.items(), (
            f"It reaches {reach[0]}–{reach[-1]}, where the scan ends.",
            f"Elle atteint {reach[0]}–{reach[-1]}, où l’IRM s’arrête.",
        ))
    }

    def describe(label):
        structure, hemisphere, index = table[label]
        family = structure["family"]
        return {
            "id": f"{ATLAS_ID}:{hemisphere}:{structure['id']}",
            "atlas": ATLAS_ID,
            "label": f"{structure['names']['en']} · {hemisphere}",
            "source_name": f"{hemisphere} {structure['source_name']}",
            # PAM50's own region ID; the published volume stores it plus one.
            "source_label_id": index,
            "volume_label": label,
            "kind": "structure",
            "hemisphere": hemisphere,
            "supplemental": True,
            "mri_registered": True,
            "tissue": structure["tissue"],
            "display_names": dict(structure["names"]),
            "system_names": {"en": "Spinal cord", "fr": "Moelle épinière"},
            "family": family,
            "family_names": dict(families[family]),
            "family_order": list(families).index(family),
            "aliases": {lang: list(structure.get("aliases", {}).get(lang, [])) for lang in ("en", "fr")},
            "notes": notes,
        }, structure["color"]

    return describe


def layer(config, built, regions, path):
    """The supplemental layer record around build_structure_layer's output."""
    settings = config["spinal_cord"]
    grid = load(config)
    corners = grid.voxel_to_surface @ np.array(
        [[i, j, k, 1] for i in (0, grid.labels.shape[0] - 1)
         for j in (0, grid.labels.shape[1] - 1) for k in (0, grid.labels.shape[2] - 1)]
    ).T
    return {
        "id": ATLAS_ID,
        "label": "PAM50 cord atlas on this brain’s spinal cord",
        **built,
        "region_count": len(regions),
        "sha256": sha256(path),
        "citations": settings["citations"],
        "license": settings["license"],
        "license_file": f"../licenses/{settings['license_file']}",
        "attribution": settings["attribution"],
        "vertebral_levels": levels(config),
        # The atlas grid holds every cord voxel, so its box bounds every surface.
        "bounds_ras_mm": [corners[:3].min(axis=1).tolist(), corners[:3].max(axis=1).tolist()],
    }


def limitations(config):
    settings = config["spinal_cord"]
    reach = levels(config)
    return [
        NOTES["en"],
        (f"The cord is published from the medulla to {reach[-1]}, where this scan ends; it has "
         "no nerve roots, and the cord below is not shown."),
        ("A voxel takes the PAM50 region with the highest registered probability, so region "
         f"borders are the atlas's, at its {settings['atlas_spacing_mm']:g} mm spacing."),
        (f"PAM50's {settings['unresolved']['names']['en'].lower()} is not published: it is no "
         "voxel's most probable region, and its voxels belong to its neighbours."),
    ]


def cord_agreement(config, grid):
    """The registered atlas's cord against SCT's segmentation, on the segmentation's grid."""
    segmentation = scanner_grid(config, paths(config)["segmentation"])
    voxels = np.argwhere(np.ones(segmentation.labels.shape, bool))
    points = nib.affines.apply_affine(segmentation.voxel_to_surface, voxels)
    inside = np.rint(nib.affines.apply_affine(np.linalg.inv(grid.voxel_to_surface), points)).astype(int)
    valid = np.all((inside >= 0) & (inside < grid.labels.shape), axis=1)
    atlas = np.zeros(len(voxels), bool)
    atlas[valid] = grid.labels[tuple(inside[valid].T)] > 0
    segmented = segmentation.labels[tuple(voxels.T)] > 0
    # The atlas starts at C1; compare only the slices it covers.
    covered = np.unique(voxels[atlas, 2])
    on = np.isin(voxels[:, 2], covered)
    a, s = atlas[on], segmented[on]
    return {
        "dice": float(2 * np.count_nonzero(a & s) / (np.count_nonzero(a) + np.count_nonzero(s))),
        "atlas_mm3": float(np.count_nonzero(a) * np.prod(segmentation.spacing_mm)),
        "segmentation_mm3": float(np.count_nonzero(s) * np.prod(segmentation.spacing_mm)),
        "slices_compared": len(covered),
    }
