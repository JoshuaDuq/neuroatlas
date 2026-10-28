"""Independent area and provenance checks for native atlas intersections."""

import json
from collections import defaultdict

import numpy as np
import pytest
import trimesh
from nibabel.freesurfer.io import read_annot, read_geometry, write_annot, write_geometry

from brain_model.gltf.export import compact_region
from brain_model.sources import read_config, sha256
from brain_model.surfaces.geometry import partition_surface, to_gltf


@pytest.fixture
def unequal_surface():
    vertices = np.array(
        [
            [0.0, 0.0, 0.0],
            [2.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 1.0],
            [6.0, 0.0, 1.0],
            [0.0, 3.0, 1.0],
        ]
    )
    faces = np.array([[0, 1, 2], [3, 4, 5]])
    annotations = np.array([[1, 3], [1, 4], [-1, 4], [1, 3], [2, 3], [2, 4]])
    return vertices, faces, annotations


def explicit_cell_areas(vertices, faces, annotations):
    result = defaultdict(float)
    for face in faces:
        triangle = vertices[face]
        center = triangle.mean(axis=0)
        for corner, vertex in enumerate(face):
            point = triangle[corner]
            following = (point + triangle[(corner + 1) % 3]) / 2
            previous = (point + triangle[(corner - 1) % 3]) / 2
            for cell in [[point, following, center], [point, center, previous]]:
                lengths = np.linalg.norm(np.diff([*cell, cell[0]], axis=0), axis=1)
                semiperimeter = lengths.sum() / 2
                area = np.sqrt(semiperimeter * np.prod(semiperimeter - lengths))
                result[tuple(annotations[vertex])] += area
    return result


def test_unequal_triangles_use_area_and_conserve_unassigned_cells(unequal_surface):
    from brain_model.layers.comparison import compare_surface

    result = compare_surface(*unequal_surface)
    measured = dict(zip(map(tuple, result.region_labels), result.areas_mm2))
    assert measured == pytest.approx(
        {(1, 3): 10 / 3, (1, 4): 1 / 3, (-1, 4): 1 / 3, (2, 3): 3, (2, 4): 3}
    )
    assert measured == pytest.approx(explicit_cell_areas(*unequal_surface), rel=1e-12)
    assert sum(measured.values()) == pytest.approx(10, rel=1e-14)
    first_area = sum(area for pair, area in measured.items() if pair[0] == 1)
    second_area = sum(area for pair, area in measured.items() if pair[1] == 3)
    assert measured[(1, 3)] / first_area == pytest.approx(10 / 11)
    assert measured[(1, 3)] / second_area == pytest.approx(10 / 19)


def test_exact_pair_meshes_have_the_same_area_as_the_common_cells(unequal_surface):
    from brain_model.layers.comparison import compare_surface

    result = compare_surface(*unequal_surface)
    partition = result.partition
    mesh = trimesh.Trimesh(partition.vertices, partition.faces, process=False)
    for code, area in enumerate(result.areas_mm2):
        assert mesh.area_faces[partition.labels == code].sum() == pytest.approx(
            area, rel=1e-12
        )
    assert mesh.area == pytest.approx(10, rel=1e-14)


@pytest.mark.parametrize(
    "invalid", ["shape", "fractional", "faces", "nonfinite", "degenerate"]
)
def test_invalid_surface_state_surfaces_an_error(unequal_surface, invalid):
    from brain_model.layers.comparison import compare_surface

    vertices, faces, annotations = unequal_surface
    if invalid == "shape":
        annotations = annotations[:-1]
    elif invalid == "fractional":
        annotations = annotations.astype(float)
    elif invalid == "faces":
        faces[0, 0] = len(vertices)
    elif invalid == "nonfinite":
        vertices[0, 0] = np.nan
    elif invalid == "degenerate":
        vertices[2] = vertices[1]
    with pytest.raises(ValueError):
        compare_surface(vertices, faces, annotations)


