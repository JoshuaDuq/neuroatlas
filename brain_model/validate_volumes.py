"""Independently reconcile transported volumes with their native MRI sources."""

import gzip
import hashlib
import json

import nibabel as nib
import numpy as np
from nibabel.freesurfer.io import read_annot, read_geometry
from scipy.spatial import cKDTree

from .labels.tissue_labels import describe_source_label
from .labels.volumes import display_window, offset_by, place_crop, validate_same_grid
from .sources import HEMISPHERES, read_color_table, sha256

# FreeSurfer's ctx_lh_ / ctx_rh_ Destrieux blocks and the ribbon label of each
# hemisphere's cortex, as the build restricts the HCP projection to them.
CORTEX = {"lh": (11100, 3), "rh": (12100, 42)}


def decode_record(config, record, name):
    """The published grid, after both of its recorded checksums agree."""
    path = config["output_directory"] / record["file"]
    if record["compression"] != "gzip" or record["order"] != "F":
        raise ValueError("Unsupported volume storage contract.")
    if sha256(path) != record["sha256"]:
        raise ValueError(f"Compressed volume checksum mismatch: {name}")
    payload = gzip.decompress(path.read_bytes())
    if (
        len(payload) != record["byte_length"]
        or hashlib.sha256(payload).hexdigest() != record["decoded_sha256"]
    ):
        raise ValueError(f"Decoded volume checksum mismatch: {name}")
    return np.frombuffer(payload, dtype=record["dtype"]).reshape(
        record["shape"], order="F"
    )


def on_source_grid(record, restored, image, name):
    """Put a published grid back on its source grid, checking where it says it goes."""
    grid = image.header.get_vox2ras_tkr()
    cropped = "crop_corner_voxel" in record
    if cropped:
        # Rebuild the source grid from the crop and the affine the file
        # publishes. Equality then proves three things at once: every labelled
        # voxel was carried, nothing outside the box was labelled, and the
        # affine puts the box back exactly where it was cut from.
        corner = np.array(record["crop_corner_voxel"], int)
        if list(image.shape) != record["source_shape"]:
            raise ValueError(f"Crop records the wrong source shape: {name}")
        if not np.allclose(record["voxel_to_surface_ras_mm"], grid @ offset_by(corner)):
            raise ValueError(f"Crop affine does not place the box: {name}")
        restored = place_crop(record, restored, image.shape)
    elif not np.array_equal(record["voxel_to_surface_ras_mm"], grid):
        raise ValueError(f"Source affine mismatch: {name}")
    return restored, cropped


