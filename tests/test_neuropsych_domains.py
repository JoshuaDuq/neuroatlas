import copy

import pytest
import yaml

from brain_model.layers import cab_np, neuropsych_domains


def hcp_region(hemisphere, label, name, kind="cortex"):
    return {"id": f"hcp-mmp:{hemisphere}:{label}", "atlas": "hcp-mmp",
            "hemisphere": hemisphere, "source_name": name, "kind": kind}


def published_regions():
    areas, _ = cab_np.read_label_key()
    return [hcp_region(side, index, name) for index, (side, name) in enumerate(areas, start=1)]


def write_definition(path, change):
    definition = copy.deepcopy(yaml.safe_load(neuropsych_domains.DEFINITION.read_text()))
    change(definition)
    path.write_text(yaml.safe_dump(definition, allow_unicode=True))
    return path


def test_every_area_is_scored_for_every_domain():
    definition = neuropsych_domains.read_definition()
    scores = neuropsych_domains.read_scores(definition)
    areas, _ = cab_np.read_label_key()
    for domain in definition["domains"]:
        assert set(scores["scores"][domain["id"]]) == {name for _, name in areas}


def test_an_area_takes_the_domains_it_reaches_strongest_share_of_peak_first():
    definition = neuropsych_domains.read_definition()
    scores = neuropsych_domains.read_scores(definition)
    regions = published_regions()
    assigned = neuropsych_domains.assign(regions, definition, scores)
    threshold = definition["threshold_z"]
    peak = {domain: max(areas.values()) for domain, areas in scores["scores"].items()}
    for region in regions:
        found = assigned.get(region["id"], [])
        z = {domain: areas[region["source_name"]] for domain, areas in scores["scores"].items()}
        assert {member["domain"] for member in found} == {d for d, value in z.items() if value >= threshold}
        shares = [z[member["domain"]] / peak[member["domain"]] for member in found]
        assert shares == sorted(shares, reverse=True)
    for domain in definition["domains"]:
        assert any(member["domain"] == domain["id"] for found in assigned.values() for member in found)


def test_only_hcp_mmp_cortex_is_assigned():
    definition = neuropsych_domains.read_definition()
    scores = neuropsych_domains.read_scores(definition)
    regions = [hcp_region("left", 1, "L_V1_ROI", kind="non-region"),
               {**hcp_region("left", 2, "L_V1_ROI"), "atlas": "destrieux"}]
    assert neuropsych_domains.assign(regions, definition, scores) == {}
    with pytest.raises(ValueError, match="not a left HCP-MMP area name"):
        neuropsych_domains.assign([hcp_region("left", 1, "R_V1_ROI")], definition, scores)


def test_scores_derived_for_other_terms_are_rejected(tmp_path):
    def rename(definition):
        definition["domains"][0]["term"] = "cognition"
    definition = neuropsych_domains.read_definition(write_definition(tmp_path / "d.yaml", rename))
    with pytest.raises(ValueError, match="Scores were derived for"):
        neuropsych_domains.read_scores(definition)


def test_a_lesion_check_must_name_a_published_association(tmp_path):
    def invent(definition):
        definition["domains"][0]["lesion_checks"] = ["telepathy-frontal"]
    with pytest.raises(ValueError, match="no lesion association"):
        neuropsych_domains.read_definition(write_definition(tmp_path / "d.yaml", invent))


def test_a_domain_must_belong_to_a_defined_group(tmp_path):
    def regroup(definition):
        definition["domains"][0]["group"] = "metacognition"
    with pytest.raises(ValueError, match="unknown group"):
        neuropsych_domains.read_definition(write_definition(tmp_path / "d.yaml", regroup))


def test_the_overview_flag_is_a_boolean_and_holds_some_domain(tmp_path):
    def stringly(definition):
        definition["domains"][0]["overview"] = "yes"
    with pytest.raises(ValueError, match="overview must be true or false"):
        neuropsych_domains.read_definition(write_definition(tmp_path / "a.yaml", stringly))

    def none(definition):
        for domain in definition["domains"]:
            domain.pop("overview", None)
    with pytest.raises(ValueError, match="At least one domain must be in the overview"):
        neuropsych_domains.read_definition(write_definition(tmp_path / "b.yaml", none))


def test_lesion_checks_measure_cortical_parcels_and_mark_the_rest():
    definition = neuropsych_domains.read_definition()
    checks = neuropsych_domains.lesion_checks(definition, neuropsych_domains.read_scores(definition))
    mappings = [mapping for domain in checks.values() for check in domain for mapping in check["mappings"]]
    assert mappings
    for mapping in mappings:
        cortical = mapping["region"].startswith("destrieux:")
        assert (mapping["coverage"] is None) != cortical
        assert mapping["coverage"] is None or 0 <= mapping["coverage"] <= 1


def test_short_citations_follow_the_author_count():
    assert neuropsych_domains.short_citation({"authors": "Dronkers NF", "year": 1996}) == "Dronkers 1996"
    assert neuropsych_domains.short_citation(
        {"authors": "Goldenberg G, Karnath HO", "year": 2006}) == "Goldenberg and Karnath 2006"
    assert neuropsych_domains.short_citation(
        {"authors": "Van Valin RD Jr, Dronkers NF, Baldo JV", "year": 2004}) == "Van Valin et al. 2004"

