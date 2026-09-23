"""Segment one brain with the NextBrain atlas at 0.4 mm, using FreeSurfer 8.2 on the CPU.

Runs SuperSynth, then NextBrain's Bayesian segmentation once per hemisphere, on
the subject's own orig.mgz. The two hemispheres are then joined on one 0.4 mm
grid in the subject's surface RAS. A FreeSurfer step whose output is already in
the work directory is not run again.
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

import nibabel as nib
import numpy as np
from nibabel.affines import apply_affine
from scipy.ndimage import map_coordinates

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brain_model import nextbrain
from brain_model.sources import ROOT, read_config, sha256
from brain_model.volumes import offset_by, resample_nearest

CACHE = ROOT / "data/cache"
RUNTIME = Path(__file__).resolve().parent / "freesurfer"
CITATION = "https://doi.org/10.1038/s41586-025-09708-2"
FREESURFER_BUILD = "freesurfer-macOS-darwin_arm64-8.2.0-20260314-d932c45"
DIST = "https://ftp.nmr.mgh.harvard.edu/pub/dist/lcnpublic/dist"
SUPERSYNTH = {
    "path": CACHE / "supersynth/SuperSynth_August_2025.pth",
    "url": f"{DIST}/SuperSynth_Iglesias_2025/SuperSynth_August_2025.pth",
    "sha256": "7f75926757070f53e1e43c4bf31dafe2e599ef56438ce60347f12e9133bffd1d",
}
ATLAS = {
    "path": CACHE / "nextbrain-atlas/atlas_simplified",
    "url": f"{DIST}/Histo_Atlas_Iglesias_2023/atlas_simplified.zip",
    "sha256": "8ea7c5aa8f162007e2405f6bdbb4a74013e2e296bc4790ba21344ffa37e78f19",
    # The zip is not kept once extracted; this pins what was extracted from it.
    "tree_sha256": "20d9c58f370755a9b9fb8c137274d76e150f29be6966c10965f13082133235e2",
}
CROP_MARGIN_VOXELS = 20
SPACING_MM = 0.4
# Joined-grid origins sit on multiples of two voxels, so the build's 2x2x2 cut
# label blocks fall on one fixed 0.8 mm lattice whatever the labelled extent.
LATTICE_MM = 2 * SPACING_MM
WORKAROUNDS = {
    "conv3d_slices": (
        "FreeSurfer 8.2's arm64 torch 2.1.2 has no oneDNN, so CPU conv3d builds a "
        "whole-volume im2col buffer (about 90 GB for SuperSynth). "
        "scripts/freesurfer/conv3d_slices.py computes the same stride-1 convolution "
        "as a sum over kernel depth of 2D convolutions of shifted slices: the same "
        "products in a different summation order, matching torch conv3d to 1e-5 "
        "relative. FireANTs keeps the builtin F.conv3d, which its TorchScript "
        "functions bind when they compile."
    ),
    "supersynth_memory_releases": (
        "SuperSynth's inference.py drops its first-pass network outputs before the "
        "flipped pass, and the flipped outputs once they are averaged in. Only when "
        "memory is freed changes."
    ),
    "opencv_stand_in": (
        "FreeSurfer 8.2's macOS Python has no OpenCV, yet ERC_bayesian_segmentation's "
        "ext/my_functions.py imports cv2 at module level for one helper that asserts "
        "False on entry. A stand-in module lets the import succeed and raises if any "
        "attribute of it is used."
    ),
}


def file_sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(2**24), b""):
            digest.update(chunk)
    return digest.hexdigest()


def tree_sha256(directory):
    digest = hashlib.sha256()
    for path in sorted(p for p in directory.rglob("*") if p.is_file()):
        digest.update(f"{path.relative_to(directory)}\0{file_sha256(path)}\n".encode())
    return digest.hexdigest()


def verify_runtime(freesurfer):
    stamp = (freesurfer / "build-stamp.txt").read_text().strip()
    if stamp != FREESURFER_BUILD:
        raise SystemExit(f"Expected FreeSurfer {FREESURFER_BUILD}, found {stamp}.")
    if file_sha256(SUPERSYNTH["path"]) != SUPERSYNTH["sha256"]:
        raise SystemExit(f"SuperSynth model checksum mismatch: {SUPERSYNTH['path']}")
    if tree_sha256(ATLAS["path"]) != ATLAS["tree_sha256"]:
        raise SystemExit(f"NextBrain atlas checksum mismatch: {ATLAS['path']}")


def crop_input(config, work):
    """orig.mgz cropped to brain.mgz's extent plus a margin; values untouched."""
    directory = config["source_directory"] / "mri"
    orig = nib.load(directory / "orig.mgz")
    occupied = np.argwhere(np.asarray(nib.load(directory / "brain.mgz").dataobj) > 0)
    lower = np.maximum(occupied.min(axis=0) - CROP_MARGIN_VOXELS, 0)
    upper = np.minimum(occupied.max(axis=0) + 1 + CROP_MARGIN_VOXELS, orig.shape)
    data = np.asarray(orig.dataobj)[tuple(slice(a, b) for a, b in zip(lower, upper))]
    affine = orig.affine @ offset_by(lower)
    path = work / "input.mgz"
    if path.exists():
        existing = nib.load(path)
        if not (
            np.array_equal(np.asarray(existing.dataobj), data)
            and np.allclose(existing.affine, affine, atol=1e-4)
        ):
            raise SystemExit(f"{path} is not this crop of orig.mgz; remove the work directory.")
    else:
        work.mkdir(parents=True, exist_ok=True)
        nib.save(nib.MGHImage(data, affine, header=orig.header.copy()), path)
    return path, {
        "source": "orig.mgz",
        "rule": f"bounding box of brain.mgz > 0, plus {CROP_MARGIN_VOXELS} voxels, within the grid",
        "corner_voxel": lower.tolist(),
        "shape": list(data.shape),
    }


