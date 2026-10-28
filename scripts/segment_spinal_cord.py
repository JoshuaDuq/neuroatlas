"""Segment one brain's cervical cord with the Spinal Cord Toolbox and register PAM50 to it.

On the anatomy's source T1: SCT's contrast-agnostic cord segmentation, vertebral
labelling, then the PAM50 template registered to the cord and its discs. PAM50's
white- and grey-matter atlas is warped onto a grid around the cord at the
template's own spacing, and each voxel keeps its most probable atlas region.
A step whose output is already in the work directory is not run again.
"""

import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

import nibabel as nib
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brain_model.layers import spinal_cord
from brain_model.sources import ROOT, read_config, sha256

CACHE = ROOT / "data/cache"
SCT = {
    "path": Path(os.environ.get("SCT_DIR", Path.home() / "sct_7.3")),
    "version": "7.3",
    "url": "https://github.com/spinalcordtoolbox/spinalcordtoolbox/releases/tag/7.3",
}
MODEL = {
    "directory": "data/deepseg_models/model_seg_sc_contrast_agnostic_nnunet",
    "url": "https://github.com/sct-pipeline/contrast-agnostic-softseg-spinalcord/releases/download/v3.0/model_contrast_agnostic_20250123.zip",
    "tree_sha256": "603f00b7287def29cdc86c6abdaff5c1fb9b28fe88151697da14b183a08f020e",
}
PAM50 = {
    "directory": "data/PAM50",
    "url": "https://github.com/spinalcordtoolbox/PAM50/releases/download/r20250730/PAM50-r20250730.zip",
    "tree_sha256": "4cc9cb645a9d239e04466fd55e2b10290a9e58c64882f9d8434bb1fbd1ea1158",
}


def tree_sha256(directory):
    digest = hashlib.sha256()
    # Skip macOS AppleDouble files, which are metadata, not content.
    for path in sorted(p for p in directory.rglob("*") if p.is_file() and not p.name.startswith("._")):
        digest.update(f"{path.relative_to(directory)}\0{sha256(path)}\n".encode())
    return digest.hexdigest()


def verify_runtime():
    version = (SCT["path"] / "spinalcordtoolbox/version.txt").read_text().strip()
    if version != SCT["version"]:
        raise SystemExit(f"Expected SCT {SCT['version']}, found {version}.")
    for pinned in (MODEL, PAM50):
        if tree_sha256(SCT["path"] / pinned["directory"]) != pinned["tree_sha256"]:
            raise SystemExit(f"SCT data checksum mismatch: {pinned['directory']}")


def run_sct(work):
    def sct(name, *arguments, output):
        if output.exists():
            return
        print(f"== {name} (log: {work / f'{name}.log'})", flush=True)
        env = {**os.environ, "PATH": f"{SCT['path'] / 'bin'}:{os.environ['PATH']}"}
        with open(work / f"{name}.log", "w") as log:
            subprocess.run([name, *map(str, arguments)], cwd=work, env=env,
                           stdout=log, stderr=subprocess.STDOUT, check=True)

    return sct


def segment(config, work, settings):
    t1 = ROOT / config["anatomy"]["reconstruction"]["input"]
    work.mkdir(parents=True, exist_ok=True)
    sct = run_sct(work)
    cord = work / "t1_cord.nii.gz"
    sct("sct_deepseg", "spinalcord", "-i", t1, "-o", cord, output=cord)
    levels = work / "levels/t1_cord_labeled.nii.gz"
    sct("sct_label_vertebrae", "-i", t1, "-s", cord, "-c", "t1", "-ofolder", work / "levels",
        output=levels)
    warp = work / "reg/warp_template2anat.nii.gz"
    sct("sct_register_to_template", "-i", t1, "-s", cord, "-c", "t1",
        "-ldisc", work / "levels/t1_cord_labeled_discs.nii.gz", "-ofolder", work / "reg",
        output=warp)
    # The atlas is warped onto a grid of the template's own spacing around the cord.
    margin = "x".join(map(str, settings["crop_margin_voxels"]))
    crop = work / "t1_crop.nii.gz"
    sct("sct_crop_image", "-i", t1, "-m", cord, "-dilate", margin, "-o", crop, output=crop)
    spacing = settings["atlas_spacing_mm"]
    grid = work / "atlas_grid.nii.gz"
    sct("sct_resample", "-i", crop, "-mm", "x".join([str(spacing)] * 3), "-x", "linear",
        "-o", grid, output=grid)
    atlas = work / "atlas"
    sct("sct_warp_template", "-d", grid, "-w", warp, "-ofolder", atlas,
        output=atlas / "atlas/PAM50_atlas_35.nii.gz")
    return t1, cord, levels, grid, atlas / "atlas"


