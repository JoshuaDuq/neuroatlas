"""Published coordinates: a named MNI template's millimetres carried onto this brain's surface RAS."""

import gzip
import hashlib
import json
import re

import nibabel as nib
import numpy as np
import yaml
from scipy.spatial import cKDTree

from ..sources import ROOT, declares, sha256

LAYER = "coordinate_spaces"
DEFINITION = ROOT / "config/coordinate-spaces.yaml"
# The field stores each grid node's displacement to this brain's surface RAS in hundredths of a millimetre.
UNIT_MM = 0.01
# A node outside the template's brain carries this in all three components.
OUTSIDE = np.iinfo(np.int16).min
SUBCORTICAL = {"thalamus": (10, 49), "caudate": (11, 50), "putamen": (12, 51), "pallidum": (13, 52),
               "hippocampus": (17, 53), "amygdala": (18, 54), "lateral-ventricle": (4, 43)}
LEFT = (2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 17, 18, 26, 28)
RIGHT = (41, 42, 43, 44, 46, 47, 49, 50, 51, 52, 53, 54, 58, 60)
CORTEX = (3, 42)
SHA256 = re.compile(r"[0-9a-f]{64}")
SPACE_FIELDS = {"id", "label", "description", "citation", "doi", "license", "copyright", "source"}
ALTERNATIVE_FIELDS = {"id", "label", "description", "source"}


def read_definition(path=DEFINITION):
    definition = yaml.safe_load(path.read_text())
    for field in ("label", "radius_mm", "grid_spacing_mm", "mask_margin_mm", "acceptance", "spaces", "alternatives"):
        if field not in definition:
            raise ValueError(f"Coordinate spaces need {field}")
    ids = set()
    for kind, fields in (("spaces", SPACE_FIELDS), ("alternatives", ALTERNATIVE_FIELDS)):
        for space in definition[kind]:
            # A stray or missing key is a misparsed entry, such as a value cut at a comma in a flow mapping.
            if set(space) != fields:
                raise ValueError(f"{kind} entry {space.get('id')} has keys {sorted(space)}, not {sorted(fields)}")
            if space["id"] in ids:
                raise ValueError(f"Space {space['id']} is listed twice")
            ids.add(space["id"])
            for remote, digest in space["source"]["files"].values():
                if not remote or not SHA256.fullmatch(digest):
                    raise ValueError(f"{space['id']}: every source file needs a path and its sha256")
    if not definition["spaces"]:
        raise ValueError("At least one coordinate space must be published")
    return definition


def is_declared(config):
    return declares(config, LAYER)


def report_path(config):
    return config["source_directory"] / "coordinate-registration.json"


def field_path(config, space):
    return config["source_directory"] / "coordinates" / f"{space['id']}-field.nii.gz"


def published_name(space):
    return f"coordinates-{space['id']}.field"


def dice(a, b):
    return float(2 * np.sum(a & b) / (np.sum(a) + np.sum(b)))


def sides(values):
    out = np.zeros(values.shape, np.int8)
    out[np.isin(values, LEFT) | ((values >= 1000) & (values < 2000))] = 1
    out[np.isin(values, RIGHT) | (values >= 2000)] = 2
    return out


def checks(carried, aseg, round_trip_mm):
    """How well a template's own segmentation, carried onto this brain, agrees with this brain's.

    `carried` is SynthSeg's reading of the template (aseg labels plus DK cortex at 1000/2000) on
    aseg's grid; `round_trip_mm` is each template brain point's distance after template → brain → template.
    """
    for name, values in (("aseg", aseg), ("the carried template", carried)):
        for structure, pair in SUBCORTICAL.items():
            for value in pair:
                # An empty structure would score NaN and pass every limit.
                if not np.any(values == value):
                    raise ValueError(f"{name} has no {structure} ({value}) to check the registration against")
    a, b = sides(carried), sides(aseg)
    both = (a > 0) & (b > 0)
    return {
        "hemisphere_agreement": round(float(np.mean(a[both] == b[both])), 4),
        "subcortical_dice": {
            f"{structure}-{side}": round(dice(carried == value, aseg == value), 4)
            for structure, pair in SUBCORTICAL.items() for side, value in zip(("left", "right"), pair)
        },
        "cortex_dice": round(dice(np.isin(carried, CORTEX) | (carried >= 1000), np.isin(aseg, CORTEX)), 4),
        "round_trip_mm": {
            "median": round(float(np.median(round_trip_mm)), 4),
            "p95": round(float(np.percentile(round_trip_mm, 95)), 4),
        },
    }


