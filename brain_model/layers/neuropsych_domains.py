"""Neuropsychological domains: each HCP-MMP1.0 area's meta-analytic association with a domain term."""

import json
import math
import re

import numpy as np
import yaml
from nibabel.freesurfer.io import read_annot

from ..sources import HEMISPHERES, ROOT, write_json
from .functional_regions import AREA_NAME, AREAS_PER_HEMISPHERE, area_of

ATLAS_ID = "neuropsych-domains"
SURFACE_ATLAS = "hcp-mmp"
FILENAME = "neuropsych-domains.json"
DEFINITION = ROOT / "config/neuropsych-domains.yaml"
SCORES = ROOT / "data/neuropsych-domains/area-scores.json"
NEUROPSYCHOLOGY = ROOT / "data/neuropsychology.yaml"
FSAVERAGE = ROOT / "data/fsaverage"
# The lesion mappings these checks can read: Destrieux parcels, on fsaverage's own annotation.
CHECKED_ATLAS = "destrieux"
CHECKED_ANNOTATION = "aparc.a2009s"
SIDES = {"left": "L", "right": "R"}
# The grey-matter structures of FreeSurfer's aseg each map is also averaged over, on fsaverage's own
# segmentation: the same template, and so the same MNI305 frame, the cortical areas are sampled in.
STRUCTURE_ATLAS = "aseg"
STRUCTURES = {
    8: "Left-Cerebellum-Cortex", 10: "Left-Thalamus-Proper", 11: "Left-Caudate", 12: "Left-Putamen",
    13: "Left-Pallidum", 16: "Brain-Stem", 17: "Left-Hippocampus", 18: "Left-Amygdala",
    26: "Left-Accumbens-area", 28: "Left-VentralDC", 47: "Right-Cerebellum-Cortex",
    49: "Right-Thalamus-Proper", 50: "Right-Caudate", 51: "Right-Putamen", 52: "Right-Pallidum",
    53: "Right-Hippocampus", 54: "Right-Amygdala", 58: "Right-Accumbens-area", 60: "Right-VentralDC",
}


def read_definition(path=DEFINITION):
    definition = yaml.safe_load(path.read_text())
    sources = definition["sources"]
    for key, source in sources.items():
        if not all(source.get(field)
                   for field in ("short", "citation", "doi", "pmid", "license", "license_url")):
            raise ValueError(f"Source {key} needs a short name, citation, DOI, PMID and licence")
    if definition["scores_source"] not in sources:
        raise ValueError(f"Unknown scores source {definition['scores_source']}")
    associations = {
        association["id"]
        for association in yaml.safe_load(NEUROPSYCHOLOGY.read_text())["associations"]
    }
    groups = set()
    for group in definition["groups"]:
        for field in ("id", "name", "name_fr"):
            if not group.get(field):
                raise ValueError(f"Group {group.get('id')} has no {field}")
        if group["id"] in groups:
            raise ValueError(f"Group {group['id']} is defined twice")
        groups.add(group["id"])
    seen = set()
    for domain in definition["domains"]:
        for field in ("id", "term", "group", "name", "name_fr", "color"):
            if not domain.get(field):
                raise ValueError(f"Domain {domain.get('id')} has no {field}")
        if domain["id"] in seen:
            raise ValueError(f"Domain {domain['id']} is defined twice")
        seen.add(domain["id"])
        if domain["group"] not in groups:
            raise ValueError(f"{domain['id']}: unknown group {domain['group']}")
        if not isinstance(domain.get("overview", False), bool):
            raise ValueError(f"{domain['id']}: overview must be true or false")
        color = domain["color"]
        if (len(color) != 3
                or any(not isinstance(value, int) or not 0 <= value <= 255 for value in color)):
            raise ValueError(f"{domain['id']}: colour must be three sRGB bytes")
        unknown = set(domain.get("lesion_checks", [])) - associations
        if unknown:
            raise ValueError(f"{domain['id']}: no lesion association {sorted(unknown)}")
    if not any(domain.get("overview") for domain in definition["domains"]):
        raise ValueError("At least one domain must be in the overview")
    if not definition["threshold_z"] > 0:
        raise ValueError("The membership threshold must be a positive z")
    scale = definition["z_scale"]
    starts = [band["from"] for band in scale]
    if (not scale or starts[0] != definition["threshold_z"] or starts != sorted(set(starts))
            or any(len(band["color"]) != 3 or not all(isinstance(value, int) and 0 <= value <= 255
                                                         for value in band["color"]) for band in scale)):
        raise ValueError("The z scale must start at the threshold, rise, and give each band three sRGB bytes")
    return definition


