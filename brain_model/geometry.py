"""Geometry conversions that preserve source anatomy and discrete labels."""

from dataclasses import dataclass

import nibabel as nib
import numpy as np
import trimesh
from scipy.spatial import cKDTree
from skimage.measure import marching_cubes
from trimesh.smoothing import filter_taubin


@dataclass(frozen=True)
class Partition:
    vertices: np.ndarray
    faces: np.ndarray
    normals: np.ndarray
    labels: np.ndarray
    parent_faces: np.ndarray


def to_gltf(coordinates):
    coordinates = np.asarray(coordinates)
    if coordinates.ndim != 2 or coordinates.shape[1] != 3:
        raise ValueError("Coordinates must have shape (n, 3)")
    if not np.isfinite(coordinates).all():
        raise ValueError("Coordinates must be finite")
    return coordinates[:, [0, 2, 1]] * np.array([0.001, 0.001, -0.001])


def normalize(vectors):
    lengths = np.linalg.norm(vectors, axis=1, keepdims=True)
    if np.any(lengths == 0):
        raise ValueError("Cannot normalize a zero-length normal")
    return vectors / lengths


def validate_surface(vertices, faces, labels):
    if vertices.ndim != 2 or vertices.shape[1] != 3:
        raise ValueError("Vertices must have shape (n, 3)")
    if not np.isfinite(vertices).all():
        raise ValueError("Vertices must be finite")
    if faces.ndim != 2 or faces.shape[1] != 3 or faces.dtype.kind not in "iu":
        raise ValueError("Faces must be integer triangles")
    if len(faces) == 0 or faces.min() < 0 or faces.max() >= len(vertices):
        raise ValueError("Face indices must reference existing vertices")
    if labels.shape != (len(vertices),) or labels.dtype.kind not in "iu":
        raise ValueError("One integer annotation is required per vertex")


def partition_edges(mixed_faces):
    edges = np.sort(mixed_faces[:, [[0, 1], [1, 2], [2, 0]]], axis=2)
    return np.unique(edges.reshape(-1, 2), axis=0, return_inverse=True)


def partition_vertex_field(faces, labels, values):
    if values.shape != labels.shape or values.ndim != 1:
        raise ValueError("A scalar field value is required for each source vertex")
    if not np.isfinite(values).all():
        raise ValueError("Surface field values must be finite")
    mixed_faces = faces[np.any(labels[faces] != labels[faces[:, :1]], axis=1)]
    edges, _ = partition_edges(mixed_faces)
    return np.concatenate(
        [values, values[edges].mean(axis=1), values[mixed_faces].mean(axis=1)]
    )


def majority(values):
    ordered = np.sort(values, axis=1)
    winner = ordered[:, 0]
    if ordered.shape[1] == 3:
        pair = (ordered[:, 1] == ordered[:, 2]) & (ordered[:, 0] != ordered[:, 1])
        winner = np.where(pair, ordered[:, 1], winner)
    return winner


def partition_vertex_labels(faces, labels, values):
    if values.shape != labels.shape or values.ndim != 1:
        raise ValueError("A categorical value is required for each source vertex")
    if values.dtype.kind not in "iu":
        raise ValueError("Categorical surface fields must be integers")
    mixed_faces = faces[np.any(labels[faces] != labels[faces[:, :1]], axis=1)]
    edges, _ = partition_edges(mixed_faces)
    return np.concatenate(
        [values, majority(values[edges]), majority(values[mixed_faces])]
    )


