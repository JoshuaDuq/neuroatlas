"""Traceable anatomical unions with bounded, illustrative display surfaces."""

import numpy as np
import trimesh
import yaml

from ..gltf.export import add_region, published_area_mm2, write_scene
from ..labels import cerebellum, nextbrain
from ..labels.volumes import conformed_grid, load_on_grid
from ..sources import ROOT, read_color_table
from ..surfaces.geometry import extract_structure, smooth_display

ATLAS_ID = "learning"


def read_definition(config):
    definition = yaml.safe_load((ROOT / "config/learning-anatomy.yaml").read_text())
    excluded = config["anatomy"].get("learning", {}).get("exclude_aseg_units", [])
    if not isinstance(excluded, list) or any(not isinstance(unit, str) for unit in excluded):
        raise ValueError("Overview exclusions must be a list of unit names")
    lobules = definition["cerebnet"]
    replaced = lobules["replaces_aseg_units"] if cerebellum.is_declared(config) else []
    unknown = set(excluded + replaced) - {unit["id"] for unit in definition["aseg"]}
    if unknown:
        raise ValueError(f"Unknown aseg overview units: {sorted(unknown)}")
    definition["aseg"] = [
        unit for unit in definition["aseg"] if unit["id"] not in excluded + replaced
    ]
    definition["cerebnet"] = lobules["units"] if cerebellum.is_declared(config) else []
    return definition


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


def source_groups(config, nextbrain_source):
    """Each source's label grid and display units; the two grids need not match."""
    definition = read_definition(config)
    grid, table = nextbrain_source
    yield "nextbrain", grid, table, expand_nextbrain(definition["nextbrain"], table)
    grid = conformed_grid(load_on_grid(config, config["source_directory"] / "mri/aseg.mgz"))
    table = read_color_table()
    for group in definition["aseg"]:
        if set(group["labels"]) - set(table):
            raise ValueError(f"Unknown aseg constituent: {group['id']}")
    yield "aseg", grid, table, definition["aseg"]
    if definition["cerebnet"]:
        for group in definition["cerebnet"]:
            if set(group["labels"]) - cerebellum.LOBULES:
                raise ValueError(f"Unknown CerebNet lobule: {group['id']}")
        # Listed in the configured anatomical order, a lobule's sides together.
        names = list(dict.fromkeys(group["name"] for group in definition["cerebnet"]))
        groups = [
            {**group, "family_order": names.index(group["name"])}
            for group in definition["cerebnet"]
        ]
        yield "cerebnet", cerebellum.load(config), cerebellum.LOBULES, groups


def source_grids(grids):
    return {
        source: {
            "voxel_to_surface_ras_mm": grid.voxel_to_surface.tolist(),
            "voxel_size_mm": grid.spacing_mm,
        }
        for source, grid in grids
    }


def constituent_id(source, side, label):
    hemisphere = nextbrain.hemisphere_of(label) if source == "nextbrain" else side
    return f"{source}:{hemisphere}:{label}"


def family_order(group):
    return {"family_order": group["family_order"]} if "family_order" in group else {}


def constituents(source, side, members):
    """Published regions a unit is the union of; CerebNet publishes none of its own."""
    if source == cerebellum.ATLAS_ID:
        return {}
    return {
        "constituent_regions": [constituent_id(source, side, label) for label in members]
    }


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
        **constituents(source, side, members),
        **family_order(group),
        "display_names": {"en": group["name"], "fr": group["name_fr"]},
        "system_names": {"en": group["system"], "fr": group["system_fr"]},
        "display_color": group["color"],
        "voxel_count": int(np.count_nonzero(np.isin(volume, members))),
    }


def build(config):
    definition = read_definition(config)
    scene = trimesh.Scene()
    regions = []
    grids = []
    for source, grid, table, groups in source_groups(config, nextbrain.load(config)):
        grids.append((source, grid))
        volume, affine = grid.labels, grid.voxel_to_surface
        combined = combine_labels(volume, groups)
        for code, group in enumerate(groups, 1):
            if not np.any(combined == code):
                continue
            region = region_record(group, source, volume)
            original = extract_structure(combined, code, affine)
            mesh = smooth_display(
                original, combined == code, affine, definition["smoothing"]
            )
            region.update(
                voxel_size_mm=grid.spacing_mm,
                segmentation_volume_mm3=region["voxel_count"] * grid.voxel_volume_mm3,
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
        "source_grids": source_grids(grids),
        "palette_method": "Distinct teaching colours for display units, not the source LUT",
        "display_geometry": {
            "method": "Explicit source-label unions; bounded Taubin display smoothing",
            **definition["smoothing"],
            "source_volumes_unchanged": True,
        },
    }, regions
