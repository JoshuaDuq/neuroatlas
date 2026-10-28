import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from prepare_diffusion_cdmd import deviation, resample, trim


def test_resampling_keeps_the_ends_and_spaces_points_at_the_step():
    t = np.linspace(0, np.pi, 400)
    line = np.column_stack([40 * np.cos(t), 40 * np.sin(t), np.zeros_like(t)]).astype(np.float32)
    resampled = resample(line, 0.5)
    np.testing.assert_allclose(resampled[[0, -1]], line[[0, -1]], atol=1e-5)
    steps = np.linalg.norm(np.diff(resampled, axis=0), axis=1)
    assert abs(np.median(steps) - 0.5) < 0.01 and steps.max() - steps.min() < 1e-4
    assert deviation(line, resampled) < 0.01


def test_a_line_shorter_than_the_step_keeps_its_two_ends():
    line = np.array([[0, 0, 0], [0.1, 0, 0], [0.2, 0, 0]], dtype=np.float32)
    np.testing.assert_allclose(resample(line, 0.5), line[[0, -1]])


def test_trimming_drops_only_the_runs_outside_the_brain_at_each_end():
    inside = np.zeros((10, 1, 1), bool)
    inside[2:5] = inside[6:8] = True
    # 1 mm voxels shifted by 0.5 mm, so x mm lies in voxel x - 0.5, rounded.
    affine = np.eye(4)
    affine[0, 3] = 0.5
    line = np.array([[x, 0.5, 0.5] for x in (0.5, 1.5, 2.5, 3.5, 5.5, 6.5, 7.5, 8.5, 9.5)])
    # Voxel 5 is outside but between kept points, so the crossing stays.
    np.testing.assert_array_equal(trim(line, inside, affine), line[2:7])
    with pytest.raises(ValueError, match="outside the brain"):
        trim(line[[0, 1, 7, 8]], inside, affine)
