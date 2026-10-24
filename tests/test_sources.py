"""Which brain gets published is a configuration choice, not a code path."""

import json

import pytest
import yaml

from brain_model.build import anatomy_limitations
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
                "layers": [],
                "nextbrain": {"directory": "data/nb-first", "volume": "first.mgz"},
            },
            "second": {
                "subject": "second",
                "label": "Second brain",
                "individual": True,
                "directory": "data/second",
                "source_url": "https://example.invalid/second",
                "reconstruction": {"input": "second.nii.gz", "input_sha256": "0" * 64},
                "project_hcp_from": "first",
                "layers": ["nextbrain", "spinal_cord"],
                "nextbrain": {"directory": "data/nb-second", "volume": "second.mgz"},
            },
        },
        "output_directory": "public/models",
        "nextbrain": {"lut": "lut.txt", "minimum_mesh_volume_mm3": 10},
    }


def test_the_selected_anatomy_becomes_the_shape_every_build_step_reads():
    config = resolve_config(document())
    assert config["anatomy"]["id"] == "second"
    assert config["anatomy"]["subject"] == "second"
    assert config["source_directory"] == ROOT / "data/second"
    # Per-anatomy warp settings, folded onto the shared ones.
    assert config["nextbrain"]["directory"] == ROOT / "data/nb-second"
    assert config["nextbrain"]["volume"] == "second.mgz"
    assert config["nextbrain"]["minimum_mesh_volume_mm3"] == 10
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
    # Nothing to reconstruct and no spheres to resample: absence is the declaration.
    assert "reconstruction" not in switched["anatomy"]
    assert "project_hcp_from" not in switched["anatomy"]
    assert "hcp_source_directory" not in switched["anatomy"]


def test_subject_structure_coverage_preserves_shared_smoothing_and_other_subjects():
    declared = document()
    shared = {"labels": [4, 31, 63, 85], "smoothing": {"iterations": 16}}
    declared["structures"] = shared
    declared["anatomies"]["second"]["structures"] = {"labels": [4]}
    selected = resolve_config(declared)
    assert selected["structures"] == {
        "labels": [4], "smoothing": {"iterations": 16},
    }
    assert resolve_config({**declared, "anatomy": "first"})["structures"] == shared
    assert declared["structures"]["labels"] == [4, 31, 63, 85]


def test_projecting_from_an_undeclared_brain_is_refused():
    broken = document()
    broken["anatomies"]["second"]["project_hcp_from"] = "nowhere"
    with pytest.raises(ValueError, match="nowhere"):
        resolve_config(broken)


def test_an_undeclared_anatomy_is_refused_rather_than_half_built():
    with pytest.raises(ValueError, match="anatomies"):
        resolve_config({**document(), "anatomy": "third"})


@pytest.mark.parametrize("layers", [["tracts"], ["nextbrain", "nextbrain"]])
def test_an_unknown_or_repeated_layer_is_refused(layers):
    broken = document()
    broken["anatomies"]["second"]["layers"] = layers
    with pytest.raises(ValueError, match="layers"):
        resolve_config(broken)


def test_layers_are_what_the_anatomy_declares():
    from brain_model.sources import declares

    config = resolve_config(document())
    assert declares(config, "nextbrain") and declares(config, "spinal_cord")
    assert not declares(config, "networks")
    assert not declares(resolve_config({**document(), "anatomy": "first"}), "nextbrain")
    with pytest.raises(ValueError, match="Unknown layer"):
        declares(config, "tracts")


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


def test_reconstructed_anatomy_publishes_its_source_coverage_limits(tmp_path):
    limitation = "The source scan does not cover the inferior brainstem."
    (tmp_path / "reconstruction.json").write_text(json.dumps({
        "limitations": [limitation],
    }))
    config = {
        "anatomy": {"individual": True, "reconstruction": {
            "provenance": "reconstruction.json",
        }},
        "source_directory": tmp_path,
    }
    assert limitation in anatomy_limitations(config)


def test_every_declared_anatomy_resolves_and_every_source_tag_names_one():
    declared = yaml.safe_load((ROOT / "config/model.yaml").read_text())
    names = set(declared["anatomies"])
    for name in names:
        resolved = resolve_config({**declared, "anatomy": name})
        assert resolved["anatomy"]["id"] == name
        assert resolved["source_directory"].is_dir()
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
    other = "fsaverage" if selected["anatomy"]["id"] != "fsaverage" else "snail"
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


