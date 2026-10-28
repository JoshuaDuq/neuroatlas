"""Typical arterial territories (Liu et al. 2023), registered onto this brain from their template."""

import re

import nibabel as nib
import numpy as np
import yaml

from ..sources import ROOT, declares
from ..labels.volumes import validate_same_grid

ATLAS_ID = "arterial"
LAYER = "arterial_territories"
DEFINITION = ROOT / "config/arterial-territories.yaml"
SIDES = ("left", "right")
# FreeSurfer labels that are not parenchyma: background, CSF, ventricles, choroid plexus, vessel.
NOT_PARENCHYMA = frozenset({0, 4, 5, 14, 15, 24, 30, 31, 43, 44, 62, 63, 72})
# aseg labels the acceptance checks read.
VENTRICLES = {"left": 4, "right": 43}
CEREBELLAR_CORTEX = (8, 47)
CEREBRAL_TISSUE = (2, 3, 41, 42)
LEFT_TISSUE = (2, 3, 8, 10, 11, 12, 13, 17, 18)
RIGHT_TISSUE = (41, 42, 47, 49, 50, 51, 52, 53, 54)
# A share below this is left out of a region's composition; the remainder is unassigned or small.
MINIMUM_FRACTION = 0.01
SHA256 = re.compile(r"[0-9a-f]{64}")


def read_definition(path=DEFINITION):
    definition = yaml.safe_load(path.read_text())
    for field in ("label", "citation", "doi", "pmid", "license"):
        if not definition.get(field):
            raise ValueError(f"Arterial territories need a {field}")
    for kind, (remote, digest) in definition["source"]["files"].items():
        if not remote or not SHA256.fullmatch(digest):
            raise ValueError(f"Source file {kind} needs a path and its sha256")
    majors = definition["major"]
    values, ids = [], set()
    fields = {"id", "values", "major", "name", "name_fr", "color"}
    for territory in definition["territories"]:
        # A stray key is a misparsed entry, such as a name cut at a comma in a flow mapping.
        if set(territory) != fields:
            raise ValueError(f"Territory {territory.get('id')} has keys {sorted(territory)}, not {sorted(fields)}")
        for field in ("id", "values", "major", "name", "name_fr", "color"):
            if not territory.get(field):
                raise ValueError(f"Territory {territory.get('id')} has no {field}")
        left, right = territory["values"]
        # The atlas numbers each branch's left side odd and its right side the next even value.
        if left % 2 != 1 or right != left + 1:
            raise ValueError(f"Territory {territory['id']} must be an odd left value and the next even right value")
        if territory["major"] not in majors or territory["id"] in ids:
            raise ValueError(f"Territory {territory['id']} is repeated or names no major artery")
        color = territory["color"]
        if len(color) != 3 or any(not isinstance(v, int) or not 0 <= v <= 255 for v in color):
            raise ValueError(f"Territory {territory['id']}: colour must be three sRGB bytes")
        ids.add(territory["id"])
        values.extend(territory["values"])
    if sorted(values + definition["ventricles"]) != list(range(1, len(values) + len(definition["ventricles"]) + 1)):
        raise ValueError("Territory and ventricle values must cover the atlas's labels once each")
    return definition


def is_declared(config):
    return declares(config, LAYER)


def volume_path(config):
    return config["source_directory"] / "mri/arterial-territories.mgz"


def report_path(config):
    return config["source_directory"] / "arterial-registration.json"


def index_of_value(definition):
    """Atlas value → 1-based territory index in the definition's order; ventricles and background 0."""
    lookup = np.zeros(max(definition["ventricles"]) + 1, dtype=np.uint8)
    for index, territory in enumerate(definition["territories"], 1):
        lookup[territory["values"]] = index
    return lookup


def side_of_value(value):
    return SIDES[(value + 1) % 2]


def dice(a, b):
    return float(2 * np.sum(a & b) / (np.sum(a) + np.sum(b)))


