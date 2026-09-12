"""Geometry conversions that preserve source anatomy and discrete labels."""

from dataclasses import dataclass

import nibabel as nib
import numpy as np
import trimesh
from skimage.measure import marching_cubes


@dataclass(frozen=True)
class Partition:
    vertices: np.ndarray
    faces: np.ndarray
    normals: np.ndarray
    labels: np.ndarray
    parent_faces: np.ndarray


def to_gltf(coordinates):
    """Convert surface RAS millimeters to right/superior/posterior meters."""
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
    """Interpolate a continuous field on the same barycentric atlas partition."""
    if values.shape != labels.shape or values.ndim != 1:
        raise ValueError("A scalar field value is required for each source vertex")
    if not np.isfinite(values).all():
        raise ValueError("Surface field values must be finite")
    mixed_faces = faces[np.any(labels[faces] != labels[faces[:, :1]], axis=1)]
    edges, _ = partition_edges(mixed_faces)
    return np.concatenate(
        [values, values[edges].mean(axis=1), values[mixed_faces].mean(axis=1)]
    )


def _majority(values):
    """The most common value in each row; the lowest wins a tie."""
    ordered = np.sort(values, axis=1)
    winner = ordered[:, 0]
    if ordered.shape[1] == 3:
        pair = (ordered[:, 1] == ordered[:, 2]) & (ordered[:, 0] != ordered[:, 1])
        winner = np.where(pair, ordered[:, 1], winner)
    return winner


def partition_vertex_labels(faces, labels, values):
    """Carry a categorical field onto the same barycentric atlas partition.

    The continuous twin of this averages; an average of two network ids is not
    a network, so the points a mixed face adds take the most common value among
    the source vertices that formed them instead. Two-vertex midpoints are a tie
    whenever their ends disagree, and the lowest id takes them — a deterministic
    choice at a scale below the one the field itself resolves.
    """
    if values.shape != labels.shape or values.ndim != 1:
        raise ValueError("A categorical value is required for each source vertex")
    if values.dtype.kind not in "iu":
        raise ValueError("Categorical surface fields must be integers")
    mixed_faces = faces[np.any(labels[faces] != labels[faces[:, :1]], axis=1)]
    edges, _ = partition_edges(mixed_faces)
    return np.concatenate(
        [values, _majority(values[edges]), _majority(values[mixed_faces])]
    )


def partition_surface(vertices, faces, labels):
    """Partition mixed-label faces into six barycentric subtriangles.

    Each corner owns the quadrilateral joining itself, its two edge midpoints,
    and the centroid. Uniform faces remain untouched. This conserves geometry
    and all source vertex labels without pretending labels are continuous.
    """
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


def extract_structure(volume, label, voxel_to_surface):
    """Extract the 0.5 isosurface of an unchanged segmentation label."""
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
