import nibabel as nib
import numpy as np
import pytest

from brain_model.build import build_structure_layer
from brain_model.geometry import extract_structure, misclassified_voxels
from brain_model.validate import read_meshes, validate_structure_layer
from brain_model.volumes import LabelGrid, conformed_grid

SMOOTHING = {"iterations": 16, "maximum_displacement_mm": 0.6}
TKR = np.array([[-1.0, 0, 0, 12], [0, 0, 1, -12], [0, -1, 0, 12], [0, 0, 0, 1]])


def ball_layer(tmp_path):
    # Voxel x 18 is RAS x -6 under this affine: the left hemisphere.
    grid = np.indices((24, 24, 24)) - np.array([18.0, 12, 12])[:, None, None, None]
    volume = np.where((grid ** 2).sum(axis=0) < 20, 17, 0).astype(np.int32)
    image = nib.MGHImage(volume, TKR)
    config = {"output_directory": tmp_path, "structures": {"smoothing": SMOOTHING}}

    def describe(label):
        return {
            "id": f"aseg:left:{label}", "label": "Left Hippocampus",
            "source_name": "Left-Hippocampus", "atlas": "aseg", "hemisphere": "left",
            "source_label_id": label, "kind": "structure",
        }, [220, 216, 20]

    record, regions = build_structure_layer(
        config, conformed_grid(image), [17], describe, "structures.glb"
    )
    return volume, image.header.get_vox2ras_tkr(), record, regions


def published_ras(mesh):
    return mesh.vertices[:, [0, 2, 1]] * [1000, -1000, 1000]


def test_a_structure_is_published_as_a_bounded_smoothing_of_its_voxel_surface(tmp_path):
    volume, affine, record, regions = ball_layer(tmp_path)
    mesh = read_meshes(tmp_path / "structures.glb")["aseg:left:17"]
    reference = extract_structure(volume, 17, affine)
    displacement = np.linalg.norm(published_ras(mesh) - reference.vertices, axis=1)
    # Moved off the 1 mm staircase, but never further than the bound allows.
    assert 0.05 < displacement.max() <= 0.6 + 1e-5
    np.testing.assert_array_equal(mesh.faces, reference.faces)
    assert len(misclassified_voxels(published_ras(mesh), mesh.faces, volume == 17, affine)) == 0
    assert regions[0]["display_maximum_displacement_mm"] == pytest.approx(
        displacement.max(), abs=1e-5
    )
    assert record["display_geometry"]["maximum_displacement_mm"] == 0.6


def test_validation_reports_voxel_fidelity_and_refuses_a_surface_past_its_bound(tmp_path):
    volume, affine, _, _ = ball_layer(tmp_path)
    path = tmp_path / "structures.glb"
    report = validate_structure_layer(path, volume, affine, [17], SMOOTHING, 2e-5)
    region = report["regions"][0]
    assert region["misclassified_voxel_centres"] == 0
    assert region["maximum_display_displacement_mm"] <= 0.6 + 1e-5

    import trimesh

    from brain_model.export import write_scene

    scene = trimesh.load_scene(path, process=False)
    for geometry in scene.geometry.values():
        geometry.vertices = geometry.vertices + [0.001, 0, 0]
    write_scene(scene, path)
    with pytest.raises(ValueError, match="displacement"):
        validate_structure_layer(path, volume, affine, [17], SMOOTHING, 2e-5)


def paired_layer(tmp_path, left_x, right_x, meshed=(1, 2)):
    """Two small balls: one structure's left (1) and right (2) copies."""
    grid = np.indices((40, 12, 12)).astype(float)
    volume = np.zeros((40, 12, 12), np.int32)
    affine = np.diag([1.0, 1.0, 1.0, 1.0])
    for label, x in ((1, left_x), (2, right_x)):
        centre = np.array([x + 20, 6, 6])[:, None, None, None]
        volume[((grid - centre) ** 2).sum(axis=0) < 6] = label
    affine[0, 3] = -20
    config = {"output_directory": tmp_path, "structures": {"smoothing": SMOOTHING}}

    def describe(label):
        side = "left" if label == 1 else "right"
        return {
            "id": f"nextbrain:{side}:{label}", "label": f"periventricular nucleus · {side}",
            "source_name": "periventricular_nucleus", "atlas": "nextbrain",
            "hemisphere": side, "source_label_id": label, "kind": "structure",
        }, [220, 216, 20]

    build_structure_layer(
        config, LabelGrid(volume, affine, [1.0] * 3), list(meshed), describe, "nextbrain.glb"
    )
    return volume, affine


def partner(label):
    return {1: 2, 2: 1}[label]


def check(tmp_path, volume, affine, meshed=(1, 2)):
    validate_structure_layer(
        tmp_path / "nextbrain.glb", volume, affine, list(meshed), SMOOTHING, 2e-5, partner
    )


def test_a_midline_structure_is_judged_against_its_partner_not_against_x_zero(tmp_path):
    # Surface RAS centres the conformed volume, not the brain: a structure
    # hugging this brain's midline can sit just right of x = 0 and still be
    # the left of its pair.
    check(tmp_path, *paired_layer(tmp_path, left_x=0.5, right_x=4.0))

    swapped = paired_layer(tmp_path, left_x=4.0, right_x=0.5)
    with pytest.raises(ValueError, match="left and right copies are swapped"):
        check(tmp_path, *swapped)


def test_a_partner_too_small_to_mesh_still_places_its_pair(tmp_path):
    volume, affine = paired_layer(tmp_path, left_x=0.5, right_x=4.0, meshed=(1,))
    check(tmp_path, volume, affine, meshed=(1,))
