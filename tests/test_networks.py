import numpy as np
import pytest

from brain_model.geometry import partition_surface, partition_vertex_labels
from brain_model.networks import (
    NETWORKS,
    NONE,
    composition,
    network_indices,
    network_of,
)

MEDIAL_WALL = "Background+FreeSurfer_Defined_Medial_Wall"


@pytest.mark.parametrize(
    ("parcel", "expected"),
    [
        ("7Networks_LH_Vis_1", "Vis"),
        ("7Networks_RH_SomMot_3", "SomMot"),
        ("7Networks_LH_SalVentAttn_Med_1", "SalVentAttn"),
        # The sub-region name varies in length; only the third field is read.
        ("7Networks_LH_Default_pCunPCC_11", "Default"),
        (MEDIAL_WALL, None),
    ],
)
def test_parcel_names_carry_their_network(parcel, expected):
    assert network_of(parcel) == expected


def test_an_unknown_network_is_an_error_rather_than_a_silent_none():
    with pytest.raises(ValueError, match="Invented"):
        network_of("7Networks_LH_Invented_1")


def test_labels_become_network_indices_and_the_medial_wall_becomes_none():
    names = [MEDIAL_WALL, "7Networks_LH_Vis_1", "7Networks_LH_Default_pCunPCC_2"]
    # -1 is what FreeSurfer writes for a vertex no parcel claims.
    labels = np.array([0, 1, 2, -1])
    result = network_indices(labels, names)
    assert result.tolist() == [
        NONE,
        NETWORKS.index("Vis") + 1,
        NETWORKS.index("Default") + 1,
        NONE,
    ]


def test_labels_outside_the_name_table_are_rejected():
    with pytest.raises(ValueError, match="name table"):
        network_indices(np.array([0, 7]), [MEDIAL_WALL])


def test_composition_reports_shares_largest_first():
    vis, default = NETWORKS.index("Vis") + 1, NETWORKS.index("Default") + 1
    result = composition(np.array([vis, default, default, default]))
    assert result == [
        {"network": "Default", "fraction": 0.75},
        {"network": "Vis", "fraction": 0.25},
    ]


def test_unnetworked_vertices_leave_the_denominator_rather_than_diluting_it():
    vis = NETWORKS.index("Vis") + 1
    result = composition(np.array([vis, vis, NONE, NONE, NONE]))
    assert result == [{"network": "Vis", "fraction": 1.0}]


def test_a_region_with_no_networked_vertex_reports_nothing():
    assert composition(np.array([NONE, NONE])) == []


def test_small_shares_can_be_dropped_without_renormalising():
    vis, default = NETWORKS.index("Vis") + 1, NETWORKS.index("Default") + 1
    ids = np.array([vis] * 99 + [default])
    assert composition(ids, minimum_fraction=0.05) == [
        {"network": "Vis", "fraction": 0.99}
    ]


def test_categorical_fields_are_carried_onto_the_partition_without_averaging():
    """A mixed face adds points; averaging two network ids would invent a third."""
    vertices = np.array([[0.0, 0.0, 0.0], [4.0, 0.0, 0.0], [1.0, 3.0, 0.0]])
    faces = np.array([[0, 1, 2]])
    atlas = np.array([1, 2, 3])
    values = np.array([2, 6, 6])
    partition = partition_surface(vertices, faces, atlas)
    carried = partition_vertex_labels(faces, atlas, values)

    assert len(carried) == len(partition.vertices)
    assert carried[: len(values)].tolist() == values.tolist()
    assert set(carried.tolist()) <= set(values.tolist())


def test_a_two_vertex_tie_goes_to_the_lower_value_and_a_majority_wins():
    faces = np.array([[0, 1, 2]])
    atlas = np.array([1, 2, 3])
    carried = partition_vertex_labels(faces, atlas, np.array([5, 9, 9]))
    added = carried[len(atlas) :]
    # Three edge midpoints then the centroid: 5|9 ties to 5, 9|9 keeps 9, and
    # the centroid has a two-thirds majority for 9.
    assert sorted(added[:-1].tolist()) == [5, 5, 9]
    assert added[-1] == 9


def test_a_categorical_field_must_be_integers():
    with pytest.raises(ValueError, match="integers"):
        partition_vertex_labels(
            np.array([[0, 1, 2]]), np.array([1, 2, 3]), np.array([0.5, 0.5, 0.5])
        )
