import gzip
import hashlib

import nibabel as nib
import numpy as np
import pytest

from brain_model import nextbrain
from brain_model.sources import read_config


@pytest.fixture
def config(tmp_path):
    config = read_config()
    config["output_directory"] = tmp_path
    return config


def on_grid(config, labels):
    """Wrap an array in the reference grid's own header and affine."""
    reference = nib.load(config["source_directory"] / "mri/aseg.mgz")
    header = reference.header.copy()
    header.set_data_dtype(np.int32)
    return nib.MGHImage(labels.astype(np.int32), reference.affine, header=header)


def test_published_labels_survive_transport_with_their_original_values(config):
    _, source, _ = nextbrain.load(config)
    regions = nextbrain.build_regions(config)
    record = nextbrain.export_atlas(config, regions)

    payload = gzip.decompress((config["output_directory"] / record["file"]).read_bytes())
    codes = np.frombuffer(payload, dtype="<u2").reshape(source.shape, order="F")
    lut = np.array([label["source_label_id"] for label in record["labels"]])
    np.testing.assert_array_equal(lut[codes], source)

    assert hashlib.sha256(payload).hexdigest() == record["decoded_sha256"]
    image = nib.load(nextbrain.paths(config)[0])
    np.testing.assert_array_equal(
        record["voxel_to_surface_ras_mm"], image.header.get_vox2ras_tkr()
    )


def test_every_cut_label_resolves_to_a_published_region(config):
    regions = nextbrain.build_regions(config)
    record = nextbrain.export_atlas(config, regions)
    published = {region["id"] for region in regions}
    for label in record["labels"]:
        if label["source_label_id"] == nextbrain.BACKGROUND:
            assert label["region_id"] is None
        else:
            assert label["region_id"] in published


def test_regions_cover_only_delineated_rois_and_measure_what_they_contain(config):
    _, labels, _ = nextbrain.load(config)
    regions = nextbrain.build_regions(config)
    present = set(np.unique(labels).tolist()) - {nextbrain.BACKGROUND}

    assert {region["source_label_id"] for region in regions} == present
    for region in regions:
        count = int(np.count_nonzero(labels == region["source_label_id"]))
        assert region["voxel_count"] == count
        assert region["segmentation_volume_mm3"] == pytest.approx(count)
        # No mesh is published for these, which is the point of the kind.
        assert region["kind"] == "tissue-region"
        assert "vertex_count" not in region


def test_hemisphere_comes_from_the_index_not_the_published_name(config):
    """NextBrain names every cortical parcel `ctx-rh-` on both sides."""
    regions = {region["id"]: region for region in nextbrain.build_regions(config)}
    left = regions["nextbrain:left:2035"]
    right = regions["nextbrain:right:12035"]

    assert left["source_published_name"] == "Left-ctx-rh-insula"
    assert right["source_published_name"] == "Right-ctx-rh-insula"
    # The vestigial fragment is dropped so the displayed name cannot contradict
    # the hemisphere recorded beside it, but the published string is retained.
    assert left["source_name"] == right["source_name"] == "insula"
    assert left["hemisphere"] == "left"
    assert right["hemisphere"] == "right"


def test_a_volume_off_the_reference_grid_is_refused(config, tmp_path):
    """The grid is the surface-RAS mapping, which is what the viewer samples.

    `get_vox2ras_tkr` is derived from shape, zooms and orientation and ignores
    `c_ras` by construction, so a differently centred scan on the same grid is
    deliberately not a mismatch: nothing downstream can observe that difference.
    A different extent is a real one.
    """
    reference = nib.load(config["source_directory"] / "mri/aseg.mgz")
    smaller = np.zeros((128, 128, 128), np.int32)
    nib.save(nib.MGHImage(smaller, reference.affine), tmp_path / "smaller.mgz")
    config["nextbrain"] = {**config["nextbrain"], "directory": tmp_path,
                           "volume": "smaller.mgz", "lut": "lut.txt"}
    (tmp_path / "lut.txt").write_text("0 Unknown 0 0 0 0\n")

    with pytest.raises(ValueError, match="not registered to the subject grid"):
        nextbrain.load(config)


def test_a_label_absent_from_the_published_table_is_refused(config, tmp_path):
    labels = np.zeros((256, 256, 256), np.int32)
    labels[10, 10, 10] = 4242
    nib.save(on_grid(config, labels), tmp_path / "volume.mgz")
    (tmp_path / "lut.txt").write_text("0 Unknown 0 0 0 0\n7 Left-thalamus 1 2 3 0\n")
    config["nextbrain"] = {**config["nextbrain"], "directory": tmp_path,
                           "volume": "volume.mgz", "lut": "lut.txt"}

    with pytest.raises(ValueError, match=r"absent from the published LUT: \[4242\]"):
        nextbrain.load(config)


def test_a_cut_label_without_a_published_region_is_a_build_error(config):
    regions = nextbrain.build_regions(config)
    with pytest.raises(ValueError, match="Cut label has no published region"):
        nextbrain.export_atlas(config, regions[1:])


def test_an_absent_warp_leaves_the_optional_atlas_out(config, tmp_path):
    config["nextbrain"] = {**config["nextbrain"], "directory": tmp_path}
    assert nextbrain.is_available(config) is False
