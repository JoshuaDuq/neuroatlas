import numpy as np
import pytest

from brain_model import nextbrain
from brain_model.geometry import extract_structure
from brain_model.learning import combine_labels, read_definition, smooth_display
from brain_model.sources import read_config
from brain_model.volumes import load_on_grid


def test_unions_preserve_every_member_voxel_and_exclude_other_labels():
    source = np.array([[[0, 48, 118, 393, 79]]], dtype=np.int32)
    original = source.copy()
    groups = [{"id": "caudate", "labels": [48, 118, 393]}]
    result = combine_labels(source, groups)
    np.testing.assert_array_equal(result, [[[0, 1, 1, 1, 0]]])
    np.testing.assert_array_equal(source, original)


def test_overlapping_membership_is_an_error():
    groups = [{"id": "a", "labels": [48]}, {"id": "b", "labels": [48]}]
    with pytest.raises(ValueError, match="multiple"):
        combine_labels(np.array([[[48]]]), groups)


def test_smoothing_is_bounded_preserves_topology_and_does_not_mutate_source():
    grid = np.indices((24, 24, 24))
    mask = ((grid - 12) ** 2).sum(axis=0) < 64
    original = extract_structure(mask, 1, np.eye(4))
    vertices = original.vertices.copy()
    smoothed = smooth_display(
        original, {"iterations": 12, "maximum_displacement_mm": 0.6}
    )
    displacement = np.linalg.norm(smoothed.vertices - vertices, axis=1)
    assert 0.01 < displacement.max() <= 0.600001
    np.testing.assert_array_equal(smoothed.faces, original.faces)
    np.testing.assert_array_equal(original.vertices, vertices)
    assert smoothed.is_watertight
    assert smoothed.is_winding_consistent
    assert smoothed.volume > 0
    assert abs(smoothed.volume / original.volume - 1) < 0.05



def test_a_midline_structure_is_published_once_rather_than_halved():
    # NextBrain labels every ROI on both halves of its grid. For the optic
    # chiasm — the crossing itself — halving it invents a boundary and leaves
    # each half small enough that surviving a warp is a coin toss.
    from brain_model.learning import expand_nextbrain

    table = {161: ("optic_chiasm", [0, 0, 0]), 10161: ("optic_chiasm", [0, 0, 0])}
    units = expand_nextbrain(
        [
            {"id": "caudate", "labels": [161]},
            {"id": "optic-chiasm", "hemisphere": "midline", "labels": [161]},
        ],
        table,
    )
    by_id = {unit["id"]: unit for unit in units}

    # A structure that is genuinely paired still gets its two sides.
    assert by_id["left:caudate"]["labels"] == [161]
    assert by_id["right:caudate"]["labels"] == [10161]

    # The midline one is published once, holding both of NextBrain's copies.
    assert "left:optic-chiasm" not in by_id and "right:optic-chiasm" not in by_id
    chiasm = by_id["midline:optic-chiasm"]
    assert chiasm["hemisphere"] == "midline"
    assert sorted(chiasm["labels"]) == [161, 10161]


def test_the_published_chiasm_is_one_structure_in_every_brain():
    # The count that prompted this: one brain published a right chiasm and the
    # other did not, because a 1-4 voxel sliver had been split in half.
    import yaml

    from brain_model.sources import ROOT

    definition = yaml.safe_load((ROOT / "config/learning-anatomy.yaml").read_text())
    chiasm = next(u for u in definition["nextbrain"] if u["id"] == "optic-chiasm")
    assert chiasm["hemisphere"] == "midline"


subject = pytest.mark.skipif(
    not nextbrain.is_available(read_config())
    or not (read_config()["source_directory"] / "mri/aseg.mgz").exists(),
    reason="the subject volumes are fetched by scripts/prepare_subject.py",
)


def test_the_cerebellum_is_published_as_a_body_not_only_its_deep_nuclei():
    # The overview drew the dentate and interposed nuclei with nothing around
    # them: NextBrain has no cerebellar cortex, so on this level the cerebellum
    # was two small bodies in open space. aseg has the mantle; it comes from
    # there, the way the ventricles and corpus callosum already do.
    definition = read_definition()
    claimed = {label for unit in definition["aseg"] for label in unit["labels"]}
    assert {8, 47} <= claimed


@subject
def test_no_display_unit_is_buried_inside_a_unit_from_the_other_source():
    # Why the mantle and not aseg's cerebellar white matter: the deep nuclei sit
    # inside that label, so publishing it would enclose them completely. The two
    # segmentations disagree along shared borders, which is ordinary; a unit that
    # vanishes inside another is not.
    config = read_config()
    _, labels, _ = nextbrain.load(config)
    aseg = np.asarray(load_on_grid(config, config["source_directory"] / "mri/aseg.mgz").dataobj)
    definition = read_definition()
    covered = np.isin(aseg, [label for unit in definition["aseg"] for label in unit["labels"]])
    for unit in definition["nextbrain"]:
        members = [
            label + offset
            for label in unit["labels"]
            for offset in (0, nextbrain.HEMISPHERE_OFFSET)
        ]
        mask = np.isin(labels, members)
        if not mask.any():
            continue
        assert (mask & covered).sum() / mask.sum() < 0.5, unit["id"]
