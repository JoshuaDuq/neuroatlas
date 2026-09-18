"""Published NextBrain histological labels, warped once into the subject grid."""

import re

import nibabel as nib
import numpy as np

from .volumes import encode_cropped_volume, load_on_grid

ATLAS_ID = "nextbrain"

# The published LUT encodes laterality in the index itself: right-hemisphere
# regions repeat their left-hemisphere index offset by this much.
HEMISPHERE_OFFSET = 10000

BACKGROUND = 0

# NextBrain reuses FreeSurfer's right-hemisphere cortical label block (2001-2035)
# for both hemispheres, so every published cortical name contains this fragment
# whichever side it describes. It names a label block, not a side.
VESTIGIAL_CORTEX_PREFIX = re.compile(r"^ctx-[lr]h-")


def hemisphere_of(index):
    if index == BACKGROUND:
        return "midline"
    return "right" if index > HEMISPHERE_OFFSET else "left"


def region_id_of(index):
    return f"{ATLAS_ID}:{hemisphere_of(index)}:{index}"


def structure_name_of(published):
    for prefix in ("Left-", "Right-"):
        if published.startswith(prefix):
            published = published[len(prefix) :]
            break
    return VESTIGIAL_CORTEX_PREFIX.sub("", published)


def read_lut(path):
    table = {}
    for line in path.read_text().splitlines():
        fields = line.split()
        if not fields or fields[0].startswith("#"):
            continue
        index, name, red, green, blue = fields[:5]
        table[int(index)] = (name, [int(red), int(green), int(blue)])
    table.setdefault(BACKGROUND, ("Unknown", [0, 0, 0]))
    return table


def paths(config):
    settings = config[ATLAS_ID]
    directory = settings["directory"]
    return directory / settings["volume"], directory / settings["lut"]


def is_available(config):
    if ATLAS_ID not in config:
        return False
    return all(path.exists() for path in paths(config))


def load(config):
    volume_path, lut_path = paths(config)
    image = load_on_grid(config, volume_path)
    labels = np.asarray(image.dataobj)
    if not np.all(labels == np.rint(labels)):
        raise ValueError("NextBrain volume must contain integer label values.")
    labels = labels.astype(np.int64)
    table = read_lut(lut_path)
    unknown = sorted(set(np.unique(labels).tolist()) - set(table))
    if unknown:
        raise ValueError(f"NextBrain labels absent from the published LUT: {unknown}")
    return image, labels, table


# Excluded from solid geometry however large they are. White matter and the
# cerebellar cortical layers are vast, convoluted and enclose everything else,
# so they consume most of the geometry budget and hide the nuclei the fine level
# exists to show. The cortical parcels are already published as real surfaces by
# the Destrieux and HCP-MMP layers.
BULK_TISSUE = ("white_matter", "_of_pva")


def is_bulk(published):
    if "ctx-" in published:
        return True
    return any(token in published for token in BULK_TISSUE)


def meshed_indices(labels, table, minimum):
    indices, counts = np.unique(labels, return_counts=True)
    return [
        int(index)
        for index, count in zip(indices.tolist(), counts.tolist())
        if index != BACKGROUND
        and count >= minimum
        and not is_bulk(table[index][0])
    ]


def cortical_network_compositions(config):
    from nibabel.freesurfer.io import read_annot, read_geometry
    from scipy.spatial import cKDTree

    from . import networks as yeo

    if not yeo.is_available(config):
        return {}
    image, labels, table = load(config)
    affine = image.header.get_vox2ras_tkr()
    source = config["source_directory"]
    compositions = {}
    for prefix, hemisphere in (("lh", "left"), ("rh", "right")):
        ctx_ids = [
            int(index)
            for index in np.unique(labels)
            if hemisphere_of(int(index)) == hemisphere
            and "ctx-" in table[int(index)][0]
        ]
        if not ctx_ids:
            continue
        pial, _ = read_geometry(source / "surf" / f"{prefix}.pial")
        white, _ = read_geometry(source / "surf" / f"{prefix}.white")
        path = yeo.annotation_path(source, prefix)
        annot_labels, colors, names = read_annot(path)
        if len(annot_labels) != len(pial):
            raise ValueError(f"{path.name} does not describe this surface's vertices")
        yeo.verify_palette(colors, names)
        network_ids = yeo.network_indices(annot_labels, names)
        mask = np.isin(labels, ctx_ids)
        coordinates = np.argwhere(mask)
        points = nib.affines.apply_affine(affine, coordinates)
        nearest = cKDTree(np.vstack([pial, white])).query(points)[1] % len(pial)
        votes = network_ids[nearest]
        voxel_labels = labels[tuple(coordinates.T)]
        for index in ctx_ids:
            compositions[region_id_of(index)] = yeo.composition(
                votes[voxel_labels == index]
            )
    return compositions


def build_regions(config, skip=()):
    image, labels, table = load(config)
    # float32 from the MGH header; the manifest is strict JSON with no NaN.
    voxel_volume = float(abs(np.linalg.det(image.header.get_vox2ras_tkr()[:3, :3])))
    indices, counts = np.unique(labels, return_counts=True)
    shares = cortical_network_compositions(config)
    regions = []
    skipped = set(skip)
    for index, count in zip(indices.tolist(), counts.tolist()):
        if index == BACKGROUND or index in skipped:
            continue
        published, _ = table[index]
        name = structure_name_of(published)
        hemisphere = hemisphere_of(index)
        region = {
            "id": region_id_of(index),
            "label": f"{name.replace('_', ' ')} · {hemisphere}",
            "source_name": name,
            "source_published_name": published,
            "atlas": ATLAS_ID,
            "hemisphere": hemisphere,
            "source_label_id": index,
            "kind": "tissue-region",
            "voxel_count": count,
            "voxel_size_mm": [float(x) for x in image.header.get_zooms()[:3]],
            "segmentation_volume_mm3": count * voxel_volume,
        }
        composition = shares.get(region["id"])
        if composition is not None:
            region["networks"] = composition
        regions.append(region)
    return regions


def export_atlas(config, regions):
    image, labels, table = load(config)
    published = {region["id"] for region in regions if region["atlas"] == ATLAS_ID}
    values, inverse = np.unique(labels, return_inverse=True)
    codes = inverse.reshape(labels.shape).astype(np.uint16)
    entries = []
    for index in values.tolist():
        name, color = table[index]
        region_id = region_id_of(index)
        if index != BACKGROUND and region_id not in published:
            raise ValueError(f"Cut label has no published region: {region_id}")
        entries.append(
            {
                "source_label_id": index,
                "name": name,
                "color": color,
                "hemisphere": hemisphere_of(index),
                "kind": "tissue",
                "region_id": None if index == BACKGROUND else region_id,
            }
        )
    encoded = nib.MGHImage(
        codes.astype(np.int32), image.affine, header=image.header.copy()
    )
    record = encode_cropped_volume(
        encoded,
        config["output_directory"] / f"tissues-{ATLAS_ID}.volume",
        np.dtype("<u2"),
    )
    record["labels"] = entries
    record["label_method"] = (
        "Published NextBrain MNI152 labels, nonlinearly warped to this subject and "
        "resampled with nearest neighbour; no label value is interpolated or invented"
    )
    return record
