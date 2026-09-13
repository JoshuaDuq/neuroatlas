"""Closed native cortical envelopes for solid, geometry-defined tissue cuts."""

import numpy as np
import trimesh
from nibabel.freesurfer.io import read_geometry

from .export import write_scene
from .geometry import to_gltf
from .sources import sha256


def export_solid_envelopes(config):
    scene = trimesh.Scene()
    for prefix, hemisphere in [("lh", "left"), ("rh", "right")]:
        for boundary in ["pial", "white"]:
            vertices, faces = read_geometry(
                config["source_directory"] / "surf" / f"{prefix}.{boundary}"
            )
            mesh = trimesh.Trimesh(
                vertices=to_gltf(vertices), faces=faces, process=False,
                metadata={"hemisphere": hemisphere, "boundary": boundary},
            )
            if not mesh.is_watertight or not mesh.is_winding_consistent:
                raise ValueError(f"{prefix}.{boundary}: solid envelope must be closed")
            if mesh.volume <= 0:
                raise ValueError(f"{prefix}.{boundary}: solid envelope must face outward")
            name = f"{hemisphere}:{boundary}"
            scene.add_geometry(mesh, node_name=name, geom_name=name)
    path = config["output_directory"] / "tissue-envelopes.glb"
    write_scene(scene, path)
    return {
        "file": path.name,
        "sha256": sha256(path),
        "source": "Native lh/rh.pial and lh/rh.white; vertices and triangles unchanged",
    }


def validate_solid_envelopes(config, record):
    path = config["output_directory"] / record["file"]
    if sha256(path) != record["sha256"]:
        raise ValueError("Solid envelope checksum mismatch")
    scene = trimesh.load_scene(path, process=False)
    expected = {
        f"{hemisphere}:{boundary}"
        for hemisphere in ["left", "right"] for boundary in ["pial", "white"]
    }
    if set(scene.geometry) != expected:
        raise ValueError("Solid envelopes must contain both native pial/white pairs")
    maximum_error = 0.0
    for prefix, hemisphere in [("lh", "left"), ("rh", "right")]:
        for boundary in ["pial", "white"]:
            vertices, faces = read_geometry(
                config["source_directory"] / "surf" / f"{prefix}.{boundary}"
            )
            mesh = scene.geometry[f"{hemisphere}:{boundary}"]
            if not np.array_equal(mesh.faces, faces):
                raise ValueError("Solid envelope source topology mismatch")
            if mesh.vertices.shape != vertices.shape:
                raise ValueError("Solid envelope source vertex count mismatch")
            error = float(np.max(np.abs(mesh.vertices - to_gltf(vertices)))) * 1000
            if error > config["validation"]["coordinate_tolerance_mm"]:
                raise ValueError("Solid envelope source coordinate mismatch")
            if not mesh.is_watertight or not mesh.is_winding_consistent or mesh.volume <= 0:
                raise ValueError("Solid envelope must be closed and outward-facing")
            maximum_error = max(maximum_error, error)
    return {
        "file": record["file"], "sha256": record["sha256"],
        "identical_native_topology": True,
        "maximum_coordinate_error_mm": maximum_error,
    }
