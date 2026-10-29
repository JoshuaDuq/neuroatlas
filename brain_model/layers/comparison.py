"""Area-conserving atlas intersections on the original pial tessellation."""

import argparse
import json
from collections import defaultdict
from itertools import combinations
from typing import NamedTuple

import numpy as np
import trimesh
from nibabel.freesurfer.io import read_annot, read_geometry

from ..gltf.export import add_region, compact_region, write_scene
from ..sources import HEMISPHERES, ROOT, read_config, sha256, write_json
from ..surfaces.geometry import Partition, partition_surface, validate_surface


class SurfaceComparison(NamedTuple):
    region_labels: np.ndarray
    areas_mm2: np.ndarray
    partition: Partition


def compare_surface(vertices, faces, annotations):
    """Measure joint barycentric cells in float64; retain unassigned labels."""
    vertices = np.asarray(vertices, dtype=np.float64)
    faces = np.asarray(faces)
    annotations = np.asarray(annotations)
    if annotations.shape != (len(vertices), 2) or annotations.dtype.kind not in "iu":
        raise ValueError("Two integer annotations are required for every vertex.")
    validate_surface(vertices, faces, annotations[:, 0])
    triangles = vertices[faces]
    areas = (
        np.linalg.norm(
            np.cross(
                triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
            ),
            axis=1,
        )
        / 2
    )
    if not np.isfinite(areas).all() or np.any(areas <= 0):
        raise ValueError("Pial triangles must have finite, nondegenerate area.")
    vertex_areas = np.bincount(
        faces.ravel(), weights=np.repeat(areas / 3, 3), minlength=len(vertices)
    )
    pairs, codes = np.unique(annotations, axis=0, return_inverse=True)
    joint_areas = np.bincount(codes, weights=vertex_areas, minlength=len(pairs))
    return SurfaceComparison(
        pairs, joint_areas, partition_surface(vertices, faces, codes)
    )


def is_enabled(config):
    return config["anatomy"]["id"] in config["atlas_comparison"]["enabled_anatomies"]


def comparison_atlases(config, manifest, selected=None):
    if not is_enabled(config):
        raise ValueError("Atlas comparison is not enabled for this anatomy.")
    if config["anatomy"]["id"] != manifest["anatomy"]["id"]:
        raise ValueError("Comparison source and published anatomy must match.")
    selected = ["destrieux", "hcp-mmp"] if selected is None else list(selected)
    if (len(selected) != 2 or len(set(selected)) != 2
            or any(atlas not in config["atlas_comparison"]["atlases"] for atlas in selected)):
        raise ValueError("Comparison requires two distinct configured cortical atlases.")
    atlases = {atlas["id"]: atlas for atlas in manifest["atlases"]}
    if len(atlases) != len(manifest["atlases"]):
        raise ValueError("Published atlas identities must be unique.")
    unpublished = [atlas for atlas in selected if atlas not in atlases]
    if unpublished:
        raise ValueError(f"Comparison atlases have no published cortical surface: {unpublished}")
    return [atlases[atlas] for atlas in selected]


def verify_comparison_sources(config, manifest, atlases):
    sources = manifest["provenance"]["sources"]
    expected = {
        (ROOT / source["path"]).resolve(): source["sha256"] for source in sources
    }
    if len(expected) != len(sources):
        raise ValueError("Published source paths must be unique.")
    directory = config["source_directory"]
    for prefix in HEMISPHERES:
        paths = [directory / "surf" / f"{prefix}.pial"] + [
            directory / "label" / f"{prefix}.{atlas['annotation']}.annot"
            for atlas in atlases
        ]
        for path in paths:
            if (
                path.resolve() not in expected
                or sha256(path) != expected[path.resolve()]
            ):
                raise ValueError(
                    f"Comparison source differs from published provenance: {path}"
                )


def source_region_index(manifest, atlas, hemisphere):
    regions = {}
    for region in manifest["regions"]:
        if region["atlas"] != atlas or region["hemisphere"] != hemisphere:
            continue
        label = region["source_label_id"]
        if (
            region["id"] != f"{atlas}:{hemisphere}:{label}"
            or region["kind"] not in {"cortex", "non-region"}
            or label in regions
        ):
            raise ValueError("Published cortical region identity is inconsistent.")
        regions[label] = region
    return regions


def load_annotation(path, vertex_count, regions):
    labels, colors, names = read_annot(path)
    if labels.shape != (vertex_count,) or np.any(
        (labels < -1) | (labels >= len(names))
    ):
        raise ValueError(f"Annotation does not describe this pial surface: {path}")
    values, counts = np.unique(labels, return_counts=True)
    if set(values) != set(regions):
        raise ValueError(f"Annotation labels and published regions differ: {path}")
    for value, count in zip(values, counts):
        name = "Unknown" if value == -1 else names[value].decode()
        annotation_value = 0 if value == -1 else int(colors[value, 4])
        region = regions[value]
        if (
            region["source_name"] != name
            or region["source_annotation_value"] != annotation_value
            or region["source_vertex_count"] != count
        ):
            raise ValueError(f"Published annotation identity does not match: {path}")
    return labels


