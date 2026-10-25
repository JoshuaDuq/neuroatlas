import gzip
import hashlib
import json

import nibabel as nib
import numpy as np
import pytest
from nibabel.freesurfer.io import (
    read_annot,
    read_geometry,
    write_annot,
    write_geometry,
)

from brain_model.labels.tissue_labels import describe_source_label, export_tissue_labels
from brain_model.labels.volumes import offset_by
from brain_model.sources import read_color_table, read_config
from brain_model.validate_volumes import validate_tissue_volumes
from tests.support import read_published


@pytest.fixture
def small_ribbon_subject(tmp_path):
    directory = tmp_path / "subject"
    for name in ["mri", "surf", "label"]:
        (directory / name).mkdir(parents=True)
    source = np.zeros((3, 4, 5), dtype=np.int32)
    source[0, 0, 0], source[1, 1, 1], source[2, 2, 2] = 11101, 12101, 2
    image = nib.MGHImage(source, np.eye(4))
    nib.save(image, directory / "mri/aparc.a2009s+aseg.mgz")
    ribbon = np.zeros(source.shape, dtype=np.int32)
    ribbon[0, 0, 0], ribbon[1, 1, 1] = 3, 42
    nib.save(nib.MGHImage(ribbon, np.eye(4)), directory / "mri/ribbon.mgz")
    vertices = nib.affines.apply_affine(
        image.header.get_vox2ras_tkr(), [[0, 0, 0], [1, 1, 1], [2, 2, 2]]
    )
    regions = []
    for prefix, hemisphere in [("lh", "left"), ("rh", "right")]:
        write_annot(
            directory / "label" / f"{prefix}.HCPMMP1.annot",
            np.ones(3, dtype=int),
            np.array([[1, 1, 1, 0], [10, 20, 30, 0]]),
            ["unknown", "parcel"],
        )
        for surface in ["pial", "white"]:
            write_geometry(
                directory / "surf" / f"{prefix}.{surface}",
                vertices,
                np.array([[0, 1, 2]]),
            )
        for label_id, kind in [(0, "unknown"), (1, "cortex")]:
            regions.append(
                {
                    "id": f"hcp-mmp:{hemisphere}:{label_id}",
                    "atlas": "hcp-mmp",
                    "hemisphere": hemisphere,
                    "source_label_id": label_id,
                    "kind": kind,
                }
            )
    config = {
        "source_directory": directory,
        "output_directory": tmp_path / "published",
        "anatomy": {"individual": True, "layers": []},
    }
    return config, {"regions": regions}


@pytest.mark.parametrize("mismatch", ["translation", "orientation", "shape"])
def test_hcp_projection_rejects_a_different_ribbon_grid(small_ribbon_subject, mismatch):
    config, manifest = small_ribbon_subject
    path = config["source_directory"] / "mri/ribbon.mgz"
    image = nib.load(path)
    ribbon = np.asarray(image.dataobj)
    affine = image.affine.copy()
    if mismatch == "translation":
        affine[0, 3] += 25
    elif mismatch == "orientation":
        affine[0, 0] = -1
    elif mismatch == "shape":
        ribbon = np.stack([ribbon, ribbon], axis=-1)
    nib.save(nib.MGHImage(ribbon, affine), path)
    with pytest.raises(ValueError, match="grid"):
        export_tissue_labels(config, manifest)


def test_hcp_projection_preserves_a_matching_ribbon_grid(small_ribbon_subject):
    config, manifest = small_ribbon_subject
    metadata = export_tissue_labels(config, manifest)
    record = metadata["atlases"]["hcp-mmp"]
    codes = read_published(
        record, config["output_directory"] / record["file"], (3, 4, 5)
    )
    labels = record["labels"]
    assert labels[codes[0, 0, 0]]["region_id"] == "hcp-mmp:left:1"
    assert labels[codes[1, 1, 1]]["region_id"] == "hcp-mmp:right:1"
    assert labels[codes[2, 2, 2]]["source_label_id"] == 2


def test_hcp_projection_checks_the_actual_segmentation_grid(small_ribbon_subject):
    config, manifest = small_ribbon_subject
    path = config["source_directory"] / "mri/aparc.a2009s+aseg.mgz"
    image = nib.load(path)
    affine = image.affine.copy()
    affine[0, 3] += 25
    nib.save(nib.MGHImage(np.asarray(image.dataobj), affine), path)
    with pytest.raises(ValueError, match="scanner affine"):
        export_tissue_labels(config, manifest)


