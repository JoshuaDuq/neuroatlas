"""Fetch Julich-Brain 3.1's fsaverage maps and write them as FreeSurfer annotations.

EBRAINS publishes the maximum-probability map of Julich-Brain 3.1 on fsaverage
as one GIFTI label file per hemisphere: one label per vertex, with the atlas's
own label table. Each is written unchanged, label for label, as an annotation
in fsaverage's label directory, where scripts/prepare_subject.py projects it
onto a subject like HCP-MMP1.0. The licence travels with the published files.
"""

import argparse
import json
import sys
import urllib.request
from pathlib import Path

import nibabel as nib
import numpy as np
from nibabel.freesurfer.io import read_annot, read_geometry, write_annot

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brain_model.sources import ROOT, read_config, sha256

BUCKET = "https://data-proxy.ebrains.eu/api/v1/buckets/d-f1fe19e8-99bd-44bc-9616-a52850680777"
CITATION = "https://doi.org/10.25493/KNSN-XB4"
ANNOTATION = "JulichBrain3.1"
CACHE = ROOT / "data/cache/julich-brain"
FILES = {
    "lh": ("fsaverage_surface/lh.JulichBrainAtlas_3.1.label.gii",
           "e4a854225e5269b807d995bba6ecfd7068f4ef729fd44e3c6f3ea06dfe1afda4"),
    "rh": ("fsaverage_surface/rh.JulichBrainAtlas_3.1.label.gii",
           "88e44264e41bf36075e610c2d45c42fde9a54dfc478e6b835197207adc68a9ac"),
    "licence": ("Licence-CC-BY-NC-SA.pdf", "8ece6cf82c6c58157b8166d4a4cfd248ef5dec6ff1758a8d3811ebf032c714bf"),
}
LICENSE = "CC BY-NC-SA 4.0"
PUBLISHED_LICENSE = ROOT / "public/models/licenses/Julich-Brain-CC-BY-NC-SA-4.0.pdf"


def fetch(name):
    remote, digest = FILES[name]
    path = CACHE / Path(remote).name
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        print(f"downloading {remote}", flush=True)
        urllib.request.urlretrieve(f"{BUCKET}/{remote}?redirect=true", path)
    if sha256(path) != digest:
        raise SystemExit(f"{path.name} checksum mismatch")
    return path, f"{BUCKET}/{remote}"


def as_annotation(gifti, vertex_count):
    """The label file's per-vertex keys as annotation indices, with its own table."""
    image = nib.load(gifti)
    keys = np.asarray(image.darrays[0].data)
    if keys.shape != (vertex_count,) or not np.issubdtype(keys.dtype, np.integer):
        raise SystemExit(f"{gifti.name} is not one integer label per fsaverage vertex")
    table = sorted(image.labeltable.labels, key=lambda label: label.key)
    index = {label.key: position for position, label in enumerate(table)}
    unknown = set(np.unique(keys).tolist()) - set(index)
    if unknown:
        raise SystemExit(f"{gifti.name} uses keys its label table lacks: {sorted(unknown)}")
    rgb = np.rint(np.array([label.rgba[:3] for label in table]) * 255).astype(np.int64)
    # An annotation stores each vertex as its label's colour code, so colours must be unique.
    code = rgb[:, 0] + rgb[:, 1] * 2**8 + rgb[:, 2] * 2**16
    if len(set(code.tolist())) != len(table):
        raise SystemExit(f"{gifti.name} gives two labels one colour")
    colors = np.column_stack([rgb, np.zeros(len(table), np.int64), code])
    names = [label.label for label in table]
    return np.vectorize(index.get)(keys).astype(np.int32), colors, names


def record_sources(config, paths, origins):
    manifest = ROOT / "data/sources.json"
    provenance = json.loads(manifest.read_text())
    for path, origin in zip(paths, origins):
        relative = str(path.relative_to(ROOT))
        provenance["sources"] = [
            source for source in provenance["sources"] if source["path"] != relative
        ] + [{
            "path": relative,
            "sha256": sha256(path),
            "anatomy": config["anatomy"]["id"],
            "derived_from": origin,
            "procedure": (
                "scripts/fetch_julich_brain.py: Julich-Brain 3.1's fsaverage maximum-probability "
                "map, GIFTI label keys and table written unchanged as a FreeSurfer annotation"
            ),
            "citation": CITATION,
            "license": LICENSE,
        }]
        print(f"recorded {relative}")
    manifest.write_text(json.dumps(provenance, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", action="store_true", help="add the results to data/sources.json")
    args = parser.parse_args()
    config = read_config("fsaverage")
    label_directory = config["source_directory"] / "label"
    written, origins = [], []
    for hemisphere in ("lh", "rh"):
        gifti, url = fetch(hemisphere)
        vertices, _ = read_geometry(config["source_directory"] / "surf" / f"{hemisphere}.white")
        labels, colors, names = as_annotation(gifti, len(vertices))
        destination = label_directory / f"{hemisphere}.{ANNOTATION}.annot"
        write_annot(destination, labels, colors, names, fill_ctab=False)
        restored, _, restored_names = read_annot(destination)
        # Read back: every vertex keeps its Julich-Brain label and name.
        if restored_names != [name.encode() for name in names] or not np.array_equal(restored, labels):
            raise SystemExit(f"Writing {destination.name} changed a label")
        print(f"{destination.relative_to(ROOT)}: {len(np.unique(labels))} labels on {len(labels):,} vertices")
        written.append(destination)
        origins.append([{"url": url, "sha256": sha256(gifti)}])
    licence, url = fetch("licence")
    PUBLISHED_LICENSE.write_bytes(licence.read_bytes())
    written.append(PUBLISHED_LICENSE)
    origins.append([{"url": url}])
    if args.record:
        record_sources(config, written, origins)
    else:
        print("Re-run with --record to register these files in data/sources.json.")


if __name__ == "__main__":
    main()
