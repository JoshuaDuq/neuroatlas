"""FreeSurfer's gyral white-matter parcellation, published as cut-only regions."""

import gzip
import hashlib
import re

import numpy as np

from .sources import read_color_table, sha256
from .volumes import encode_array, load_on_grid, offset_by

ATLAS_ID = "wmparc"
SOURCE = "mri/wmparc.mgz"
FILENAME = "white-matter.volume"
CODE = np.dtype("|u1")

# FreeSurfer's wm-lh-* and wm-rh-* blocks. Unsegmented white matter (5001/5002)
# lies outside both, so it never becomes a parcel.
LEFT_BLOCK, RIGHT_BLOCK, BLOCK_END = 3000, 4000, 5000
PUBLISHED_PREFIX = re.compile(r"^wm-[lr]h-")


def path(config):
    return config["source_directory"] / SOURCE


def is_available(config):
    return path(config).exists()


def is_parcel(labels):
    return ((labels > LEFT_BLOCK) & (labels < RIGHT_BLOCK)) | (
        (labels > RIGHT_BLOCK) & (labels < BLOCK_END)
    )


def hemisphere_of(label):
    return "left" if label < RIGHT_BLOCK else "right"


def region_id_of(label):
    return f"{ATLAS_ID}:{hemisphere_of(label)}:{label}"


def load(config):
    image = load_on_grid(config, path(config))
    labels = np.asarray(image.dataobj)
    if not np.all(labels == np.rint(labels)):
        raise ValueError("wmparc.mgz must contain integer labels.")
    return image, labels.astype(np.int64)


def build_regions(config):
    image, labels = load(config)
    names = read_color_table()
    voxel_volume = float(abs(np.linalg.det(image.header.get_vox2ras_tkr()[:3, :3])))
    cut_atlases = [atlas["id"] for atlas in config["atlases"]]
    ids, counts = np.unique(labels[is_parcel(labels)], return_counts=True)
    regions = []
    for label, count in zip(ids.tolist(), counts.tolist()):
        published = names[label][0]
        name = PUBLISHED_PREFIX.sub("", published)
        hemisphere = hemisphere_of(label)
        regions.append(
            {
                "id": region_id_of(label),
                "label": f"{name} white matter · {hemisphere}",
                "source_name": name,
                "source_published_name": published,
                "atlas": ATLAS_ID,
                "hemisphere": hemisphere,
                "source_label_id": label,
                "kind": "tissue-region",
                "cut_atlases": list(cut_atlases),
                "voxel_count": count,
                "voxel_size_mm": [float(x) for x in image.header.get_zooms()[:3]],
                "segmentation_volume_mm3": count * voxel_volume,
            }
        )
    return regions


def export_volume(config, regions):
    image, labels = load(config)
    parcels = is_parcel(labels)
    ids = np.unique(labels[parcels])
    if len(ids) > np.iinfo(CODE).max:
        raise ValueError(f"{len(ids)} white-matter parcels do not fit uint8 codes.")
    published = {
        region["source_label_id"]: region["id"]
        for region in regions
        if region["atlas"] == ATLAS_ID
    }
    missing = [region_id_of(label) for label in ids.tolist() if label not in published]
    if missing:
        raise ValueError(f"White-matter parcels without a published region: {missing}")

    occupied = np.argwhere(parcels)
    corner, end = occupied.min(axis=0), occupied.max(axis=0) + 1
    box = tuple(slice(start, stop) for start, stop in zip(corner, end))
    inside = parcels[box]
    codes = np.zeros(end - corner, CODE)
    codes[inside] = np.searchsorted(ids, labels[box][inside]) + 1

    record = encode_array(
        codes,
        image.header.get_vox2ras_tkr() @ offset_by(corner),
        image.header.get_zooms()[:3],
        config["output_directory"] / FILENAME,
        CODE,
    )
    record["labels"] = [
        {"source_label_id": 0, "region_id": None},
        *(
            {"source_label_id": label, "region_id": published[label]}
            for label in ids.tolist()
        ),
    ]
    record["applies_to"] = [atlas["id"] for atlas in config["atlases"]]
    record["label_method"] = (
        "FreeSurfer wmparc.mgz from this reconstruction (mri_aparc2aseg --labelwm): "
        "white matter within 5 mm of cortex carries the nearest Desikan cortical "
        "label, and unsegmented white matter is no parcel. Cropped to the parcels' "
        "bounding box; no label is changed."
    )
    return record


def validate_regions(config, regions):
    expected = (
        {region["id"]: region for region in build_regions(config)}
        if is_available(config)
        else {}
    )
    if set(regions) != set(expected):
        raise ValueError(
            f"White-matter regions differ from wmparc.mgz: {sorted(set(regions) ^ set(expected))}"
        )
    for region_id, region in regions.items():
        if region != expected[region_id]:
            raise ValueError(
                f"White-matter region disagrees with wmparc.mgz: {region_id}"
            )


def validate_volume(config, record):
    published = config["output_directory"] / record["file"]
    if sha256(published) != record["sha256"]:
        raise ValueError("White-matter volume checksum mismatch")
    payload = gzip.decompress(published.read_bytes())
    if hashlib.sha256(payload).hexdigest() != record["decoded_sha256"]:
        raise ValueError("Decoded white-matter volume checksum mismatch")
    codes = np.frombuffer(payload, dtype=record["dtype"]).reshape(
        record["shape"], order="F"
    )

    image, labels = load(config)
    offset = np.linalg.inv(image.header.get_vox2ras_tkr()) @ np.asarray(
        record["voxel_to_surface_ras_mm"]
    )
    corner = np.rint(offset[:3, 3]).astype(int)
    end = corner + record["shape"]
    if (
        not np.allclose(offset, offset_by(corner))
        or (corner < 0).any()
        or (end > labels.shape).any()
    ):
        raise ValueError(
            "White-matter volume is not a whole-voxel crop of the subject grid"
        )

    ids = np.array([label["source_label_id"] for label in record["labels"]])
    parcels = np.where(is_parcel(labels), labels, 0)
    box = parcels[tuple(slice(start, stop) for start, stop in zip(corner, end))]
    if (
        codes.max() >= len(ids)
        or np.count_nonzero(box) != np.count_nonzero(parcels)
        or not np.array_equal(ids[codes], box)
    ):
        raise ValueError("White-matter parcel voxels differ from wmparc.mgz")
    if any(
        label["region_id"] != region_id_of(label["source_label_id"])
        for label in record["labels"][1:]
    ):
        raise ValueError("White-matter codes name the wrong regions")
    if record["applies_to"] != [atlas["id"] for atlas in config["atlases"]]:
        raise ValueError("White-matter volume serves the wrong cut atlases")
    return {
        "file": record["file"],
        "sha256": record["sha256"],
        "identical_parcel_voxels": True,
        "crop_corner_voxel": corner.tolist(),
        "shape": record["shape"],
        "parcel_count": len(ids) - 1,
    }


def limitations(config):
    if not is_available(config):
        return []
    return [
        "Gyral white matter is FreeSurfer's wmparc: each voxel within 5 mm of cortex takes the nearest Desikan cortical label whichever surface atlas is shown, and deeper white matter is unsegmented and belongs to no region.",
    ]