def run_freesurfer(freesurfer, work, image, threads):
    env = {**os.environ, "FREESURFER_HOME": str(freesurfer)}
    packages = freesurfer / "python/packages"

    def fspython(name, script, *arguments):
        command = [
            "bash", "-c",
            'source "$FREESURFER_HOME/SetUpFreeSurfer.sh" > /dev/null && exec fspython "$@"',
            "fspython", str(RUNTIME / "run_patched.py"), str(script), *map(str, arguments),
        ]
        print(f"== {name} {time.strftime('%H:%M:%S')} (log: {work / f'{name}.log'})", flush=True)
        with open(work / f"{name}.log", "w") as log:
            subprocess.run(command, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)

    if not (work / "SuperSynth/segmentation.mgz").exists():
        fspython(
            "supersynth", packages / "SuperSynth/scripts/inference.py",
            "--i", image, "--o", f"{work}/SuperSynth/", "--mode", "invivo",
            "--threads", threads, "--device", "cpu",
            "--model_file", SUPERSYNTH["path"], "--test_time_flipping",
        )
    for side in ("left", "right"):
        if not (work / f"seg.{side}.nii.gz").exists():
            fspython(
                f"nextbrain-{side}",
                packages / "ERC_bayesian_segmentation/scripts/segment_fireants.py",
                "--i", image, "--o", work, "--atlas_dir", ATLAS["path"],
                "--mode", "invivo", "--side", side, "--device", "cpu", "--threads", threads,
            )


def logged_threads(work):
    """CPU thread counts NextBrain reported; SuperSynth does not log its own."""
    found = set()
    for log in work.glob("*.log"):
        found.update(map(int, re.findall(r"Using (\d+) CPU thread", log.read_text(errors="replace"))))
    return sorted(found)


def read_hemisphere(work, side):
    image = nib.load(work / f"seg.{side}.nii.gz")
    data = np.asarray(image.dataobj)
    if not np.all(data == np.rint(data)) or data.min() < 0:
        raise ValueError(f"seg.{side}.nii.gz must hold nonnegative integer labels.")
    return image, data.astype(np.int32)


