"""NextBrain histological labels for one brain, on their own grid in its surface RAS."""

import gzip
import hashlib
import re

import nibabel as nib
import numpy as np
from nibabel.affines import apply_affine

from .sources import ROOT, sha256
from .volumes import LabelGrid, encode_cropped_array, offset_by, place_crop

ATLAS_ID = "nextbrain"

# How an anatomy's volume was made, which decides what its limitations say,
# and the script whose recorded provenance must agree.
SUBJECT_SEGMENTATION = "subject-segmentation"
MNI152_WARP = "mni152-warp"
PROCEDURE_SCRIPTS = {
    SUBJECT_SEGMENTATION: "scripts/segment_nextbrain.py",
    MNI152_WARP: "scripts/warp_nextbrain.py",
}

# The published LUT encodes laterality in the index itself: right-hemisphere
# regions repeat their left-hemisphere index offset by this much.
HEMISPHERE_OFFSET = 10000

BACKGROUND = 0

# NextBrain reuses FreeSurfer's right-hemisphere cortical label block (2001-2035)
# for both hemispheres, so every published cortical name contains this fragment
# whichever side it describes. It names a label block, not a side.
VESTIGIAL_CORTEX_PREFIX = re.compile(r"^ctx-[lr]h-")

# Placement check: labelled NextBrain voxels that fall inside aseg's labelled
# volume. Measured 0.98 for a subject segmentation and 0.93 for the MNI warps;
# a volume placed by its own header's tkregister matrix scores 0.58.
REGISTRATION_SAMPLES = 20000
MINIMUM_SHARE_INSIDE_ASEG = 0.9


def hemisphere_of(index):
    if index == BACKGROUND:
        return "midline"
    return "right" if index > HEMISPHERE_OFFSET else "left"


def partner_of(index):
    """The same ROI in the other hemisphere."""
    return index - HEMISPHERE_OFFSET if index > HEMISPHERE_OFFSET else index + HEMISPHERE_OFFSET


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


def verify_procedure(config, provenance):
    """The configured procedure is a claim; the recorded provenance must back it."""
    procedure = config[ATLAS_ID]["procedure"]
    volume_path, _ = paths(config)
    relative = str(volume_path.relative_to(ROOT))
    recorded = next(
        (s.get("procedure", "") for s in provenance["sources"] if s["path"] == relative), ""
    )
    if not recorded.startswith(PROCEDURE_SCRIPTS[procedure] + ":"):
        raise ValueError(
            f"{relative} is configured as {procedure} but was recorded by "
            f"{recorded.split(':')[0] or 'nothing'}; run {PROCEDURE_SCRIPTS[procedure]} "
            f"--anatomy {config['anatomy']['id']} --record"
        )


def scanner_to_surface(config):
    orig = nib.load(config["source_directory"] / "mri/orig.mgz")
    return orig.header.get_vox2ras_tkr() @ np.linalg.inv(orig.affine)


def share_inside_aseg(config, grid):
    aseg = nib.load(config["source_directory"] / "mri/aseg.mgz")
    labelled = np.flatnonzero(grid.labels.ravel() != BACKGROUND)
    picked = np.random.default_rng(0).choice(
        labelled, min(REGISTRATION_SAMPLES, len(labelled)), replace=False
    )
    points = apply_affine(grid.voxel_to_surface, np.column_stack(
        np.unravel_index(picked, grid.labels.shape)
    ))
    voxels = np.rint(apply_affine(np.linalg.inv(aseg.header.get_vox2ras_tkr()), points))
    voxels = voxels.astype(int)
    data = np.asarray(aseg.dataobj)
    inside = np.all((voxels >= 0) & (voxels < data.shape), axis=1)
    values = np.zeros(len(voxels), data.dtype)
    values[inside] = data[tuple(voxels[inside].T)]
    return float(np.mean(values != 0))


def load(config):
    volume_path, lut_path = paths(config)
    image = nib.load(volume_path)
    labels = np.asarray(image.dataobj)
    if not np.all(labels == np.rint(labels)):
        raise ValueError("NextBrain volume must contain integer label values.")
    labels = labels.astype(np.int64)
    table = read_lut(lut_path)
    unknown = sorted(set(np.unique(labels).tolist()) - set(table))
    if unknown:
        raise ValueError(f"NextBrain labels absent from the published LUT: {unknown}")
    # An MGH header's own tkregister matrix is centred on that volume, so it is
    # the subject's surface RAS only for the conformed grid. The scanner affine,
    # through orig.mgz, places a volume on any grid.
    grid = LabelGrid(
        labels,
        scanner_to_surface(config) @ image.affine,
        [float(x) for x in image.header.get_zooms()[:3]],
    )
    share = share_inside_aseg(config, grid)
    if share < MINIMUM_SHARE_INSIDE_ASEG:
        raise ValueError(
            f"NextBrain volume is not registered to this brain: only {share:.0%} of "
            "its labelled voxels fall inside aseg"
        )
    return grid, table


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