def read_scores(definition, path=SCORES):
    """Each domain's mean consistency z for every HCP-MMP area of both hemispheres."""
    scores = json.loads(path.read_text())
    terms = {domain["id"]: domain["term"] for domain in definition["domains"]}
    if scores["terms"] != terms:
        raise ValueError(f"Scores were derived for {scores['terms']}, not {terms}")
    for domain, areas in scores["scores"].items():
        names = [AREA_NAME.fullmatch(name) for name in areas]
        if not all(names) or len(areas) != 2 * AREAS_PER_HEMISPHERE:
            raise ValueError(f"{domain}: scores must name all {2 * AREAS_PER_HEMISPHERE} areas")
        if not all(math.isfinite(value) for value in areas.values()):
            raise ValueError(f"{domain}: every score must be finite")
    if set(scores["scores"]) != set(terms) or set(scores["structure_scores"]) != set(terms):
        raise ValueError("Scores and domains disagree")
    for domain, structures in scores["structure_scores"].items():
        if set(structures) != set(STRUCTURES.values()):
            raise ValueError(f"{domain}: structure scores must name every aseg structure sampled")
        if not all(math.isfinite(value) for value in structures.values()):
            raise ValueError(f"{domain}: every structure score must be finite")
    if any(max(areas.values()) < definition["threshold_z"] for areas in scores["scores"].values()):
        raise ValueError("Every domain must reach the threshold somewhere")
    return scores


def members(scores, definition, name, table="scores"):
    """
    The domains an area, or with `table="structure_scores"` a structure, reaches the threshold for,
    strongest first.

    Strength is the z as a share of the domain's own cortical maximum: consistency z grows with a
    term's study count, so raw z would hand every shared area to the largest literature. Structures
    are measured against the same cortical maximum, so adding them changes no area's order.
    """
    share = {}
    for domain in definition["domains"]:
        z = scores[table][domain["id"]][name]
        if z >= definition["threshold_z"]:
            share[domain["id"]] = z / max(scores["scores"][domain["id"]].values())
    return [
        {"domain": domain, "z": round(scores[table][domain][name], 2)}
        for domain in sorted(share, key=lambda domain: -share[domain])
    ]


def assign(regions, definition, scores):
    assigned = {}
    for region in regions:
        if region["atlas"] == SURFACE_ATLAS and region["kind"] == "cortex":
            area_of(region)
            found = members(scores, definition, region["source_name"])
        elif region["atlas"] == STRUCTURE_ATLAS and region["source_name"] in STRUCTURES.values():
            found = members(scores, definition, region["source_name"], "structure_scores")
        else:
            continue
        if found:
            assigned[region["id"]] = found
    return assigned


def short_citation(reference):
    """Surname and year: one or two authors by name, more as et al."""
    # PubMed style, "Van Valin RD Jr": the surname is what precedes the initials.
    surnames = [re.sub(r"( [A-Z]+)( Jr)?$", "", author.strip())
                for author in reference["authors"].split(",")]
    named = {1: surnames[0], 2: f"{surnames[0]} and {surnames[-1]}"}.get(
        len(surnames), f"{surnames[0]} et al.")
    return f"{named} {reference['year']}"


