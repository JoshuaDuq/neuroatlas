"""Shading normals derived from segmentation gradients; positions never change."""

import nibabel as nib
import numpy as np
from scipy.ndimage import gaussian_filter, map_coordinates

from .geometry import normalize


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
