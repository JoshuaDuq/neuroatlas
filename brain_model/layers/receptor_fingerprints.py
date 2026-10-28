"""Receptor fingerprints: autoradiographic receptor densities, carried to regions by name."""

import json
import re

import yaml

from ..sources import ROOT, write_json

ATLAS_ID = "receptor-fingerprints"
FILENAME = "receptor-fingerprints.json"
DEFINITION = ROOT / "config/receptor-fingerprints.yaml"
DATA = ROOT / "data/receptor-fingerprints.json"
FILE_KINDS = ("fingerprint", "subjects", "samples")
PARTS = ("dorsal", "ventral")
# aseg names a structure with its side; the other atlases name it once per hemisphere.
SIDE_PREFIX = {"aseg": {"left": "Left-", "right": "Right-"}}
DOI = re.compile(r"https://doi\.org/10\.\d{4,9}/\S+")
SHA256 = re.compile(r"[0-9a-f]{64}")


def check_sources(sources):
    for key, source in sources.items():
        if not all(source.get(field) for field in ("short", "citation", "doi", "pmid")):
            raise ValueError(f"Source {key} needs a short name, citation, DOI and PMID")
        # That the DOI and PMID name the cited work is checked against the fetched
        # records by web/src/lib/core/learning/references.test.ts.
        if not (DOI.fullmatch(source["doi"]) and isinstance(source["pmid"], int) and source["pmid"] > 0):
            raise ValueError(f"Source {key} needs a doi.org DOI and an integer PMID")


def check_transmitters(transmitters):
    receptors = {}
    for transmitter in transmitters:
        for field in ("id", "name", "name_fr", "receptors"):
            if not transmitter.get(field):
                raise ValueError(f"Transmitter {transmitter.get('id')} has no {field}")
        for receptor in transmitter["receptors"]:
            parts = receptor.get("display")
            if not parts or not all(
                (isinstance(part, str) and part) or (isinstance(part, dict) and set(part) == {"sub"})
                for part in parts
            ):
                raise ValueError(f"Receptor {receptor.get('id')} needs a display of text and {{sub: …}} parts")
            for spelling in [receptor["id"], *receptor.get("aliases", [])]:
                if spelling in receptors:
                    raise ValueError(f"Receptor spelling {spelling} is used twice")
                receptors[spelling] = receptor["id"]
    if len({transmitter["id"] for transmitter in transmitters}) != len(transmitters):
        raise ValueError("Transmitter ids must be unique")
    return set(receptors.values())


def check_datasets(datasets, sources):
    keys = [dataset["key"] for dataset in datasets]
    if len(set(keys)) != len(keys):
        raise ValueError("Dataset keys must be unique")
    targets = {}
    allowed = {"key", "measured_in", "part", "doi", "documented_by", *FILE_KINDS, "targets"}
    for dataset in datasets:
        key = dataset["key"]
        # A stray key is a misparsed entry, such as a value cut at a comma in a flow mapping.
        if set(dataset) - allowed:
            raise ValueError(f"Dataset {key} has unexpected keys {sorted(map(str, set(dataset) - allowed))}")
        if not dataset.get("measured_in") or not DOI.fullmatch(dataset.get("doi", "")):
            raise ValueError(f"Dataset {key} needs what it was measured in and a doi.org DOI")
        unknown = set(dataset.get("documented_by", [])) - set(sources)
        if unknown:
            raise ValueError(f"Dataset {key} cites unknown sources {sorted(unknown)}")
        for kind in FILE_KINDS:
            remote, digest = dataset[kind]
            if not remote or not SHA256.fullmatch(digest):
                raise ValueError(f"Dataset {key} needs a {kind} path and its sha256")
        if dataset.get("part", PARTS[0]) not in PARTS:
            raise ValueError(f"Dataset {key}: part must be one of {PARTS}")
        if not dataset.get("targets"):
            raise ValueError(f"Dataset {key} names no region")
        for target in dataset["targets"]:
            targets.setdefault((target["atlas"], target["name"]), []).append(dataset)
    # One region takes one fingerprint, or one per part of an area sampled in parts.
    for (atlas, name), sharing in targets.items():
        parts = [dataset.get("part") for dataset in sharing]
        if len(sharing) > 1 and (None in parts or len(set(parts)) != len(parts)):
            raise ValueError(f"{atlas} {name} takes {len(sharing)} fingerprints that are not distinct parts")
        if len(sharing) == 1 and parts[0] is not None:
            raise ValueError(f"{atlas} {name} takes only the {parts[0]} part")


def read_definition(path=DEFINITION):
    definition = yaml.safe_load(path.read_text())
    check_sources(definition["sources"])
    receptors = check_transmitters(definition["transmitters"])
    check_datasets(definition["datasets"], definition["sources"])
    datasets = {dataset["key"] for dataset in definition["datasets"]}
    for withheld in definition["withheld"]:
        if (withheld["dataset"] not in datasets or withheld["receptor"] not in receptors
                or withheld["field"] != "sd"
                or not withheld.get("reason") or not withheld.get("reason_fr")):
            raise ValueError(f"Withheld value {withheld} names no published value or gives no reason")
    return definition


