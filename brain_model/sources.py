"""Explicit source configuration and integrity checks."""

import hashlib
import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]

HEMISPHERES = {"lh": "left", "rh": "right"}


def resolve_config(document):
    config = dict(document)
    anatomies = config.pop("anatomies")
    selected = config["anatomy"]
    if selected not in anatomies:
        raise ValueError(f"`anatomies` does not declare the selected {selected!r}")
    anatomy = {"id": selected, **anatomies[selected]}
    # Resolved here so that no later step needs the declarations to find the
    # brain an atlas is resampled from. Naming one that is not declared is the
    # same mistake as selecting one, and fails the same way.
    projected_from = anatomy.get("project_hcp_from")
    if projected_from is not None:
        if projected_from not in anatomies:
            raise ValueError(f"`anatomies` does not declare {projected_from!r}")
        anatomy["hcp_source_directory"] = ROOT / anatomies[projected_from]["directory"]
    config["anatomy"] = anatomy
    config["source_directory"] = ROOT / anatomy["directory"]
    # Each brain publishes into its own directory, so one can be built without
    # overwriting another and the viewer can offer the choice at runtime.
    config["output_directory"] = ROOT / config["output_directory"] / anatomy["id"]
    # The warp is anatomy-specific; everything else about it is not.
    config["nextbrain"] = {**config["nextbrain"], **anatomy["nextbrain"]}
    config["nextbrain"]["directory"] = ROOT / config["nextbrain"]["directory"]
    return config


def read_config(anatomy=None):
    document = yaml.safe_load((ROOT / "config/model.yaml").read_text())
    # What the file selects, kept across an override so that building a second
    # brain does not change which one the viewer opens by default.
    selected = document["anatomy"]
    if anatomy is not None:
        document = {**document, "anatomy": anatomy}
    config = resolve_config(document)
    config["default_anatomy"] = selected
    return config


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def scoped_sources(document, anatomy):
    return {
        **document,
        "sources": [
            source
            for source in document["sources"]
            if source.get("anatomy", anatomy) == anatomy
        ],
    }


def verify_sources(config):
    provenance = scoped_sources(
        json.loads((ROOT / "data/sources.json").read_text()), config["anatomy"]["id"]
    )
    for source in provenance["sources"]:
        path = ROOT / source["path"]
        # A derived source is produced by a documented one-off procedure that
        # this package cannot run, so a checkout without it still builds every
        # asset that needs no warp. Present, it is checked like any download.
        if source.get("optional") and not path.exists():
            continue
        if sha256(path) != source["sha256"]:
            raise ValueError(f"Source checksum mismatch: {path}")
    return provenance


def read_color_table():
    table = {}
    for line in (ROOT / "data/FreeSurferColorLUT.txt").read_text().splitlines():
        fields = line.split()
        if not fields or fields[0].startswith("#"):
            continue
        label, name, red, green, blue = fields[:5]
        table[int(label)] = (name, [int(red), int(green), int(blue)])
    return table


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n")