@pytest.fixture(scope="module")
def exported(tmp_path_factory):
    """This brain's cut volumes, exported once for the tests that read them."""
    config = read_config()
    manifest = json.loads((config["output_directory"] / "manifest.json").read_text())
    config["output_directory"] = tmp_path_factory.mktemp("models")
    return config, manifest, export_tissue_labels(config, manifest)


def test_published_anatomical_labels_survive_transport_and_match_region_names(exported):
    config, manifest, meta = exported
    output = config["output_directory"]
    source = np.asarray(
        nib.load(config["source_directory"] / "mri/aparc.a2009s+aseg.mgz").dataobj
    )
    record = meta["atlases"]["destrieux"]
    codes = read_published(record, output / record["file"], source.shape)
    lut = np.array([label["source_label_id"] for label in record["labels"]])
    np.testing.assert_array_equal(lut[codes], source)
    image = nib.load(config["source_directory"] / "mri/aparc.a2009s+aseg.mgz")
    # The published affine is the crop's own: the source grid shifted to the
    # box's corner, which is what puts every kept voxel back where it was.
    np.testing.assert_allclose(
        record["voxel_to_surface_ras_mm"],
        image.header.get_vox2ras_tkr() @ offset_by(record["crop_corner_voxel"]),
    )
    payload = gzip.decompress((output / record["file"]).read_bytes())
    assert hashlib.sha256(payload).hexdigest() == record["decoded_sha256"]
    assert (
        hashlib.sha256((output / record["file"]).read_bytes()).hexdigest()
        == record["sha256"]
    )
    regions = {region["id"]: region for region in manifest["regions"]}
    names = read_color_table()
    for label in record["labels"]:
        region_id = label["region_id"]
        if region_id and label["kind"] == "cortex":
            assert (
                regions[region_id]["source_name"]
                == names[label["source_label_id"]][0][7:]
            )


def test_hcp_projection_never_relabels_white_matter_or_deep_structures(exported):
    config, _, meta = exported
    output = config["output_directory"]
    source = np.asarray(
        nib.load(config["source_directory"] / "mri/aparc.a2009s+aseg.mgz").dataobj
    )
    record = meta["atlases"]["hcp-mmp"]
    data = read_published(record, output / record["file"], source.shape)
    cortex = source >= 11100
    assert all(
        record["labels"][code]["kind"] != "cortex" for code in np.unique(data[~cortex])
    )
    reverse = np.array([label["source_label_id"] for label in record["labels"]])
    np.testing.assert_array_equal(reverse[data[~cortex]], source[~cortex])

    image = nib.load(config["source_directory"] / "mri/ribbon.mgz")
    ribbon = np.asarray(image.dataobj)
    # The published affine is the crop's own: the source grid shifted to the
    # box's corner, which is what puts every kept voxel back where it was.
    np.testing.assert_allclose(
        record["voxel_to_surface_ras_mm"],
        image.header.get_vox2ras_tkr() @ offset_by(record["crop_corner_voxel"]),
    )
    for prefix, lower, ribbon_label in [("lh", 11100, 3), ("rh", 12100, 42)]:
        mask = (source > lower) & (source < lower + 100)
        outside = mask & (ribbon != ribbon_label)
        assert all(
            record["labels"][code]["region_id"] is None
            for code in np.unique(data[outside])
        )
        coordinates = np.argwhere(mask & (ribbon == ribbon_label))[::10000]
        annotation, _, _ = read_annot(
            config["source_directory"] / "label" / f"{prefix}.HCPMMP1.annot"
        )
        pial, _ = read_geometry(config["source_directory"] / "surf" / f"{prefix}.pial")
        white, _ = read_geometry(
            config["source_directory"] / "surf" / f"{prefix}.white"
        )
        vertices = np.vstack([pial, white])
        for coordinate in coordinates:
            point = nib.affines.apply_affine(image.header.get_vox2ras_tkr(), coordinate)
            # Independent brute-force check of the accelerated nearest-vertex mapping.
            nearest = np.argmin(np.sum((vertices - point) ** 2, axis=1)) % len(pial)
            label = record["labels"][data[tuple(coordinate)]]
            assert label["source_label_id"] == annotation[nearest]


