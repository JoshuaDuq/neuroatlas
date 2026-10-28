"""Register the Liu et al. (2023) arterial territory atlas onto an anatomy.

The atlas and its template b0 come from the authors' repository, pinned by
commit and checksum. SynthMorph (FreeSurfer 8.2) registers the skull-stripped
b0 to the anatomy's skull-stripped T1, joint affine and deformable, and the
atlas is carried across by nearest neighbour onto aseg's grid. The result is
accepted only if this brain's own segmentation agrees with it; the checks are
written beside it. SynthMorph runs on the CPU here; its output is recorded by
checksum rather than expected to reproduce bit for bit.
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

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brain_model.layers import arterial_territories
from brain_model.sources import ROOT, read_config, sha256

CACHE = ROOT / "data/cache/arterial-territories"


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


def check_atlas_sides(atlas_path, definition):
    """Odd values must lie left of the template's midline and even ones right of it."""
    image = nib.load(atlas_path)
    values = np.rint(np.asarray(image.dataobj)).astype(int)
    for territory in definition["territories"]:
        for side, value in zip(arterial_territories.SIDES, territory["values"]):
            x = nib.affines.apply_affine(image.affine, np.argwhere(values == value))[:, 0].mean()
            if (x < 0) != (side == "left"):
                raise SystemExit(f"{territory['id']} value {value} lies on the wrong side (x {x:.1f})")


def synthmorph(freesurfer, threads, *arguments):
    env = {**os.environ, "FREESURFER_HOME": str(freesurfer)}
    command = ["bash", "-c", 'source "$FREESURFER_HOME/SetUpFreeSurfer.sh" > /dev/null && exec mri_synthmorph "$@"',
               "mri_synthmorph", *map(str, arguments)]
    print(" ".join(map(str, arguments)), flush=True)
    subprocess.run(command, env=env, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--anatomy", help="register onto this declared anatomy instead of the selected one")
    parser.add_argument("--freesurfer", type=Path,
                        default=Path(os.environ.get("FREESURFER_HOME", "/Applications/freesurfer/8.2.0")))
    parser.add_argument("--threads", type=int, default=min(8, os.cpu_count() or 1))
    parser.add_argument("--record", action="store_true", help="add the results to data/sources.json")
    args = parser.parse_args()
    config = read_config(args.anatomy)
    if not arterial_territories.is_declared(config):
        raise SystemExit(f"{config['anatomy']['id']} does not declare the arterial_territories layer")
    stamp = (args.freesurfer / "build-stamp.txt").read_text().strip()
    if stamp != config["freesurfer_build"]:
        raise SystemExit(f"Expected FreeSurfer {config['freesurfer_build']}, found {stamp}.")
    definition = arterial_territories.read_definition()
    fetched = {kind: fetch(definition, kind) for kind in definition["source"]["files"]}
    check_atlas_sides(fetched["atlas"][0], definition)

    mri = config["source_directory"] / "mri"
    destination = arterial_territories.volume_path(config)
    with tempfile.TemporaryDirectory() as work:
        warp, carried = Path(work) / "warp.nii.gz", Path(work) / "atlas.nii.gz"
        synthmorph(args.freesurfer, args.threads, "register", "-m", "joint", "-j", args.threads,
                   "-t", warp, fetched["template"][0], mri / "brain.mgz")
        synthmorph(args.freesurfer, args.threads, "apply", "-m", "nearest",
                   warp, fetched["atlas"][0], carried)
        aseg = nib.load(mri / "aseg.mgz")
        image = nib.load(carried)
        # SynthMorph resamples onto the fixed image's grid; anything else would scramble the labels.
        if image.shape[:3] != aseg.shape or not np.allclose(image.affine, aseg.affine, atol=1e-3):
            raise SystemExit(f"SynthMorph's output is not on aseg's grid: {image.shape}, {image.affine}")
        values = np.rint(np.asarray(image.dataobj)).astype(np.int16).reshape(aseg.shape)
    header = aseg.header.copy()
    header.set_data_dtype(np.int16)
    nib.save(nib.MGHImage(values, aseg.affine, header=header), destination)
    if not np.array_equal(np.asarray(nib.load(destination).dataobj), values):
        raise SystemExit(f"Writing {destination.name} changed a value")

    measured = arterial_territories.checks(values, np.asarray(aseg.dataobj).astype(np.int32), definition)
    report = {
        "freesurfer_build": stamp,
        "method": "mri_synthmorph register -m joint (template b0 → brain.mgz), then apply -m nearest to the atlas",
        "source": definition["source"],
        "checks": measured,
        "acceptance": definition["acceptance"],
    }
    arterial_territories.report_path(config).write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(measured, indent=2))
    arterial_territories.accept(measured, definition)
    if args.record:
        record(config, definition, [destination, arterial_territories.report_path(config)],
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
            "procedure": "scripts/register_arterial_territories.py: SynthMorph registration of the atlas template to brain.mgz, nearest-neighbour transfer",
            "citation": definition["doi"],
            "license": definition["license"],
        }]
        print(f"recorded {relative}")
    manifest.write_text(json.dumps(provenance, indent=2) + "\n")


if __name__ == "__main__":
    main()
