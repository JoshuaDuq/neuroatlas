"""Explicit source configuration and integrity checks."""

import hashlib
import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]


def resolve_config(document):
    """Fold the one selected anatomy into the shape every build step reads.

    `anatomy` names the brain this build publishes and `anatomies` describes
    each brain it could publish. Holding the choice in a single name is what
    makes it a choice: no conversion step reads anything subject-specific of its
    own, so moving to another brain is this one line and a rebuild.

    The unselected declarations are resolved away rather than carried along, so
    nothing downstream can reach a path belonging to a brain that is not being
    built.
    """
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
    config["output_directory"] = ROOT / config["output_directory"]
    # The warp is anatomy-specific; everything else about it is not.
    config["nextbrain"] = {**config["nextbrain"], **anatomy["nextbrain"]}
    config["nextbrain"]["directory"] = ROOT / config["nextbrain"]["directory"]
    return config


def read_config(anatomy=None):
    """The resolved configuration, optionally for a brain other than the selected one.

    Preparing or warping a second brain has to be possible without first
    changing which brain is published, so the override exists for the scripts
    that do that work. The build itself never passes one.
    """
    document = yaml.safe_load((ROOT / "config/model.yaml").read_text())
    if anatomy is not None:
        document = {**document, "anatomy": anatomy}
    return resolve_config(document)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def scoped_sources(document, anatomy):
    """The recorded inputs one anatomy's build actually reads.

    An entry tagged with an anatomy belongs to that brain alone. An untagged one
    is shared by every brain — the colour table, and the fsaverage HCP
    annotation each projected subject resamples from. Scoping this way is what
    lets both brains stay declared while a checkout holds the data for one.
    """
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
