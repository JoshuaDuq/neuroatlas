"""Categorical atlas transfer between brains, through registered spheres."""

import numpy as np
from scipy.spatial import cKDTree


def resample_surface_labels(source_sphere, target_sphere, labels):
    for sphere in (source_sphere, target_sphere):
        if (
            sphere.ndim != 2
            or sphere.shape[1] != 3
            or len(sphere) == 0
            or not np.isfinite(sphere).all()
        ):
            raise ValueError("Registered spheres require finite (n, 3) vertices")
    if labels.shape != (len(source_sphere),) or labels.dtype.kind not in "iu":
        raise ValueError("One integer label is required per source vertex")
    nearest = cKDTree(source_sphere).query(target_sphere)[1]
    return labels[nearest]
