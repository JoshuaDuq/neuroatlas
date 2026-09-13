"""Cortical ribbon wedges must close, or a cut's stencil leaks through them."""

import numpy as np
import pytest
from nibabel.freesurfer.io import read_annot, read_geometry

from brain_model.build import cortical_region
from brain_model.ribbons import (
    export_ribbon_labels,
    triangle_owners,
    validate_ribbon_labels,
    wedge_defects,
)
from brain_model.sources import HEMISPHERES, read_config

SQUARE = np.array([[0, 1, 2], [0, 2, 3]])


def test_a_uniform_patch_closes_into_one_wedge():
    defects = wedge_defects(SQUARE, np.array([5, 5, 5, 5]))
    assert defects == {"wedges": 1, "holes": 0, "pinches": 0}


def test_majority_vote_splits_triangles_without_opening_either_wedge():
    defects = wedge_defects(SQUARE, np.array([5, 5, 9, 9]))
    assert defects == {"wedges": 2, "holes": 0, "pinches": 0}


def test_a_three_way_triangle_falls_to_the_lowest_label():
    np.testing.assert_array_equal(
        triangle_owners(np.array([[0, 1, 2]]), np.array([8, 2, 5])), [2]
    )


def test_a_two_vertex_majority_wins_over_the_lower_single():
    np.testing.assert_array_equal(
        triangle_owners(np.array([[0, 1, 2]]), np.array([2, 7, 7])), [7]
    )


@pytest.mark.parametrize("prefix", ["lh", "rh"])
def test_every_published_atlas_closes_every_ribbon_wedge(prefix):
    """The invariant the viewer relies on, checked against the real surfaces."""
    config = read_config()
    source = config["source_directory"]
    _, faces = read_geometry(source / "surf" / f"{prefix}.pial")
    for atlas in config["atlases"]:
        labels, _, _ = read_annot(
            source / "label" / f"{prefix}.{atlas['annotation']}.annot"
        )
        defects = wedge_defects(faces, labels.astype(np.int64))
        assert defects["holes"] == 0, f"{atlas['id']} {prefix} leaks"
        assert defects["wedges"] > 1


def cortical_regions(config, atlas):
    """The records build publishes for this atlas, built the way build builds them."""
    regions = []
    for prefix, hemisphere in HEMISPHERES.items():
        labels, _, names = read_annot(
            config["source_directory"] / "label" / f"{prefix}.{atlas['annotation']}.annot"
        )
        for label in np.unique(labels):
            name = "Unknown" if label == -1 else names[label].decode()
            regions.append(cortical_region(atlas["id"], hemisphere, label, name))
    return regions


def test_exported_labels_round_trip_through_validation(tmp_path):
    config = read_config()
    config["output_directory"] = tmp_path
    atlas = config["atlases"][0]
    record = export_ribbon_labels(config, atlas, cortical_regions(config, atlas))
    report = validate_ribbon_labels(config, atlas, record)
    assert report["holes"] == 0
    assert report["vertex_count"] == sum(record["vertex_counts"].values())
    labels = np.fromfile(tmp_path / record["file"], dtype="<u2")
    assert len(labels) == report["vertex_count"]
    assert labels.max() < len(record["region_ids"])
    assert record["region_ids"][labels[0]].startswith(f"{atlas['id']}:left:")
