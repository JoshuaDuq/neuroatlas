"""Register the Nettekoven et al. (2024) functional cerebellar atlas onto an anatomy.

The atlas, SUIT's own lobules and the SUIT template come from the authors' atlas
collection, pinned by commit and checksum. SynthMorph (FreeSurfer 8.2) registers
the template to the anatomy's skull-stripped T1, kept to its infratentorial
compartment as SUIT normalisation does, joint affine and deformable. Both atlases
are carried across by nearest neighbour onto aseg's grid; the functional atlas is
kept to aseg's cerebellar cortex, and SUIT's lobules are kept whole to be scored
against CerebNet. The result is accepted only if this brain's own segmentation
agrees with it; the checks are written beside it. SynthMorph runs on the CPU here;
its output is recorded by checksum rather than expected to reproduce bit for bit.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

import nibabel as nib
import numpy as np
from nibabel.processing import resample_from_to
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brain_model.layers import cerebellar_functions
from brain_model.sources import ROOT, read_config, sha256

CACHE = ROOT / "data/cache/cerebellar-atlases"
# aseg's infratentorial compartment: cerebellar white matter and cortex, fourth ventricle, brainstem.
INFRATENTORIAL = (7, 8, 15, 16, 46, 47)
# Margin around it, in voxels, so the template's edges meet tissue and fluid as in the template.
MARGIN = 4


def fetch(definition, kind):
    remote, digest = definition["source"]["files"][kind]
    path = CACHE / Path(remote).name
    url = (f"{definition['source']['repository'].replace('github.com', 'raw.githubusercontent.com')}"
           f"/{definition['source']['commit']}/{remote}")
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        print(f"downloading {remote}", flush=True)
        partial = path.with_name(path.name + ".part")
        urllib.request.urlretrieve(url, partial)
        partial.rename(path)
    if sha256(path) != digest:
        raise SystemExit(f"{path.name} checksum mismatch")
    return path, url


def check_tables(definition, lut, names):
    """The definition's colours and order are the atlas's own; SUIT's lobules are numbered as the code reads them."""
    rows = [line.split() for line in lut.read_text().splitlines()[1:]]
    for index, region in enumerate(definition["regions"]):
        for side, letter in zip(cerebellar_functions.SIDES, "LR"):
            value, *rgb, name = rows[cerebellar_functions.value_of(index, side) - 1]
            if int(value) != cerebellar_functions.value_of(index, side) or name != f"{region['id'].upper()}{letter}":
                raise SystemExit(f"LUT row {value} {name} is not {region['id']} {side}")
            if [round(float(v) * 255) for v in rgb] != region["color"]:
                raise SystemExit(f"{region['id']}'s colour differs from the atlas's")
    listed = [line.split("\t")[1] for line in names.read_text().splitlines()[1:29]]
    if listed != cerebellar_functions.SUIT_LOBULES:
        raise SystemExit(f"SUIT's lobule table changed: {listed}")


def on_template_grid(path, template, destination):
    """The label image resampled onto the template's grid, by world position.

    SynthMorph's apply reads an image on the moving template's voxel grid. SUIT's label images are
    stored mirrored to its template (LAS beside RAS); read directly they would swap the hemispheres.
    """
    source = nib.load(path)
    aligned = resample_from_to(source, template, order=0)
    before, after = np.asarray(source.dataobj), np.asarray(aligned.dataobj)
    for value in np.unique(before[before > 0]):
        a = nib.affines.apply_affine(source.affine, np.argwhere(before == value)).mean(axis=0)
        b = nib.affines.apply_affine(template.affine, np.argwhere(after == value)).mean(axis=0)
        if not np.allclose(a, b, atol=0.5):
            raise SystemExit(f"{path.name} value {value} moved from {a.round(1)} to {b.round(1)}")
    nib.save(nib.Nifti1Image(after.astype(np.int16), template.affine), destination)


def synthmorph(freesurfer, *arguments):
    env = {**os.environ, "FREESURFER_HOME": str(freesurfer)}
    command = ["bash", "-c", 'source "$FREESURFER_HOME/SetUpFreeSurfer.sh" > /dev/null && exec mri_synthmorph "$@"',
               "mri_synthmorph", *map(str, arguments)]
    print(" ".join(map(str, arguments)), flush=True)
    subprocess.run(command, env=env, check=True)


def carry(freesurfer, warp, source, aseg):
    """`source` on aseg's grid, through the warp, by nearest neighbour."""
    with tempfile.TemporaryDirectory() as work:
        carried = Path(work) / "carried.nii.gz"
        synthmorph(freesurfer, "apply", "-m", "nearest", warp, source, carried)
        image = nib.load(carried)
        # SynthMorph resamples onto the fixed image's grid; anything else would scramble the labels.
        if image.shape[:3] != aseg.shape or not np.allclose(image.affine, aseg.affine, atol=1e-3):
            raise SystemExit(f"SynthMorph's output is not on aseg's grid: {image.shape}, {image.affine}")
        return np.rint(np.asarray(image.dataobj)).astype(np.int16).reshape(aseg.shape)


