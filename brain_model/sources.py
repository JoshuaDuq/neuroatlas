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
    return config


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_sources():
    provenance = json.loads((ROOT / "data/sources.json").read_text())
    for source in provenance["sources"]:
        path = ROOT / source["path"]
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
