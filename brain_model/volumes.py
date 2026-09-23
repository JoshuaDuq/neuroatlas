"""Lossless native-grid MRI and segmentation assets for registered sections."""

import gzip
import hashlib
import math
from typing import NamedTuple

import nibabel as nib
import numpy as np

from .sources import read_color_table, read_config, sha256, verify_sources, write_json


class LabelGrid(NamedTuple):
    """A label array and where its voxel centres sit in the subject's surface RAS."""

    labels: np.ndarray
    voxel_to_surface: np.ndarray
    spacing_mm: list

    @property
    def voxel_volume_mm3(self):
        return float(abs(np.linalg.det(self.voxel_to_surface[:3, :3])))


def conformed_grid(image):
    """Only a conformed subject volume's own tkregister matrix is surface RAS."""
    return LabelGrid(
        np.asarray(image.dataobj),
        image.header.get_vox2ras_tkr(),
        [float(x) for x in image.header.get_zooms()[:3]],
    )


def offset_by(corner):
    matrix = np.eye(4)
    matrix[:3, 3] = corner
    return matrix


def label_box(data):
    occupied = np.argwhere(data != 0)
    if not len(occupied):
        return np.zeros(3, int), np.array(data.shape, int)
    return occupied.min(axis=0), occupied.max(axis=0) + 1


def place_crop(record, data, shape=None):
    corner = np.array(record.get("crop_corner_voxel", [0, 0, 0]), int)
    full = np.zeros(tuple(shape if shape is not None else record["source_shape"]), data.dtype)
    full[tuple(slice(start, start + size) for start, size in zip(corner, data.shape))] = data
    return full


def read_published(record, path, shape=None):
    payload = gzip.decompress(path.read_bytes())
    data = np.frombuffer(payload, dtype=record["dtype"]).reshape(
        record["shape"], order=record["order"]
    )
    return place_crop(record, data, shape)


def encode_volume(image, path, dtype):
    return encode_array(
        np.asarray(image.dataobj),
        image.header.get_vox2ras_tkr(),
        image.header.get_zooms()[:3],
        path,
        dtype,
    )


def encode_cropped_volume(image, path, dtype):
    return encode_cropped_array(
        np.asarray(image.dataobj),
        image.header.get_vox2ras_tkr(),
        image.header.get_zooms()[:3],
        path,
        dtype,
    )


def encode_cropped_array(data, affine, spacing, path, dtype):
    corner, end = label_box(data)
    box = tuple(slice(start, stop) for start, stop in zip(corner, end))
    record = encode_array(data[box], affine @ offset_by(corner), spacing, path, dtype)
    record["source_shape"] = list(map(int, data.shape))
    record["crop_corner_voxel"] = corner.tolist()
    return record


def axis_lookup(source_to_surface, source_shape, target_to_surface, target_shape,
                skew_voxels=0.01):
    """Per-axis nearest-neighbour indices between grids whose axes are parallel.

    Also returns the largest distance, in mm, from a target voxel centre to the
    source centre it takes its value from.
    """
    m = np.linalg.inv(source_to_surface) @ target_to_surface
    linear = m[:3, :3]
    order = np.argmax(np.abs(linear), axis=1)
    if sorted(order.tolist()) != [0, 1, 2]:
        raise ValueError("Grids do not share axis directions.")
    extent = np.array(target_shape) - 1
    skew = max(
        sum(abs(linear[b, a]) * extent[a] for a in range(3) if a != order[b])
        for b in range(3)
    )
    if skew > skew_voxels:
        raise ValueError(f"Grid axes are skewed by {skew:.3f} voxels.")
    indices, valid, shift = [], [], []
    for b in range(3):
        exact = linear[b, order[b]] * np.arange(target_shape[order[b]]) + m[b, 3]
        nearest = np.rint(exact).astype(int)
        valid.append((nearest >= 0) & (nearest < source_shape[b]))
        indices.append(np.clip(nearest, 0, source_shape[b] - 1))
        spacing = np.linalg.norm(source_to_surface[:3, b])
        shift.append(np.abs(exact - nearest)[valid[-1]].max(initial=0) * spacing)
    return order, indices, valid, float(np.linalg.norm(shift))


def resample_nearest(data, source_to_surface, target_to_surface, target_shape):
    """Nearest-neighbour values on the target grid; background outside the source."""
    order, indices, valid, shift = axis_lookup(
        source_to_surface, data.shape, target_to_surface, target_shape
    )
    inside = valid[0][:, None, None] & valid[1][None, :, None] & valid[2][None, None, :]
    values = np.where(inside, data[np.ix_(*indices)], 0)
    return values.transpose(np.argsort(order)), shift


def encode_array(data, affine, spacing, path, dtype):
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


def display_window(mri, labels, ceiling=99.9):
    """The default contrast window, measured from the tissue the viewer draws.

    orig.mgz is conformed but not intensity normalised, so white matter sits
    wherever the scanner left it — 164 in bert, 176 in the AOMIC subject. One
    constant ceiling clipped half of the brighter subject's white matter to
    flat white, which is measured signal thrown away.

    The floor stays at zero so displayed grey is proportional to T1 signal:
    a raised floor would buy contrast by adding an offset, and surfaces and
    cut faces would no longer report the same tissue at the same grey. Only
    the ceiling is fitted, high enough to leave the bright tail intact.
    """
    signal = np.asarray(mri.dataobj)[np.asarray(labels.dataobj) != 0]
    if not signal.size:
        raise ValueError("Segmentation covers no voxels; cannot measure a window.")
    # Even, so the window runs from exactly zero to an integer ceiling.
    high = 2 * math.ceil(float(np.percentile(signal, ceiling)) / 2)
    if high <= 0:
        raise ValueError("Source MRI has no dynamic range inside the segmentation.")
    return {"window_center": high // 2, "window_width": high}


def reference_grid(config):
    image = nib.load(config["source_directory"] / "mri/aseg.mgz")
    return image.header.get_vox2ras_tkr()


def load_on_grid(config, path):
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
        "segmentation": encode_cropped_volume(
            labels, output / "aseg.volume", np.dtype("<u2")
        ),
        "labels": {
            str(label): {"name": table[label][0], "color": table[label][1]}
            for label in present
        },
        "display": {**config["sections"], **display_window(mri, labels)},
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
