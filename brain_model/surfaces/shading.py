"""Cortical shading fields derived from source morphometry; positions never change."""

import nibabel as nib
import numpy as np
from scipy.ndimage import map_coordinates
from trimesh.smoothing import laplacian_calculation


def cortical_concavity(mesh):
    operator = laplacian_calculation(mesh).tocsr()
    displacement = operator @ mesh.vertices - mesh.vertices
    edges = mesh.edges_unique
    lengths = mesh.edges_unique_length
    sums = np.bincount(edges.ravel(), weights=np.repeat(lengths, 2),
                       minlength=len(mesh.vertices))
    counts = np.bincount(edges.ravel(), minlength=len(mesh.vertices))
    if np.any(counts == 0) or np.any(sums <= 0):
        raise ValueError("Cortical shading requires nonzero connected edges")
    relief = np.einsum("ij,ij->i", displacement, mesh.vertex_normals) / (sums / counts)
    return (relief + operator @ relief) / 2


def ribbon_intensity(data, affine, pial, white):
    if pial.shape != white.shape or pial.ndim != 2 or pial.shape[1] != 3:
        raise ValueError("Pial and white vertices must correspond")
    if data.ndim != 3 or not np.isfinite(data).all():
        raise ValueError("T1 shading requires a finite 3D volume")
    coordinates = nib.affines.apply_affine(np.linalg.inv(affine), (pial + white) / 2)
    if (not np.isfinite(coordinates).all() or np.any(coordinates < 0)
            or np.any(coordinates > np.array(data.shape) - 1)):
        raise ValueError("Cortical samples outside the MRI grid")
    return map_coordinates(data.astype(float), coordinates.T, order=1, prefilter=False)