def registration_failures(measured, limits):
    dices = list(measured["subcortical_dice"].values())
    return [
        *([f"hemisphere agreement {measured['hemisphere_agreement']}"]
          if measured["hemisphere_agreement"] < limits["hemisphere_agreement_min"] else []),
        *(f"{name} Dice {value}" for name, value in measured["subcortical_dice"].items()
          if value < limits["subcortical_dice_min"]),
        *([f"median subcortical Dice {np.median(dices):.4f}"]
          if np.median(dices) < limits["subcortical_dice_median_min"] else []),
        *([f"cortex Dice {measured['cortex_dice']}"] if measured["cortex_dice"] < limits["cortex_dice_min"] else []),
        *([f"round trip median {measured['round_trip_mm']['median']} mm"]
          if measured["round_trip_mm"]["median"] > limits["round_trip_median_max_mm"] else []),
        *([f"round trip p95 {measured['round_trip_mm']['p95']} mm"]
          if measured["round_trip_mm"]["p95"] > limits["round_trip_p95_max_mm"] else []),
    ]


def offset_failures(against, limits):
    """An alternative template is covered by an unstated "MNI" only if its reading lands near the one it is read as."""
    return [
        f"{reference}: {failure}"
        for reference, measured in against.items()
        for failure in [
            *([f"cortex offset median {measured['cortex_offset_mm']['median']} mm"]
              if measured["cortex_offset_mm"]["median"] > limits["unstated_offset_median_max_mm"] else []),
            *([f"cortex offset p95 {measured['cortex_offset_mm']['p95']} mm"]
              if measured["cortex_offset_mm"]["p95"] > limits["unstated_offset_p95_max_mm"] else []),
            *([f"sphere overlap median {measured['sphere_overlap']['median']}"]
              if measured["sphere_overlap"]["median"] < limits["unstated_sphere_overlap_median_min"] else []),
        ]
    ]


def accept(report, definition):
    limits = definition["acceptance"]
    reads_as = definition["spaces"][0]["id"]
    failures = [
        *(f"{space}: {failure}" for space, entry in report["spaces"].items()
          for failure in [*registration_failures(entry["checks"], limits),
                          *([f"grid error p95 {entry['grid_error_mm']['p95']} mm"]
                            if entry["grid_error_mm"]["p95"] > limits["grid_error_p95_max_mm"] else [])]),
        *(f"{space}: {failure}" for space, entry in report["alternatives"].items()
          for failure in [*registration_failures(entry["checks"], limits),
                          *offset_failures({reads_as: entry["against"][reads_as]}, limits)]),
    ]
    if failures:
        raise ValueError(f"Coordinate spaces fail acceptance: {failures}")


def grid_nodes(mask_image, spacing, margin_mm):
    """Nodes on a `spacing` grid over the template's brain and closer to it than `margin_mm`, in its millimetres.

    Returns the grid's node → template-mm matrix, its shape, and which nodes lie in the dilated brain.
    """
    brain = nib.affines.apply_affine(mask_image.affine, np.argwhere(np.asarray(mask_image.dataobj) > 0))
    low = np.floor((brain.min(axis=0) - margin_mm) / spacing) * spacing
    high = np.ceil((brain.max(axis=0) + margin_mm) / spacing) * spacing
    shape = tuple(int(n) for n in np.rint((high - low) / spacing) + 1)
    node_to_template = np.diag([spacing, spacing, spacing, 1.0])
    node_to_template[:3, 3] = low
    nodes = nib.affines.apply_affine(node_to_template, np.indices(shape).reshape(3, -1).T)
    # Euclidean distance in millimetres, measured past the image's edge too: a brain that reaches its
    # image's border (SPM12's maps do) still has every cell's far corner (√3 steps away) covered.
    distance, _ = cKDTree(brain).query(nodes, distance_upper_bound=margin_mm)
    return node_to_template, shape, np.isfinite(distance).reshape(shape)


def encode_field(displacement_mm, valid):
    """Displacements (nodes × 3, mm) as int16 hundredths, OUTSIDE where a node is not in the brain."""
    scaled = np.rint(displacement_mm / UNIT_MM)
    if np.any(np.abs(scaled[valid]) >= -OUTSIDE):
        raise ValueError("A displacement exceeds the field's int16 range")
    field = np.where(valid[..., None], scaled, OUTSIDE).astype(np.int16)
    return field


def map_points(field, node_to_template, points):
    """Template millimetres → this brain's surface RAS, trilinear between nodes; NaN where any node is outside.

    `field` is the int16 field (nx, ny, nz, 3). This is the reference the viewer's lookup must match.
    """
    nodes = nib.affines.apply_affine(np.linalg.inv(node_to_template), np.asarray(points, float))
    shape = np.array(field.shape[:3])
    base = np.floor(nodes).astype(int)
    fraction = nodes - base
    out = np.zeros((len(nodes), 3))
    bad = np.any((base < 0) | (base + 1 > shape - 1), axis=1)
    base = np.clip(base, 0, shape - 2)
    for corner in np.argwhere(np.ones((2, 2, 2))):
        index = base + corner
        values = field[tuple(index.T)].astype(float)
        bad |= np.any(values == OUTSIDE, axis=1)
        weight = np.prod(np.where(corner, fraction, 1 - fraction), axis=1)
        out += weight[:, None] * values
    mapped = np.asarray(points, float) + out * UNIT_MM
    mapped[bad] = np.nan
    return mapped


