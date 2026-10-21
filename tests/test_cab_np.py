import json

import pytest

from brain_model.layers import cab_np

COLUMNS = ["INDEX", "KEYVALUE", "LABEL", "RED", "GREEN", "BLUE", "ALPHA", "HEMISPHERE",
           "NETWORK", "NETWORKKEY", "NETWORKSORTEDORDER", "GLASSERLABELNAME"]

PUBLISHED_NETWORKS = [
    "Visual1", "Visual2", "Somatomotor", "Cingulo-Opercular", "Dorsal-Attention",
    "Language", "Frontoparietal", "Auditory", "Default", "Posterior-Multimodal",
    "Ventral-Multimodal", "Orbito-Affective",
]


def write_key(path, rows):
    lines = ["\t".join(COLUMNS)]
    for index, (hemisphere, name, network, key, color) in enumerate(rows, start=1):
        lines.append("\t".join(map(str, [
            index, index, f"{network}-{index:02d}_{hemisphere}-Ctx", *color, 255,
            hemisphere, network, key, index, name,
        ])))
    path.write_text("\r\n".join(lines) + "\r\n")
    return path


def hcp_region(hemisphere, label, name, kind="cortex"):
    return {"id": f"hcp-mmp:{hemisphere}:{label}", "atlas": "hcp-mmp",
            "hemisphere": hemisphere, "source_name": name, "kind": kind}


def test_the_published_key_assigns_every_area_in_each_hemisphere_once():
    areas, networks = cab_np.read_label_key()
    assert len(areas) == 2 * cab_np.AREAS_PER_HEMISPHERE
    assert [name for name, _ in networks] == PUBLISHED_NETWORKS
    assert areas["left", "L_V1_ROI"] == "Visual1"
    assert dict(networks)["Default"] == [255, 0, 0]


def test_the_published_hemispheric_differences_are_kept():
    areas, _ = cab_np.read_label_key()
    differing = sorted(
        name[2:] for (side, name), network in areas.items()
        if side == "left" and areas["right", f"R_{name[2:]}"] != network
    )
    assert len(differing) == 13
    assert areas["left", "L_44_ROI"] == "Language"
    assert areas["right", "R_44_ROI"] == "Frontoparietal"


def test_a_network_key_with_two_colours_is_rejected(tmp_path):
    rows = [("L", "L_V1_ROI", "Visual1", 1, (0, 0, 255)),
            ("L", "L_V2_ROI", "Visual1", 1, (0, 0, 254))]
    with pytest.raises(ValueError, match="more than one name or colour"):
        cab_np.read_label_key(write_key(tmp_path / "key.txt", rows))


def test_an_area_filed_under_the_other_hemisphere_is_rejected(tmp_path):
    rows = [("L", "R_V1_ROI", "Visual1", 1, (0, 0, 255))]
    with pytest.raises(ValueError, match="listed under hemisphere L"):
        cab_np.read_label_key(write_key(tmp_path / "key.txt", rows))


def test_a_missing_area_count_is_rejected(tmp_path):
    rows = [("L", "L_V1_ROI", "Visual1", 1, (0, 0, 255))]
    with pytest.raises(ValueError, match="1 left areas"):
        cab_np.read_label_key(write_key(tmp_path / "key.txt", rows))


def test_regions_take_their_areas_network_and_non_regions_take_none():
    areas = {("left", "L_V1_ROI"): "Visual1", ("right", "R_44_ROI"): "Frontoparietal"}
    regions = [
        hcp_region("left", 1, "L_V1_ROI"),
        hcp_region("right", 74, "R_44_ROI"),
        hcp_region("left", 0, "???", kind="non-region"),
        {"id": "destrieux:left:1", "atlas": "destrieux", "hemisphere": "left",
         "source_name": "G_and_S_frontomargin", "kind": "cortex"},
    ]
    assert cab_np.assign(regions, areas) == {
        "hcp-mmp:left:1": "Visual1", "hcp-mmp:right:74": "Frontoparietal",
    }


def test_an_area_cab_np_does_not_assign_is_an_error():
    with pytest.raises(ValueError, match="does not assign hcp-mmp:left:1"):
        cab_np.assign([hcp_region("left", 1, "L_V1_ROI")], {})


def test_an_assigned_area_the_anatomy_does_not_publish_is_an_error():
    areas = {("left", "L_V1_ROI"): "Visual1", ("left", "L_V2_ROI"): "Visual2"}
    with pytest.raises(ValueError, match="does not publish"):
        cab_np.assign([hcp_region("left", 1, "L_V1_ROI")], areas)


def test_export_publishes_the_assignments_beside_the_licence_and_original_key(tmp_path):
    areas, _ = cab_np.read_label_key()
    regions = [hcp_region(side, index, name) for index, (side, name) in enumerate(areas)]
    config = {"output_directory": tmp_path / "models" / "snail"}
    (tmp_path / "models" / "licenses").mkdir(parents=True)
    pointer = cab_np.export(config, regions)
    published = json.loads((config["output_directory"] / pointer["file"]).read_text())
    assert published["atlas"] == "hcp-mmp"
    assert published["networks"] == PUBLISHED_NETWORKS
    assert len(published["regions"]) == len(areas)
    licenses = tmp_path / "models" / "licenses"
    assert (licenses / cab_np.PUBLISHED_LABEL_KEY).read_bytes() == cab_np.LABEL_KEY.read_bytes()
    assert (licenses / cab_np.PUBLISHED_LICENSE).read_bytes() == cab_np.LICENSE_TEXT.read_bytes()
