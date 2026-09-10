import numpy as np
import trimesh

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
    np.testing.assert_allclose(mesh.vertex_normals, [[0, 1, 0]] * 3, atol=1e-7)
    assert mesh.metadata["region_id"] == region["id"]
    assert mesh.metadata["source_label_id"] == 1
    assert mesh.metadata["hemisphere"] == "left"
    assert mesh.faces.tolist() == faces.tolist()
