"""Published groupings of HCP-MMP1.0 areas: Glasser's sections and named regions."""

import json
import re

import yaml

from ..sources import ROOT, write_json

ATLAS_ID = "functional-regions"
# Every grouping is a list of Glasser's area names, so it is carried by that atlas alone.
SURFACE_ATLAS = "hcp-mmp"
FILENAME = "functional-regions.json"
DEFINITION = ROOT / "config/functional-regions.yaml"
LEVELS = ("named", "sections")
AREAS_PER_HEMISPHERE = 180
SECTION_COUNT = 22

# The published annotation names an area `L_<area>_ROI` or `R_<area>_ROI`.
AREA_NAME = re.compile(r"(?P<side>[LR])_(?P<area>.+)_ROI")
SIDES = {"left": "L", "right": "R"}


def check_level(level, regions, sources):
    seen = {}
    for region in regions:
        for field in ("id", "name", "name_fr", "short", "short_fr", "source", "areas"):
            if not region.get(field):
                raise ValueError(f"{level} region {region.get('id')} has no {field}")
        if region["source"] not in sources:
            raise ValueError(f"{region['id']}: unknown source {region['source']}")
        color = region.get("color")
        if (not isinstance(color, list) or len(color) != 3
                or any(not isinstance(value, int) or not 0 <= value <= 255 for value in color)):
            raise ValueError(f"{region['id']}: colour must be three sRGB bytes")
        for area in region["areas"]:
            if not isinstance(area, str):
                raise ValueError(f"{region['id']}: area names must be strings, not {area!r}")
            if area in seen:
                raise ValueError(f"Area {area} is in both {seen[area]} and {region['id']}")
            seen[area] = region["id"]
    if len({region["id"] for region in regions}) != len(regions):
        raise ValueError(f"{level} region ids must be unique")
    return seen


def read_definition(path=DEFINITION):
    """The two levels, each checked to give an area at most one region."""
    definition = yaml.safe_load(path.read_text())
    levels = definition["levels"]
    if set(levels) != set(LEVELS):
        raise ValueError(f"Levels must be exactly {LEVELS}")
    sections = levels["sections"]
    if [section["number"] for section in sections] != list(range(1, SECTION_COUNT + 1)):
        raise ValueError(f"Sections must be numbered 1 to {SECTION_COUNT} in order")
    # Sections partition the cortex; named regions cover only what a source names.
    covered = check_level("sections", sections, definition["sources"])
    if len(covered) != AREAS_PER_HEMISPHERE:
        raise ValueError(f"Sections hold {len(covered)} areas, not {AREAS_PER_HEMISPHERE}")
    named = check_level("named", levels["named"], definition["sources"])
    outside = sorted(set(named) - set(covered))
    if outside:
        raise ValueError(f"Named areas outside every section: {outside}")
    numbers = {section["id"]: section["number"] for section in sections}
    for area, placed in definition["contested"].items():
        if numbers[covered[area]] != placed["section"]:
            raise ValueError(f"{area} is recorded in section {placed['section']} but listed in {covered[area]}")
        if placed["text_section"] not in numbers.values() or placed["text_section"] == placed["section"]:
            raise ValueError(f"{area}: the alternative section must be another section")
    for key, source in definition["sources"].items():
        if not all(source.get(field) for field in ("short", "citation", "doi", "pmid")):
            raise ValueError(f"Source {key} needs a short name, citation, DOI and PMID")
        # That the DOI and PMID name the cited work is checked against the fetched
        # records by viewer/learning/references.test.js.
        if not (re.fullmatch(r"https://doi\.org/10\.\d{4,9}/\S+", source["doi"])
                and isinstance(source["pmid"], int) and source["pmid"] > 0):
            raise ValueError(f"Source {key} needs a doi.org DOI and an integer PMID")
    return definition


def area_of(region):
    match = AREA_NAME.fullmatch(region["source_name"])
    if not match or match["side"] != SIDES[region["hemisphere"]]:
        raise ValueError(f"{region['id']}: {region['source_name']} is not a {region['hemisphere']} HCP-MMP area name")
    return match["area"]


def assign(regions, definition):
    """Each published HCP-MMP area's region at both levels, by region id."""
    lookup = {
        level: {area: region["id"] for region in definition["levels"][level] for area in region["areas"]}
        for level in LEVELS
    }
    assigned = {level: {} for level in LEVELS}
    published = {side: set() for side in SIDES}
    for region in regions:
        if region["atlas"] != SURFACE_ATLAS or region["kind"] != "cortex":
            continue
        area = area_of(region)
        if area not in lookup["sections"]:
            raise ValueError(f"No section holds {region['id']} ({region['source_name']})")
        published[region["hemisphere"]].add(area)
        for level in LEVELS:
            if area in lookup[level]:
                assigned[level][region["id"]] = lookup[level][area]
    for side, areas in published.items():
        if areas != set(lookup["sections"]):
            missing = sorted(set(lookup["sections"]) - areas)
            raise ValueError(f"This anatomy does not publish {side} areas {missing}")
    return assigned


def partition(regions):
    definition = read_definition()
    return {
        "id": ATLAS_ID,
        "atlas": SURFACE_ATLAS,
        "sources": definition["sources"],
        "contested": definition["contested"],
        "levels": {level: definition["levels"][level] for level in LEVELS},
        "regions": assign(regions, definition),
    }


def metadata():
    definition = read_definition()
    return {
        "id": ATLAS_ID,
        "file": FILENAME,
        "atlas": SURFACE_ATLAS,
        "label": definition["label"],
        "citations": [source["doi"] for source in definition["sources"].values()],
        "method": (
            "Each HCP-MMP1.0 area takes the section and, where a source names one, the named "
            "region whose published area list holds it, matched by area name in each "
            "hemisphere; carried per area, never per vertex"
        ),
    }


def export(config, regions):
    write_json(config["output_directory"] / FILENAME, partition(regions))
    return metadata()


def validate(config, manifest):
    if manifest["functional_regions"] != metadata():
        raise ValueError("Manifest functional-region metadata mismatch")
    published = json.loads((config["output_directory"] / FILENAME).read_text())
    if published != partition(manifest["regions"]):
        raise ValueError("Functional-region assignments changed")
    counts = {}
    for level, assigned in published["regions"].items():
        counts[level] = {}
        for region in assigned.values():
            counts[level][region] = counts[level].get(region, 0) + 1
    return {
        "assigned_areas": {level: len(assigned) for level, assigned in published["regions"].items()},
        "areas_per_region": counts,
    }


def limitations():
    return [
        "Functional divisions are published groupings of HCP-MMP1.0 areas: the 22 sections of Glasser et al. (2016) and named regions from Glasser et al. (2016) and Rolls et al. (2022, 2023). They reach this brain through the HCP-MMP projection and are not measured in it.",
        "A functional division's borders are HCP-MMP's area borders. No border is drawn for a name no source defines as a set of HCP-MMP areas: dorsomedial prefrontal cortex, a dorsolateral prefrontal cortex narrower than Glasser's section, the temporoparietal junction and the intraparietal sulcus have no named region and are shown only within Glasser's sections.",
        "Glasser's supplement places six areas (23c, 52, PFcm, TF, a47r, pOFC) in one section in its Table 1 and in another in its section texts; the sections follow Table 1's primary column, and the alternative is published beside each.",
    ]