def checks(territory, aseg, definition):
    """How well the registered atlas agrees with this brain's own segmentation."""
    values = {side: value for side, value in zip(SIDES, definition["ventricles"])}
    lateral = territory > 0
    lateral &= ~np.isin(territory, definition["ventricles"])
    left, right = np.isin(aseg, LEFT_TISSUE) & lateral, np.isin(aseg, RIGHT_TISSUE) & lateral
    agreement = (np.sum(territory[left] % 2 == 1) + np.sum(territory[right] % 2 == 0)) / (left.sum() + right.sum())
    cerebellar_values = [v for t in definition["territories"]
                         if t["id"] in ("superior-cerebellar", "inferior-cerebellar") for v in t["values"]]
    tissue = np.isin(aseg, CEREBRAL_TISSUE)
    cortex = np.isin(aseg, CEREBELLAR_CORTEX)
    # A structure the checks read must be there; an empty one would score NaN and pass every limit.
    for name, mask in (("left ventricle", aseg == VENTRICLES["left"]),
                       ("right ventricle", aseg == VENTRICLES["right"]),
                       ("cerebellar cortex", cortex), ("cerebral tissue", tissue)):
        if not mask.any():
            raise ValueError(f"aseg has no {name} to check the registration against")
    return {
        "ventricle_dice": {side: round(dice(aseg == VENTRICLES[side], territory == values[side]), 4) for side in SIDES},
        "cerebellar_cortex_in_cerebellar_territories": round(float(np.isin(territory[cortex], cerebellar_values).mean()), 4),
        "cerebral_tissue_unassigned": round(float(np.isin(territory[tissue], [0, *definition["ventricles"]]).mean()), 4),
        "hemisphere_agreement": round(float(agreement), 4),
    }


def accept(measured, definition):
    limits = definition["acceptance"]
    failures = [
        *(f"{side} ventricle Dice {value}" for side, value in measured["ventricle_dice"].items()
          if value < limits["ventricle_dice_min"]),
        *([f"cerebellar cortex {measured['cerebellar_cortex_in_cerebellar_territories']}"]
          if measured["cerebellar_cortex_in_cerebellar_territories"]
          < limits["cerebellar_cortex_in_cerebellar_territories_min"] else []),
        *([f"unassigned cerebral tissue {measured['cerebral_tissue_unassigned']}"]
          if measured["cerebral_tissue_unassigned"] > limits["cerebral_tissue_unassigned_max"] else []),
        *([f"hemisphere agreement {measured['hemisphere_agreement']}"]
          if measured["hemisphere_agreement"] < limits["hemisphere_agreement_min"] else []),
    ]
    if failures:
        raise ValueError(f"The registered arterial territories fail acceptance: {failures}")


def load(config, definition):
    """The registered atlas on aseg's grid, as published values."""
    image = nib.load(volume_path(config))
    aseg = nib.load(config["source_directory"] / "mri/aseg.mgz")
    validate_same_grid(image, aseg)
    values = np.asarray(image.dataobj)
    known = {0, *definition["ventricles"], *(v for t in definition["territories"] for v in t["values"])}
    unknown = set(np.unique(values).tolist()) - known
    if unknown:
        raise ValueError(f"{volume_path(config).name} holds values the atlas does not define: {sorted(unknown)}")
    return image, values.astype(np.int16)


def territory_index(config, definition):
    """The 1-based territory index on aseg's grid (0 for none), and the grid's surface-RAS → voxel matrix."""
    image, values = load(config, definition)
    return index_of_value(definition)[values], np.linalg.inv(image.header.get_vox2ras_tkr())


def vertex_indices(index, surface_to_voxel, pial, white):
    """Each vertex's territory index at the midpoint of its pial and white positions, nearest voxel."""
    voxels = np.rint(nib.affines.apply_affine(surface_to_voxel, (pial + white) / 2)).astype(int)
    if np.any(voxels < 0) or np.any(voxels >= index.shape):
        raise ValueError("Cortical samples fall outside the territory grid")
    return index[tuple(voxels.T)]


def region_id(hemisphere, territory):
    return f"{ATLAS_ID}:{hemisphere}:{territory['id']}"


def counts_of(indices, definition):
    return np.bincount(np.asarray(indices), minlength=len(definition["territories"]) + 1)


def composition_of_counts(counts, definition):
    """A region's territory shares, largest first, small ones left out, and the share in none.

    None when the region reaches no territory. The unassigned share is counted, not inferred
    from the shares shown, so the slivers left out are not mistaken for unassigned tissue.
    """
    total = int(counts.sum())
    if not total or not counts[1:].any():
        return None
    shares = [
        {"territory": definition["territories"][index - 1]["id"], "fraction": int(count) / total}
        for index, count in enumerate(counts) if index and count / total >= MINIMUM_FRACTION
    ]
    return {
        "territories": sorted(shares, key=lambda share: -share["fraction"]),
        "territory_unassigned": int(counts[0]) / total,
    }