def save(values, aseg, destination):
    header = aseg.header.copy()
    header.set_data_dtype(np.int16)
    nib.save(nib.MGHImage(values, aseg.affine, header=header), destination)
    if not np.array_equal(np.asarray(nib.load(destination).dataobj), values):
        raise SystemExit(f"Writing {destination.name} changed a value")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--anatomy", help="register onto this declared anatomy instead of the selected one")
    parser.add_argument("--freesurfer", type=Path,
                        default=Path(os.environ.get("FREESURFER_HOME", "/Applications/freesurfer/8.2.0")))
    parser.add_argument("--threads", type=int, default=min(8, os.cpu_count() or 1))
    parser.add_argument("--record", action="store_true", help="add the results to data/sources.json")
    args = parser.parse_args()
    config = read_config(args.anatomy)
    if not cerebellar_functions.is_declared(config):
        raise SystemExit(f"{config['anatomy']['id']} does not declare the cerebellar_functions layer")
    stamp = (args.freesurfer / "build-stamp.txt").read_text().strip()
    if stamp != config["freesurfer_build"]:
        raise SystemExit(f"Expected FreeSurfer {config['freesurfer_build']}, found {stamp}.")
    definition = cerebellar_functions.read_definition()
    fetched = {kind: fetch(definition, kind) for kind in definition["source"]["files"]}
    check_tables(definition, fetched["lut"][0], fetched["lobule_names"][0])

    mri = config["source_directory"] / "mri"
    aseg = nib.load(mri / "aseg.mgz")
    labels = np.asarray(aseg.dataobj).astype(np.int32)
    template = nib.load(fetched["template"][0])
    with tempfile.TemporaryDirectory() as work:
        work = Path(work)
        brain = nib.load(mri / "brain.mgz")
        compartment = ndimage.binary_dilation(np.isin(labels, INFRATENTORIAL), iterations=MARGIN)
        fixed = work / "infratentorial.nii.gz"
        nib.save(nib.Nifti1Image(np.where(compartment, np.asarray(brain.dataobj), 0).astype(np.float32),
                                 brain.affine), fixed)
        warp = work / "warp.nii.gz"
        synthmorph(args.freesurfer, "register", "-m", "joint", "-j", args.threads,
                   "-t", warp, fetched["template"][0], fixed)
        carried = {}
        for kind in ("atlas", "lobules"):
            gridded = work / f"{kind}.nii.gz"
            on_template_grid(fetched[kind][0], template, gridded)
            carried[kind] = carry(args.freesurfer, warp, gridded, aseg)
    functions = np.where(np.isin(labels, cerebellar_functions.CEREBELLAR_CORTEX), carried["atlas"], 0).astype(np.int16)
    save(functions, aseg, cerebellar_functions.volume_path(config))
    save(carried["lobules"], aseg, cerebellar_functions.lobules_path(config))

    measured = cerebellar_functions.checks(functions, *cerebellar_functions.subject_volumes(config))
    report = {
        "freesurfer_build": stamp,
        "method": ("mri_synthmorph register -m joint (SUIT template → brain.mgz kept to aseg's infratentorial "
                   f"compartment, dilated {MARGIN} voxels), then apply -m nearest to each atlas on the template's grid"),
        "source": definition["source"],
        "checks": measured,
        "acceptance": definition["acceptance"],
    }
    cerebellar_functions.report_path(config).write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(measured, indent=2))
    cerebellar_functions.accept(measured, definition)
    if args.record:
        record(config, definition,
               [cerebellar_functions.volume_path(config), cerebellar_functions.lobules_path(config),
                cerebellar_functions.report_path(config)],
               [{"url": url, "sha256": sha256(path)} for path, url in fetched.values()])
    else:
        print("Re-run with --record to register these files in data/sources.json.")


def record(config, definition, paths, origins):
    manifest = ROOT / "data/sources.json"
    provenance = json.loads(manifest.read_text())
    for path in paths:
        relative = str(path.relative_to(ROOT))
        provenance["sources"] = [s for s in provenance["sources"] if s["path"] != relative] + [{
            "path": relative,
            "sha256": sha256(path),
            "anatomy": config["anatomy"]["id"],
            "derived_from": origins,
            "procedure": "scripts/register_cerebellar_functions.py: SynthMorph registration of the SUIT template to brain.mgz's infratentorial compartment, nearest-neighbour transfer",
            "citation": definition["doi"],
            "license": definition["license"],
        }]
        print(f"recorded {relative}")
    manifest.write_text(json.dumps(provenance, indent=2) + "\n")


if __name__ == "__main__":
    main()
