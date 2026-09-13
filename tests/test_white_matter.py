import gzip
import hashlib
import json

import nibabel as nib
import numpy as np
import pytest

from brain_model import white_matter
from brain_model.sources import read_config
from brain_model.tissue_labels import export_tissue_labels
from brain_model.validate import validate_cut_only_regions


def subject(tmp_path, labels, voxel_mm=1.0):
    """A minimal recon: an aseg that fixes the grid and a wmparc to read."""
    mri = tmp_path / "mri"
    mri.mkdir()
    nib.save(
        nib.MGHImage(np.zeros(labels.shape, np.int32), np.eye(4)), mri / "aseg.mgz"
    )
    grid = np.diag([voxel_mm, voxel_mm, voxel_mm, 1.0])
    nib.save(nib.MGHImage(labels.astype(np.int32), grid), mri / "wmparc.mgz")
    return {
        "source_directory": tmp_path,
        "output_directory": tmp_path / "out",
        "atlases": [{"id": "destrieux"}, {"id": "hcp-mmp"}],
    }


def small_recon():
    labels = np.zeros((5, 4, 3), np.int32)
    labels[0, 0, 0] = 2  # Left-Cerebral-White-Matter
    labels[1, 1, 1] = labels[2, 1, 1] = 3024  # wm-lh-precentral
    labels[3, 2, 2] = 4035  # wm-rh-insula
    labels[2, 2, 0] = 1024  # ctx-lh-precentral
    labels[4, 3, 2] = 5001  # Left-UnsegmentedWhiteMatter
    return labels


def decode(config, record):
    payload = gzip.decompress(
        (config["output_directory"] / record["file"]).read_bytes()
    )
    return np.frombuffer(payload, dtype=record["dtype"]).reshape(
        record["shape"], order="F"
    )


def test_only_gyral_parcels_become_regions(tmp_path):
    config = subject(tmp_path, small_recon())
    regions = white_matter.build_regions(config)

    assert [region["id"] for region in regions] == [
        "wmparc:left:3024",
        "wmparc:right:4035",
    ]
    precentral, insula = regions
    assert precentral["source_name"] == "precentral"
    assert precentral["source_published_name"] == "wm-lh-precentral"
    assert (insula["hemisphere"], insula["source_name"]) == ("right", "insula")
    assert precentral["kind"] == "tissue-region"
    assert precentral["cut_atlases"] == ["destrieux", "hcp-mmp"]
    assert (precentral["voxel_count"], precentral["segmentation_volume_mm3"]) == (
        2,
        2.0,
    )
    assert (insula["voxel_count"], insula["segmentation_volume_mm3"]) == (1, 1.0)


def test_published_codes_decode_to_the_parcels_inside_their_bounding_box(tmp_path):
    config = subject(tmp_path, small_recon())
    record = white_matter.export_volume(config, white_matter.build_regions(config))

    ids = np.array([label["source_label_id"] for label in record["labels"]])
    expected = np.zeros((3, 2, 2), np.int64)
    expected[0, 0, 0] = expected[1, 0, 0] = 3024
    expected[2, 1, 1] = 4035
    np.testing.assert_array_equal(ids[decode(config, record)], expected)
    assert record["labels"][1]["region_id"] == "wmparc:left:3024"
    assert record["applies_to"] == ["destrieux", "hcp-mmp"]

    # Crop voxel (0, 0, 0) is source voxel (1, 1, 1) of a 5x4x3 1 mm tkregister grid.
    corner = nib.affines.apply_affine(record["voxel_to_surface_ras_mm"], [0, 0, 0])
    np.testing.assert_allclose(corner, [1.5, -0.5, 1.0])


def test_a_parcel_without_a_published_region_fails_the_export(tmp_path):
    config = subject(tmp_path, small_recon())
    regions = white_matter.build_regions(config)[:1]
    with pytest.raises(ValueError, match="wmparc:right:4035"):
        white_matter.export_volume(config, regions)