def is_fluid(region):
    """A ventricle, CSF or choroid plexus region: no artery supplies a fluid space."""
    if region["atlas"] == "aseg":
        return region["source_label_id"] in NOT_PARENCHYMA
    if region["atlas"] == "learning" and region.get("source_atlas") == "aseg":
        return set(region["source_label_ids"]) <= NOT_PARENCHYMA
    return False


def grid_counts(labels, voxel_to_surface, index, surface_to_voxel, chunk=2_000_000):
    """For every label on a grid, how many of its voxels fall in each territory."""
    width = int(index.max()) + 1
    occupied = np.flatnonzero(labels)
    counts = np.zeros((int(labels.max()) + 1) * width, dtype=np.int64)
    matrix = surface_to_voxel @ voxel_to_surface
    for start in range(0, occupied.size, chunk):
        flat = occupied[start:start + chunk]
        voxels = np.column_stack(np.unravel_index(flat, labels.shape))
        target = np.rint(nib.affines.apply_affine(matrix, voxels)).astype(int)
        inside = np.all((target >= 0) & (target < index.shape), axis=1)
        territory = np.zeros(len(flat), dtype=np.int64)
        territory[inside] = index[tuple(target[inside].T)]
        counts += np.bincount(labels.reshape(-1)[flat].astype(np.int64) * width + territory,
                              minlength=counts.size)
    return counts.reshape(-1, width)


def build_regions(config, definition):
    """One cut-only region per branch and hemisphere, sized on the registered volume."""
    image, values = load(config, definition)
    voxel = [float(x) for x in image.header.get_zooms()[:3]]
    regions = []
    for territory in definition["territories"]:
        major = definition["major"][territory["major"]]
        for hemisphere, value in zip(SIDES, territory["values"]):
            count = int(np.count_nonzero(values == value))
            if not count:
                raise ValueError(f"The registered atlas has no {hemisphere} {territory['id']}")
            regions.append({
                "id": region_id(hemisphere, territory),
                "label": f"{territory['name']} · {hemisphere}",
                "source_name": territory["id"],
                "atlas": ATLAS_ID,
                "hemisphere": hemisphere,
                "source_label_id": value,
                "kind": "tissue-region",
                "display_names": {"en": territory["name"], "fr": territory["name_fr"]},
                "system_names": {"en": major["name"], "fr": major["name_fr"]},
                "display_color": territory["color"],
                "voxel_count": count,
                "voxel_size_mm": voxel,
                "segmentation_volume_mm3": count * float(np.prod(voxel)),
            })
    return regions


def compose(config, definition, regions, grids, unit_grids):
    """Each volumetric region's territory shares, from its voxels on the grid that defines it.

    `grids` maps an atlas to (labels, voxel_to_surface): a region of that atlas is its label's
    voxels. `unit_grids` maps a teaching-set source to the grid the teaching set itself builds
    from, clipped where a unit stops at a NextBrain floor: a unit is its source labels there.
    Fluid spaces take no shares.
    """
    index, surface_to_voxel = territory_index(config, definition)
    counts = {atlas: grid_counts(labels, matrix, index, surface_to_voxel)
              for atlas, (labels, matrix) in grids.items()}
    unit_counts = {source: grid_counts(labels, matrix, index, surface_to_voxel)
                   for source, (labels, matrix) in unit_grids.items()}
    for region in regions:
        if is_fluid(region):
            continue
        if region["atlas"] in counts and region["kind"] != "cortex" and region.get("source_label_id") is not None:
            table, labels = counts[region["atlas"]], [region["source_label_id"]]
        elif region["atlas"] == "learning" and region.get("source_atlas") in unit_counts:
            table, labels = unit_counts[region["source_atlas"]], region["source_label_ids"]
        else:
            continue
        missing = [label for label in labels if label >= len(table)]
        if missing:
            raise ValueError(f"{region['id']}: labels {missing} are not on its grid")
        composed = composition_of_counts(table[labels].sum(axis=0), definition)
        if composed:
            region.update(composed)


