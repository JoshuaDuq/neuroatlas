"""Functional cerebellar regions (Nettekoven et al. 2024), registered onto this brain's cerebellar cortex."""

import json
import re

import nibabel as nib
import numpy as np
import yaml

from ..labels import cerebellum
from ..labels.placement import placements
from ..labels.volumes import validate_same_grid
from ..sources import ROOT, declares
from .arterial_territories import grid_counts

ATLAS_ID = "nettekoven"
LAYER = "cerebellar_functions"
DEFINITION = ROOT / "config/cerebellar-functions.yaml"
SIDES = ("left", "right")
# aseg's cerebellar cortex, left then right: the atlas is kept to it.
CEREBELLAR_CORTEX = (8, 47)
# A share below this is left out of a lobule's composition.
MINIMUM_FRACTION = 0.01
SHA256 = re.compile(r"[0-9a-f]{64}")
# SUIT's lobules (Diedrichsen et al. 2009, atl-Anatom.tsv), values 1 to 28 in this order.
SUIT_LOBULES = [
    f"{side}_{lobule}"
    for lobule in ("I_IV", "V", "VI", "CrusI", "CrusII", "VIIb", "VIIIa", "VIIIb", "IX", "X")
    for side in (("Left", "Right") if lobule in ("I_IV", "V") else ("Left", "Vermis", "Right"))
]
# The units SUIT's lobules and FastSurfer's CerebNet both segment: SUIT names → CerebNet Cbm_* values.
HEMISPHERIC = {"I_IV": (601, 602), "V": (603, 604), "VI": (605, 607), "CrusI": (608, 610),
               "CrusII": (611, 613), "VIIb": (614, 616), "VIIIa": (617, 619), "VIIIb": (620, 622),
               "IX": (623, 625), "X": (626, 628)}
VERMIS = {"VII": (("CrusI", "CrusII", "VIIb"), 630), "VIII": (("VIIIa", "VIIIb"), 631),
          "IX": (("IX",), 624), "X": (("X",), 627)}


def lobule_units():
    """Each shared unit's SUIT values and CerebNet values."""
    value = {name: index for index, name in enumerate(SUIT_LOBULES, 1)}
    units = {
        f"{side}_{lobule}": ([value[f"{side.title()}_{lobule}"]], [cerebnet[index]])
        for lobule, cerebnet in HEMISPHERIC.items()
        for index, side in enumerate(SIDES)
    }
    for unit, (parts, cerebnet) in VERMIS.items():
        units[f"vermis_{unit}"] = ([value[f"Vermis_{part}"] for part in parts], [cerebnet])
    return units


def read_definition(path=DEFINITION):
    definition = yaml.safe_load(path.read_text())
    for field in ("label", "citation", "doi", "pmid", "license"):
        if not definition.get(field):
            raise ValueError(f"Cerebellar functions need a {field}")
    for kind, (remote, digest) in definition["source"]["files"].items():
        if not remote or not SHA256.fullmatch(digest):
            raise ValueError(f"Source file {kind} needs a path and its sha256")
    fields = {"id", "domain", "name", "name_fr", "description", "description_fr", "color"}
    ids = set()
    for region in definition["regions"]:
        # A stray key is a misparsed entry, such as a name cut at a comma in a flow mapping.
        if set(region) != fields or not all(region[field] for field in fields):
            raise ValueError(f"Region {region.get('id')} needs exactly {sorted(fields)}")
        if region["domain"] not in definition["domains"] or region["id"] in ids:
            raise ValueError(f"Region {region['id']} is repeated or names no domain")
        color = region["color"]
        if len(color) != 3 or any(not isinstance(v, int) or not 0 <= v <= 255 for v in color):
            raise ValueError(f"Region {region['id']}: colour must be three sRGB bytes")
        ids.add(region["id"])
    if len(ids) != 16:
        raise ValueError("The symmetric 32-region atlas has 16 regions on each side")
    return definition


def is_declared(config):
    return declares(config, LAYER)


def volume_path(config):
    return config["source_directory"] / "mri/cerebellar-functions.mgz"


def lobules_path(config):
    """SUIT's lobules carried by the same warp, kept to check the registration against CerebNet."""
    return config["source_directory"] / "mri/cerebellar-lobules-suit.mgz"


def report_path(config):
    return config["source_directory"] / "cerebellar-registration.json"


def value_of(index, hemisphere):
    """The atlas value of the 0-based region `index` on one side: 1 to 16 left, 17 to 32 right."""
    return index + 1 + 16 * SIDES.index(hemisphere)


def region_id(hemisphere, region):
    return f"{ATLAS_ID}:{hemisphere}:{region['id']}"


def dice(a, b):
    return float(2 * np.sum(a & b) / (np.sum(a) + np.sum(b)))


