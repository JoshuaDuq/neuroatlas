"""Average each domain term's Neurosynth consistency map over every fsaverage HCP-MMP area.

Run once, with the meta-analysis tools the build does not need:

    uv run --with nimare==0.22.1 --with nilearn==0.13.1 python scripts/derive_domain_scores.py

The maps are Neurosynth's uniformity (consistency) test, computed as Neurosynth
computes it: MKDA chi-square with a 6 mm kernel, studies whose abstract uses the
term at a TF-IDF of at least 0.001 against every other study.
"""

import multiprocessing
import sys
from importlib.metadata import version
from pathlib import Path

import nibabel as nib
from nilearn import surface
from nimare.extract import fetch_neurosynth
from nimare.meta.cbma.mkda import MKDAChi2

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from brain_model.layers.neuropsych_domains import FSAVERAGE, SCORES, read_definition
from brain_model.sources import HEMISPHERES, ROOT, sha256, write_json

CACHE = ROOT / "data/cache/neurosynth"
NEUROSYNTH_VERSION = "7"
LABEL_THRESHOLD = 0.001
KERNEL_RADIUS_MM = 6
MAP = "z_desc-uniformity"
# Each term's chi-square fit is independent; four at a time fit in a 24 GB machine.
WORKERS = 4

# Loaded once and inherited by each forked worker rather than copied to it.
dataset = None


def area_means(image):
    """The map sampled between each fsaverage white and pial vertex, averaged per HCP-MMP area."""
    means = {}
    for prefix in HEMISPHERES:
        texture = surface.vol_to_surf(image, FSAVERAGE / "surf" / f"{prefix}.pial",
                                      inner_mesh=FSAVERAGE / "surf" / f"{prefix}.white")
        labels, _, names = nib.freesurfer.read_annot(FSAVERAGE / "label" / f"{prefix}.HCPMMP1.annot")
        for index, name in enumerate(name.decode() for name in names):
            if name.endswith("_ROI"):
                means[name] = float(texture[labels == index].mean())
    return means


def consistency(term):
    """The term's study count and its consistency map's mean per area."""
    ids = dataset.get_studies_by_label(f"terms_abstract_tfidf__{term}", label_threshold=LABEL_THRESHOLD)
    others = sorted(set(dataset.ids) - set(ids))
    result = MKDAChi2(kernel__r=KERNEL_RADIUS_MM).fit(dataset.slice(ids), dataset.slice(others))
    print(f"{term}: {len(ids)} studies", flush=True)
    return len(ids), area_means(result.get_map(MAP))


def main():
    global dataset
    definition = read_definition()
    dataset = fetch_neurosynth(data_dir=CACHE, version=NEUROSYNTH_VERSION, return_type="dataset",
                               source="abstract", vocab="terms")[0]
    terms = [domain["term"] for domain in definition["domains"]]
    missing = [term for term in terms if f"terms_abstract_tfidf__{term}" not in dataset.get_labels()]
    if missing:
        raise ValueError(f"Neurosynth has no terms {missing}")
    with multiprocessing.get_context("fork").Pool(WORKERS) as pool:
        results = pool.map(consistency, terms)
    ids = [domain["id"] for domain in definition["domains"]]
    studies = {key: count for key, (count, _) in zip(ids, results)}
    scores = {key: means for key, (_, means) in zip(ids, results)}
    write_json(SCORES, {
        "terms": {domain["id"]: domain["term"] for domain in definition["domains"]},
        "derivation": {
            "database": f"Neurosynth version {NEUROSYNTH_VERSION}, abstract terms",
            "files": {path.name: sha256(path) for path in sorted((CACHE / "neurosynth").glob("*"))},
            "studies": studies,
            "selection": f"abstract TF-IDF >= {LABEL_THRESHOLD}",
            "map": f"MKDAChi2 {MAP}, {KERNEL_RADIUS_MM} mm kernel",
            "projection": "nilearn vol_to_surf between fsaverage white and pial, mean per HCP-MMP area",
            "software": {name: version(name) for name in ("nimare", "nilearn", "numpy")},
        },
        "scores": {key: dict(sorted(values.items())) for key, values in scores.items()},
    })


if __name__ == "__main__":
    main()