def reconstructed(tmp_path, monkeypatch):
    prepare = load_prepare_subject()
    monkeypatch.setattr(prepare, "ROOT", tmp_path)
    monkeypatch.setattr(prepare, "SUBJECT_FILES", ["mri/brain.mgz", "scripts/build-stamp.txt"])
    input_path = tmp_path / "input.nii.gz"
    input_path.write_bytes(b"source MRI")
    settings = {
        "input": "input.nii.gz", "input_sha256": prepare.sha256(input_path),
        "provenance": "reconstruction.json", "completion_marker": "scripts/recon-all.done",
    }
    directory = tmp_path / "data/snail"
    config = {
        "source_directory": directory,
        "freesurfer_build": "FreeSurfer-test",
        "anatomy": {"id": "snail", "source_url": "https://hdl.handle.net/1773/38477",
                    "reconstruction": settings},
    }
    for name, value in {
        "mri/brain.mgz": b"brain", "scripts/build-stamp.txt": b"FreeSurfer-test\n",
        "scripts/recon-all.done": b"done",
    }.items():
        path = directory / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(value)
    (directory / "reconstruction.json").write_text(json.dumps({
        "status": "complete", "input_sha256": settings["input_sha256"],
        "freesurfer_build": config["freesurfer_build"],
        "output_sha256": {
            name: prepare.sha256(directory / name)
            for name in ["mri/brain.mgz", "scripts/build-stamp.txt"]
        },
        "completion_marker_sha256": prepare.sha256(directory / "scripts/recon-all.done"),
    }))
    return prepare, config


def test_generated_reconstruction_records_its_input_and_required_outputs(tmp_path, monkeypatch):
    prepare, config = reconstructed(tmp_path, monkeypatch)
    provenance = {"sources": []}
    prepare.obtain_subject(config, provenance)
    records = {source["path"]: source for source in provenance["sources"]}
    assert set(records) == {"input.nii.gz", "data/snail/mri/brain.mgz",
                           "data/snail/scripts/build-stamp.txt", "data/snail/reconstruction.json"}
    assert all(record["anatomy"] == "snail" for record in records.values())
    assert records["data/snail/mri/brain.mgz"]["derived_from"] == ["input.nii.gz"]


@pytest.mark.parametrize("missing", ["reconstruction.json", "scripts/recon-all.done", "mri/brain.mgz"])
def test_incomplete_reconstruction_is_not_recorded(tmp_path, monkeypatch, missing):
    prepare, config = reconstructed(tmp_path, monkeypatch)
    (config["source_directory"] / missing).unlink()
    provenance = {"sources": []}
    with pytest.raises(ValueError, match="incomplete"):
        prepare.obtain_subject(config, provenance)
    assert provenance == {"sources": []}


def test_reconstruction_whose_original_input_changed_is_refused(tmp_path, monkeypatch):
    prepare, config = reconstructed(tmp_path, monkeypatch)
    (tmp_path / "input.nii.gz").write_bytes(b"different MRI")
    with pytest.raises(ValueError, match="checksum"):
        prepare.obtain_subject(config, {"sources": []})


@pytest.mark.parametrize("changed", ["mri/brain.mgz", "scripts/recon-all.done"])
def test_outputs_the_report_does_not_describe_are_never_recorded(
    tmp_path, monkeypatch, changed
):
    # Even when replacing records is asked for: the report describes the run,
    # so a file that no longer matches it is not that run's output.
    prepare, config = reconstructed(tmp_path, monkeypatch)
    (config["source_directory"] / changed).write_bytes(b"rewritten")
    provenance = {"sources": []}
    with pytest.raises(ValueError, match="differ from reconstruction.json"):
        prepare.obtain_subject(config, provenance, rerecord=True)
    assert provenance == {"sources": []}


def test_a_report_that_omits_a_required_output_is_refused(tmp_path, monkeypatch):
    prepare, config = reconstructed(tmp_path, monkeypatch)
    path = config["source_directory"] / "reconstruction.json"
    report = json.loads(path.read_text())
    del report["output_sha256"]["mri/brain.mgz"]
    path.write_text(json.dumps(report))
    with pytest.raises(ValueError, match="exactly the required outputs"):
        prepare.obtain_subject(config, {"sources": []})


