"""TractSeg's SLF I–III and callosal segments, and a tensor FA map, for MGH CDMD sub_013.

Follows TractSeg's own `csd_msmt` recipe (README, "Use existing peaks") with
MRtrix3: Dhollander responses, multi-shell multi-tissue CSD and `sh2peaks`, on
the Δ = 19 ms shells up to b = 3450, the range nearest TractSeg's HCP training
data (b = 1000–3000). TractSeg expects its input in MNI orientation; its
`--preprocess` does that with FSL `flirt`, which is replaced here by a rigid
`mrregister` of the tensor FA to the FA template TractSeg ships, with the FODs
carried across by `mrtransform -reorient_fod yes`. Tracking is TractSeg's
probabilistic TOM tracking, which is stochastic.

Streamlines are mapped from MNI world to the diffusion scan (inverse rigid) and
on to the T1 through the pilot's recorded dwi_to_t1_world, so they share the
frame of CDMD's other tracts. The FA map is resampled onto the T1 grid the same
way, trilinearly. Outputs go to <pilot>/derived/, where
scripts/prepare_diffusion_cdmd.py packages them.

    uv run python scripts/tractseg_cdmd.py /Volumes/KINGSTON/neuroatlas/cdmd-pilot
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

import nibabel as nib
import numpy as np
from nibabel.affines import apply_affine
from scipy.ndimage import map_coordinates

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from brain_model.sources import ROOT, sha256

CACHE = ROOT / "data/cache"
MRTRIX = {
    "bin": CACHE / "mrtrix3/release/mrtrix3/bin",
    "version": "== mrinfo 3.0.8 ==",
    "url": "https://github.com/MRtrix3/mrtrix3/releases/download/3.0.8/mrtrix3-macos-3.0.8.tar.gz",
    "sha256": "91fb80ffc9f26136d094e4a5310d051f52db9cb5faa35ad3f3e6156598090c39",
}
VENV = CACHE / "tractseg-venv/bin"
TRACTSEG_VERSION = "2.10"
TEMPLATE_SHA256 = "3a047037655723292724335508967f671d5ba9a92acfa17af51274147f2924bd"
# Zenodo records 3518348, 3518331 and 3239216–3239222 (CC BY 4.0), read from ~/.tractseg.
WEIGHTS = {
    "pretrained_weights_tract_segmentation_v3.npz": "2723d8d358eade8a6f08abada6ca05895f36cf499db1937449f9eb7b8cfef8d9",
    "pretrained_weights_endings_segmentation_v4.npz": "df91b21201c2c7d326ef350103ecc0f695b5c518869033fb4e1e76c1310c9d8b",
    "pretrained_weights_peak_regression_part1_v2.npz": "73ab1d889b4c07c5972f00b44fd5013f9cfd1f25bf251e777fc973f68b0aab34",
    "pretrained_weights_peak_regression_part2_v2.npz": "ce4a486d11a57a638028de26cd2e5a5468623693d704ef38465059ea76995789",
    "pretrained_weights_peak_regression_part3_v2.npz": "1841a9abdd3d40c34277860c91eb577b7cc289f3fc7f2fdef932228cbc4a673e",
    "pretrained_weights_peak_regression_part4_v2.npz": "f19a48c8ba4bd1f4ee280ee28aeebb191328134c5ccd38d69028e8b863e5ff4d",
}
INPUTS = {
    "sub_013/dwi/sub_013_dwi.nii.gz": "b7555b932cee2c21932627587d69199e9eda2a3a2b90f6af8f3150faf8ba05e7",
    "sub_013/dwi/sub_013_dwi.bval": "20ee5fecf67ca0fb4d667f128a353c3498bad9d8b325b9e97d0bef6ef8f47e1f",
    "sub_013/dwi/sub_013_dwi.bvec": "b779c72aa8ee2dfb053730ed032856e1c86ea982ba6832cab70e8990c1a93a19",
    "sub_013/dwi/sub_013_dwi.delta": "2dc973db6da8dbd1869d32d359174211d29ab49006f4beb91ed6627eccc08670",
    "sub_013/dwi/sub_013_dwi_brainmask.nii.gz": "0e44ea876b2f2aae7c95eccf946b87eb10d08a5b356f0266dd9f1133cbfbb76d",
    "sub_013/anat/sub_013_t1w.nii.gz": "16e9137160f20c3dfb39fbd04ce1299415c5252ba96e8b0266f5f9402c60730b",
}
DELTA_MS = 19
SHELLS = (700, 3600)  # b-value window kept besides b = 0
FA_SHELLS = "0,800,1500"
SEED = 13
# TractSeg's bundle -> the file name prepare_diffusion_cdmd.py reads from derived/bundles.
BUNDLES = {
    **{f"SLF_{numeral}_{side}": f"slf{index}.{side}"
       for index, numeral in enumerate(("I", "II", "III"), 1) for side in ("left", "right")},
    **{f"CC_{index}": f"callosum_{index}" for index in range(1, 8)},
}
# TractSeg's Tracking passes its worker state through module globals, which
# only reach the workers under the fork start method; macOS defaults to spawn.
TRACK = """import multiprocessing, runpy, sys, numpy
multiprocessing.set_start_method("fork")
numpy.random.seed(int(sys.argv.pop(1)))
sys.argv[0] = "Tracking"
runpy.run_path(sys.argv.pop(1), run_name="__main__")
"""


def verify_runtime():
    version = subprocess.run([MRTRIX["bin"] / "mrinfo", "-version"], check=True,
                             capture_output=True, text=True).stdout.splitlines()[0]
    if version != MRTRIX["version"]:
        raise SystemExit(f"Expected MRtrix3 3.0.8, found {version!r}")
    found = subprocess.run([VENV / "python", "-c", "import importlib.metadata as m; print(m.version('TractSeg'))"],
                           check=True, capture_output=True, text=True).stdout.strip()
    if found != TRACTSEG_VERSION:
        raise SystemExit(f"Expected TractSeg {TRACTSEG_VERSION}, found {found}")
    weights = Path.home() / ".tractseg"
    for name, digest in WEIGHTS.items():
        if sha256(weights / name) != digest:
            raise SystemExit(f"TractSeg weights checksum mismatch: {name}")
    if sha256(template()) != TEMPLATE_SHA256:
        raise SystemExit("TractSeg's MNI FA template differs from the pinned one")


def template():
    return Path(subprocess.run(
        [VENV / "python", "-c", "import importlib.resources as r; "
         "print(r.files('tractseg.resources').joinpath('MNI_FA_template.nii.gz'))"],
        check=True, capture_output=True, text=True).stdout.strip())


def run(*command, cwd):
    env = {**os.environ, "PATH": f"{MRTRIX['bin']}:{VENV}:{os.environ['PATH']}"}
    print("==", " ".join(map(str, command[:2])), flush=True)
    subprocess.run(list(map(str, command)), cwd=cwd, env=env, check=True)


def select_shells(source, work):
    """The b = 0 volumes and the Δ = 19 ms shells inside SHELLS, unchanged."""
    stem = source / "sub_013/dwi/sub_013_dwi"
    b = np.loadtxt(f"{stem}.bval")
    delta = np.rint(np.loadtxt(f"{stem}.delta"))
    vectors = np.loadtxt(f"{stem}.bvec")
    keep = np.flatnonzero((b < 25) | ((delta == DELTA_MS) & (b >= SHELLS[0]) & (b <= SHELLS[1])))
    image = nib.load(f"{stem}.nii.gz")
    data = np.asarray(image.dataobj)[..., keep]
    nib.save(nib.Nifti1Image(data, image.affine, image.header), work / "dwi.nii.gz")
    np.savetxt(work / "dwi.bval", b[keep][None], fmt="%g")
    np.savetxt(work / "dwi.bvec", vectors[keep].T, fmt="%.6f")
    return {"volumes": len(keep), "b_values": sorted({int(round(value, -1)) for value in b[keep]}),
            "diffusion_time_ms": DELTA_MS}


def peaks(source, work):
    mask = source / "sub_013/dwi/sub_013_dwi_brainmask.nii.gz"
    common = ["-nthreads", "6", "-force", "-quiet"]
    run("mrconvert", "dwi.nii.gz", "-fslgrad", "dwi.bvec", "dwi.bval", "dwi.mif", *common, cwd=work)
    run("dwi2response", "dhollander", "dwi.mif", "wm.txt", "gm.txt", "csf.txt", "-mask", mask, *common, cwd=work)
    run("dwi2fod", "msmt_csd", "dwi.mif", "wm.txt", "wmfod.mif", "gm.txt", "gm.mif", "csf.txt", "csf.mif",
        "-mask", mask, *common, cwd=work)
    run("dwiextract", "dwi.mif", "-shells", FA_SHELLS, "dwi_tensor.mif", *common, cwd=work)
    run("dwi2tensor", "dwi_tensor.mif", "tensor.mif", "-mask", mask, *common, cwd=work)
    run("tensor2metric", "tensor.mif", "-fa", "fa.nii.gz", *common, cwd=work)
    run("mrregister", "fa.nii.gz", template(), "-type", "rigid", "-rigid", "fa_to_mni.txt", *common, cwd=work)
    run("mrtransform", "wmfod.mif", "-linear", "fa_to_mni.txt", "-template", template(),
        "-reorient_fod", "yes", "wmfod_mni.mif", *common, cwd=work)
    run("sh2peaks", "wmfod_mni.mif", "peaks.nii.gz", *common, cwd=work)


def tractseg(work):
    for output in ("tract_segmentation", "endings_segmentation", "TOM"):
        run(VENV / "TractSeg", "-i", "peaks.nii.gz", "-o", "tractseg", "--output_type", output,
            "--nr_cpus", "6", cwd=work)
    run(VENV / "python", "-c", TRACK, SEED, VENV / "Tracking", "-i", "peaks.nii.gz", "-o", "tractseg",
        "--nr_cpus", "6", "--tracking_format", "trk", "--bundles", ",".join(BUNDLES), cwd=work)


def mni_to_t1(work, derived):
    """MNI world -> diffusion world (MRtrix's matrix maps template to moving) -> T1 world."""
    to_dwi = np.loadtxt(work / "fa_to_mni.txt", comments="#")
    to_t1 = np.array(json.loads((derived / "frames.json").read_text())["dwi_to_t1_world"])
    return to_dwi, to_t1


def check_alignment(work, mni_to_dwi):
    """High-FA template voxels must land on high diffusion FA, or the transform is inverted."""
    fa = nib.load(work / "fa.nii.gz")
    template_image = nib.load(template())
    world = apply_affine(template_image.affine, np.argwhere(template_image.get_fdata() > 0.6))
    ijk = np.rint(apply_affine(np.linalg.inv(fa.affine), apply_affine(mni_to_dwi, world))).astype(int)
    inside = np.all((ijk >= 0) & (ijk < fa.shape), axis=1)
    mean = float(fa.get_fdata()[tuple(ijk[inside].T)].mean())
    # Measured on sub_013: 0.505 as used, 0.307 inverted, 0.366 with no transform.
    if inside.mean() < 0.99 or mean < 0.45:
        raise ValueError(f"Template white matter lands on FA {mean:.2f} in the diffusion scan")
    return mean


def write_bundles(work, derived, t1, transform):
    out = derived / "bundles"
    counts = {}
    for name, filename in BUNDLES.items():
        source = nib.streamlines.load(work / "tractseg/TOM_trackings" / f"{name}.trk")
        lines = [apply_affine(transform, line).astype(np.float32) for line in source.streamlines]
        tractogram = nib.streamlines.Tractogram(lines, affine_to_rasmm=np.eye(4))
        header = {
            nib.streamlines.Field.VOXEL_TO_RASMM: t1.affine,
            nib.streamlines.Field.DIMENSIONS: t1.shape,
            nib.streamlines.Field.VOXEL_SIZES: t1.header.get_zooms()[:3],
            nib.streamlines.Field.VOXEL_ORDER: "".join(nib.aff2axcodes(t1.affine)),
        }
        nib.streamlines.save(tractogram, str(out / f"{filename}.trk"), header=header)
        counts[filename] = len(lines)
    return counts


def write_fa(work, derived, t1, to_t1):
    """The tensor FA resampled trilinearly onto the T1 grid; outside the scan it is 0."""
    fa = nib.load(work / "fa.nii.gz")
    voxels = np.indices(t1.shape).reshape(3, -1).T
    in_dwi = apply_affine(np.linalg.inv(fa.affine) @ np.linalg.inv(to_t1) @ t1.affine, voxels)
    values = map_coordinates(fa.get_fdata(), in_dwi.T, order=1, mode="constant", cval=0.0)
    data = np.clip(values.reshape(t1.shape), 0, 1).astype(np.float32)
    image = nib.Nifti1Image(data, t1.affine)
    image.header.set_xyzt_units("mm")
    nib.save(image, derived / "fa_t1.nii.gz")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pilot", type=Path, help="scripts/cdmd_pilot.py's work directory")
    args = parser.parse_args()
    source, derived = args.pilot / "source", args.pilot / "derived"
    for relative, digest in INPUTS.items():
        if sha256(source / relative) != digest:
            raise SystemExit(f"CDMD input checksum mismatch: {relative}")
    verify_runtime()
    work = args.pilot / "tractseg"
    work.mkdir(exist_ok=True)
    shells = select_shells(source, work)
    peaks(source, work)
    tractseg(work)
    to_dwi, to_t1 = mni_to_t1(work, derived)
    alignment = check_alignment(work, to_dwi)
    t1 = nib.load(source / "sub_013/anat/sub_013_t1w.nii.gz")
    counts = write_bundles(work, derived, t1, to_t1 @ to_dwi)
    write_fa(work, derived, t1, to_t1)
    record = {
        "procedure": "scripts/tractseg_cdmd.py",
        "selected_volumes": shells,
        "peaks": "MRtrix3 3.0.8: dwi2response dhollander, dwi2fod msmt_csd, sh2peaks (TractSeg csd_msmt)",
        "mni_alignment": {
            "method": "mrregister -type rigid of tensor FA (b = 0, 800, 1500) to TractSeg's MNI_FA_template; "
                      "FODs moved with mrtransform -reorient_fod yes",
            "template_sha256": TEMPLATE_SHA256,
            "mni_to_dwi_world": to_dwi.tolist(),
            "mean_diffusion_fa_under_template_fa_above_0.6": alignment,
        },
        "tractseg": {"version": TRACTSEG_VERSION, "outputs": ["tract_segmentation", "endings_segmentation", "TOM"],
                     "tracking": "TractSeg probabilistic TOM tracking, 2,000 streamlines per bundle",
                     "numpy_seed": SEED, "weights_sha256": WEIGHTS, "bundles": BUNDLES, "streamlines": counts},
        "mrtrix": {key: MRTRIX[key] for key in ("url", "sha256")},
        "fa": {"tensor_shells": FA_SHELLS, "resampling": "trilinear onto the T1 grid through dwi_to_t1_world"},
        "runtime_workarounds": {
            "single_openmp": "torch, dipy and scikit-learn each bundle libomp 5.0; dipy's and scikit-learn's "
                             "are symlinks to torch's, so one runtime loads. KMP_DUPLICATE_LIB_OK is not used.",
            "fork_start_method": "TractSeg's Tracking passes worker state through module globals, "
                                 "which only reach workers under fork; it runs through a wrapper that selects it.",
        },
    }
    (derived / "tractseg.json").write_text(json.dumps(record, indent=2) + "\n")
    print(f"{sum(counts.values())} streamlines in {len(counts)} bundles; FA at {derived / 'fa_t1.nii.gz'}")


if __name__ == "__main__":
    main()
