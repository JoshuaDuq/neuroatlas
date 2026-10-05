"""Package the published reference without resampling or reducing streamlines."""

import argparse
import gzip
import hashlib
import json
import shutil
import tarfile
import tempfile
from pathlib import Path

import nibabel as nib
import numpy as np
import yaml


ROOT = Path(__file__).resolve().parents[1]


def checksum(path, algorithm="sha256"):
    digest = hashlib.new(algorithm)
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def extract_asset(archive, source_name, destination):
    member = archive.getmember(source_name)
    if not member.isfile():
        raise ValueError(f"Expected a regular file: {source_name}")
    with archive.extractfile(member) as source, destination.open("wb") as target:
        shutil.copyfileobj(source, target)


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


def prepare_diffusion(archive_path):
    config = yaml.safe_load((ROOT / "data/diffusion.yaml").read_text())
    if checksum(archive_path, "md5") != config["archive_md5"]:
        raise ValueError("Archive checksum differs from DIPY's published checksum")
    output = ROOT / "public/diffusion"
    records = []
    with tempfile.TemporaryDirectory(prefix="neuroatlas-diffusion-") as temporary:
        directory = Path(temporary)
        with tarfile.open(archive_path) as archive:
            for descriptor in [*config["maps"], *config["bundles"]]:
                name = Path(descriptor["file"]).name
                original_name = name.removesuffix(".gz") if name.endswith(".trk.gz") else name
                source_name = f"bundles/{original_name}" if name.endswith(".trk.gz") else original_name
                extract_asset(
                    archive, f"{config['archive_subject']}/{source_name}",
                    directory / original_name,
                )
        reference = validate_image(directory / Path(config["maps"][0]["file"]).name)
        for descriptor in config["maps"]:
            source = directory / Path(descriptor["file"]).name
            image = validate_image(source)
            np.testing.assert_array_equal(image.shape, reference.shape)
            np.testing.assert_allclose(image.affine, reference.affine, rtol=0, atol=1e-5)
            target = output / descriptor["file"]
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            records.append({
                "file": target.name, "source_sha256": checksum(source),
                "shape": list(image.shape), "affine": image.affine.tolist(),
            })
        for descriptor in config["bundles"]:
            target = output / descriptor["file"]
            source = directory / target.name.removesuffix(".gz")
            bundle, points, lengths = validate_bundle(source, reference)
            with target.open("wb") as compressed:
                with gzip.GzipFile(filename="", fileobj=compressed, mode="wb",
                                   compresslevel=6, mtime=0) as stream:
                    with source.open("rb") as original:
                        shutil.copyfileobj(original, stream)
            records.append({
                "file": target.name, "source_sha256": checksum(source),
                "published_sha256": checksum(target),
                "source_bytes": source.stat().st_size,
                "published_bytes": target.stat().st_size,
                **geometry_record(bundle, points, lengths),
            })
    provenance = {
        "dataset": "DIPY SNAIL bundles_2_subjects",
        "subject": Path(config["archive_subject"]).name,
        "source": config["source"], "license": config["license"],
        "archive_md5": config["archive_md5"],
        "processing": "Original NIfTI files and losslessly gzip-compressed original TRK files; "
                      "no coordinate changes or streamline reduction.",
        "spatial_validation": "Reference image shape and affine agree with all TRK headers "
                              "at absolute tolerance 1e-5. Source streamlines are retained, "
                              "including points outside the image field of view.",
        "geometry_validation": "NiBabel RAS+ millimeter samples and float64 polyline lengths "
                               "provide independent checks of the browser's TRK decoder.",
        "files": records,
    }
    (output / config["provenance"]).write_text(json.dumps(provenance, indent=2) + "\n")
    print(f"Prepared {len(config['maps'])} images and {len(config['bundles'])} bundles")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="DIPY bundles_2_subjects.tar.gz")
    prepare_diffusion(parser.parse_args().archive)
