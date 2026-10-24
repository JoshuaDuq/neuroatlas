"""Record the exact image-header mapping from an anatomy's own tracts to its surface RAS."""

import argparse
import json
import sys
from pathlib import Path

import nibabel as nib
import numpy as np
from nibabel.affines import apply_affine

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from brain_model.sources import ROOT, read_config, sha256, tract_catalog, write_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--anatomy", help="this declared anatomy instead of the selected one")
    config = read_config(parser.parse_args().anatomy)
    catalog = tract_catalog(config)
    if catalog is None:
        raise SystemExit(f"{config['anatomy']['id']} has no tract catalog")
    settings = config["anatomy"]["reconstruction"]
    source_path = ROOT / settings["input"]
    if sha256(source_path) != settings["input_sha256"]:
        raise ValueError("The tract reference T1 checksum changed.")
    directory = config["source_directory"]
    stamp = (directory / "scripts/build-stamp.txt").read_text().strip()
    if stamp != config["freesurfer_build"]:
        raise ValueError("The reconstruction's FreeSurfer build changed.")
    # recon-all imported the tract reference T1 itself; its record says so.
    reconstruction = json.loads((directory / settings["provenance"]).read_text())
    imported = reconstruction["raw_import"]
    if (reconstruction["input_sha256"] != settings["input_sha256"]
            or imported["voxel_values"] != "exact" or imported["maximum_affine_error_mm"] > 1e-5):
        raise ValueError("The reconstruction import is not the exact tract reference T1.")
    source = nib.load(source_path)
    orig_path = directory / "mri/orig.mgz"
    orig = nib.load(orig_path)
    surface_affine = orig.header.get_vox2ras_tkr().astype(np.float64)
    scanner_to_surface = surface_affine @ np.linalg.inv(orig.affine)
    shape = np.array(source.shape[:3])
    anchors = np.array([[0, 0, 0], shape // 2, shape - 1])
    scanner = apply_affine(source.affine, anchors)
    surface = apply_affine(surface_affine, apply_affine(np.linalg.inv(orig.affine), scanner))
    report = {
        "anatomy": catalog["anatomy"],
        "source": settings["input"], "source_sha256": sha256(source_path),
        "orig": str(orig_path.relative_to(ROOT)), "orig_sha256": sha256(orig_path),
        "scanner_affine": orig.affine.tolist(), "surface_affine": surface_affine.tolist(),
        "scanner_ras_to_surface_ras": scanner_to_surface.tolist(),
        "anchors": [
            {"source_voxel": voxel.tolist(), "scanner_ras_mm": before.tolist(),
             "surface_ras_mm": after.tolist()}
            for voxel, before, after in zip(anchors, scanner, surface)
        ],
        "method": "orig.mgz vox2ras_tkr @ inverse(scanner affine); exact coordinate change, no anatomical registration or streamline resampling",
        "citation": "https://surfer.nmr.mgh.harvard.edu/fswiki/CoordinateSystems",
    }
    destination = ROOT / "public/diffusion" / catalog["reference_space"]
    write_json(destination, report)
    print(json.dumps({"file": str(destination.relative_to(ROOT)), "transform": scanner_to_surface.tolist()}))


if __name__ == "__main__":
    main()