@pytest.fixture
def comparison_subject(tmp_path, unequal_surface):
    source = tmp_path / "source"
    output = tmp_path / "published"
    (source / "surf").mkdir(parents=True)
    (source / "label").mkdir()
    output.mkdir()
    vertices, faces, annotations = unequal_surface
    annotations = np.where(annotations == -1, 0, annotations)
    atlases = [
        {
            "id": "destrieux",
            "annotation": "aparc.a2009s",
            "citation": "https://example.org/destrieux",
            "file": "cortex-destrieux.glb",
        },
        {
            "id": "hcp-mmp",
            "annotation": "HCPMMP1",
            "citation": "https://example.org/hcp",
            "file": "cortex-hcp-mmp.glb",
        },
    ]
    regions = []
    colors = np.array([[i + 1, 10, 20, 0] for i in range(5)])
    names = ["unknown", "one", "two", "three", "four"]
    for prefix, hemisphere in [("lh", "left"), ("rh", "right")]:
        write_geometry(source / "surf" / f"{prefix}.pial", vertices, faces)
        for column, atlas in enumerate(atlases):
            labels = annotations[:, column]
            write_annot(
                source / "label" / f"{prefix}.{atlas['annotation']}.annot",
                labels,
                colors,
                names,
            )
            for label in np.unique(labels):
                regions.append(
                    {
                        "id": f"{atlas['id']}:{hemisphere}:{label}",
                        "atlas": atlas["id"],
                        "hemisphere": hemisphere,
                        "source_label_id": int(label),
                        "source_name": names[label],
                        "source_annotation_value": int(
                            colors[label, 0] + 10 * 256 + 20 * 65536
                        ),
                        "source_vertex_count": int(np.count_nonzero(labels == label)),
                        "kind": "non-region" if label == 0 else "cortex",
                    }
                )
    for atlas in atlases:
        (output / atlas["file"]).write_bytes(b"original atlas asset")
    config = {
        "source_directory": source,
        "output_directory": output,
        "anatomy": {"id": "snail"},
        "atlas_comparison": {
            "enabled_anatomies": ["snail"],
            "atlases": ["destrieux", "hcp-mmp"],
        },
    }
    manifest = {
        "anatomy": {"id": "snail"},
        "atlases": atlases,
        "regions": regions,
        "provenance": {
            "sources": [
                {"path": str(path), "sha256": sha256(path)}
                for path in [*source.glob("surf/*"), *source.glob("label/*")]
            ]
        },
    }
    (output / "manifest.json").write_text(json.dumps(manifest))
    return config, manifest


def test_export_pins_sources_and_original_assets_without_rebuilding(comparison_subject):
    from brain_model.layers.comparison import publish_comparison

    config, original = comparison_subject
    output = config["output_directory"]
    before = {
        atlas["file"]: (output / atlas["file"]).read_bytes()
        for atlas in original["atlases"]
    }
    pointer = publish_comparison(config)
    manifest = json.loads((output / "manifest.json").read_text())
    assert manifest.pop("atlas_comparison") == pointer
    assert manifest == original
    assert pointer == {
        "file": "atlas-comparison.json",
        "sha256": sha256(output / "atlas-comparison.json"),
    }
    record = json.loads((output / pointer["file"]).read_text())
    assert record["anatomy_id"] == "snail"
    assert record["atlases"] == ["destrieux", "hcp-mmp"]
    assert (record["surface"], record["method"], record["units"]) == (
        "pial",
        "barycentric-vertex-cells",
        "mm2",
    )
    assert record["geometry"]["sha256"] == sha256(output / record["geometry"]["file"])
    for entry in record["sources"]:
        for source in [entry["pial"], *entry["annotations"]]:
            assert source["sha256"] == sha256(
                config["source_directory"] / source["file"]
            )
    for asset in record["atlas_assets"]:
        assert asset["sha256"] == sha256(output / asset["file"])
        assert (output / asset["file"]).read_bytes() == before[asset["file"]]
    for region_id, area in record["totals"].items():
        assert sum(
            pair["area_mm2"]
            for pair in record["pairs"]
            if region_id in pair["region_ids"]
        ) == pytest.approx(area, rel=1e-12)
    scene = trimesh.load(
        output / record["geometry"]["file"], force="scene", process=False
    )
    meshes = {mesh.metadata["overlap_id"]: mesh for mesh in scene.geometry.values()}
    assert set(meshes) == {pair["mesh_id"] for pair in record["pairs"]}
    for pair in record["pairs"]:
        assert meshes[pair["mesh_id"]].area * 1e6 == pytest.approx(
            pair["area_mm2"], rel=2e-6
        )
    assert any(
        region.endswith(":0")
        for pair in record["pairs"]
        for region in pair["region_ids"]
    )


@pytest.mark.parametrize(
    "invalid", ["subject", "region", "annotation", "enabled", "source_hash"]
)
def test_export_rejects_inconsistent_identity(comparison_subject, invalid):
    from brain_model.layers.comparison import export_comparison

    config, manifest = comparison_subject
    if invalid == "subject":
        manifest["anatomy"]["id"] = "other"
    elif invalid == "region":
        manifest["regions"][0]["id"] = "destrieux:right:0"
    elif invalid == "annotation":
        manifest["regions"][0]["source_annotation_value"] += 1
    elif invalid == "enabled":
        config["atlas_comparison"]["enabled_anatomies"] = []
    elif invalid == "source_hash":
        manifest["provenance"]["sources"][0]["sha256"] = "0" * 64
    with pytest.raises(ValueError):
        export_comparison(config, manifest)


