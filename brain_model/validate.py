"""Independent numerical invariants plus actual GLB round-trip checks."""

import json

import nibabel as nib
import numpy as np
import trimesh
from nibabel.freesurfer.io import read_annot, read_geometry
from scipy.ndimage import map_coordinates

from . import nextbrain
from .export import compact_region
from .geometry import extract_structure, normalize, partition_surface, to_gltf
from .sources import read_color_table, read_config, sha256, verify_sources, write_json
from .validate_volumes import validate_volumes


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


def oriented_triangle_codes(nodes):
    """Canonicalize cyclic order while retaining the triangle's winding."""
    starts = nodes.argmin(axis=1)
    ordered = np.take_along_axis(nodes, (starts[:, None] + np.arange(3)) % 3, axis=1)
    return ordered @ np.array([49, 7, 1])


def validate_tessellation(barycentric, partition, face_labels, regular):
    # Seven barycentric sites define the documented vertex-cell convention.
    sites = np.array(
        [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
            [0.5, 0.5, 0],
            [0, 0.5, 0.5],
            [0.5, 0, 0.5],
            [1 / 3, 1 / 3, 1 / 3],
        ]
    )
    distances = np.max(np.abs(barycentric[:, :, None] - sites), axis=3)
    nodes = distances.argmin(axis=2)
    if np.any(distances.min(axis=2) > 1e-8):
        raise ValueError("Unexpected barycentric tessellation vertex")
    actual = np.column_stack(
        [
            partition.parent_faces[regular],
            oriented_triangle_codes(nodes),
            partition.labels[regular],
        ]
    )
    uniform = np.all(face_labels == face_labels[:, :1], axis=1)
    counts = np.bincount(partition.parent_faces, minlength=len(face_labels))
    if not np.array_equal(counts, np.where(uniform, 1, 6)):
        raise ValueError("Incomplete source triangle tessellation")
    parent_ids = np.unique(partition.parent_faces[regular])
    uniform_ids = parent_ids[uniform[parent_ids]]
    mixed_ids = parent_ids[~uniform[parent_ids]]
    # This fixed reference is independent of partition_surface's edge indexing.
    cells = np.array([[0, 3, 6], [0, 6, 5], [1, 4, 6], [1, 6, 3], [2, 5, 6], [2, 6, 4]])
    expected = np.vstack(
        [
            np.column_stack(
                [uniform_ids, np.full(len(uniform_ids), 9), face_labels[uniform_ids, 0]]
            ),
            np.column_stack(
                [
                    np.repeat(mixed_ids, 6),
                    np.tile(oriented_triangle_codes(cells), len(mixed_ids)),
                    face_labels[mixed_ids][:, cells[:, 0]].ravel(),
                ]
            ),
        ]
    )
    actual = actual[np.lexsort((actual[:, 1], actual[:, 0]))]
    expected = expected[np.lexsort((expected[:, 1], expected[:, 0]))]
    if not np.array_equal(actual, expected):
        raise ValueError(
            "Source triangle tessellation has gaps, overlaps or wrong winding"
        )


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
    barycentric = np.stack([1 - u - v, u, v], axis=2)
    validate_tessellation(barycentric, partition, labels[faces], regular)
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


def expected_cortical_metadata(config, atlas):
    regions = {}
    for prefix, hemisphere in [("lh", "left"), ("rh", "right")]:
        labels, colors, names = read_annot(
            config["source_directory"]
            / "label"
            / f"{prefix}.{atlas['annotation']}.annot"
        )
        for label, count in zip(*np.unique(labels, return_counts=True)):
            name = "Unknown" if label == -1 else names[label].decode()
            region_id = f"{atlas['id']}:{hemisphere}:{label}"
            regions[region_id] = {
                "id": region_id,
                "atlas": atlas["id"],
                "hemisphere": hemisphere,
                "source_label_id": int(label),
                "source_name": name,
                "label": f"{name.replace('_', ' ')} · {hemisphere}",
                "kind": "non-region"
                if name in {"Unknown", "unknown", "???", "Medial_wall"}
                else "cortex",
                "source_annotation_value": 0 if label == -1 else int(colors[label, 4]),
                "source_vertex_count": int(count),
            }
    return regions


def expected_structure_metadata(config):
    image = nib.load(config["source_directory"] / "mri/aseg.mgz")
    volume = np.asarray(image.dataobj)
    table = read_color_table()
    regions = {}
    for label in config["structures"]["labels"]:
        name = table[label][0]
        hemisphere = {"Left": "left", "Right": "right"}.get(
            name.split("-")[0], "midline"
        )
        region_id = f"aseg:{hemisphere}:{label}"
        regions[region_id] = {
            "id": region_id,
            "atlas": "aseg",
            "hemisphere": hemisphere,
            "source_label_id": label,
            "source_name": name,
            "label": name.replace("-", " "),
            "kind": "structure",
            "voxel_count": int(np.count_nonzero(volume == label)),
            "voxel_size_mm": [float(size) for size in image.header.get_zooms()[:3]],
        }
    return regions, image.header.get_vox2ras_tkr()


