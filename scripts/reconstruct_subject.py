"""Reconstruct an anatomy that declares `reconstruction` with FreeSurfer 8.2, as SNAIL was.

recon-all imports the T1 and motion-corrects it, SynthStrip runs under the
sliced-convolution runtime (scripts/freesurfer/run_patched.py) so it fits in
memory, and recon-all -all finishes from there. The recon-all tree stays in
data/cache/freesurfer-subjects: recon-all links fsaverage into its subjects
directory, and run with `-sd data` it replaced data/fsaverage. Only the files
scripts/prepare_subject.py pins, the completion marker and the log are copied
to the anatomy's directory, beside the reconstruction.json describing the run.
"""

import argparse
import datetime
import io
import os
import shutil
import subprocess
import sys
import time
import zipfile
from pathlib import Path
from urllib.request import Request, urlopen

import nibabel as nib
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from brain_model.sources import ROOT, read_config, sha256, write_json
from prepare_subject import SUBJECT_FILES

# Coarse aseg regions the structures layer exports when the segmentation has them.
OPTIONAL_ASEG = {31: "left choroid plexus", 63: "right choroid plexus", 85: "optic chiasm"}

SUBJECTS = ROOT / "data/cache/freesurfer-subjects"
RUNTIME = Path(__file__).resolve().parent / "freesurfer"
LOG = "scripts/full-reconstruction.log"


class RemoteFile(io.RawIOBase):
    """A remote file read by HTTP range requests, so one zip member costs only its bytes.

    Each read resolves the URL again: figshare redirects to a signature valid for seconds.
    """

    def __init__(self, url):
        self.url, self.position = url, 0
        with urlopen(Request(url, headers={"Range": "bytes=0-0"})) as response:
            self.size = int(response.headers["Content-Range"].split("/")[1])

    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.position

    def seek(self, offset, whence=io.SEEK_SET):
        base = {io.SEEK_SET: 0, io.SEEK_CUR: self.position, io.SEEK_END: self.size}[whence]
        self.position = base + offset
        return self.position

    def readinto(self, buffer):
        end = min(self.size, self.position + len(buffer))
        if end <= self.position:
            return 0
        request = Request(self.url, headers={"Range": f"bytes={self.position}-{end - 1}"})
        with urlopen(request) as response:
            if response.status != 206:
                raise ValueError(f"{self.url}: expected a partial response, got {response.status}")
            data = response.read()
        if len(data) != end - self.position:
            raise ValueError(f"{self.url}: short range read")
        buffer[:len(data)] = data
        self.position = end
        return len(data)


