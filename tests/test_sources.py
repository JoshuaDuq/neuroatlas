"""Which brain gets published is a configuration choice, not a code path."""

import json
from urllib.parse import quote

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
        # A brain whose files this repository does not redistribute is absent
        # from a fresh checkout until prepare_subject.py fetches it.
        obtainable = {"archive", "download"} & set(resolved["anatomy"])
        assert resolved["source_directory"].is_dir() or obtainable
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


def load_prepare_subject():
    """scripts/ is not a package, so the script is loaded by path."""
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "prepare_subject", ROOT / "scripts/prepare_subject.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Response:
    def __init__(self, payload):
        self.payload = payload

    def read(self):
        return self.payload

    def __enter__(self):
        return self

    def __exit__(self, *exception):
        return False


def downloadable(tmp_path, monkeypatch, files):
    """A `download` anatomy whose files are served from memory."""
    prepare = load_prepare_subject()
    base = "https://example.invalid/sub-0001"
    served = {f"{base}/{quote(name)}": data for name, data in files.items()}
    monkeypatch.setattr(prepare, "ROOT", tmp_path)
    monkeypatch.setattr(prepare, "SUBJECT_FILES", list(files))
    monkeypatch.setattr(prepare, "urlopen", lambda url: Response(served[url]))
    config = {
        "source_directory": tmp_path / "data/example",
        "anatomy": {"id": "example", "download": {"base_url": base}},
    }
    return prepare, config


def test_a_downloaded_reconstruction_records_a_checksum_for_every_file(tmp_path, monkeypatch):
    # The `+` in aparc.a2009s+aseg.mgz is a real path character, and an S3 key
    # that leaves it unescaped is a 404 rather than a wrong file.
    files = {"mri/aparc.a2009s+aseg.mgz": b"labels", "surf/lh.pial": b"surface"}
    prepare, config = downloadable(tmp_path, monkeypatch, files)
    provenance = {"sources": []}

    prepare.download_subject(config, provenance)

    written = {
        source["path"]: source for source in provenance["sources"]
    }
    assert set(written) == {"data/example/mri/aparc.a2009s+aseg.mgz", "data/example/surf/lh.pial"}
    for record in written.values():
        assert record["anatomy"] == "example"
        assert len(record["sha256"]) == 64
    assert (config["source_directory"] / "surf/lh.pial").read_bytes() == b"surface"


def test_a_downloaded_file_whose_bytes_changed_is_refused_rather_than_rebuilt(tmp_path, monkeypatch):
    files = {"surf/lh.pial": b"surface"}
    prepare, config = downloadable(tmp_path, monkeypatch, files)
    provenance = {"sources": []}
    prepare.download_subject(config, provenance)

    # An already-present file is never re-fetched, so tampering must be caught
    # by the recorded checksum or it would be built from silently.
    (config["source_directory"] / "surf/lh.pial").write_bytes(b"tampered")
    with pytest.raises(SystemExit, match="recorded checksum"):
        prepare.download_subject(config, provenance)
