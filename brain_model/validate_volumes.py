"""Independently reconcile transported volumes with their native MRI sources."""

import gzip
import hashlib
import json

import nibabel as nib
import numpy as np

from .sources import read_color_table, sha256


def validate_record(config, record, source_name):
    path = config["output_directory"] / record["file"]
    if record["compression"] != "gzip" or record["order"] != "F":
        raise ValueError("Unsupported volume storage contract.")
    if sha256(path) != record["sha256"]:
        raise ValueError(f"Compressed volume checksum mismatch: {source_name}")
    payload = gzip.decompress(path.read_bytes())
    if (
        len(payload) != record["byte_length"]
        or hashlib.sha256(payload).hexdigest() != record["decoded_sha256"]
    ):
        raise ValueError(f"Decoded volume checksum mismatch: {source_name}")
    restored = np.frombuffer(payload, dtype=record["dtype"]).reshape(
        record["shape"], order="F"
    )
    image = nib.load(config["source_directory"] / "mri" / f"{source_name}.mgz")
    if not np.array_equal(restored, np.asarray(image.dataobj)):
        raise ValueError(f"Source voxel mismatch: {source_name}")
    if not np.array_equal(
        record["voxel_to_surface_ras_mm"], image.header.get_vox2ras_tkr()
    ):
        raise ValueError(f"Source affine mismatch: {source_name}")
    if not np.array_equal(record["voxel_spacing_mm"], image.header.get_zooms()[:3]):
        raise ValueError(f"Source voxel spacing mismatch: {source_name}")
    return {
        "file": record["file"],
        "sha256": record["sha256"],
        "identical_voxels": True,
        "identical_tkregister_affine": True,
        "voxel_count": int(restored.size),
        "voxel_spacing_mm": record["voxel_spacing_mm"],
    }


def validate_volumes(config):
    metadata = json.loads((config["output_directory"] / "volumes.json").read_text())
    if metadata["schema_version"] != 1:
        raise ValueError("Unsupported volume metadata schema.")
    report = {
        key: validate_record(config, metadata[key], source)
        for key, source in [("mri", "orig"), ("segmentation", "aseg")]
    }
    image = nib.load(config["source_directory"] / "mri" / "aseg.mgz")
    labels = np.unique(np.asarray(image.dataobj)).astype(int)
    table = read_color_table()
    expected = {
        str(label): {"name": table[label][0], "color": table[label][1]}
        for label in labels
    }
    if metadata["labels"] != expected:
        raise ValueError("Volume label names or colors differ from the source LUT.")
    if metadata["display"] != config["sections"]:
        raise ValueError("Volume display metadata differs from build configuration.")
    return report
