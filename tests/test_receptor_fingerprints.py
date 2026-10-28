import copy
import importlib.util
import json

import pytest
import yaml

from brain_model.layers import receptor_fingerprints
from brain_model.sources import ROOT


def load_script():
    """scripts/ is not a package, so the script is loaded by path."""
    spec = importlib.util.spec_from_file_location(
        "fetch_receptor_fingerprints", ROOT / "scripts/fetch_receptor_fingerprints.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


fetch = load_script()


def published_regions():
    return json.loads((ROOT / "public/models/cdmd/manifest.json").read_text())["regions"]


def write_definition(path, change):
    definition = copy.deepcopy(yaml.safe_load(receptor_fingerprints.DEFINITION.read_text()))
    change(definition)
    path.write_text(yaml.safe_dump(definition, allow_unicode=True))
    return path


def dataset(definition, key):
    return next(d for d in definition["datasets"] if d["key"] == key)


def test_every_dataset_reaches_its_regions_in_both_hemispheres_of_cdmd():
    definition = receptor_fingerprints.read_definition()
    assigned = receptor_fingerprints.assign(published_regions(), definition)
    reached = {key for keys in assigned.values() for key in keys}
    assert reached == {d["key"] for d in definition["datasets"]}
    regions = {region["id"]: region for region in published_regions()}
    julich = sorted({regions[id]["source_name"] for id in assigned if id.startswith("julich:")})
    assert len(julich) == 30
    assert {"Area 44 (IFG)", "Area IFS1 (IFS)", "CA1 (Hippocampus)", "Area hOc3v (LingG)"} <= set(julich)
    sides = {}
    for id, keys in assigned.items():
        region = regions[id]
        name = region["source_name"].removeprefix("Left-").removeprefix("Right-")
        sides.setdefault((region["atlas"], name), {})[region["hemisphere"]] = keys
    assert all(set(side) == {"left", "right"} and side["left"] == side["right"] for side in sides.values())


def test_an_area_sampled_in_parts_takes_both_and_aseg_names_carry_their_side():
    assigned = receptor_fingerprints.assign(published_regions(), receptor_fingerprints.read_definition())
    assert assigned["julich:left:2"] == ["44d", "44v"]
    assert assigned["aseg:left:12"] == ["Pu"] and assigned["aseg:right:51"] == ["Pu"]
    assert assigned["aseg:left:13"] == ["GP"] and assigned["aseg:right:52"] == ["GP"]


def test_an_atlas_the_anatomy_does_not_publish_is_skipped_but_a_missing_name_fails():
    definition = receptor_fingerprints.read_definition()
    without_learning = [r for r in published_regions() if r["atlas"] != "learning"]
    # Without the skip, the learning targets would raise as missing names.
    assert receptor_fingerprints.assign(without_learning, definition)["aseg:left:12"] == ["Pu"]
    renamed = [r for r in published_regions() if r["source_name"] != "CA2 (Hippocampus)"]
    with pytest.raises(ValueError, match="0 left julich regions are named CA2"):
        receptor_fingerprints.assign(renamed, definition)


def test_two_fingerprints_on_one_region_must_be_distinct_parts(tmp_path):
    def same_part(definition):
        dataset(definition, "44v")["part"] = "dorsal"
    with pytest.raises(ValueError, match="Area 44 .* not distinct parts"):
        receptor_fingerprints.read_definition(write_definition(tmp_path / "d.yaml", same_part))

    def lone_part(definition):
        definition["datasets"].remove(dataset(definition, "44v"))
    with pytest.raises(ValueError, match="Area 44 \\(IFG\\) takes only the dorsal part"):
        receptor_fingerprints.read_definition(write_definition(tmp_path / "d.yaml", lone_part))


def test_the_published_fingerprints_hold_the_ebrains_values():
    data = {d["key"]: d for d in json.loads(receptor_fingerprints.DATA.read_text())["datasets"]}
    assert data["44v"]["receptors"]["NMDA"] == {"mean": 1129, "sd": 382}
    assert data["44v"]["receptors"]["D1"] == {"mean": 69, "sd": 32}
    # Published without an SD, and withheld as a transcription error: neither becomes a number.
    assert data["PF"]["receptors"]["alpha2"] == {"mean": 837, "sd": None}
    assert data["ifs1"]["receptors"]["D1"] == {"mean": 78, "sd": None}
    assert data["ifs1"]["receptors"]["A1"] == {"mean": 863, "sd": 435}
    assert "mGluR2/3" in data["ifs1"]["receptors"] and "mGluR2/3" in data["44v"]["receptors"]
    assert [donor["id"] for donor in data["Pu"]["donors"]] == ["AR04", "AR05"]


def fingerprint_file(tmp_path, rows):
    path = tmp_path / "fp.tsv"
    path.write_text("receptor label (x)\tdensity (mean)\tdensity (sd)\tdensity (unit)\n"
                    + "".join("\t".join(row) + "\n" for row in rows))
    return path


def test_a_withheld_value_fails_the_fetch_once_the_source_changes(tmp_path):
    definition = receptor_fingerprints.read_definition()
    ifs1 = dataset(definition, "ifs1")
    published = fingerprint_file(tmp_path, [["D1", "78", "863", "fmol/mg"], ["A1", "863", "435", "fmol/mg"]])
    assert fetch.read_fingerprint(published, definition, ifs1)["D1"] == {"mean": 78, "sd": None}
    corrected = fingerprint_file(tmp_path, [["D1", "78", "30", "fmol/mg"]])
    with pytest.raises(SystemExit, match="withheld D1 sd is now 30, not 863"):
        fetch.read_fingerprint(corrected, definition, ifs1)


def test_a_fingerprint_in_another_unit_or_with_an_unknown_receptor_is_refused(tmp_path):
    definition = receptor_fingerprints.read_definition()
    with pytest.raises(SystemExit, match="NMDA is in pmol/mg"):
        fetch.read_fingerprint(fingerprint_file(tmp_path, [["NMDA", "1", "1", "pmol/mg"]]),
                               definition, dataset(definition, "3b"))
    with pytest.raises(SystemExit, match="unknown receptor H3"):
        fetch.read_fingerprint(fingerprint_file(tmp_path, [["H3", "1", "1", "fmol/mg"]]),
                               definition, dataset(definition, "3b"))


def test_the_ifs_files_quoted_and_space_separated_lines_read_as_their_columns(tmp_path):
    path = tmp_path / "samples.csv"
    path.write_text('"tissue sample (ID)\themisphere\tfrom subject (ID)\tpathology"\r\n'
                    '"AR01_R\tright\tAR01\thealthy"\r\nAR02_L left AR02 healthy\r\n')
    assert fetch.rows(path, fetch.SAMPLE_COLUMNS) == [["AR01_R", "right", "AR01", "healthy"],
                                                     ["AR02_L", "left", "AR02", "healthy"]]


def test_only_an_sd_can_be_withheld(tmp_path):
    def withhold_mean(definition):
        definition["withheld"][0]["field"] = "mean"
    with pytest.raises(ValueError, match="names no published value or gives no reason"):
        receptor_fingerprints.read_definition(write_definition(tmp_path / "d.yaml", withhold_mean))


def test_a_blank_sd_in_a_tab_row_is_no_sd_and_a_repeated_sample_is_refused(tmp_path):
    definition = receptor_fingerprints.read_definition()
    blank = fingerprint_file(tmp_path, [["alpha2", "837", "", "fmol/mg"]])
    assert fetch.read_fingerprint(blank, definition, dataset(definition, "PF"))["alpha2"] == {
        "mean": 837, "sd": None}
    subjects, samples = tmp_path / "subjects.tsv", tmp_path / "samples.tsv"
    subjects.write_text("subject (ID)\tsex\tage (value)\tage (unit)\nAR04\tfemale\t77\tyears\n")
    samples.write_text("tissue sample (ID)\themisphere\tfrom subject (ID)\tpathology\n"
                       + "AR04_L\tleft\tAR04\thealthy\n" * 2)
    with pytest.raises(SystemExit, match="a tissue sample is listed twice"):
        fetch.read_donors(subjects, samples, "x")


def test_a_value_cut_at_a_comma_is_refused_rather_than_published(tmp_path):
    def cut(definition):
        dataset(definition, "hOc1")["measured_in"] = "Area hOc1 (V1"
        dataset(definition, "hOc1")["17"] = None
    with pytest.raises(ValueError, match="hOc1 has unexpected keys"):
        receptor_fingerprints.read_definition(write_definition(tmp_path / "d.yaml", cut))
    assert dataset(receptor_fingerprints.read_definition(), "hOc1")["measured_in"] == "Area hOc1 (V1, 17, CalcS)"
