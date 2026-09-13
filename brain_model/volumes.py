"""Lossless native-grid MRI and segmentation assets for registered sections."""

import gzip
import hashlib

import nibabel as nib
import numpy as np

from .sources import read_color_table, read_config, sha256, verify_sources, write_json


def encode_volume(image, path, dtype):
    return encode_array(
        np.asarray(image.dataobj),
        image.header.get_vox2ras_tkr(),
        image.header.get_zooms()[:3],
        path,
        dtype,
    )


def encode_array(data, affine, spacing, path, dtype):
    """Encode a grid that need not be a whole image, such as a crop of one."""
    if data.ndim != 3 or not np.isfinite(data).all():
        raise ValueError("Expected a finite three-dimensional source volume.")
    limits = np.iinfo(dtype)
    if (data < limits.min).any() or (data > limits.max).any():
        raise ValueError("Cannot perform lossless volume encoding: range exceeded.")
    encoded = data.astype(dtype)
    if not np.array_equal(data, encoded):
        raise ValueError("Cannot perform lossless volume encoding: fractional values.")
    payload = encoded.tobytes(order="F")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(gzip.compress(payload, compresslevel=9, mtime=0))
    return {
        "file": path.name,
        "shape": list(map(int, data.shape)),
        "dtype": dtype.str,
        "order": "F",
        "compression": "gzip",
        "byte_length": len(payload),
        "sha256": sha256(path),
        "decoded_sha256": hashlib.sha256(payload).hexdigest(),
        "voxel_to_surface_ras_mm": np.asarray(affine).tolist(),
        "voxel_spacing_mm": list(map(float, spacing)),
    }


def reference_grid(config):
    """The voxel-to-surface-RAS mapping every published label grid must share."""
    image = nib.load(config["source_directory"] / "mri/aseg.mgz")
    return image.header.get_vox2ras_tkr()


def load_on_grid(config, path):
    """Load a volume that is required to sit exactly on the reference grid.

    Registration is asserted rather than corrected. A volume that arrived on a
    different grid is a warp that went wrong, and resampling it here would hide
    that behind plausible-looking anatomy.
    """
    image = nib.load(path)
    if not np.array_equal(image.header.get_vox2ras_tkr(), reference_grid(config)):
        raise ValueError(f"Volume is not registered to the subject grid: {path}")
    return image


def export_volumes(config):
    directory = config["source_directory"] / "mri"
    output = config["output_directory"]
    mri = nib.load(directory / "orig.mgz")
    labels = nib.load(directory / "aseg.mgz")
    if mri.shape != labels.shape or not np.array_equal(
        mri.header.get_vox2ras_tkr(), labels.header.get_vox2ras_tkr()
    ):
        raise ValueError("MRI and segmentation grids must be exactly registered.")
    table = read_color_table()
    present = np.unique(np.asarray(labels.dataobj)).astype(int)
    record = {
        "schema_version": 1,
        "coordinate_system": "FreeSurfer surface RAS (tkregister), millimeters",
        "mri": encode_volume(mri, output / "mri.volume", np.dtype("uint8")),
        "segmentation": encode_volume(labels, output / "aseg.volume", np.dtype("<u2")),
        "labels": {
            str(label): {"name": table[label][0], "color": table[label][1]}
            for label in present
        },
        "display": config["sections"],
        "limitations": [
            "One individual's 1 mm MRI and segmentation; not the viewer's anatomy."
            if config["anatomy"]["individual"]
            else "An averaged 1 mm MRI and segmentation; nobody's individual anatomy.",
            "Trilinear MRI interpolation does not increase source resolution.",
            "Segmentation is sampled with nearest neighbour; cortical surface atlases are not extended into the volume.",
        ],
    }
    write_json(output / "volumes.json", record)
    return record


def main():
    config = read_config()
    verify_sources(config)
    record = export_volumes(config)
    print(f"Exported lossless MRI and segmentation: {record['mri']['shape']}")


if __name__ == "__main__":
    main()
