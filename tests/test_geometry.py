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


TKR = np.array([[-1.0, 0, 0, 8], [0, 0, 1, -8], [0, -1, 0, 8], [0, 0, 0, 1]])


def sphere_mask(shape=16, radius=5.2):
    grid = np.indices((shape,) * 3) - (shape - 1) / 2
    return (grid ** 2).sum(axis=0) < radius ** 2


@pytest.mark.parametrize("affine", [np.eye(4), TKR])
def test_a_raw_marching_cubes_surface_keeps_every_voxel_centre_on_its_side(affine):
    from brain_model.geometry import misclassified_voxels

    mask = sphere_mask()
    mesh = extract_structure(mask, 1, affine)
    assert len(misclassified_voxels(mesh.vertices, mesh.faces, mask, affine)) == 0


def test_a_surface_moved_one_voxel_misplaces_the_two_slabs_it_crossed():
    from brain_model.geometry import misclassified_voxels

    mask = np.zeros((12, 12, 12), dtype=bool)
    mask[4:8, 4:8, 4:8] = True
    mesh = extract_structure(mask, 1, np.eye(4))
    moved = mesh.vertices + [1.0, 0.0, 0.0]
    misplaced = misclassified_voxels(moved, mesh.faces, mask, np.eye(4))
    # The slab at x=4 is left behind and the one at x=8 is taken in: 2 x 16.
    assert len(misplaced) == 32
    assert sorted(set(misplaced[:, 0].tolist())) == [4, 8]


# bert's warped left diagonal band: 15 voxels, one of them cut off. Taubin
# smoothing alone carries its surface across two of these voxel centres.
DIAGONAL_BAND = [[1, 1, 4], [3, 2, 4], [4, 2, 3], [4, 2, 4], [4, 3, 3], [5, 3, 3],
                 [6, 3, 3], [7, 3, 2], [7, 3, 3], [8, 3, 1], [8, 3, 2], [8, 3, 3],
                 [9, 3, 1], [9, 3, 2], [9, 3, 3]]


@pytest.mark.parametrize("affine", [np.eye(4), TKR])
def test_display_smoothing_keeps_every_voxel_centre_on_its_own_side(affine):
    from brain_model.geometry import misclassified_voxels, smooth_display

    mask = np.zeros((12, 6, 7), dtype=bool)
    mask[tuple(np.array(DIAGONAL_BAND).T)] = True
    source = extract_structure(mask, 1, affine)
    smoothed = smooth_display(source, mask, affine,
                              {"iterations": 16, "maximum_displacement_mm": 0.6})
    displacement = np.linalg.norm(smoothed.vertices - source.vertices, axis=1)
    assert 0.05 < displacement.max() <= 0.6 + 1e-9
    assert len(misclassified_voxels(smoothed.vertices, smoothed.faces, mask, affine)) == 0
    np.testing.assert_array_equal(smoothed.faces, source.faces)
