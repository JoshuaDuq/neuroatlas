import gzip
import hashlib

import nibabel as nib
import numpy as np
import pytest

from brain_model import nextbrain
from brain_model.sources import ROOT, read_config, sha256
from brain_model.volumes import LabelGrid, offset_by, read_published, resample_nearest


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


def use_volume(config, directory, image, lut):
    nib.save(image, directory / "volume.mgz")
    (directory / "lut.txt").write_text(lut)
    config["nextbrain"] = {**config["nextbrain"], "directory": directory,
                           "volume": "volume.mgz", "lut": "lut.txt"}


def aseg_on(config, spacing):
    """aseg's caudate relabelled as NextBrain's head of caudate, on a finer grid."""
    aseg = nib.load(config["source_directory"] / "mri/aseg.mgz")
    tkr = aseg.header.get_vox2ras_tkr()
    grid = np.diag([spacing, spacing, spacing, 1.0])
    grid[:3, 3] = [-30, -10, -10]
    shape = (int(60 / spacing),) * 3
    source = np.asarray(aseg.dataobj)
    labels, _ = resample_nearest(np.where(source == 11, 48, 0), tkr, grid, shape)
    scanner = np.linalg.inv(nextbrain.scanner_to_surface(config)) @ grid
    return labels, grid, nib.MGHImage(labels.astype(np.int32), scanner)


def test_a_finer_grid_is_placed_by_its_scanner_affine_not_its_own_header(config, tmp_path):
    """An MGH header's tkregister matrix is centred on its own volume.

    For any grid but the conformed subject grid that is not the subject's surface
    RAS, so a 0.4 mm volume read through it would land centimetres away.
    """
    labels, grid, image = aseg_on(config, 0.5)
    assert not np.allclose(image.header.get_vox2ras_tkr(), grid, atol=1)
    use_volume(config, tmp_path, image, "0 Unknown 0 0 0 0\n48 Left-head_of_caudate 1 2 3 0\n")

    placed, _ = nextbrain.load(config)
    np.testing.assert_allclose(placed.voxel_to_surface, grid, atol=1e-4)
    np.testing.assert_array_equal(placed.labels, labels)
    assert placed.voxel_volume_mm3 == pytest.approx(0.125)


def test_a_volume_that_misses_this_brain_is_refused(config, tmp_path):
    labels, grid, _ = aseg_on(config, 0.5)
    shifted = grid.copy()
    shifted[0, 3] += 100  # out of the head; a smaller shift lands in other tissue
    scanner = np.linalg.inv(nextbrain.scanner_to_surface(config)) @ shifted
    use_volume(config, tmp_path, nib.MGHImage(labels.astype(np.int32), scanner),
               "0 Unknown 0 0 0 0\n48 Left-head_of_caudate 1 2 3 0\n")

    with pytest.raises(ValueError, match="not registered to this brain"):
        nextbrain.load(config)


def test_a_label_absent_from_the_published_table_is_refused(config, tmp_path):
    labels = np.zeros((256, 256, 256), np.int32)
    labels[10, 10, 10] = 4242
    use_volume(config, tmp_path, on_grid(config, labels),
               "0 Unknown 0 0 0 0\n7 Left-thalamus 1 2 3 0\n")

    with pytest.raises(ValueError, match=r"absent from the published LUT: \[4242\]"):
        nextbrain.load(config)


def test_a_procedure_its_provenance_does_not_record_is_refused(config):
    """Limitations follow the configured procedure, so it must be the true one."""
    path = str(nextbrain.paths(config)[0].relative_to(ROOT))
    provenance = {"sources": [{"path": path, "procedure": "scripts/warp_nextbrain.py: SyN"}]}
    assert config["nextbrain"]["procedure"] == nextbrain.SUBJECT_SEGMENTATION
    with pytest.raises(ValueError, match="recorded by scripts/warp_nextbrain.py"):
        nextbrain.verify_procedure(config, provenance)
    provenance["sources"][0]["procedure"] = "scripts/segment_nextbrain.py: SuperSynth"
    nextbrain.verify_procedure(config, provenance)


def test_the_surface_floor_is_a_volume_whatever_the_grid():
    table = {0: ("Unknown", [0, 0, 0]), 48: ("Left-head_of_caudate", [0, 0, 0]),
             79: ("Left-putamen", [0, 0, 0])}
    labels = np.zeros((20, 20, 20), np.int64)
    labels.ravel()[:156] = 48       # 156 x 0.064 mm³ = 9.98 mm³
    labels.ravel()[200:357] = 79    # 157 x 0.064 mm³ = 10.05 mm³
    grid = LabelGrid(labels, np.diag([0.4, 0.4, 0.4, 1.0]), [0.4] * 3)
    assert nextbrain.meshed_indices(grid, table, 10) == [79]


def test_a_cut_block_holds_its_most_frequent_label():
    labels = np.zeros((2, 2, 4), np.int64)
    labels[:, :, :2] = [[[5, 5], [5, 7]], [[7, 5], [0, 5]]]
    labels[:, :, 2:] = 9
    np.testing.assert_array_equal(nextbrain.block_majority(labels, 2), [[[5, 9]]])


