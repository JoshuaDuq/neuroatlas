"""Published NextBrain histological labels, warped once into the subject grid.

NextBrain is purely volumetric: it delineates deep nuclei that no cortical
surface annotation describes, and it has no surface counterpart. It therefore
enters this model as a cut-label source only, contributing regions that carry
measured volumes but no mesh.

The warp from MNI152 to this subject is deliberately not reproducible from this
package. It needs ANTs and runs for minutes, so `scripts/warp_nextbrain.py`
performs it once and records the result in `data/sources.json` as a checksummed
derived source, which `verify_sources` then guards like any downloaded input.
Because that artefact is optional, a checkout without it still builds every
atlas that needs no warp.
"""

import re

import nibabel as nib
import numpy as np

from .volumes import encode_volume, load_on_grid

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
    """A published name reduced to the structure it actually identifies.

    Two prefixes are dropped. `Left-`/`Right-` goes because laterality is carried
    by `hemisphere` and displayed as its own field, matching the aseg and
    Destrieux catalogues. `ctx-rh-` goes because it is an artefact of the reused
    label block, and keeping it would contradict the hemisphere the same record
    reports. `source_published_name` retains the original string for provenance,
    and the cut labels keep it verbatim.
    """
    for prefix in ("Left-", "Right-"):
        if published.startswith(prefix):
            published = published[len(prefix) :]
            break
    return VESTIGIAL_CORTEX_PREFIX.sub("", published)


def read_lut(path):
    """Parse the published `index name R G B A` table, ignoring alpha."""
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
    """Whether this checkout is configured for the warp and has run it."""
    if ATLAS_ID not in config:
        return False
    return all(path.exists() for path in paths(config))


def load(config):
    """The warped labels on the subject grid, with their published names.

    `load_on_grid` carries the whole guarantee of this module: labels that do
    not share the reference voxel-to-RAS mapping exactly would be drawn at the
    wrong place on a cut, which is worse than not drawing them at all.
    """
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
    """Which ROIs get a mesh, in label order.

    Below `minimum` voxels a marching-cubes surface asserts a shape the warped
    1 mm grid cannot support: several ROIs survive resampling as a single voxel,
    and a 1 mm cube is not anatomy. Everything excluded here remains a cut label,
    so it is still named, searchable and selectable on a cut face.
    """
    indices, counts = np.unique(labels, return_counts=True)
    return [
        int(index)
        for index, count in zip(indices.tolist(), counts.tolist())
        if index != BACKGROUND
        and count >= minimum
        and not is_bulk(table[index][0])
    ]


def build_regions(config, skip=()):
    """One selectable, mesh-less region per delineated ROI present in the warp.

    ROIs the LUT names but the resampled volume does not contain are omitted
    rather than published as empty regions: the atlas states that small regions
    do not survive resampling to 1 mm, and an empty region would misreport that
    documented loss as anatomy. `skip` carries the ROIs that were given solid
    geometry instead, which are published as structures rather than here.
    """
    image, labels, table = load(config)
    # float32 from the MGH header; the manifest is strict JSON with no NaN.
    voxel_volume = float(abs(np.linalg.det(image.header.get_vox2ras_tkr()[:3, :3])))
    indices, counts = np.unique(labels, return_counts=True)
    regions = []
    skipped = set(skip)
    for index, count in zip(indices.tolist(), counts.tolist()):
        if index == BACKGROUND or index in skipped:
            continue
        published, _ = table[index]
        name = structure_name_of(published)
        hemisphere = hemisphere_of(index)
        regions.append(
            {
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
        )
    return regions


def export_atlas(config, regions):
    """The compact label grid and palette for the GPU cut, as a tissue record.

    Region ids are reconstructed rather than searched: both sides derive them
    from the same LUT index, so a mismatch is a build error worth raising here
    rather than a silently unselectable region in the viewer.
    """
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
    record = encode_volume(
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
