"""Cortical shading fields derived from source morphometry; positions never change."""

import nibabel as nib
import numpy as np
from scipy.ndimage import map_coordinates
from trimesh.ray.ray_pyembree import RayMeshIntersector

# Rays start this far off the surface so they cannot hit their own triangles.
_RAY_OFFSET_MM = 0.01
_RAYS_PER_BATCH = 2_000_000


def sphere_directions(count):
    """Evenly spread unit directions (Fibonacci lattice); fixed, so the field is deterministic."""
    steps = np.arange(count) + 0.5
    z = 1 - 2 * steps / count
    radius = np.sqrt(1 - z * z)
    azimuth = np.pi * (1 + 5 ** 0.5) * steps
    return np.column_stack([radius * np.cos(azimuth), radius * np.sin(azimuth), z])


def cortical_openness(mesh, radius_mm, direction_count):
    """Cosine-weighted share of the sky a vertex sees past its own hemisphere's folds.

    A ray blocked at distance d counts as d / radius open, so near walls
    occlude fully and folds beyond the radius not at all; 1 is a bare crown.
    """
    if mesh.volume <= 0:
        raise ValueError("Cortical occlusion requires outward-wound faces")
    directions = sphere_directions(direction_count)
    normals = mesh.vertex_normals
    weights = np.clip(normals @ directions.T, 0, None)
    vertex_rows, direction_columns = np.nonzero(weights)
    reach = np.ones(len(vertex_rows))
    intersector = RayMeshIntersector(mesh)
    for start in range(0, len(vertex_rows), _RAYS_PER_BATCH):
        rows = vertex_rows[start:start + _RAYS_PER_BATCH]
        origins = mesh.vertices[rows] + normals[rows] * _RAY_OFFSET_MM
        hits, rays, _ = intersector.intersects_location(
            origins, directions[direction_columns[start:start + _RAYS_PER_BATCH]],
            multiple_hits=False,
        )
        distance = np.linalg.norm(hits - origins[rays], axis=1)
        reach[start + rays] = np.minimum(distance / radius_mm, 1)
    open_weight = np.zeros(len(mesh.vertices))
    np.add.at(open_weight, vertex_rows, weights[vertex_rows, direction_columns] * reach)
    return open_weight / weights.sum(axis=1)


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
