from dataclasses import replace

import numpy as np
import pytest

from brain_model.geometry import Partition, partition_surface
from brain_model.validate import validate_partition


def test_validation_detects_missing_coverage_and_displaced_geometry():
    vertices = np.array([[0.0, 0.0, 0.0], [4.0, 0.0, 0.0], [1.0, 3.0, 0.0]])
    faces = np.array([[0, 1, 2]])
    labels = np.array([1, 2, 3])
    partition = partition_surface(vertices, faces, labels)
    report = validate_partition(vertices, faces, labels, partition)
    assert report["maximum_parent_area_error_mm2"] < 1e-12
    damaged = partition.vertices.copy()
    damaged[-1, 2] += 0.1
    with pytest.raises(ValueError, match="plane"):
        validate_partition(
            vertices, faces, labels, replace(partition, vertices=damaged)
        )
    with pytest.raises(ValueError, match="area"):
        validate_partition(
            vertices,
            faces,
            labels,
            replace(
                partition,
                faces=partition.faces[:-1],
                labels=partition.labels[:-1],
                parent_faces=partition.parent_faces[:-1],
            ),
        )


def test_validation_detects_relabeling_of_source_vertex():
    vertices = np.array([[0.0, 0.0, 0.0], [4.0, 0.0, 0.0], [1.0, 3.0, 0.0]])
    faces = np.array([[0, 1, 2]])
    labels = np.array([1, 2, 3])
    partition = partition_surface(vertices, faces, labels)
    wrong_labels = partition.labels.copy()
    wrong_labels[0] = 2
    with pytest.raises(ValueError, match="ownership"):
        validate_partition(
            vertices, faces, labels, replace(partition, labels=wrong_labels)
        )


def test_source_degenerate_face_is_preserved_and_reported():
    vertices = np.array([[0.0, 0.0, 0.0], [4.0, 0.0, 0.0], [0.0, 0.0, 0.0]])
    faces = np.array([[0, 1, 2]])
    labels = np.array([1, 1, 1])
    partition = Partition(
        vertices, faces, np.ones((3, 3)), np.array([1]), np.array([0])
    )
    report = validate_partition(vertices, faces, labels, partition)
    assert report["source_zero_area_triangles"] == 1
    bad = vertices.copy()
    bad[1, 0] = 5
    with pytest.raises(ValueError, match="degenerate"):
        validate_partition(vertices, faces, labels, replace(partition, vertices=bad))
