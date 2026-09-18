"""Per-vertex parcel labels that close the cortical ribbon into solid wedges."""

import numpy as np
from nibabel.freesurfer.io import read_annot, read_geometry

from .geometry import majority
from .sources import HEMISPHERES, sha256

LABEL_DTYPE = np.dtype("<u2")


def triangle_owners(faces, labels):
    return majority(labels[faces])


def _wedge_faces(patch, count):
    directed = patch[:, [[0, 1], [1, 2], [2, 0]]].reshape(-1, 2)
    keys = directed[:, 0].astype(np.int64) * count + directed[:, 1]
    reverse = directed[:, 1].astype(np.int64) * count + directed[:, 0]
    boundary = directed[~np.isin(keys, reverse)]
    faces = [patch, patch[:, ::-1] + count]
    if len(boundary):
        start, end = boundary[:, 0], boundary[:, 1]
        faces.append(np.column_stack([end, start, start + count]))
        faces.append(np.column_stack([end, start + count, end + count]))
    return np.vstack(faces)


def wedge_defects(faces, labels):
    owners = triangle_owners(faces, labels)
    defects = {"wedges": 0, "holes": 0, "pinches": 0}
    for owner in np.unique(owners):
        triangles = faces[owners == owner]
        used, patch = np.unique(triangles, return_inverse=True)
        wedge = _wedge_faces(patch.reshape(-1, 3), len(used))
        edges = np.sort(wedge[:, [[0, 1], [1, 2], [2, 0]]].reshape(-1, 2), axis=1)
        _, counts = np.unique(edges, axis=0, return_counts=True)
        defects["wedges"] += 1
        defects["holes"] += int((counts == 1).sum())
        defects["pinches"] += int((counts > 2).sum())
    return defects


def _read_atlas(config, atlas, prefix):
    source = config["source_directory"]
    vertices, faces = read_geometry(source / "surf" / f"{prefix}.pial")
    labels, _, _ = read_annot(
        source / "label" / f"{prefix}.{atlas['annotation']}.annot"
    )
    if len(labels) != len(vertices):
        raise ValueError(f"{prefix}.{atlas['annotation']}: one label per vertex")
    return faces, labels.astype(np.int64)


def export_ribbon_labels(config, atlas, regions):
    published = {
        (region["hemisphere"], region["source_label_id"]): region["id"]
        for region in regions
    }
    indices, region_ids, counts = [], [], {}
    for prefix, hemisphere in HEMISPHERES.items():
        faces, labels = _read_atlas(config, atlas, prefix)
        if wedge_defects(faces, labels)["holes"]:
            raise ValueError(f"{atlas['id']} {prefix}: ribbon wedges must close")
        present = np.unique(labels)
        offset = len(region_ids)
        for label in present:
            key = (hemisphere, int(label))
            if key not in published:
                raise ValueError(f"{atlas['id']}: no published region for {key}")
            region_ids.append(published[key])
        indices.append(np.searchsorted(present, labels).astype(LABEL_DTYPE) + offset)
        counts[hemisphere] = len(labels)
    path = config["output_directory"] / f"ribbon-{atlas['id']}.labels"
    np.concatenate(indices).astype(LABEL_DTYPE).tofile(path)
    return {
        "file": path.name,
        "sha256": sha256(path),
        "vertex_counts": counts,
        "region_ids": region_ids,
        "source": (
            f"Native lh/rh.{atlas['annotation']}.annot, one region index per vertex; "
            "a triangle belongs to the parcel holding most of its vertices"
        ),
    }


def validate_ribbon_labels(config, atlas, record):
    path = config["output_directory"] / record["file"]
    if sha256(path) != record["sha256"]:
        raise ValueError(f"{record['file']}: checksum mismatch")
    published = np.fromfile(path, dtype=LABEL_DTYPE)
    total = sum(record["vertex_counts"].values())
    if len(published) != total:
        raise ValueError(f"{record['file']}: one label per surface vertex is required")
    if published.max() >= len(record["region_ids"]):
        raise ValueError(f"{record['file']}: label index outside the published regions")
    defects = {"wedges": 0, "holes": 0, "pinches": 0}
    at = 0
    for prefix, hemisphere in HEMISPHERES.items():
        faces, labels = _read_atlas(config, atlas, prefix)
        if record["vertex_counts"][hemisphere] != len(labels):
            raise ValueError(f"{record['file']}: {hemisphere} vertex count mismatch")
        hemisphere_labels = published[at : at + len(labels)]
        at += len(labels)
        # Published indices must partition the surface exactly as the annotation does.
        if not np.array_equal(
            np.unique(hemisphere_labels, return_inverse=True)[1],
            np.unique(labels, return_inverse=True)[1],
        ):
            raise ValueError(f"{record['file']}: {hemisphere} labels differ from source")
        for key, value in wedge_defects(faces, labels).items():
            defects[key] += value
    return {
        "file": record["file"],
        "sha256": record["sha256"],
        "vertex_count": total,
        "region_count": len(record["region_ids"]),
        **defects,
    }
