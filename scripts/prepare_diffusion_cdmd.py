"""Package the CDMD sub_013 tracts and maps that scripts/cdmd_pilot.py and scripts/tractseg_cdmd.py made.

Every streamline is kept and resampled along its own arc length to the
catalog's step (linear interpolation, as DIPY's set_number_of_points); the
tracking steps are integration settings, not measurements. The T1 map is the
pinned T1 the reconstruction imported and the FA map is already on its grid,
so tracts, MRI and surfaces share one scanner frame.
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

CATALOG = ROOT / "data/diffusion-cdmd.yaml"
# Every this many streamlines, each original point's distance to the resampled
# polyline is measured.
DEVIATION_SAMPLE = 25


def validate_image(path):
    image = nib.load(path)
    if len(image.shape) != 3 or image.header.get_xyzt_units()[0] != "mm":
        raise ValueError(f"Expected a 3D image in millimeters: {path.name}")
    if not np.isfinite(image.affine).all():
        raise ValueError(f"Invalid image transform: {path.name}")
    return image


def validate_bundle(path, reference):
    bundle = nib.streamlines.load(path)
    np.testing.assert_array_equal(bundle.header["dimensions"], reference.shape)
    np.testing.assert_allclose(
        bundle.header["voxel_to_rasmm"], reference.affine, rtol=0, atol=1e-5
    )
    bundle.tractogram.to_world()
    points = bundle.streamlines.get_data()
    if not np.isfinite(points).all():
        raise ValueError(f"Nonfinite streamline coordinates: {path.name}")
    lengths = np.array([
        np.linalg.norm(np.diff(line.astype(np.float64), axis=0), axis=1).sum()
        for line in bundle.streamlines
    ])
    if not len(lengths) or np.any(lengths <= 0):
        raise ValueError(f"Empty or zero-length streamlines: {path.name}")
    return bundle, points, lengths


def geometry_record(bundle, points, lengths):
    samples = sorted({0, len(points) // 2, len(points) - 1})
    summaries = []
    for minimum in (1, 100, 200):
        shown = lengths[lengths >= minimum]
        summaries.append({
            "minimum_mm": minimum, "shown": len(shown),
            "mean_mm": float(shown.mean()) if len(shown) else None,
            "min_mm": float(shown.min()) if len(shown) else None,
            "max_mm": float(shown.max()) if len(shown) else None,
        })
    return {
        "streamlines": len(bundle.streamlines), "points": len(points),
        "rasmm_samples": [
            {"index": index, "position": points[index].tolist()}
            for index in samples
        ],
        "length_summaries": summaries,
    }


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
    t1_map, fa_map = catalog["maps"]
    target = output / t1_map["file"]
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(t1_source, target)
    reference = validate_image(target)
    records = [{"file": target.name, "source_sha256": sha256(t1_source),
                "shape": list(reference.shape), "affine": reference.affine.tolist()}]
    fa_source = derived / "fa_t1.nii.gz"
    fa_target = output / fa_map["file"]
    shutil.copyfile(fa_source, fa_target)
    fa = validate_image(fa_target)
    if fa.shape != reference.shape or not np.allclose(fa.affine, reference.affine, rtol=0, atol=1e-5):
        raise ValueError("The FA map is not on the T1's grid")
    records.append({"file": fa_target.name, "source_sha256": sha256(fa_source),
                    "shape": list(fa.shape), "affine": fa.affine.tolist()})
    tractseg = json.loads((derived / "tractseg.json").read_text())
    by_tractseg = set(tractseg["tractseg"]["bundles"].values())

    step = catalog["resample_step_mm"]
    with tempfile.TemporaryDirectory(prefix="planum-cdmd-") as temporary:
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
                "file": published.name,
                "method": "TractSeg" if source.stem in by_tractseg else "RecoBundles",
                "source_sha256": sha256(source),
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
        "dataset": "MGH CDMD sub_013, tracked for Planum",
        "subject": "sub_013",
        "source": catalog["source"], "license": catalog["license"],
        "tracking": {
            "procedure": "scripts/cdmd_pilot.py: MSMT-CSD (DIPY), particle filtering tractography, "
                         "RecoBundles against DIPY's HCP842 80-bundle atlas; every file whose method is "
                         "RecoBundles",
            "tractogram": json.loads((derived / "track.json").read_text()),
            "recognition_settings": bundles["settings"], "recognition_rng": bundles["rng"],
            "atlas_counts": bundles["atlas_counts"],
        },
        # SLF I–III and the seven callosal segments, which HCP842 does not divide.
        "tractseg": tractseg,
        "processing": f"Every streamline kept and resampled to {step} mm arc-length steps by linear "
                      "interpolation; the T1 is the reconstruction's pinned input, unchanged, and FA is the "
                      "tensor FA of the subject's own diffusion scan resampled onto it.",
        "spatial_validation": "Map shape and affine agree with every TRK header at absolute tolerance 1e-5.",
        "geometry_validation": "NiBabel RAS+ millimetre samples and float64 polyline lengths provide "
                               "independent checks of the browser's TRK decoder.",
        "files": records,
    }
    (output / catalog["provenance"]).write_text(json.dumps(provenance, indent=2) + "\n")
    print(f"Prepared {len(catalog['maps'])} maps and {len(catalog['bundles'])} bundles")


if __name__ == "__main__":
    main()