def export_cut_atlas(config, definition, image, codes, labels, regions):
    """aparc+aseg's labels, with every parenchyma voxel the atlas reaches taking its territory."""
    from ..labels.volumes import encode_cropped_volume

    territory_image, values = load(config, definition)
    validate_same_grid(territory_image, image)
    source = np.asarray(image.dataobj)
    published = {region["id"] for region in regions}
    data = codes.astype(np.int32).copy()
    parenchyma = ~np.isin(source, list(NOT_PARENCHYMA))
    for territory in definition["territories"]:
        for hemisphere, value in zip(SIDES, territory["values"]):
            identifier = region_id(hemisphere, territory)
            if identifier not in published:
                raise ValueError(f"No published region for {identifier}")
            labels.append({
                "source_label_id": value,
                "name": f"{territory['name']} ({hemisphere})",
                "color": territory["color"],
                "hemisphere": hemisphere,
                "kind": "tissue",
                "region_id": identifier,
            })
            data[(values == value) & parenchyma] = len(labels) - 1
    record = encode_cropped_volume(
        nib.MGHImage(data, image.affine, header=image.header.copy()),
        config["output_directory"] / f"tissues-{ATLAS_ID}.volume",
        np.dtype("<u2"),
    )
    record["labels"] = labels
    record["label_method"] = (
        "Original FreeSurfer aparc.a2009s+aseg labels, with every parenchyma voxel the registered "
        "Liu et al. (2023) atlas assigns taking its arterial territory; CSF, ventricles, choroid "
        "plexus and vessel keep their FreeSurfer labels"
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
    import json

    report = json.loads(report_path(config).read_text())
    return {
        "id": ATLAS_ID,
        "label": definition["label"],
        "citation": definition["doi"],
        "license": definition["license"],
        "attribute": "_TERRITORY",
        "major": definition["major"],
        "territories": [
            {key: territory[key] for key in ("id", "major", "name", "name_fr", "color")}
            for territory in definition["territories"]
        ],
        "registration": report["checks"],
        "method": (
            "The atlas's template b0 registered to this brain's skull-stripped T1 with SynthMorph "
            "(joint affine and deformable), the atlas carried across by nearest neighbour; cortical "
            "vertices take the territory at the midpoint of their pial and white positions, and each "
            "region's shares count its own voxels or vertices"
        ),
    }


def limitations():
    return [
        "Arterial territories are typical territories drawn from where acute infarcts fell in 1,298 stroke patients (Liu et al. 2023), registered onto this brain from the atlas's template; they are not this brain's own, and no vessel of it was imaged. Collateral circulation and variants such as a fetal posterior communicating artery move real territories by centimetres.",
        "The atlas's anterior cerebral artery territory rests on 29 cases, and its medial lenticulostriate and anterior thalamoperforating territories on anatomical knowledge rather than lesions. It places the anterior choroidal and thalamoperforating territory under the posterior circulation, as published.",
        "Territory borders are where one territory's lesions give way to another's, not watershed zones; border-zone probabilities are not published here.",
    ]


def validate(config, manifest):
    """The committed registration still passes, and every published share recomputes."""
    import json

    from ..build import territory_grids

    definition = read_definition()
    _, values = load(config, definition)
    aseg = np.asarray(nib.load(config["source_directory"] / "mri/aseg.mgz").dataobj).astype(np.int32)
    measured = checks(values, aseg, definition)
    if measured != json.loads(report_path(config).read_text())["checks"]:
        raise ValueError("The registered territories no longer measure as their report says")
    accept(measured, definition)
    published = [region for region in manifest["regions"] if region["atlas"] == ATLAS_ID]
    if published != build_regions(config, definition):
        raise ValueError("Arterial territory regions changed")
    fields = ("territories", "territory_unassigned")
    volumetric = [
        {key: value for key, value in region.items() if key not in fields}
        for region in manifest["regions"] if region.get("kind") != "cortex"
    ]
    compose(config, definition, volumetric, *territory_grids(config))
    expected = {region["id"]: [region.get(field) for field in fields] for region in volumetric}
    changed = [region["id"] for region in manifest["regions"]
               if region.get("kind") != "cortex"
               and [region.get(field) for field in fields] != expected[region["id"]]]
    if changed:
        raise ValueError(f"Territory shares changed: {changed[:5]}")
    return {
        "checks": measured,
        "regions_with_shares": sum(1 for region in manifest["regions"] if region.get("territories")),
    }
