"""Independent source membership and exported display-geometry checks."""

import numpy as np
import trimesh

from .gltf.encode import published_display_colors
from .labels import cerebellum, nextbrain
from .labels.volumes import load_on_grid, resample_nearest
from .layers.learning import (
    constituents,
    family_order,
    read_definition,
    source_grids,
    source_groups,
)
from .sources import sha256
from .surfaces.geometry import (
    box_affine,
    extract_structure,
    label_boxes,
    misclassified_voxels,
)


def on_nextbrain_grid(config, path, grid):
    image = load_on_grid(config, path)
    coarse, _ = resample_nearest(
        np.asarray(image.dataobj), image.header.get_vox2ras_tkr(),
        grid.voxel_to_surface, grid.labels.shape,
    )
    return coarse


def validate_source_overlap(config, nextbrain_source):
    definition = read_definition(config)
    grid, table = nextbrain_source
    covered = np.isin(
        on_nextbrain_grid(config, config["source_directory"] / "mri/aseg.mgz", grid),
        [label for unit in definition["aseg"] for label in unit["labels"]],
    )
    if definition["cerebnet"]:
        covered |= np.isin(
            on_nextbrain_grid(config, cerebellum.path(config), grid),
            [label for unit in definition["cerebnet"] for label in unit["labels"]],
        )
    counts = np.bincount(grid.labels.ravel(), minlength=max(table) + 1)
    overlaps = np.bincount(grid.labels[covered], minlength=len(counts))
    reports = []
    for unit in definition["nextbrain"]:
        members = [
            label + offset for label in unit["labels"]
            for offset in (0, nextbrain.HEMISPHERE_OFFSET)
        ]
        total = int(counts[members].sum())
        if total == 0:
            continue
        fraction = float(overlaps[members].sum() / total)
        if fraction >= 0.5:
            raise ValueError(f"Learning unit {unit['id']} is mostly inside another source: {fraction:.3f}")
        reports.append({"unit": unit["id"], "cross_source_overlap_fraction": fraction})
    return reports


def label_counts(volume, groups):
    """Voxels of every label, including the ones a group names but the volume lacks."""
    return np.bincount(
        volume.ravel(), minlength=max(label for group in groups for label in group["labels"]) + 1
    )


def expected_metadata(config, nextbrain_source):
    records = {}
    grids = []
    for source, grid, table, groups in source_groups(config, nextbrain_source):
        grids.append((source, grid))
        counts = label_counts(grid.labels, groups)
        for group in groups:
            members = [label for label in group["labels"] if counts[label]]
            if not members:
                continue
            side = group["hemisphere"]
            count = int(counts[members].sum())
            region_id = f"learning:{group['id']}"
            records[region_id] = {
                "id": region_id,
                "atlas": "learning",
                "kind": "structure",
                "hemisphere": side,
                "source_name": group["name"],
                "source_label_id": None,
                "display_color": group["color"],
                "source_atlas": source,
                "source_label_ids": members,
                **constituents(source, side, members),
                **family_order(group),
                "label": f"{group['name']} · {side}",
                "display_names": {"en": group["name"], "fr": group["name_fr"]},
                "system_names": {"en": group["system"], "fr": group["system_fr"]},
                "voxel_count": count,
                "segmentation_volume_mm3": count * grid.voxel_volume_mm3,
                "voxel_size_mm": grid.spacing_mm,
            }
    return records, source_grids(grids)


def validate(config, manifest, nextbrain_source):
    path = config["output_directory"] / "learning.glb"
    scene = trimesh.load_scene(path, process=False)
    meshes = {mesh.metadata["region_id"]: mesh for mesh in scene.geometry.values()}
    colors = published_display_colors(path)
    regions = {region["id"]: region for region in manifest["regions"]}
    maximum = read_definition(config)["smoothing"]["maximum_displacement_mm"]
    tolerance = config["validation"]["coordinate_tolerance_mm"]
    reports = []
    for source, grid, table, groups in source_groups(config, nextbrain_source):
        volume, affine = grid.labels, grid.voxel_to_surface
        boxes = label_boxes(volume)
        for group in groups:
            present = [boxes[label] for label in group["labels"] if label in boxes]
            if not present:
                continue
            # The union of its members' boxes holds every voxel of the group.
            box = tuple(
                slice(min(member[axis].start for member in present),
                      max(member[axis].stop for member in present))
                for axis in range(3)
            )
            mask, local = np.isin(volume[box], group["labels"]), box_affine(affine, box)
            region_id = f"learning:{group['id']}"
            mesh = meshes[region_id]
            record = regions[region_id]
            if not np.allclose(colors[region_id], group["color"], rtol=0, atol=1e-6):
                raise ValueError(f"Learning palette mismatch: {region_id}")
            for member in record.get("constituent_regions", []):
                if member not in regions:
                    raise ValueError(f"Missing constituent region: {member}")
            # Invert the glTF coordinate convention, compare in physical mm.
            ras = mesh.vertices[:, [0, 2, 1]] * [1000, -1000, 1000]
            reference = extract_structure(mask, 1, local)
            if not np.array_equal(mesh.faces, reference.faces):
                raise ValueError(f"Learning display changed topology: {region_id}")
            displacement = float(np.linalg.norm(ras - reference.vertices, axis=1).max())
            if displacement > maximum + tolerance:
                raise ValueError(
                    f"Learning display exceeded displacement bound: {region_id}"
                )
            if (
                abs(displacement - record["display_maximum_displacement_mm"])
                > tolerance
            ):
                raise ValueError(
                    f"Learning displacement metadata mismatch: {region_id}"
                )
            misplaced = len(misclassified_voxels(ras, mesh.faces, mask, local))
            if misplaced:
                raise ValueError(
                    f"Learning display moved {misplaced} voxel centres across: {region_id}"
                )
            if not mesh.is_winding_consistent or mesh.volume <= 0:
                raise ValueError(f"Invalid learning display surface: {region_id}")
            if (
                not np.isfinite(mesh.vertices).all()
                or not np.isfinite(mesh.vertex_normals).all()
            ):
                raise ValueError(f"Nonfinite learning display: {region_id}")
            if record["voxel_count"] != int(mask.sum()):
                raise ValueError(f"Learning volume differs from union: {region_id}")
            reports.append(
                {
                    "id": region_id,
                    "source_atlas": source,
                    "source_voxel_count": int(mask.sum()),
                    "maximum_display_displacement_mm": displacement,
                    "misclassified_voxel_centres": misplaced,
                }
            )
    if set(meshes) != {record["id"] for record in reports}:
        raise ValueError("Learning display has unexpected or missing regions")
    return {
        "file": path.name,
        "sha256": sha256(path),
        "regions": reports,
        "source_volumes_unchanged": True,
        "maximum_allowed_displacement_mm": maximum,
        "cross_source_overlap": validate_source_overlap(config, nextbrain_source),
    }