def checks(values, lobules, aseg, cerebnet):
    """How well the registered atlas agrees with this brain's own segmentation."""
    cortex = {side: aseg == label for side, label in zip(SIDES, CEREBELLAR_CORTEX)}
    # A structure the checks read must be there; an empty one would score NaN and pass every limit.
    if not all(mask.any() for mask in cortex.values()):
        raise ValueError("aseg has no cerebellar cortex to check the registration against")
    either = cortex["left"] | cortex["right"]
    per_unit = {}
    for unit, (suit, fs) in lobule_units().items():
        carried, own = np.isin(lobules, suit), np.isin(cerebnet, fs)
        if not (carried.any() and own.any()):
            raise ValueError(f"No {unit} in {'the carried lobules' if not carried.any() else 'CerebNet'}")
        per_unit[unit] = round(dice(carried, own), 4)
    labelled = {side: values[mask] for side, mask in cortex.items()}
    labelled = {side: v[v > 0] for side, v in labelled.items()}
    agreeing = np.sum(labelled["left"] <= 16) + np.sum(labelled["right"] > 16)
    return {
        "lobule_dice": per_unit,
        "lobule_dice_mean": round(float(np.mean(list(per_unit.values()))), 4),
        "cerebellar_cortex_covered": round(float((values[either] > 0).mean()), 4),
        "side_agreement": round(float(agreeing / (labelled["left"].size + labelled["right"].size)), 4),
    }


def accept(measured, definition):
    limits = definition["acceptance"]
    failures = [
        *([f"lobule Dice {measured['lobule_dice_mean']}"]
          if measured["lobule_dice_mean"] < limits["lobule_dice_mean_min"] else []),
        *([f"cerebellar cortex covered {measured['cerebellar_cortex_covered']}"]
          if measured["cerebellar_cortex_covered"] < limits["cerebellar_cortex_covered_min"] else []),
        *([f"side agreement {measured['side_agreement']}"]
          if measured["side_agreement"] < limits["side_agreement_min"] else []),
    ]
    if failures:
        raise ValueError(f"The registered cerebellar atlas fails acceptance: {failures}")


def load(config):
    """The registered atlas on aseg's grid, kept to the cerebellar cortex."""
    image = nib.load(volume_path(config))
    aseg = nib.load(config["source_directory"] / "mri/aseg.mgz")
    validate_same_grid(image, aseg)
    values = np.asarray(image.dataobj).astype(np.int16)
    unknown = set(np.unique(values).tolist()) - set(range(33))
    if unknown:
        raise ValueError(f"{volume_path(config).name} holds values the atlas does not define: {sorted(unknown)}")
    if np.any(values[~np.isin(np.asarray(aseg.dataobj), CEREBELLAR_CORTEX)]):
        raise ValueError(f"{volume_path(config).name} reaches beyond the cerebellar cortex")
    return image, values


def build_regions(config, definition):
    """One cut-only region per functional region and hemisphere, sized on the registered volume."""
    image, values = load(config)
    voxel = [float(x) for x in image.header.get_zooms()[:3]]
    placed = placements(
        values,
        image.header.get_vox2ras_tkr(),
        [
            value_of(index, hemisphere)
            for index in range(len(definition["regions"]))
            for hemisphere in SIDES
        ],
    )
    regions = []
    for index, region in enumerate(definition["regions"]):
        domain = definition["domains"][region["domain"]]
        for hemisphere in SIDES:
            value = value_of(index, hemisphere)
            count = int(np.count_nonzero(values == value))
            if not count:
                raise ValueError(f"The registered atlas has no {hemisphere} {region['id']}")
            regions.append({
                "id": region_id(hemisphere, region),
                "label": f"{region['name']} · {hemisphere}",
                "source_name": region["id"].upper(),
                "atlas": ATLAS_ID,
                "hemisphere": hemisphere,
                "source_label_id": value,
                "kind": "tissue-region",
                "display_names": {"en": region["name"], "fr": region["name_fr"]},
                "system_names": {"en": domain["name"], "fr": domain["name_fr"]},
                "display_color": region["color"],
                "voxel_count": count,
                "voxel_size_mm": voxel,
                "segmentation_volume_mm3": count * float(np.prod(voxel)),
                **placed[value],
            })
    return regions


