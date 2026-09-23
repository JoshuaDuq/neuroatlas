import nibabel as nib
import numpy as np
import pytest


def test_partitioned_scalar_field_is_continuous_and_preserves_source_values():
    from brain_model.geometry import partition_surface, partition_vertex_field

    vertices = np.array([[0., 0, 0], [4., 0, 0], [0., 3, 0], [4., 3, 0]])
    faces = np.array([[0, 1, 2], [1, 3, 2]])
    labels = np.array([1, 2, 3, 2])
    values = vertices[:, 0] + 2 * vertices[:, 1] - 3
    partition = partition_surface(vertices, faces, labels)
    result = partition_vertex_field(faces, labels, values)
    np.testing.assert_array_equal(result[:4], values)
    np.testing.assert_allclose(
        result, partition.vertices[:, 0] + 2 * partition.vertices[:, 1] - 3
    )
    assert len(result) == len(partition.vertices)


@pytest.mark.parametrize("values", [np.array([1., np.nan, 2.]), np.ones(2)])
def test_partitioned_scalar_field_rejects_invalid_source_data(values):
    from brain_model.geometry import partition_vertex_field

    with pytest.raises(ValueError, match="field"):
        partition_vertex_field(np.array([[0, 1, 2]]), np.array([1, 2, 3]), values)


def test_cortical_concavity_is_scale_invariant_and_leaves_geometry_unchanged():
    import trimesh

    from brain_model.shading import cortical_concavity

    mesh = trimesh.creation.icosphere(subdivisions=2)
    vertices, faces = mesh.vertices.copy(), mesh.faces.copy()
    values = cortical_concavity(mesh)
    assert np.all(values < 0), "Convex crowns must have negative concavity"
    scaled = trimesh.Trimesh(vertices=vertices * 1000, faces=faces, process=False)
    np.testing.assert_allclose(cortical_concavity(scaled), values, atol=1e-10)
    np.testing.assert_array_equal(mesh.vertices, vertices)
    np.testing.assert_array_equal(mesh.faces, faces)


def test_ribbon_intensity_samples_corresponding_surfaces_in_surface_ras():
    from brain_model.shading import ribbon_intensity

    grid = np.indices((9, 9, 9))
    data = (grid[0] + 2 * grid[1] + 3 * grid[2]).astype(float)
    affine = np.array([[-1., 0, 0, 8], [0, 0, 1, 0],
                       [0, -1, 0, 8], [0, 0, 0, 1]])
    pial_voxels = np.array([[2., 2, 2], [4., 4, 4]])
    white_voxels = pial_voxels + [1, 0, 0]
    pial = nib.affines.apply_affine(affine, pial_voxels)
    white = nib.affines.apply_affine(affine, white_voxels)
    result = ribbon_intensity(data, affine, pial, white)
    np.testing.assert_allclose(result, [12.5, 24.5])
    with pytest.raises(ValueError, match="correspond"):
        ribbon_intensity(data, affine, pial, white[:1])
    with pytest.raises(ValueError, match="outside"):
        ribbon_intensity(data, affine, pial + 100, white + 100)
