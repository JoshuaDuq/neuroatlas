"""Explicit source configuration and integrity checks."""

import hashlib
import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]


def read_config():
    config = yaml.safe_load((ROOT / "config/model.yaml").read_text())
    config["source_directory"] = ROOT / config["source_directory"]
    config["output_directory"] = ROOT / config["output_directory"]
    config["nextbrain"]["directory"] = ROOT / config["nextbrain"]["directory"]
    return config


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_sources():
    provenance = json.loads((ROOT / "data/sources.json").read_text())
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
