import json

import nibabel as nib
import numpy as np
import pytest

from brain_model.labels import boundary_certainty, nextbrain
from brain_model.labels.volumes import LabelGrid
from brain_model.sources import ROOT, read_config

RIGHT = nextbrain.HEMISPHERE_OFFSET


def slab(*labels):
    """Labels in slabs four voxels thick along x, each 3 x 3 voxels across."""
    return np.repeat(np.array(labels, np.int64), 4)[:, None, None] * np.ones((1, 3, 3), np.int64)


def test_an_interface_counts_the_voxels_on_both_sides_once_each():
    labels = slab(7, 8)
    near_ties = np.zeros_like(labels)
    # Three voxels of 7 on the face nearly went to 8; one nearly went to 9.
    near_ties[3, 0, :] = 8
    near_ties[3, 1, 0] = 9
    rated = boundary_certainty.rate(labels, near_ties, minimum=1)
    # Each side of the face is 3 x 3 voxels.
    assert rated == [[7, 8, 18, 3]]


def test_a_near_tie_against_a_label_outside_the_pair_is_not_this_pairs():
    labels = slab(7, 8, 9)
    near_ties = np.zeros_like(labels)
    near_ties[4, :, :] = 9  # the 8s facing 7 nearly went to 9, the 8s facing 9 did not
    near_ties[7, :, :] = 9
    rated = {(a, b): ties for a, b, _, ties in boundary_certainty.rate(labels, near_ties, 1)}
    assert rated == {(7, 8): 0, (8, 9): 9}


def test_boundaries_across_the_midline_and_below_the_minimum_are_not_rated():
    labels = slab(7, 8, 8 + RIGHT)
    labels[0, 0, 0] = 9  # a corner voxel: its interface with 7 is four voxels
    rated = boundary_certainty.rate(labels, np.zeros_like(labels), minimum=5)
    assert [pair[:2] for pair in rated] == [[7, 8]]


def test_the_recount_agrees_with_the_rating_on_any_volume():
    """Two formulations of one count, so the validation does not share the build's code."""
    rng = np.random.default_rng(0)
    labels = rng.choice([0, 3, 4, 5, 3 + RIGHT, 4 + RIGHT], size=(9, 8, 7))
    near_ties = np.where(rng.random(labels.shape) < 0.4, rng.choice([3, 4, 5], labels.shape), 0)
    near_ties = np.where(labels > RIGHT, near_ties + RIGHT, near_ties)
    near_ties[(labels == 0) | (near_ties % RIGHT == labels % RIGHT)] = 0

    counts, _, _ = boundary_certainty.recount(labels, near_ties)
    rated = boundary_certainty.rate(labels, near_ties, minimum=1)
    # Every same-hemisphere pair touches somewhere and nearly tied somewhere.
    assert len(rated) == 4 and all(ties for *_, ties in rated)
    assert {(a, b): (size, ties) for a, b, size, ties in rated} == counts


@pytest.fixture
def config(tmp_path):
    config = read_config()
    config["nextbrain"] = {**config["nextbrain"], "directory": tmp_path, "near_ties": "ties.mgz"}
    return config


def place(config, near_ties, labels):
    """A label grid and its near-tie volume, both on one 1 mm grid."""
    grid = np.eye(4)
    nib.save(
        nib.MGHImage(near_ties.astype(np.int32), np.linalg.inv(nextbrain.scanner_to_surface(config)) @ grid),
        boundary_certainty.path(config),
    )
    return LabelGrid(labels, grid, [1.0] * 3)


@pytest.mark.parametrize(
    ("winner", "runner", "message"),
    [(0, 8, "unlabelled voxel"), (7, 7, "its own winner"), (7, 8 + RIGHT, "crosses the midline")],
)
def test_a_near_tie_that_could_not_come_from_one_hemispheres_posteriors_is_refused(
    config, winner, runner, message
):
    labels = slab(7, 8)
    near_ties = np.zeros_like(labels)
    labels[0, 0, 0], near_ties[0, 0, 0] = winner, runner
    with pytest.raises(ValueError, match=message):
        boundary_certainty.load(config, place(config, near_ties, labels))


def test_a_near_tie_volume_off_the_label_grid_is_refused(config):
    labels = slab(7, 8)
    grid = place(config, np.zeros_like(labels), labels)
    shifted = grid.voxel_to_surface.copy()
    shifted[0, 3] = 0.4
    with pytest.raises(ValueError, match="not on its label grid"):
        boundary_certainty.load(config, grid._replace(voxel_to_surface=shifted))


def test_a_volume_made_with_another_margin_is_refused(config):
    config["nextbrain"]["directory"] = ROOT / "data/nextbrain-cdmd"
    relative = str(boundary_certainty.path(config).relative_to(ROOT))
    provenance = {"sources": [{"path": relative, "near_ties": {"margin": 0.1}}]}
    with pytest.raises(ValueError, match="0.1 margin"):
        boundary_certainty.verify_margin(config, provenance)
    provenance["sources"][0]["near_ties"]["margin"] = config["nextbrain"]["near_tie_margin"]
    boundary_certainty.verify_margin(config, provenance)


@pytest.fixture(scope="module")
def published(tmp_path_factory):
    """This brain's boundary certainty, exported once for the tests that read it."""
    config = read_config()
    config["output_directory"] = tmp_path_factory.mktemp("models")
    source = nextbrain.load(config)
    regions = nextbrain.build_regions(config)
    manifest = {
        "regions": regions,
        "boundary_certainty": boundary_certainty.export(config, regions),
    }
    return config, source, manifest


def test_this_brains_ratings_match_their_recount(published):
    config, source, manifest = published
    report = boundary_certainty.validate(config, manifest, source)
    assert report["rated_pairs"] > 1000
    # Rated pairs hold nearly every interface; the minimum drops slivers only.
    assert report["share_of_interface_voxels_rated"] > 0.98
    # Near ties are a boundary phenomenon: almost all are against a neighbour.
    assert report["share_of_near_ties_against_a_face_neighbour"] > 0.9


def test_validation_refuses_a_rating_that_differs_from_the_recount(published, tmp_path):
    config, source, manifest = published
    path = config["output_directory"] / boundary_certainty.FILENAME
    document = json.loads(path.read_text())
    document["pairs"][0][3] += 1
    (tmp_path / boundary_certainty.FILENAME).write_text(json.dumps(document))
    with pytest.raises(ValueError, match="differs from a recount"):
        boundary_certainty.validate({**config, "output_directory": tmp_path}, manifest, source)
