import numpy as np
import pytest
import trimesh

from brain_model.encode import decode_normals, normal_tolerance
from brain_model.export import add_region, write_scene


def test_glb_retains_geometry_normals_and_selectable_region_metadata(tmp_path):
    vertices = np.array([[0.0, 0.0, 0.0], [10.0, 0.0, 0.0], [0.0, 10.0, 0.0]])
    faces = np.array([[0, 1, 2]])
    normals = np.tile([0.0, 0.0, 1.0], (3, 1))
    region = {
        "id": "destrieux:left:1",
        "label": "Test region",
        "atlas": "destrieux",
        "hemisphere": "left",
        "source_label_id": 1,
        "kind": "cortex",
    }
    scene = trimesh.Scene()
    add_region(scene, vertices, faces, normals, region, [100, 150, 200])
    path = tmp_path / "test.glb"
    write_scene(scene, path)
    result = trimesh.load_scene(path, process=False)
    mesh = next(iter(result.geometry.values()))
    np.testing.assert_allclose(
        mesh.vertices, [[0, 0, 0], [0.01, 0, 0], [0, 0, -0.01]], atol=1e-9
    )
    # Normals are published as normalized int16. trimesh hands back the stored
    # integers rather than applying glTF's `normalized` flag, so the check
    # decodes them and holds them to the encoding's own half-step bound.
    np.testing.assert_allclose(
        decode_normals(mesh.vertex_normals), [[0, 1, 0]] * 3, atol=normal_tolerance()
    )
    assert mesh.metadata["region_id"] == region["id"]
    assert mesh.metadata["source_label_id"] == 1
    assert mesh.metadata["hemisphere"] == "left"
    assert mesh.faces.tolist() == faces.tolist()


def test_recorded_area_is_the_area_glTF_actually_stores():
    # The manifest is checked against the mesh read back from the file, whose
    # vertices are float32. Measuring the source in float64 would describe
    # geometry the file does not contain.
    from brain_model.export import published_area_mm2

    vertices = np.array(
        [[0.0, 0.0, 0.0], [1e-3, 0.0, 0.0], [0.0, 1e-3, 0.0]], dtype=np.float64
    )
    faces = np.array([[0, 1, 2]])
    quantized = vertices.astype(np.float32).astype(np.float64)
    expected = trimesh.Trimesh(quantized, faces, process=False).area * 1e6
    assert published_area_mm2(vertices, faces) == pytest.approx(expected, rel=0, abs=0)


def test_a_sliver_records_an_area_that_round_trips_within_the_manifest_tolerance():
    # A few-voxel structure is exactly where float64 and float32 areas diverge
    # past 1e-6. Recording the published figure is what lets such a structure be
    # published at all rather than dropped for failing its own checksum.
    from brain_model.export import published_area_mm2

    rng = np.random.default_rng(0)
    vertices = rng.normal(scale=2e-5, size=(18, 3)) + np.array([0.05, -0.03, 0.02])
    faces = np.array([[i, (i + 1) % 18, (i + 2) % 18] for i in range(18)])
    recorded = published_area_mm2(vertices, faces)
    stored = trimesh.Trimesh(
        vertices.astype(np.float32).astype(np.float64), faces, process=False
    )
    assert abs(recorded - stored.area * 1e6) / recorded < 1e-6


def test_display_colours_are_published_as_the_linear_factors_gltf_defines(tmp_path):
    # baseColorFactor is linear. Writing an sRGB display colour's bytes there
    # rendered every region lighter and greyer than its published colour.
    from brain_model.encode import _read_glb

    vertices = np.array([[0.0, 0.0, 0.0], [10.0, 0.0, 0.0], [0.0, 10.0, 0.0]])
    faces = np.array([[0, 1, 2]])
    normals = np.tile([0.0, 0.0, 1.0], (3, 1))
    scene = trimesh.Scene()
    for label, color in ((1, [210, 150, 67]), (2, [20, 20, 20])):
        region = {"id": f"aseg:left:{label}", "label": "Test", "atlas": "aseg",
                  "hemisphere": "left", "source_label_id": label, "kind": "structure"}
        add_region(scene, vertices, faces, normals, region, color)
    path = tmp_path / "colours.glb"
    write_scene(scene, path)
    gltf, _ = _read_glb(path.read_bytes())
    factors = {
        material["name"]: material["pbrMetallicRoughness"]["baseColorFactor"]
        for material in gltf["materials"]
    }
    assert factors["aseg:left:1"] == pytest.approx([0.64448, 0.30499, 0.05613, 1.0], abs=1e-5)
    # A dark colour is where an 8-bit linear factor would visibly shift it.
    assert factors["aseg:left:2"] == pytest.approx([0.0069954] * 3 + [1.0], abs=1e-6)


def test_a_published_colour_reads_back_as_the_display_colour_it_was_given(tmp_path):
    # What validation compares against a palette: trimesh would round the
    # linear factor to a byte, which no longer names the display colour.
    from brain_model.encode import published_display_colors

    vertices = np.array([[0.0, 0.0, 0.0], [10.0, 0.0, 0.0], [0.0, 10.0, 0.0]])
    region = {"id": "learning:left:putamen", "label": "Putamen", "atlas": "learning",
              "hemisphere": "left", "source_label_id": None, "kind": "structure"}
    scene = trimesh.Scene()
    add_region(scene, vertices, np.array([[0, 1, 2]]), np.tile([0.0, 0.0, 1.0], (3, 1)),
               region, [210, 150, 67])
    path = tmp_path / "learning.glb"
    write_scene(scene, path)
    colors = published_display_colors(path)
    assert colors["learning:left:putamen"] == pytest.approx([210, 150, 67], abs=1e-9)