def test_a_tied_block_goes_to_the_label_rarer_in_the_volume():
    labels = np.full((2, 2, 6), 3, np.int64)
    labels[:, :, :2] = [[[3, 3], [3, 3]], [[8, 8], [8, 8]]]   # 3 is commoner
    labels[:, :, 2:4] = [[[4, 4], [4, 4]], [[6, 6], [6, 6]]]  # 4 and 6 equally rare
    np.testing.assert_array_equal(nextbrain.block_majority(labels, 2), [[[8, 4, 3]]])


def test_a_block_past_the_grid_edge_counts_background_there():
    labels = np.full((3, 2, 2), 5, np.int64)
    labels[2] = 0
    coarse = nextbrain.block_majority(labels, 2)
    assert coarse.shape == (2, 1, 1)
    np.testing.assert_array_equal(coarse[:, 0, 0], [5, 0])


def test_the_block_is_whole_source_voxels_nearest_the_cut_spacing():
    def grid(spacing):
        return LabelGrid(np.zeros((2, 2, 2)), np.eye(4), [spacing] * 3)

    assert nextbrain.cut_block(grid(0.4000000059604645), 0.8) == 2
    assert nextbrain.cut_block(grid(1.0), 0.8) == 1


def test_published_cut_labels_are_the_source_block_majorities(config):
    grid, _ = nextbrain.load(config)
    regions = nextbrain.build_regions(config)
    record = nextbrain.export_atlas(config, regions)
    coarse, block = nextbrain.cut_grid(grid, config["nextbrain"]["cut_label_spacing_mm"])

    codes = read_published(
        record, config["output_directory"] / record["file"], coarse.labels.shape
    )
    lut = np.array([label["source_label_id"] for label in record["labels"]])
    np.testing.assert_array_equal(lut[codes], coarse.labels)
    payload = gzip.decompress((config["output_directory"] / record["file"]).read_bytes())
    assert hashlib.sha256(payload).hexdigest() == record["decoded_sha256"]
    # The crop's own affine: block centres, shifted to the box's corner.
    np.testing.assert_allclose(
        record["voxel_to_surface_ras_mm"],
        coarse.voxel_to_surface @ offset_by(record["crop_corner_voxel"]),
    )
    assert record["voxel_spacing_mm"] == [size * block for size in grid.spacing_mm]
    assert nextbrain.validate_volume(config, record)["every_block_is_its_majority"]


def test_validation_refuses_a_cut_block_that_lost_its_majority(config):
    record = nextbrain.export_atlas(config, nextbrain.build_regions(config))
    path = config["output_directory"] / record["file"]
    codes = np.frombuffer(gzip.decompress(path.read_bytes()), record["dtype"]).copy()
    labelled = np.flatnonzero(codes)
    codes[labelled[len(labelled) // 2]] = 0
    payload = codes.tobytes()
    path.write_bytes(gzip.compress(payload, mtime=0))
    record.update(sha256=sha256(path), decoded_sha256=hashlib.sha256(payload).hexdigest())

    with pytest.raises(ValueError, match="most frequent label"):
        nextbrain.validate_volume(config, record)


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
    grid, _ = nextbrain.load(config)
    regions = nextbrain.build_regions(config)
    present = set(np.unique(grid.labels).tolist()) - {nextbrain.BACKGROUND}

    assert {region["source_label_id"] for region in regions} == present
    for region in regions:
        count = int(np.count_nonzero(grid.labels == region["source_label_id"]))
        assert region["voxel_count"] == count
        assert region["segmentation_volume_mm3"] == pytest.approx(
            count * grid.voxel_volume_mm3
        )
        # No mesh is published for these, which is the point of the kind.
        assert region["kind"] == "tissue-region"
        assert "vertex_count" not in region


def test_cortical_cut_parcels_carry_network_composition(config):
    """Yeo membership is measured on the surface; NextBrain cortex is a volume.

    The cut can only paint one colour per parcel, so each cortical ROI reports
    the network that holds most of the nearest pial/white vertices — the same
    nearest-vertex rule the HCP cut labels already use. Nuclei have no cortical
    surface and must not be given a network.
    """
    from brain_model import networks as yeo

    if not yeo.is_available(config):
        pytest.skip("network annotation is optional")
    regions = {region["id"]: region for region in nextbrain.build_regions(config)}
    cortex = [
        region for region in regions.values()
        if "ctx-" in region["source_published_name"]
    ]
    assert cortex, "NextBrain cortical parcels should be present"
    for region in cortex:
        assert region.get("networks"), region["id"]
        assert region["networks"][0]["network"] in yeo.NETWORKS
    assert "networks" not in regions["nextbrain:left:48"]


def test_pericalcarine_cortex_is_visual(config):
    from brain_model import networks as yeo

    if not yeo.is_available(config):
        pytest.skip("network annotation is optional")
    regions = {region["id"]: region for region in nextbrain.build_regions(config)}
    assert regions["nextbrain:left:2021"]["networks"][0]["network"] == "Vis"


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


def test_a_cut_label_without_a_published_region_is_a_build_error(config):
    regions = nextbrain.build_regions(config)
    with pytest.raises(ValueError, match="Cut label has no published region"):
        nextbrain.export_atlas(config, regions[1:])


def test_an_absent_volume_leaves_the_optional_atlas_out(config, tmp_path):
    config["nextbrain"] = {**config["nextbrain"], "directory": tmp_path}
    assert nextbrain.is_available(config) is False
