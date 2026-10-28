"""This brain's cord: SCT's segmentation with PAM50's regions registered to it."""

import nibabel as nib
import numpy as np
import pytest

from brain_model.build import build_structure_layer
from brain_model.layers import spinal_cord
from brain_model.sources import read_config
from brain_model.validate import validate_cord


@pytest.fixture(scope="module")
def published(tmp_path_factory):
    config = read_config("cdmd")
    assert spinal_cord.is_declared(config)
    config["output_directory"] = tmp_path_factory.mktemp("models")
    grid = spinal_cord.load(config)
    grid.labels.flags.writeable = False
    built, regions = build_structure_layer(
        config, grid, sorted(spinal_cord.label_table(config)),
        spinal_cord.describer(config), "spinal-cord.glb",
    )
    layer = spinal_cord.layer(config, built, regions, config["output_directory"] / built["file"])
    return config, grid, layer, {region["id"]: region for region in regions}


def centroid(grid, structure, side):
    config = read_config("cdmd")
    index = next(s for s in config["spinal_cord"]["structures"] if s["id"] == structure)["atlas"]
    label = index[0 if side == "left" else 1] + 1
    return nib.affines.apply_affine(grid.voxel_to_surface, np.argwhere(grid.labels == label)).mean(axis=0)


def test_every_pam50_region_is_published_once_on_each_side(published):
    _, _, layer, regions = published
    unresolved = set(read_config("cdmd")["spinal_cord"]["unresolved"]["atlas"])
    assert layer["region_count"] == len(regions) == spinal_cord.ATLAS_REGIONS - len(unresolved)
    assert {region["source_label_id"] for region in regions.values()} == set(range(36)) - unresolved
    assert all(region["volume_label"] == region["source_label_id"] + 1 for region in regions.values())
    assert {"pam50:left:lateral-corticospinal-tract", "pam50:right:dorsal-horn",
            "pam50:left:gracile-fasciculus"} <= set(regions)
    assert all(region["mri_registered"] and region["supplemental"] for region in regions.values())


def test_the_regions_keep_the_cord_s_anatomical_arrangement(published):
    """In surface RAS, x runs to the subject's right and y to the front."""
    _, grid, _, _ = published
    gracile = centroid(grid, "gracile-fasciculus", "left")
    corticospinal = centroid(grid, "lateral-corticospinal-tract", "left")
    ventral_horn = centroid(grid, "ventral-horn", "left")
    midline = (gracile[0] + centroid(grid, "gracile-fasciculus", "right")[0]) / 2
    # The dorsal columns lie behind the ventral horns; the lateral corticospinal
    # tract lies further from the midline than the gracile fasciculus.
    assert gracile[1] < ventral_horn[1]
    assert abs(corticospinal[0] - midline) > abs(gracile[0] - midline)
    for structure in ("gracile-fasciculus", "lateral-corticospinal-tract", "ventral-horn"):
        assert centroid(grid, structure, "left")[0] < centroid(grid, structure, "right")[0]


def test_the_published_cord_passes_validation_and_meets_sct_s_segmentation(published):
    config, _, layer, _ = published
    report = validate_cord(config, layer)
    assert report["cord_agreement"]["dice"] >= config["spinal_cord"]["minimum_cord_dice"]
    assert all(region["misclassified_voxel_centres"] == 0 for region in report["regions"])
    assert report["vertebral_levels"][0] == "C1"


def test_a_cord_short_of_the_dice_floor_is_refused(published):
    config, _, layer, _ = published
    strict = {**config, "spinal_cord": {**config["spinal_cord"], "minimum_cord_dice": 1.0}}
    with pytest.raises(ValueError, match="below 1.0"):
        validate_cord(strict, layer)


def test_a_structure_list_that_misses_a_pam50_region_is_refused():
    config = read_config("cdmd")
    structures = config["spinal_cord"]["structures"][:-1]
    with pytest.raises(ValueError, match="every resolved PAM50 region once"):
        spinal_cord.label_table({**config, "spinal_cord": {**config["spinal_cord"], "structures": structures}})


def test_a_region_s_partner_is_the_same_region_on_the_other_side():
    # PAM50 lists left (even index) before right; volume labels are index + 1.
    assert spinal_cord.partner_of(1) == 2 and spinal_cord.partner_of(2) == 1
    assert spinal_cord.partner_of(35) == 36 and spinal_cord.partner_of(36) == 35


def load_script():
    """scripts/ is not a package, so the script is loaded by path."""
    import importlib.util

    from brain_model.sources import ROOT

    spec = importlib.util.spec_from_file_location(
        "segment_spinal_cord", ROOT / "scripts/segment_spinal_cord.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_an_unresolved_region_counts_toward_the_cord_but_takes_no_voxel(tmp_path):
    segment = load_script()
    shape = (3, 1, 1)
    maps = np.zeros((*shape, spinal_cord.ATLAS_REGIONS), np.float32)
    maps[0, 0, 0, [10, 4]] = [0.4, 0.3]   # unresolved leads: goes to the runner-up, 4
    maps[1, 0, 0, [10, 4]] = [0.3, 0.1]   # cord only with the unresolved share counted
    maps[2, 0, 0, 10] = 0.2                # below the cord threshold
    affine = np.eye(4)
    nib.save(nib.Nifti1Image(np.zeros(shape, np.float32), affine), tmp_path / "grid.nii.gz")
    for index in range(spinal_cord.ATLAS_REGIONS):
        nib.save(nib.Nifti1Image(maps[..., index], affine), tmp_path / f"PAM50_atlas_{index:02d}.nii.gz")
    labels = segment.most_probable_regions(tmp_path / "grid.nii.gz", tmp_path, 0.4, [10, 11])
    assert np.asarray(labels.dataobj).ravel().tolist() == [5, 5, 0]
