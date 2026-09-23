import importlib.util
import os
import subprocess
from pathlib import Path

import nibabel as nib
import numpy as np
import pytest

from brain_model import nextbrain
from brain_model.sources import ROOT
from brain_model.volumes import resample_nearest


def load_script():
    """scripts/ is not a package, so the script is loaded by path."""
    spec = importlib.util.spec_from_file_location(
        "segment_nextbrain", ROOT / "scripts/segment_nextbrain.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


segment = load_script()


def grid(spacing, origin):
    affine = np.diag([spacing, spacing, spacing, 1.0])
    affine[:3, 3] = origin
    return affine


def test_nearest_neighbour_follows_permuted_and_flipped_axes():
    rng = np.random.default_rng(0)
    data = rng.integers(0, 50, (6, 7, 8))
    # Conformed-like: voxel axes run left, inferior and anterior.
    source = np.array([[-1.0, 0, 0, 3], [0, 0, 1, -4], [0, -1, 0, 3.5], [0, 0, 0, 1]])
    target = grid(1.0, nib.affines.apply_affine(source, [5, 6, 0]))
    values, shift = resample_nearest(data, source, target, (6, 8, 7))
    for index in np.ndindex(values.shape):
        point = nib.affines.apply_affine(target, index)
        voxel = np.rint(nib.affines.apply_affine(np.linalg.inv(source), point)).astype(int)
        assert values[index] == data[tuple(voxel)]
    assert shift == pytest.approx(0)


def test_a_finer_target_reports_how_far_values_moved():
    data = np.arange(4 * 4 * 4).reshape(4, 4, 4)
    values, shift = resample_nearest(data, grid(1.0, [0, 0, 0]), grid(0.4, [0, 0, 0]), (8, 8, 8))
    assert values[5, 0, 0] == data[2, 0, 0]  # 2.0 mm is voxel 2 exactly
    assert values[1, 0, 0] == data[0, 0, 0]  # 0.4 mm is nearer voxel 0
    # 0.4 mm steps land at most 0.4 mm from a 1 mm centre on each axis.
    assert shift == pytest.approx(np.sqrt(3) * 0.4)


def test_skewed_grids_are_refused():
    skewed = grid(1.0, [0, 0, 0])
    skewed[0, 1] = 0.01
    with pytest.raises(ValueError, match="skewed"):
        resample_nearest(np.zeros((10, 10, 10)), skewed, grid(1.0, [0, 0, 0]), (10, 10, 10))


def test_the_joined_grid_starts_on_the_cut_label_lattice_and_covers_both_sides():
    boxes = [
        (grid(0.3989, [-66.3, -109.3, -61.7]), np.array([2, 3, 4]), np.array([180, 300, 400])),
        (grid(0.4010, [-6.3, -109.3, -61.2]), np.array([0, 5, 1]), np.array([190, 330, 470])),
    ]
    affine, shape = segment.joined_grid(boxes)
    lower = affine[:3, 3]
    np.testing.assert_allclose(lower / segment.LATTICE_MM, np.round(lower / segment.LATTICE_MM))
    upper = nib.affines.apply_affine(affine, np.array(shape) - 1)
    for source, lo, hi in boxes:
        for corner in (lo, hi):
            point = nib.affines.apply_affine(source, corner)
            assert np.all(point >= lower) and np.all(point <= upper)


def test_the_lut_names_each_side_and_offsets_the_right(tmp_path):
    source = tmp_path / "lut.txt"
    source.write_text("0  Unknown  0  0  0  0\n48  head_of_caudate  145 160 110 0\n"
                      "2035  ctx-rh-insula  255 192 32 0\n")
    segment.write_lut(segment.read_freesurfer_lut(source), tmp_path / "both.txt")
    table = nextbrain.read_lut(tmp_path / "both.txt")
    assert table[48] == ("Left-head_of_caudate", [145, 160, 110])
    assert table[10048] == ("Right-head_of_caudate", [145, 160, 110])
    assert table[12035][0] == "Right-ctx-rh-insula"
    assert table[0][0] == "Unknown"


def test_voxels_both_sides_label_go_where_freesurfer_splits_the_hemispheres(tmp_path):
    """FreeSurfer keeps SuperSynth's MNI x < 0 for the left, >= 0 for the right."""
    mri = tmp_path / "subject/mri"
    mri.mkdir(parents=True)
    orig = np.eye(4)
    orig[:3, 3] = -16
    nib.save(nib.MGHImage(np.zeros((32, 32, 32), np.uint8), orig), mri / "orig.mgz")
    config = {"source_directory": tmp_path / "subject"}
    work = tmp_path / "work"
    (work / "SuperSynth").mkdir(parents=True)
    # Each side's grid reaches 2 mm past the midline, as FreeSurfer's do.
    for side, low, value in (("left", -10.0, 7), ("right", -2.0, 8)):
        affine = grid(0.4, [low, -4, -4])
        nib.save(nib.Nifti1Image(np.full((31, 21, 21), value, np.float32), affine),
                 work / f"seg.{side}.nii.gz")
    field = grid(1.0, [-20, -20, -20])
    nib.save(nib.MGHImage(np.zeros((40, 40, 40), np.float32), field),
             work / "SuperSynth/input_resampled.mgz")
    nib.save(nib.MGHImage(np.zeros((40, 40, 40, 3), np.float32), field),
             work / "SuperSynth/mni_deformation.mgz")
    # MNI x is scanner x shifted 1 mm left, so the split is at scanner x = 1.
    np.savetxt(work / "SuperSynth/mni_affine.txt",
               [[1, 0, 0, -1], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]], delimiter=",")

    labels, affine, join = segment.join_hemispheres(config, work)
    to_scanner = np.linalg.inv(nextbrain.scanner_to_surface(config)) @ affine
    x = nib.affines.apply_affine(to_scanner, np.argwhere(labels > 0))[:, 0]
    values = labels[labels > 0]
    assert set(values.tolist()) == {7, 8 + nextbrain.HEMISPHERE_OFFSET}
    assert np.all(x[values == 7] < 1 + 1e-6)
    assert np.all(x[values != 7] >= 1 - 1e-6)
    assert join["voxels_labelled_by_both_sides"] > 0


FREESURFER = Path(os.environ.get("FREESURFER_HOME", "/Applications/freesurfer/8.2.0"))


@pytest.mark.skipif(not (FREESURFER / "bin/fspython").exists(), reason="needs FreeSurfer 8.2")
def test_the_sliced_convolution_matches_torch():
    result = subprocess.run(
        [FREESURFER / "bin/fspython", ROOT / "scripts/freesurfer/check_conv3d_slices.py"],
        env={**os.environ, "FREESURFER_HOME": str(FREESURFER)},
        capture_output=True, text=True, check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