def most_probable_regions(grid, atlas, minimum, unresolved):
    """Each voxel's most probable PAM50 region, as atlas id + 1; 0 outside the cord.

    Unresolved regions count toward the cord but take no voxel.
    """
    reference = nib.load(grid)
    maps = []
    for index in range(spinal_cord.ATLAS_REGIONS):
        image = nib.load(atlas / f"PAM50_atlas_{index:02d}.nii.gz")
        if image.shape != reference.shape or not np.allclose(image.affine, reference.affine):
            raise SystemExit(f"{image.get_filename()} is not on the atlas grid.")
        maps.append(np.asarray(image.dataobj, np.float32))
    maps = np.stack(maps, axis=-1)
    cord = maps.sum(axis=-1) >= minimum
    maps[..., unresolved] = -1
    labels = np.where(cord, maps.argmax(axis=-1) + 1, 0)
    return nib.Nifti1Image(labels.astype(np.uint8), reference.affine)


def save(image, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.set_data_dtype(np.uint8)
    nib.save(image, path)
    if not np.array_equal(np.asarray(nib.load(path).dataobj), np.asarray(image.dataobj)):
        raise SystemExit(f"Writing {path.name} did not preserve every label.")


def as_labels(path):
    image = nib.load(path)
    data = np.asarray(image.dataobj)
    if not np.array_equal(data, np.rint(data)) or data.min() < 0:
        raise SystemExit(f"{path.name} must hold nonnegative integer labels.")
    return nib.Nifti1Image(data.astype(np.uint8), image.affine)


def record_sources(config, t1, paths, settings):
    manifest = ROOT / "data/sources.json"
    provenance = json.loads(manifest.read_text())
    derived_from = [
        {"path": str(t1.relative_to(ROOT)), "sha256": sha256(t1)},
        {"url": SCT["url"], "version": SCT["version"]},
        {"url": MODEL["url"], "extracted_tree_sha256": MODEL["tree_sha256"]},
        {"url": PAM50["url"], "extracted_tree_sha256": PAM50["tree_sha256"]},
    ]
    procedure = (
        "scripts/segment_spinal_cord.py: sct_deepseg spinalcord, sct_label_vertebrae -c t1, "
        "sct_register_to_template -c t1 with the disc labels, then sct_warp_template onto a "
        f"{settings['atlas_spacing_mm']} mm grid around the cord; each voxel takes its most "
        f"probable PAM50 region where the region probabilities sum to at least "
        f"{settings['minimum_cord_probability']}, leaving out the unresolved regions "
        f"{settings['unresolved']['atlas']}"
    )
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
            "procedure": procedure,
            "citations": settings["citations"],
            "license": (
                f"PAM50: {settings['license']}; the Spinal Cord Toolbox that produced these "
                "files is LGPL-3.0"
            ),
        }]
        print(f"recorded {relative}")
    manifest.write_text(json.dumps(provenance, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--anatomy", help="segment this declared anatomy instead of the selected one")
    parser.add_argument("--work", type=Path, help="default: data/cache/sct-<anatomy>")
    parser.add_argument("--record", action="store_true", help="add the results to data/sources.json")
    args = parser.parse_args()

    config = read_config(args.anatomy)
    if not spinal_cord.is_declared(config):
        raise SystemExit(f"{config['anatomy']['id']} does not declare a spinal cord.")
    settings = config["spinal_cord"]
    verify_runtime()
    work = args.work or CACHE / f"sct-{config['anatomy']['id']}"
    t1, cord, levels, grid, atlas = segment(config, work, settings)

    paths = spinal_cord.paths(config)
    save(most_probable_regions(grid, atlas, settings["minimum_cord_probability"],
                               settings["unresolved"]["atlas"]), paths["regions"])
    save(as_labels(cord), paths["segmentation"])
    save(as_labels(levels), paths["levels"])

    # Read back through the build's own loader, which checks the labels and their placement.
    regions = spinal_cord.load(config)
    present = np.unique(regions.labels[regions.labels > 0])
    print(f"{paths['regions'].relative_to(ROOT)}: {len(present)} PAM50 regions, "
          f"{np.count_nonzero(regions.labels):,} voxels at {regions.spacing_mm[0]} mm; "
          f"vertebral levels {spinal_cord.levels(config)}")
    if args.record:
        record_sources(config, t1, paths.values(), settings)
    else:
        print("Re-run with --record to register these files in data/sources.json.")


if __name__ == "__main__":
    main()