def test_desikan_unknown_cortex_keeps_its_hemisphere():
    table = read_color_table()
    assert describe_source_label(1000, table, [])["hemisphere"] == "left"
    assert describe_source_label(2000, table, [])["hemisphere"] == "right"
    assert describe_source_label(11101, table, [])["hemisphere"] == "left"
    assert describe_source_label(85, table, [])["hemisphere"] == "midline"


def test_destrieux_labels_match_regions_across_recon_spellings():
    region = {
        "id": "destrieux:left:1", "atlas": "destrieux", "hemisphere": "left",
        "source_name": "G&S_frontomargin", "kind": "cortex",
    }
    label = describe_source_label(11101, read_color_table(), [region])
    assert label["region_id"] == "destrieux:left:1"


def republish(config, record, codes):
    """Rewrite a published grid with consistent checksums, as a careful forger would."""
    payload = np.ascontiguousarray(codes, dtype=record["dtype"]).tobytes(order="F")
    path = config["output_directory"] / record["file"]
    path.write_bytes(gzip.compress(payload, mtime=0))
    record["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
    record["decoded_sha256"] = hashlib.sha256(payload).hexdigest()


def published_codes(config, record):
    payload = gzip.decompress((config["output_directory"] / record["file"]).read_bytes())
    return np.frombuffer(payload, record["dtype"]).reshape(record["shape"], order="F").copy()


def test_validation_recomputes_both_cut_volumes_from_their_sources(small_ribbon_subject):
    config, manifest = small_ribbon_subject
    tissues = export_tissue_labels(config, manifest)
    report = validate_tissue_volumes(config, manifest, tissues)
    assert report["destrieux"]["identical_to_source_labels"] is True
    assert report["hcp-mmp"]["hemispheres"] == {
        "left": {"ribbon_voxels": 1, "cortical_voxels_outside_ribbon": 0},
        "right": {"ribbon_voxels": 1, "cortical_voxels_outside_ribbon": 0},
    }


@pytest.mark.parametrize("damage", ["ribbon", "non-cortex", "destrieux"])
def test_validation_decodes_the_voxels_rather_than_trusting_the_checksums(
    small_ribbon_subject, damage
):
    config, manifest = small_ribbon_subject
    tissues = export_tissue_labels(config, manifest)
    atlas = "destrieux" if damage == "destrieux" else "hcp-mmp"
    record = tissues["atlases"][atlas]
    codes = published_codes(config, record)
    corner = np.array(record["crop_corner_voxel"])
    voxel = {"ribbon": (0, 0, 0), "non-cortex": (2, 2, 2), "destrieux": (2, 2, 2)}[damage]
    index = tuple(np.array(voxel) - corner)
    labels = [label["source_label_id"] for label in record["labels"]]
    codes[index] = (codes[index] + 1) % len(labels)
    republish(config, record, codes)
    with pytest.raises(ValueError, match="differ|relabels"):
        validate_tissue_volumes(config, manifest, tissues)


def test_validation_rejects_a_label_table_that_no_longer_describes_the_source(
    small_ribbon_subject,
):
    config, manifest = small_ribbon_subject
    tissues = export_tissue_labels(config, manifest)
    tissues["atlases"]["hcp-mmp"]["labels"][-1]["name"] = "renamed"
    with pytest.raises(ValueError, match="label tables"):
        validate_tissue_volumes(config, manifest, tissues)


def test_the_published_cut_volumes_match_their_sources():
    config = read_config()
    manifest = json.loads((config["output_directory"] / "manifest.json").read_text())
    tissues = json.loads((config["output_directory"] / "tissue-labels.json").read_text())
    report = validate_tissue_volumes(config, manifest, tissues)
    ribbon = np.asarray(nib.load(config["source_directory"] / "mri/ribbon.mgz").dataobj)
    # Nearly all of each hemisphere's cortical ribbon carries an HCP-MMP label.
    for side, counts in report["hcp-mmp"]["hemispheres"].items():
        assert counts["ribbon_voxels"] >= 0.9 * np.count_nonzero(ribbon == {"left": 3, "right": 42}[side])
