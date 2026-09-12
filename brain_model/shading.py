"""Shading normals derived from segmentation gradients; positions never change."""

import nibabel as nib
import numpy as np
from scipy.ndimage import gaussian_filter, map_coordinates
from trimesh.smoothing import laplacian_calculation

from .geometry import normalize


def cortical_concavity(mesh):
    """Dimensionless normal-projected one-ring relief, not measured curvature.

    Compute on the intact hemisphere, then smooth only this shading field.
    Atlas partitioning happens afterward, so boundaries cannot create seams.
    """
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
    """Trilinear T1 at the midpoint of matched pial/white vertices in tkrRAS."""
    if pial.shape != white.shape or pial.ndim != 2 or pial.shape[1] != 3:
        raise ValueError("Pial and white vertices must correspond")
    if data.ndim != 3 or not np.isfinite(data).all():
        raise ValueError("T1 shading requires a finite 3D volume")
    coordinates = nib.affines.apply_affine(np.linalg.inv(affine), (pial + white) / 2)
    if (not np.isfinite(coordinates).all() or np.any(coordinates < 0)
            or np.any(coordinates > np.array(data.shape) - 1)):
        raise ValueError("Cortical samples outside the MRI grid")
    return map_coordinates(data.astype(float), coordinates.T, order=1, prefilter=False)


def structure_normals(mask, voxel_to_surface, vertices, sigma):
    if mask.ndim != 3 or mask.dtype != bool:
        raise ValueError("Shading requires a 3D boolean segmentation mask")
    if not np.isfinite(sigma) or sigma <= 0:
        raise ValueError("Shading sigma must be positive and finite")
    if voxel_to_surface.shape != (4, 4) or not np.isfinite(voxel_to_surface).all():
        raise ValueError("Shading requires a finite 4x4 affine")
    voxel_coordinates = nib.affines.apply_affine(
        np.linalg.inv(voxel_to_surface), vertices
    )
    margin = int(np.ceil(4 * sigma)) + 2
    lower = np.maximum(np.floor(voxel_coordinates.min(axis=0)).astype(int) - margin, 0)
    upper = np.minimum(np.ceil(voxel_coordinates.max(axis=0)).astype(int) + margin,
                       mask.shape)
    crop = mask[tuple(slice(a, b) for a, b in zip(lower, upper))].astype(float)
    gradients = []
    for axis in range(3):
        order = [0, 0, 0]
        order[axis] = 1
        derivative = gaussian_filter(crop, sigma=sigma, order=order,
                                     mode="constant", cval=0)
        gradients.append(map_coordinates(derivative, (voxel_coordinates - lower).T,
                                         order=1, prefilter=False, mode="nearest"))
    outward = -np.column_stack(gradients)
    return normalize(outward @ np.linalg.inv(voxel_to_surface[:3, :3]))
