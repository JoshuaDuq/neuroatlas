"""NextBrain is held to the same brain's aseg, and the published scores are those."""

import json

import pytest

from brain_model.sources import read_config
from brain_model.validate_segmentation import (
    dice,
    segmentation_agreement,
    surface_holes,
)


def test_dice_counts_overlap_against_both_sizes():
    import numpy as np

    a = np.array([1, 1, 1, 0], bool)
    b = np.array([0, 1, 1, 1], bool)
    assert dice(a, b) == pytest.approx(2 * 2 / 6)
    assert dice(a, a) == 1


@pytest.mark.parametrize("anatomy", ["cdmd"])
def test_every_declared_structure_clears_the_floor_and_is_the_published_score(anatomy):
    config = read_config(anatomy)
    report = segmentation_agreement(config)
    settings = config["validation"]["segmentation_agreement"]
    assert set(report["dice"]) == set(settings["aseg_labels"])
    assert all(set(sides) == {"left", "right"} for sides in report["dice"].values())
    exceptions = config["anatomy"].get("segmentation_agreement_exceptions", {})
    for name, sides in report["dice"].items():
        for side, score in sides.items():
            assert score >= exceptions.get(name, {}).get(side, {}).get("minimum_dice", 0.8)
    published = json.loads((config["output_directory"] / "validation.json").read_text())
    assert published["segmentation_agreement"] == json.loads(json.dumps(report))


def test_a_score_below_the_floor_fails_validation():
    config = read_config()
    config["validation"]["segmentation_agreement"]["minimum_dice"] = 0.85
    with pytest.raises(ValueError, match="below Dice 0.85"):
        segmentation_agreement(config)


def test_an_anatomy_exception_lowers_only_its_own_floor():
    config = read_config("cdmd")
    assert segmentation_agreement(config)["dice"]["amygdala"]["left"] < 0.8
    config["anatomy"]["segmentation_agreement_exceptions"]["amygdala"]["left"]["minimum_dice"] = 0.78
    with pytest.raises(ValueError, match="amygdala left"):
        segmentation_agreement(config)


def test_an_exception_the_score_no_longer_needs_is_refused():
    config = read_config()
    config["anatomy"]["segmentation_agreement_exceptions"] = {"thalamus": {"left": {"minimum_dice": 0.7}}}
    with pytest.raises(ValueError, match="remove its exception"):
        segmentation_agreement(config)


def test_an_exception_for_no_score_is_refused():
    config = read_config()
    config["anatomy"]["segmentation_agreement_exceptions"] = {"pallidum": {"left": {"minimum_dice": 0.7}}}
    with pytest.raises(ValueError, match="names no score"):
        segmentation_agreement(config)


def test_a_structure_learning_does_not_define_is_refused():
    config = read_config()
    labels = config["validation"]["segmentation_agreement"]["aseg_labels"]
    labels["pallidum"] = {"left": 13, "right": 52}
    with pytest.raises(ValueError, match="learning does not define"):
        segmentation_agreement(config)


@pytest.mark.parametrize(
    "anatomy,holes",
    [("cdmd", (3, 5))],
)
def test_surface_holes_are_freesurfers_own_count_and_the_published_one(anatomy, holes):
    config = read_config(anatomy)
    report = surface_holes(config)
    left, right = holes
    assert report["surface_holes"] == {"left": left, "right": right, "total": left + right}
    published = json.loads((config["output_directory"] / "validation.json").read_text())
    assert published["reconstruction_quality"] == report


def test_hemisphere_holes_that_do_not_sum_to_the_total_are_refused(tmp_path):
    (tmp_path / "aseg.stats").write_text(
        "# Measure lhSurfaceHoles, lhSurfaceHoles, Holes, 1, unitless\n"
        "# Measure rhSurfaceHoles, rhSurfaceHoles, Holes, 2, unitless\n"
        "# Measure SurfaceHoles, SurfaceHoles, Holes, 4, unitless\n"
    )
    config = {"source_directory": tmp_path, "anatomy": {"statistics": "aseg.stats"}}
    with pytest.raises(ValueError, match="do not sum"):
        surface_holes(config)
