"""Yeo resting-state networks, carried as a surface layer rather than an atlas."""

import numpy as np

from ..sources import declares

ATLAS_ID = "yeo7"
ANNOTATION = "Schaefer2018_400Parcels_7Networks_order"
LABEL = "Yeo 7-network cortical organisation"
CITATION = "https://doi.org/10.1152/jn.00338.2011"
PARCELLATION_CITATION = "https://doi.org/10.1093/cercor/bhx179"

# Published order. The index is what the vertex field stores, so it is part of
# the model's contract; 0 means no network, which is the medial wall.
NETWORKS = ["Vis", "SomMot", "DorsAttn", "SalVentAttn", "Limbic", "Cont", "Default"]

NONE = 0

# Published Yeo network colours. Schaefer jitters these per parcel so that 200
# parcels stay distinguishable, so the annotation holds a cluster around each
# rather than the colour itself; `verify_palette` checks the clusters still sit
# where these say they do, within config `networks.maximum_color_jitter`.
COLORS = {
    "Vis": [120, 18, 134],
    "SomMot": [70, 130, 180],
    "DorsAttn": [0, 118, 14],
    "SalVentAttn": [196, 58, 250],
    "Limbic": [220, 248, 164],
    "Cont": [230, 148, 34],
    "Default": [205, 62, 78],
}

# `7Networks_LH_Default_pCunPCC_11` -> prefix, hemisphere, network, then a
# sub-region name that varies in length. Only the first three fields are read.
_NETWORK_FIELD = 2
_PREFIX = "7Networks"


def network_of(parcel_name):
    fields = parcel_name.split("_")
    if fields[0] != _PREFIX:
        return None
    if len(fields) < _NETWORK_FIELD + 2:
        raise ValueError(f"{parcel_name}: not a Schaefer 7-network parcel name")
    network = fields[_NETWORK_FIELD]
    if network not in NETWORKS:
        raise ValueError(f"{parcel_name}: unknown Yeo network {network!r}")
    return network


def network_indices(labels, names):
    labels = np.asarray(labels)
    if labels.ndim != 1 or labels.dtype.kind not in "iu":
        raise ValueError("One integer parcel label is required per vertex")
    if labels.size and (labels.min() < -1 or labels.max() >= len(names)):
        raise ValueError("Parcel labels must index the annotation's name table")
    lookup = np.zeros(len(names) + 1, dtype=np.int8)
    for index, name in enumerate(names):
        network = network_of(name if isinstance(name, str) else name.decode())
        lookup[index] = NETWORKS.index(network) + 1 if network else NONE
    # -1 addresses the final slot, which is left at NONE.
    return lookup[labels]


def composition(indices, minimum_fraction=0.0):
    indices = np.asarray(indices)
    counts = np.bincount(indices[indices != NONE], minlength=len(NETWORKS) + 1)
    total = int(counts.sum())
    if not total:
        return []
    shares = [
        {"network": NETWORKS[index - 1], "fraction": int(count) / total}
        for index, count in enumerate(counts)
        if index != NONE and count and (int(count) / total) >= minimum_fraction
    ]
    shares.sort(key=lambda share: -share["fraction"])
    return shares


def verify_palette(ctab, names, maximum_jitter):
    for index, raw in enumerate(names):
        name = raw if isinstance(raw, str) else raw.decode()
        network = network_of(name)
        if not network:
            continue
        published = np.array(COLORS[network])
        drift = int(np.abs(np.asarray(ctab[index, :3], dtype=int) - published).max())
        if drift > maximum_jitter:
            raise ValueError(
                f"{name}: {drift} from the published {network} colour, "
                f"more than the {maximum_jitter} Schaefer's jitter explains"
            )


def annotation_path(directory, hemisphere):
    return directory / "label" / f"{hemisphere}.{ANNOTATION}.annot"


def is_declared(config):
    return declares(config, "networks")


def metadata():
    return {
        "id": ATLAS_ID,
        "label": LABEL,
        "networks": list(NETWORKS),
        "colors": {name: list(COLORS[name]) for name in NETWORKS},
        "citation": CITATION,
        "parcellation": {"annotation": ANNOTATION, "citation": PARCELLATION_CITATION},
        "attribute": "_NETWORK",
        "method": (
            "Schaefer2018 parcels collapsed to their published Yeo network; "
            "carried per vertex, never interpolated"
        ),
        "composition": (
            "Cortical parcels: shares of assigned source vertices. NextBrain "
            "cortical regions: shares of assigned projected cortical voxels. "
            "Unassigned samples are excluded; these are not surface-area shares."
        ),
    }