def meshed_indices(grid, table, minimum_mm3):
    indices, counts = np.unique(grid.labels, return_counts=True)
    return [
        int(index)
        for index, count in zip(indices.tolist(), counts.tolist())
        if index != BACKGROUND
        and count * grid.voxel_volume_mm3 >= minimum_mm3
        and not is_bulk(table[index][0])
    ]


def cortical_network_compositions(config):
    from nibabel.freesurfer.io import read_annot, read_geometry
    from scipy.spatial import cKDTree

    from . import networks as yeo

    if not yeo.is_available(config):
        return {}
    grid, table = load(config)
    labels = grid.labels
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
        points = apply_affine(grid.voxel_to_surface, coordinates)
        nearest = cKDTree(np.vstack([pial, white])).query(points)[1] % len(pial)
        votes = network_ids[nearest]
        voxel_labels = labels[tuple(coordinates.T)]
        for index in ctx_ids:
            compositions[region_id_of(index)] = yeo.composition(
                votes[voxel_labels == index]
            )
    return compositions


def build_regions(config, skip=()):
    grid, table = load(config)
    indices, counts = np.unique(grid.labels, return_counts=True)
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
            "voxel_size_mm": grid.spacing_mm,
            "segmentation_volume_mm3": count * grid.voxel_volume_mm3,
        }
        composition = shares.get(region["id"])
        if composition is not None:
            region["networks"] = composition
        regions.append(region)
    return regions


def cut_block(grid, spacing_mm):
    """Whole source voxels per cut-label voxel edge: the block nearest the target."""
    if not np.allclose(grid.spacing_mm, grid.spacing_mm[0], rtol=1e-4):
        raise ValueError("Cut labels need an isotropic NextBrain grid.")
    return max(1, round(spacing_mm / grid.spacing_mm[0]))


def volume_counts(labels):
    """Voxel count per label, with background present even where none is."""
    values, counts = np.unique(labels, return_counts=True)
    if BACKGROUND not in values:
        at = np.searchsorted(values, BACKGROUND)
        values, counts = np.insert(values, at, BACKGROUND), np.insert(counts, at, 0)
    return values, counts


