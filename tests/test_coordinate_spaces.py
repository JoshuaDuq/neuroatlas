import copy
import gzip
import json

import nibabel as nib
import numpy as np
import pytest
import yaml

from brain_model.layers import coordinate_spaces as spaces
from brain_model.sources import ROOT


def write_definition(path, change):
    document = copy.deepcopy(yaml.safe_load(spaces.DEFINITION.read_text()))
    change(document)
    path.write_text(yaml.safe_dump(document, allow_unicode=True))
    return path


def published():
    return json.loads((ROOT / "public/models/cdmd/manifest.json").read_text())


def test_a_misparsed_or_repeated_space_is_refused(tmp_path):
    def stray(document):
        document["spaces"][0]["extra"] = "cut at a comma"
    with pytest.raises(ValueError, match="has keys"):
        spaces.read_definition(write_definition(tmp_path / "d.yaml", stray))

    def repeat(document):
        document["alternatives"][0]["id"] = document["spaces"][0]["id"]
    with pytest.raises(ValueError, match="listed twice"):
        spaces.read_definition(write_definition(tmp_path / "d.yaml", repeat))


def segmentation():
    """Two hemispheres, each with every checked deep structure and cortex, on a small grid."""
    values = np.zeros((16, 4, 4), np.int32)
    for offset, (side, cortex) in enumerate(((0, 3), (1, 42))):
        block = values[offset * 8:(offset + 1) * 8]
        block[...] = cortex
        for row, pair in enumerate(spaces.SUBCORTICAL.values()):
            block[row, 1:3, 1:3] = pair[side]
    return values


def test_the_checks_pass_a_matching_template_and_a_mirrored_one_fails():
    aseg = segmentation()
    near = np.full(100, 0.1)
    measured = spaces.checks(aseg.copy(), aseg, near)
    assert measured["hemisphere_agreement"] == 1.0 and measured["cortex_dice"] == 1.0
    assert set(measured["subcortical_dice"].values()) == {1.0}
    limits = spaces.read_definition()["acceptance"]
    assert spaces.registration_failures(measured, limits) == []
    mirrored = spaces.checks(aseg[::-1].copy(), aseg, near)
    failures = spaces.registration_failures(mirrored, limits)
    assert any("hemisphere" in failure for failure in failures)
    assert any("thalamus-left Dice" in failure for failure in failures)


def test_a_drifting_round_trip_fails():
    aseg = segmentation()
    measured = spaces.checks(aseg.copy(), aseg, np.full(100, 2.0))
    assert spaces.registration_failures(measured, spaces.read_definition()["acceptance"]) == [
        "round trip median 2.0 mm", "round trip p95 2.0 mm"]


def test_a_structure_missing_from_either_side_is_refused_rather_than_scored():
    aseg = segmentation()
    carried = aseg.copy()
    carried[carried == 18] = 3
    with pytest.raises(ValueError, match="carried template has no amygdala"):
        spaces.checks(carried, aseg, np.zeros(1))


def test_an_alternative_far_from_a_published_reading_is_not_covered():
    limits = spaces.read_definition()["acceptance"]
    near = {"cortex_offset_mm": {"median": 1.5, "p95": 3.0}, "sphere_overlap": {"median": 0.9}}
    far = {"cortex_offset_mm": {"median": 2.5, "p95": 6.0}, "sphere_overlap": {"median": 0.7}}
    assert spaces.offset_failures({"a": near}, limits) == []
    assert len(spaces.offset_failures({"a": near, "b": far}, limits)) == 3


def test_the_field_maps_points_trilinearly_and_refuses_beyond_the_brain():
    node_to_template = np.diag([2.0, 2.0, 2.0, 1.0])
    node_to_template[:3, 3] = [-4, -4, -4]
    nodes = nib.affines.apply_affine(node_to_template, np.indices((5, 5, 5)).reshape(3, -1).T)
    # A displacement that is linear in position, which trilinear interpolation reproduces exactly.
    displacement = (0.5 * nodes + [1.0, -2.0, 3.0]).reshape(5, 5, 5, 3)
    valid = np.ones((5, 5, 5), bool)
    valid[4] = False
    field = spaces.encode_field(displacement, valid)
    points = np.array([[0.3, -1.7, 2.9], [-3.0, 3.5, 0.0]])
    mapped = spaces.map_points(field, node_to_template, points)
    np.testing.assert_allclose(mapped, points + 0.5 * points + [1.0, -2.0, 3.0], atol=spaces.UNIT_MM)
    outside = spaces.map_points(field, node_to_template, np.array([[2.5, 0, 0], [9.0, 0, 0]]))
    assert np.isnan(outside).all()


def test_a_displacement_beyond_the_int16_range_is_refused():
    with pytest.raises(ValueError, match="int16 range"):
        spaces.encode_field(np.full((1, 1, 1, 3), 400.0), np.ones((1, 1, 1), bool))


def test_the_grid_covers_the_brain_with_its_margin_even_past_the_image_edge():
    # A brain that reaches its image's border, as SPM12's maps do.
    mask = np.zeros((20, 20, 20), np.uint8)
    mask[8:12, 8:12, 0:4] = 1
    image = nib.Nifti1Image(mask, np.eye(4))
    node_to_template, _, valid = spaces.grid_nodes(image, 2, 4)
    nodes = nib.affines.apply_affine(node_to_template, np.argwhere(valid))
    brain = np.argwhere(mask).astype(float)
    distance = np.min(np.linalg.norm(nodes[:, None] - brain[None], axis=2), axis=1)
    assert distance.max() < 4
    # Nodes below the image (z < 0) closer than the margin are kept, diagonal ones included.
    assert nodes[:, 2].min() == -2
    corner = nodes[(nodes[:, 2] == -2) & (nodes[:, 0] == 6)]
    assert len(corner)


def test_the_published_field_decodes_to_the_committed_one_and_places_the_origin_inside_the_brain():
    from brain_model.sources import read_config

    config = read_config("cdmd")
    record = published()["coordinate_spaces"]["spaces"][0]
    space = spaces.read_definition()["spaces"][0]
    field, node_to_template = spaces.load_field(config, space)
    payload = gzip.decompress((ROOT / "public/models/cdmd" / record["field"]["file"]).read_bytes())
    decoded = np.frombuffer(payload, "<i2").reshape((3, *record["field"]["shape"]), order="F")
    assert np.array_equal(np.moveaxis(decoded, 0, 3), field)
    # MNI (0, 0, 0) lies near the anterior commissure: deep, between the hemispheres, inside this brain.
    aseg = nib.load(config["source_directory"] / "mri/aseg.mgz")
    origin = spaces.map_points(field, node_to_template, np.zeros((1, 3)))[0]
    voxel = np.rint(np.linalg.solve(aseg.header.get_vox2ras_tkr(), [*origin, 1])[:3]).astype(int)
    assert np.asarray(aseg.dataobj)[tuple(voxel)] != 0
    assert abs(origin[0]) < 5
