"""Prepare whichever reconstruction `config/model.yaml` selects.

    uv run python scripts/prepare_subject.py

Run once per anatomy. Both steps are declared by that anatomy rather than known
here, so a different subject is a config entry and a download, not an edit to
this file.

`archive` means the reconstruction is not redistributed with this repository:
download it from the anatomy's `source_url` into `data/cache/`, and nothing is
unpacked until those bytes match the recorded SHA256. An anatomy whose files are
committed declares no archive and skips this.

`project_hcp_from` names the brain whose published fsaverage annotations are not
in this brain's space and must be resampled onto it, through the registered
spheres FreeSurfer produced for both. No physical vertex moves and no label is
interpolated: each target vertex adopts the label of the source vertex nearest to
it on the sphere. An anatomy those annotations are already published on declares
no source and skips this.
"""

import argparse
import json
import sys
import tarfile
from pathlib import Path

import numpy as np
from nibabel.freesurfer.io import read_annot, read_geometry, write_annot

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brain_model import networks
from brain_model.registration import resample_surface_labels
from brain_model.sources import ROOT, read_config, sha256, write_json

CACHE = ROOT / "data/cache"
PROCEDURE = (
    "scripts/prepare_subject.py: forward nearest-neighbour sphere.reg transfer"
)
CITATION = "https://surfer.nmr.mgh.harvard.edu/fswiki/mri_surf2surf"

# The FreeSurfer recon layout this model reads. Subject-independent by
# construction: every `recon-all` output carries these paths.
SUBJECT_FILES = [
    "mri/orig.mgz",
    "mri/aseg.mgz",
    "mri/aparc.a2009s+aseg.mgz",
    "mri/ribbon.mgz",
    "mri/brain.mgz",
    "scripts/build-stamp.txt",
    *(
        f"{directory}/{hemisphere}.{name}"
        for hemisphere in ("lh", "rh")
        for directory, name in [
            ("surf", "pial"), ("surf", "white"), ("surf", "sulc"),
            ("surf", "sphere.reg"), ("label", "aparc.a2009s.annot"),
        ]
    ),
]

# Deterministic, and enough of them to catch a wrong tree rather than a tie.
VERIFY_SAMPLES = 512

# Published annotations that live in the projection source's label directory
# and travel to this brain the same way, each with the report it writes. The
# network layer is optional, so a source tree without it projects the rest.
PROJECTED_ANNOTATIONS = [
    ("HCPMMP1", "hcp-registration.json"),
    (networks.ANNOTATION, "network-registration.json"),
]


def record_source(provenance, path, **metadata):
    """Register one file, replacing any earlier entry for the same path."""
    relative = str(path.relative_to(ROOT))
    provenance["sources"] = [
        source for source in provenance["sources"] if source["path"] != relative
    ]
    provenance["sources"].append(
        {"path": relative, "sha256": sha256(path), **metadata}
    )


def extract_subject(config, provenance):
    """Unpack the reconstruction's own files, byte for byte, from its archive."""
    anatomy = config["anatomy"]
    if "archive" not in anatomy:
        print(f"{anatomy['id']}: files are committed, nothing to unpack")
        return
    url, settings = anatomy["source_url"], anatomy["archive"]
    path = CACHE / url.rsplit("/", 1)[-1].split("?")[0]
    if not path.exists():
        raise SystemExit(f"Download {url} to {path.relative_to(ROOT)} and run again.")
    if sha256(path) != settings["sha256"]:
        raise SystemExit(f"{path.relative_to(ROOT)} does not match its checksum.")
    with tarfile.open(path) as archive:
        for name in SUBJECT_FILES:
            member = settings["member_prefix"] + name
            destination = config["source_directory"] / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(archive.extractfile(member).read())
            record_source(
                provenance,
                destination,
                anatomy=anatomy["id"],
                url=url,
                archive_sha256=settings["sha256"],
                archive_member=member,
            )


def transfer_annotation(config, provenance, annotation_name, report_name):
    """Resample one published annotation onto this brain's own vertices.

    The written annotation is read back and compared, then a sample of its
    labels is re-derived from exhaustive distances rather than from the tree
    that produced them. Both checks exist because a silently mistransferred
    parcellation still looks like a parcellation.

    Only the results are recorded here. The annotation and spheres this reads
    are inputs in their own right, recorded as such and shared by every brain
    that projects from them.
    """
    anatomy = config["anatomy"]
    source = anatomy["hcp_source_directory"]
    target = config["source_directory"]
    reports = {}
    for hemisphere in ("lh", "rh"):
        annotation = source / "label" / f"{hemisphere}.{annotation_name}.annot"
        if not annotation.exists():
            print(f"{anatomy['id']}: {annotation.name} is not present, skipping")
            return {}
        source_path = source / "surf" / f"{hemisphere}.sphere.reg"
        target_path = target / "surf" / f"{hemisphere}.sphere.reg"
        source_sphere, _ = read_geometry(source_path)
        target_sphere, _ = read_geometry(target_path)
        labels, colors, names = read_annot(annotation)
        mapped = resample_surface_labels(source_sphere, target_sphere, labels)
        if set(mapped) != set(labels):
            raise SystemExit(f"{annotation_name} label coverage changed in {hemisphere}")

        destination = target / "label" / annotation.name
        write_annot(destination, mapped, colors, names, fill_ctab=False)
        restored, restored_colors, restored_names = read_annot(destination)
        np.testing.assert_array_equal(restored, mapped)
        np.testing.assert_array_equal(restored_colors, colors)
        if restored_names != names:
            raise SystemExit(f"Writing {destination.name} changed the label names")

        samples = np.linspace(0, len(mapped) - 1, VERIFY_SAMPLES, dtype=int)
        for index in samples:
            distances = np.sum((source_sphere - target_sphere[index]) ** 2, axis=1)
            if mapped[index] != labels[np.argmin(distances)]:
                raise SystemExit("Registered-sphere label verification failed")

        reports[hemisphere] = {
            "target_vertices": len(mapped),
            "labels_preserved": len(set(mapped)),
            "independent_nearest_vertex_samples": len(samples),
            "method": "Forward nearest source vertex in sphere.reg space, no smoothing",
        }
        record_source(
            provenance,
            destination,
            anatomy=anatomy["id"],
            derived_from=[
                str(path.relative_to(ROOT))
                for path in (annotation, source_path, target_path)
            ],
            procedure=PROCEDURE,
            citation=CITATION,
        )
    report_path = target / report_name
    write_json(report_path, reports)
    record_source(provenance, report_path, anatomy=anatomy["id"], procedure=PROCEDURE)
    return reports


def transfer_annotations(config, provenance):
    """Project every published annotation this brain does not already carry."""
    anatomy = config["anatomy"]
    if "project_hcp_from" not in anatomy:
        print(f"{anatomy['id']}: published annotations are in this space already")
        return {}
    return {
        name: transfer_annotation(config, provenance, name, report)
        for name, report in PROJECTED_ANNOTATIONS
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--anatomy",
        help="prepare this declared anatomy instead of the selected one",
    )
    config = read_config(parser.parse_args().anatomy)
    provenance_path = ROOT / "data/sources.json"
    provenance = json.loads(provenance_path.read_text())
    extract_subject(config, provenance)
    reports = transfer_annotations(config, provenance)
    write_json(provenance_path, provenance)
    print(json.dumps(reports, indent=2))


if __name__ == "__main__":
    main()
