from dataclasses import replace

import numpy as np
import pytest

from brain_model.geometry import Partition, partition_surface
from brain_model.validate import validate_partition


def test_validation_detects_missing_coverage_and_displaced_geometry():
    vertices = np.array([[0.0, 0.0, 0.0], [4.0, 0.0, 0.0], [1.0, 3.0, 0.0]])
    faces = np.array([[0, 1, 2]])
    labels = np.array([1, 2, 3])
    partition = partition_surface(vertices, faces, labels)
    report = validate_partition(vertices, faces, labels, partition)
    assert report["maximum_parent_area_error_mm2"] < 1e-12
    damaged = partition.vertices.copy()
    damaged[-1, 2] += 0.1
    with pytest.raises(ValueError, match="plane"):
        validate_partition(
            vertices, faces, labels, replace(partition, vertices=damaged)
        )
    with pytest.raises(ValueError, match="area"):
        validate_partition(
            vertices,
            faces,
            labels,
            replace(
                partition,
                faces=partition.faces[:-1],
                labels=partition.labels[:-1],
                parent_faces=partition.parent_faces[:-1],
            ),
        )


def test_validation_detects_relabeling_of_source_vertex():
    vertices = np.array([[0.0, 0.0, 0.0], [4.0, 0.0, 0.0], [1.0, 3.0, 0.0]])
    faces = np.array([[0, 1, 2]])
    labels = np.array([1, 2, 3])
    partition = partition_surface(vertices, faces, labels)
    wrong_labels = partition.labels.copy()
    wrong_labels[0] = 2
    with pytest.raises(ValueError, match="ownership"):
        validate_partition(
            vertices, faces, labels, replace(partition, labels=wrong_labels)
        )


def test_source_degenerate_face_is_preserved_and_reported():
    vertices = np.array([[0.0, 0.0, 0.0], [4.0, 0.0, 0.0], [0.0, 0.0, 0.0]])
    faces = np.array([[0, 1, 2]])
    labels = np.array([1, 1, 1])
    partition = Partition(
        vertices, faces, np.ones((3, 3)), np.array([1]), np.array([0])
    )
    report = validate_partition(vertices, faces, labels, partition)
    assert report["source_zero_area_triangles"] == 1
    bad = vertices.copy()
    bad[1, 0] = 5
    with pytest.raises(ValueError, match="degenerate"):
        validate_partition(vertices, faces, labels, replace(partition, vertices=bad))


@pytest.mark.parametrize("damage", ["duplicate", "reverse"])
def test_validation_rejects_overlap_and_reversed_winding(damage):
    vertices = np.array([[0.0, 0.0, 0.0], [4.0, 0.0, 0.0], [1.0, 3.0, 0.0]])
    faces = np.array([[0, 1, 2]])
    labels = np.array([1, 2, 3])
    partition = partition_surface(vertices, faces, labels)
    damaged = partition.faces.copy()
    if damage == "duplicate":
        damaged[1] = damaged[0]
    else:
        damaged = damaged[:, ::-1]
    with pytest.raises(ValueError, match="tessellation"):
        validate_partition(vertices, faces, labels, replace(partition, faces=damaged))


def test_validation_accepts_reordered_faces_and_cyclic_vertex_order():
    vertices = np.array([[0.0, 0.0, 0.0], [4.0, 0.0, 0.0], [1.0, 3.0, 0.0]])
    faces = np.array([[0, 1, 2]])
    labels = np.array([1, 2, 3])
    partition = partition_surface(vertices, faces, labels)
    validate_partition(
        vertices,
        faces,
        labels,
        replace(
            partition,
            faces=np.roll(partition.faces[::-1], 1, axis=1),
            labels=partition.labels[::-1],
            parent_faces=partition.parent_faces[::-1],
        ),
    )


@pytest.fixture
def manifest_assets(tmp_path):
    import nibabel as nib
    import trimesh

    from brain_model.export import add_region, write_scene

    source = tmp_path / "source"
    (source / "label").mkdir(parents=True)
    (source / "mri").mkdir()
    atlas = {"id": "test", "label": "Test atlas", "annotation": "test"}
    manifest = {
        "atlases": [{**atlas, "file": "cortex-test.glb", "region_count": 2,
                     "surface_shading": {
                         "attribute": "_SULC",
                         "source": "FreeSurfer lh.sulc / rh.sulc",
                         "interpolation": "Linear on barycentric atlas partitions",
                         "meaning": "Sulcal-depth morphometry; positive values mark sulci",
                     }}],
        "detail_levels": [{"id": "aseg", "file": "structures.glb", "region_count": 1}],
        "regions": [],
    }
    config = {
        "source_directory": source,
        "output_directory": tmp_path,
        "atlases": [atlas],
        "structures": {"labels": [10]},
        "validation": {"relative_area_tolerance": 1e-6},
    }
    scene = trimesh.Scene()
    vertices = np.array([[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]])
    faces = np.array([[0, 1, 2]])
    normals = np.tile([0.0, 0.0, 1.0], (3, 1))
    for prefix, hemisphere in [("lh", "left"), ("rh", "right")]:
        nib.freesurfer.write_annot(
            source / "label" / f"{prefix}.test.annot",
            np.array([-1, 1, 1]),
            np.array([[0, 0, 0, 0], [1, 2, 3, 0]]),
            [b"Unknown", b"Test_Region"],
        )
        for label, name, count, kind in [
            (-1, "Unknown", 1, "non-region"),
            (1, "Test_Region", 2, "cortex"),
        ]:
            region = {
                "id": f"test:{hemisphere}:{label}",
                "label": f"{name.replace('_', ' ')} · {hemisphere}",
                "atlas": "test",
                "hemisphere": hemisphere,
                "kind": kind,
                "source_name": name,
                "source_label_id": label,
                "source_annotation_value": 0 if label == -1 else 197121,
                "source_vertex_count": count,
            }
            add_region(scene, vertices, faces, normals, region, [1, 2, 3])
            manifest["regions"].append(
                {
                    **region,
                    "vertex_count": 3,
                    "triangle_count": 1,
                    "surface_area_mm2": 0.5,
                }
            )
    write_scene(scene, tmp_path / "cortex-test.glb")
    volume = np.zeros((3, 3, 3), dtype=np.int32)
    volume[1, 1, 1] = 10
    image = nib.MGHImage(volume, np.eye(4))
    nib.save(image, source / "mri/aseg.mgz")
    manifest["detail_levels"][0]["voxel_to_surface_ras_mm"] = (
        image.header.get_vox2ras_tkr().tolist()
    )
    region = {
        "id": "aseg:left:10",
        "label": "Left Thalamus Proper",
        "source_name": "Left-Thalamus-Proper",
        "atlas": "aseg",
        "hemisphere": "left",
        "source_label_id": 10,
        "kind": "structure",
        "voxel_count": 1,
        "voxel_size_mm": [1.0, 1.0, 1.0],
    }
    scene = trimesh.Scene()
    add_region(scene, vertices, faces, normals, region, [1, 2, 3])
    write_scene(scene, tmp_path / "structures.glb")
    manifest["regions"].append(
        {
            **region,
            "vertex_count": 3,
            "triangle_count": 1,
            "surface_area_mm2": 0.5,
            "segmentation_volume_mm3": 1.0,
        }
    )
    return config, manifest


