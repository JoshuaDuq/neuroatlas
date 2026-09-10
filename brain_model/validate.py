"""Independent numerical invariants plus actual GLB round-trip checks."""

import json

import nibabel as nib
import numpy as np
import trimesh
from nibabel.freesurfer.io import read_annot, read_geometry
from scipy.ndimage import map_coordinates

from .export import compact_region
from .geometry import extract_structure, normalize, partition_surface, to_gltf
from .sources import read_config, sha256, verify_sources, write_json


def triangle_areas(triangles):
    return (
        np.linalg.norm(
            np.cross(
                triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
            ),
            axis=1,
        )
        / 2
    )


def validate_degenerate_parents(parents, triangles):
    for parent, triangle in zip(parents, triangles):
        edges = parent[[1, 2, 0]] - parent
        lengths = np.einsum("ni,ni->n", edges, edges)
        edge = int(np.argmax(lengths))
        if lengths[edge] == 0:
            distances = np.linalg.norm(triangle - parent[0], axis=1)
        else:
            position = (triangle - parent[edge]) @ edges[edge] / lengths[edge]
            closest = parent[edge] + np.clip(position, 0, 1)[:, None] * edges[edge]
            distances = np.linalg.norm(triangle - closest, axis=1)
        if distances.max() > 1e-9:
            raise ValueError("Geometry changed on a source degenerate triangle")


def validate_partition(vertices, faces, labels, partition):
    parents = vertices[faces[partition.parent_faces]]
    triangles = partition.vertices[partition.faces]
    source_area = triangle_areas(vertices[faces])
    regular = source_area[partition.parent_faces] > 0
    validate_degenerate_parents(parents[~regular], triangles[~regular])
    regular_parents, regular_triangles = parents[regular], triangles[regular]
    parent_normals = normalize(
        np.cross(
            regular_parents[:, 1] - regular_parents[:, 0],
            regular_parents[:, 2] - regular_parents[:, 0],
        )
    )
    plane_error = np.abs(
        np.einsum(
            "nvi,ni->nv", regular_triangles - regular_parents[:, :1], parent_normals
        )
    ).max(initial=0)
    if plane_error > 1e-9:
        raise ValueError(f"Exported triangles leave the source plane: {plane_error}")
    edge_a = regular_parents[:, 1] - regular_parents[:, 0]
    edge_b = regular_parents[:, 2] - regular_parents[:, 0]
    aa = np.einsum("ni,ni->n", edge_a, edge_a)
    bb = np.einsum("ni,ni->n", edge_b, edge_b)
    ab = np.einsum("ni,ni->n", edge_a, edge_b)
    relative = regular_triangles - regular_parents[:, :1]
    da = np.einsum("nvi,ni->nv", relative, edge_a)
    db = np.einsum("nvi,ni->nv", relative, edge_b)
    denominator = (aa * bb - ab * ab)[:, None]
    u = (bb[:, None] * da - ab[:, None] * db) / denominator
    v = (aa[:, None] * db - ab[:, None] * da) / denominator
    if min(u.min(initial=0), v.min(initial=0), (1 - u - v).min(initial=0)) < -1e-8:
        raise ValueError("Exported points leave their source triangle")
    actual_area = np.bincount(
        partition.parent_faces, weights=triangle_areas(triangles), minlength=len(faces)
    )
    area_error = np.abs(actual_area - source_area).max()
    if area_error > 1e-9:
        raise ValueError(f"Source triangle area is not conserved: {area_error}")
    for corner in range(3):
        original = partition.faces[:, corner] < len(vertices)
        owned = partition.faces[original, corner]
        if not np.array_equal(partition.labels[original], labels[owned]):
            raise ValueError("Source vertex label ownership changed")
    covered = np.unique(partition.faces[partition.faces < len(vertices)])
    if not np.array_equal(covered, np.unique(faces)):
        raise ValueError("Some source vertices were lost")
    return {
        "source_vertices": len(vertices),
        "source_triangles": len(faces),
        "source_zero_area_triangles": int(np.count_nonzero(source_area == 0)),
        "export_triangles": len(partition.faces),
        "maximum_parent_plane_error_mm": float(plane_error),
        "maximum_parent_area_error_mm2": float(area_error),
        "source_surface_area_mm2": float(source_area.sum()),
        "source_vertex_labels_preserved": True,
    }


def read_meshes(path):
    scene = trimesh.load_scene(path, process=False)
    meshes = {}
    for node in scene.graph.nodes_geometry:
        transform, name = scene.graph[node]
        if not np.array_equal(transform, np.eye(4)):
            raise ValueError(f"Unexpected object transform: {node}")
        mesh = scene.geometry[name]
        region = mesh.metadata["region_id"]
        if region in meshes:
            raise ValueError(f"Duplicate region: {region}")
        if (
            not np.isfinite(mesh.vertices).all()
            or not np.isfinite(mesh.vertex_normals).all()
        ):
            raise ValueError(f"Nonfinite geometry: {region}")
        meshes[region] = mesh
    return meshes


