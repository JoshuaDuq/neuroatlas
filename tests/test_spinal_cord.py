"""The reference cord is a closed source-derived assembly in anatomical posture."""

from itertools import pairwise

import numpy as np
import pytest
import trimesh
from scipy.spatial import Delaunay, cKDTree

from brain_model import spinal_cord
from brain_model.geometry import to_gltf
from brain_model.sources import ROOT, read_config


@pytest.fixture(scope="module")
def published(tmp_path_factory):
    config = read_config()
    if not spinal_cord.is_available(config):
        pytest.skip("Run scripts/extract_spinal_cord.py to produce the reference cord")
    config["output_directory"] = tmp_path_factory.mktemp("models")
    layer, regions = spinal_cord.build(config)
    scene = trimesh.load_scene(config["output_directory"] / layer["file"], process=False)
    return config, layer, {region["id"]: region for region in regions}, scene


@pytest.fixture(scope="module")
def parts(published):
    return spinal_cord.parts(published[0])


def centreline(vertices, bins=24):
    """Centroid and mean radius of each axial slab, inferior to superior."""
    edges = np.linspace(vertices[:, 2].min(), vertices[:, 2].max(), bins + 1)
    track = []
    for low, high in pairwise(edges):
        slab = vertices[(vertices[:, 2] >= low) & (vertices[:, 2] < high)]
        if len(slab) < 4:
            continue
        centre = slab.mean(axis=0)
        track.append((*centre, np.linalg.norm(slab[:, :2] - centre[:2], axis=1).mean()))
    return np.array(track)


def compact(mesh, faces):
    used, inverse = np.unique(mesh.faces[faces], return_inverse=True)
    return trimesh.Trimesh(mesh.vertices[used], inverse.reshape(-1, 3), process=False)


def test_every_published_part_is_its_source_surface_unchanged(published, parts):
    _, layer, regions, scene = published
    assert layer["region_count"] == len(parts) == len(regions)
    for part in parts:
        mesh = scene.geometry[f"{spinal_cord.ATLAS_ID}:{part['key']}"]
        np.testing.assert_allclose(mesh.vertices, to_gltf(part["mesh"].vertices), atol=3e-8)
        np.testing.assert_array_equal(mesh.faces, part["mesh"].faces)
        assert mesh.is_watertight and mesh.is_winding_consistent and mesh.volume > 0


def test_the_cord_publishes_58_regions_without_the_accessory_nucleus(published):
    _, layer, regions, _ = published
    assert layer["region_count"] == 58
    assert {"zanatomy:left:anterior-horn", "zanatomy:right:posterior-horn",
            "zanatomy:left:lateral-corticospinal-tract", "zanatomy:midline:central-canal"} <= set(regions)
    assert "zanatomy:midline:anterior-horn" not in regions
    assert not any("accessory" in region["source_name"].lower() for region in regions.values())


def test_a_split_structure_divides_into_its_two_mirrored_halves(published):
    config, _, _, _ = published
    native, _ = spinal_cord.source_geometry(config)
    midline = native["midline:cord"].vertices[:, 0].mean()
    split = [s for s in config["spinal_cord"]["structures"] if s["hemisphere"] == "split"]
    assert len(split) == 23
    for structure in split:
        source = native[spinal_cord.key_of(structure)]
        halves = spinal_cord.split_faces(source, midline)
        assert set(halves) == {"left", "right"}
        np.testing.assert_array_equal(np.sort(np.concatenate(list(halves.values()))),
                                      np.arange(len(source.faces)))
        volume = 0.0
        for side, faces in halves.items():
            half = compact(source, faces)
            assert half.is_watertight and half.volume > 0, f"{side} {structure['id']}"
            # RAS: the subject's left is negative x.
            assert (half.vertices[:, 0].mean() < midline) == (side == "left")
            volume += half.volume
        assert volume == pytest.approx(source.volume, rel=1e-9)


