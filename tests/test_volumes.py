"""Lossless volume transport and registration checks."""

import gzip

import nibabel as nib
import numpy as np
import pytest

from brain_model.labels.volumes import (
    encode_volume,
    export_volumes,
    load_on_grid,
    validate_same_grid,
)
from tests.support import read_published


@pytest.fixture
def small_subject(tmp_path):
    directory = tmp_path / "subject" / "mri"
    directory.mkdir(parents=True)
    voxels = np.arange(60, dtype=np.uint8).reshape(3, 4, 5)
    nib.save(nib.MGHImage(voxels, np.eye(4)), directory / "orig.mgz")
    nib.save(
        nib.MGHImage(np.ones(voxels.shape, dtype=np.int32), np.eye(4)),
        directory / "aseg.mgz",
    )
    return {
        "source_directory": directory.parent,
        "output_directory": tmp_path / "published",
        "sections": {},
        "anatomy": {"individual": True},
    }


def write_changed_grid(path, mismatch):
    shape = (3, 4, 5)
    affine = np.eye(4)
    if mismatch == "translation":
        affine[0, 3] = 25
    elif mismatch == "orientation":
        affine[0, 0] = -1
    elif mismatch == "shape":
        shape = (4, 4, 5)
    elif mismatch == "frame_count":
        shape = (3, 4, 5, 2)
    nib.save(nib.MGHImage(np.ones(shape, dtype=np.uint8), affine), path)


@pytest.mark.parametrize(
    "mismatch", ["translation", "orientation", "shape", "frame_count"]
)
def test_load_on_grid_rejects_a_different_native_grid(small_subject, mismatch):
    path = small_subject["source_directory"] / "mri/orig.mgz"
    write_changed_grid(path, mismatch)
    with pytest.raises(ValueError, match="grid"):
        load_on_grid(small_subject, path)


def test_load_on_grid_accepts_matching_images_without_changing_voxels(small_subject):
    path = small_subject["source_directory"] / "mri/orig.mgz"
    image = load_on_grid(small_subject, path)
    np.testing.assert_array_equal(
        np.asarray(image.dataobj), np.arange(60, dtype=np.uint8).reshape(3, 4, 5)
    )
    np.testing.assert_array_equal(image.affine, np.eye(4))


@pytest.mark.parametrize(
    "mismatch", ["translation", "orientation", "shape", "frame_count"]
)
def test_export_rejects_a_different_native_grid_before_writing(small_subject, mismatch):
    path = small_subject["source_directory"] / "mri/orig.mgz"
    write_changed_grid(path, mismatch)
    with pytest.raises(ValueError, match="grid"):
        export_volumes(small_subject)
    assert not small_subject["output_directory"].exists()


def test_export_preserves_matching_native_grids(small_subject):
    records = export_volumes(small_subject)
    for name, filename in [("mri", "orig"), ("segmentation", "aseg")]:
        image = nib.load(small_subject["source_directory"] / "mri" / f"{filename}.mgz")
        record = records[name]
        restored = read_published(
            record, small_subject["output_directory"] / record["file"], image.shape
        )
        np.testing.assert_array_equal(restored, np.asarray(image.dataobj))


def test_grid_validation_checks_tkregister_even_with_matching_image_affines():
    voxels = np.zeros((3, 4, 5), dtype=np.int32)
    reference = nib.MGHImage(voxels, np.eye(4))
    image = nib.MGHImage(voxels, np.eye(4))
    image.header.set_zooms((2, 1, 1))
    np.testing.assert_array_equal(image.affine, reference.affine)
    with pytest.raises(ValueError, match="tkregister"):
        validate_same_grid(image, reference)


def test_preserves_every_voxel_and_records_tkregister_affine(tmp_path):
    voxels = np.arange(60, dtype=np.uint8).reshape(3, 4, 5)
    image = nib.MGHImage(voxels, np.eye(4))
    record = encode_volume(image, tmp_path / "mri.bin.gz", np.dtype("uint8"))
    restored = np.frombuffer(
        gzip.decompress((tmp_path / "mri.bin.gz").read_bytes()), dtype="uint8"
    )
    np.testing.assert_array_equal(restored.reshape((3, 4, 5), order="F"), voxels)
    np.testing.assert_array_equal(
        record["voxel_to_surface_ras_mm"], image.header.get_vox2ras_tkr()
    )
    assert record["shape"] == [3, 4, 5]
    assert record["order"] == "F"


def test_segmentation_cannot_be_silently_truncated(tmp_path):
    image = nib.MGHImage(np.array([[[1.5]]], dtype=np.float32), np.eye(4))
    with pytest.raises(ValueError, match="lossless"):
        encode_volume(image, tmp_path / "labels.bin.gz", np.dtype("<u2"))


def test_actual_source_round_trip(tmp_path):
    from brain_model.sources import read_config

    config = read_config()
    config["output_directory"] = tmp_path
    records = export_volumes(config)
    for name, source in [("mri", "orig"), ("segmentation", "aseg")]:
        record = records[name]
        image = nib.load(config["source_directory"] / "mri" / f"{source}.mgz")
        # A label grid is published cropped to what it labels, so reading it
        # back means placing it where its affine says it came from.
        restored = read_published(record, tmp_path / record["file"], image.shape)
        np.testing.assert_array_equal(restored, np.asarray(image.dataobj))


def test_validation_rejects_an_affine_shift_even_when_payload_is_intact(tmp_path):
    import json

    from brain_model.sources import read_config
    from brain_model.validate_volumes import validate_volumes

    config = read_config()
    config["output_directory"] = tmp_path
    export_volumes(config)
    assert validate_volumes(config)["mri"]["identical_voxels"] is True
    path = tmp_path / "volumes.json"
    metadata = json.loads(path.read_text())
    metadata["mri"]["voxel_to_surface_ras_mm"][0][3] += 1
    path.write_text(json.dumps(metadata))
    with pytest.raises(ValueError, match="affine"):
        validate_volumes(config)


def displayed_signal(config):
    mri = np.asarray(nib.load(config["source_directory"] / "mri/orig.mgz").dataobj)
    labels = np.asarray(nib.load(config["source_directory"] / "mri/aseg.mgz").dataobj)
    return mri[labels != 0]


def published_window(anatomy, output):
    from brain_model.sources import read_config

    config = read_config(anatomy)
    config["output_directory"] = output
    return config, export_volumes(config)["display"]


@pytest.mark.parametrize("anatomy", ["cdmd"])
def test_published_window_does_not_clip_the_measured_signal(anatomy, tmp_path):
    config, display = published_window(anatomy, tmp_path)
    high = display["window_center"] + display["window_width"] / 2
    assert (displayed_signal(config) >= high).mean() < 0.005


@pytest.mark.parametrize("anatomy", ["cdmd"])
def test_published_window_maps_signal_to_grey_proportionally(anatomy, tmp_path):
    # Floor at zero, so a tissue twice as bright on T1 is twice as bright on
    # screen. A raised floor would add an offset and break that on every
    # surface and cut face at once.
    _, display = published_window(anatomy, tmp_path)
    assert display["window_center"] - display["window_width"] / 2 == 0


def test_window_follows_the_subject_rather_than_the_configuration(tmp_path):
    # orig.mgz is not intensity normalised, so one constant cannot serve two scans.
    _, template = published_window("fsaverage", tmp_path / "fsaverage")
    _, cdmd = published_window("cdmd", tmp_path / "cdmd")
    assert template["window_width"] != cdmd["window_width"]