def fetch_input(settings):
    """The T1 from the zip it is published in, read by HTTP range; zipfile checks its CRC."""
    download, path = settings["input_download"], ROOT / settings["input"]
    path.parent.mkdir(parents=True, exist_ok=True)
    archive = zipfile.ZipFile(io.BufferedReader(RemoteFile(download["url"]), buffer_size=1 << 24))
    with archive.open(download["member"]) as source, path.open("wb") as target:
        shutil.copyfileobj(source, target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--anatomy", required=True)
    parser.add_argument("--freesurfer", type=Path,
                        default=Path(os.environ.get("FREESURFER_HOME", "/Applications/freesurfer/8.2.0")))
    args = parser.parse_args()
    config = read_config(args.anatomy)
    anatomy, settings = config["anatomy"], config["anatomy"]["reconstruction"]
    input_path = ROOT / settings["input"]
    if not input_path.exists():
        fetch_input(settings)
    if sha256(input_path) != settings["input_sha256"]:
        raise SystemExit(f"{settings['input']} does not match its pinned checksum")
    stamp = (args.freesurfer / "build-stamp.txt").read_text().strip()
    if stamp != config["freesurfer_build"]:
        raise SystemExit(f"Expected FreeSurfer {config['freesurfer_build']}, found {stamp}")

    subject, threads = anatomy["id"], str(settings["threads"])
    tree = SUBJECTS / subject
    if tree.exists():
        raise SystemExit(f"{tree} exists; remove it to reconstruct again")
    SUBJECTS.mkdir(parents=True, exist_ok=True)
    commands = [
        {"environment": {"FS_V8_XOPTS": "0"},
         # Absolute: recon-all changes directory, so a relative -sd stops resolving.
         "command": ["recon-all", "-sd", str(SUBJECTS), "-s", subject,
                     "-i", settings["input"], "-motioncor", "-openmp", threads]},
        {"command": ["fspython", "scripts/freesurfer/run_patched.py",
                     "$FREESURFER_HOME/python/scripts/mri_synthstrip", "--threads", threads,
                     "-i", f"{tree.relative_to(ROOT)}/mri/orig.mgz",
                     "-o", f"{tree.relative_to(ROOT)}/mri/synthstrip.mgz"]},
        {"command": ["recon-all", "-sd", str(SUBJECTS), "-s", subject,
                     "-all", "-openmp", threads]},
    ]
    env = {**os.environ, "FREESURFER_HOME": str(args.freesurfer)}
    started = time.time()
    log_path = SUBJECTS / f"{subject}-{Path(LOG).name}"
    with log_path.open("w") as log:
        for step in commands:
            line = " ".join(step["command"])
            print(f"== {time.strftime('%H:%M:%S')} {line}", flush=True)
            log.write(f"== {line}\n")
            log.flush()
            subprocess.run(
                ["bash", "-c", 'source "$FREESURFER_HOME/SetUpFreeSurfer.sh" > /dev/null && exec "$@"',
                 "bash", *[part.replace("$FREESURFER_HOME", str(args.freesurfer)) for part in step["command"]]],
                cwd=ROOT, env={**env, **step.get("environment", {})}, stdout=log, stderr=subprocess.STDOUT, check=True,
            )
    hours = (time.time() - started) / 3600

    # recon-all's import must be the input itself: same voxels, same scanner frame.
    source, imported = nib.load(input_path), nib.load(tree / "mri/orig/001.mgz")
    affine_error = float(np.abs(source.affine - imported.affine).max())
    if not np.array_equal(np.asarray(source.dataobj), np.asarray(imported.dataobj)) or affine_error > 1e-5:
        raise SystemExit("recon-all's imported volume is not the input T1")

    directory = config["source_directory"]
    marker = settings["completion_marker"]
    for name in [*SUBJECT_FILES, marker]:
        (directory / name).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(tree / name, directory / name)
    (directory / LOG).parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(log_path, directory / LOG)
    write_record(config, commands, stamp, hours, affine_error, args.freesurfer)
    print(f"{subject}: reconstructed in {hours:.2f} h")


def write_record(config, commands, stamp, hours, affine_error, freesurfer):
    anatomy, settings = config["anatomy"], config["anatomy"]["reconstruction"]
    directory, marker = config["source_directory"], settings["completion_marker"]
    orig = nib.load(directory / "mri/orig.mgz")
    present = set(np.unique(np.asarray(nib.load(directory / "mri/aseg.mgz").dataobj)).tolist())
    absent = [f"{name} ({label})" for label, name in OPTIONAL_ASEG.items() if label not in present]
    limitations = list(settings.get("limitations", []))
    if absent:
        limitations.append(f"This FreeSurfer aseg contains no {', '.join(absent)} labels; "
                           "those coarse aseg regions are not exported.")
    write_json(directory / settings["provenance"], {
        "status": "complete",
        "subject": anatomy["subject"],
        "source": anatomy["source_url"],
        "input": settings["input"],
        "input_sha256": settings["input_sha256"],
        "freesurfer_build": stamp,
        "threads": settings["threads"],
        "commands": commands,
        "runtime": {
            str(path.relative_to(ROOT) if path.is_relative_to(ROOT) else path): sha256(path)
            for path in (RUNTIME / "run_patched.py", RUNTIME / "conv3d_slices.py",
                         freesurfer / "bin/recon-all", freesurfer / "python/scripts/mri_synthstrip")
        },
        "synthstrip_runtime": "Sliced CPU convolution; same products, different summation order. "
                              "No model or input changes.",
        "scanner_ras_to_surface_ras": (orig.header.get_vox2ras_tkr() @ np.linalg.inv(orig.affine)).tolist(),
        "coordinate_method": "Exact FreeSurfer orig.mgz header transform; no anatomical registration.",
        "limitations": limitations,
        "completed_at": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
        "exit_code": 0,
        "runtime_hours": round(hours, 3),
        "output_sha256": {name: sha256(directory / name) for name in SUBJECT_FILES},
        "completion_marker_sha256": sha256(directory / marker),
        "log": {"path": LOG, "sha256": sha256(directory / LOG)},
        "raw_import": {"voxel_values": "exact", "maximum_affine_error_mm": affine_error},
    })


if __name__ == "__main__":
    main()