def read_data(definition, path=DATA):
    """The fetched fingerprints, checked against the datasets the definition lists."""
    data = json.loads(path.read_text())
    if data["unit"] != definition["unit"]:
        raise ValueError(f"Fingerprints are in {data['unit']}, not {definition['unit']}")
    if [dataset["key"] for dataset in data["datasets"]] != [d["key"] for d in definition["datasets"]]:
        raise ValueError(f"{path.name} does not hold the configured datasets in order")
    known = {receptor["id"] for transmitter in definition["transmitters"] for receptor in transmitter["receptors"]}
    for dataset in data["datasets"]:
        if not dataset["receptors"] or set(dataset["receptors"]) - known:
            raise ValueError(f"Dataset {dataset['key']} has no receptors or an unknown one")
        for receptor, value in dataset["receptors"].items():
            if not value["mean"] > 0 or (value["sd"] is not None and value["sd"] < 0):
                raise ValueError(f"Dataset {dataset['key']}: {receptor} is not a positive mean and SD")
        if not dataset["donors"] or not dataset["samples"]:
            raise ValueError(f"Dataset {dataset['key']} names no donor or sample")
    return data


def assign(regions, definition):
    """Each region's fingerprints, by region id. An atlas this anatomy does not publish is skipped."""
    published = {region["atlas"] for region in regions}
    by_name = {}
    for region in regions:
        by_name.setdefault((region["atlas"], region["hemisphere"], region["source_name"]), []).append(region["id"])
    assigned = {}
    for dataset in definition["datasets"]:
        for target in dataset["targets"]:
            if target["atlas"] not in published:
                continue
            for hemisphere in ("left", "right"):
                name = SIDE_PREFIX.get(target["atlas"], {}).get(hemisphere, "") + target["name"]
                found = by_name.get((target["atlas"], hemisphere, name), [])
                if len(found) != 1:
                    raise ValueError(f"{len(found)} {hemisphere} {target['atlas']} regions are named {name}")
                assigned.setdefault(found[0], []).append(dataset["key"])
    return dict(sorted(assigned.items()))


def hemisphere_counts(samples):
    return {side: sum(sample["hemisphere"] == side for sample in samples) for side in ("left", "right")}


def partition(regions):
    definition = read_definition()
    data = {dataset["key"]: dataset for dataset in read_data(definition)["datasets"]}
    return {
        "id": ATLAS_ID,
        "unit": definition["unit"],
        "sources": definition["sources"],
        "transmitters": definition["transmitters"],
        "withheld": definition["withheld"],
        "datasets": [
            {
                "key": dataset["key"],
                "measured_in": dataset["measured_in"],
                "part": dataset.get("part"),
                "doi": dataset["doi"],
                "documented_by": dataset.get("documented_by", []),
                "receptors": data[dataset["key"]]["receptors"],
                "donors": data[dataset["key"]]["donors"],
                "hemispheres": hemisphere_counts(data[dataset["key"]]["samples"]),
            }
            for dataset in definition["datasets"]
        ],
        "regions": assign(regions, definition),
    }


def metadata():
    definition = read_definition()
    return {
        "id": ATLAS_ID,
        "file": FILENAME,
        "label": definition["label"],
        "unit": definition["unit"],
        "license": definition["license"],
        "citations": [source["doi"] for source in definition["sources"].values()],
        "method": (
            "Each EBRAINS receptor dataset's mean and SD over the sampled hemispheres, carried to "
            "the regions named after the area or structure it was measured in, in both hemispheres; "
            "never per vertex or voxel"
        ),
    }


def export(config, regions):
    write_json(config["output_directory"] / FILENAME, partition(regions))
    return metadata()


def validate(config, manifest):
    if manifest["receptor_fingerprints"] != metadata():
        raise ValueError("Manifest receptor-fingerprint metadata mismatch")
    published = json.loads((config["output_directory"] / FILENAME).read_text())
    if published != partition(manifest["regions"]):
        raise ValueError("Receptor-fingerprint assignments changed")
    reached = {key for keys in published["regions"].values() for key in keys}
    return {
        "datasets": len(published["datasets"]),
        "regions_with_a_fingerprint": len(published["regions"]),
        "datasets_reaching_no_region": sorted({d["key"] for d in published["datasets"]} - reached),
    }


def limitations():
    return [
        "Receptor fingerprints are densities measured by in vitro autoradiography in two to six post-mortem brains (Zilles and Palomero-Gallagher, via EBRAINS), pooled over the hemispheres sampled. They reach this brain only by the name of the area or structure measured and are not measured in it; both hemispheres show the same values.",
        "Only the Julich-Brain areas and the deep structures a dataset names carry a fingerprint. Areas 9, 46 and 47 are published but name no Julich-Brain area and are left out. A structure the dataset names as a whole, such as the globus pallidus or the anterior thalamic nucleus, gives the same values to each of its subdivisions.",
        "A published value known to be wrong is withheld and the reason is published with it: Area ifs1's D1 SD equals the same file's A1 mean.",
    ]
