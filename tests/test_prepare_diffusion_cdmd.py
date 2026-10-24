import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from prepare_diffusion_cdmd import deviation, resample


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