def composition_of_counts(counts, definition):
    """A lobule's functional shares, largest first, small ones left out, and the share in none."""
    total = int(counts.sum())
    if not total or not counts[1:].any():
        return None
    shares = [
        {"region": region_id(SIDES[(value - 1) // 16], definition["regions"][(value - 1) % 16]),
         "fraction": int(count) / total}
        for value, count in enumerate(counts) if value and count / total >= MINIMUM_FRACTION
    ]
    return {
        "cerebellar_functions": sorted(shares, key=lambda share: -share["fraction"]),
        "cerebellar_functions_unassigned": int(counts[0]) / total,
    }


def compose(config, definition, regions, grids):
    """Each cerebellar cortex region's functional shares, from its voxels on the grid that defines it.

    `grids` maps an atlas to (labels, voxel_to_surface); only aseg's and CerebNet's are read. The
    teaching set's lobules are counted on their CerebNet labels, aseg's cerebellar cortex on aseg.
    """
    image, values = load(config)
    surface_to_voxel = np.linalg.inv(image.header.get_vox2ras_tkr())
    counts = {atlas: grid_counts(*grids[atlas], values, surface_to_voxel) for atlas in ("aseg", "cerebnet")}
    for region in regions:
        if region["atlas"] == "aseg" and region.get("source_label_id") in CEREBELLAR_CORTEX:
            table, labels = counts["aseg"], [region["source_label_id"]]
        elif region["atlas"] == "learning" and region.get("source_atlas") == "cerebnet":
            table, labels = counts["cerebnet"], region["source_label_ids"]
        else:
            continue
        composed = composition_of_counts(table[labels].sum(axis=0), definition)
        if composed:
            region.update(composed)


def export_cut_atlas(config, definition, image, codes, labels, regions):
    """aparc+aseg's labels, with every cerebellar cortex voxel the atlas reaches taking its region."""
    from ..labels.volumes import encode_cropped_volume

    atlas_image, values = load(config)
    validate_same_grid(atlas_image, image)
    published = {region["id"] for region in regions}
    data = codes.astype(np.int32).copy()
    for index, region in enumerate(definition["regions"]):
        for hemisphere in SIDES:
            identifier = region_id(hemisphere, region)
            if identifier not in published:
                raise ValueError(f"No published region for {identifier}")
            value = value_of(index, hemisphere)
            labels.append({
                "source_label_id": value,
                "name": f"{region['name']} ({hemisphere})",
                "color": region["color"],
                "hemisphere": hemisphere,
                "kind": "tissue",
                "region_id": identifier,
            })
            data[values == value] = len(labels) - 1
    record = encode_cropped_volume(
        nib.MGHImage(data, image.affine, header=image.header.copy()),
        config["output_directory"] / f"tissues-{ATLAS_ID}.volume",
        np.dtype("<u2"),
    )
    record["labels"] = labels
    record["label_method"] = (
        "Original FreeSurfer aparc.a2009s+aseg labels, with every cerebellar cortex voxel the "
        "registered Nettekoven et al. (2024) atlas assigns taking its functional region"
    )
    return record


def cut_atlas(definition):
    return {
        "id": ATLAS_ID,
        "label": definition["label"],
        "citation": definition["doi"],
        "surface": False,
        "procedure": "registered-template",
    }


def metadata(config, definition):
    report = json.loads(report_path(config).read_text())
    return {
        "id": ATLAS_ID,
        "label": definition["label"],
        "citation": definition["doi"],
        "license": definition["license"],
        "domains": definition["domains"],
        "regions": [
            {key: region[key] for key in ("id", "domain", "name", "name_fr", "description", "description_fr", "color")}
            for region in definition["regions"]
        ],
        "registration": report["checks"],
        "method": (
            "The SUIT cerebellar template registered to this brain's skull-stripped T1, kept to its "
            "infratentorial compartment, with SynthMorph (joint affine and deformable); the atlas "
            "carried across by nearest neighbour and kept to this brain's cerebellar cortex. Each "
            "lobule's shares count its own voxels"
        ),
    }


def limitations():
    return [
        "Functional cerebellar regions are a group atlas (Nettekoven et al. 2024) fused from seven task-based fMRI datasets and registered onto this brain from the SUIT template; this brain's function was not measured. Individual functional boundaries differ from the group's, and the authors show that an individual's own localizer data place them better.",
        "Registration from a group template places lobule borders a few millimetres off: SUIT's own lobules, carried by the same warp, meet this brain's CerebNet lobules at a mean Dice of 0.65. A region's border on a cut is approximate; a lobule's shares, summed over its whole volume, are steadier.",
    ]


def subject_volumes(config):
    """SUIT's carried lobules, aseg and CerebNet, on aseg's grid, as the checks read them."""
    aseg = nib.load(config["source_directory"] / "mri/aseg.mgz")
    volumes = [nib.load(lobules_path(config)), aseg, nib.load(cerebellum.path(config))]
    for image in volumes:
        validate_same_grid(image, aseg)
    return [np.asarray(image.dataobj).astype(np.int32) for image in volumes]


def validate(config, manifest):
    """The committed registration still passes, and every published share recomputes."""
    from ..build import territory_grids

    definition = read_definition()
    _, values = load(config)
    measured = checks(values, *subject_volumes(config))
    if measured != json.loads(report_path(config).read_text())["checks"]:
        raise ValueError("The registered cerebellar atlas no longer measures as its report says")
    accept(measured, definition)
    published = [region for region in manifest["regions"] if region["atlas"] == ATLAS_ID]
    if published != build_regions(config, definition):
        raise ValueError("Cerebellar functional regions changed")
    fields = ("cerebellar_functions", "cerebellar_functions_unassigned")
    regions = [{key: value for key, value in region.items() if key not in fields}
               for region in manifest["regions"]]
    compose(config, definition, regions, territory_grids(config)[0])
    expected = {region["id"]: [region.get(field) for field in fields] for region in regions}
    changed = [region["id"] for region in manifest["regions"]
               if [region.get(field) for field in fields] != expected[region["id"]]]
    if changed:
        raise ValueError(f"Cerebellar functional shares changed: {changed[:5]}")
    return {
        "checks": measured,
        "regions_with_shares": sum(1 for region in manifest["regions"] if region.get("cerebellar_functions")),
    }
