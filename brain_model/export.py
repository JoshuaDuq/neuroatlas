"""glTF export: named regions, shared-frame geometry and source metadata."""

import numpy as np
import trimesh
from trimesh.exchange.gltf import export_glb
from trimesh.visual.material import PBRMaterial

from .geometry import normalize, to_gltf


def published_area_mm2(vertices, faces):
    """Surface area of the geometry as glTF stores it, in square millimetres.

    `vertices` are already in the export frame, where glTF writes them as
    float32. Measuring in float64 would describe geometry the file does not
    contain: negligible for an ordinary structure, but on a sliver a few voxels
    across the difference exceeds the manifest's area tolerance. Recording what
    is published keeps that tolerance tight without withholding the structure.
    """
    quantized = np.asarray(vertices, dtype=np.float32).astype(np.float64)
    mesh = trimesh.Trimesh(quantized, faces, process=False)
    return float(mesh.area * 1e6)


def add_region(scene, vertices, faces, normals, region, color):
    metadata = {**region, "region_id": region["id"]}
    material = PBRMaterial(
        name=region["id"],
        baseColorFactor=[*color, 255],
        metallicFactor=0.0,
        roughnessFactor=0.78,
        doubleSided=True,
    )
    mesh = trimesh.Trimesh(
        vertices=to_gltf(vertices),
        faces=faces,
        vertex_normals=normalize(to_gltf(normals)),
        visual=trimesh.visual.TextureVisuals(material=material),
        metadata=metadata,
        process=False,
    )
    scene.add_geometry(
        mesh, node_name=region["id"], geom_name=region["id"], metadata=metadata
    )
    return mesh


def write_scene(scene, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    scene.units = "meters"
    path.write_bytes(export_glb(scene, include_normals=True))


def compact_region(partition, label):
    faces = partition.faces[partition.labels == label]
    indices, inverse = np.unique(faces, return_inverse=True)
    return (
        partition.vertices[indices],
        inverse.reshape(-1, 3),
        partition.normals[indices],
    )
