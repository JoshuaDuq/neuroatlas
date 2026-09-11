"""Which brain gets published is a configuration choice, not a code path."""

import json

import pytest
import yaml

from brain_model.sources import ROOT, resolve_config, scoped_sources


def document():
    return {
        "anatomy": "second",
        "anatomies": {
            "first": {
                "subject": "first",
                "label": "First brain",
                "individual": False,
                "directory": "data/first",
                "source_url": "https://example.invalid/first",
                "nextbrain": {"directory": "data/nb-first", "volume": "first.mgz"},
            },
            "second": {
                "subject": "second",
                "label": "Second brain",
                "individual": True,
                "directory": "data/second",
                "source_url": "https://example.invalid/second",
                "archive": {"sha256": "0" * 64, "member_prefix": "second/"},
                "project_hcp_from": "first",
                "nextbrain": {"directory": "data/nb-second", "volume": "second.mgz"},
            },
        },
        "output_directory": "public/models",
        "nextbrain": {"lut": "lut.txt", "minimum_mesh_voxels": 10},
    }


def test_the_selected_anatomy_becomes_the_shape_every_build_step_reads():
    config = resolve_config(document())
    assert config["anatomy"]["id"] == "second"
    assert config["anatomy"]["subject"] == "second"
    assert config["source_directory"] == ROOT / "data/second"
    # Per-anatomy warp settings, folded onto the shared ones.
    assert config["nextbrain"]["directory"] == ROOT / "data/nb-second"
    assert config["nextbrain"]["volume"] == "second.mgz"
    assert config["nextbrain"]["minimum_mesh_voxels"] == 10
    # The brain HCP is resampled from is resolved here too, so no later step
    # needs the declarations to find it.
    assert config["anatomy"]["hcp_source_directory"] == ROOT / "data/first"
    # The other declarations are resolved away, so nothing downstream can read
    # a path belonging to a brain this build is not publishing.
    assert "anatomies" not in config


def test_switching_the_selection_moves_every_path_at_once():
    switched = resolve_config({**document(), "anatomy": "first"})
    assert switched["source_directory"] == ROOT / "data/first"
    assert switched["nextbrain"]["directory"] == ROOT / "data/nb-first"
    assert switched["nextbrain"]["volume"] == "first.mgz"
    assert switched["anatomy"]["individual"] is False
    # Nothing to unpack and no spheres to resample: absence is the declaration.
    assert "archive" not in switched["anatomy"]
    assert "project_hcp_from" not in switched["anatomy"]
    assert "hcp_source_directory" not in switched["anatomy"]


def test_projecting_from_an_undeclared_brain_is_refused():
    broken = document()
    broken["anatomies"]["second"]["project_hcp_from"] = "nowhere"
    with pytest.raises(ValueError, match="nowhere"):
        resolve_config(broken)


def test_an_undeclared_anatomy_is_refused_rather_than_half_built():
    with pytest.raises(ValueError, match="anatomies"):
        resolve_config({**document(), "anatomy": "third"})


def test_sources_are_scoped_to_the_anatomy_whose_build_reads_them():
    sources = [
        {"path": "data/FreeSurferColorLUT.txt"},
        {"path": "data/first/mri/aseg.mgz", "anatomy": "first"},
        {"path": "data/second/mri/aseg.mgz", "anatomy": "second"},
    ]
    kept = scoped_sources({"sources": sources}, "second")
    assert [source["path"] for source in kept["sources"]] == [
        "data/FreeSurferColorLUT.txt",
        "data/second/mri/aseg.mgz",
    ]


def test_every_declared_anatomy_resolves_and_every_source_tag_names_one():
    declared = yaml.safe_load((ROOT / "config/model.yaml").read_text())
    names = set(declared["anatomies"])
    for name in names:
        resolved = resolve_config({**declared, "anatomy": name})
        assert resolved["anatomy"]["id"] == name
        assert resolved["source_directory"].is_dir() or "archive" in resolved["anatomy"]
    tagged = {
        source.get("anatomy")
        for source in json.loads((ROOT / "data/sources.json").read_text())["sources"]
    }
    assert tagged - {None} <= names


def test_the_built_anatomy_names_its_reconstruction_only_when_it_records_one(tmp_path):
    from brain_model.build import anatomy_record

    anatomy = {
        "id": "x", "subject": "x", "display_name": "X", "label": "X", "individual": True,
        "source_url": "https://example.invalid/x",
    }
    config = {"source_directory": tmp_path, "anatomy": anatomy}
    assert anatomy_record(config)["reconstruction"] is None

    (tmp_path / "scripts").mkdir()
    (tmp_path / "scripts/build-stamp.txt").write_text("freesurfer-v7.4.1\n")
    assert anatomy_record(config)["reconstruction"] == "freesurfer-v7.4.1"


def test_a_brain_can_be_prepared_without_being_the_selected_one():
    # Preparing or warping a second brain must not require first changing which
    # brain is published, or the switch would have to be flipped twice per move.
    from brain_model.sources import read_config

    selected = read_config()
    other = "fsaverage" if selected["anatomy"]["id"] != "fsaverage" else "bert"
    assert read_config(other)["anatomy"]["id"] == other
    assert read_config()["anatomy"]["id"] == selected["anatomy"]["id"]
