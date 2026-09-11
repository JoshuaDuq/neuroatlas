import numpy as np
import pytest

from brain_model.registration import resample_surface_labels


def test_registered_spheres_transfer_discrete_labels_without_moving_anatomy():
    source = np.array([[100., 0, 0], [0, 100., 0], [-100., 0, 0], [0, -100., 0]])
    target = source[[2, 0, 3, 1]] + np.array([0., 0., 0.01])
    labels = np.array([4, 8, -1, 12])
    before = target.copy()
    result = resample_surface_labels(source, target, labels)
    np.testing.assert_array_equal(result, [-1, 4, 12, 8])
    np.testing.assert_array_equal(target, before)
    assert result.dtype == labels.dtype


def test_target_vertices_can_share_a_label_without_averaging_ids():
    source = np.array([[100., 0, 0], [-100., 0, 0]])
    target = np.array([[99., 1, 0], [99., -1, 0], [-99., 1, 0]])
    np.testing.assert_array_equal(
        resample_surface_labels(source, target, np.array([1, 180])), [1, 1, 180]
    )


@pytest.mark.parametrize('source,target,labels', [
    (np.zeros((2, 3)), np.zeros((1, 3)), np.array([1])),
    (np.zeros((2, 3)), np.zeros((1, 3)), np.array([1., 2.])),
    (np.zeros((2, 3)), np.full((1, 3), np.nan), np.array([1, 2])),
    (np.zeros((0, 3)), np.zeros((1, 3)), np.array([], dtype=int)),
])
def test_invalid_registration_inputs_fail(source, target, labels):
    with pytest.raises(ValueError):
        resample_surface_labels(source, target, labels)
