"""Extract the reference spinal cord out of the Z-Anatomy scene."""

import argparse
import json
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Blender runs its own interpreter, which has no PyYAML, and the configuration
# this script is driven by is YAML. Appended rather than prepended, so nothing
# here can shadow the numpy and bmesh Blender was built against; PyYAML's C
# extension is optional, so the checkout's copy imports across the minor
# version difference between the two interpreters.
for site_packages in sorted((ROOT / ".venv/lib").glob("python3.*/site-packages")):
    sys.path.append(str(site_packages))

try:
    from brain_model.sources import read_config, sha256
except ModuleNotFoundError as missing:  # pragma: no cover - environment guard
    raise SystemExit(
        f"{missing.name!r} is not importable from Blender's interpreter. "
        "Create the project environment first (uv sync), so this script can read "
        "config/model.yaml from .venv."
    ) from missing

SOURCE_URL = "https://www.z-anatomy.com/"

# Blender's world axes against anatomy, asserted rather than assumed: +X is the
# subject's left, +Y is posterior, +Z is superior. A future Z-Anatomy release
# that re-orients the scene has to fail here, not silently publish a mirrored
# cord, so each axis is checked against viscera that can only sit one way round.
LANDMARKS = [
    ("Spleen", 0, +1, "the spleen is left of the midline"),
    ("Liver", 0, -1, "the liver is right of the midline"),
    ("Body of sternum", 1, -1, "the sternum is anterior"),
    ("Occipital bone", 1, +1, "the occipital bone is posterior"),
    ("Mandible", 2, +1, "the mandible is above the pelvis"),
]


def world_vertices(obj, depsgraph):
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    coordinates = np.array([list(obj.matrix_world @ v.co) for v in mesh.vertices])
    evaluated.to_mesh_clear()
    return coordinates


def check_axes(depsgraph):
    pelvis = world_vertices(bpy.data.objects["Sacrococcygeal symphysis"], depsgraph)
    for name, axis, sign, claim in LANDMARKS:
        obj = bpy.data.objects.get(name)
        if obj is None:
            raise ValueError(f"Z-Anatomy scene has no {name!r} to check its axes against")
        centre = world_vertices(obj, depsgraph).mean(axis=0)
        reference = pelvis.mean(axis=0)[axis] if axis == 2 else 0.0
        if np.sign(centre[axis] - reference) != sign:
            raise ValueError(f"Z-Anatomy axis {axis} is not oriented as expected: {claim}")


# The tissue a structure is published as has to be the tissue Z-Anatomy files it under.
TISSUE_GROUPS = {
    "white": "White matter of spinal cord.g",
    "gray": "Grey matter of spinal cord.g",
    "fluid": "Central structures of spinal cord.g",
}


def check_tissue(obj, tissue):
    ancestors, parent = [], obj.parent
    while parent is not None:
        ancestors.append(parent.name)
        parent = parent.parent
    if TISSUE_GROUPS[tissue] not in ancestors:
        raise ValueError(f"{obj.name!r} is declared {tissue}, but Z-Anatomy files it under {ancestors[:3]}")


def components(mesh):
    seen, groups = set(), []
    for face in mesh.faces:
        if face in seen:
            continue
        group, stack = [], [face]
        while stack:
            current = stack.pop()
            if current in seen:
                continue
            seen.add(current)
            group.append(current)
            for edge in current.edges:
                if len(edge.link_faces) == 2:
                    stack.extend(edge.link_faces)
        groups.append(group)
    return groups


def interior_sheets(mesh):
    label = {face: at for at, group in enumerate(components(mesh)) for face in group}
    intruders = set()
    for edge in mesh.edges:
        if len(edge.link_faces) <= 2:
            continue
        tally = {}
        for face in edge.link_faces:
            tally[label[face]] = tally.get(label[face], 0) + 1
        minority = [group for group, count in tally.items() if count == 1]
        if len(tally) < 2 or len(minority) != len(tally) - 1:
            raise ValueError(f"Cannot tell which surface bounds the solid at edge {edge.index}")
        intruders.update(minority)
    return [face for face, group in label.items() if group in intruders]


