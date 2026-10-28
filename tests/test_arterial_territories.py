import copy
import json

import numpy as np
import pytest
import yaml

from brain_model.layers import arterial_territories as territories
from brain_model.sources import ROOT, read_config


def definition():
    return territories.read_definition()


def write_definition(path, change):
    document = copy.deepcopy(yaml.safe_load(territories.DEFINITION.read_text()))
    change(document)
    path.write_text(yaml.safe_dump(document, allow_unicode=True))
    return path


def published():
    return json.loads((ROOT / "public/models/cdmd/manifest.json").read_text())


def test_a_branch_must_be_an_odd_left_value_and_the_next_even_right_one(tmp_path):
    def swap(document):
        document["territories"][0]["values"] = [2, 1]
    with pytest.raises(ValueError, match="odd left value"):
        territories.read_definition(write_definition(tmp_path / "d.yaml", swap))

    def drop(document):
        document["territories"].pop()
    with pytest.raises(ValueError, match="cover the atlas's labels once each"):
        territories.read_definition(write_definition(tmp_path / "d.yaml", drop))


def test_ventricles_and_background_carry_no_territory_index():
    lookup = territories.index_of_value(definition())
    assert lookup[0] == 0 and lookup[31] == 0 and lookup[32] == 0
    assert lookup[1] == lookup[2] == 1
    assert lookup[29] == lookup[30] == len(definition()["territories"])


def test_the_checks_score_this_brain_and_a_shifted_atlas_fails_acceptance():
    aseg = np.zeros((6, 4, 4), np.int32)
    aseg[0:3] = 3                      # left cerebral cortex
    aseg[3:6] = 42                     # right cerebral cortex
    aseg[1, 1:3, 1:3] = 4              # left ventricle
    aseg[4, 1:3, 1:3] = 43             # right ventricle
    aseg[0, 0, 0] = 8                  # left cerebellar cortex
    good = np.where(aseg == 3, 7, np.where(aseg == 42, 8, 0)).astype(np.int16)
    good[aseg == 4] = 31
    good[aseg == 43] = 32
    good[aseg == 8] = 27
    measured = territories.checks(good, aseg, definition())
    assert measured["ventricle_dice"] == {"left": 1.0, "right": 1.0}
    assert measured["hemisphere_agreement"] == 1.0 and measured["cerebral_tissue_unassigned"] == 0.0
    assert measured["cerebellar_cortex_in_cerebellar_territories"] == 1.0
    territories.accept(measured, definition())
    shifted = np.roll(good, 3, axis=0)
    with pytest.raises(ValueError, match="fail acceptance"):
        territories.accept(territories.checks(shifted, aseg, definition()), definition())
    aseg[aseg == 8] = 3
    with pytest.raises(ValueError, match="no cerebellar cortex"):
        territories.checks(good, aseg, definition())


def test_grid_counts_follow_each_grid_into_the_territory_volume():
    index = np.zeros((6, 4, 4), np.uint8)
    index[4:, :, :] = 3
    labels = np.zeros((2, 2, 2), np.int64)
    labels[0] = 5
    labels[1] = 6
    # Label voxels are 2 mm wide; the territory grid sits 2 mm along x from surface RAS.
    # In the wrong order (voxel_to_surface @ surface_to_voxel) label 5 would land at x 4, in
    # territory 3, and label 6 at x 6, off the grid.
    voxel_to_surface = np.diag([2.0, 2.0, 2.0, 1.0])
    surface_to_voxel = np.eye(4)
    surface_to_voxel[0, 3] = 2.0
    counts = territories.grid_counts(labels, voxel_to_surface, index, surface_to_voxel)
    assert counts[5].tolist() == [4, 0, 0, 0]
    assert counts[6].tolist() == [0, 0, 0, 4]


def test_a_composition_counts_the_unassigned_share_rather_than_inferring_it():
    counts = np.zeros(len(definition()["territories"]) + 1, np.int64)
    counts[[0, 1, 3, 5]] = [10, 800, 185, 5]
    assert territories.composition_of_counts(counts, definition()) == {
        "territories": [
            {"territory": "aca", "fraction": 0.8},
            {"territory": "lateral-lenticulostriate", "fraction": 0.185},
        ],
        # The 0.5% sliver is left out of the shares but is not unassigned.
        "territory_unassigned": 0.01,
    }
    only_none = np.zeros_like(counts)
    only_none[0] = 7
    assert territories.composition_of_counts(only_none, definition()) is None


def test_the_published_deep_structures_fall_in_their_textbook_territories():
    regions = {region["id"]: region for region in published()["regions"]}
    top = {rid: regions[rid]["territories"][0]["territory"] for rid in (
        "aseg:left:12", "aseg:right:51", "learning:left:thalamus", "aseg:left:17")}
    assert top == {
        "aseg:left:12": "lateral-lenticulostriate",
        "aseg:right:51": "lateral-lenticulostriate",
        "learning:left:thalamus": "posterior-choroidal-thalamoperforating",
        "aseg:left:17": "anterior-choroidal-thalamoperforating",
    }
    # A cerebellar hemisphere is supplied by the cerebellar arteries.
    cerebellum = regions["aseg:left:8"]["territories"]
    assert sum(s["fraction"] for s in cerebellum if s["territory"].endswith("cerebellar")) > 0.95
    assert not any(region.get("territories") for region in regions.values() if region["kind"] == "non-region")
    # Fluid spaces have no artery.
    for fluid in ("aseg:left:4", "aseg:midline:14", "learning:ventricles-left", "learning:fourth-ventricle"):
        assert "territories" not in regions[fluid], fluid
    # The teaching set's caudal medulla is aseg's brainstem clipped below NextBrain's medulla,
    # so its shares are its own and reach no thalamic territory.
    medulla = regions["learning:caudal-medulla"]["territories"]
    assert medulla != regions["aseg:midline:16"]["territories"]
    assert not any(s["territory"].endswith("thalamoperforating") for s in medulla)


def test_every_territory_region_is_on_its_own_side_and_in_the_cut_labels():
    manifest = published()
    tissues = json.loads((ROOT / "public/models/cdmd/tissue-labels.json").read_text())
    regions = [region for region in manifest["regions"] if region["atlas"] == territories.ATLAS_ID]
    assert len(regions) == 2 * len(definition()["territories"])
    assert all(region["source_label_id"] % 2 == (1 if region["hemisphere"] == "left" else 0) for region in regions)
    cut = {label["region_id"] for label in tissues["atlases"][territories.ATLAS_ID]["labels"]}
    assert {region["id"] for region in regions} <= cut
    assert territories.build_regions(read_config("cdmd"), definition()) == regions


def test_a_name_cut_at_a_comma_is_refused_rather_than_published(tmp_path):
    def cut(document):
        document["territories"][3]["name"] = "Middle cerebral artery"
        document["territories"][3]["frontal"] = None
    with pytest.raises(ValueError, match="mca-frontal has keys"):
        territories.read_definition(write_definition(tmp_path / "d.yaml", cut))
    assert definition()["territories"][3]["name"] == "Middle cerebral artery, frontal"
