"""Cole-Anticevic network partition: one functional network per HCP-MMP1.0 area."""

import csv
import json
import shutil

from ..sources import ROOT, write_json

ATLAS_ID = "cab-np"
# CAB-NP partitions HCP-MMP1.0's areas, so it is carried by that atlas alone.
SURFACE_ATLAS = "hcp-mmp"
LABEL = "Cole-Anticevic Brain-wide Network Partition (CAB-NP) v1.1.6"
CITATION = "https://doi.org/10.1016/j.neuroimage.2018.10.006"
LICENSE = "CAB-NP License (Rutgers University and Yale University), non-commercial use only"
FILENAME = "cab-np.json"

SOURCE = ROOT / "data/cab-np"
LABEL_KEY = SOURCE / "CortexSubcortex_ColeAnticevic_NetPartition_wSubcorGSR_parcels_LR_LabelKey.txt"
LICENSE_TEXT = SOURCE / "LICENSE"

# The licence permits redistribution only with its terms and the original files,
# so both travel unchanged beside the assignments derived from them.
PUBLISHED_LICENSE = "CAB-NP.txt"
PUBLISHED_LABEL_KEY = "CAB-NP-LabelKey.txt"

HEMISPHERES = {"L": "left", "R": "right"}
AREAS_PER_HEMISPHERE = 180


def read_label_key(path=LABEL_KEY):
    """Each cortical area's network by (hemisphere, Glasser name), and the networks in key order."""
    with path.open(newline="") as handle:
        rows = [row for row in csv.DictReader(handle, delimiter="\t")
                if row["LABEL"].endswith("-Ctx")]
    areas = {}
    networks = {}
    for row in rows:
        hemisphere = HEMISPHERES[row["HEMISPHERE"]]
        name = row["GLASSERLABELNAME"]
        if not name.startswith(f"{row['HEMISPHERE']}_"):
            raise ValueError(f"{name}: listed under hemisphere {row['HEMISPHERE']}")
        if (hemisphere, name) in areas:
            raise ValueError(f"{name}: assigned twice")
        areas[hemisphere, name] = row["NETWORK"]
        key = int(row["NETWORKKEY"])
        entry = (row["NETWORK"], [int(row[channel]) for channel in ("RED", "GREEN", "BLUE")])
        if networks.setdefault(key, entry) != entry:
            raise ValueError(f"Network key {key} has more than one name or colour")
    for hemisphere in HEMISPHERES.values():
        count = sum(side == hemisphere for side, _ in areas)
        if count != AREAS_PER_HEMISPHERE:
            raise ValueError(f"{count} {hemisphere} areas, not {AREAS_PER_HEMISPHERE}")
    if sorted(networks) != list(range(1, len(networks) + 1)):
        raise ValueError("Network keys must run from 1 without gaps")
    return areas, [networks[key] for key in sorted(networks)]


def assign(regions, areas):
    """The network of every published HCP-MMP area, by region id."""
    assigned = {}
    for region in regions:
        if region["atlas"] != SURFACE_ATLAS or region["kind"] != "cortex":
            continue
        key = (region["hemisphere"], region["source_name"])
        if key not in areas:
            raise ValueError(f"CAB-NP does not assign {region['id']} ({region['source_name']})")
        assigned[region["id"]] = areas[key]
    if len(assigned) != len(areas):
        raise ValueError("CAB-NP assigns areas this anatomy does not publish")
    return assigned


def partition(regions):
    areas, networks = read_label_key()
    return {
        "id": ATLAS_ID,
        "atlas": SURFACE_ATLAS,
        "networks": [name for name, _ in networks],
        "colors": {name: color for name, color in networks},
        "regions": assign(regions, areas),
    }


def metadata():
    return {
        "id": ATLAS_ID,
        "file": FILENAME,
        "atlas": SURFACE_ATLAS,
        "label": LABEL,
        "citation": CITATION,
        "license": LICENSE,
        "license_file": f"../licenses/{PUBLISHED_LICENSE}",
        "source_file": f"../licenses/{PUBLISHED_LABEL_KEY}",
        "method": (
            "Each HCP-MMP1.0 area takes the network CAB-NP assigns it, matched by "
            "published area name in each hemisphere; carried per area, never per vertex"
        ),
    }


def export(config, regions):
    write_json(config["output_directory"] / FILENAME, partition(regions))
    licenses = config["output_directory"].parent / "licenses"
    shutil.copyfile(LICENSE_TEXT, licenses / PUBLISHED_LICENSE)
    shutil.copyfile(LABEL_KEY, licenses / PUBLISHED_LABEL_KEY)
    return metadata()


def validate(config, manifest):
    if manifest["cab_np"] != metadata():
        raise ValueError("Manifest CAB-NP metadata mismatch")
    published = json.loads((config["output_directory"] / FILENAME).read_text())
    if published != partition(manifest["regions"]):
        raise ValueError("CAB-NP assignments changed")
    licenses = config["output_directory"].parent / "licenses"
    for source, name in [(LICENSE_TEXT, PUBLISHED_LICENSE), (LABEL_KEY, PUBLISHED_LABEL_KEY)]:
        if (licenses / name).read_bytes() != source.read_bytes():
            raise ValueError(f"Published {name} differs from its source")
    counts = {}
    for network in published["regions"].values():
        counts[network] = counts.get(network, 0) + 1
    return {"assigned_areas": len(published["regions"]), "areas_per_network": counts}


def limitations():
    return [
        "CAB-NP networks come from group resting-state connectivity of Human Connectome Project participants, not from this brain's measured function, and reach this brain through the same HCP-MMP projection.",
        "CAB-NP assigns each HCP-MMP area whole to one network, so its colour boundaries are HCP-MMP's boundaries. It colours that atlas's areas only.",
        "CAB-NP assigns the hemispheres separately; 13 areas belong to a different network on each side, as published.",
    ]