def load_field(config, space):
    image = nib.load(field_path(config, space))
    field = np.asarray(image.dataobj)
    if field.dtype != np.int16 or field.ndim != 4 or field.shape[3] != 3:
        raise ValueError(f"{field_path(config, space).name} is not an int16 (nx, ny, nz, 3) field")
    return field, image.affine


def export_field(config, space):
    """The field as the viewer reads it: gzip of int16 node displacements, components interleaved."""
    field, node_to_template = load_field(config, space)
    payload = np.moveaxis(field, 3, 0).astype("<i2").tobytes(order="F")
    path = config["output_directory"] / published_name(space)
    path.write_bytes(gzip.compress(payload, compresslevel=9, mtime=0))
    return {
        "file": path.name,
        "shape": list(map(int, field.shape[:3])),
        "components": 3,
        "dtype": "<i2",
        "order": "F",
        "interleaved": True,
        "compression": "gzip",
        "byte_length": len(payload),
        "sha256": sha256(path),
        "decoded_sha256": hashlib.sha256(payload).hexdigest(),
        "node_to_template_mm": np.asarray(node_to_template).tolist(),
        "unit_mm": UNIT_MM,
        "outside": int(OUTSIDE),
    }


def export(config, definition):
    """What the viewer needs to place a published coordinate: each field, and what was measured."""
    report = json.loads(report_path(config).read_text())
    accept(report, definition)
    spaces = []
    for space in definition["spaces"]:
        entry = report["spaces"][space["id"]]
        if entry["field_sha256"] != sha256(field_path(config, space)):
            raise ValueError(f"{space['id']}'s field is not the one its registration report measured")
        spaces.append({
            **{key: space[key] for key in ("id", "label", "description", "citation", "doi", "license", "copyright")},
            "field": export_field(config, space),
            "registration": entry["checks"],
        })
    return metadata(definition, report, spaces)


def metadata(definition, report, spaces):
    return {
        "label": definition["label"],
        "radius_mm": definition["radius_mm"],
        "spaces": spaces,
        "unstated": {
            "reads_as": definition["spaces"][0]["id"],
            "alternatives": [
                {"id": alternative["id"], "label": alternative["label"], "description": alternative["description"],
                 "against": report["alternatives"][alternative["id"]]["against"]}
                for alternative in definition["alternatives"]
            ],
        },
        "method": report["method"],
    }


def limitations(definition):
    return [
        "A published coordinate is placed by registering its template to this brain (SynthMorph, joint affine and deformable); it marks where that template location falls on this one brain, not where this person's own peak would be, and not what this brain does there.",
        f"Cortical coordinates are reported as the regions within {definition['radius_mm']:g} mm, not as one parcel: at template cortex, a single Schaefer parcel agreed between an MNI-space lookup and this brain's own projection only about 60% of the time.",
        "An MNI coordinate whose template is not stated is read as the first published template; the other MNI152 templates measured land a few millimetres away on this brain, and the report gives those measured offsets.",
    ]


def validate(config, manifest):
    """The committed fields still pass their report, and the published ones decode to them."""
    definition = read_definition()
    report = json.loads(report_path(config).read_text())
    accept(report, definition)
    published = manifest["coordinate_spaces"]
    if len(published["spaces"]) != len(definition["spaces"]):
        raise ValueError("Published coordinate spaces differ from their definition")
    # Each field record is checked by decoding it below; everything else must be the definition and report's.
    expected = metadata(definition, report, [
        {**{key: space[key] for key in ("id", "label", "description", "citation", "doi", "license", "copyright")},
         "field": record["field"], "registration": report["spaces"][space["id"]]["checks"]}
        for space, record in zip(definition["spaces"], published["spaces"])
    ])
    if published != expected:
        raise ValueError("Published coordinate spaces differ from their definition and report")
    for space, record in zip(definition["spaces"], published["spaces"]):
        field, node_to_template = load_field(config, space)
        payload = gzip.decompress((config["output_directory"] / record["field"]["file"]).read_bytes())
        decoded = np.frombuffer(payload, "<i2").reshape((3, *record["field"]["shape"]), order="F")
        if not np.array_equal(np.moveaxis(decoded, 0, 3), field) or \
                not np.allclose(record["field"]["node_to_template_mm"], node_to_template):
            raise ValueError(f"{record['field']['file']} does not decode to {field_path(config, space).name}")
    return {space: entry["checks"] for space, entry in report["spaces"].items()}