def joined_grid(boxes):
    """A 0.4 mm surface-RAS lattice covering every labelled voxel of both sides."""
    corners = np.vstack([
        apply_affine(affine, [[i, j, k] for i in (lo[0], hi[0]) for j in (lo[1], hi[1])
                              for k in (lo[2], hi[2])])
        for affine, lo, hi in boxes
    ])
    lower = np.floor((corners.min(axis=0) - SPACING_MM) / LATTICE_MM) * LATTICE_MM
    upper = corners.max(axis=0) + SPACING_MM
    shape = np.ceil((upper - lower) / SPACING_MM).astype(int) + 1
    grid = np.diag([SPACING_MM, SPACING_MM, SPACING_MM, 1.0])
    grid[:3, 3] = lower
    return grid, tuple(shape)


def right_of_midline(work, points):
    """FreeSurfer's hemisphere rule: right where SuperSynth's MNI x is not negative."""
    grid = nib.load(work / "SuperSynth/input_resampled.mgz")
    field = nib.load(work / "SuperSynth/mni_deformation.mgz")
    if field.shape[:3] != grid.shape[:3]:
        raise ValueError("SuperSynth's deformation is not on its resampled input grid.")
    matrix = np.loadtxt(work / "SuperSynth/mni_affine.txt", delimiter=",")
    voxels = apply_affine(np.linalg.inv(grid.affine), points)
    x = map_coordinates(np.asarray(field.dataobj[..., 0], dtype=np.float64), voxels.T, order=1)
    return x + points @ matrix[0, :3] + matrix[0, 3] >= 0


def join_hemispheres(config, work):
    to_surface = nextbrain.scanner_to_surface(config)
    sides = {side: read_hemisphere(work, side) for side in ("left", "right")}
    boxes = []
    for image, data in sides.values():
        occupied = np.argwhere(data > 0)
        boxes.append((to_surface @ image.affine, occupied.min(axis=0), occupied.max(axis=0)))
    grid, shape = joined_grid(boxes)
    resampled, shifts = {}, {}
    for side, (image, data) in sides.items():
        resampled[side], shifts[side] = resample_nearest(
            data, to_surface @ image.affine, grid, shape
        )
    left, right = resampled["left"], resampled["right"]
    labels = np.where(right > 0, right + nextbrain.HEMISPHERE_OFFSET, left)
    labels = np.where(left > 0, left, labels)
    both = np.argwhere((left > 0) & (right > 0))
    if len(both):
        points = apply_affine(np.linalg.inv(to_surface) @ grid, both)
        to_right = right_of_midline(work, points)
        chosen = tuple(both[to_right].T)
        labels[chosen] = right[chosen] + nextbrain.HEMISPHERE_OFFSET
    return labels, grid, {
        "spacing_mm": SPACING_MM,
        "method": "nearest neighbour from each hemisphere's own grid onto one surface-RAS grid",
        "maximum_nearest_neighbour_shift_mm": {s: round(v, 4) for s, v in shifts.items()},
        "voxels_labelled_by_both_sides": len(both),
        "overlap_rule": "sign of SuperSynth's MNI x coordinate at the voxel centre, the rule FreeSurfer splits hemispheres by",
        "right_hemisphere_label_offset": nextbrain.HEMISPHERE_OFFSET,
    }


def read_freesurfer_lut(path):
    entries = {}
    for line in path.read_text().splitlines():
        fields = line.split()
        if fields and not fields[0].startswith("#"):
            entries[int(fields[0])] = (fields[1], [int(x) for x in fields[2:6]])
    return entries


def write_lut(entries, path):
    lines = [
        "# NextBrain labels for both hemispheres, from FreeSurfer's per-hemisphere lut.txt",
        f"# Right-hemisphere indices are offset by {nextbrain.HEMISPHERE_OFFSET}",
        "# index  name  R  G  B  A",
        "0  Unknown  0  0  0  0",
    ]
    for index, (name, rgba) in sorted(entries.items()):
        if index == nextbrain.BACKGROUND:
            continue
        for side, offset in (("Left", 0), ("Right", nextbrain.HEMISPHERE_OFFSET)):
            lines.append(f"{index + offset}  {side}-{name}  {' '.join(map(str, rgba))}")
    path.write_text("\n".join(lines) + "\n")


