"""Derive a display outline from the tract reference's skull-stripped T1."""

import hashlib
import json
from pathlib import Path

import nibabel as nib
import numpy as np
import trimesh
import yaml
from scipy import ndimage
from skimage.measure import marching_cubes

ROOT = Path(__file__).resolve().parents[1]


def prepare_outline():
    catalog = yaml.safe_load((ROOT / "data/diffusion.yaml").read_text())
    settings = catalog["brain_outline"]
    descriptor = next(
        item for item in catalog["maps"] if item["id"] == settings["source_map"]
    )
    directory = ROOT / "public/diffusion"
    source = directory / descriptor["file"]
    image = nib.load(source)
    values = image.get_fdata(dtype=np.float32)
    if values.ndim != 3 or not np.isfinite(values).all():
        raise ValueError("The brain outline requires a finite 3D T1 image")
    components, count = ndimage.label(values >= settings["intensity_threshold"])
    if count == 0:
        raise ValueError("The configured T1 threshold contains no brain")
    sizes = np.bincount(components.ravel())
    sizes[0] = 0
    mask = components == sizes.argmax()
    field = np.where(mask, values, 0)
    voxels, faces, _, _ = marching_cubes(
        field, level=settings["intensity_threshold"],
        step_size=settings["step_size"], allow_degenerate=False,
    )
    ras = nib.affines.apply_affine(image.affine, voxels)
    world = ras[:, [0, 2, 1]] / 1000
    world[:, 2] *= -1
    mesh = trimesh.Trimesh(vertices=world, faces=faces, process=False)
    target = directory / settings["file"]
    target.write_bytes(mesh.export(file_type="glb"))
    provenance = {
        "source": descriptor["file"],
        "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "published_sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        "method": "Lewiner marching cubes on the largest connected T1 "
                  "component above the configured intensity threshold",
        "intensity_threshold": settings["intensity_threshold"],
        "step_size_voxels": settings["step_size"],
        "source_affine": image.affine.tolist(),
        "display_transform": "RAS mm to (R, S, -A) meters; no registration",
        "vertices": len(world), "triangles": len(faces),
        "ras_bounds_mm": [ras.min(axis=0).tolist(), ras.max(axis=0).tolist()],
        "limitations": "MRI-derived display outline, not a pial or labeled "
                        "cortical reconstruction; limited to the source field of view",
        "software": {
            "nibabel": nib.__version__, "numpy": np.__version__,
            "trimesh": trimesh.__version__,
        },
    }
    (directory / settings["provenance"]).write_text(
        json.dumps(provenance, indent=2) + "\n"
    )
    print(f"Prepared MRI outline: {len(world)} vertices, {len(faces)} triangles")


if __name__ == "__main__":
    prepare_outline()