def validate_record(config, record, source_name):
    restored = decode_record(config, record, source_name)
    image = nib.load(config["source_directory"] / "mri" / f"{source_name}.mgz")
    source = np.asarray(image.dataobj)
    restored, cropped = on_source_grid(record, restored, image, source_name)
    if not np.array_equal(restored, source):
        raise ValueError(f"Source voxel mismatch: {source_name}")
    if not np.array_equal(record["voxel_spacing_mm"], image.header.get_zooms()[:3]):
        raise ValueError(f"Source voxel spacing mismatch: {source_name}")
    return {
        "file": record["file"],
        "sha256": record["sha256"],
        "identical_voxels": True,
        "identical_tkregister_affine": True,
        "cropped_to_labels": cropped,
        "published_shape": list(record["shape"]),
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
    window = display_window(
        nib.load(config["source_directory"] / "mri" / "orig.mgz"), image
    )
    if metadata["display"] != {**config["sections"], **window}:
        raise ValueError("Volume display metadata differs from build configuration.")
    return report


def published_codes(config, record, image, name):
    restored, _ = on_source_grid(record, decode_record(config, record, name), image, name)
    if not np.array_equal(record["voxel_spacing_mm"], image.header.get_zooms()[:3]):
        raise ValueError(f"Source voxel spacing mismatch: {name}")
    if restored.max() >= len(record["labels"]):
        raise ValueError(f"{name} holds a code its label table does not")
    return restored


def surface_labels(annotation, atlas, hemisphere, regions):
    """The label table rows a projected atlas's cut appends for one hemisphere's annotation."""
    _, colors, names = annotation
    published = {
        region["source_label_id"]: region
        for region in regions
        if region["atlas"] == atlas and region["hemisphere"] == hemisphere
    }
    absent = {"kind": "non-region"}
    return [
        {
            "source_label_id": label,
            "name": name.decode(),
            "color": colors[label, :3].tolist(),
            "hemisphere": hemisphere,
            "kind": "cortex",
            "region_id": published[label]["id"]
            if published.get(label, absent)["kind"] == "cortex"
            else None,
        }
        for label, name in enumerate(names)
    ]


def validate_tissue_volumes(config, manifest, tissues):
    """The published cut-label grids, decoded and recomputed from their sources.

    Destrieux must be aparc.a2009s+aseg itself. Every projected surface atlas
    must equal it off the cortex, and on each hemisphere's cortex hold the
    projection the build documents: the label of the nearest pial or white
    vertex inside the native gray ribbon, and its unlabelled entry elsewhere.
    """
    directory = config["source_directory"]
    source_path = directory / "mri/aparc.a2009s+aseg.mgz"
    if tissues["source_sha256"] != sha256(source_path):
        raise ValueError("Tissue labels were built from another aparc.a2009s+aseg.mgz")
    image = nib.load(source_path)
    source = np.asarray(image.dataobj)
    table = read_color_table()
    values, inverse = np.unique(source, return_inverse=True)
    codes = inverse.reshape(source.shape)
    labels = [describe_source_label(int(v), table, manifest["regions"]) for v in values]

    destrieux = tissues["atlases"]["destrieux"]
    if destrieux["labels"] != labels:
        raise ValueError("Destrieux cut labels differ from the source label table")
    if not np.array_equal(published_codes(config, destrieux, image, "destrieux"), codes):
        raise ValueError("Destrieux cut volume differs from aparc.a2009s+aseg.mgz")

    ribbon_image = nib.load(directory / "mri/ribbon.mgz")
    validate_same_grid(ribbon_image, image)
    ribbon = np.asarray(ribbon_image.dataobj)
    tkr = image.header.get_vox2ras_tkr()
    projected = {}
    for atlas in config["atlases"]:
        if atlas["id"] == "destrieux":
            continue
        projected[atlas["id"]] = validate_projected_volume(
            config, atlas, tissues["atlases"][atlas["id"]], image, codes, list(labels),
            manifest["regions"], ribbon, tkr,
        )
    return {
        "source_sha256": tissues["source_sha256"],
        "destrieux": {
            "file": destrieux["file"],
            "sha256": destrieux["sha256"],
            "decoded_sha256": destrieux["decoded_sha256"],
            "identical_to_source_labels": True,
            "label_count": len(destrieux["labels"]),
        },
        **projected,
    }

def validate_projected_volume(config, atlas, record, image, codes, labels, regions, ribbon, tkr):
    directory = config["source_directory"]
    source = np.asarray(image.dataobj)
    expected = codes.copy()
    cortex = np.zeros(source.shape, bool)
    counts = {}
    for prefix, hemisphere in HEMISPHERES.items():
        lower, ribbon_label = CORTEX[prefix]
        annotation = read_annot(directory / "label" / f"{prefix}.{atlas['annotation']}.annot")
        first = len(labels)
        labels += surface_labels(annotation, atlas["id"], hemisphere, regions)
        if labels[first]["region_id"] is not None:
            raise ValueError(f"{atlas['id']}: annotation entry 0 must be its unlabelled one")
        mask = (source > lower) & (source < lower + 100)
        inside = mask & (ribbon == ribbon_label)
        voxels = np.argwhere(inside)
        pial, _ = read_geometry(directory / "surf" / f"{prefix}.pial")
        white, _ = read_geometry(directory / "surf" / f"{prefix}.white")
        nearest = cKDTree(np.vstack([pial, white])).query(
            nib.affines.apply_affine(tkr, voxels)
        )[1] % len(pial)
        if np.any(annotation[0][nearest] < 0):
            raise ValueError(f"{atlas['id']}: a ribbon voxel's nearest vertex is unlabelled")
        expected[mask] = first
        expected[tuple(voxels.T)] = first + annotation[0][nearest]
        cortex |= mask
        counts[hemisphere] = {
            "ribbon_voxels": len(voxels),
            "cortical_voxels_outside_ribbon": int(np.count_nonzero(mask & ~inside)),
        }
    if record["labels"] != labels:
        raise ValueError(f"{atlas['id']} cut labels differ from the source label tables")
    published = published_codes(config, record, image, atlas["id"])
    if not np.array_equal(published[~cortex], codes[~cortex]):
        raise ValueError(f"{atlas['id']} cut volume relabels voxels outside the cortex")
    if not np.array_equal(published[cortex], expected[cortex]):
        raise ValueError(f"{atlas['id']} cortical voxels differ from their nearest-vertex labels")
    return {
        "file": record["file"],
        "sha256": record["sha256"],
        "decoded_sha256": record["decoded_sha256"],
        "non_cortical_voxels_identical_to_destrieux": True,
        "cortical_voxels_match_nearest_vertex_labels": True,
        "hemispheres": counts,
        "label_count": len(record["labels"]),
    }
