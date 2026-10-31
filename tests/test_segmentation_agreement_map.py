import nibabel as nib
import numpy as np
import pytest

from brain_model.labels import segmentation_agreement
from brain_model.labels.volumes import LabelGrid


def aseg_like(shape=(12, 12, 12)):
    return nib.MGHImage(np.zeros(shape, np.int32), np.eye(4))


def placed(image, units, to_aseg):
    """A finer grid whose voxels sit at `to_aseg` in the aseg image's voxel space."""
    return LabelGrid(units, image.header.get_vox2ras_tkr() @ to_aseg, [0.0] * 3)


def half_millimetre(corner):
    to_aseg = np.diag([0.5, 0.5, 0.5, 1.0])
    # Voxel 0 of the fine grid sits a quarter voxel inside aseg voxel `corner`, so
    # each aseg voxel holds exactly two fine voxels per axis.
    to_aseg[:3, 3] = np.array(corner) - 0.25
    return to_aseg


def test_a_cell_belongs_to_a_unit_only_when_it_holds_over_half():
    image = aseg_like()
    units = np.zeros((8, 8, 8), np.uint16)
    # Fine voxels 0-1 fall in aseg voxel 2, 2-3 in voxel 3, along every axis.
    units[0:2, 0:2, 0:2] = 1
    units[0, 0, 0] = 0  # 7 of 8: in
    units[2:4, 0:2, 0:1] = 2  # 4 of 8: a tie, out
    units[0:2, 2:4, 0:2] = 2
    units[0:2, 2:3, 0:2] = 1  # 4 of 8 each: out for both
    codes = segmentation_agreement.voxelise(units, placed(image, units, half_millimetre([2, 2, 2])), image)
    assert codes[2, 2, 2] == 1
    assert codes[3, 2, 2] == 0
    assert codes[2, 3, 2] == 0
    assert np.count_nonzero(codes) == 1


@pytest.mark.parametrize("axes", [(0, 1, 2), (2, 0, 1)])
def test_the_revoxelisation_agrees_with_the_build_on_any_labels(axes):
    """Two formulations of one rule, so the validation does not share the build's code."""
    image = aseg_like((14, 15, 16))
    rng = np.random.default_rng(1)
    units = rng.choice([0, 0, 1, 2, 3], size=(19, 21, 17)).astype(np.uint16)
    # 0.4 mm, so cells hold two or three fine voxels per axis, with permuted axes.
    linear = np.eye(3)[:, list(axes)] * 0.4
    to_aseg = np.eye(4)
    to_aseg[:3, :3] = linear
    to_aseg[:3, 3] = [3.3, 2.9, 3.1]
    grid = placed(image, units, to_aseg)
    built = segmentation_agreement.voxelise(units, grid, image)
    assert np.count_nonzero(built) > 0
    np.testing.assert_array_equal(built, segmentation_agreement.revoxelise(units, grid, image))


def test_a_unit_off_aseg_grid_is_refused():
    image = aseg_like((4, 4, 4))
    units = np.zeros((4, 4, 4), np.uint16)
    units[0, 0, 0] = 1
    grid = placed(image, units, half_millimetre([-1, 0, 0]))
    with pytest.raises(ValueError, match="outside aseg"):
        segmentation_agreement.voxelise(units, grid, image)
    with pytest.raises(ValueError, match="outside aseg"):
        segmentation_agreement.revoxelise(units, grid, image)


def test_counts_split_a_structure_by_which_segmentation_labels_it():
    compared = np.array([1, 1, 1, 0, 2, 2])
    aseg = np.array([17, 17, 0, 17, 17, 18])
    assert segmentation_agreement.count(compared, aseg, 1, 17) == {
        "both": 2, "aseg_only": 2, "nextbrain_only": 1,
    }