def test_rerecording_a_changed_reconstruction_needs_the_explicit_flag(tmp_path, monkeypatch):
    prepare, config = reconstructed(tmp_path, monkeypatch)
    provenance = {"sources": [{"path": "data/snail/mri/brain.mgz", "sha256": "0" * 64}]}
    with pytest.raises(ValueError, match="--rerecord"):
        prepare.obtain_subject(config, provenance)
    assert provenance["sources"][0]["sha256"] == "0" * 64

    prepare.obtain_subject(config, provenance, rerecord=True)
    records = {source["path"]: source for source in provenance["sources"]}
    assert records["data/snail/mri/brain.mgz"]["sha256"] == prepare.sha256(
        config["source_directory"] / "mri/brain.mgz"
    )


def test_rerecording_an_unchanged_reconstruction_needs_no_flag(tmp_path, monkeypatch):
    prepare, config = reconstructed(tmp_path, monkeypatch)
    provenance = {"sources": []}
    prepare.obtain_subject(config, provenance)
    before = json.loads(json.dumps(provenance))
    prepare.obtain_subject(config, provenance)
    assert sorted(before["sources"], key=lambda s: s["path"]) == sorted(
        provenance["sources"], key=lambda s: s["path"]
    )


def test_both_hemispheres_white_matter_is_drawn_in_one_colour():
    # The bundled 2012 table paints label 41 green, which turned one hemisphere's
    # white matter green on every cut. FreeSurfer's current table corrected it.
    from brain_model.sources import read_color_table

    table = read_color_table()
    assert table[41] == ("Right-Cerebral-White-Matter", [245, 245, 245])
    assert table[2] == ("Left-Cerebral-White-Matter", [245, 245, 245])


def test_network_annotations_are_projected_exactly_when_declared(monkeypatch):
    prepare = load_prepare_subject()
    projected = []
    monkeypatch.setattr(
        prepare, "transfer_annotation",
        lambda config, provenance, name, report, rerecord=False: projected.append(name),
    )
    config = {"anatomy": {"id": "x", "project_hcp_from": "fsaverage", "layers": []}}
    prepare.transfer_annotations(config, {"sources": []})
    assert projected == ["HCPMMP1"]
    projected.clear()
    config["anatomy"]["layers"] = ["networks"]
    prepare.transfer_annotations(config, {"sources": []})
    assert projected == ["HCPMMP1", "Schaefer2018_400Parcels_7Networks_order"]


def test_a_projection_whose_source_annotation_is_missing_is_refused(tmp_path):
    prepare = load_prepare_subject()
    config = {"anatomy": {"id": "x", "hcp_source_directory": tmp_path},
              "source_directory": tmp_path}
    with pytest.raises(SystemExit, match="not published"):
        prepare.transfer_annotation(config, {"sources": []}, "HCPMMP1", "hcp.json")


@pytest.mark.parametrize("anatomy", ["cdmd"])
def test_every_source_a_published_anatomy_builds_from_is_committed_and_unchanged(anatomy):
    # A pinned path that is a symlink is read through its target, so a link
    # committed without its target fails here as surely as a missing file.
    from brain_model.build import require_layer_inputs
    from brain_model.sources import read_config, verify_sources

    config = read_config(anatomy)
    verify_sources(config)
    require_layer_inputs(config)


def test_an_output_the_report_predates_is_recorded_only_when_declared(tmp_path, monkeypatch):
    prepare, config = reconstructed(tmp_path, monkeypatch)
    monkeypatch.setattr(prepare, "SUBJECT_FILES", [*prepare.SUBJECT_FILES, "stats/aseg.stats"])
    stats = config["source_directory"] / "stats/aseg.stats"
    stats.parent.mkdir()
    stats.write_text("# Measure SurfaceHoles, SurfaceHoles, Holes, 0, unitless\n")
    with pytest.raises(ValueError, match="exactly the required outputs"):
        prepare.obtain_subject(config, {"sources": []})
    config["anatomy"]["reconstruction"]["unreported_outputs"] = ["stats/aseg.stats"]
    provenance = {"sources": []}
    prepare.obtain_subject(config, provenance)
    assert "data/snail/stats/aseg.stats" in {source["path"] for source in provenance["sources"]}
