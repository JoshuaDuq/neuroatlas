"""Where a region is: its centroid, and the voxel of its own label nearest it."""

import numpy as np
import pytest

from brain_model.labels.placement import placements, surface_placement

# 2 mm voxels, shifted, so the result is in surface RAS millimetres, not voxel indices.
AFFINE = np.array([[2.0, 0, 0, -10], [0, 2.0, 0, 5], [0, 0, 2.0, 1], [0, 0, 0, 1]])


def to_ras(voxel):
    return (AFFINE @ np.r_[voxel, 1])[:3]


def test_a_curved_label_is_anchored_inside_it_though_its_centroid_is_not():
    labels = np.zeros((7, 7, 1), dtype=np.int16)
    # A C open to +x: its centroid falls in the hollow, as a caudate's or a putamen's can.
    labels[1:6, 1, 0] = 7
    labels[1, 1:6, 0] = 7
    labels[1:6, 5, 0] = 7
    labels[3, 3, 0] = 9
    placed = placements(labels, AFFINE, [7, 9])

    voxels = np.argwhere(labels == 7)
    centroid = np.mean([to_ras(voxel) for voxel in voxels], axis=0)
    assert placed[7]["centroid_ras_mm"] == pytest.approx(centroid.tolist())
    assert labels[tuple(np.rint(np.linalg.solve(AFFINE[:3, :3], centroid - AFFINE[:3, 3])).astype(int))] != 7
    anchor = np.array(placed[7]["anchor_ras_mm"])
    distances = [np.linalg.norm(to_ras(voxel) - centroid) for voxel in voxels]
    assert anchor.tolist() == to_ras(voxels[int(np.argmin(distances))]).tolist()
    assert placed[9] == {"centroid_ras_mm": to_ras([3, 3, 0]).tolist(), "anchor_ras_mm": to_ras([3, 3, 0]).tolist()}


def test_a_requested_label_with_no_voxel_is_an_error():
    with pytest.raises(ValueError, match="no voxel"):
        placements(np.zeros((2, 2, 2), dtype=np.int16), AFFINE, [4])


def test_a_surface_patch_is_anchored_on_its_own_point_nearest_its_centroid():
    # An arc of mid-ribbon points: the centroid lies off the arc, the anchor on it.
    angles = np.linspace(0, np.pi, 9)
    points = np.column_stack([np.cos(angles), np.sin(angles), np.zeros_like(angles)]) * 10
    placed = surface_placement(points)
    assert placed["centroid_ras_mm"] == pytest.approx(points.mean(axis=0).tolist())
    assert placed["anchor_ras_mm"] == points[4].tolist()