def test_cord_keeps_the_sagittal_curve_a_straightened_template_discards(published):
    """The reason this layer is not PAM50, stated as a measurement.

    PAM50 is straightened to be a template: its centreline wanders 1.5 mm over
    475 mm, so it can only publish as a rod. An anatomical cord follows the
    vertebral canal through cervical lordosis, thoracic kyphosis and lumbar
    lordosis, and the apex of that curve is nowhere near either end.
    """
    config, _, _, _ = published
    native, _ = spinal_cord.source_geometry(config)
    track = centreline(native["midline:cord"].vertices)
    anterior = track[:, 1]
    assert anterior.max() - anterior.min() > 40, "the cord is nearly straight"
    apex = int(np.argmin(anterior))
    assert 0.25 < apex / len(track) < 0.75, "the curve has no interior apex"


def test_cord_tapers_into_a_conus_and_thickens_at_both_enlargements(published):
    config, _, _, _ = published
    native, _ = spinal_cord.source_geometry(config)
    track = centreline(native["midline:cord"].vertices)
    radius = track[:, 3]
    assert radius[0] < 0.2 * radius.max(), "the inferior end does not taper to a conus"
    # Above that taper the cord is thinnest in mid-thorax, with the lumbosacral
    # enlargement below the waist and the cervical enlargement above it.
    body = radius[int(np.argmax(radius >= 0.9 * radius.max())):]
    waist = int(np.argmin(body))
    assert 0 < waist < len(body) - 1, "the cord has no interior thoracic waist"
    assert body[:waist].max() > 1.1 * body[waist], "no lumbosacral enlargement"
    assert body[waist:].max() > 1.1 * body[waist], "no cervical enlargement"


def depth_outside(cord, points, bin_mm=0.25, margin_mm=0.05):
    """How far each point lies outside the cord's axial section at its own height; 0 inside.

    A first pass shares one section per height bin; points that pass near an
    outline, or near either end where the cord closes, are re-measured exactly.
    """
    def measure(heights, subset):
        depth, near = np.zeros(len(subset)), np.zeros(len(subset), bool)
        for z in np.unique(heights):
            at = np.flatnonzero(heights == z)
            segments = trimesh.intersections.mesh_plane(cord, [0, 0, 1], [0, 0, z])
            if len(segments) == 0:
                depth[at], near[at] = np.inf, True
                continue
            a, b, p = segments[:, 0, :2], segments[:, 1, :2], subset[at, :2]
            rise = b[:, 1] - a[:, 1]
            crosses = (a[None, :, 1] > p[:, 1:2]) != (b[None, :, 1] > p[:, 1:2])
            meet = a[None, :, 0] + (p[:, 1:2] - a[None, :, 1]) * (b[None, :, 0] - a[None, :, 0]) \
                / np.where(rise == 0, 1e-300, rise)[None, :]
            inside = (crosses & (p[:, 0:1] < meet)).sum(axis=1) % 2 == 1
            edge, offset = b - a, p[:, None, :] - a[None, :, :]
            t = np.clip((offset * edge[None]).sum(-1) / np.maximum((edge * edge).sum(-1), 1e-300)[None], 0, 1)
            gap = np.linalg.norm(offset - t[..., None] * edge[None], axis=-1).min(axis=1)
            depth[at], near[at] = np.where(inside, 0.0, gap), ~inside | (gap < margin_mm)
        return depth, near

    depth, near = measure(np.round(points[:, 2] / bin_mm) * bin_mm, points)
    ends = (points[:, 2] < cord.bounds[0, 2] + 3) | (points[:, 2] > cord.bounds[1, 2] - 3)
    recheck = np.flatnonzero(near | ends)
    depth[recheck] = measure(points[recheck, 2], points[recheck])[0]
    return depth


