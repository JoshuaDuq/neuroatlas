import copy
import json

import numpy as np
import pytest
import yaml
from nibabel.freesurfer.io import read_annot, read_geometry

from brain_model.layers import cab_np, functional_regions
from brain_model.sources import ROOT


def hcp_region(hemisphere, label, name, kind="cortex"):
    return {"id": f"hcp-mmp:{hemisphere}:{label}", "atlas": "hcp-mmp",
            "hemisphere": hemisphere, "source_name": name, "kind": kind}


def published_regions():
    """Every area in both hemispheres, named as the HCP-MMP annotation names them."""
    areas, _ = cab_np.read_label_key()
    return [hcp_region(side, index, name) for index, (side, name) in enumerate(areas, start=1)]


def write_definition(path, change):
    definition = copy.deepcopy(yaml.safe_load(functional_regions.DEFINITION.read_text()))
    change(definition)
    path.write_text(yaml.safe_dump(definition, allow_unicode=True))
    return path


def section_of(definition, area):
    return next(section["number"] for section in definition["levels"]["sections"]
                if area in section["areas"])


def test_the_sections_partition_the_areas_cab_np_publishes():
    definition = functional_regions.read_definition()
    areas, _ = cab_np.read_label_key()
    sectioned = [area for section in definition["levels"]["sections"] for area in section["areas"]]
    assert sorted(sectioned) == sorted({name[2:-4] for _, name in areas})


def test_contested_areas_take_table_1s_primary_section():
    definition = functional_regions.read_definition()
    assert {area: section_of(definition, area)
            for area in ["23c", "52", "PFcm", "TF", "a47r", "pOFC"]} == {
        "23c": 7, "52": 10, "PFcm": 10, "TF": 13, "a47r": 21, "pOFC": 19,
    }
    assert {area: placed["text_section"] for area, placed in definition["contested"].items()} == {
        "23c": 18, "52": 12, "PFcm": 9, "TF": 14, "a47r": 20, "pOFC": 20,
    }


def test_a_contested_record_that_disagrees_with_the_listing_is_rejected(tmp_path):
    def disagree(definition):
        definition["contested"]["23c"]["section"] = 18
    with pytest.raises(ValueError, match="23c is recorded in section 18 but listed in section-7"):
        functional_regions.read_definition(write_definition(tmp_path / "d.yaml", disagree))


def test_a_source_without_a_pmid_is_rejected(tmp_path):
    def unpin(definition):
        del definition["sources"]["rolls-2023-pcc"]["pmid"]
    with pytest.raises(ValueError, match="rolls-2023-pcc needs"):
        functional_regions.read_definition(write_definition(tmp_path / "d.yaml", unpin))


def test_named_regions_keep_the_published_area_lists():
    named = {region["id"]: region["areas"]
             for region in functional_regions.read_definition()["levels"]["named"]}
    assert named["m1"] == ["4"]
    assert named["broca"] == ["44", "45"]
    assert named["pregenual-acc"] == ["s32", "a24", "p24", "p32", "d32"]
    assert named["midcingulate"] == ["23c", "24dd", "24dv"]
    assert named["pcc-3"] == ["DVT", "ProS"]


def test_an_area_in_two_sections_is_rejected(tmp_path):
    def duplicate(definition):
        definition["levels"]["sections"][1]["areas"].append("V1")
    with pytest.raises(ValueError, match="V1 is in both section-1 and section-2"):
        functional_regions.read_definition(write_definition(tmp_path / "d.yaml", duplicate))


def test_an_area_in_two_named_regions_is_rejected(tmp_path):
    def duplicate(definition):
        definition["levels"]["named"][1]["areas"].append("V1")
    with pytest.raises(ValueError, match="V1 is in both v1 and mt"):
        functional_regions.read_definition(write_definition(tmp_path / "d.yaml", duplicate))


def test_an_area_left_out_of_every_section_is_rejected(tmp_path):
    def drop(definition):
        definition["levels"]["sections"][0]["areas"] = ["V1", "V2"]
        definition["levels"]["sections"][1]["areas"].remove("V2")
        definition["levels"]["sections"][21]["areas"].remove("46")
    with pytest.raises(ValueError, match="Sections hold 179 areas"):
        functional_regions.read_definition(write_definition(tmp_path / "d.yaml", drop))


def test_a_named_area_that_is_not_an_hcp_mmp_area_is_rejected(tmp_path):
    def invent(definition):
        definition["levels"]["named"][0]["areas"].append("dlPFC")
    with pytest.raises(ValueError, match=r"outside every section: \['dlPFC'\]"):
        functional_regions.read_definition(write_definition(tmp_path / "d.yaml", invent))


def test_a_number_read_as_an_integer_is_rejected(tmp_path):
    def unquote(definition):
        definition["levels"]["named"][3]["areas"] = [4]
    with pytest.raises(ValueError, match="area names must be strings"):
        functional_regions.read_definition(write_definition(tmp_path / "d.yaml", unquote))


