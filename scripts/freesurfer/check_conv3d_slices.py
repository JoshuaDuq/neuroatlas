"""Check conv3d_by_slices against torch's own conv3d. Run with fspython."""
import os
import sys

import torch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import conv3d_slices
from conv3d_slices import _conv3d, conv3d_by_slices


def relative(got, ref):
    assert got.shape == ref.shape, (got.shape, ref.shape)
    return float((got - ref).abs().max() / ref.abs().max())


torch.manual_seed(0)
worst = 0.0
cases = [
    ((1, 5, 9, 11, 7), (6, 5, 3, 3, 3), 1, True),
    ((1, 5, 9, 11, 7), (6, 5, 3, 3, 3), 0, False),
    ((2, 4, 6, 5, 8), (3, 4, 1, 1, 1), 0, True),
    ((1, 3, 17, 13, 12), (4, 3, 3, 3, 3), [1, 1, 1], False),
    ((1, 1, 20, 20, 20), (1, 1, 3, 3, 3), [1, 1, 1], False),
    ((1, 9, 12, 10, 11), (5, 9, 3, 3, 3), 'same', True),
    ((1, 9, 12, 10, 11), (5, 9, 3, 3, 3), 'valid', True),
]
for shape, kernel, padding, with_bias in cases:
    x, w = torch.randn(shape), torch.randn(kernel)
    b = torch.randn(kernel[0]) if with_bias else None
    worst = max(worst, relative(conv3d_by_slices(x, w, b, 1, padding), _conv3d(x, w, b, 1, padding)))

# A non-contiguous weight slice, as SuperSynth's frugal_models passes.
x, w = torch.randn(1, 8, 10, 10, 10), torch.randn(4, 16, 3, 3, 3)
worst = max(worst, relative(conv3d_by_slices(x, w[:, :8], None, 1, 1), _conv3d(x, w[:, :8], None, 1, 1)))

# Blocks smaller than the volume, so block edges are exercised.
conv3d_slices.BLOCK_BYTES = 4000
x, w = torch.randn(1, 3, 23, 9, 9), torch.randn(2, 3, 3, 3, 3)
worst = max(worst, relative(conv3d_by_slices(x, w, None, 1, 1), _conv3d(x, w, None, 1, 1)))

print(f'max relative difference from torch conv3d: {worst:.2e}')
assert worst < 1e-5
