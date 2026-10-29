import numpy as np
import pytest

from brain_model.layers.networks import (
    ANNOTATION,
    NETWORKS,
    NONE,
    composition,
    network_indices,
    network_of,
)
from brain_model.surfaces.geometry import partition_surface, partition_vertex_labels

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


def test_a_truncated_parcel_name_is_an_error_rather_than_no_network():
    with pytest.raises(ValueError, match="parcel name"):
        network_of("7Networks_LH_Vis")


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


def test_the_published_palette_sits_within_the_configured_jitter():
    from nibabel.freesurfer.io import read_annot

    from brain_model.layers.networks import annotation_path, verify_palette
    from brain_model.sources import read_config

    config = read_config()
    jitter = config["networks"]["maximum_color_jitter"]
    for prefix in ("lh", "rh"):
        _, colors, names = read_annot(annotation_path(config["source_directory"], prefix))
        verify_palette(colors, names, jitter)
    from brain_model.layers.networks import COLORS

    parcel = next(i for i, name in enumerate(names) if network_of(name.decode()))
    red = COLORS[network_of(names[parcel].decode())][0]
    colors = colors.copy()
    colors[parcel, 0] = red + jitter + 1 if red < 128 else red - jitter - 1
    with pytest.raises(ValueError, match="jitter"):
        verify_palette(colors, names, jitter)


def test_each_seven_network_parcel_takes_its_seventeen_network_name():
    from brain_model.layers.networks import seventeen_network_names

    names = [b"Medial", b"7Networks_LH_Vis_1", b"7Networks_LH_Default_PFC_1"]
    names_17 = [b"Medial", b"17Networks_LH_DefaultA_PFCd_1", b"17Networks_LH_VisCent_ExStr_1"]
    assert seventeen_network_names([0, 1, 1, 2], names, [0, 2, 2, 1], names_17) == {
        "Medial": "Medial",
        "7Networks_LH_Vis_1": "17Networks_LH_VisCent_ExStr_1",
        "7Networks_LH_Default_PFC_1": "17Networks_LH_DefaultA_PFCd_1",
    }


@pytest.mark.parametrize(
    "labels_17",
    [
        [0, 1, 2, 2],  # a 7-network parcel split between two 17-network parcels
        [0, 1, 1, 1],  # two 7-network parcels merged into one
    ],
)
def test_orders_that_do_not_divide_the_same_parcels_are_rejected(labels_17):
    from brain_model.layers.networks import seventeen_network_names

    names = [b"Medial", b"7Networks_LH_Vis_1", b"7Networks_LH_Vis_2"]
    with pytest.raises(ValueError, match="one to one"):
        seventeen_network_names([0, 1, 2, 1], names, labels_17, names)


def test_the_published_orders_pair_every_parcel():
    from brain_model.layers.networks import published_seventeen_network_names
    from brain_model.sources import read_config

    config = read_config()
    atlas = next(a for a in config["atlases"] if "names_from" in a)
    for prefix in ("lh", "rh"):
        names = published_seventeen_network_names(config, atlas, prefix)
        assert len(names) == 201
        assert all(n.startswith("17Networks_") for k, n in names.items() if network_of(k))
