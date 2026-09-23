"""3D convolution on the CPU without a whole-volume im2col buffer.

FreeSurfer 8.2's arm64 torch 2.1.2 has no oneDNN, so CPU conv3d goes through
an im2col buffer 27 times the input: about 90 GB at SuperSynth's 96
full-resolution channels. A stride-1 3D convolution is exactly a sum over
kernel depth of 2D convolutions of shifted depth slices, computed here a block
of slices at a time. The products are the same; only the summation order is not.
"""
import sys

import torch
import torch.nn.functional as F

_conv3d = F.conv3d
BLOCK_BYTES = 256 * 2**20
# Above this many multiply-adds, a convolution handed back to torch is worth a
# warning: it is the im2col path this module exists to avoid.
LARGE_CONVOLUTION = 2e8


def _triple(value):
    return tuple(value) if isinstance(value, (tuple, list)) else (value,) * 3


def conv3d_by_slices(input, weight, bias=None, stride=1, padding=0, dilation=1, groups=1):
    if padding == 'valid':
        padding = 0
    elif padding == 'same' and all(k % 2 for k in weight.shape[2:]):
        padding = tuple((k - 1) // 2 for k in weight.shape[2:])
    if (input.device.type != 'cpu' or input.dim() != 5 or groups != 1 or isinstance(padding, str)
            or _triple(stride) != (1, 1, 1) or _triple(dilation) != (1, 1, 1)):
        if input.device.type == 'cpu' and input.numel() * weight[0].numel() > LARGE_CONVOLUTION:
            print(f'conv3d_slices: large conv3d left to torch (shape {tuple(input.shape)}, kernel '
                  f'{tuple(weight.shape)}, stride {stride}, padding {padding})', file=sys.stderr, flush=True)
        return _conv3d(input, weight, bias, stride, padding, dilation, groups)
    pd, ph, pw = _triple(padding)
    n, cin, depth, height, width = input.shape
    cout, _, kd, kh, kw = weight.shape
    out_depth = depth + 2 * pd - kd + 1
    out_h, out_w = height + 2 * ph - kh + 1, width + 2 * pw - kw + 1
    out = torch.empty((n, cout, out_depth, out_h, out_w), dtype=input.dtype)
    step = max(1, int(BLOCK_BYTES // (max(cin, cout) * height * width * input.element_size())))
    for b in range(n):
        for d0 in range(0, out_depth, step):
            d1 = min(out_depth, d0 + step)
            acc = None
            for k in range(kd):
                lo, hi = d0 + k - pd, d1 + k - pd  # input depths this kernel row reads
                block = input.new_zeros((d1 - d0, cin, height, width))
                a, c = max(lo, 0), min(hi, depth)
                if a < c:
                    block[a - lo:c - lo] = input[b, :, a:c].permute(1, 0, 2, 3)
                y = F.conv2d(block, weight[:, :, k], None, 1, (ph, pw))
                acc = y if acc is None else acc.add_(y)
            if bias is not None:
                acc += bias[None, :, None, None]
            out[b, :, d0:d1] = acc.permute(1, 0, 2, 3)
    return out


def install(functional=True):
    # TorchScript resolves F.conv3d when it compiles, so a script that compiles
    # functions calling it (FireANTs) must keep the builtin there.
    if functional:
        F.conv3d = conv3d_by_slices
    torch.conv3d = lambda input, weight, bias=None, stride=1, padding=0, dilation=1, groups=1: \
        conv3d_by_slices(input, weight, bias, stride, padding, dilation, groups)