def partition_surface(vertices, faces, labels):
    validate_surface(vertices, faces, labels)
    source = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    normals = source.vertex_normals
    face_labels = labels[faces]
    uniform = np.all(face_labels == face_labels[:, :1], axis=1)
    mixed_faces = faces[~uniform]

    edges, edge_inverse = partition_edges(mixed_faces)
    midpoint_indices = edge_inverse.reshape(-1, 3) + len(vertices)
    center_indices = np.arange(len(mixed_faces)) + len(vertices) + len(edges)
    points = np.vstack(
        [vertices, vertices[edges].mean(axis=1), vertices[mixed_faces].mean(axis=1)]
    )
    point_normals = normalize(
        np.vstack(
            [normals, normals[edges].mean(axis=1), normals[mixed_faces].mean(axis=1)]
        )
    )
    triangles = [faces[uniform]]
    owners = [face_labels[uniform, 0]]
    parents = [np.flatnonzero(uniform)]
    for corner in range(3):
        corner_vertices = mixed_faces[:, corner]
        next_midpoint = midpoint_indices[:, corner]
        previous_midpoint = midpoint_indices[:, (corner - 1) % 3]
        triangles.extend(
            [
                np.column_stack([corner_vertices, next_midpoint, center_indices]),
                np.column_stack([corner_vertices, center_indices, previous_midpoint]),
            ]
        )
        owners.extend([labels[corner_vertices], labels[corner_vertices]])
        parents.extend([np.flatnonzero(~uniform), np.flatnonzero(~uniform)])
    return Partition(
        points,
        np.vstack(triangles),
        point_normals,
        np.concatenate(owners),
        np.concatenate(parents),
    )


# Rays run a hair off the lattice: marching-cubes vertices and edges sit on
# integer and half-integer coordinates, and a ray through one counts it twice.
_RAY_OFFSET = (1.3e-4, 2.7e-4)


def misclassified_voxels(vertices, faces, mask, voxel_to_surface):
    """Indices of the voxel centres a closed surface puts on the wrong side.

    Found by ray parity along the first voxel axis. A marching-cubes surface at
    0.5 misplaces none by construction; smoothing can carry it across some.
    """
    points = nib.affines.apply_affine(np.linalg.inv(voxel_to_surface), vertices)
    occupied = np.argwhere(mask)
    lower = np.floor(np.minimum(points.min(axis=0), occupied.min(axis=0))).astype(int) - 1
    upper = np.ceil(np.maximum(points.max(axis=0), occupied.max(axis=0))).astype(int) + 2
    shape = upper - lower
    triangles = (points - lower)[faces]
    y, z = triangles[:, :, 1], triangles[:, :, 2]
    j0 = np.ceil(y.min(axis=1) - _RAY_OFFSET[0]).astype(int)
    k0 = np.ceil(z.min(axis=1) - _RAY_OFFSET[1]).astype(int)
    rows = np.clip(np.floor(y.max(axis=1) - _RAY_OFFSET[0]).astype(int) - j0 + 1, 0, None)
    cols = np.clip(np.floor(z.max(axis=1) - _RAY_OFFSET[1]).astype(int) - k0 + 1, 0, None)
    counts = rows * cols
    owner = np.repeat(np.arange(len(faces)), counts)
    offset = np.arange(counts.sum()) - np.repeat(np.cumsum(counts) - counts, counts)
    j = j0[owner] + offset % rows[owner]
    k = k0[owner] + offset // rows[owner]
    py, pz = j + _RAY_OFFSET[0], k + _RAY_OFFSET[1]
    (x0, y0, z0), (x1, y1, z1), (x2, y2, z2) = (triangles[owner, n].T for n in range(3))
    area = (y1 - y0) * (z2 - z0) - (y2 - y0) * (z1 - z0)
    with np.errstate(divide="ignore", invalid="ignore"):
        a = ((y1 - py) * (z2 - pz) - (y2 - py) * (z1 - pz)) / area
        b = ((y2 - py) * (z0 - pz) - (y0 - py) * (z2 - pz)) / area
        c = 1 - a - b
    hit = (area != 0) & (a >= 0) & (b >= 0) & (c >= 0)
    x = a[hit] * x0[hit] + b[hit] * x1[hit] + c[hit] * x2[hit]
    # A crossing left of voxel centre i flips the side of every centre from i on.
    crossings = np.zeros((shape[0] + 1, shape[1], shape[2]), dtype=np.int32)
    np.add.at(crossings, (np.ceil(x).astype(int), j[hit], k[hit]), 1)
    inside = np.cumsum(crossings, axis=0)[:-1] % 2 == 1
    local = np.zeros(tuple(shape), dtype=bool)
    source_lower = np.maximum(lower, 0)
    source_upper = np.minimum(upper, mask.shape)
    local[tuple(slice(a - o, b - o) for a, b, o in zip(source_lower, source_upper, lower))] = (
        mask[tuple(slice(a, b) for a, b in zip(source_lower, source_upper))]
    )
    return np.argwhere(inside != local) + lower


