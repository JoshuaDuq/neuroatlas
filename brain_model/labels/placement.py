"""Where a region is: the centroid of its voxels, and the voxel of its own label nearest it.

A curved region's centroid can lie outside it (a putamen's falls in the pallidus, a caudate's
in white matter), so whatever must land inside the region, such as the linked MRI's crosshair,
goes to the anchor instead.
"""

import numpy as np


def placements(labels, voxel_to_surface, values):
    """Each value's `centroid_ras_mm` and `anchor_ras_mm` in surface RAS millimetres, in one pass.

    The anchor is the value's voxel centre nearest its centroid; ties go to the first voxel in
    array order, so the result is deterministic.
    """
    if not len(values):
        return {}
    wanted = np.isin(labels, values)
    voxels = np.argwhere(wanted)
    owners = labels[wanted]
    found, owner = np.unique(owners, return_inverse=True)
    missing = sorted(set(np.asarray(values).tolist()) - set(found.tolist()))
    if missing:
        raise ValueError(f"Labels with no voxel to place: {missing}")
    affine = np.asarray(voxel_to_surface, dtype=np.float64)
    points = voxels @ affine[:3, :3].T + affine[:3, 3]
    counts = np.bincount(owner)
    centroids = np.column_stack(
        [np.bincount(owner, weights=points[:, axis]) / counts for axis in range(3)]
    )
    distances = np.sum((points - centroids[owner]) ** 2, axis=1)
    order = np.lexsort((distances, owner))
    first = order[np.r_[0, np.flatnonzero(np.diff(owner[order])) + 1]]
    return {
        int(value): {
            "centroid_ras_mm": centroids[index].tolist(),
            "anchor_ras_mm": points[first[index]].tolist(),
        }
        for index, value in enumerate(found)
    }


def surface_placement(points):
    """A surface patch's centroid and its own point nearest it, for cortex no voxel labels."""
    points = np.asarray(points, dtype=np.float64)
    centroid = points.mean(axis=0)
    nearest = int(np.argmin(np.sum((points - centroid) ** 2, axis=1)))
    return {"centroid_ras_mm": centroid.tolist(), "anchor_ras_mm": points[nearest].tolist()}
