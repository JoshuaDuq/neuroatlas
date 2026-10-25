"""Chosen Neurosynth abstract terms' consistency maps on HCP-MMP areas and aseg structures, for search."""

import json
import math

import yaml

from ..sources import ROOT, declares, write_json
from .functional_regions import AREA_NAME, AREAS_PER_HEMISPHERE, area_of
from .neuropsych_domains import STRUCTURE_ATLAS, STRUCTURES, SURFACE_ATLAS
from .neuropsych_domains import read_definition as read_domains

ATLAS_ID = "neurosynth-terms"
FILENAME = "neurosynth-terms.json"
DEFINITION = ROOT / "config/neurosynth-terms.yaml"
SCORES = ROOT / "data/neurosynth-terms/term-scores.json"
# Each list in the definition, and the kind its terms are published as.
KINDS = {"functions": "function", "populations": "population"}


def read_definition(path=DEFINITION):
    definition = yaml.safe_load(path.read_text())
    if not (definition.get("label") and definition.get("method") and definition.get("limitations")):
        raise ValueError("Term search needs a label, method and limitations")
    for kind in KINDS:
        terms = definition[kind]
        if terms != sorted(set(terms)):
            raise ValueError(f"Term search {kind} must be sorted and unique")
    if set(definition["functions"]) & set(definition["populations"]):
        raise ValueError("A term is both a function and a population")
    return definition


def is_declared(config):
    return declares(config, "neurosynth_terms")


def read_scores(path=SCORES):
    """The vocabulary in order, each term's study count and its mean z per area and per structure."""
    scores = json.loads(path.read_text())
    areas, structures = scores["areas"], scores["structures"]
    if len(areas) != 2 * AREAS_PER_HEMISPHERE or not all(AREA_NAME.fullmatch(name) for name in areas):
        raise ValueError(f"Term scores must name all {2 * AREAS_PER_HEMISPHERE} HCP-MMP areas")
    if set(structures) != set(STRUCTURES.values()):
        raise ValueError("Term scores must name every aseg structure sampled")
    terms = [term for term, *_ in scores["terms"]]
    if len(set(terms)) != len(terms):
        raise ValueError("A term is scored twice")
    for term, studies, area_z, structure_z in scores["terms"]:
        if not (isinstance(studies, int) and studies > 0 and len(area_z) == len(areas)
                and len(structure_z) == len(structures)
                and all(math.isfinite(value) for value in area_z + structure_z)):
            raise ValueError(f"{term}: needs a study count and a finite z for every area and structure")
    return scores


def partition(regions):
    """
    The scored regions of this anatomy, and for each offered term its kind and the regions whose mean
    z reaches the domains' threshold, strongest first, by their index in that list. A chosen term the
    curated functions use, or whose map reaches nothing, is not offered.
    """
    definition = read_definition()
    domains = read_domains()
    scores = read_scores()
    derived = {term for term, *_ in scores["terms"]}
    chosen = {term: kind for key, kind in KINDS.items() for term in definition[key]}
    if set(chosen) - derived:
        raise ValueError(f"No derived scores for chosen terms {sorted(set(chosen) - derived)}")
    curated = {domain["term"] for domain in domains["domains"]}
    scored = sorted((region for region in regions
                     if (region["atlas"] == SURFACE_ATLAS and region["kind"] == "cortex")
                     or (region["atlas"] == STRUCTURE_ATLAS and region["source_name"] in STRUCTURES.values())),
                    key=lambda region: region["id"])
    for region in scored:
        if region["atlas"] == SURFACE_ATLAS:
            area_of(region)
    columns = {name: index for index, name in enumerate(scores["areas"] + scores["structures"])}
    threshold = domains["threshold_z"]
    terms = []
    for term, studies, area_z, structure_z in scores["terms"]:
        if term not in chosen or term in curated:
            continue
        z = area_z + structure_z
        reached = [(index, round(z[columns[region["source_name"]]], 2)) for index, region in enumerate(scored)
                   if z[columns[region["source_name"]]] >= threshold]
        if reached:
            terms.append([term, studies, chosen[term],
                          [list(pair) for pair in sorted(reached, key=lambda pair: -pair[1])]])
    return {
        "id": ATLAS_ID,
        "atlas": SURFACE_ATLAS,
        "structure_atlas": STRUCTURE_ATLAS,
        "threshold_z": threshold,
        "derivation": scores["derivation"],
        "regions": [region["id"] for region in scored],
        "terms": terms,
    }


def metadata():
    definition = read_definition()
    domains = read_domains()
    source = domains["sources"][domains["scores_source"]]
    return {
        "id": ATLAS_ID,
        "file": FILENAME,
        "atlas": SURFACE_ATLAS,
        "label": definition["label"],
        "citations": [source["doi"]],
        "license": source["license"],
        "license_url": source["license_url"],
        "method": definition["method"],
    }


def export(config, regions):
    if not is_declared(config):
        return None
    write_json(config["output_directory"] / FILENAME, partition(regions))
    return metadata()


def validate(config, manifest):
    if manifest["neurosynth_terms"] != metadata():
        raise ValueError("Manifest Neurosynth term metadata mismatch")
    published = json.loads((config["output_directory"] / FILENAME).read_text())
    if published != partition(manifest["regions"]):
        raise ValueError("Neurosynth term assignments changed")
    return {kind: sum(entry[2] == kind for entry in published["terms"]) for kind in KINDS.values()}


def limitations(config):
    return read_definition()["limitations"] if is_declared(config) else []