def surface(obj, depsgraph):
    evaluated = obj.evaluated_get(depsgraph)
    mesh = bmesh.new()
    mesh.from_mesh(evaluated.to_mesh())
    evaluated.to_mesh_clear()
    mesh.transform(obj.matrix_world)
    bmesh.ops.triangulate(mesh, faces=mesh.faces[:])

    sheets = interior_sheets(mesh)
    if sheets:
        bmesh.ops.delete(mesh, geom=sheets, context="FACES")
        loose = [v for v in mesh.verts if not v.link_faces]
        if loose:
            bmesh.ops.delete(mesh, geom=loose, context="VERTS")

    # The sweep leaves every tube open at both ends. Filling those rings adds
    # faces but moves no source vertex, and it is what makes the result a solid
    # the viewer can cut.
    holes = [edge for edge in mesh.edges if edge.is_boundary]
    if holes:
        bmesh.ops.holes_fill(mesh, edges=holes, sides=0)
        bmesh.ops.triangulate(mesh, faces=[f for f in mesh.faces if len(f.verts) > 3])
    bmesh.ops.recalc_face_normals(mesh, faces=mesh.faces[:])

    open_edges = sum(1 for edge in mesh.edges if len(edge.link_faces) != 2)
    if open_edges:
        raise ValueError(f"{obj.name!r} did not close: {open_edges} edges are not shared by two faces")

    index = {vertex: at for at, vertex in enumerate(mesh.verts)}
    vertices = np.array([list(v.co) for v in mesh.verts], dtype=np.float64)
    faces = np.array([[index[v] for v in f.verts] for f in mesh.faces], dtype=np.int64)
    mesh.free()
    return vertices, faces


def to_ras(coordinates):
    return coordinates * np.array([-1000.0, -1000.0, 1000.0])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", action="store_true",
                        help="register the result in data/sources.json")
    arguments = parser.parse_args(sys.argv[sys.argv.index("--") + 1:]
                                  if "--" in sys.argv else [])

    config = read_config()
    settings = config["spinal_cord"]
    depsgraph = bpy.context.evaluated_depsgraph_get()
    check_axes(depsgraph)

    arrays = {}
    for structure in settings["structures"]:
        obj = bpy.data.objects.get(structure["object"])
        if obj is None:
            raise ValueError(f"Z-Anatomy scene has no {structure['object']!r}")
        vertices, faces = surface(obj, depsgraph)
        key = f"{structure['hemisphere']}:{structure['id']}"
        arrays[f"{key}/vertices"] = to_ras(vertices)
        arrays[f"{key}/faces"] = faces
        print(f"{structure['object']:34s} {len(vertices):6d} vertices  {len(faces):6d} triangles")

    path = ROOT / settings["source"]
    path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(path, **arrays)
    print(f"\n{path.relative_to(ROOT)}: {len(settings['structures'])} structures")

    if not arguments.record:
        print("Re-run with --record to register this file in data/sources.json.")
        return
    manifest = ROOT / "data/sources.json"
    provenance = json.loads(manifest.read_text())
    relative = str(path.relative_to(ROOT))
    provenance["sources"] = [
        source for source in provenance["sources"] if source["path"] != relative
    ] + [{
        "path": relative,
        "sha256": sha256(path),
        "optional": True,
        "derived_from": SOURCE_URL,
        "procedure": "scripts/extract_spinal_cord.py: evaluated Blender modifiers, "
                     "interior sheets dropped, open sweep ends filled",
        "citation": settings["citation"],
    }]
    manifest.write_text(json.dumps(provenance, indent=2) + "\n")
    print(f"recorded {relative}")


if __name__ == "__main__":
    main()