def validate_atlas(config, atlas):
    path = config["output_directory"] / f"cortex-{atlas['id']}.glb"
    meshes = read_meshes(path)
    reports = {}
    max_error = 0.0
    normal_error = 0.0
    expected_ids = set()
    for prefix, hemisphere in [("lh", "left"), ("rh", "right")]:
        vertices, faces = read_geometry(
            config["source_directory"] / "surf" / f"{prefix}.pial"
        )
        labels, _, _ = read_annot(
            config["source_directory"]
            / "label"
            / f"{prefix}.{atlas['annotation']}.annot"
        )
        partition = partition_surface(vertices, faces, labels)
        reports[hemisphere] = validate_partition(vertices, faces, labels, partition)
        for label in np.unique(labels):
            region_id = f"{atlas['id']}:{hemisphere}:{label}"
            expected_ids.add(region_id)
            actual = meshes[region_id]
            points, triangles, normals = compact_region(partition, label)
            error = (
                np.linalg.norm(actual.vertices - to_gltf(points), axis=1).max() * 1000
            )
            max_error = max(max_error, float(error))
            normal_error = max(
                normal_error,
                float(
                    np.abs(actual.vertex_normals - normalize(to_gltf(normals))).max()
                ),
            )
            if not np.array_equal(actual.faces, triangles):
                raise ValueError(f"Triangle topology changed: {region_id}")
            if actual.metadata["source_label_id"] != label:
                raise ValueError(f"Source label metadata changed: {region_id}")
            ratio = actual.area * 1e6 / triangle_areas(points[triangles]).sum()
            if abs(ratio - 1) > config["validation"]["relative_area_tolerance"]:
                raise ValueError(f"Exported surface area changed: {region_id}")
    if set(meshes) != expected_ids:
        raise ValueError("GLB has missing or unexpected region meshes")
    if (
        max_error > config["validation"]["coordinate_tolerance_mm"]
        or normal_error > 1e-6
    ):
        raise ValueError("GLB export exceeds coordinate or normal tolerance")
    return {
        "file": path.name,
        "sha256": sha256(path),
        "mesh_count": len(meshes),
        "hemispheres": reports,
        "maximum_glb_coordinate_error_mm": max_error,
        "maximum_normal_component_error": normal_error,
    }


def validate_structures(config):
    path = config["output_directory"] / "structures.glb"
    meshes = read_meshes(path)
    image = nib.load(config["source_directory"] / "mri/aseg.mgz")
    volume = np.asarray(image.dataobj)
    inverse = np.linalg.inv(image.header.get_vox2ras_tkr())
    reports = []
    found = set()
    for region_id, mesh in meshes.items():
        label = mesh.metadata["source_label_id"]
        found.add(label)
        # Inverse of (R,S,-A)/1000; compare to the actual source segmentation.
        ras = mesh.vertices[:, [0, 2, 1]] * [1000, -1000, 1000]
        voxels = nib.affines.apply_affine(inverse, ras)
        values = map_coordinates(
            (volume == label).astype(np.float32), voxels.T, order=1, prefilter=False
        )
        # Lewiner's ambiguity resolution adds cube-center vertices. They are
        # topology support points, not necessarily on the trilinear 0.5 level.
        fractions = np.mod(voxels, 1)
        centers = np.all(np.abs(fractions - 0.5) < 1e-5, axis=1)
        level_error = float(np.abs(values[~centers] - 0.5).max(initial=0))
        if level_error > 0.0001:
            raise ValueError(
                f"Structure edge vertices left the source isosurface: {region_id}"
            )
        reference = extract_structure(volume, label, image.header.get_vox2ras_tkr())
        coordinate_error = float(np.linalg.norm(ras - reference.vertices, axis=1).max())
        if coordinate_error > config["validation"]["coordinate_tolerance_mm"]:
            raise ValueError(
                f"Structure export moved source-derived vertices: {region_id}"
            )
        if not np.array_equal(reference.faces, mesh.faces):
            raise ValueError(f"Structure export changed triangle topology: {region_id}")
        if not mesh.is_watertight or mesh.volume <= 0:
            raise ValueError(
                f"Structure must be closed and outward oriented: {region_id}"
            )
        hemisphere = mesh.metadata["hemisphere"]
        if hemisphere == "left" and mesh.centroid[0] >= 0:
            raise ValueError(f"Left structure on wrong side: {region_id}")
        if hemisphere == "right" and mesh.centroid[0] <= 0:
            raise ValueError(f"Right structure on wrong side: {region_id}")
        reports.append(
            {
                "id": region_id,
                "closed": True,
                "maximum_edge_vertex_isovalue_error": level_error,
                "marching_cubes_auxiliary_center_vertices": int(centers.sum()),
                "maximum_glb_coordinate_error_mm": coordinate_error,
                "maximum_trilinear_isovalue_deviation": float(
                    np.abs(values - 0.5).max()
                ),
                "mesh_volume_mm3": float(mesh.volume * 1e9),
            }
        )
    if found != set(config["structures"]["labels"]):
        raise ValueError("Missing or unexpected internal anatomy")
    return {"file": path.name, "sha256": sha256(path), "regions": reports}


def main():
    config = read_config()
    verify_sources()
    manifest = json.loads((config["output_directory"] / "manifest.json").read_text())
    identifiers = [region["id"] for region in manifest["regions"]]
    if len(identifiers) != len(set(identifiers)):
        raise ValueError("Manifest contains duplicate IDs")
    report = {
        "status": "passed",
        "scope": "Source-to-asset conversion fidelity",
        "clinical_accuracy_validated": False,
        "atlases": [validate_atlas(config, atlas) for atlas in config["atlases"]],
        "structures": validate_structures(config),
    }
    write_json(config["output_directory"] / "validation.json", report)
    print(
        json.dumps(
            {
                "status": report["status"],
                "atlas_max_errors_mm": {
                    atlas["file"]: atlas["maximum_glb_coordinate_error_mm"]
                    for atlas in report["atlases"]
                },
                "structures": len(report["structures"]["regions"]),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
