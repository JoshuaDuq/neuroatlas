"""Package the CDMD sub_013 tracts that scripts/cdmd_pilot.py tracked and recognised.

Every streamline is kept and resampled along its own arc length to the
catalog's step (linear interpolation, as DIPY's set_number_of_points); the
0.2 mm tracking step is an integration setting, not a measurement. The map is
the pinned T1 the reconstruction imported, so tracts, MRI and surfaces share
one scanner frame.
"""

import argparse
import gzip
import json
import shutil
import sys
import tempfile
from pathlib import Path

import nibabel as nib
import numpy as np
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from brain_model.sources import ROOT, read_config, sha256
from prepare_diffusion import geometry_record, validate_bundle, validate_image

CATALOG = ROOT / "data/diffusion-cdmd.yaml"
# Every this many streamlines, each original point's distance to the resampled
# polyline is measured.
DEVIATION_SAMPLE = 25


def resample(line, step):
    """`line` at equal arc-length spacing as close to `step` as its length allows."""
    points = line.astype(np.float64)
    arc = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(points, axis=0), axis=1))])
    count = max(2, int(round(arc[-1] / step)) + 1)
    targets = np.linspace(0.0, arc[-1], count)
    return np.column_stack([np.interp(targets, arc, points[:, k]) for k in range(3)]).astype(np.float32)


def deviation(original, resampled):
    """Largest distance from an original point to the resampled polyline."""
    start, segment = resampled[:-1].astype(np.float64), np.diff(resampled.astype(np.float64), axis=0)
    lengths = np.maximum((segment ** 2).sum(axis=1), 1e-12)
    worst = 0.0
    for point in original.astype(np.float64):
        u = np.clip(((point - start) * segment).sum(axis=1) / lengths, 0, 1)
        worst = max(worst, float(np.sqrt(((start + u[:, None] * segment - point) ** 2).sum(axis=1)).min()))
    return worst


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pilot", type=Path, help="scripts/cdmd_pilot.py's work directory")
    args = parser.parse_args()
    catalog = yaml.safe_load(CATALOG.read_text())
    settings = read_config(catalog["anatomy"])["anatomy"]["reconstruction"]
    derived = args.pilot / "derived"
    t1_source = args.pilot / "source/sub_013/anat/sub_013_t1w.nii.gz"
    if sha256(t1_source) != settings["input_sha256"]:
        raise SystemExit("The pilot's T1 is not the T1 the reconstruction imported")
    output = ROOT / "public/diffusion"
    (t1_map,) = catalog["maps"]
    target = output / t1_map["file"]
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(t1_source, target)
    reference = validate_image(target)
    records = [{"file": target.name, "source_sha256": sha256(t1_source),
                "shape": list(reference.shape), "affine": reference.affine.tolist()}]

    step = catalog["resample_step_mm"]
    with tempfile.TemporaryDirectory(prefix="neuroatlas-cdmd-") as temporary:
        for descriptor in catalog["bundles"]:
            published = output / descriptor["file"]
            source = derived / "bundles" / published.name.removesuffix(".gz")
            original, _, original_lengths = validate_bundle(source, reference)
            lines = [resample(line, step) for line in original.streamlines]
            deviations = [deviation(original.streamlines[i], lines[i])
                          for i in range(0, len(lines), DEVIATION_SAMPLE)]
            plain = Path(temporary) / source.name
            nib.streamlines.save(nib.streamlines.Tractogram(lines, affine_to_rasmm=np.eye(4)), str(plain),
                                 header=original.header)
            bundle, points, lengths = validate_bundle(plain, reference)
            if len(bundle.streamlines) != len(original.streamlines):
                raise ValueError(f"{source.name}: resampling changed the streamline count")
            with published.open("wb") as compressed, gzip.GzipFile(
                filename="", fileobj=compressed, mode="wb", compresslevel=6, mtime=0
            ) as stream, plain.open("rb") as raw:
                shutil.copyfileobj(raw, stream)
            steps = np.concatenate([np.linalg.norm(np.diff(line, axis=0), axis=1) for line in bundle.streamlines])
            records.append({
                "file": published.name, "source_sha256": sha256(source),
                # What the published file decompresses to: the resampled TRK.
                "resampled_sha256": sha256(plain), "published_sha256": sha256(published),
                "source_bytes": source.stat().st_size, "published_bytes": published.stat().st_size,
                "source_points": len(original.streamlines.get_data()),
                "resampling": {
                    "step_mm": {"median": float(np.median(steps)), "max": float(steps.max())},
                    "deviation_mm": {"sampled_streamlines": len(deviations),
                                     "median": float(np.median(deviations)), "max": float(np.max(deviations))},
                    # 0.5 mm chords cut across the tracker's 0.2 mm zig-zag, so polylines shorten.
                    "length_change_mm_max": float(np.abs(lengths - original_lengths).max()),
                    "relative_length_change": {
                        "median": float(np.median((original_lengths - lengths) / original_lengths)),
                        "max": float(np.max(np.abs(original_lengths - lengths) / original_lengths)),
                    },
                },
                **geometry_record(bundle, points, lengths),
            })
            print(f"{published.name}: {len(lines)} streamlines, max deviation {np.max(deviations):.4f} mm")

    bundles = json.loads((derived / "bundles.json").read_text())
    provenance = {
        "dataset": "MGH CDMD sub_013, tracked for NeuroAtlas",
        "subject": "sub_013",
        "source": catalog["source"], "license": catalog["license"],
        "tracking": {
            "procedure": "scripts/cdmd_pilot.py: MSMT-CSD (DIPY), particle filtering tractography, "
                         "RecoBundles against DIPY's HCP842 80-bundle atlas",
            "tractogram": json.loads((derived / "track.json").read_text()),
            "recognition_settings": bundles["settings"], "recognition_rng": bundles["rng"],
            "atlas_counts": bundles["atlas_counts"],
        },
        "processing": f"Every recognised streamline kept and resampled to {step} mm arc-length steps by "
                      "linear interpolation; the map is the reconstruction's pinned input T1, unchanged.",
        "spatial_validation": "Map shape and affine agree with every TRK header at absolute tolerance 1e-5.",
        "geometry_validation": "NiBabel RAS+ millimetre samples and float64 polyline lengths provide "
                               "independent checks of the browser's TRK decoder.",
        "files": records,
    }
    (output / catalog["provenance"]).write_text(json.dumps(provenance, indent=2) + "\n")
    print(f"Prepared {len(catalog['maps'])} map and {len(catalog['bundles'])} bundles")


if __name__ == "__main__":
    main()
