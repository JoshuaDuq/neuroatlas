"""Run a FreeSurfer 8.2 Python script under fspython with three runtime workarounds.

None of them changes a computed value. scripts/segment_nextbrain.py describes
each in WORKAROUNDS and records that description as provenance. NextBrain's
segmentation also writes the posteriors behind its labels (see PATCHES).
"""
import importlib.util
import os
import sys
import types

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import conv3d_slices

PATCHES = {
    'SuperSynth/scripts/inference.py': [
        ("                        pred = nets.ssynth_inference(S[None, None, ...])\n",
         "                        pred = None\n                        pred = nets.ssynth_inference(S[None, None, ...])\n"),
        ("                        seg = 0.5 * seg + 0.5 * softmax(activations, dim=0)\n",
         ("                        seg = 0.5 * seg + 0.5 * softmax(activations, dim=0)\n"
          "                        activations = None\n                        pred = None\n")),
    ],
    # Each voxel's winning posterior, which NextBrain keeps but does not write, and
    # its runner-up label and posterior. Recorded beside the label update, which is
    # untouched: a label that takes a voxel pushes the previous winner to second.
    'ERC_bayesian_segmentation/scripts/segment_fireants.py': [
        ("max_p = torch.zeros(normalizers.shape, dtype=dtype, device=device)\n",
         ("max_p = torch.zeros(normalizers.shape, dtype=dtype, device=device)\n"
          "second_p = torch.zeros(normalizers.shape, dtype=dtype, device=device)\n"
          "second_seg = torch.zeros(normalizers.shape, dtype=torch.int, device=device)\n")),
        ("        mask = (post > max_p[lr_crop])\n",
         ("        mask = (post > max_p[lr_crop])\n"
          "        runner_up = (~mask) & (post > second_p[lr_crop])\n"
          "        second_p[lr_crop][runner_up] = post[runner_up]\n"
          "        second_seg[lr_crop].masked_fill_(runner_up, int(label_list[n]))\n"
          "        second_p[lr_crop][mask] = max_p[lr_crop][mask]\n"
          "        second_seg[lr_crop][mask] = seg[lr_crop][mask]\n"
          "        del runner_up\n")),
        ("my.MRIwrite(seg.detach().cpu().numpy().astype(np.uint16), aff_r, output_dir + '/seg.' + side + '.nii.gz')\n",
         ("my.MRIwrite(seg.detach().cpu().numpy().astype(np.uint16), aff_r, output_dir + '/seg.' + side + '.nii.gz')\n"
          "for name, volume, kind in (('max_p', max_p, np.float32), ('second_p', second_p, np.float32),\n"
          "                           ('second_seg', second_seg, np.uint16)):\n"
          "    my.MRIwrite(volume.detach().cpu().numpy().astype(kind), aff_r,\n"
          "                output_dir + '/' + name + '.' + side + '.nii.gz')\n")),
    ],
}


class _MissingOpenCV(types.ModuleType):
    def __getattr__(self, name):
        raise AttributeError(f'cv2.{name}: OpenCV is not bundled with FreeSurfer 8.2 on macOS')


def main():
    script = os.path.abspath(sys.argv[1])
    conv3d_slices.install(functional=not script.endswith('scripts/segment_fireants.py'))
    if importlib.util.find_spec('cv2') is None:
        sys.modules['cv2'] = _MissingOpenCV('cv2')
    with open(script) as handle:
        source = handle.read()
    for suffix, patches in PATCHES.items():
        if script.endswith(suffix):
            for old, new in patches:
                if source.count(old) != 1:
                    raise SystemExit(f'{suffix}: expected one match for a patch, '
                                     f'found {source.count(old)}')
                source = source.replace(old, new)
    sys.argv = [script] + sys.argv[2:]
    sys.path.insert(0, os.path.dirname(script))
    namespace = {'__name__': '__main__', '__file__': script, '__builtins__': __builtins__}
    # FreeSurfer's own script, run as __main__ with its patches applied.
    exec(compile(source, script, 'exec'), namespace)  # noqa: S102


if __name__ == '__main__':
    main()