def test_manifest_matches_sources_and_meshes(manifest_assets):
    from brain_model import validate

    validate.validate_manifest(*manifest_assets)


@pytest.mark.parametrize(
    "field,value",
    [
        ("id", "test:left:999"),
        ("source_name", "Wrong"),
        ("label", "Wrong"),
        ("kind", "cortex"),
        ("hemisphere", "right"),
        ("atlas", "wrong"),
        ("source_label_id", 999),
        ("source_annotation_value", 999),
        ("source_vertex_count", 999),
        ("vertex_count", 999),
        ("triangle_count", 999),
    ],
)
def test_manifest_rejects_stale_region_metadata(manifest_assets, field, value):
    from brain_model import validate

    config, manifest = manifest_assets
    manifest["regions"][0][field] = value
    with pytest.raises(ValueError, match="Manifest"):
        validate.validate_manifest(config, manifest)


@pytest.mark.parametrize(
    "damage", ["missing", "duplicate", "atlas_count", "structure_count"]
)
def test_manifest_rejects_incomplete_region_sets_and_counts(manifest_assets, damage):
    from brain_model import validate

    config, manifest = manifest_assets
    if damage == "missing":
        manifest["regions"].pop()
    elif damage == "duplicate":
        manifest["regions"].append(manifest["regions"][0])
    elif damage == "atlas_count":
        manifest["atlases"][0]["region_count"] += 1
    else:
        manifest["detail_levels"][0]["region_count"] += 1
    with pytest.raises(ValueError, match="Manifest"):
        validate.validate_manifest(config, manifest)


def test_metadata_is_checked_against_source_when_manifest_and_glb_agree(
    manifest_assets,
):
    import trimesh

    from brain_model import validate
    from brain_model.export import write_scene

    config, manifest = manifest_assets
    region_id = manifest["regions"][0]["id"]
    manifest["regions"][0]["source_name"] = "Wrong"
    path = config["output_directory"] / "cortex-test.glb"
    scene = trimesh.load_scene(path, process=False)
    scene.geometry[region_id].metadata["source_name"] = "Wrong"
    write_scene(scene, path)
    with pytest.raises(ValueError, match="metadata"):
        validate.validate_manifest(config, manifest)


def test_a_solid_block_surface_encloses_its_label_without_pinching():
    from brain_model.geometry import extract_structure
    from brain_model.validate import surface_closure

    volume = np.zeros((4, 4, 4), dtype=np.int32)
    volume[1:3, 1:3, 1:3] = 7
    mesh = extract_structure(volume, 7, np.eye(4))
    assert surface_closure(mesh) == {"boundary_edges": 0, "pinch_edges": 0}
    assert mesh.is_winding_consistent and mesh.volume > 0


def test_a_diagonal_staircase_of_voxels_pinches_but_still_encloses_a_volume():
    # The smallest arrangement that pinches, reduced from the one this subject's
    # right cerebellar cortex actually contains: a staircase whose middle two
    # voxels meet at a corner. No closed two-manifold surface exists over it, so
    # the pinch is published rather than mended; the surface still has no hole,
    # which is what leaves the volume it encloses defined at all.
    from brain_model.geometry import extract_structure
    from brain_model.validate import surface_closure

    volume = np.zeros((5, 5, 6), dtype=np.int32)
    for x, y, z in [(0, 0, 0), (0, 1, 1), (1, 0, 1), (1, 1, 2)]:
        volume[x + 2, y + 2, z + 2] = 7
    mesh = extract_structure(volume, 7, np.eye(4))
    closure = surface_closure(mesh)
    assert closure["boundary_edges"] == 0
    assert closure["pinch_edges"] > 0
    assert not mesh.is_watertight
    assert mesh.is_winding_consistent and mesh.volume > 0


def test_a_hole_is_reported_as_a_boundary_edge_and_never_as_a_pinch():
    import trimesh

    from brain_model.validate import surface_closure

    box = trimesh.creation.box()
    assert surface_closure(box)["boundary_edges"] == 0
    punctured = trimesh.Trimesh(box.vertices, box.faces[1:], process=False)
    assert surface_closure(punctured) == {"boundary_edges": 3, "pinch_edges": 0}