def block_majority(labels, block):
    """Each block's most frequent label; a tie goes to the label rarer in the volume.

    Rarity rather than index breaks ties because indices are names, and because a
    half-covered block matters more to a thin structure than to its neighbour.
    Equal rarity falls back to the smaller index. Blocks overhanging the grid
    count the missing voxels as background.
    """
    if block == 1:
        return labels.copy()
    values, counts = volume_counts(labels)
    preference = np.lexsort((values, counts))
    rank = np.empty(len(values), np.int16)
    rank[preference] = np.arange(len(values))
    ranked = np.pad(
        rank[np.searchsorted(values, labels)],
        [(0, -size % block) for size in labels.shape],
        constant_values=rank[np.searchsorted(values, BACKGROUND)],
    )
    shape = [size // block for size in ranked.shape]
    votes = ranked.reshape(shape[0], block, shape[1], block, shape[2], block)
    votes = np.sort(votes.transpose(0, 2, 4, 1, 3, 5).reshape(*shape, block**3), axis=-1)
    best = votes[..., 0].copy()
    best_count = np.ones(shape, np.int8)
    run = np.ones(shape, np.int8)
    for i in range(1, block**3):
        run = np.where(votes[..., i] == votes[..., i - 1], run + 1, 1).astype(np.int8)
        better = run > best_count
        best = np.where(better, votes[..., i], best)
        best_count = np.where(better, run, best_count)
    return values[preference[best]]


def cut_grid(grid, spacing_mm):
    block = cut_block(grid, spacing_mm)
    centre = (block - 1) / 2
    scale = np.diag([block, block, block, 1.0])
    scale[:3, 3] = centre
    return LabelGrid(
        block_majority(grid.labels, block),
        grid.voxel_to_surface @ scale,
        [size * block for size in grid.spacing_mm],
    ), block


def label_method(config, block):
    if config[ATLAS_ID]["procedure"] == SUBJECT_SEGMENTATION:
        source = (
            "NextBrain labels from this brain's own Bayesian segmentation "
            "(FreeSurfer 8.2, 0.4 mm)"
        )
    else:
        source = (
            "Published NextBrain MNI152 labels, nonlinearly warped to this brain and "
            "resampled with nearest neighbour"
        )
    if block == 1:
        return f"{source}; no label value is interpolated or invented"
    return (
        f"{source}, reduced to {block}x{block}x{block} blocks for cut faces: each "
        "block takes its most frequent label, a tie going to the label rarer in the "
        "whole volume. No label value is invented; surfaces and region measurements "
        "use the source grid."
    )


def export_atlas(config, regions):
    grid, table = load(config)
    coarse, block = cut_grid(grid, config[ATLAS_ID]["cut_label_spacing_mm"])
    published = {region["id"] for region in regions if region["atlas"] == ATLAS_ID}
    values, inverse = np.unique(coarse.labels, return_inverse=True)
    codes = inverse.reshape(coarse.labels.shape).astype(np.uint16)
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
    record = encode_cropped_array(
        codes,
        coarse.voxel_to_surface,
        coarse.spacing_mm,
        config["output_directory"] / f"tissues-{ATLAS_ID}.volume",
        np.dtype("<u2"),
    )
    record["labels"] = entries
    record["label_method"] = label_method(config, block)
    record["source_voxel_spacing_mm"] = grid.spacing_mm
    record["block"] = block
    record["labels_absent_from_cut"] = sorted(
        set(np.unique(grid.labels).tolist()) - set(values.tolist())
    )
    return record


def mark_uncut(regions, record):
    """A cut-only region too small to win any block is drawn by no cut."""
    absent = set(record["labels_absent_from_cut"])
    for region in regions:
        if (region["atlas"] == ATLAS_ID and region["kind"] == "tissue-region"
                and region["source_label_id"] in absent):
            region["cut_atlases"] = []


def validate_volume(config, record):
    """The published cut labels, checked as block majorities of the source grid.

    Counted label by label rather than by the sorted runs block_majority uses,
    so the check does not share the code it checks.
    """
    path = config["output_directory"] / record["file"]
    if sha256(path) != record["sha256"]:
        raise ValueError("NextBrain cut volume checksum mismatch")
    payload = gzip.decompress(path.read_bytes())
    if hashlib.sha256(payload).hexdigest() != record["decoded_sha256"]:
        raise ValueError("Decoded NextBrain cut volume checksum mismatch")
    grid, _ = load(config)
    block = cut_block(grid, config[ATLAS_ID]["cut_label_spacing_mm"])
    if record["block"] != block:
        raise ValueError("NextBrain cut volume has the wrong block size")
    corner = np.array(record["crop_corner_voxel"], int)
    scale = np.diag([block, block, block, 1.0])
    scale[:3, 3] = (block - 1) / 2
    if not np.allclose(
        record["voxel_to_surface_ras_mm"],
        grid.voxel_to_surface @ scale @ offset_by(corner),
        rtol=0, atol=1e-9,
    ):
        raise ValueError("NextBrain cut volume is not placed on its source blocks")
    shape = [-(-size // block) for size in grid.labels.shape]
    if record["source_shape"] != shape:
        raise ValueError("NextBrain cut volume records the wrong block grid")
    codes = np.frombuffer(payload, dtype=record["dtype"]).reshape(record["shape"], order="F")
    ids = np.array([label["source_label_id"] for label in record["labels"]])
    published = ids[place_crop(record, codes, shape)]

    values, counts = volume_counts(grid.labels)
    codes_of = np.pad(
        np.searchsorted(values, grid.labels).astype(np.int16),
        [(0, -size % block) for size in grid.labels.shape],
        constant_values=np.searchsorted(values, BACKGROUND),
    )
    blocks = codes_of.reshape(shape[0], block, shape[1], block, shape[2], block)
    blocks = blocks.transpose(0, 2, 4, 1, 3, 5).reshape(*shape, block**3)
    tally = (blocks[..., :, None] == blocks[..., None, :]).sum(axis=-1, dtype=np.int8)
    most = tally.max(axis=-1)
    chosen = np.searchsorted(values, published)
    if not np.array_equal(values[chosen], published):
        raise ValueError("NextBrain cut volume holds a label its source does not")
    if not np.array_equal((blocks == chosen[..., None]).sum(axis=-1, dtype=np.int8), most):
        raise ValueError("A NextBrain cut label is not its block's most frequent label")
    # Among a tied block's leaders, the rarest in the volume, then the smallest.
    key = counts.astype(np.float64)[blocks] * (values.max() + 1) + values[blocks]
    key[tally != most[..., None]] = np.inf
    expected = np.take_along_axis(blocks, key.argmin(axis=-1)[..., None], axis=-1)[..., 0]
    tied = int(np.count_nonzero((tally == most[..., None]).sum(axis=-1) > most))
    if not np.array_equal(expected, chosen):
        raise ValueError("A tied NextBrain cut block did not go to the rarer label")
    volume = dict(zip(values.tolist(), counts.tolist()))
    source_labels = set(volume) - {BACKGROUND}
    absent = sorted(source_labels - set(ids.tolist()))
    if record["labels_absent_from_cut"] != absent:
        raise ValueError("NextBrain cut volume misreports the labels it lost")
    agreement = float(np.mean(blocks == chosen[..., None]))
    return {
        "file": record["file"],
        "sha256": record["sha256"],
        "block": block,
        "voxel_spacing_mm": record["voxel_spacing_mm"],
        "every_block_is_its_majority": True,
        "tied_blocks": tied,
        "source_voxels_matching_their_cut_label": agreement,
        "labels_absent_from_cut": absent,
    }
