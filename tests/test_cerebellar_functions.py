import copy
import importlib.util
import json

import nibabel as nib
import numpy as np
import pytest
import yaml

from brain_model.layers import cerebellar_functions as functions
from brain_model.sources import ROOT, read_config


def definition():
    return functions.read_definition()


def write_definition(path, change):
    document = copy.deepcopy(yaml.safe_load(functions.DEFINITION.read_text()))
    change(document)
    path.write_text(yaml.safe_dump(document, allow_unicode=True))
    return path


def published():
    return json.loads((ROOT / "public/models/cdmd/manifest.json").read_text())


def registration_script():
    spec = importlib.util.spec_from_file_location(
        "register_cerebellar_functions", ROOT / "scripts/register_cerebellar_functions.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_a_definition_with_a_stray_key_or_a_missing_region_is_refused(tmp_path):
    def stray(document):
        document["regions"][2]["note"] = "hand"
    with pytest.raises(ValueError, match="needs exactly"):
        functions.read_definition(write_definition(tmp_path / "d.yaml", stray))

    def drop(document):
        document["regions"].pop()
    with pytest.raises(ValueError, match="16 regions on each side"):
        functions.read_definition(write_definition(tmp_path / "d.yaml", drop))


def test_values_name_each_region_on_its_side():
    regions = definition()["regions"]
    assert [functions.value_of(2, "left"), functions.value_of(2, "right")] == [3, 19]
    counts = np.zeros(33, np.int64)
    counts[[0, 3, 19, 8]] = [5, 80, 14, 1]
    assert functions.composition_of_counts(counts, definition()) == {
        "cerebellar_functions": [
            {"region": f"nettekoven:left:{regions[2]['id']}", "fraction": 0.8},
            {"region": f"nettekoven:right:{regions[2]['id']}", "fraction": 0.14},
            {"region": f"nettekoven:left:{regions[7]['id']}", "fraction": 0.01},
        ],
        # A 1% share is kept, at the limit; background is counted, not inferred.
        "cerebellar_functions_unassigned": 0.05,
    }
    assert regions[2]["id"] == "m3"
    only_none = np.zeros(33, np.int64)
    only_none[0] = 4
    assert functions.composition_of_counts(only_none, definition()) is None


def test_the_shared_lobule_units_match_suit_to_cerebnet():
    units = functions.lobule_units()
    assert len(units) == 24
    assert units["left_CrusI"] == ([8], [608]) and units["right_CrusI"] == ([10], [610])
    # CerebNet merges the vermis of Crus I, Crus II and VIIb into one unit.
    assert units["vermis_VII"] == ([9, 12, 15], [630])
    assert functions.SUIT_LOBULES[functions.lobule_units()["vermis_IX"][0][0] - 1] == "Vermis_IX"


def lobule_slabs():
    """Each shared lobule unit a slab: left and vermis units in left cortex, right ones in right cortex."""
    units = functions.lobule_units()
    aseg = np.zeros((len(units), 2, 2), np.int32)
    lobules, cerebnet = np.zeros_like(aseg, np.int16), np.zeros_like(aseg)
    for slab, (unit, (suit, fs)) in enumerate(units.items()):
        aseg[slab] = 47 if unit.startswith("right") else 8
        lobules[slab], cerebnet[slab] = suit[0], fs[0]
    return aseg, lobules, cerebnet


def test_the_checks_score_agreement_and_a_mirrored_atlas_fails_acceptance():
    aseg, lobules, cerebnet = lobule_slabs()
    values = np.where(aseg == 8, 3, 19).astype(np.int16)
    values[0, 0, 0] = 0
    measured = functions.checks(values, lobules, aseg, cerebnet)
    assert set(measured["lobule_dice"].values()) == {1.0} and measured["lobule_dice_mean"] == 1.0
    assert measured["side_agreement"] == 1.0
    assert measured["cerebellar_cortex_covered"] == pytest.approx(1 - 1 / aseg.size, abs=1e-4)
    functions.accept(measured, definition())
    mirrored = functions.checks(values[::-1], lobules[::-1], aseg, cerebnet)
    assert mirrored["lobule_dice"]["left_I_IV"] == 0.0 and mirrored["side_agreement"] < 0.5
    with pytest.raises(ValueError, match="fails acceptance"):
        functions.accept(mirrored, definition())
    # A unit missing on either side would score 0/0, which no limit catches.
    with pytest.raises(ValueError, match="No vermis_X in CerebNet"):
        functions.checks(values, lobules, aseg, np.where(cerebnet == 627, 0, cerebnet))
    with pytest.raises(ValueError, match="no cerebellar cortex"):
        functions.checks(values, lobules, np.where(aseg == 47, 0, aseg), cerebnet)


def test_a_mirrored_label_header_keeps_its_world_positions_on_the_template_grid(tmp_path):
    # SUIT stores its label images LAS beside its RAS template, on the same box.
    template = nib.Nifti1Image(np.zeros((6, 2, 2), np.float32), np.diag([1.0, 1.0, 1.0, 1.0]))
    template.affine[0, 3] = -3
    labels = np.zeros((6, 2, 2), np.int16)
    labels[4:] = 1                     # stored at high i, which LAS puts at the left (x < 0)
    flipped = np.diag([-1.0, 1.0, 1.0, 1.0])
    flipped[0, 3] = 2
    source = tmp_path / "labels.nii"
    nib.save(nib.Nifti1Image(labels, flipped), source)
    destination = tmp_path / "gridded.nii.gz"
    registration_script().on_template_grid(source, template, destination)
    gridded = nib.load(destination)
    x = nib.affines.apply_affine(gridded.affine, np.argwhere(np.asarray(gridded.dataobj) == 1))[:, 0]
    assert np.all(x < 0)
    # Read on the template's grid as stored, the same voxels would lie on the right.
    assert np.all(nib.affines.apply_affine(template.affine, np.argwhere(labels == 1))[:, 0] > 0)


def test_the_published_atlas_keeps_to_the_cortex_and_its_regions_to_their_side():
    manifest = published()
    tissues = json.loads((ROOT / "public/models/cdmd/tissue-labels.json").read_text())
    regions = [region for region in manifest["regions"] if region["atlas"] == functions.ATLAS_ID]
    assert len(regions) == 32
    assert all((region["source_label_id"] <= 16) == (region["hemisphere"] == "left") for region in regions)
    cut = {label["region_id"] for label in tissues["atlases"][functions.ATLAS_ID]["labels"]}
    assert {region["id"] for region in regions} <= cut
    assert functions.build_regions(read_config("cdmd"), definition()) == regions
    assert manifest["cerebellar_functions"]["registration"]["side_agreement"] >= 0.97


def test_the_published_lobules_show_the_motor_and_cognitive_halves_of_the_cerebellum():
    regions = {region["id"]: region for region in published()["regions"]}
    domain = {f"nettekoven:{side}:{region['id']}": region["domain"]
              for region in definition()["regions"] for side in functions.SIDES}

    def share(region_id, wanted):
        return sum(s["fraction"] for s in regions[region_id]["cerebellar_functions"] if domain[s["region"]] == wanted)

    lobules = [region for region in regions.values() if region.get("source_atlas") == "cerebnet"]
    assert lobules and all("cerebellar_functions" in region for region in lobules)
    # The anterior lobe is motor; Crus I is cognitive (multiple demand with social-linguistic-spatial).
    assert share("learning:lobule-v-left", "motor") > 0.5
    crus = next(region["id"] for region in lobules if region["id"].startswith("learning:crus-i") and region["id"].endswith("left"))
    assert share(crus, "demand") + share(crus, "social") > 0.7
    # A left lobule lies in the left regions, but for a midline sliver.
    left = sum(s["fraction"] for s in regions["learning:lobule-v-left"]["cerebellar_functions"]
               if s["region"].startswith("nettekoven:left:"))
    assert left > 0.8
