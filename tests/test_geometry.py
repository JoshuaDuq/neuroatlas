import numpy as np
import pytest

from brain_model.geometry import extract_structure, partition_surface, to_gltf


def areas(triangles):
    return (
        np.linalg.norm(
            np.cross(
                triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
            ),
            axis=1,
        )
        / 2
    )


@pytest.mark.parametrize("labels", [[0, 0, 0], [1, 1, 2], [1, 2, 3]])
def test_partition_preserves_surface_and_vertex_labels(labels):
    vertices = np.array([[0.0, 0.0, 0.0], [4.0, 0.0, 0.0], [1.0, 3.0, 0.0]])
    faces = np.array([[0, 1, 2]])
    result = partition_surface(vertices, faces, np.array(labels))
    triangles = result.vertices[result.faces]
    assert areas(triangles).sum() == pytest.approx(6)
    assert np.all(areas(triangles) > 0)
    assert np.all(
        np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])[
            :, 2
        ]
        > 0
    )
    assert np.array_equal(np.unique(result.parent_faces), [0])
    for vertex, label in zip(vertices, labels):
        matches = np.any(np.all(triangles == vertex, axis=2), axis=1)
        assert set(result.labels[matches]) == {label}
    if len(set(labels)) == 3:
        for label in labels:
            assert areas(triangles[result.labels == label]).sum() == pytest.approx(2)


def test_partition_keeps_uniform_faces_and_shared_boundary_positions():
    vertices = np.array(
        [[0.0, 0.0, 0.0], [4.0, 0.0, 0.0], [1.0, 3.0, 0.0], [4.0, 3.0, 0.0]]
    )
    result = partition_surface(
        vertices, np.array([[0, 1, 2], [1, 3, 2]]), np.array([1, 1, 2, 2])
    )
    assert areas(result.vertices[result.faces]).sum() == pytest.approx(10.5)
    assert np.linalg.norm(result.normals, axis=1) == pytest.approx(
        np.ones(len(result.vertices))
    )
    for parent in [0, 1]:
        assert (result.parent_faces == parent).sum() == 6


def test_gltf_transform_uses_meters_and_preserves_handedness():
    transformed = to_gltf(np.eye(3) * 1000)
    np.testing.assert_allclose(transformed, [[1, 0, 0], [0, 0, -1], [0, 1, 0]])
    assert np.linalg.det(transformed) == pytest.approx(1)


@pytest.mark.parametrize("labels", [np.array([1, 2]), np.array([1.0, 2.0, 3.0])])
def test_partition_rejects_invalid_annotation(labels):
    with pytest.raises(ValueError):
        partition_surface(np.eye(3), np.array([[0, 1, 2]]), labels)


def test_extract_structure_applies_voxel_affine_and_outward_winding():
    volume = np.zeros((5, 5, 5), dtype=np.int32)
    volume[1:4, 1:4, 1:4] = 7
    affine = np.array([[-2.0, 0, 0, 20], [0, 0, 3, -10], [0, -4, 0, 30], [0, 0, 0, 1]])
    mesh = extract_structure(volume, 7, affine)
    np.testing.assert_allclose(mesh.bounds, [[13, -8.5, 16], [19, 0.5, 28]])
    assert mesh.is_watertight
    assert mesh.volume > 0


def test_missing_structure_is_an_error():
    with pytest.raises(ValueError, match="absent"):
        extract_structure(np.zeros((4, 4, 4), dtype=np.int32), 7, np.eye(4))