def lesion_checks(definition, scores):
    """
    How much of each lesion-mapped Destrieux parcel the domain's areas cover on fsaverage, and whether
    the domain reaches each lesion-mapped aseg structure it samples, as a share of 1 or 0.
    """
    evidence = yaml.safe_load(NEUROPSYCHOLOGY.read_text())
    associations = {association["id"]: association for association in evidence["associations"]}
    deficits = {deficit["id"]: deficit["name"] for deficit in evidence["deficits"]}
    references = {reference["id"]: short_citation(reference) for reference in evidence["references"]}
    annotations = {}
    for prefix, hemisphere in HEMISPHERES.items():
        hcp, _, hcp_names = read_annot(FSAVERAGE / "label" / f"{prefix}.HCPMMP1.annot")
        parcels, _, parcel_names = read_annot(
            FSAVERAGE / "label" / f"{prefix}.{CHECKED_ANNOTATION}.annot")
        annotations[hemisphere] = (hcp, [name.decode() for name in hcp_names],
                                   parcels, [name.decode() for name in parcel_names])
    checks = {}
    for domain in definition["domains"]:
        checks[domain["id"]] = []
        for association_id in domain.get("lesion_checks", []):
            association = associations[association_id]
            mappings = []
            for mapping in association["mappings"]:
                atlas, hemisphere, label = mapping["region"].split(":")
                if atlas == STRUCTURE_ATLAS and mapping["source_name"] in STRUCTURES.values():
                    reached = any(member["domain"] == domain["id"] for member in members(
                        scores, definition, mapping["source_name"], "structure_scores"))
                    mappings.append({"region": mapping["region"], "source_name": mapping["source_name"],
                                     "coverage": 1.0 if reached else 0.0})
                    continue
                if atlas != CHECKED_ATLAS:
                    mappings.append({"region": mapping["region"],
                                     "source_name": mapping["source_name"], "coverage": None})
                    continue
                hcp, hcp_names, parcels, parcel_names = annotations[hemisphere]
                # Destrieux label values are fixed across FreeSurfer versions; only
                # older ones spell "_and_" as "&".
                if parcel_names[int(label)] != mapping["source_name"].replace("&", "_and_"):
                    raise ValueError(f"{mapping['region']} is {parcel_names[int(label)]} on fsaverage")
                parcel = parcels == int(label)
                if not parcel.any():
                    raise ValueError(f"{mapping['source_name']} has no fsaverage vertices")
                coloured = np.array([
                    name.startswith(f"{SIDES[hemisphere]}_") and name.endswith("_ROI")
                    and any(member["domain"] == domain["id"]
                            for member in members(scores, definition, name))
                    for name in hcp_names
                ])
                inside = coloured[hcp[parcel][hcp[parcel] >= 0]].sum()
                mappings.append({"region": mapping["region"],
                                 "source_name": mapping["source_name"],
                                 "coverage": round(float(inside / parcel.sum()), 3)})
            checks[domain["id"]].append({
                "association": association_id,
                "deficit": association["deficit"],
                "deficit_name": deficits[association["deficit"]],
                "references": [references[entry["reference"]] for entry in association["evidence"]],
                "mappings": mappings,
            })
    return checks


def partition(regions):
    definition = read_definition()
    scores = read_scores(definition)
    return {
        "id": ATLAS_ID,
        "atlas": SURFACE_ATLAS,
        "structure_atlas": STRUCTURE_ATLAS,
        "structures": sorted(STRUCTURES.values()),
        "threshold_z": definition["threshold_z"],
        "z_scale": definition["z_scale"],
        "sources": definition["sources"],
        "scores_source": definition["scores_source"],
        "derivation": scores["derivation"],
        "groups": definition["groups"],
        "domains": [
            {**{key: domain[key] for key in ("id", "term", "group", "name", "name_fr", "color")},
             "overview": domain.get("overview", False)}
            for domain in definition["domains"]
        ],
        "lesion_checks": lesion_checks(definition, scores),
        "regions": assign(regions, definition, scores),
    }


def metadata():
    definition = read_definition()
    return {
        "id": ATLAS_ID,
        "file": FILENAME,
        "atlas": SURFACE_ATLAS,
        "label": definition["label"],
        "citations": [source["doi"] for source in definition["sources"].values()],
        "license": definition["sources"][definition["scores_source"]]["license"],
        "license_url": definition["sources"][definition["scores_source"]]["license_url"],
        "method": definition["method"],
    }


def export(config, regions):
    write_json(config["output_directory"] / FILENAME, partition(regions))
    return metadata()


def validate(config, manifest):
    if manifest["neuropsych_domains"] != metadata():
        raise ValueError("Manifest neuropsychological-domain metadata mismatch")
    published = json.loads((config["output_directory"] / FILENAME).read_text())
    if published != partition(manifest["regions"]):
        raise ValueError("Neuropsychological-domain assignments changed")
    counts = {atlas: {domain["id"]: 0 for domain in published["domains"]}
              for atlas in (SURFACE_ATLAS, STRUCTURE_ATLAS)}
    for region, found in published["regions"].items():
        for member in found:
            counts[region.split(":")[0]][member["domain"]] += 1
    structures = [region for region in published["regions"] if region.startswith(f"{STRUCTURE_ATLAS}:")]
    return {"assigned_areas": len(published["regions"]) - len(structures),
            "assigned_structures": len(structures),
            "areas_per_domain": counts[SURFACE_ATLAS], "structures_per_domain": counts[STRUCTURE_ATLAS]}


def limitations():
    return read_definition()["limitations"]