def quantization_area_bounds(vertices, faces):
    points = to_gltf(vertices)
    triangles = points[faces]
    errors = (points.astype(np.float32).astype(np.float64) - points)[faces]
    first, second = triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
    delta_first, delta_second = errors[:, 1] - errors[:, 0], errors[:, 2] - errors[:, 0]
    norm = lambda vectors: np.linalg.norm(vectors, axis=1)
    return (
        (
            norm(first) * norm(delta_second)
            + norm(second) * norm(delta_first)
            + norm(delta_first) * norm(delta_second)
        )
        / 2
        * 1e6
    )


def test_real_source_marginals_match_published_float32_surface_areas():
    from brain_model.layers.comparison import compare_surface, comparison_atlases

    config = read_config("cdmd")
    manifest = json.loads((config["output_directory"] / "manifest.json").read_text())
    regions = {region["id"]: region for region in manifest["regions"]}
    for prefix, hemisphere in [("lh", "left"), ("rh", "right")]:
        vertices, faces = read_geometry(
            config["source_directory"] / "surf" / f"{prefix}.pial"
        )
        annotations = [
            read_annot(
                config["source_directory"]
                / "label"
                / f"{prefix}.{atlas['annotation']}.annot"
            )[0]
            for atlas in comparison_atlases(config, manifest)
        ]
        result = compare_surface(vertices, faces, np.column_stack(annotations))
        original_area = trimesh.Trimesh(vertices, faces, process=False).area
        assert result.areas_mm2.sum() == pytest.approx(original_area, rel=1e-12)
        for column, atlas in enumerate(comparison_atlases(config, manifest)):
            partition = partition_surface(vertices, faces, annotations[column])
            bounds = quantization_area_bounds(partition.vertices, partition.faces)
            for label in np.unique(annotations[column]):
                region = regions[f"{atlas['id']}:{hemisphere}:{label}"]
                area = result.areas_mm2[result.region_labels[:, column] == label].sum()
                tolerance = bounds[partition.labels == label].sum() + 1e-10 * area
                assert abs(area - region["surface_area_mm2"]) <= tolerance


def test_the_published_individuals_are_configured_for_comparison():
    from brain_model.layers.comparison import is_enabled

    assert is_enabled(read_config("cdmd"))
    assert not is_enabled(read_config("fsaverage"))


def test_published_geometry_contains_only_the_exact_joint_cells():
    from brain_model.layers.comparison import compare_surface, comparison_atlases

    config = read_config("cdmd")
    output = config["output_directory"]
    record = json.loads((output / "atlas-comparison.json").read_text())
    scene = trimesh.load(
        output / record["geometry"]["file"], force="scene", process=False
    )
    meshes = {mesh.metadata["overlap_id"]: mesh for mesh in scene.geometry.values()}
    pairs = {pair["mesh_id"]: pair for pair in record["pairs"]}
    assert len(meshes) == len(record["pairs"])
    assert set(meshes) == set(pairs)
    manifest = json.loads((output / "manifest.json").read_text())
    for prefix, hemisphere in [("lh", "left"), ("rh", "right")]:
        vertices, faces = read_geometry(
            config["source_directory"] / "surf" / f"{prefix}.pial"
        )
        annotations = [
            read_annot(
                config["source_directory"]
                / "label"
                / f"{prefix}.{atlas['annotation']}.annot"
            )[0]
            for atlas in comparison_atlases(config, manifest)
        ]
        result = compare_surface(vertices, faces, np.column_stack(annotations))
        bounds = quantization_area_bounds(
            result.partition.vertices, result.partition.faces
        )
        for code, (labels, area) in enumerate(
            zip(result.region_labels, result.areas_mm2)
        ):
            mesh_id = f"overlap:{hemisphere}:{labels[0]}:{labels[1]}"
            mesh = meshes[mesh_id]
            points, triangles, _ = compact_region(result.partition, code)
            np.testing.assert_array_equal(
                mesh.vertices, to_gltf(points).astype(np.float32)
            )
            np.testing.assert_array_equal(mesh.faces, triangles)
            assert pairs[mesh_id]["area_mm2"] == pytest.approx(area, rel=1e-14)
            tolerance = bounds[result.partition.labels == code].sum() + 1e-10 * area
            assert abs(mesh.area * 1e6 - area) <= tolerance
