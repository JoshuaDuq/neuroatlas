import nibabel as nib
import numpy as np
import pytest

from brain_model.geometry import extract_structure
from brain_model.shading import structure_normals


def test_gradient_normals_are_outward_and_leave_anatomy_untouched():
    grid = np.indices((25, 25, 25)).transpose(1, 2, 3, 0)
    volume = (np.linalg.norm(grid - 12, axis=-1) < 8).astype(np.int32)
    affine = np.array([[-1., 0, 0, 12], [0, 0, 1, -12],
                       [0, -1, 0, 12], [0, 0, 0, 1]])
    mesh = extract_structure(volume, 1, affine)
    original = mesh.vertices.copy()
    normals = structure_normals(volume == 1, affine, mesh.vertices, .8)
    np.testing.assert_array_equal(mesh.vertices, original)
    np.testing.assert_allclose(np.linalg.norm(normals, axis=1), 1)
    radial = mesh.vertices / np.linalg.norm(mesh.vertices, axis=1)[:, None]
    assert np.einsum('ij,ij->i', normals, radial).min() > .94


def test_gradient_normals_transform_as_covectors_under_anisotropic_affine():
    volume = np.zeros((9, 9, 9), dtype=bool)
    volume[2:7, 2:7, 2:7] = True
    affine = np.diag([2., 3., 4., 1.])
    points = nib.affines.apply_affine(affine, [[1.5, 4, 4], [4, 4, 6.5]])
    normals = structure_normals(volume, affine, points, .8)
    np.testing.assert_allclose(normals, [[-1, 0, 0], [0, 0, 1]], atol=1e-7)


def test_invalid_shading_scale_surfaces_an_error():
    with pytest.raises(ValueError):
        structure_normals(np.ones((3, 3, 3), dtype=bool), np.eye(4),
                          np.ones((3, 3)), 0)
