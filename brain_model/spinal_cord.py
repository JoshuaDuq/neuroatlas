"""Z-Anatomy reference cord, placed illustratively without deforming its shape."""

import nibabel as nib
import numpy as np
import trimesh

from .export import add_region, published_area_mm2, write_scene
from .geometry import to_gltf
from .sources import ROOT, sha256

ATLAS_ID = "zanatomy"

NOTES = {
    "en": "Z-Anatomy reference cord in its anatomical posture; seated below the "
          "brainstem by translation alone, not registered to this subject’s MRI. "
          "Segment levels and root counts are the reference model’s, not this subject’s.",
    "fr": "Moelle de référence Z-Anatomy dans sa posture anatomique ; placée sous le "
          "tronc cérébral par simple translation, sans recalage sur l’IRM de ce sujet. "
          "Les niveaux segmentaires et le nombre de racines sont ceux du modèle de "
          "référence, non ceux de ce sujet.",
}

SCHEMATIC = {
    "en": "Its cross-section is Z-Anatomy’s schematic one, swept unchanged along the cord, "
          "so every level shows the same arrangement.",
    "fr": "Sa section est le schéma de Z-Anatomy, prolongé sans changement le long de la "
          "moelle : chaque niveau montre la même disposition.",
}


def is_available(config):
    """Whether this checkout has run the one-off Blender extraction."""
    return "spinal_cord" in config and (ROOT / config["spinal_cord"]["source"]).exists()


def key_of(structure):
    return f"{structure['hemisphere']}:{structure['id']}"


def notes_of(structure):
    notes = [NOTES]
    if "tissue" in structure and structure["id"] != "cord":
        notes.append(SCHEMATIC)
    if "note" in structure:
        notes.append(structure["note"])
    return {lang: " ".join(note[lang] for note in notes) for lang in NOTES}


def limitations(config):
    return [NOTES["en"], SCHEMATIC["en"],
            *(s["note"]["en"] for s in config["spinal_cord"]["structures"] if "note" in s)]


def describe(config, structure, hemisphere, mesh):
    families = config["spinal_cord"]["families"]
    family = structure.get("family")
    region = {
        "id": f"{ATLAS_ID}:{hemisphere}:{structure['id']}",
        "atlas": ATLAS_ID,
        "label": f"{structure['names']['en']} (Z-Anatomy reference)",
        "source_name": structure["object"],
        "kind": "structure",
        "hemisphere": hemisphere,
        "supplemental": True,
        "mri_registered": False,
        "display_names": dict(structure["names"]),
        "system_names": {"en": "Spinal cord", "fr": "Moelle épinière"},
        "family": family,
        "family_names": dict(families[family]) if family else None,
        "family_order": list(families).index(family) if family else None,
        "aliases": {lang: list(structure.get("aliases", {}).get(lang, [])) for lang in ("en", "fr")},
        "notes": notes_of(structure),
        # Every other structure measures its volume from the voxels it was
        # segmented from. This one has no segmentation behind it, so the figure
        # under the same name is the volume its published closed surface encloses.
        "segmentation_volume_mm3": float(mesh.volume),
        "surface_area_mm2": published_area_mm2(to_gltf(mesh.vertices), mesh.faces),
    }
    if "tissue" in structure:
        region["tissue"] = structure["tissue"]
    return region


def read_structures(config):
    archive = np.load(ROOT / config["spinal_cord"]["source"])
    meshes = {}
    for structure in config["spinal_cord"]["structures"]:
        key = key_of(structure)
        mesh = trimesh.Trimesh(vertices=archive[f"{key}/vertices"],
                               faces=archive[f"{key}/faces"], process=False)
        if not mesh.is_watertight or not mesh.is_winding_consistent or mesh.volume <= 0:
            raise ValueError(f"Reference cord structure {key!r} is not a closed outward solid")
        meshes[key] = mesh
    return meshes


def placement(config, cord):
    """The one translation that seats the cord's upper end at the brainstem.

    Every structure moves by it, so the roots keep the cord they leave and the
    assembly stays exactly as Z-Anatomy posed it.
    """
    settings = config["spinal_cord"]
    brain = nib.load(config["source_directory"] / "mri/aseg.mgz")
    stem = nib.affines.apply_affine(
        brain.header.get_vox2ras_tkr(), np.argwhere(np.asarray(brain.dataobj) == 16)
    )
    if len(stem) == 0:
        raise ValueError("Brainstem label 16 is required to place the reference cord")
    depth = settings["brainstem_anchor_depth_mm"]
    if not np.isfinite(depth) or depth <= 0:
        raise ValueError("Brainstem anchor depth must be positive and finite")
    anchor = stem[stem[:, 2] < stem[:, 2].min() + depth].mean(axis=0)
    overlap = settings["superior_overlap_mm"]
    if not np.isfinite(overlap) or overlap < 0:
        raise ValueError("Cord overlap must be nonnegative and finite")
    anchor[2] += overlap
    band = settings["anchor_band_mm"]
    if not np.isfinite(band) or band <= 0:
        raise ValueError("Anchor band must be positive and finite")
    superior = cord.vertices[cord.vertices[:, 2] >= cord.bounds[1, 2] - band].mean(axis=0)
    transform = np.eye(4)
    transform[:3, 3] = anchor - superior
    return transform


