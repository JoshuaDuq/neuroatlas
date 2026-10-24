"""Derived transforms are re-derived from their sources, not read back."""

import json
import shutil

import pytest
from nibabel.freesurfer.io import read_annot, write_annot

from brain_model import validate_transforms
from brain_model.sources import ROOT, read_config


@pytest.mark.parametrize("anatomy", ["snail", "cdmd"])
def test_every_projected_annotation_is_its_rederivation_byte_for_byte(anatomy):
    report = validate_transforms.validate_projected_annotations(read_config(anatomy))
    assert set(report) == {"HCPMMP1", "Schaefer2018_400Parcels_7Networks_order"}
    for hemispheres in report.values():
        assert all(h["byte_identical_to_rederivation"] for h in hemispheres.values())


def test_a_projected_annotation_that_differs_by_one_vertex_is_refused(tmp_path):
    config = read_config()
    (tmp_path / "surf").symlink_to(config["source_directory"] / "surf")
    (tmp_path / "label").mkdir()
    for name in validate_transforms.projected_annotation_names(config):
        for prefix in ("lh", "rh"):
            shutil.copy(config["source_directory"] / f"label/{prefix}.{name}.annot",
                        tmp_path / "label")
    path = tmp_path / "label/lh.HCPMMP1.annot"
    labels, colors, names = read_annot(path)
    labels[0] = labels[0] + 1
    write_annot(path, labels, colors, names, fill_ctab=False)
    config["source_directory"] = tmp_path
    with pytest.raises(ValueError, match="re-derived projection"):
        validate_transforms.validate_projected_annotations(config)


def test_the_tract_reference_transform_is_orig_mgz_own():
    report = validate_transforms.validate_transforms(read_config("snail"))
    space = report["diffusion_space"]
    assert space["translation_equals_minus_c_ras"] is True
    assert space["maximum_difference_mm"] == 0
    assert "diffusion_space" not in validate_transforms.validate_transforms(read_config("fsaverage"))


def test_cdmds_own_tracts_share_its_reconstructions_frame():
    space = validate_transforms.validate_transforms(read_config("cdmd"))["diffusion_space"]
    assert space["translation_equals_minus_c_ras"] is True
    assert space["maximum_difference_mm"] == 0


def test_a_shifted_tract_reference_is_refused(tmp_path, monkeypatch):
    catalog = ROOT / "data/diffusion.yaml"
    (tmp_path / "data").mkdir()
    shutil.copy(catalog, tmp_path / "data/diffusion.yaml")
    recorded = json.loads((ROOT / "public/diffusion/snail-subject-1/surface-space.json").read_text())
    recorded["anchors"][1]["surface_ras_mm"][2] += 0.001
    destination = tmp_path / "public/diffusion/snail-subject-1"
    destination.mkdir(parents=True)
    (destination / "surface-space.json").write_text(json.dumps(recorded))
    (destination / "t1_warped.nii.gz").symlink_to(
        ROOT / "public/diffusion/snail-subject-1/t1_warped.nii.gz"
    )
    monkeypatch.setattr(validate_transforms, "ROOT", tmp_path)
    with pytest.raises(ValueError, match="differs from orig.mgz"):
        validate_transforms.validate_diffusion_space(read_config("snail"))