def extract_structure(volume, label, voxel_to_surface):
    if volume.ndim != 3 or voxel_to_surface.shape != (4, 4):
        raise ValueError("A 3D volume and 4x4 affine are required")
    if not np.isfinite(voxel_to_surface).all():
        raise ValueError("The affine must be finite")
    mask = volume == label
    indices = np.argwhere(mask)
    if len(indices) == 0:
        raise ValueError(f"Structure label {label} is absent")
    lower = np.maximum(indices.min(axis=0) - 1, 0)
    upper = np.minimum(indices.max(axis=0) + 2, volume.shape)
    crop = mask[tuple(slice(start, end) for start, end in zip(lower, upper))]
    padded = np.pad(crop.astype(np.float32), 1)
    vertices, faces, _, _ = marching_cubes(
        padded,
        level=0.5,
        step_size=1,
        allow_degenerate=False,
        gradient_direction="ascent",
    )
    vertices = nib.affines.apply_affine(voxel_to_surface, vertices + lower - 1)
    if np.linalg.det(voxel_to_surface[:3, :3]) < 0:
        faces = faces[:, ::-1]
    return trimesh.Trimesh(vertices=vertices, faces=faces, process=False)


# Halvings of the displacement around a crossed voxel centre before it is
# returned to the source surface outright.
_PULLBACK_STEPS = 12


def smooth_display(source, mask, voxel_to_surface, settings):
    """Taubin-smoothed display surface across which no voxel centre moves.

    Displacement is clamped to the configured bound, then halved around every
    voxel centre the smoothing carried the surface across, until none is: the
    result classifies every source voxel exactly as the marching-cubes surface
    does, and is smooth wherever the voxels allow it.
    """
    iterations = settings["iterations"]
    maximum = settings["maximum_displacement_mm"]
    if not isinstance(iterations, int) or iterations < 1:
        raise ValueError("Smoothing iterations must be a positive integer")
    if not np.isfinite(maximum) or maximum <= 0:
        raise ValueError("Display displacement must be finite and positive")
    mesh = source.copy()
    filter_taubin(mesh, lamb=0.5, nu=0.53, iterations=iterations)
    displacement = mesh.vertices - source.vertices
    lengths = np.linalg.norm(displacement, axis=1)
    scale = np.ones_like(lengths)
    np.divide(maximum, lengths, out=scale, where=lengths > maximum)
    displacement *= scale[:, None]

    occupied = np.argwhere(mask)
    lower = np.maximum(occupied.min(axis=0) - 3, 0)
    upper = occupied.max(axis=0) + 4
    crop = mask[tuple(slice(a, b) for a, b in zip(lower, upper))]
    local = voxel_to_surface @ nib.affines.from_matvec(np.eye(3), lower)
    tree = cKDTree(nib.affines.apply_affine(np.linalg.inv(local), source.vertices))
    for step in range(_PULLBACK_STEPS + 1):
        crossed = misclassified_voxels(source.vertices + displacement, source.faces, crop, local)
        if not len(crossed):
            break
        # The farthest vertex of a cube touching a voxel centre is 1.5 away.
        near = np.unique(np.concatenate(tree.query_ball_point(crossed, r=1.75)).astype(int))
        displacement[near] *= 0.5 if step < _PULLBACK_STEPS else 0.0
    else:
        raise ValueError("Display smoothing moved the surface across a voxel centre")
    mesh.vertices = source.vertices + displacement
    if not np.isfinite(mesh.vertices).all() or mesh.volume <= 0:
        raise ValueError("Display smoothing produced invalid geometry")
    return mesh