def write_volume(config, labels, grid, path):
    scanner = np.linalg.inv(nextbrain.scanner_to_surface(config)) @ grid
    path.parent.mkdir(parents=True, exist_ok=True)
    nib.save(nib.MGHImage(labels.astype(np.int32), scanner), path)
    written = np.asarray(nib.load(path).dataobj)
    if not np.array_equal(written, labels):
        raise SystemExit(f"Writing {path.name} did not preserve every label id.")


def record_sources(config, paths, details):
    manifest = ROOT / "data/sources.json"
    provenance = json.loads(manifest.read_text())
    orig = config["source_directory"] / "mri/orig.mgz"
    derived_from = [
        {"path": str(orig.relative_to(ROOT)), "sha256": sha256(orig)},
        {"url": SUPERSYNTH["url"], "sha256": SUPERSYNTH["sha256"]},
        {"url": ATLAS["url"], "sha256": ATLAS["sha256"],
         "extracted_tree_sha256": ATLAS["tree_sha256"]},
    ]
    for path in paths:
        relative = str(path.relative_to(ROOT))
        provenance["sources"] = [
            source for source in provenance["sources"] if source["path"] != relative
        ] + [{
            "path": relative,
            "sha256": sha256(path),
            "anatomy": config["anatomy"]["id"],
            "optional": True,
            "derived_from": derived_from,
            "procedure": (
                "scripts/segment_nextbrain.py: SuperSynth, then NextBrain Bayesian "
                "segmentation (segment_fireants.py --mode invivo --device cpu) of each "
                "hemisphere at 0.4 mm, joined on one 0.4 mm surface-RAS grid"
            ),
            "freesurfer_build": FREESURFER_BUILD,
            **details,
            "runtime_workarounds": WORKAROUNDS,
            "citation": CITATION,
            "license": "Distributed with FreeSurfer; the NextBrain paper names no separate licence for the atlas.",
        }]
        print(f"recorded {relative}")
    manifest.write_text(json.dumps(provenance, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--anatomy", help="segment this declared anatomy instead of the selected one")
    parser.add_argument("--freesurfer", type=Path,
                        default=Path(os.environ.get("FREESURFER_HOME", "/Applications/freesurfer/8.2.0")))
    parser.add_argument("--work", type=Path, help="default: data/cache/nextbrain-seg-<anatomy>")
    parser.add_argument("--threads", type=int, default=min(10, os.cpu_count() or 1))
    parser.add_argument("--record", action="store_true", help="add the results to data/sources.json")
    args = parser.parse_args()

    config = read_config(args.anatomy)
    if config[nextbrain.ATLAS_ID]["procedure"] != nextbrain.SUBJECT_SEGMENTATION:
        raise SystemExit(f"{config['anatomy']['id']} does not take a subject NextBrain segmentation.")
    work = args.work or CACHE / f"nextbrain-seg-{config['anatomy']['id']}"
    verify_runtime(args.freesurfer)
    image, crop = crop_input(config, work)
    run_freesurfer(args.freesurfer, work, image, args.threads)

    labels, grid, join = join_hemispheres(config, work)
    volume_path, lut_path = nextbrain.paths(config)
    write_volume(config, labels, grid, volume_path)
    write_lut(read_freesurfer_lut(work / "lut.txt"), lut_path)

    # Read back through the build's own loader, which asserts integrality, LUT
    # coverage and placement, so a bad join fails here rather than in a build.
    regions = nextbrain.build_regions(config)
    kept = sum(region["voxel_count"] for region in regions)
    print(f"{volume_path.relative_to(ROOT)}: {len(regions)} regions, {kept:,} labelled "
          f"voxels, {join['voxels_labelled_by_both_sides']:,} resolved at the midline")
    if args.record:
        record_sources(config, [volume_path, lut_path], {
            "crop": crop,
            "hemisphere_join": join,
            "nextbrain_cpu_threads": logged_threads(work),
        })
    else:
        print("Re-run with --record to register these files in data/sources.json.")


if __name__ == "__main__":
    main()