def source_record(path, directory):
    return {"file": path.relative_to(directory).as_posix(), "sha256": sha256(path)}


def export_hemisphere(config, manifest, atlases, prefix, scene):
    directory = config["source_directory"]
    hemisphere = HEMISPHERES[prefix]
    pial = directory / "surf" / f"{prefix}.pial"
    vertices, faces = read_geometry(pial)
    region_indices = [
        source_region_index(manifest, atlas["id"], hemisphere) for atlas in atlases
    ]
    annotations, annotation_sources = [], []
    for atlas, regions in zip(atlases, region_indices):
        path = directory / "label" / f"{prefix}.{atlas['annotation']}.annot"
        annotations.append(load_annotation(path, len(vertices), regions))
        annotation_sources.append(
            {"atlas": atlas["id"], **source_record(path, directory)}
        )
    result = compare_surface(vertices, faces, np.column_stack(annotations))
    pairs = []
    for code, (labels, area) in enumerate(zip(result.region_labels, result.areas_mm2)):
        if area == 0:
            continue
        region_ids = [
            regions[label]["id"] for regions, label in zip(region_indices, labels)
        ]
        mesh_id = f"overlap:{hemisphere}:{labels[0]}:{labels[1]}"
        add_region(
            scene,
            *compact_region(result.partition, code),
            {"id": mesh_id, "overlap_id": mesh_id},
            [255, 255, 255],
        )
        pairs.append(
            {"region_ids": region_ids, "area_mm2": float(area), "mesh_id": mesh_id}
        )
    source = {
        "hemisphere": hemisphere,
        "pial": source_record(pial, directory),
        "annotations": annotation_sources,
    }
    return pairs, source


def export_comparison(config, manifest, selected=None):
    """Write only comparison assets; return their manifest declaration."""
    atlases = comparison_atlases(config, manifest, selected)
    verify_comparison_sources(config, manifest, atlases)
    output = config["output_directory"]
    assets = [
        {
            "atlas": atlas["id"],
            "file": atlas["file"],
            "sha256": sha256(output / atlas["file"]),
            "citation": atlas["citation"],
        }
        for atlas in atlases
    ]
    scene = trimesh.Scene()
    pairs, sources = [], []
    for prefix in HEMISPHERES:
        hemisphere_pairs, source = export_hemisphere(
            config, manifest, atlases, prefix, scene
        )
        pairs.extend(hemisphere_pairs)
        sources.append(source)
    totals = defaultdict(float)
    for pair in pairs:
        for region_id in pair["region_ids"]:
            totals[region_id] += pair["area_mm2"]
    atlas_ids = [atlas["id"] for atlas in atlases]
    suffix = "" if atlas_ids == ["destrieux", "hcp-mmp"] else "-" + "-".join(atlas_ids)
    geometry = output / f"atlas-overlaps{suffix}.glb"
    write_scene(scene, geometry)
    sidecar = output / f"atlas-comparison{suffix}.json"
    write_json(
        sidecar,
        {
            "schema_version": 1,
            "anatomy_id": config["anatomy"]["id"],
            "atlases": [atlas["id"] for atlas in atlases],
            "surface": "pial",
            "method": "barycentric-vertex-cells",
            "units": "mm2",
            "totals": dict(totals),
            "pairs": pairs,
            "sources": sources,
            "atlas_assets": assets,
            "geometry": {"file": geometry.name, "sha256": sha256(geometry)},
        },
    )
    return {"file": sidecar.name, "sha256": sha256(sidecar)}


def export_comparisons(config, manifest):
    """Publish every configured pair, keeping each pair's full-area marginals."""
    selected = config["atlas_comparison"]["atlases"]
    if len(selected) < 2 or len(set(selected)) != len(selected):
        raise ValueError("Comparison atlases must be distinct and contain at least two entries.")
    return [
        {"atlases": list(pair), **export_comparison(config, manifest, pair)}
        for pair in combinations(selected, 2)
    ]


def attach_comparisons(config, manifest):
    """Declare every pair, and the first under the single-pair key the viewer reads."""
    manifest["atlas_comparisons"] = export_comparisons(config, manifest)
    manifest["atlas_comparison"] = {
        key: manifest["atlas_comparisons"][0][key] for key in ("file", "sha256")
    }
    return manifest["atlas_comparison"]


def publish_comparison(config):
    """Attach a comparison to an existing publication without rebuilding anatomy."""
    path = config["output_directory"] / "manifest.json"
    manifest = json.loads(path.read_text())
    pointer = attach_comparisons(config, manifest)
    write_json(path, manifest)
    return pointer


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--anatomy", help="publish comparison for this declared anatomy"
    )
    arguments = parser.parse_args()
    config = read_config(arguments.anatomy)
    pointer = publish_comparison(config)
    print(f"Published {config['anatomy']['id']} atlas comparison: {pointer['file']}")


if __name__ == "__main__":
    main()