def validate_region_metadata(region, mesh, expected, tolerance):
    for field, value in expected.items():
        if region.get(field) != value:
            raise ValueError(f"Manifest metadata mismatch: {expected['id']} {field}")
        if mesh.metadata.get(field) != value:
            raise ValueError(f"GLB metadata mismatch: {expected['id']} {field}")
    if mesh.metadata.get("region_id") != expected["id"]:
        raise ValueError(f"GLB metadata mismatch: {expected['id']} region_id")
    for field, count in [
        ("vertex_count", len(mesh.vertices)),
        ("triangle_count", len(mesh.faces)),
    ]:
        if region.get(field) != count:
            raise ValueError(
                f"Manifest geometry count mismatch: {expected['id']} {field}"
            )
    if not np.isclose(
        region["surface_area_mm2"], mesh.area * 1e6, rtol=tolerance, atol=0
    ):
        raise ValueError(f"Manifest surface area mismatch: {expected['id']}")


def validate_cut_only_regions(config, regions):
    """Check every mesh-less region against the label volume that carries it.

    These regions publish a measurement without a mesh to measure, so the volume
    is the only thing that can confirm them. A build without the optional warp
    has none to check.
    """
    cut_only = {
        region_id: region
        for region_id, region in regions.items()
        if region["kind"] == "tissue-region"
    }
    if not cut_only:
        return
    _, labels, _ = nextbrain.load(config)
    indices, counts = np.unique(labels, return_counts=True)
    present = dict(zip(indices.tolist(), counts.tolist()))
    for region_id, region in cut_only.items():
        count = present.get(region["source_label_id"])
        if count is None:
            raise ValueError(f"Cut-only region is not in the label volume: {region_id}")
        if region["voxel_count"] != count:
            raise ValueError(f"Cut-only region voxel count disagrees: {region_id}")


def validate_manifest(config, manifest):
    records = manifest["regions"]
    regions = {region["id"]: region for region in records}
    if len(records) != len(regions):
        raise ValueError("Manifest contains duplicate IDs")
    atlas_records = {atlas["id"]: atlas for atlas in manifest["atlases"]}
    if len(atlas_records) != len(manifest["atlases"]) or set(atlas_records) != {
        atlas["id"] for atlas in config["atlases"]
    }:
        raise ValueError("Manifest atlas set mismatch")
    groups = {}
    for atlas in config["atlases"]:
        filename = f"cortex-{atlas['id']}.glb"
        expected = expected_cortical_metadata(config, atlas)
        groups[filename] = expected
        metadata = {
            **atlas,
            "file": filename,
            "region_count": sum(r["kind"] == "cortex" for r in expected.values()),
        }
        if atlas_records[atlas["id"]] != metadata:
            raise ValueError(f"Manifest atlas metadata mismatch: {atlas['id']}")
    structures, affine = expected_structure_metadata(config)
    groups["structures.glb"] = structures
    expected_structures = {
        "file": "structures.glb",
        "region_count": len(structures),
        "voxel_to_surface_ras_mm": affine.tolist(),
    }
    for field, value in expected_structures.items():
        if manifest["structures"].get(field) != value:
            raise ValueError(f"Manifest structures metadata mismatch: {field}")
    expected_ids = {region_id for group in groups.values() for region_id in group}
    # Cut-only regions have no mesh by construction, so they belong to no GLB.
    # They are verified against the label volume that does carry them instead.
    meshed = {
        region_id
        for region_id, region in regions.items()
        if region["kind"] != "tissue-region"
    }
    if meshed != expected_ids:
        raise ValueError("Manifest has missing or unexpected region IDs")
    validate_cut_only_regions(config, regions)
    tolerance = config["validation"]["relative_area_tolerance"]
    for filename, expected in groups.items():
        meshes = read_meshes(config["output_directory"] / filename)
        if set(meshes) != set(expected):
            raise ValueError(f"GLB has missing or unexpected region IDs: {filename}")
        for region_id, metadata in expected.items():
            validate_region_metadata(
                regions[region_id], meshes[region_id], metadata, tolerance
            )
    voxel_volume = abs(np.linalg.det(affine[:3, :3]))
    for region_id, metadata in structures.items():
        if not np.isclose(
            regions[region_id]["segmentation_volume_mm3"],
            metadata["voxel_count"] * voxel_volume,
            rtol=1e-12,
            atol=0,
        ):
            raise ValueError(f"Manifest segmentation volume mismatch: {region_id}")


def main():
    config = read_config()
    verify_sources()
    manifest = json.loads((config["output_directory"] / "manifest.json").read_text())
    validate_manifest(config, manifest)
    report = {
        "status": "passed",
        "scope": "Source-to-asset conversion fidelity",
        "clinical_accuracy_validated": False,
        "atlases": [validate_atlas(config, atlas) for atlas in config["atlases"]],
        "structures": validate_structures(config),
        "volumes": validate_volumes(config),
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
