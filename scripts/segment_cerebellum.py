"""Segment one brain's cerebellar lobules with FastSurfer's CerebNet, on the CPU.

Runs FastSurfer's segmentation stream (FastSurferVINN, then CerebNet) on the
subject's own orig.mgz. CerebNet crops the cerebellum out of FastSurferVINN's
segmentation, so that runs too; its surfaces, hypothalamus and corpus callosum
modules do not. orig.mgz is already conformed, so FastSurfer keeps its grid
and the lobules are written back onto it unresampled.
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

import nibabel as nib
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brain_model.labels import cerebellum
from brain_model.sources import ROOT, read_config, sha256

CACHE = ROOT / "data/cache"
FASTSURFER = {
    "path": CACHE / "fastsurfer/src",
    "url": "https://github.com/Deep-MI/FastSurfer",
    "tag": "v2.6.0",
    "commit": "1dc024735371f65bc4b94a272cf596be6ddf4f21",
}
PYTHON = CACHE / "fastsurfer-venv/bin/python"
# FastSurfer's download_checkpoints.py fetches these from the record its
# checkpoint_paths.yaml names; they are pinned here by content.
CHECKPOINTS = {
    "aparc_vinn_axial_v2.0.0.pkl": "81ab25ccbfc432cc41fb6089d11ff2a45b5a88e659092096cb1e067269f806b8",
    "aparc_vinn_coronal_v2.0.0.pkl": "73813957e83ec99d2c4e22f7854308916ec276d66ab7ed8ef8bf3998ba05e289",
    "aparc_vinn_sagittal_v2.0.0.pkl": "edae6262d69526fea39a019f2dfd8df75eb705f8f025b9b97166e3e17b917414",
    "CerebNet_axial_v1.0.0.pkl": "7e93f3e69dc6a8e7b11d223b59069a9f09f7f48474eb3bd31ea70cee3f603e33",
    "CerebNet_coronal_v1.0.0.pkl": "3a6fb6c3ea1b5f549d00f99840cc9dd406dd1c0552213c7871f5fc0ef5ca9036",
    "CerebNet_sagittal_v1.0.0.pkl": "182a3984905035dd99eac640943292ce5a5872e77e0ba87823622758bc3fc495",
}


def verify_runtime():
    commit = subprocess.run(
        ["git", "-C", str(FASTSURFER["path"]), "rev-parse", "HEAD"],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    if commit != FASTSURFER["commit"]:
        raise SystemExit(f"Expected FastSurfer {FASTSURFER['tag']} ({FASTSURFER['commit']}), found {commit}.")
    for name, digest in CHECKPOINTS.items():
        if sha256(FASTSURFER["path"] / "checkpoints" / name) != digest:
            raise SystemExit(f"FastSurfer checkpoint checksum mismatch: {name}")


def run_fastsurfer(orig, subjects, subject, threads):
    output = subjects / subject / "mri/cerebellum.CerebNet.nii.gz"
    if output.exists():
        return output
    subjects.mkdir(parents=True, exist_ok=True)
    log = subjects / f"{subject}-run.log"
    print(f"== FastSurfer seg_only on {orig.relative_to(ROOT)} (log: {log})", flush=True)
    with open(log, "w") as handle:
        subprocess.run(
            [
                "./run_fastsurfer.sh", "--t1", str(orig), "--sd", str(subjects), "--sid", subject,
                "--seg_only", "--no_hypothal", "--no_cc", "--no_biasfield",
                "--device", "cpu", "--threads", str(threads), "--py", str(PYTHON),
            ],
            cwd=FASTSURFER["path"], env={**os.environ, "FASTSURFER_HOME": str(FASTSURFER["path"])},
            stdout=handle, stderr=subprocess.STDOUT, check=True,
        )
    return output


def lobules_on_orig(orig, output):
    """CerebNet's labels, refused unless FastSurfer kept orig.mgz's grid."""
    reference = nib.load(orig)
    image = nib.load(output)
    if image.shape != reference.shape or not np.allclose(image.affine, reference.affine, atol=1e-4):
        raise SystemExit(f"{output.name} is not on {orig.name}'s grid.")
    labels = np.asarray(image.dataobj)
    if not np.array_equal(labels, np.rint(labels)):
        raise SystemExit(f"{output.name} holds non-integer labels.")
    return labels.astype(np.int16), reference


def record_source(config, path, threads):
    manifest = ROOT / "data/sources.json"
    provenance = json.loads(manifest.read_text())
    orig = config["source_directory"] / "mri/orig.mgz"
    relative = str(path.relative_to(ROOT))
    provenance["sources"] = [
        source for source in provenance["sources"] if source["path"] != relative
    ] + [{
        "path": relative,
        "sha256": sha256(path),
        "anatomy": config["anatomy"]["id"],
        "optional": True,
        "derived_from": [
            {"path": str(orig.relative_to(ROOT)), "sha256": sha256(orig)},
            {"url": FASTSURFER["url"], "tag": FASTSURFER["tag"], "commit": FASTSURFER["commit"]},
            *({"checkpoint": name, "sha256": digest} for name, digest in CHECKPOINTS.items()),
        ],
        "procedure": (
            "scripts/segment_cerebellum.py: FastSurfer run_fastsurfer.sh --seg_only --no_hypothal "
            f"--no_cc --no_biasfield --device cpu --threads {threads} on orig.mgz; "
            "mri/cerebellum.CerebNet.nii.gz rewritten with orig.mgz's header, labels unchanged"
        ),
        "citation": cerebellum.CITATION,
        "license": "FastSurfer and its CerebNet models are Apache-2.0.",
    }]
    manifest.write_text(json.dumps(provenance, indent=2) + "\n")
    print(f"recorded {relative}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--anatomy", help="segment this declared anatomy instead of the selected one")
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--record", action="store_true", help="add the result to data/sources.json")
    args = parser.parse_args()

    config = read_config(args.anatomy)
    verify_runtime()
    orig = config["source_directory"] / "mri/orig.mgz"
    output = run_fastsurfer(orig, CACHE / "fastsurfer/subjects", config["anatomy"]["id"], args.threads)
    labels, reference = lobules_on_orig(orig, output)
    destination = cerebellum.path(config)
    cerebellum.save(labels, reference, destination)

    # Read back through the build's own loader, which checks the grid and the label set.
    grid = cerebellum.load(config)
    volumes = {
        int(label): round(int(count) * grid.voxel_volume_mm3)
        for label, count in zip(*np.unique(grid.labels[grid.labels > 0], return_counts=True))
    }
    print(f"{destination.relative_to(ROOT)}: label volumes (mm³) {volumes}")
    if args.record:
        record_source(config, destination, args.threads)
    else:
        print("Re-run with --record to register this file in data/sources.json.")


if __name__ == "__main__":
    main()