def test_sections_out_of_order_are_rejected(tmp_path):
    def swap(definition):
        sections = definition["levels"]["sections"]
        sections[0], sections[1] = sections[1], sections[0]
    with pytest.raises(ValueError, match="numbered 1 to 22"):
        functional_regions.read_definition(write_definition(tmp_path / "d.yaml", swap))


def test_each_area_takes_its_section_and_named_region_in_each_hemisphere():
    assigned = functional_regions.assign(published_regions(), functional_regions.read_definition())
    regions = {region["source_name"] + region["hemisphere"]: region["id"]
               for region in published_regions()}
    left_46 = regions["L_46_ROIleft"]
    right_4 = regions["R_4_ROIright"]
    assert assigned["sections"][left_46] == "section-22"
    assert left_46 not in assigned["named"]
    assert assigned["sections"][right_4] == "section-6"
    assert assigned["named"][right_4] == "m1"
    assert len(assigned["sections"]) == 2 * functional_regions.AREAS_PER_HEMISPHERE


def test_non_regions_and_other_atlases_take_nothing():
    regions = [*published_regions(), hcp_region("left", 0, "???", kind="non-region"),
               {"id": "destrieux:left:1", "atlas": "destrieux", "hemisphere": "left",
                "source_name": "G_and_S_frontomargin", "kind": "cortex"}]
    assigned = functional_regions.assign(regions, functional_regions.read_definition())
    assert "hcp-mmp:left:0" not in assigned["sections"]
    assert "destrieux:left:1" not in assigned["sections"]


def test_an_area_named_for_the_other_hemisphere_is_rejected():
    with pytest.raises(ValueError, match="is not a left HCP-MMP area name"):
        functional_regions.assign([hcp_region("left", 1, "R_V1_ROI")],
                                  functional_regions.read_definition())


def test_an_anatomy_missing_an_area_is_rejected():
    regions = [region for region in published_regions() if region["source_name"] != "R_V1_ROI"]
    with pytest.raises(ValueError, match=r"does not publish right areas \['V1'\]"):
        functional_regions.assign(regions, functional_regions.read_definition())


def test_export_publishes_both_levels_and_their_sources(tmp_path):
    config = {"output_directory": tmp_path / "models" / "snail"}
    pointer = functional_regions.export(config, published_regions())
    published = json.loads((config["output_directory"] / pointer["file"]).read_text())
    assert published["atlas"] == "hcp-mmp"
    assert list(published["levels"]) == ["named", "sections"]
    assert len(published["levels"]["sections"]) == 22
    assert set(published["sources"]) == {region["source"] for level in published["levels"].values()
                                         for region in level}
    manifest = {"functional_regions": pointer, "regions": published_regions()}
    report = functional_regions.validate(config, manifest)
    assert report["assigned_areas"] == {"named": 114, "sections": 360}


# Machado, Oliveira & Fernandes (2009) dichromacy at severity 1, on linear sRGB.
SIMULATIONS = {
    "normal": np.eye(3),
    "protan": np.array([[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216],
                        [-0.003882, -0.048116, 1.051998]]),
    "deutan": np.array([[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413],
                        [-0.011820, 0.042940, 0.968881]]),
}


def oklab(rgb):
    lms = np.cbrt(np.array([[0.4122214708, 0.5363325363, 0.0514459929],
                            [0.2119034982, 0.6806995451, 0.1073969566],
                            [0.0883024619, 0.2817188376, 0.6299787005]]) @ rgb)
    return np.array([[0.2104542553, 0.7936177850, -0.0040720468],
                     [1.9779984951, -2.4285922050, 0.4505937099],
                     [0.0259040371, 0.7827717662, -0.8086757660]]) @ lms


def linear(color):
    srgb = np.asarray(color) / 255
    return np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)


@pytest.mark.parametrize("subject", ["fsaverage", "cdmd"])
@pytest.mark.parametrize("level", functional_regions.LEVELS)
def test_regions_that_share_a_surface_edge_differ_in_colour_for_dichromats_too(subject, level):
    definition = functional_regions.read_definition()
    regions = {region["id"]: region for region in definition["levels"][level]}
    lookup = {area: region["id"] for region in regions.values() for area in region["areas"]}
    for prefix in ("lh", "rh"):
        labels, _, names = read_annot(ROOT / f"data/{subject}/label/{prefix}.HCPMMP1.annot")
        _, faces = read_geometry(ROOT / f"data/{subject}/surf/{prefix}.white")
        # A vertex in no area is labelled -1, which reads the trailing None.
        owner = np.array([lookup.get(name.decode()[2:-4]) for name in names] + [None], dtype=object)
        edges = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
        pairs = {tuple(sorted(pair)) for pair in zip(owner[labels[edges[:, 0]]], owner[labels[edges[:, 1]]])
                 if None not in pair and pair[0] != pair[1]}
        assert pairs
        for first, second in pairs:
            for kind, matrix in SIMULATIONS.items():
                a, b = (oklab(np.clip(matrix @ linear(regions[id]["color"]), 0, 1)) for id in (first, second))
                assert 100 * np.linalg.norm(a - b) >= 15, f"{first} and {second} under {kind} vision"