def source_geometry(config):
    meshes = read_structures(config)
    transform = placement(config, meshes[key_of(config["spinal_cord"]["structures"][0])])
    for mesh in meshes.values():
        mesh.apply_translation(transform[:3, 3])
    return meshes, transform


def split_faces(mesh, midline):
    """The faces of each mirrored half of a structure Z-Anatomy models as one object."""
    groups = trimesh.graph.connected_components(mesh.face_adjacency, nodes=np.arange(len(mesh.faces)))
    if len(groups) != 2:
        raise ValueError(f"Expected two mirrored halves, found {len(groups)} pieces")
    sides = {}
    for group in groups:
        # RAS: the subject's left is negative x.
        side = "left" if mesh.vertices[mesh.faces[group]][..., 0].mean() < midline else "right"
        if side in sides:
            raise ValueError("Both halves lie on the same side of the midline")
        sides[side] = np.sort(group)
    return sides


def compact(mesh, faces):
    used, inverse = np.unique(mesh.faces[faces], return_inverse=True)
    return trimesh.Trimesh(mesh.vertices[used], inverse.reshape(-1, 3), process=False)


def parts(config, meshes=None):
    """Every published region with the surface it publishes, in publication order."""
    if meshes is None:
        meshes, _ = source_geometry(config)
    structures = config["spinal_cord"]["structures"]
    midline = meshes[key_of(structures[0])].vertices[:, 0].mean()
    published = []
    for structure in structures:
        source = meshes[key_of(structure)]
        if structure["hemisphere"] == "split":
            halves = split_faces(source, midline)
            pieces = [(side, compact(source, halves[side])) for side in ("left", "right")]
        else:
            pieces = [(structure["hemisphere"], source)]
        published += [{"structure": structure, "hemisphere": hemisphere, "mesh": mesh,
                       "key": f"{hemisphere}:{structure['id']}"} for hemisphere, mesh in pieces]
    return published


def build(config):
    settings = config["spinal_cord"]
    meshes, transform = source_geometry(config)
    scene = trimesh.Scene()
    regions, bounds = [], []
    for part in parts(config, meshes):
        mesh = part["mesh"]
        if not mesh.is_watertight or not mesh.is_winding_consistent or mesh.volume <= 0:
            raise ValueError(f"Reference cord part {part['key']!r} is not a closed outward solid")
        region = describe(config, part["structure"], part["hemisphere"], mesh)
        exported = add_region(scene, mesh.vertices, mesh.faces, mesh.vertex_normals,
                              region, part["structure"]["color"])
        region.update(vertex_count=len(exported.vertices), triangle_count=len(exported.faces))
        regions.append(region)
        bounds.append(mesh.bounds)
    path = config["output_directory"] / "spinal-cord.glb"
    write_scene(scene, path)
    bounds = np.array(bounds)
    return {
        "id": ATLAS_ID,
        "label": "Z-Anatomy spinal cord reference",
        "file": path.name,
        "region_count": len(regions),
        "sha256": sha256(path),
        "citation": settings["citation"],
        "license": settings["license"],
        "attribution": settings["attribution"],
        "bounds_ras_mm": [bounds[:, 0].min(axis=0).tolist(), bounds[:, 1].max(axis=0).tolist()],
        "template_to_surface_ras_mm": transform.tolist(),
    }, regions


def validate(config, layer):
    path = config["output_directory"] / layer["file"]
    if sha256(path) != layer["sha256"]:
        raise ValueError("Spinal cord asset checksum mismatch")
    meshes, transform = source_geometry(config)
    scene = trimesh.load_scene(path, process=False)
    np.testing.assert_allclose(layer["template_to_surface_ras_mm"], transform)
    published = parts(config, meshes)
    triangles = 0
    for part in published:
        source = part["mesh"]
        mesh = scene.geometry[f"{ATLAS_ID}:{part['key']}"]
        np.testing.assert_allclose(mesh.vertices, to_gltf(source.vertices), atol=3e-8, rtol=0)
        np.testing.assert_array_equal(mesh.faces, source.faces)
        if not mesh.is_watertight or not mesh.is_winding_consistent or mesh.volume <= 0:
            raise ValueError(f"Published {part['key']!r} is not a closed outward solid")
        triangles += len(mesh.faces)
    for structure in config["spinal_cord"]["structures"]:
        pieces = [part["mesh"] for part in published if part["structure"] is structure]
        if sum(len(piece.faces) for piece in pieces) != len(meshes[key_of(structure)].faces):
            raise ValueError(f"Reference cord structure {structure['id']!r} is not published whole")
    bounds = np.array([part["mesh"].bounds for part in published])
    np.testing.assert_allclose(layer["bounds_ras_mm"],
                               [bounds[:, 0].min(axis=0), bounds[:, 1].max(axis=0)])
    return {"source_shape_preserved": True, "watertight": True, "mri_registered": False,
            "structure_count": len(config["spinal_cord"]["structures"]),
            "region_count": len(published),
            "triangle_count": triangles,
            "volume_method": "Enclosed volume of the published closed surface",
            "placement": "Rigid translation onto the brainstem; no rotation or scaling",
            "division": "Mirrored objects publish their two disconnected halves; no triangle is cut"}
