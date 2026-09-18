"""Traceable anatomical unions with bounded, illustrative display surfaces."""

import numpy as np
import trimesh
import yaml
from trimesh.smoothing import filter_taubin

from . import nextbrain
from .export import add_region, published_area_mm2, write_scene
from .geometry import extract_structure
from .sources import ROOT, read_color_table
from .volumes import load_on_grid

ATLAS_ID = "learning"


def read_definition():
    return yaml.safe_load((ROOT / "config/learning-anatomy.yaml").read_text())


def combine_labels(volume, groups):
    if volume.ndim != 3 or not np.all(volume == np.rint(volume)):
        raise ValueError("An integer 3D segmentation is required")
    if volume.size == 0 or volume.min() < 0:
        raise ValueError("Segmentation must contain nonnegative labels")
    lookup = np.zeros(int(volume.max()) + 1, dtype=np.uint16)
    seen = set()
    for code, group in enumerate(groups, 1):
        members = group["labels"]
        if not members or any(not isinstance(x, int) or x <= 0 for x in members):
            raise ValueError(f"Invalid source labels: {group['id']}")
        if seen.intersection(members) or len(set(members)) != len(members):
            raise ValueError("Source label assigned to multiple learning units")
        seen.update(members)
        for label in members:
            if label < len(lookup):
                lookup[label] = code
    return lookup[volume.astype(np.int64)]


def smooth_display(source, settings):
    iterations = settings["iterations"]
    maximum = settings["maximum_displacement_mm"]
    if not isinstance(iterations, int) or iterations < 1:
        raise ValueError("Smoothing iterations must be a positive integer")
    if not np.isfinite(maximum) or maximum <= 0:
        raise ValueError("Display displacement must be finite and positive")
    mesh = source.copy()
    filter_taubin(mesh, lamb=0.5, nu=0.53, iterations=iterations)
    displacement = mesh.vertices - source.vertices
    lengths = np.linalg.norm(displacement, axis=1)
    scale = np.ones_like(lengths)
    np.divide(maximum, lengths, out=scale, where=lengths > maximum)
    mesh.vertices = source.vertices + displacement * scale[:, None]
    if not np.isfinite(mesh.vertices).all() or mesh.volume <= 0:
        raise ValueError("Display smoothing produced invalid geometry")
    return mesh


def expand_nextbrain(groups, table):
    expanded = []
    base_labels = {index % nextbrain.HEMISPHERE_OFFSET for index in table}
    for group in groups:
        unknown = set(group["labels"]) - base_labels
        if unknown:
            raise ValueError(f"Unknown NextBrain constituent labels: {unknown}")
        if group.get("hemisphere") == "midline":
            expanded.append(
                {
                    **group,
                    "id": f"midline:{group['id']}",
                    "hemisphere": "midline",
                    "labels": [
                        label + offset
                        for label in group["labels"]
                        for offset in (0, nextbrain.HEMISPHERE_OFFSET)
                    ],
                }
            )
            continue
        for side, offset in (("left", 0), ("right", nextbrain.HEMISPHERE_OFFSET)):
            expanded.append(
                {
                    **group,
                    "id": f"{side}:{group['id']}",
                    "hemisphere": side,
                    "labels": [label + offset for label in group["labels"]],
                }
            )
    return expanded


def source_groups(config):
    definition = read_definition()
    image, labels, table = nextbrain.load(config)
    yield (
        "nextbrain",
        image,
        labels,
        table,
        expand_nextbrain(definition["nextbrain"], table),
    )
    image = load_on_grid(config, config["source_directory"] / "mri/aseg.mgz")
    table = read_color_table()
    for group in definition["aseg"]:
        if set(group["labels"]) - set(table):
            raise ValueError(f"Unknown aseg constituent: {group['id']}")
    yield "aseg", image, np.asarray(image.dataobj), table, definition["aseg"]


def constituent_id(source, side, label):
    hemisphere = nextbrain.hemisphere_of(label) if source == "nextbrain" else side
    return f"{source}:{hemisphere}:{label}"


def region_record(group, source, volume):
    members = [label for label in group["labels"] if np.any(volume == label)]
    side = group["hemisphere"]
    return {
        "id": f"{ATLAS_ID}:{group['id']}",
        "atlas": ATLAS_ID,
        "kind": "structure",
        "hemisphere": side,
        "label": f"{group['name']} · {side}",
        "source_name": group["name"],
        # A display union has several source IDs; it has no invented source ID.
        "source_label_id": None,
        "source_atlas": source,
        "source_label_ids": members,
        "constituent_regions": [
            constituent_id(source, side, label) for label in members
        ],
        "display_names": {"en": group["name"], "fr": group["name_fr"]},
        "system_names": {"en": group["system"], "fr": group["system_fr"]},
        "display_color": group["color"],
        "voxel_count": int(np.count_nonzero(np.isin(volume, members))),
    }


def build(config):
    definition = read_definition()
    scene = trimesh.Scene()
    regions = []
    for source, image, volume, table, groups in source_groups(config):
        combined = combine_labels(volume, groups)
        affine = image.header.get_vox2ras_tkr()
        voxel_volume = float(abs(np.linalg.det(affine[:3, :3])))
        for code, group in enumerate(groups, 1):
            if not np.any(combined == code):
                continue
            region = region_record(group, source, volume)
            original = extract_structure(combined, code, affine)
            mesh = smooth_display(original, definition["smoothing"])
            region.update(
                voxel_size_mm=[float(x) for x in image.header.get_zooms()[:3]],
                segmentation_volume_mm3=region["voxel_count"] * voxel_volume,
                display_maximum_displacement_mm=float(
                    np.linalg.norm(mesh.vertices - original.vertices, axis=1).max()
                ),
            )
            exported = add_region(
                scene,
                mesh.vertices,
                mesh.faces,
                mesh.vertex_normals,
                region,
                group["color"],
            )
            region.update(
                vertex_count=len(exported.vertices),
                triangle_count=len(exported.faces),
                surface_area_mm2=published_area_mm2(exported.vertices, exported.faces),
            )
            regions.append(region)
    write_scene(scene, config["output_directory"] / "learning.glb")
    return {
        "id": ATLAS_ID,
        "label": definition["label"],
        "file": "learning.glb",
        "region_count": len(regions),
        "voxel_to_surface_ras_mm": affine.tolist(),
        "palette_method": "Distinct teaching colours for display units, not the source LUT",
        "display_geometry": {
            "method": "Explicit source-label unions; bounded Taubin display smoothing",
            **definition["smoothing"],
            "source_volumes_unchanged": True,
        },
    }, regions
