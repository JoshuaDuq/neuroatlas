"""Derived transforms re-derived from their sources rather than read back."""

import json
import tempfile
from pathlib import Path

import nibabel as nib
import numpy as np
from nibabel.affines import apply_affine
from nibabel.freesurfer.io import read_annot, read_geometry, write_annot
from scipy.spatial import cKDTree

from .layers import networks
from .sources import HEMISPHERES, ROOT, sha256, tract_catalog


def projected_annotation_names(config):
    """Every surface atlas but Destrieux, the subject's own parcellation, then the networks."""
    return [atlas["annotation"] for atlas in config["atlases"] if atlas["id"] != "destrieux"] + (
        [networks.ANNOTATION] if networks.is_declared(config) else []
    )


def validate_projected_annotations(config):
    """Each projected annotation, re-derived from its source brain, byte for byte.

    The forward nearest source vertex on the registered spheres, written with
    the source's own colour table, must reproduce the committed file exactly.
    """
    source = config["anatomy"]["hcp_source_directory"]
    target = config["source_directory"]
    report = {}
    with tempfile.TemporaryDirectory() as scratch:
        for name in projected_annotation_names(config):
            report[name] = {}
            for prefix, hemisphere in HEMISPHERES.items():
                labels, colors, names = read_annot(source / "label" / f"{prefix}.{name}.annot")
                source_sphere, _ = read_geometry(source / "surf" / f"{prefix}.sphere.reg")
                target_sphere, _ = read_geometry(target / "surf" / f"{prefix}.sphere.reg")
                nearest = cKDTree(source_sphere).query(target_sphere)[1]
                derived = Path(scratch) / f"{prefix}.{name}.annot"
                write_annot(derived, labels[nearest], colors, names, fill_ctab=False)
                committed = target / "label" / derived.name
                if derived.read_bytes() != committed.read_bytes():
                    raise ValueError(f"{committed.name} is not its re-derived projection")
                report[name][hemisphere] = {
                    "target_vertices": len(target_sphere),
                    "sha256": sha256(committed),
                    "byte_identical_to_rederivation": True,
                }
    return report


def validate_diffusion_space(config):
    """The tract reference's scanner-to-surface transform, from orig.mgz alone.

    A conformed volume's surface RAS is its scanner RAS shifted by -c_ras, so
    the transform must also be that pure translation, read from the header.
    """
    catalog = tract_catalog(config)
    path = ROOT / "public/diffusion" / catalog["reference_space"]
    recorded = json.loads(path.read_text())
    orig_path = config["source_directory"] / "mri/orig.mgz"
    source_path = ROOT / recorded["source"]
    if (
        recorded["anatomy"] != config["anatomy"]["id"]
        or recorded["orig_sha256"] != sha256(orig_path)
        or recorded["source_sha256"] != sha256(source_path)
        or recorded["source_sha256"] != config["anatomy"]["reconstruction"]["input_sha256"]
    ):
        raise ValueError(f"{path.name} records other sources than this reconstruction")
    orig = nib.load(orig_path)
    transform = orig.header.get_vox2ras_tkr() @ np.linalg.inv(orig.affine)
    shift = np.eye(4)
    shift[:3, 3] = -np.asarray(orig.header["Pxyz_c"], float)
    if not np.allclose(transform, shift, rtol=0, atol=1e-6):
        raise ValueError("orig.mgz surface RAS is not its scanner RAS shifted by -c_ras")
    reconstruction = json.loads(
        (config["source_directory"] / config["anatomy"]["reconstruction"]["provenance"]).read_text()
    )
    error = max(
        float(np.abs(np.asarray(recorded["scanner_ras_to_surface_ras"]) - transform).max()),
        float(np.abs(np.asarray(reconstruction["scanner_ras_to_surface_ras"]) - transform).max()),
    )
    voxels = np.array([anchor["source_voxel"] for anchor in recorded["anchors"]])
    scanner = apply_affine(nib.load(source_path).affine, voxels)
    surface = apply_affine(transform, scanner)
    error = max(error, *(
        float(np.abs(np.array([a[key] for a in recorded["anchors"]]) - value).max())
        for key, value in (("scanner_ras_mm", scanner), ("surface_ras_mm", surface))
    ))
    if error > 1e-9:
        raise ValueError(f"{path.name} differs from orig.mgz by {error:.3g} mm")
    return {
        "file": str(path.relative_to(ROOT)),
        "sha256": sha256(path),
        "scanner_ras_to_surface_ras": transform.tolist(),
        "translation_equals_minus_c_ras": True,
        "anchors": len(voxels),
        "maximum_difference_mm": error,
    }


def validate_transforms(config):
    report = {}
    if "project_hcp_from" in config["anatomy"]:
        report["projected_annotations"] = validate_projected_annotations(config)
    if tract_catalog(config) is not None:
        report["diffusion_space"] = validate_diffusion_space(config)
    return report
