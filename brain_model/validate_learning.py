"""Independent source membership and exported display-geometry checks."""

import numpy as np
import trimesh

from .geometry import extract_structure
from .learning import read_definition, source_groups
from .sources import sha256


def expected_metadata(config):
    records = {}
    for source, image, volume, table, groups in source_groups(config):
        affine = image.header.get_vox2ras_tkr()
        voxel_volume = float(abs(np.linalg.det(affine[:3, :3])))
        for group in groups:
            members = [label for label in group["labels"] if np.any(volume == label)]
            if not members:
                continue
            side = group["hemisphere"]
            count = sum(int(np.count_nonzero(volume == label)) for label in members)
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
                "label": f"{group['name']} · {side}",
                "display_names": {"en": group["name"], "fr": group["name_fr"]},
                "system_names": {"en": group["system"], "fr": group["system_fr"]},
                "voxel_count": count,
                "segmentation_volume_mm3": count * voxel_volume,
                "voxel_size_mm": [float(x) for x in image.header.get_zooms()[:3]],
                "constituent_regions": [
                    f"{source}:{side}:{label}" for label in members
                ],
            }
    return records, affine


def validate(config, manifest):
    path = config["output_directory"] / "learning.glb"
    scene = trimesh.load_scene(path, process=False)
    meshes = {mesh.metadata["region_id"]: mesh for mesh in scene.geometry.values()}
    regions = {region["id"]: region for region in manifest["regions"]}
    maximum = read_definition()["smoothing"]["maximum_displacement_mm"]
    tolerance = config["validation"]["coordinate_tolerance_mm"]
    reports = []
    for source, image, volume, table, groups in source_groups(config):
        affine = image.header.get_vox2ras_tkr()
        for group in groups:
            mask = np.isin(volume, group["labels"])
            if not mask.any():
                continue
            region_id = f"learning:{group['id']}"
            mesh = meshes[region_id]
            record = regions[region_id]
            if not np.array_equal(
                mesh.visual.material.baseColorFactor[:3], group["color"]
            ):
                raise ValueError(f"Learning palette mismatch: {region_id}")
            for member in record["constituent_regions"]:
                if member not in regions:
                    raise ValueError(f"Missing constituent region: {member}")
            # Invert the glTF coordinate convention, compare in physical mm.
            ras = mesh.vertices[:, [0, 2, 1]] * [1000, -1000, 1000]
            reference = extract_structure(mask, 1, affine)
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
    }