def test_more_parcels_than_a_byte_can_code_are_refused(tmp_path):
    labels = (3001 + np.arange(256, dtype=np.int32)).reshape(256, 1, 1)
    config = subject(tmp_path, labels)
    regions = [
        {
            "id": white_matter.region_id_of(int(label)),
            "atlas": "wmparc",
            "source_label_id": int(label),
        }
        for label in labels.ravel()
    ]
    with pytest.raises(ValueError, match="uint8"):
        white_matter.export_volume(config, regions)


def test_a_wmparc_off_the_subject_grid_is_refused(tmp_path):
    config = subject(tmp_path, small_recon(), voxel_mm=2.0)
    with pytest.raises(ValueError, match="not registered"):
        white_matter.build_regions(config)


def test_a_recon_without_wmparc_has_no_layer(tmp_path):
    config = subject(tmp_path, small_recon())
    (tmp_path / "mri" / "wmparc.mgz").unlink()
    assert white_matter.is_available(config) is False
    assert white_matter.limitations(config) == []


def test_validation_catches_a_region_that_no_longer_matches_the_source(tmp_path):
    config = subject(tmp_path, small_recon())
    regions = {region["id"]: region for region in white_matter.build_regions(config)}
    white_matter.validate_regions(config, regions)

    regions["wmparc:left:3024"]["voxel_count"] = 3
    with pytest.raises(ValueError, match="wmparc:left:3024"):
        white_matter.validate_regions(config, regions)


def test_validation_decodes_the_voxels_rather_than_trusting_the_checksums(tmp_path):
    config = subject(tmp_path, small_recon())
    regions = white_matter.build_regions(config)
    record = white_matter.export_volume(config, regions)
    white_matter.validate_volume(config, record)

    codes = decode(config, record).copy()
    codes[0, 1, 1] = 1
    payload = codes.tobytes(order="F")
    path = config["output_directory"] / record["file"]
    path.write_bytes(gzip.compress(payload, mtime=0))
    record["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
    record["decoded_sha256"] = hashlib.sha256(payload).hexdigest()
    with pytest.raises(ValueError, match="parcel voxels"):
        white_matter.validate_volume(config, record)


def test_cut_only_regions_from_an_unknown_source_are_rejected(tmp_path):
    config = subject(tmp_path, small_recon())
    regions = {region["id"]: region for region in white_matter.build_regions(config)}
    validate_cut_only_regions(config, regions)

    regions["mystery:left:1"] = {
        "id": "mystery:left:1",
        "atlas": "mystery",
        "kind": "tissue-region",
    }
    with pytest.raises(ValueError, match="mystery"):
        validate_cut_only_regions(config, regions)


bert = pytest.mark.skipif(
    not white_matter.is_available(read_config()),
    reason="wmparc.mgz is extracted by scripts/prepare_subject.py",
)


@bert
def test_bert_white_matter_round_trips_through_its_published_box(tmp_path):
    config = read_config()
    config["output_directory"] = tmp_path
    regions = white_matter.build_regions(config)
    record = white_matter.export_volume(config, regions)

    assert len(regions) == 68
    assert record["shape"] == [121, 105, 178]
    source = np.asarray(nib.load(config["source_directory"] / "mri/wmparc.mgz").dataobj)
    parcels = np.where((source > 3000) & (source < 5000), source, 0)
    box = parcels[67:188, 61:166, 26:204]
    assert np.count_nonzero(box) == np.count_nonzero(parcels)
    ids = np.array([label["source_label_id"] for label in record["labels"]])
    np.testing.assert_array_equal(ids[decode(config, record)], box)


@bert
def test_tissue_labels_publish_white_matter_for_the_surface_atlas_cuts(tmp_path):
    config = read_config()
    manifest = json.loads((config["output_directory"] / "manifest.json").read_text())
    regions = [r for r in manifest["regions"] if r["atlas"] != white_matter.ATLAS_ID]
    manifest["regions"] = regions + white_matter.build_regions(config)
    config["output_directory"] = tmp_path

    metadata = export_tissue_labels(config, manifest)

    assert metadata["white_matter"]["applies_to"] == ["destrieux", "hcp-mmp"]
    assert (tmp_path / metadata["white_matter"]["file"]).exists()