def test_internal_structures_sit_inside_the_cord_that_surrounds_them(published):
    """A tract or nucleus straying outside the cord would cap beside it, in space.

    Superficial tracts share the cord's outline, so flush counts as inside:
    Z-Anatomy draws the anterior spinocerebellar tract about 6 micrometres proud of it.
    The last half millimetre is skipped because every structure tapers into the
    conus tip with the cord, where the cord's section is a point.
    """
    config, _, _, _ = published
    native, _ = spinal_cord.source_geometry(config)
    cord = native["midline:cord"]
    inner = [s for s in config["spinal_cord"]["structures"] if "tissue" in s and s["id"] != "cord"]
    assert len(inner) == 27
    for structure in inner:
        vertices = native[spinal_cord.key_of(structure)].vertices
        depth = depth_outside(cord, vertices[vertices[:, 2] > cord.bounds[0, 2] + 0.5])
        assert depth.max() <= 0.01, f"{structure['id']} leaves the cord by {depth.max():.4f} mm"


def test_the_whole_assembly_moves_by_one_rigid_translation(published):
    config, layer, _, _ = published
    transform = np.asarray(layer["template_to_surface_ras_mm"])
    np.testing.assert_array_equal(transform[:3, :3], np.eye(3))
    archive = np.load(ROOT / config["spinal_cord"]["source"])
    placed, _ = spinal_cord.source_geometry(config)
    for structure in config["spinal_cord"]["structures"]:
        key = spinal_cord.key_of(structure)
        shift = np.asarray(placed[key].vertices) - archive[f"{key}/vertices"]
        assert np.abs(shift - transform[:3, 3]).max() < 1e-9, f"{key} moved on its own"


def test_roots_and_ganglia_stay_attached_to_the_cord_they_leave(published):
    config, _, _, _ = published
    native, _ = spinal_cord.source_geometry(config)
    cord = native["midline:cord"]
    surface = cKDTree(cord.vertices)
    for key in ["left:anterior-root", "right:posterior-root", "midline:cauda-equina"]:
        gap = surface.query(native[key].vertices)[0].min()
        assert gap < 3.0, f"{key} is detached from the cord"


def test_structures_of_the_cord_declare_their_tissue_and_family(published):
    config, _, regions, _ = published
    tissue = {region["source_name"]: region.get("tissue") for region in regions.values()}
    assert tissue["White matter of spinal cord"] == "white"
    assert tissue["Lateral corticospinal tract"] == "white"
    assert tissue["Nucleus proprius"] == "gray"
    assert tissue["Central canal"] == "fluid"
    # Roots leave the cord; they keep the tissue rule every other structure uses.
    assert tissue["Anterior root of spinal nerve.l"] is None
    families = config["spinal_cord"]["families"]
    for region in regions.values():
        assert region.get("tissue") in {None, "white", "gray", "fluid"}
        assert set(region["aliases"]) == {"en", "fr"}
        assert region["display_names"]["en"] and region["display_names"]["fr"]
        if region["id"] == "zanatomy:midline:cord":
            # The whole cord heads the system rather than sitting in one of its families.
            assert region["family"] is region["family_names"] is region["family_order"] is None
            continue
        assert region["family_names"] == families[region["family"]]
        assert region["family_order"] == list(families).index(region["family"])


def test_the_layer_declares_what_it_is_and_what_it_is_not(published):
    _, layer, regions, _ = published
    assert layer["license"] and layer["attribution"]
    for region in regions.values():
        assert region["supplemental"] is True
        assert region["mri_registered"] is False
        assert "not registered" in region["notes"]["en"]
        assert region["system_names"]["en"] == "Spinal cord"
        schematic = region.get("tissue") is not None and region["source_name"] != "White matter of spinal cord"
        assert ("schematic" in region["notes"]["en"]) == schematic, region["id"]
    medial = [r for r in regions.values() if r["source_name"] == "Medial vestibulospinal tract"]
    assert len(medial) == 2
    assert all("intermediate zone" in region["notes"]["en"] for region in medial)


def test_validation_reports_the_published_assembly(published):
    config, layer, regions, _ = published
    report = spinal_cord.validate(config, layer)
    assert report["source_shape_preserved"] and report["watertight"]
    assert report["mri_registered"] is False
    assert report["structure_count"] == len(config["spinal_cord"]["structures"])
    assert report["region_count"] == len(regions) == 58
