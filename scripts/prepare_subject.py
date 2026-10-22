"""Prepare whichever reconstruction config/model.yaml selects."""

import argparse
import json
import sys
import tarfile
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen

import numpy as np
from nibabel.freesurfer.io import read_annot, read_geometry, write_annot

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brain_model.layers import networks
from brain_model.sources import ROOT, declares, read_config, sha256, write_json
from brain_model.surfaces.registration import resample_surface_labels

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
    "mri/wmparc.mgz",
    "scripts/build-stamp.txt",
    "stats/aseg.stats",
    *(
        f"{directory}/{hemisphere}.{name}"
        for hemisphere in ("lh", "rh")
        for directory, name in [
            ("surf", "pial"), ("surf", "white"), ("surf", "sulc"),
            ("surf", "sphere.reg"), ("label", "aparc.a2009s.annot"),
        ]
    ),
]

# Published annotations that live in the projection source's label directory
# and travel to this brain the same way, each with the report it writes and
# the layer, if any, that must be declared for it to be projected.
PROJECTED_ANNOTATIONS = [
    ("HCPMMP1", "hcp-registration.json", None),
    (networks.ANNOTATION, "network-registration.json", "networks"),
]


def record_source(provenance, path, rerecord=False, **metadata):
    relative = str(path.relative_to(ROOT))
    digest = sha256(path)
    recorded = [s for s in provenance["sources"] if s["path"] == relative]
    if not rerecord and any(source["sha256"] != digest for source in recorded):
        raise ValueError(
            f"{relative} differs from its recorded checksum; pass --rerecord to "
            "replace the record"
        )
    provenance["sources"] = [
        source for source in provenance["sources"] if source["path"] != relative
    ]
    provenance["sources"].append({"path": relative, "sha256": digest, **metadata})


def record_reconstruction(config, provenance, rerecord=False):
    anatomy = config["anatomy"]
    settings = anatomy["reconstruction"]
    directory = config["source_directory"]
    report_path = directory / settings["provenance"]
    marker = directory / settings["completion_marker"]
    paths = [directory / name for name in SUBJECT_FILES]
    required = [*paths, report_path, marker]
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        raise ValueError(f"{anatomy['id']} reconstruction is incomplete: {missing}")
    report = json.loads(report_path.read_text())
    if report["status"] != "complete":
        raise ValueError(f"{anatomy['id']} reconstruction is incomplete: {report['status']}")
    input_path = ROOT / settings["input"]
    if sha256(input_path) != settings["input_sha256"]:
        raise ValueError(f"{settings['input']}: reconstruction input checksum changed")
    if report["input_sha256"] != settings["input_sha256"]:
        raise ValueError("Reconstruction report input checksum differs from configuration")
    stamp = (directory / "scripts/build-stamp.txt").read_text().strip()
    if stamp != config["freesurfer_build"] or report["freesurfer_build"] != stamp:
        raise ValueError("Reconstruction FreeSurfer build differs from configuration")
    # The report is written when recon-all finishes, so it describes the run's
    # outputs; files that no longer match it are not that run's outputs. One it
    # predates is declared, and then only data/sources.json pins it.
    unreported = set(settings.get("unreported_outputs", []))
    if set(report["output_sha256"]) != set(SUBJECT_FILES) - unreported:
        raise ValueError("Reconstruction report does not list exactly the required outputs")
    changed = [
        name for name, path in zip(SUBJECT_FILES, paths)
        if name not in unreported and sha256(path) != report["output_sha256"][name]
    ]
    if sha256(marker) != report["completion_marker_sha256"]:
        changed.append(settings["completion_marker"])
    if changed:
        raise ValueError(f"Reconstruction outputs differ from {report_path.name}: {changed}")
    record_source(provenance, input_path, rerecord, anatomy=anatomy["id"],
                  url=anatomy["source_url"])
    for path in [*paths, report_path]:
        record_source(
            provenance, path, rerecord, anatomy=anatomy["id"],
            derived_from=[settings["input"]],
            procedure="FreeSurfer recon-all; see reconstruction.json for exact commands",
            citation="https://surfer.nmr.mgh.harvard.edu/fswiki/recon-all",
        )


def obtain_subject(config, provenance, rerecord=False):
    anatomy = config["anatomy"]
    if "archive" in anatomy:
        extract_subject(config, provenance, rerecord)
    elif "download" in anatomy:
        download_subject(config, provenance)
    elif "reconstruction" in anatomy:
        record_reconstruction(config, provenance, rerecord)
    else:
        print(f"{anatomy['id']}: files are committed, nothing to fetch")


def download_subject(config, provenance):
    anatomy = config["anatomy"]
    base = anatomy["download"]["base_url"].rstrip("/")
    recorded = {source["path"]: source.get("sha256") for source in provenance["sources"]}
    for name in SUBJECT_FILES:
        destination = config["source_directory"] / name
        relative = str(destination.relative_to(ROOT))
        url = f"{base}/{quote(name)}"
        if not destination.exists():
            destination.parent.mkdir(parents=True, exist_ok=True)
            with urlopen(url) as response:
                destination.write_bytes(response.read())
        expected = recorded.get(relative)
        if expected is not None and sha256(destination) != expected:
            raise SystemExit(f"{relative} does not match its recorded checksum.")
        record_source(provenance, destination, anatomy=anatomy["id"], url=url)


def extract_subject(config, provenance, rerecord=False):
    anatomy = config["anatomy"]
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
                rerecord,
                anatomy=anatomy["id"],
                url=url,
                archive_sha256=settings["sha256"],
                archive_member=member,
            )


def transfer_annotation(config, provenance, annotation_name, report_name, rerecord=False):
    anatomy = config["anatomy"]
    source = anatomy["hcp_source_directory"]
    target = config["source_directory"]
    annotations = {
        hemisphere: source / "label" / f"{hemisphere}.{annotation_name}.annot"
        for hemisphere in ("lh", "rh")
    }
    missing = [str(path) for path in annotations.values() if not path.exists()]
    if missing:
        raise SystemExit(f"{annotation_name} is not published at {missing}")
    reports = {}
    for hemisphere, annotation in annotations.items():
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

        samples = np.linspace(
            0, len(mapped) - 1, config["annotation_projection"]["verify_samples"], dtype=int
        )
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
            rerecord,
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
    record_source(
        provenance, report_path, rerecord, anatomy=anatomy["id"], procedure=PROCEDURE
    )
    return reports


def transfer_annotations(config, provenance, rerecord=False):
    anatomy = config["anatomy"]
    if "project_hcp_from" not in anatomy:
        print(f"{anatomy['id']}: published annotations are in this space already")
        return {}
    return {
        name: transfer_annotation(config, provenance, name, report, rerecord)
        for name, report, layer in PROJECTED_ANNOTATIONS
        if layer is None or declares(config, layer)
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--anatomy",
        help="prepare this declared anatomy instead of the selected one",
    )
    parser.add_argument(
        "--rerecord", action="store_true",
        help="replace recorded checksums that the files on disk no longer match",
    )
    args = parser.parse_args()
    config = read_config(args.anatomy)
    provenance_path = ROOT / "data/sources.json"
    provenance = json.loads(provenance_path.read_text())
    obtain_subject(config, provenance, args.rerecord)
    reports = transfer_annotations(config, provenance, args.rerecord)
    write_json(provenance_path, provenance)
    print(json.dumps(reports, indent=2))


if __name__ == "__main__":
    main()
