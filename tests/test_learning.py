import numpy as np
import pytest

from brain_model.geometry import extract_structure
from brain_model.learning import combine_labels, smooth_display


def test_unions_preserve_every_member_voxel_and_exclude_other_labels():
    source = np.array([[[0, 48, 118, 393, 79]]], dtype=np.int32)
    original = source.copy()
    groups = [{"id": "caudate", "labels": [48, 118, 393]}]
    result = combine_labels(source, groups)
    np.testing.assert_array_equal(result, [[[0, 1, 1, 1, 0]]])
    np.testing.assert_array_equal(source, original)


def test_overlapping_membership_is_an_error():
    groups = [{"id": "a", "labels": [48]}, {"id": "b", "labels": [48]}]
    with pytest.raises(ValueError, match="multiple"):
        combine_labels(np.array([[[48]]]), groups)


def test_smoothing_is_bounded_preserves_topology_and_does_not_mutate_source():
    grid = np.indices((24, 24, 24))
    mask = ((grid - 12) ** 2).sum(axis=0) < 64
    original = extract_structure(mask, 1, np.eye(4))
    vertices = original.vertices.copy()
    smoothed = smooth_display(
        original, {"iterations": 12, "maximum_displacement_mm": 0.6}
    )
    displacement = np.linalg.norm(smoothed.vertices - vertices, axis=1)
    assert 0.01 < displacement.max() <= 0.600001
    np.testing.assert_array_equal(smoothed.faces, original.faces)
    np.testing.assert_array_equal(original.vertices, vertices)
    assert smoothed.is_watertight
    assert smoothed.is_winding_consistent
    assert smoothed.volume > 0
    assert abs(smoothed.volume / original.volume - 1) < 0.05
