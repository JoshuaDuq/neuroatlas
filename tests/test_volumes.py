"""Lossless volume transport and registration checks."""

import gzip

import nibabel as nib
import numpy as np
import pytest

from brain_model.volumes import encode_volume, export_volumes


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
        payload = gzip.decompress((tmp_path / record["file"]).read_bytes())
        restored = np.frombuffer(payload, dtype=record["dtype"]).reshape(
            record["shape"], order="F"
        )
        image = nib.load(config["source_directory"] / "mri" / f"{source}.mgz")
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
