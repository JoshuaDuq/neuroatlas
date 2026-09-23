"""Run a FreeSurfer 8.2 Python script under fspython with three runtime workarounds.

None of them changes a computed value. scripts/segment_nextbrain.py describes
each in WORKAROUNDS and records that description as provenance.
"""
import importlib.util
import os
import sys
import types

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import conv3d_slices

RELEASES = {
    'SuperSynth/scripts/inference.py': [
        ("                        pred = nets.ssynth_inference(S[None, None, ...])\n",
         "                        pred = None\n                        pred = nets.ssynth_inference(S[None, None, ...])\n"),
        ("                        seg = 0.5 * seg + 0.5 * softmax(activations, dim=0)\n",
         ("                        seg = 0.5 * seg + 0.5 * softmax(activations, dim=0)\n"
          "                        activations = None\n                        pred = None\n")),
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
    for suffix, patches in RELEASES.items():
        if script.endswith(suffix):
            for old, new in patches:
                if source.count(old) != 1:
                    raise SystemExit(f'{suffix}: expected one match for a memory release, '
                                     f'found {source.count(old)}')
                source = source.replace(old, new)
    sys.argv = [script] + sys.argv[2:]
    sys.path.insert(0, os.path.dirname(script))
    namespace = {'__name__': '__main__', '__file__': script, '__builtins__': __builtins__}
    # FreeSurfer's own script, run as __main__ with the releases patched in.
    exec(compile(source, script, 'exec'), namespace)  # noqa: S102


if __name__ == '__main__':
    main()
