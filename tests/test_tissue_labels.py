import gzip
import hashlib
import json

import nibabel as nib
import numpy as np
from nibabel.freesurfer.io import read_annot, read_geometry

from brain_model.sources import read_color_table, read_config
from brain_model.tissue_labels import export_tissue_labels
from brain_model.volumes import offset_by, read_published


def test_published_anatomical_labels_survive_transport_and_match_region_names(tmp_path):
    config = read_config()
    manifest = json.loads((config["output_directory"] / "manifest.json").read_text())
    config["output_directory"] = tmp_path
    meta = export_tissue_labels(config, manifest)
    source = np.asarray(
        nib.load(config["source_directory"] / "mri/aparc.a2009s+aseg.mgz").dataobj
    )
    record = meta["atlases"]["destrieux"]
    codes = read_published(record, tmp_path / record["file"], source.shape)
    lut = np.array([label["source_label_id"] for label in record["labels"]])
    np.testing.assert_array_equal(lut[codes], source)
    image = nib.load(config["source_directory"] / "mri/aparc.a2009s+aseg.mgz")
    # The published affine is the crop's own: the source grid shifted to the
    # box's corner, which is what puts every kept voxel back where it was.
    np.testing.assert_allclose(
        record["voxel_to_surface_ras_mm"],
        image.header.get_vox2ras_tkr() @ offset_by(record["crop_corner_voxel"]),
    )
    payload = gzip.decompress((tmp_path / record["file"]).read_bytes())
    assert hashlib.sha256(payload).hexdigest() == record["decoded_sha256"]
    assert (
        hashlib.sha256((tmp_path / record["file"]).read_bytes()).hexdigest()
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


def test_hcp_projection_never_relabels_white_matter_or_deep_structures(tmp_path):
    config = read_config()
    manifest = json.loads((config["output_directory"] / "manifest.json").read_text())
    config["output_directory"] = tmp_path
    meta = export_tissue_labels(config, manifest)
    source = np.asarray(
        nib.load(config["source_directory"] / "mri/aparc.a2009s+aseg.mgz").dataobj
    )
    record = meta["atlases"]["hcp-mmp"]
    data = read_published(record, tmp_path / record["file"], source.shape)
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
